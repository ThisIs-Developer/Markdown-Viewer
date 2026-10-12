const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

test.beforeEach(async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);window.NL_OS="Windows";window.NL_TOKEN="test-token";');
  await openApp(page);
  await page.evaluate(async () => {
    await Neutralino.filesystem.createDirectory('C:/Review');
    __desktopFiles.set('C:/Review/a.md', '# source');
    Neutralino.os.showFolderDialog = async () => 'C:/Review';
  });
});

test('failed initial organization write creates no linked root or source records and can be retried', async ({ page }) => {
  await page.evaluate(() => {
    const save = MarkdownWorkspaceStorage.prototype.saveDocumentOrganization;
    window.__restoreOrganization = () => { MarkdownWorkspaceStorage.prototype.saveDocumentOrganization = save; };
    MarkdownWorkspaceStorage.prototype.saveDocumentOrganization = async function(org, ...args) {
      if (org.linkedLocations?.length) throw Error('Injected organization write failure');
      return save.call(this, org, ...args);
    };
  });
  await page.locator('#sidebar-link-folder').click();
  await expect(page.getByText('Folder changes not saved', { exact: true })).toBeVisible();
  await expect(page.locator('[data-tree-type="linked-location"]')).toHaveCount(0);
  const docs = await page.evaluate(async () => {
    await MarkdownViewerFlushWorkspace();
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    return storage.listDocumentMetadata();
  });
  expect(docs.filter(x => x.sourcePath === 'C:/Review/a.md')).toHaveLength(0);
  await page.evaluate(() => __restoreOrganization());
  await page.locator('#sidebar-link-folder').click();
  await expect(page.locator('[data-tree-type="linked-location"]')).toHaveCount(1);
});

test('failed final scan organization write retains applied draft without success or advanced stored scan state', async ({ page }) => {
  await page.locator('#sidebar-link-folder').click();
  await expect(page.locator('[data-tree-type="linked-location"]')).toHaveCount(1);
  const before = await page.evaluate(async () => {
    await MarkdownViewerFlushWorkspace();
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    return storage.getDocumentOrganization();
  });
  await page.evaluate(() => {
    __desktopFiles.set('C:/Review/new.md', '# new source');
    const save = MarkdownWorkspaceStorage.prototype.saveDocumentOrganization;
    MarkdownWorkspaceStorage.prototype.saveDocumentOrganization = async function(org, ...args) {
      if (org.linkedLocations?.length) throw Error('Injected final organization write failure');
      return save.call(this, org, ...args);
    };
    document.querySelectorAll('.app-toast').forEach(el => el.remove());
  });
  await page.locator('[data-tree-type="linked-location"]').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Rescan folder', exact: true }).click();
  await expect(page.getByText('Folder changes not saved', { exact: true })).toBeVisible();
  const after = await page.evaluate(async () => {
    await MarkdownViewerFlushWorkspace();
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    return { org: await storage.getDocumentOrganization(), docs: await storage.listDocumentMetadata() };
  });
  expect(after.org.linkedLocations[0].lastScanAt).toBe(before.linkedLocations[0].lastScanAt);
  expect(after.docs.find(x => x.sourcePath === 'C:/Review/new.md')).toBeTruthy();
  await expect(page.getByText(/Linked folder scanned\./)).toHaveCount(0);
});
