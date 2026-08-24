const { test, expect } = require('@playwright/test');
const {
  openApp,
  readWorkspaceStore,
  storedDocuments,
  waitForAppReady
} = require('../helpers/app');

test('automatic Trash cleanup removes only valid items older than 30 days', async ({ page }) => {
  await openApp(page);
  const result = await page.evaluate(async () => {
    const storage = new window.MarkdownWorkspaceStorage();
    await storage.init();
    await storage.emptyTrash();
    const documents = [
      ['expired_trash_document', 'Expired Trash document'],
      ['recent_trash_document', 'Recent Trash document'],
      ['unknown_date_trash_document', 'Unknown-date Trash document']
    ].map(([id, title]) => ({
      id,
      title,
      content: '# ' + title,
      contentLoaded: true,
      workspaceId: 'workspace_default',
      folderId: null,
      isOpen: false,
      _storageRevision: 0
    }));
    await storage.saveDocuments(documents, null, {
      changedIds: documents.map(document => document.id),
      forceContent: true
    });
    for (const document of documents) {
      await storage.deleteDocument(document.id, { expectedRevision: document._storageRevision });
    }

    const now = Date.now();
    const transaction = storage.db.transaction('trash', 'readwrite');
    const completion = new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    const store = transaction.objectStore('trash');
    const records = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    records.forEach(record => {
      if (record.documentId === 'expired_trash_document') {
        record.deletedAt = now - 31 * 24 * 60 * 60 * 1000;
      } else if (record.documentId === 'recent_trash_document') {
        record.deletedAt = now - 5 * 24 * 60 * 60 * 1000;
      } else {
        record.deletedAt = 'missing-timestamp';
      }
      store.put(record);
    });
    store.put({
      trashId: 'corrupt_expired_trash_record',
      kind: 'normal-document',
      documentId: 'corrupt_expired_document',
      deletedAt: now - 90 * 24 * 60 * 60 * 1000,
      metadata: null,
      content: '# preserved because its metadata is corrupt'
    });
    store.put({
      trashId: 'unknown_kind_expired_trash_record',
      kind: 'future-trash-format',
      documentId: 'unknown_kind_expired_document',
      deletedAt: now - 90 * 24 * 60 * 60 * 1000
    });
    const validSecretManifest = {
      version: 2,
      salt: 'MDEyMzQ1Njc4OWFiY2RlZg==',
      iterations: 250000
    };
    store.put({
      trashId: 'valid_expired_secret_snapshot',
      kind: 'secret-workspace-snapshot',
      documentId: '__manifest_backup__',
      deletedAt: now - 90 * 24 * 60 * 60 * 1000,
      secretManifest: validSecretManifest,
      secretRecords: [{
        id: 'valid_expired_secret_record',
        envelope: {
          iv: 'AAAAAAAAAAAAAAAA',
          ciphertext: 'AAAAAAAAAAAAAAAAAAAAAA=='
        }
      }]
    });
    store.put({
      trashId: 'corrupt_expired_secret_snapshot',
      kind: 'secret-workspace-snapshot',
      documentId: '__manifest_backup__',
      deletedAt: now - 90 * 24 * 60 * 60 * 1000,
      secretManifest: validSecretManifest,
      secretRecords: [{
        id: 'corrupt_expired_secret_record',
        envelope: { iv: 'invalid', ciphertext: 'invalid' }
      }]
    });
    await completion;

    const restarted = new window.MarkdownWorkspaceStorage();
    await restarted.init();
    let invalidRestoreError = '';
    try {
      await restarted.restoreTrashItem('unknown_kind_expired_trash_record');
    } catch (error) {
      invalidRestoreError = error && error.message || String(error);
    }
    return {
      ready: restarted.getStatus().ready,
      lastError: restarted.getStatus().lastError && restarted.getStatus().lastError.message,
      retentionDays: window.MarkdownWorkspaceStorage.TRASH_RETENTION_DAYS,
      items: (await restarted.listTrash()).map(item => ({
        trashId: item.trashId,
        documentId: item.documentId,
        restorable: item.restorable
      })),
      invalidRestoreError
    };
  });

  expect(result.ready).toBe(true);
  expect(result.lastError).toBeNull();
  expect(result.retentionDays).toBe(30);
  expect(result.items.map(item => item.documentId)).not.toContain('expired_trash_document');
  expect(result.items.map(item => item.documentId)).toEqual(expect.arrayContaining([
    'recent_trash_document',
    'unknown_date_trash_document'
  ]));
  expect(result.items.map(item => item.trashId)).toEqual(expect.arrayContaining([
    'corrupt_expired_trash_record',
    'unknown_kind_expired_trash_record',
    'corrupt_expired_secret_snapshot'
  ]));
  expect(result.items.map(item => item.trashId)).not.toContain('valid_expired_secret_snapshot');
  expect(result.items.filter(item => item.trashId.includes('expired_trash_record')))
    .toEqual(expect.arrayContaining([
      expect.objectContaining({ trashId: 'corrupt_expired_trash_record', restorable: false }),
      expect.objectContaining({ trashId: 'unknown_kind_expired_trash_record', restorable: false })
    ]));
  expect(result.invalidRestoreError).toContain('kept in Trash and was not changed');
});

test('Trash maintenance failure never blocks workspace initialization', async ({ page }) => {
  await openApp(page);
  const result = await page.evaluate(async () => {
    const original = window.MarkdownWorkspaceStorage.prototype.purgeExpiredTrash;
    window.MarkdownWorkspaceStorage.prototype.purgeExpiredTrash = async function() {
      throw new Error('Injected Trash cleanup failure');
    };
    try {
      const storage = new window.MarkdownWorkspaceStorage();
      await storage.init();
      return {
        ready: storage.getStatus().ready,
        error: storage.getStatus().lastError && storage.getStatus().lastError.message,
        documentCount: (await storage.listDocumentMetadata()).length
      };
    } finally {
      window.MarkdownWorkspaceStorage.prototype.purgeExpiredTrash = original;
    }
  });

  expect(result.ready).toBe(true);
  expect(result.error).toBe('Injected Trash cleanup failure');
  expect(result.documentCount).toBeGreaterThan(0);
});

test('dedicated Trash restores, permanently deletes, and empties selected data', async ({ page }) => {
  await openApp(page);
  await page.evaluate(async () => {
    const storage = new window.MarkdownWorkspaceStorage();
    await storage.init();
    await storage.emptyTrash();
    const documents = [
      ['trash_ui_restore_first', 'Restore from Trash A'],
      ['trash_ui_restore_second', 'Restore from Trash B'],
      ['trash_ui_delete', 'Delete from Trash'],
      ['trash_ui_empty', 'Empty from Trash']
    ].map(([id, title]) => ({
      id,
      title,
      content: '# ' + title + ' body',
      contentLoaded: true,
      workspaceId: 'workspace_default',
      folderId: null,
      isOpen: false,
      _storageRevision: 0
    }));
    await storage.saveDocuments(documents, null, {
      changedIds: documents.map(document => document.id),
      forceContent: true
    });
    for (const document of documents) {
      await storage.deleteDocument(document.id, { expectedRevision: document._storageRevision });
    }
    const transaction = storage.db.transaction('trash', 'readwrite');
    transaction.objectStore('trash').put({
      trashId: 'trash_ui_incomplete',
      kind: 'future-trash-format',
      documentId: 'trash_ui_incomplete_document',
      deletedAt: Date.now()
    });
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  });

  await page.locator('#sidebar-trash-button').click();
  await expect(page.locator('#trash-modal')).toHaveClass(/is-visible/);
  await expect(page.locator('#trash-modal-title')).toHaveText('Trash');
  await expect(page.locator('.trash-item')).toHaveCount(5);
  expect(await page.locator('.trash-item input').evaluateAll(inputs => inputs.every(input => input.type === 'checkbox'))).toBe(true);
  await expect(page.locator('#trash-search')).toBeVisible();
  await expect(page.locator('#trash-selection-status')).toHaveText('0 selected');
  await expect(page.locator('#trash-empty-button')).toBeEnabled();

  const incompleteRow = page.locator('.trash-item', { hasText: 'No expiry' });
  await expect(incompleteRow).toHaveAttribute('title', /Recovery data is incomplete/);
  await incompleteRow.locator('input').click({ modifiers: ['Control'] });
  await expect(page.locator('#trash-selection-status')).toHaveText('1 selected');
  await expect(page.locator('#trash-restore-button')).toBeDisabled();
  await expect(page.locator('#trash-delete-button')).toBeEnabled();
  await incompleteRow.locator('input').click({ modifiers: ['Control'] });
  await expect(page.locator('#trash-selection-status')).toHaveText('0 selected');

  await page.locator('#trash-search').fill('Restore from Trash');
  await expect(page.locator('.trash-item:not([hidden])')).toHaveCount(2);
  await page.locator('#trash-select-all').click();
  await expect(page.locator('.trash-item input:checked')).toHaveCount(2);
  await expect(page.locator('#trash-selection-status')).toHaveText('2 selected');
  await expect(page.locator('#trash-select-all')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#trash-select-all').click();
  await expect(page.locator('.trash-item input:checked')).toHaveCount(0);
  await page.locator('#trash-select-all').click();
  await expect(page.locator('#trash-restore-button')).toBeEnabled();
  const reloadPromise = page.waitForEvent('load');
  await page.locator('#trash-restore-button').click();
  await expect(page.locator('#document-confirm-modal')).not.toBeVisible();
  await reloadPromise;
  await waitForAppReady(page);
  const restoredDocuments = JSON.stringify(await storedDocuments(page));
  expect(restoredDocuments).toContain('Restore from Trash A');
  expect(restoredDocuments).toContain('Restore from Trash B');

  await page.locator('#workspaceSettingsDropdown').click();
  await page.locator('#trash-settings-button').click();
  await expect(page.locator('.trash-item')).toHaveCount(3);
  await expect(page.locator('#trash-search')).toHaveValue('');
  const deleteRow = page.locator('.trash-item', { hasText: 'Delete from Trash' });
  const remainingIncompleteRow = page.locator('.trash-item', { hasText: 'No expiry' });
  await deleteRow.locator('input').click();
  await page.locator('#trash-delete-button').click();
  await expect(page.locator('#document-confirm-modal-title')).toHaveText('Permanently delete “Delete from Trash”?');
  await expect(page.locator('#document-confirm-modal-description')).toHaveText(
    '“Delete from Trash” will be permanently removed from Trash immediately. This action cannot be undone.'
  );
  await page.locator('#document-confirm-modal-cancel').click();
  await expect(page.locator('#trash-modal')).toHaveClass(/is-visible/);
  await expect(deleteRow.locator('input')).toBeChecked();
  await remainingIncompleteRow.locator('input').click({ modifiers: ['Control'] });
  await expect(page.locator('#trash-selection-status')).toHaveText('2 selected');
  await expect(page.locator('#trash-restore-button')).toBeDisabled();
  await page.locator('#trash-delete-button').click();
  await expect(page.locator('#document-confirm-modal-title')).toHaveText('Permanently delete 2 files?');
  await expect(page.locator('#document-confirm-modal-description')).toHaveText(
    '“Deleted document” and “Delete from Trash” will be permanently removed from Trash immediately. This action cannot be undone.'
  );
  await page.locator('#document-confirm-modal-cancel').click();
  await expect(page.locator('#trash-modal')).toHaveClass(/is-visible/);
  await expect(page.locator('.trash-item input:checked')).toHaveCount(2);
  await page.locator('#trash-delete-button').click();
  await page.locator('#document-confirm-modal-confirm').click();
  await expect(page.locator('.trash-item')).toHaveCount(1);
  const remainingTrash = JSON.stringify(await readWorkspaceStore(page, 'trash'));
  expect(remainingTrash).not.toContain('trash_ui_delete');
  expect(remainingTrash).not.toContain('trash_ui_incomplete');

  await page.locator('#trash-empty-button').click();
  await expect(page.locator('#document-confirm-modal-title')).toHaveText('Empty Trash?');
  await page.locator('#document-confirm-modal-confirm').click();
  await expect(page.locator('#trash-empty-state')).toBeVisible();
  await expect(page.locator('#trash-empty-title')).toHaveText('Trash is empty');
  await expect(page.locator('#trash-selection-status')).toHaveText('0 selected');
  expect(await readWorkspaceStore(page, 'trash')).toEqual([]);
});
