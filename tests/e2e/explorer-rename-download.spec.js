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

test('inline rename keeps Explorer typography, row height and themed focus in light and dark modes', async ({ page }, testInfo) => {
  await openApp(page);
  await page.locator('#tab-new-btn').click();
  const id = await page.locator('.tab-item.active').getAttribute('data-tab-id');
  const file = page.locator(`[data-document-id="${id}"]`);
  const directory = await folder(page, 'Research');
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme);
    for (const row of [file, directory]) {
      const before = await row.evaluate(el => {
        const label = getComputedStyle(el.querySelector('.document-tree-label'));
        const icon = getComputedStyle(el.querySelector('.document-tree-main > i'));
        return { fontSize: label.fontSize, fontFamily: label.fontFamily, lineHeight: label.lineHeight,
          iconSize: icon.fontSize, rowHeight: el.getBoundingClientRect().height };
      });
      await menu(page, row, 'Rename');
      const input = page.locator('.document-tree-rename-input');
      await expect(input).toBeFocused();
      const after = await input.evaluate(el => {
        const style = getComputedStyle(el);
        const row = el.closest('.document-tree-row');
        return { fontSize: style.fontSize, fontFamily: style.fontFamily, lineHeight: style.lineHeight,
          iconSize: getComputedStyle(row.querySelector('.document-tree-rename > i')).fontSize,
          rowHeight: row.getBoundingClientRect().height, outline: style.outlineStyle,
          border: style.borderTopColor, accent: style.getPropertyValue('--accent-color').trim() };
      });
      expect(after.fontSize).toBe(before.fontSize);
      expect(after.fontFamily).toBe(before.fontFamily);
      // Firefox rounds text-input line boxes to whole pixels.
      expect(Math.abs(parseFloat(after.lineHeight) - parseFloat(before.lineHeight))).toBeLessThan(1);
      expect(after.iconSize).toBe(before.iconSize);
      expect(after.rowHeight).toBe(before.rowHeight);
      expect(after.outline).toBe('none');
      expect(after.border).toBe(await page.evaluate(accent => {
        const probe = document.createElement('span'); probe.style.color = accent;
        document.body.appendChild(probe); const color = getComputedStyle(probe).color; probe.remove(); return color;
      }, after.accent));
      await page.locator('#document-sidebar').screenshot({ path: testInfo.outputPath(`rename-${theme}-${row === file ? 'file' : 'folder'}.png`) });
      await input.press('Escape');
    }
  }
});

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

async function linked(page, sourcePath = 'C:/Original/δοκιμή & %.md') {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window); window.NL_OS="Windows";');
  await openApp(page);
  await page.evaluate(async sourcePath => {
    window.__desktopFiles.set('C:/Original/δοκιμή & %.md', '# original');
    await window.NL_IMPORT_EXTERNAL_FILE('# original', 'δοκιμή & %', sourcePath);
  }, sourcePath);
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

test('unchanged Windows linked filename closes without attempting a disk move', async ({ page }) => {
  const row = await linked(page, 'C:\\Original\\δοκιμή & %.md');
  await page.evaluate(() => { window.__moves = 0; Neutralino.filesystem.move = async () => { window.__moves++; throw new Error('Unexpected move'); }; });
  await menu(page, row, 'Rename');
  await page.locator('.document-tree-rename-input').press('Enter');
  await expect(page.locator('.document-tree-rename-input')).toHaveCount(0);
  expect(await page.evaluate(() => window.__moves)).toBe(0);
});

test('a tab beyond the Explorer render budget can still be renamed inline', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('markdownViewerTabs', JSON.stringify(Array.from({ length: 270 }, (_, index) => ({
      id: 'many_' + index, title: 'Document ' + String(index).padStart(3, '0'), content: '# fixture',
      workspaceId: 'workspace_default', isOpen: index === 0 || index === 269, createdAt: 1, lastEditedAt: 1
    }))));
    localStorage.setItem('markdownViewerActiveTab', 'many_0');
  });
  await openApp(page);
  await expect(page.locator('[data-document-id="many_269"]')).toHaveCount(0);
  await page.locator('[data-tab-id="many_269"] .tab-menu-btn').click();
  await page.locator('.tab-menu-dropdown.open [data-action="rename"]').click();
  await expect(page.locator('.document-tree-rename-input')).toHaveValue('Document 269');
  await page.locator('.document-tree-rename-input').fill('Renamed last');
  await page.locator('.document-tree-rename-input').press('Enter');
  await expect(page.locator('[data-tab-id="many_269"] .tab-title')).toHaveText('Renamed last');
});

test('a mixed browser drop on Linked Workspace continues to the file after linking its folder', async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window); window.NL_OS="Windows";');
  await openApp(page);
  await page.evaluate(async () => {
    await Neutralino.filesystem.createDirectory('C:/Dropped');
    window.__desktopFiles.set('C:/Dropped/nested.md', '# nested original');
    window.__desktopFiles.set('C:/Original/extra.md', '# extra original');
    Neutralino.os.showFolderDialog = async () => 'C:/Dropped';
    Neutralino.os.showOpenDialog = async () => ['C:/Original/extra.md'];
    const file = new File(['# extra original'], 'extra.md', { type: 'text/markdown' });
    const data = new DataTransfer(); data.items.add(file);
    Object.defineProperty(data, 'items', { value: [
      { kind: 'file', webkitGetAsEntry: () => ({ name: 'Dropped', isDirectory: true }), getAsFile: () => null },
      { kind: 'file', webkitGetAsEntry: () => null, getAsFile: () => file }
    ] });
    document.querySelector('[data-tree-type="linked-workspace"]').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
  });
  await expect(page.locator('.is-linked-document').filter({ hasText: 'nested' })).toHaveCount(1);
  await expect(page.locator('.is-linked-document').filter({ hasText: 'extra' })).toHaveCount(1);
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
