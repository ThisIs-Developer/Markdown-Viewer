const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');
test.beforeEach(async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);window.NL_OS="Windows";');
  await openApp(page);
  await page.evaluate(async () => {
    await MarkdownViewerFlushWorkspace();
    window.__managedIndex = 'C:/Documents/Markdown Viewer Vault/.markdown-viewer/index.json';
    window.__managedBefore = __desktopFiles.get(__managedIndex);
    Neutralino.os.showSaveDialog = async () => __managedIndex;
  });
});
test('Save As refuses internal metadata before overwrite confirmation or write', async ({ page }) => {
  await page.locator('[data-tree-type="document"]').filter({ has: page.locator('.document-tree-label', { hasText: /^Welcome to Markdown$/ }) }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Save As linked file…', exact: true }).click();
  await expect(page.getByText('Save failed', { exact: true })).toBeVisible();
  await expect(page.getByRole('alertdialog', { name: 'Replace Markdown file?' })).toHaveCount(0);
  expect(await page.evaluate(() => __desktopFiles.get(__managedIndex))).toBe(await page.evaluate(() => __managedBefore));
});
test('Create linked file refuses managed body storage', async ({ page }) => {
  await page.evaluate(() => { Neutralino.os.showSaveDialog = async () => 'C:/Documents/Markdown Viewer Vault/Workspace/new.md'; });
  await page.locator('#sidebar-create-linked-file').click();
  await expect(page.locator('.app-toast').filter({ hasText: 'outside the managed Vault' })).toBeVisible();
  expect(await page.evaluate(() => __desktopFiles.has('C:/Documents/Markdown Viewer Vault/Workspace/new.md'))).toBe(false);
});
test('linked import cannot register a managed body as an external original', async ({ page }) => {
  await page.evaluate(async () => {
    try { await NL_IMPORT_EXTERNAL_FILE('# managed body', 'managed', 'C:/Documents/Markdown Viewer Vault/Workspace/managed.md'); }
    catch (error) { window.__managedError = error.message; }
  });
  expect(await page.evaluate(() => __managedError)).toContain('outside the managed Vault');
  const docs = await page.evaluate(async () => { const s = new MarkdownWorkspaceStorage(); await s.init(); return s.listDocumentMetadata(); });
  expect(docs.some(x => x.sourcePath?.includes('Markdown Viewer Vault'))).toBe(false);
});
