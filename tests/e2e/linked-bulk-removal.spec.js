const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

async function setup(page) {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await openApp(page);
  await page.evaluate(async () => {
    window.__bulkHandlers = {};
    Neutralino.events.on = async (name, handler) => { window.__bulkHandlers[name] = handler; };
    await Neutralino.filesystem.createDirectory('C:/Original');
    window.__desktopFiles.set('C:/Original/a.md', '# original a');
    window.__desktopFiles.set('C:/Original/b.md', '# original b');
    window.__bulkScans = 0;
    const read = Neutralino.filesystem.readDirectory;
    Neutralino.filesystem.readDirectory = async path => {
      if (path === 'C:/Original') window.__bulkScans++;
      return read(path);
    };
    await window.NL_LINK_MARKDOWN_FOLDER_PATH('C:/Original');
    await window.NL_START_LINKED_MONITORING();
    await window.MarkdownViewerFlushWorkspace();
  });
}

function row(page, name) {
  return page.locator('#document-tree [data-tree-type="document"]').filter({ has: page.locator('.document-tree-label', { hasText: new RegExp('^' + name + '$') }) });
}

async function bulkRemove(page, names, action) {
  for (let i = 0; i < names.length; i++) await row(page, names[i]).click({ modifiers: i ? ['Control'] : [] });
  await expect(page.locator('#document-tree .is-selected')).toHaveCount(names.length);
  await row(page, names[0]).click({ button: 'right' });
  await page.locator('.document-menu-context.open').getByRole('menuitem', { name: action, exact: true }).click();
}

async function state(page) {
  return page.evaluate(async () => {
    await window.MarkdownViewerFlushWorkspace();
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    return { org: await storage.getDocumentOrganization(), docs: await storage.listDocumentMetadata(), trash: await storage.listTrash(), originals: [window.__desktopFiles.get('C:/Original/a.md'), window.__desktopFiles.get('C:/Original/b.md')] };
  });
}

async function backgroundScan(page) {
  const scans = await page.evaluate(() => window.__bulkScans);
  const lastScan = await page.evaluate(async () => {
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    return (await storage.getDocumentOrganization()).linkedLocations[0].lastScanAt;
  });
  await page.evaluate(() => window.__bulkHandlers.windowFocus());
  await expect.poll(() => page.evaluate(() => window.__bulkScans)).toBeGreaterThan(scans);
  // Wait for the scan's persisted organization snapshot, not just its first read.
  await expect.poll(() => page.evaluate(async () => {
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    return (await storage.getDocumentOrganization()).linkedLocations[0].lastScanAt;
  })).toBeGreaterThan(lastScan);
}

test('bulk unlink persists exclusions, background scans respect them and explicit rescan restores links', async ({ page }) => {
  await setup(page);
  await bulkRemove(page, ['a', 'b'], 'Remove 2 linked files');
  await expect(page.locator('.app-toast').filter({ hasText: 'Selected files removed' })).toContainText('2 linked file(s) removed');
  await expect(row(page, 'a')).toHaveCount(0); await expect(row(page, 'b')).toHaveCount(0);
  let result = await state(page);
  expect(result.org.linkedLocations[0].excludedPaths.sort()).toEqual(['a.md', 'b.md']);
  expect(result.originals).toEqual(['# original a', '# original b']);
  await backgroundScan(page);
  result = await state(page);
  expect(result.docs.filter(x => x.sourcePath)).toHaveLength(0);
  expect(result.org.linkedLocations[0].excludedPaths.sort()).toEqual(['a.md', 'b.md']);
  await page.locator('#document-tree [data-tree-type="linked-location"]').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Rescan folder', exact: true }).click();
  await expect(row(page, 'a')).toHaveCount(1); await expect(row(page, 'b')).toHaveCount(1);
  expect((await state(page)).org.linkedLocations[0].excludedPaths).toEqual([]);
});

test('mixed bulk removal reports actual successes and rolls back exclusion for a failed linked delete', async ({ page }) => {
  await setup(page);
  await page.evaluate(async () => {
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    const failedId = (await storage.listDocumentMetadata()).find(x => x.sourcePath === 'C:/Original/b.md').id;
    const remove = MarkdownWorkspaceStorage.prototype.deleteDocument;
    MarkdownWorkspaceStorage.prototype.deleteDocument = async function(id, options) {
      if (id === failedId) throw new Error('injected deletion failure');
      return remove.call(this, id, options);
    };
  });
  await bulkRemove(page, ['a', 'b', 'Welcome to Markdown'], 'Remove/Delete 3 selected items');
  const summary = page.locator('.app-toast').filter({ hasText: 'Removal partially completed' });
  await expect(summary).toContainText('1 linked file(s) removed; 1 workspace file(s) moved to Trash; 1 file(s) could not be removed and were kept');
  await expect(page.locator('.app-toast').filter({ hasText: 'Linked file closed' })).toHaveCount(0);
  await expect(row(page, 'b')).toHaveCount(1); await expect(row(page, 'a')).toHaveCount(0);
  const result = await state(page);
  expect(result.org.linkedLocations[0].excludedPaths).toEqual(['a.md']);
  expect(result.originals).toEqual(['# original a', '# original b']);
  expect(result.docs.some(x => x.sourcePath === 'C:/Original/b.md')).toBe(true);
  expect(result.docs.some(x => x.title === 'Welcome to Markdown')).toBe(false);
  await backgroundScan(page);
  await expect(row(page, 'a')).toHaveCount(0); await expect(row(page, 'b')).toHaveCount(1);
});

test('exclusion persistence failure cancels removal without claiming success or deleting drafts', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const save = MarkdownWorkspaceStorage.prototype.saveDocumentOrganization;
    MarkdownWorkspaceStorage.prototype.saveDocumentOrganization = async function(org, options) {
      if (org.linkedLocations.some(x => x.excludedPaths.length)) throw new Error('injected exclusion persistence failure');
      return save.call(this, org, options);
    };
  });
  await bulkRemove(page, ['a', 'b'], 'Remove 2 linked files');
  await expect(page.locator('.app-toast').filter({ hasText: 'Removal failed' })).toContainText('0 linked file(s) removed; 0 workspace file(s) moved to Trash; 2 file(s) could not be removed and were kept');
  const result = await state(page);
  expect(result.docs.filter(x => x.sourcePath)).toHaveLength(2);
  expect(result.org.linkedLocations[0].excludedPaths).toEqual([]);
  expect(result.originals).toEqual(['# original a', '# original b']);
});
