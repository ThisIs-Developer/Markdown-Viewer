const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');
test.beforeEach(async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await openApp(page);
  await page.evaluate(async () => {
    await Neutralino.filesystem.createDirectory('C:/Review');
    __desktopFiles.set('C:/Review/a.md', '# a'); __desktopFiles.set('C:/Review/b.md', '# b');
    await NL_LINK_MARKDOWN_FOLDER_PATH('C:/Review'); await MarkdownViewerFlushWorkspace();
  });
});
async function state(page) {
  return page.evaluate(async () => {
    await MarkdownViewerFlushWorkspace(); const s = new MarkdownWorkspaceStorage(); await s.init();
    return { org: await s.getDocumentOrganization(), docs: await s.listDocumentMetadata(), originals: [__desktopFiles.get('C:/Review/a.md'), __desktopFiles.get('C:/Review/b.md')] };
  });
}
async function removeRoot(page) {
  await page.locator('#document-tree [data-tree-type="linked-location"]').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Remove linked folder', exact: true }).click();
  await page.getByRole('alertdialog', { name: 'Remove linked folder', exact: true }).getByRole('button', { name: 'Remove link', exact: true }).click();
}
test('child removal failure retains a visible root and draft, reports partial result and permits retry', async ({ page }) => {
  await page.evaluate(() => {
    const del = MarkdownWorkspaceStorage.prototype.deleteDocument; window.__restoreDelete = () => MarkdownWorkspaceStorage.prototype.deleteDocument = del;
    MarkdownWorkspaceStorage.prototype.deleteDocument = async function(id, ...args) {
      if (this.vaultIndex.documents.find(x => x.id === id)?.title === 'a') throw Error('Injected child deletion failure');
      return del.call(this, id, ...args);
    };
  });
  await removeRoot(page);
  await expect(page.getByText('Folder partly unlinked', { exact: true })).toBeVisible();
  const result = await state(page);
  expect(result.org.linkedLocations).toHaveLength(1);
  expect(result.docs.filter(x => x.sourcePath).map(x => x.title)).toEqual(['a']);
  expect(result.org.linkedLocations[0].excludedPaths).toContain('b.md');
  expect(result.originals).toEqual(['# a', '# b']);
  await expect(page.locator('#document-tree .document-tree-label').filter({ hasText: /^a$/ })).toBeVisible();
  await page.evaluate(() => __restoreDelete()); await removeRoot(page);
  await expect(page.getByText('Folder unlinked', { exact: true })).toBeVisible();
  expect((await state(page)).org.linkedLocations).toHaveLength(0);
});
test('failed conversion exclusion persistence keeps the linked document and does not announce conversion', async ({ page }) => {
  await page.evaluate(() => {
    const save = MarkdownWorkspaceStorage.prototype.saveDocumentOrganization;
    MarkdownWorkspaceStorage.prototype.saveDocumentOrganization = async function(org, ...args) {
      if (org.linkedLocations.some(x => x.excludedPaths?.includes('a.md'))) throw Error('Injected exclusion failure');
      return save.call(this, org, ...args);
    };
  });
  await page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: /^a$/ }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Convert to Workspace copy', exact: true }).click();
  await expect(page.getByText('Conversion failed', { exact: true })).toBeVisible();
  const result = await state(page);
  expect(result.docs.find(x => x.title === 'a').sourcePath).toBe('C:/Review/a.md');
  expect(result.org.linkedLocations[0].excludedPaths).not.toContain('a.md');
  await expect(page.getByText('Converted to Workspace copy', { exact: true })).toHaveCount(0);
});
test('failed root persistence retains a retryable folder rather than claiming success', async ({ page }) => {
  await page.evaluate(() => {
    const save = MarkdownWorkspaceStorage.prototype.saveDocumentOrganization;
    MarkdownWorkspaceStorage.prototype.saveDocumentOrganization = async function(org, ...args) {
      if (!org.linkedLocations.length) throw Error('Injected root persistence failure');
      return save.call(this, org, ...args);
    };
  });
  await removeRoot(page);
  await expect(page.getByText('Folder removal incomplete', { exact: true })).toBeVisible();
  expect((await state(page)).org.linkedLocations).toHaveLength(1);
  await expect(page.locator('#document-tree [data-tree-type="linked-location"]')).toBeVisible();
  await expect(page.getByText('Folder unlinked', { exact: true })).toHaveCount(0);
});
