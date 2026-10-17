const { test, expect } = require('@playwright/test');
const JSZip = require('jszip');
const { openApp, setEditorContent, waitForAppReady } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

async function openBackupSettings(page) {
  await page.getByRole('button', { name: 'Open workspace settings' }).click();
  await page.locator('#storage-settings-button').click();
}

test('desktop ZIP round trip includes Vault, linked draft, guide and encrypted records without reconnecting', async ({ page }) => {
  await page.route('**/libs/jszip.min.js', route => route.fulfill({ contentType: 'application/javascript', body: require('fs').readFileSync(require.resolve('jszip/dist/jszip.min.js')) }));
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);window.NL_OS="Windows";window.NL_TOKEN="test-token";');
  await page.addInitScript(() => {
    const saved = sessionStorage.getItem('root-test-files');
    if (saved) JSON.parse(saved).forEach(([path, body]) => window.__desktopFiles.set(path, body));
    addEventListener('beforeunload', () => sessionStorage.setItem('root-test-files', JSON.stringify([...window.__desktopFiles])));
    Neutralino.os.showSaveDialog = async () => 'C:/backup.zip';
    Neutralino.filesystem.writeBinaryFile = async (_path, bytes) => { window.__backupBytes = Array.from(new Uint8Array(bytes)); };
  });
  await openApp(page);
  await page.evaluate(async () => {
    window.__desktopFiles.set('C:/Original/notes.md', '# original unchanged');
    await window.NL_IMPORT_EXTERNAL_FILE('# original unchanged', 'notes', 'C:/Original/notes.md');
  });
  await setEditorContent(page, '# unsaved-to-original linked draft');
  await expect.poll(() => page.evaluate(async () => {
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    const meta = (await storage.listDocumentMetadata()).find(x => x.sourcePath === 'C:/Original/notes.md');
    return meta && await storage.loadDocumentContent(meta.id);
  })).toBe('# unsaved-to-original linked draft');
  await page.evaluate(async () => {
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    await storage.saveSecretRecord('encrypted_test', { version: 2, iv: 'MDEyMzQ1Njc4OWFi', ciphertext: 'MDEyMzQ1Njc4OWFiY2RlZg==' });
    await storage.setSecretManifest({ version: 2, salt: 'MDEyMzQ1Njc4OWFiY2RlZg==', iterations: 250000, documentCount: 1, folderCount: 0 });
  });
  await openBackupSettings(page);
  await page.locator('#storage-backup-button').click();
  await expect(page.locator('#storage-include-secure')).toBeChecked();
  await page.locator('#storage-backup-options-confirm').click();
  await expect(page.locator('#import-progress-title')).toHaveText(/Backup (complete|failed)/);
  expect({ title: await page.locator('#import-progress-title').textContent(), detail: await page.locator('#import-progress-detail').textContent() }).toEqual({ title: 'Backup complete', detail: 'The ZIP includes encrypted Secret Workspace files.' });
  const buffer = Buffer.from(await page.evaluate(() => window.__backupBytes));
  const zip = await JSZip.loadAsync(buffer);
  const index = JSON.parse(await zip.file('.markdown-viewer/documents.json').async('string'));
  const linked = index.find(x => x.metadata.sourcePath === 'C:/Original/notes.md');
  const guide = index.find(x => x.metadata.kind === 'linked-workspace-guide');
  expect(linked.path).toMatch(/^Linked Workspace\//);
  expect(guide.path).toMatch(/^Linked Workspace\//);
  expect(index.some(x => x.path.startsWith('Workspace/'))).toBe(true);
  expect(await zip.file(linked.path).async('string')).toBe('# unsaved-to-original linked draft');
  expect(await zip.file('README.txt').async('string')).toContain('does not reconnect');
  expect(Object.keys(zip.files).some(x => x.startsWith('Secret Workspace/objects/') && x.endsWith('.mvault'))).toBe(true);

  await openBackupSettings(page);
  await page.locator('#storage-backup-file-input').setInputFiles({ name: 'all-roots.zip', mimeType: 'application/zip', buffer });
  const reload = page.waitForEvent('load');
  await page.locator('#storage-import-confirm-confirm').click();
  await reload;
  await waitForAppReady(page);
  await expect(page.locator('#document-tree [data-document-id="' + linked.metadata.id + '"]')).toBeVisible({ timeout: 20000 });
  const restored = await page.evaluate(async id => {
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    const metadata = await storage.listDocumentMetadata();
    return { metadata, body: await storage.loadDocumentContent(id), org: await storage.getDocumentOrganization(), secrets: await storage.listSecretRecords(), original: window.__desktopFiles.get('C:/Original/notes.md') };
  }, linked.metadata.id);
  const draft = restored.metadata.find(x => x.id === linked.metadata.id);
  expect(draft.sourcePath).toBeUndefined();
  expect(draft._vaultRelativePath).toMatch(/^Linked Workspace\//);
  expect(restored.metadata.find(x => x.id === guide.metadata.id).kind).toBe('linked-workspace-guide');
  expect(restored.body).toBe('# unsaved-to-original linked draft');
  expect(restored.org.linkedLocations).toEqual([]);
  expect(restored.secrets.find(x => x.id === 'encrypted_test').envelope.ciphertext).toBe('MDEyMzQ1Njc4OWFiY2RlZg==');
  expect(restored.original).toBe('# original unchanged');
});

for (const invalid of ['tampered linked content', 'unsafe linked path']) {
  test(`ZIP rejects ${invalid} before replacing existing workspace`, async ({ page }) => {
    await openApp(page);
    await setEditorContent(page, '# retain current document');
    await openBackupSettings(page);
    await page.locator('#storage-backup-button').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#storage-backup-options-confirm').click();
    const download = await downloadPromise;
    const zip = await JSZip.loadAsync(require('fs').readFileSync(await download.path()));
    const index = JSON.parse(await zip.file('.markdown-viewer/documents.json').async('string'));
    const doc = index[0];
    const oldContent = await zip.file(doc.path).async('string');
    doc.path = invalid === 'unsafe linked path' ? 'Linked Workspace/../outside.md' : 'Linked Workspace/recovery.md';
    zip.file(doc.path, invalid === 'tampered linked content' ? 'unexpected changed content' : oldContent);
    const serialized = JSON.stringify(index);
    zip.file('.markdown-viewer/documents.json', serialized);
    const manifest = JSON.parse(await zip.file('markdown-viewer-backup.json').async('string'));
    manifest.documentIndexSha256 = require('crypto').createHash('sha256').update(serialized).digest('base64');
    zip.file('markdown-viewer-backup.json', JSON.stringify(manifest));
    await openBackupSettings(page);
    await page.locator('#storage-backup-file-input').setInputFiles({ name: 'invalid.zip', mimeType: 'application/zip', buffer: await zip.generateAsync({ type: 'nodebuffer' }) });
    await page.locator('#storage-import-confirm-confirm').click();
    await expect(page.locator('#import-progress-title')).toHaveText('Import failed');
    await expect(page.locator('#import-progress-detail')).toContainText(invalid === 'unsafe linked path' ? 'unsafe or invalid' : 'integrity check');
    await expect(page.locator('#markdown-editor')).toHaveValue('# retain current document');
  });
}
