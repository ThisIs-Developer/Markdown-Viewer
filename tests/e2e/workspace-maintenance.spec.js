const { test, expect } = require('@playwright/test');
const JSZip = require('jszip');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

async function requestImport(page) {
  const zip = new JSZip();
  zip.file('Workspace/New.md', '# replacement');
  zip.file('.markdown-viewer/documents.json', JSON.stringify([{ metadata: { id: 'replacement', title: 'Replacement', workspaceId: 'workspace_default' }, path: 'Workspace/New.md' }]));
  zip.file('.markdown-viewer/organization.json', '{}');
  zip.file('.markdown-viewer/preferences.json', '{}');
  zip.file('markdown-viewer-backup.json', JSON.stringify({ format: 'markdown-viewer-backup', version: 1, normalDocumentCount: 1, secureRecordCount: 0 }));
  await page.getByRole('button', { name: 'Open workspace settings' }).click();
  await page.locator('#storage-settings-button').click();
  await page.locator('#storage-backup-file-input').setInputFiles({ name: 'maintenance.zip', mimeType: 'application/zip', buffer: await zip.generateAsync({ type: 'nodebuffer' }) });
  await page.locator('#storage-import-confirm-confirm').click();
}

test.beforeEach(async ({ page }) => {
  await page.route('**/libs/jszip.min.js', route => route.fulfill({ contentType: 'application/javascript', body: require('fs').readFileSync(require.resolve('jszip/dist/jszip.min.js')) }));
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await openApp(page);
  await page.evaluate(async () => {
    __desktopFiles.set('C:/notes.md', '# original');
    await NL_IMPORT_EXTERNAL_FILE('# original', 'notes', 'C:/notes.md');
    await MarkdownViewerFlushWorkspace();
  });
});

test('import gates new linked/native actions, persists live drafts, and re-enables after safe failure', async ({ page }) => {
  await page.locator('#markdown-editor').fill('# newest draft');
  await page.evaluate(() => {
    MarkdownWorkspaceStorage.prototype.restoreBackupData = async function () {
      window.__maintenanceReached = true;
      await new Promise(resolve => { window.__releaseMaintenance = resolve; });
      throw new Error('Simulated restore failed safely');
    };
  });
  await requestImport(page);
  await expect.poll(() => page.evaluate(() => window.__maintenanceReached)).toBe(true);
  expect(await page.evaluate(async () => {
    try { await MarkdownViewerFlushWorkspace(); return 'unexpected success'; }
    catch (error) { return error.message; }
  })).toContain('maintenance is still in progress');
  expect(await page.evaluate(async () => {
    const linked = await NL_IMPORT_EXTERNAL_FILE('# late', 'late', 'C:/late.md');
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    const meta = (await storage.listDocumentMetadata()).find(x => x.sourcePath === 'C:/notes.md');
    return { linked: !!linked, inert: document.querySelector('.app-container').inert, draft: await storage.loadDocumentContent(meta.id), original: __desktopFiles.get('C:/notes.md') };
  })).toEqual({ linked: false, inert: true, draft: '# newest draft', original: '# original' });
  await page.evaluate(() => __releaseMaintenance());
  await expect(page.locator('#import-progress-detail')).toContainText('Simulated restore failed safely');
  await expect.poll(() => page.evaluate(() => document.querySelector('.app-container').inert)).toBe(false);
  await expect(page.locator('#markdown-editor')).toHaveValue('# newest draft');
});

test('import does not resume editing when restore rollback also failed', async ({ page }) => {
  await page.evaluate(() => {
    MarkdownWorkspaceStorage.prototype.restoreBackupData = async () => {
      const error = new Error('Failed restore'); error.rollbackError = new Error('Failed rollback'); throw error;
    };
  });
  await requestImport(page);
  await expect(page.locator('#import-progress-detail')).toContainText('Editing remains blocked');
  expect(await page.evaluate(() => document.querySelector('.app-container').inert)).toBe(true);
});
