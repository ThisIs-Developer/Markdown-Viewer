const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');
test('conversion conflict preserves both versions without claiming normal conversion success', async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);window.NL_OS="Windows";');
  await openApp(page);
  await page.evaluate(async () => {
    __desktopFiles.set('C:/audit.md', '# initial');
    await NL_IMPORT_EXTERNAL_FILE('# draft', 'audit', 'C:/audit.md');
    await MarkdownViewerFlushWorkspace();
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    const metadata = (await storage.listDocumentMetadata()).find(x => x.sourcePath === 'C:/audit.md');
    const save = MarkdownWorkspaceStorage.prototype.saveDocuments; let injected = false;
    MarkdownWorkspaceStorage.prototype.saveDocuments = async function(items, ...args) {
      const tab = items.find(x => x.id === metadata.id);
      if (!injected && tab && !tab.sourcePath) {
        injected = true;
        const error = Error('concurrent conflict');
        Object.assign(error, { name: 'WorkspaceConflictError', documentId: tab.id, contentConflict: true, attemptedTab: { ...tab }, storedMetadata: metadata, storedContent: '# remote' });
        throw error;
      }
      return save.call(this, items, ...args);
    };
  });
  await page.locator('[data-tree-type="document"]').filter({ has: page.locator('.document-tree-label', { hasText: /^audit$/ }) }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Convert to Workspace copy', exact: true }).click();
  await expect(page.getByText('Conversion failed', { exact: true })).toBeVisible();
  await expect(page.getByText('Converted to Workspace copy', { exact: true })).toHaveCount(0);
  const docs = await page.evaluate(async () => {
    await MarkdownViewerFlushWorkspace(); const storage = new MarkdownWorkspaceStorage(); await storage.init();
    return storage.listDocumentMetadata();
  });
  expect(docs.find(x => x.title === 'audit').sourcePath).toBe('C:/audit.md');
  expect(docs.find(x => x.title === 'audit (conflict copy)').sourcePath).toBeFalsy();
});
