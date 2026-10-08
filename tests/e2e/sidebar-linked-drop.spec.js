const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

// Exercise the existing HTML drop entry point without the custom pointer layer.
async function dropDocument(page, row, target) {
  const id = await row.getAttribute('data-document-id');
  const transfer = await page.evaluateHandle(id => {
    const data = new DataTransfer();
    data.setData('application/x-markdown-viewer-document', id);
    return data;
  }, id);
  await target.dispatchEvent('drop', { dataTransfer: transfer });
  await transfer.dispose();
}

for (const destination of ['root', 'folder']) {
  test(`HTML sidebar drop converts linked files into the Vault ${destination}`, async ({ page }) => {
    await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
    await openApp(page);
    await page.locator('#sidebar-new-folder').click();
    await page.locator('#document-name-modal-input').fill('Destination');
    await page.locator('#document-name-modal-confirm').click();
    await page.evaluate(async () => {
      window.__desktopFiles.set('C:/Original/notes.md', '# original');
      await window.NL_IMPORT_EXTERNAL_FILE('# original', 'notes', 'C:/Original/notes.md');
    });
    const row = page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: 'notes' });
    const secret = page.locator('#document-tree [data-tree-type="workspace"]').filter({ hasText: 'Secret Workspace' });
    await dropDocument(page, row, secret);
    await expect(row).toHaveClass(/is-linked-document/);
    const target = destination === 'folder'
      ? page.locator('#document-tree [data-tree-type="folder"]').filter({ hasText: 'Destination' })
      : page.locator('#document-tree [data-tree-type="workspace"]').filter({ hasText: 'Workspace (Vault)' });
    await dropDocument(page, row, target);
    await expect(row).not.toHaveClass(/is-linked-document/);
    await expect(row).toHaveAttribute('data-tree-depth', destination === 'folder' ? '2' : '1');
    const result = await page.evaluate(async () => {
      const storage = new window.MarkdownWorkspaceStorage();
      await storage.init();
      const record = (await storage.listDocumentMetadata()).find(item => item.title === 'notes');
      return { linked: Boolean(record.sourcePath), path: record.vaultRelativePath, original: window.__desktopFiles.get('C:/Original/notes.md') };
    });
    expect(result.linked).toBe(false);
    expect(result.original).toBe('# original');
    expect(result.path).toMatch(destination === 'folder' ? /^Workspace\/Destination\// : /^Workspace\/notes-/);
  });
}

test('HTML conversion failure preserves the linked document', async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await openApp(page);
  await page.evaluate(async () => {
    window.__desktopFiles.set('C:/Original/notes.md', '# original');
    await window.NL_IMPORT_EXTERNAL_FILE('# original', 'notes', 'C:/Original/notes.md');
    await window.MarkdownViewerFlushWorkspace();
    const save = window.MarkdownWorkspaceStorage.prototype.saveDocuments;
    window.MarkdownWorkspaceStorage.prototype.saveDocuments = function(documents, ...args) {
      if (documents.some(item => item.title === 'notes' && !item.sourcePath)) return Promise.reject(new Error('Simulated disk failure'));
      return save.call(this, documents, ...args);
    };
  });
  const row = page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: 'notes' });
  const target = page.locator('#document-tree [data-tree-type="workspace"]').filter({ hasText: 'Workspace (Vault)' });
  await dropDocument(page, row, target);
  await expect(page.locator('.app-toast').filter({ hasText: 'Conversion failed' })).toBeVisible();
  await expect(row).toHaveClass(/is-linked-document/);
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Original/notes.md'))).toBe('# original');
});
