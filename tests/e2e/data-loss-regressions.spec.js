const { test, expect } = require('@playwright/test');
const JSZip = require('jszip');
const {
  openApp,
  readWorkspaceStore,
  setEditorContent,
  storedDocuments,
  waitForAppReady
} = require('../helpers/app');

async function waitForStoredContent(page, text) {
  await expect.poll(async () => JSON.stringify(await storedDocuments(page))).toContain(text);
}

async function createFolder(page, name) {
  await page.locator('#sidebar-new-folder').click();
  await page.locator('#document-name-modal-input').fill(name);
  await page.locator('#document-name-modal-confirm').click();
  await expect(page.locator('.document-tree-row[data-tree-type="folder"]', { hasText: name })).toBeVisible();
}

async function moveDocumentToFolder(page, documentId, folderName) {
  const row = page.locator(`.document-tree-row[data-document-id="${documentId}"]`);
  await row.click({ button: 'right' });
  await page.locator('.document-menu-context.open').getByRole('menuitem', { name: 'Move', exact: true }).click();
  await page.locator('#document-move-destination').selectOption({ label: `Workspace / ${folderName}` });
  await page.locator('#document-move-modal-confirm').click();
}

async function replacementBackupBuffer() {
  const zip = new JSZip();
  zip.file('Workspace/Replacement.md', '# Replacement document');
  zip.file('.markdown-viewer/documents.json', JSON.stringify([{
    metadata: {
      id: 'replacement_document',
      title: 'Replacement',
      workspaceId: 'workspace_default',
      folderId: null,
      isOpen: true,
      viewMode: 'split',
      createdAt: 1,
      lastOpenedAt: 1,
      lastEditedAt: 1
    },
    path: 'Workspace/Replacement.md'
  }]));
  zip.file('.markdown-viewer/organization.json', JSON.stringify({
    version: 1,
    workspaces: [],
    folders: [],
    ui: {}
  }));
  zip.file('.markdown-viewer/preferences.json', '{}');
  zip.file('markdown-viewer-backup.json', JSON.stringify({
    format: 'markdown-viewer-backup',
    version: 1,
    createdAt: new Date().toISOString(),
    includesSecureWorkspace: false,
    normalDocumentCount: 1,
    secureRecordCount: 0
  }));
  return zip.generateAsync({ type: 'nodebuffer' });
}

test('a stale tab move cannot delete documents created in another tab', async ({ context, page }) => {
  await openApp(page);
  const staleDocumentId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
  const secondPage = await context.newPage();
  await openApp(secondPage);

  await page.locator('#tab-new-btn').click();
  await setEditorContent(page, '# Created in first tab\n\nMust survive the stale move.');
  await waitForStoredContent(page, 'Must survive the stale move.');
  const createdId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');

  await createFolder(secondPage, 'Stale move target');
  await moveDocumentToFolder(secondPage, staleDocumentId, 'Stale move target');

  expect((await storedDocuments(secondPage)).some(item => item.id === createdId)).toBe(true);
  expect((await readWorkspaceStore(secondPage, 'trash')).some(item => item.documentId === createdId)).toBe(false);
});

test('a transient document-list failure enters non-destructive recovery mode', async ({ page }) => {
  await openApp(page);
  await setEditorContent(page, '# Survive transient load failure\n\nExisting persisted body.');
  await waitForStoredContent(page, 'Existing persisted body.');
  const persistedId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');

  await page.addInitScript(() => {
    let documentGetAllCalls = 0;
    const original = IDBObjectStore.prototype.getAll;
    IDBObjectStore.prototype.getAll = function(...args) {
      if (this.name === 'documents' && ++documentGetAllCalls === 2) {
        throw new DOMException('Injected transient IndexedDB read failure', 'UnknownError');
      }
      return original.apply(this, args);
    };
  });
  await page.reload();
  await waitForAppReady(page);

  await expect(page.locator('html')).toHaveAttribute('data-workspace-storage-state', 'error');
  expect((await storedDocuments(page)).some(item => item.id === persistedId)).toBe(true);
  expect((await readWorkspaceStore(page, 'trash')).some(item => item.documentId === persistedId)).toBe(false);
});

test('simultaneous edits preserve the stale writer as a conflict copy', async ({ context, page }) => {
  await openApp(page);
  await setEditorContent(page, '# Shared starting point');
  await waitForStoredContent(page, 'Shared starting point');

  const secondPage = await context.newPage();
  await openApp(secondPage);
  await setEditorContent(page, '# First tab newer content');
  await waitForStoredContent(page, 'First tab newer content');
  await setEditorContent(secondPage, '# Second tab stale content');

  await expect.poll(async () => JSON.stringify(await storedDocuments(secondPage))).toContain('Second tab stale content');
  const stored = JSON.stringify(await storedDocuments(secondPage));
  expect(stored).toContain('First tab newer content');
  expect(stored).toContain('Second tab stale content');
  await expect(secondPage.locator('#save-status')).toHaveAttribute('data-state', 'saved');
});

test('the emergency journal restores an edit when the page closes before IndexedDB finishes', async ({ context, page }) => {
  await openApp(page);
  await setEditorContent(page, '# Last durable revision');
  await waitForStoredContent(page, 'Last durable revision');
  await page.evaluate(() => {
    const prototype = window.MarkdownWorkspaceStorage.prototype;
    const original = prototype.saveDocuments;
    prototype.saveDocuments = async function(...args) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      return original.apply(this, args);
    };
  });
  await setEditorContent(page, '# Latest revision before abrupt close');
  await page.close({ runBeforeUnload: false });

  const reopened = await context.newPage();
  await openApp(reopened);
  await expect.poll(async () => JSON.stringify(await storedDocuments(reopened))).toContain('Latest revision before abrupt close');
});

test('a restore failure leaves the current workspace untouched', async ({ page }) => {
  await openApp(page);
  await setEditorContent(page, '# Original workspace must survive failed import');
  await waitForStoredContent(page, 'Original workspace must survive failed import');
  const backup = await replacementBackupBuffer();

  await page.getByRole('button', { name: 'Open workspace settings' }).click();
  await page.locator('#storage-settings-button').click();
  await page.locator('#storage-backup-file-input').setInputFiles({
    name: 'valid-replacement.zip',
    mimeType: 'application/zip',
    buffer: backup
  });
  await page.evaluate(() => {
    window.MarkdownWorkspaceStorage.prototype.restoreBackupData = async function() {
      throw new DOMException('Injected restore quota failure', 'QuotaExceededError');
    };
  });
  await page.locator('#storage-import-confirm-confirm').click();
  await expect(page.locator('#import-progress-title')).toHaveText('Import failed', { timeout: 20_000 });

  expect(JSON.stringify(await storedDocuments(page))).toContain('Original workspace must survive failed import');
  await expect(page.locator('#markdown-editor')).toHaveValue(/Original workspace must survive failed import/);
});

test('browser backup replacement rolls back atomically when a store write throws', async ({ page }) => {
  await openApp(page);
  await setEditorContent(page, '# Atomic restore source');
  await waitForStoredContent(page, 'Atomic restore source');

  const errorName = await page.evaluate(async () => {
    const storage = new window.MarkdownWorkspaceStorage();
    await storage.init();
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value, ...args) {
      if (this.name === 'contents' && value && value.id === 'replacement_document') {
        throw new DOMException('Injected restore write failure', 'QuotaExceededError');
      }
      return original.call(this, value, ...args);
    };
    try {
      await storage.restoreBackupData({
        organization: { version: 1, workspaces: [], folders: [], ui: {} },
        documents: [{
          metadata: {
            id: 'replacement_document',
            title: 'Replacement',
            workspaceId: 'workspace_default',
            folderId: null,
            isOpen: true
          },
          content: '# Replacement'
        }],
        secretRecords: []
      });
      return '';
    } catch (error) {
      return error.name;
    } finally {
      IDBObjectStore.prototype.put = original;
    }
  });

  expect(errorName).toBe('QuotaExceededError');
  expect(JSON.stringify(await storedDocuments(page))).toContain('Atomic restore source');
  expect(JSON.stringify(await storedDocuments(page))).not.toContain('# Replacement');
});

test('Secret Workspace records and manifest commit as one transaction', async ({ page }) => {
  await openApp(page);
  const result = await page.evaluate(async () => {
    const storage = new window.MarkdownWorkspaceStorage();
    await storage.init();
    await storage.replaceSecretRecords([{
      id: 'original_secret',
      envelope: { version: 2, iv: 'MDEyMzQ1Njc4OWFi', ciphertext: 'MDEyMzQ1Njc4OWFiY2RlZg==' }
    }], { version: 2, salt: 'b2xkLXNhbHQ=', documentCount: 1 });

    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value, ...args) {
      if (this.name === 'secretRecords' && value && value.id === 'replacement_secret') {
        throw new DOMException('Injected secure write failure', 'QuotaExceededError');
      }
      return originalPut.call(this, value, ...args);
    };
    let errorName = '';
    try {
      await storage.replaceSecretRecords([{
        id: 'replacement_secret',
        envelope: { version: 2, iv: 'MTIzNDU2Nzg5MGFi', ciphertext: 'MTIzNDU2Nzg5MGFiY2RlZg==' }
      }], { version: 2, salt: 'bmV3LXNhbHQ=', documentCount: 1 });
    } catch (error) {
      errorName = error.name;
    } finally {
      IDBObjectStore.prototype.put = originalPut;
    }
    return {
      errorName,
      records: await storage.listSecretRecords(),
      manifest: await storage.getSecretManifest()
    };
  });

  expect(result.errorName).toBe('QuotaExceededError');
  expect(result.records.map(record => record.id)).toEqual(['original_secret']);
  expect(result.manifest.salt).toBe('b2xkLXNhbHQ=');
});

test('startup repairs orphaned content records without changing their body', async ({ page }) => {
  await openApp(page);
  await page.locator('#tab-new-btn').click();
  await setEditorContent(page, '# Orphan recovery marker\n\nThe contents record should return to the Explorer.');
  await waitForStoredContent(page, 'Orphan recovery marker');
  const documentId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
  await page.getByRole('button', { name: 'Open workspace settings' }).click();
  await page.locator('#private-mode-toggle').click();
  await expect(page.locator('#private-mode-toggle')).toHaveAttribute('aria-pressed', 'true');

  await page.evaluate(async id => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('markdownViewerWorkspace');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('documents', 'readwrite');
    transaction.objectStore('documents').delete(id);
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  }, documentId);
  await page.reload();
  await waitForAppReady(page);
  await expect(page.locator('html')).toHaveAttribute('data-private-mode', 'false');

  const stored = await storedDocuments(page);
  expect(stored.find(item => item.id === documentId)?.content).toContain('Orphan recovery marker');
  await expect(page.locator(`.document-tree-row[data-document-id="${documentId}"]`)).toBeVisible();
});

test('missing content is marked as corruption and never normalized to an empty body', async ({ page }) => {
  await openApp(page);
  await setEditorContent(page, '# Missing body marker');
  await waitForStoredContent(page, 'Missing body marker');
  const documentId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
  await page.getByRole('button', { name: 'Open workspace settings' }).click();
  await page.locator('#private-mode-toggle').click();
  await expect(page.locator('#private-mode-toggle')).toHaveAttribute('aria-pressed', 'true');

  await page.evaluate(async id => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('markdownViewerWorkspace');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('contents', 'readwrite');
    transaction.objectStore('contents').delete(id);
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  }, documentId);
  await page.reload();
  await waitForAppReady(page);
  await expect(page.locator('html')).toHaveAttribute('data-private-mode', 'false');

  const metadata = (await readWorkspaceStore(page, 'documents')).find(item => item.id === documentId);
  expect(metadata.storageCorruption).toBe('missing-content');
  expect((await readWorkspaceStore(page, 'contents')).some(item => item.id === documentId)).toBe(false);
  const errorName = await page.evaluate(async id => {
    const storage = new window.MarkdownWorkspaceStorage();
    await storage.init();
    try {
      await storage.loadDocumentContent(id);
      return '';
    } catch (error) {
      return error.name;
    }
  }, documentId);
  expect(errorName).toBe('WorkspaceCorruptionError');
});

test('storage rejects non-string document IDs before metadata and content can diverge', async ({ page }) => {
  await openApp(page);
  const errorName = await page.evaluate(async () => {
    const storage = new window.MarkdownWorkspaceStorage();
    await storage.init();
    try {
      await storage.saveDocuments([{
        id: 42,
        title: 'Invalid numeric ID',
        content: '# Numeric ID body',
        contentLoaded: true,
        workspaceId: 'workspace_default',
        folderId: null,
        isOpen: true
      }], null, { forceContent: true });
      return '';
    } catch (error) {
      return error.name;
    }
  });
  expect(errorName).toBe('TypeError');
  expect((await readWorkspaceStore(page, 'contents')).some(item => item.id === 42)).toBe(false);
});
