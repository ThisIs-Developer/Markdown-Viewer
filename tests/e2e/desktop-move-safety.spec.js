const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

test('stock desktop rename collision preserves both bodies and the committed index', async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await openApp(page);
  const result = await page.evaluate(async () => {
    const storage = new MarkdownWorkspaceStorage();
    await storage.init();
    const tab = { id: 'rename-test', title: 'Before', content: '# original', contentLoaded: true, workspaceId: 'workspace_default' };
    await storage.saveDocuments([tab], { folders: [] }, { forceContent: true });
    const original = storage.vaultPath + '/' + tab._vaultRelativePath;
    const indexPath = storage.vaultPath + '/.markdown-viewer/index.json';
    const index = __desktopFiles.get(indexPath);
    tab.title = 'After';
    const destination = storage.vaultPath + '/' + await storage._desktopDocumentRelativePath(tab, { folders: [] });
    __desktopFiles.set(destination, '# unrelated body');
    let error;
    try { await storage.saveDocuments([tab], { folders: [] }, { changedIds: [tab.id] }); }
    catch (failure) { error = failure.message; }
    return { error, original: __desktopFiles.get(original), destination: __desktopFiles.get(destination), indexUnchanged: __desktopFiles.get(indexPath) === index };
  });
  expect(result.error).toMatch(/destination.*exists/i);
  expect(result.original).toBe('# original');
  expect(result.destination).toBe('# unrelated body');
  expect(result.indexUnchanged).toBe(true);
});
