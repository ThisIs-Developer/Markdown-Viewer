const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const JSZip = require('jszip');
const { openApp, setEditorContent, editorValue } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

async function menu(page, row, name) {
  await row.dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
  await page.locator('.document-menu-context.open').getByRole('menuitem', { name, exact: true }).click();
}
async function folder(page, name, parent) {
  if (parent) await menu(page, parent, 'New folder');
  else await page.locator('#sidebar-new-folder').click();
  await page.locator('#document-name-modal-input').fill(name);
  await page.locator('#document-name-modal-confirm').click();
  return page.locator('[data-tree-type="folder"]').filter({ hasText: name });
}

test('inline file and folder rename selects the name, validates, cancels and preserves drafts', async ({ page }) => {
  const errors = await openApp(page);
  await page.locator('#tab-new-btn').click();
  await setEditorContent(page, '# unsaved draft');
  const id = await page.locator('.tab-item.active').getAttribute('data-tab-id');
  const row = page.locator(`[data-document-id="${id}"]`);
  await menu(page, row, 'Rename');
  const input = page.locator('.document-tree-rename-input');
  await expect(input).toBeFocused();
  expect(await input.evaluate(el => el.selectionEnd - el.selectionStart)).toBe((await input.inputValue()).length);
  await input.fill('Renamed <safe>');
  await input.press('Enter');
  await expect(row.locator('.document-tree-label')).toHaveText('Renamed <safe>');
  expect(await editorValue(page)).toBe('# unsaved draft');
  await menu(page, row, 'Rename');
  await input.fill('discard');
  await input.press('Escape');
  await expect(row.locator('.document-tree-label')).toHaveText('Renamed <safe>');
  const first = await folder(page, 'Research');
  await folder(page, 'Occupied');
  await menu(page, first, 'Rename');
  await input.fill('Occupied');
  await input.press('Enter');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#explorer-rename-error')).toContainText('already exists');
  await input.fill('Reference');
  await input.press('Enter');
  await expect(page.locator('[data-tree-type="folder"]').filter({ hasText: 'Reference' })).toHaveCount(1);
  await menu(page, row, 'Rename');
  await input.fill('cancel on blur');
  await page.locator('#document-sidebar-search').click();
  await expect(input).toHaveCount(0);
  await expect(row.locator('.document-tree-label')).toHaveText('Renamed <safe>');
  expect(errors).toEqual([]);
});

test('web folder ZIP preserves hierarchy, empty folders, duplicate names and current drafts', async ({ page }) => {
  await openApp(page);
  const root = await folder(page, 'Project');
  const child = await folder(page, 'Nested', root);
  await folder(page, 'Empty', child);
  for (const content of ['# first', '# latest draft']) {
    await menu(page, child, 'New file');
    await setEditorContent(page, content);
    const id = await page.locator('.tab-item.active').getAttribute('data-tab-id');
    await menu(page, page.locator(`[data-document-id="${id}"]`), 'Rename');
    await page.locator('.document-tree-rename-input').fill('Same');
    await page.locator('.document-tree-rename-input').press('Enter');
  }
  const downloading = page.waitForEvent('download');
  await menu(page, root, 'Download folder');
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('Project.zip');
  const zip = await JSZip.loadAsync(await fs.readFile(await download.path()));
  expect(Object.keys(zip.files).sort()).toEqual(['Project/', 'Project/Nested/', 'Project/Nested/Empty/', 'Project/Nested/Same (2).md', 'Project/Nested/Same.md']);
  const bodies = await Promise.all(Object.values(zip.files).filter(entry => !entry.dir).map(entry => entry.async('string')));
  expect(bodies.sort()).toEqual(['# first', '# latest draft']);
});

async function linked(page) {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window); window.NL_OS="Windows";');
  await openApp(page);
  await page.evaluate(async () => {
    window.__desktopFiles.set('C:/Original/δοκιμή & %.md', '# original');
    await window.NL_IMPORT_EXTERNAL_FILE('# original', 'δοκιμή & %', 'C:/Original/δοκιμή & %.md');
  });
  return page.locator('.document-tree-row.is-linked-document').filter({ hasText: 'δοκιμή & %' });
}

test('linked rename changes the original filename, retains draft and saves to the new path', async ({ page }) => {
  const row = await linked(page);
  const id = await row.getAttribute('data-document-id');
  await setEditorContent(page, '# local draft');
  await menu(page, row, 'Rename');
  const input = page.locator('.document-tree-rename-input');
  await expect(input).toHaveValue('δοκιμή & %.md');
  await input.fill('Renamed 日本 & #.markdown');
  await input.press('Enter');
  const renamed = page.locator(`[data-document-id="${id}"]`);
  await expect(renamed).toHaveAttribute('title', 'C:/Original/Renamed 日本 & #.markdown');
  expect(await editorValue(page)).toBe('# local draft');
  expect(await page.evaluate(() => [...window.__desktopFiles].filter(([key]) => key.startsWith('C:/Original/')))).toEqual([['C:/Original/Renamed 日本 & #.markdown', '# original']]);
  await menu(page, renamed, 'Save');
  await expect.poll(() => page.evaluate(() => window.__desktopFiles.get('C:/Original/Renamed 日本 & #.markdown'))).toBe('# local draft');
  const record = await page.evaluate(async id => {
    await MarkdownViewerFlushWorkspace();
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    return (await storage.listDocumentMetadata()).find(tab => tab.id === id);
  }, id);
  expect(record.sourcePath).toBe('C:/Original/Renamed 日本 & #.markdown');
});

test('linked rename rejects invalid names and collisions without changing either original', async ({ page }) => {
  const row = await linked(page);
  await page.evaluate(() => window.__desktopFiles.set('C:/Original/Occupied.md', '# occupied'));
  await menu(page, row, 'Rename');
  const input = page.locator('.document-tree-rename-input');
  for (const name of ['../escape.md', 'CON.md', 'other.txt', 'Occupied.md']) {
    await input.fill(name); await input.press('Enter');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
  }
  await input.press('Escape');
  expect(await page.evaluate(() => [...window.__desktopFiles].filter(([key]) => key.startsWith('C:/Original/')))).toEqual([
    ['C:/Original/δοκιμή & %.md', '# original'], ['C:/Original/Occupied.md', '# occupied']
  ]);
});

test('linked folder action uses the platform name and opens the actual parent directory', async ({ page }) => {
  const row = await linked(page);
  for (const [os, name] of [['Windows', 'Open in File Explorer'], ['Darwin', 'Open in Finder'], ['Linux', 'Open in File Manager']]) {
    await page.evaluate(os => { window.NL_OS = os; window.Neutralino.os.open = async path => { window.__openedFolder = path; }; }, os);
    // Context menu actions are rebuilt on invocation.
    await menu(page, row, name);
    expect(await page.evaluate(() => window.__openedFolder)).toBe('C:/Original');
  }
});

test('permission failure during linked rename retains the original link and draft', async ({ page }) => {
  const row = await linked(page);
  await setEditorContent(page, '# retained draft');
  await page.evaluate(() => { Neutralino.filesystem.move = async () => { throw new Error('Access denied'); }; });
  await menu(page, row, 'Rename');
  const input = page.locator('.document-tree-rename-input');
  await input.fill('Denied.md'); await input.press('Enter');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await input.press('Escape');
  await expect(row).toHaveAttribute('title', 'C:/Original/δοκιμή & %.md');
  expect(await editorValue(page)).toBe('# retained draft');
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Original/δοκιμή & %.md'))).toBe('# original');
});

test('locking Secret Workspace cancels a folder archive that is still being generated', async ({ page }) => {
  await openApp(page);
  const secret = page.locator('[data-tree-id="workspace_secret"]');
  await menu(page, secret, 'Set password');
  await page.locator('#secret-workspace-key').fill('folder-export-test');
  await page.locator('#secret-workspace-key-confirm').fill('folder-export-test');
  await page.locator('#secret-workspace-modal-confirm').click();
  await expect(page.locator('#secret-workspace-modal')).toBeHidden();
  const privateFolder = await folder(page, 'Confidential', secret);
  await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js' });
  await page.evaluate(() => {
    window.__downloads = 0;
    window.saveAs = () => { window.__downloads++; };
    JSZip.prototype.generateAsync = () => new Promise(resolve => { window.__finishZip = () => resolve(new Blob(['secret'])); });
  });
  await menu(page, privateFolder, 'Download folder');
  await page.waitForFunction(() => !!window.__finishZip);
  await menu(page, secret, 'Lock workspace');
  await expect(privateFolder).toHaveCount(0);
  await page.evaluate(async () => { window.__finishZip(); await new Promise(resolve => setTimeout(resolve, 0)); });
  expect(await page.evaluate(() => window.__downloads)).toBe(0);
});
