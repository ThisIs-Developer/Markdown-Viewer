const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

const location = (page, name) => page.locator('#document-tree [data-tree-type="linked-location"]').filter({ has: page.locator('.document-tree-label', { hasText: new RegExp('^' + name + '$') }) });
const documentRow = (page, name) => page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: new RegExp('^' + name + '$') });
const children = row => row.locator('xpath=following-sibling::div[1]');

async function setup(page) {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await page.addInitScript(() => {
    const saved = JSON.parse(sessionStorage.getItem('grouping-files') || '[]');
    for (const [path, body] of saved) {
      window.__desktopFiles.set(path, body);
      const parts = path.split('/'); parts.pop();
      parts.forEach((_, i) => Neutralino.filesystem.createDirectory(parts.slice(0, i + 1).join('/')));
    }
  });
  await openApp(page);
  await page.evaluate(async () => {
    for (const dir of ['C:/Parent', 'C:/Parent/Sub', 'C:/Elsewhere', 'C:/Other']) await Neutralino.filesystem.createDirectory(dir);
    __desktopFiles.set('C:/Parent/Sub/local.md', '# local');
    __desktopFiles.set('C:/Elsewhere/external.md', '# external');
    __desktopFiles.set('C:/Other/child.md', '# child');
    await NL_LINK_MARKDOWN_FOLDER_PATH('C:/Parent');
    await MarkdownViewerFlushWorkspace();
  });
}

async function link(page, target, kind, path) {
  await page.evaluate(({ kind, path }) => {
    Neutralino.os.showOpenDialog = async () => [path];
    Neutralino.os.showFolderDialog = async () => path;
  }, { kind, path });
  await target.dispatchEvent('contextmenu', { clientX: 130, clientY: 170 });
  await page.getByRole('menuitem', { name: 'Link Markdown ' + kind, exact: true }).click();
}

async function state(page) {
  return page.evaluate(async () => {
    await MarkdownViewerFlushWorkspace();
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    return { docs: await storage.listDocumentMetadata(), org: await storage.getDocumentOrganization(), originals: Array.from(__desktopFiles.entries()).filter(([path]) => !path.startsWith('C:/Documents/')) };
  });
}

for (const nested of [false, true]) test('links group inside the selected ' + (nested ? 'subfolder' : 'root') + ' without moving originals', async ({ page }) => {
  await setup(page);
  const target = nested ? page.locator('#document-tree [data-tree-type="linked-virtual-folder"]').filter({ hasText: /^Sub$/ }) : location(page, 'Parent');
  await link(page, target, 'files', 'C:/Elsewhere/external.md');
  await expect(children(target).locator('[data-tree-type="document"]').filter({ hasText: /^external$/ })).toHaveCount(1);
  await link(page, target, 'folder', 'C:/Other');
  await expect(children(target).locator('[data-tree-type="linked-location"]')).toHaveCount(1);
  const before = await state(page);
  const parentId = before.org.linkedLocations.find(item => item.path === 'C:/Parent').id;
  const external = before.docs.find(item => item.title === 'external');
  const other = before.org.linkedLocations.find(item => item.path === 'C:/Other');
  expect(external.linkedParentId).toBe(parentId);
  expect(external.linkedParentPath).toBe(nested ? 'Sub' : '');
  expect(external.sourcePath).toBe('C:/Elsewhere/external.md');
  expect(external.linkedRootId).toBeFalsy();
  expect(other.linkedParentId).toBe(parentId);
  expect(before.docs.find(item => item.title === 'child').linkedRootId).toBe(other.id);
  await page.evaluate(async () => {
    await NL_LINK_MARKDOWN_FOLDER_PATH('C:/Parent');
    await NL_LINK_MARKDOWN_FOLDER_PATH('C:/Other');
  });
  expect((await state(page)).originals).toEqual(before.originals);
  await expect(documentRow(page, 'external')).toHaveAttribute('data-tree-depth', nested ? '3' : '2');
  await page.evaluate(() => sessionStorage.setItem('grouping-files', JSON.stringify(Array.from(__desktopFiles.entries()))));
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
  await expect(documentRow(page, 'external')).toHaveAttribute('data-tree-depth', nested ? '3' : '2');
  await expect(location(page, 'Other')).toHaveAttribute('data-tree-depth', nested ? '3' : '2');
  await documentRow(page, 'external').locator('.document-tree-main').click();
  await page.locator('#markdown-editor').fill('# saved to unchanged path');
  await page.locator('#markdown-editor').press('Control+s');
  await expect.poll(() => page.evaluate(() => __desktopFiles.get('C:/Elsewhere/external.md'))).toBe('# saved to unchanged path');
  await location(page, 'Parent').dispatchEvent('contextmenu', { clientX: 120, clientY: 150 });
  await page.getByRole('menuitem', { name: 'Remove linked folder', exact: true }).click();
  await page.getByRole('alertdialog', { name: 'Remove linked folder', exact: true }).getByRole('button', { name: 'Remove link', exact: true }).click();
  await expect(location(page, 'Parent')).toHaveCount(0);
  await expect(location(page, 'Other')).toHaveAttribute('data-tree-depth', '1');
  await expect(documentRow(page, 'external')).toHaveAttribute('data-tree-depth', '1');
  await expect(documentRow(page, 'child')).toHaveCount(1);
  const after = await state(page);
  expect(after.docs.find(item => item.title === 'external').sourcePath).toBe('C:/Elsewhere/external.md');
  expect(after.originals).toEqual(before.originals.map(([path, body]) => [path, path.endsWith('external.md') ? '# saved to unchanged path' : body]));
});

test('relinking an ancestor under its child is rejected without losing either group', async ({ page }) => {
  await setup(page);
  await link(page, location(page, 'Parent'), 'folder', 'C:/Other');
  await expect(location(page, 'Other')).toHaveAttribute('data-tree-depth', '2');
  await link(page, location(page, 'Other'), 'folder', 'C:/Parent');
  await expect(page.locator('.app-toast').filter({ hasText: 'Link failed' })).toBeVisible();
  await expect(location(page, 'Parent')).toHaveAttribute('data-tree-depth', '1');
  await expect(location(page, 'Other')).toHaveAttribute('data-tree-depth', '2');
  expect((await state(page)).org.linkedLocations).toHaveLength(2);
});

test('failed grouping persistence retains the previous location', async ({ page }) => {
  await setup(page);
  await page.evaluate(async () => {
    await NL_IMPORT_EXTERNAL_FILE('# external', 'external', 'C:/Elsewhere/external.md');
    await MarkdownViewerFlushWorkspace();
    const save = MarkdownWorkspaceStorage.prototype.saveDocuments;
    MarkdownWorkspaceStorage.prototype.saveDocuments = function(docs, ...args) {
      if (docs.some(tab => tab.title === 'external' && tab.linkedParentId)) return Promise.reject(new Error('Injected grouping failure'));
      return save.call(this, docs, ...args);
    };
  });
  await link(page, location(page, 'Parent'), 'files', 'C:/Elsewhere/external.md');
  await expect(page.locator('.app-toast').filter({ hasText: 'Link failed' })).toBeVisible();
  await expect(documentRow(page, 'external')).toHaveAttribute('data-tree-depth', '1');
  const saved = await state(page);
  expect(saved.docs.find(item => item.title === 'external').linkedParentId).toBeFalsy();
  expect(saved.originals.find(([path]) => path.endsWith('external.md'))[1]).toBe('# external');
});

test('converting a parent keeps independently grouped sources linked', async ({ page }) => {
  await setup(page);
  await link(page, location(page, 'Parent'), 'files', 'C:/Elsewhere/external.md');
  await expect(documentRow(page, 'external')).toHaveAttribute('data-tree-depth', '2');
  await link(page, location(page, 'Parent'), 'folder', 'C:/Other');
  await expect(location(page, 'Other')).toHaveAttribute('data-tree-depth', '2');
  const before = await state(page);
  await location(page, 'Parent').dispatchEvent('contextmenu', { clientX: 120, clientY: 150 });
  await page.getByRole('menuitem', { name: 'Convert to Workspace copy', exact: true }).click();
  await page.getByRole('alertdialog', { name: 'Convert linked folder', exact: true }).getByRole('button', { name: 'Convert to Workspace copy', exact: true }).click();
  await expect(location(page, 'Parent')).toHaveCount(0);
  await expect(location(page, 'Other')).toHaveAttribute('data-tree-depth', '1');
  await expect(documentRow(page, 'external')).toHaveClass(/is-linked-document/);
  await expect(documentRow(page, 'local')).not.toHaveClass(/is-linked-document/);
  expect((await state(page)).originals).toEqual(before.originals);
});

for (const [width, theme] of [[1280, 'light'], [390, 'dark']]) test(`nested linking menu fits ${width}px in ${theme} theme`, async ({ page }) => {
  await setup(page);
  await link(page, location(page, 'Parent'), 'folder', 'C:/Other');
  await expect(location(page, 'Other')).toHaveAttribute('data-tree-depth', '2');
  await page.setViewportSize({ width, height: 844 });
  await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme);
  if (width < 768 || !(await page.locator('#document-sidebar').isVisible())) await page.locator('#document-sidebar-open').click();
  if (width < 768) await expect(page.locator('body')).toHaveClass(/document-sidebar-mobile-open/);
  await location(page, 'Other').dispatchEvent('contextmenu', { clientX: 150, clientY: 200 });
  const menu = page.locator('.document-menu-dropdown.open');
  await expect(menu.getByRole('menuitem', { name: 'Link Markdown files', exact: true })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Link Markdown folder', exact: true })).toBeVisible();
  await expect(menu).toHaveCSS('opacity', '1');
  const box = await menu.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
  expect(box.y + box.height).toBeLessThanOrEqual(844);
  expect(await menu.getByRole('menuitem').evaluateAll(items => items.every(item => item.scrollWidth <= item.clientWidth))).toBe(true);
  await page.screenshot({ path: `test-results/linked-grouping-${width}-${theme}.png` });
});
