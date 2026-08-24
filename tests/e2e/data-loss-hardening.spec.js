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

async function normalBackupBuffer(preferences = {}) {
  const zip = new JSZip();
  zip.file('Workspace/Replacement.md', '# Replacement from backup');
  zip.file('.markdown-viewer/documents.json', JSON.stringify([{
    metadata: {
      id: 'replacement_document',
      title: 'Replacement',
      workspaceId: 'workspace_default',
      folderId: null,
      isOpen: true,
      viewMode: 'split'
    },
    path: 'Workspace/Replacement.md'
  }]));
  zip.file('.markdown-viewer/organization.json', JSON.stringify({ version: 3, workspaces: [], folders: [], ui: {} }));
  zip.file('.markdown-viewer/preferences.json', JSON.stringify(preferences));
  zip.file('markdown-viewer-backup.json', JSON.stringify({
    format: 'markdown-viewer-backup',
    version: 1,
    includesSecureWorkspace: false,
    normalDocumentCount: 1,
    secureRecordCount: 0
  }));
  return zip.generateAsync({ type: 'nodebuffer' });
}

test('legacy migration repairs a same-ID missing body before deleting the legacy source', async ({ page }) => {
  await openApp(page);
  await page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('markdownViewerWorkspace');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(['documents', 'contents'], 'readwrite');
    transaction.objectStore('documents').put({
      id: 'legacy_collision',
      title: 'Broken migrated metadata',
      workspaceId: 'workspace_default',
      folderId: null,
      isOpen: false,
      storageRevision: 4,
      storageWriterId: 'old-writer'
    });
    transaction.objectStore('contents').delete('legacy_collision');
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
    localStorage.setItem('markdownViewerTabs', JSON.stringify([{
      id: 'legacy_collision',
      title: 'Legacy intact document',
      content: '# Intact legacy collision body',
      workspaceId: 'workspace_default',
      folderId: null,
      isOpen: false
    }]));
  });

  await page.reload();
  await waitForAppReady(page);

  expect((await readWorkspaceStore(page, 'contents')).find(item => item.id === 'legacy_collision')?.content)
    .toBe('# Intact legacy collision body');
  expect(await page.evaluate(() => localStorage.getItem('markdownViewerTabs'))).toBeNull();
});

test('a transient organization read failure stops initialization without overwriting folders', async ({ page }) => {
  await openApp(page);
  await page.locator('#sidebar-new-folder').click();
  await page.locator('#document-name-modal-input').fill('Durable organization folder');
  await page.locator('#document-name-modal-confirm').click();
  await expect.poll(async () => JSON.stringify(await readWorkspaceStore(page, 'metadata')))
    .toContain('Durable organization folder');
  await page.evaluate(() => localStorage.removeItem('markdownViewerDocumentOrganization'));
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.get;
    let injected = false;
    IDBObjectStore.prototype.get = function(key, ...args) {
      if (!injected && this.name === 'metadata' && key === 'documentOrganization') {
        injected = true;
        throw new DOMException('Injected organization read failure', 'UnknownError');
      }
      return original.call(this, key, ...args);
    };
  });

  await page.reload();
  await waitForAppReady(page);

  await expect(page.locator('html')).toHaveAttribute('data-workspace-storage-state', 'error');
  expect(JSON.stringify(await readWorkspaceStore(page, 'metadata'))).toContain('Durable organization folder');
});

test('stale organization writers merge independent folder additions', async ({ page }) => {
  await openApp(page);
  const result = await page.evaluate(async () => {
    const first = new window.MarkdownWorkspaceStorage();
    const second = new window.MarkdownWorkspaceStorage();
    await first.init();
    await second.init();
    const firstState = await first.getDocumentOrganizationState();
    const secondState = await second.getDocumentOrganizationState();
    const firstOrganization = structuredClone(firstState.organization);
    const secondOrganization = structuredClone(secondState.organization);
    firstOrganization.folders.push({
      id: 'folder_from_first', workspaceId: 'workspace_default', parentFolderId: null,
      name: 'Folder from first tab', expanded: true, createdAt: Date.now()
    });
    secondOrganization.folders.push({
      id: 'folder_from_second', workspaceId: 'workspace_default', parentFolderId: null,
      name: 'Folder from second tab', expanded: true, createdAt: Date.now()
    });
    await first.saveDocumentOrganization(firstOrganization, {
      expectedRevision: firstState.revision,
      baseOrganization: firstState.organization
    });
    await second.saveDocumentOrganization(secondOrganization, {
      expectedRevision: secondState.revision,
      baseOrganization: secondState.organization
    });
    return (await second.getDocumentOrganizationState()).organization.folders.map(folder => folder.id);
  });
  expect(result).toEqual(expect.arrayContaining(['folder_from_first', 'folder_from_second']));
});

test('stale Secret Workspace writers cannot delete records added by another writer', async ({ page }) => {
  await openApp(page);
  const ids = await page.evaluate(async () => {
    const initial = new window.MarkdownWorkspaceStorage();
    await initial.init();
    await initial.replaceSecretRecords([{
      id: 'secret_original',
      envelope: { version: 2, iv: 'MDEyMzQ1Njc4OWFi', ciphertext: 'MDEyMzQ1Njc4OWFiY2RlZg==' }
    }], { version: 2, salt: 'MDEyMzQ1Njc4OWFiY2RlZg==', iterations: 250000 });
    const first = new window.MarkdownWorkspaceStorage();
    const second = new window.MarkdownWorkspaceStorage();
    await first.init();
    await second.init();
    await first.applySecretRecordChanges({
      upserts: [{
        id: 'secret_first', expectedRevision: 0,
        envelope: { version: 2, iv: 'MDEyMzQ1Njc4OWFi', ciphertext: 'MTIzNDU2Nzg5MGFiY2RlZg==' }
      }], deletions: []
    }, { version: 2, salt: 'MDEyMzQ1Njc4OWFiY2RlZg==', iterations: 250000 });
    await second.applySecretRecordChanges({
      upserts: [{
        id: 'secret_second', expectedRevision: 0,
        envelope: { version: 2, iv: 'MDEyMzQ1Njc4OWFi', ciphertext: 'YWJjZGVmMDEyMzQ1Njc4OQ==' }
      }], deletions: []
    }, { version: 2, salt: 'MDEyMzQ1Njc4OWFiY2RlZg==', iterations: 250000 });
    return (await second.listSecretRecords()).map(record => record.id);
  });
  expect(ids).toEqual(expect.arrayContaining(['secret_original', 'secret_first', 'secret_second']));
});

test('Secret Workspace manifest is recovered from its transactional backup copy', async ({ page }) => {
  await openApp(page);
  const manifest = await page.evaluate(async () => {
    const storage = new window.MarkdownWorkspaceStorage();
    await storage.init();
    await storage.replaceSecretRecords([{
      id: 'secret_manifest_recovery',
      envelope: { version: 2, iv: 'MDEyMzQ1Njc4OWFi', ciphertext: 'MDEyMzQ1Njc4OWFiY2RlZg==' }
    }], { version: 2, salt: 'MDEyMzQ1Njc4OWFiY2RlZg==', iterations: 250000 });
    const database = storage.db;
    const transaction = database.transaction('metadata', 'readwrite');
    transaction.objectStore('metadata').delete('secretManifest');
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    localStorage.removeItem('markdownViewerSecretWorkspace');
    const recovered = new window.MarkdownWorkspaceStorage();
    await recovered.init();
    return recovered.getSecretManifest();
  });
  expect(manifest.salt).toBe('MDEyMzQ1Njc4OWFiY2RlZg==');
});

test('invalid encrypted restore data is rejected before replacing valid records', async ({ page }) => {
  await openApp(page);
  const result = await page.evaluate(async () => {
    const storage = new window.MarkdownWorkspaceStorage();
    await storage.init();
    await storage.replaceSecretRecords([{
      id: 'valid_existing_secret',
      envelope: { version: 2, iv: 'MDEyMzQ1Njc4OWFi', ciphertext: 'MDEyMzQ1Njc4OWFiY2RlZg==' }
    }], { version: 2, salt: 'MDEyMzQ1Njc4OWFiY2RlZg==', iterations: 250000 });
    let errorName = '';
    try {
      await storage.restoreBackupData({
        organization: { version: 3, workspaces: [], folders: [], ui: {} },
        documents: [],
        secretManifest: { version: 2, salt: '%%%', iterations: 250000 },
        secretRecords: [{ id: 'corrupt_secret', envelope: { iv: '%%%', ciphertext: '%%%' } }]
      });
    } catch (error) {
      errorName = error.name;
    }
    return { errorName, ids: (await storage.listSecretRecords()).map(record => record.id) };
  });
  expect(result.errorName).toBe('TypeError');
  expect(result.ids).toContain('valid_existing_secret');
  expect(result.ids).not.toContain('corrupt_secret');
});

test('a corrupt stored Secret Workspace record is reported instead of disappearing', async ({ page }) => {
  await openApp(page);
  const result = await page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('markdownViewerWorkspace');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('secretRecords', 'readwrite');
    transaction.objectStore('secretRecords').put({
      id: 'corrupt_persisted_secret',
      envelope: { iv: 'not-base64', ciphertext: 'not-base64' },
      storageRevision: 1
    });
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();

    const storage = new window.MarkdownWorkspaceStorage();
    await storage.init();
    let errorName = '';
    try { await storage.listSecretRecords(); } catch (error) { errorName = error.name; }
    const verifyDatabase = await new Promise((resolve, reject) => {
      const request = indexedDB.open('markdownViewerWorkspace');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const verifyTransaction = verifyDatabase.transaction('secretRecords', 'readonly');
    const rawRecord = await new Promise((resolve, reject) => {
      const request = verifyTransaction.objectStore('secretRecords').get('corrupt_persisted_secret');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    verifyDatabase.close();
    return { errorName, rawRecordStillPresent: Boolean(rawRecord) };
  });
  expect(result.errorName).toBe('WorkspaceCorruptionError');
  expect(result.rawRecordStillPresent).toBe(true);
});

test('a preference failure occurs before backup replacement and leaves the workspace untouched', async ({ page }) => {
  await openApp(page);
  await setEditorContent(page, '# Original before preference failure');
  await waitForStoredContent(page, 'Original before preference failure');
  const backup = await normalBackupBuffer({ 'app-lang': 'fr' });

  await page.getByRole('button', { name: 'Open workspace settings' }).click();
  await page.locator('#storage-settings-button').click();
  await page.locator('#storage-backup-file-input').setInputFiles({
    name: 'preference-failure.zip', mimeType: 'application/zip', buffer: backup
  });
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (this === localStorage && key === 'app-lang') {
        throw new DOMException('Injected preference quota failure', 'QuotaExceededError');
      }
      return original.call(this, key, value);
    };
  });
  await page.locator('#storage-import-confirm-confirm').click();
  await expect(page.locator('#import-progress-title')).toHaveText('Import failed', { timeout: 20_000 });
  expect(JSON.stringify(await storedDocuments(page))).toContain('Original before preference failure');
  expect(JSON.stringify(await storedDocuments(page))).not.toContain('Replacement from backup');
});

test('deleted normal documents can be restored from the application trash without overwrite', async ({ page }) => {
  await openApp(page);
  const restored = await page.evaluate(async () => {
    const storage = new window.MarkdownWorkspaceStorage();
    await storage.init();
    const tab = {
      id: 'trash_restore_document', title: 'Trash restore', content: '# Exact trash recovery body',
      contentLoaded: true, workspaceId: 'workspace_default', folderId: null, isOpen: false,
      _storageRevision: 0
    };
    await storage.saveDocuments([tab], null, { changedIds: [tab.id], forceContent: true });
    await storage.deleteDocument(tab.id, { expectedRevision: tab._storageRevision });
    const item = (await storage.listTrash()).find(record => record.documentId === tab.id);
    const result = await storage.restoreTrashItem(item.trashId);
    return { result, content: await storage.loadDocumentContent(result.id) };
  });
  expect(restored.content).toBe('# Exact trash recovery body');
});

test('IndexedDB fallback journal recovers a normal edit when localStorage is full', async ({ context, page }) => {
  await openApp(page);
  await setEditorContent(page, '# Durable before journal quota');
  await waitForStoredContent(page, 'Durable before journal quota');
  await page.evaluate(() => {
    const storageSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (this === localStorage && String(key).startsWith('markdownViewerDirtyDocument:')) {
        throw new DOMException('Injected localStorage quota failure', 'QuotaExceededError');
      }
      return storageSetItem.call(this, key, value);
    };
    const originalSave = window.MarkdownWorkspaceStorage.prototype.saveDocuments;
    window.MarkdownWorkspaceStorage.prototype.saveDocuments = async function(...args) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      return originalSave.apply(this, args);
    };
  });
  await setEditorContent(page, '# Latest edit in IndexedDB fallback journal');
  await expect.poll(async () => (await readWorkspaceStore(page, 'journals')).length).toBeGreaterThan(0);
  await page.close({ runBeforeUnload: false });

  const reopened = await context.newPage();
  await openApp(reopened);
  await expect.poll(async () => JSON.stringify(await storedDocuments(reopened)))
    .toContain('Latest edit in IndexedDB fallback journal');
});

test('encrypted dirty journal restores the latest Secret Workspace edit after abrupt close', async ({ context, page }) => {
  await openApp(page);
  await page.locator('.document-tree-row[data-tree-id="workspace_secret"] .document-tree-main').click();
  await page.locator('#secret-workspace-key').fill('durable-secret-key');
  await page.locator('#secret-workspace-key-confirm').fill('durable-secret-key');
  await page.locator('#secret-workspace-modal-confirm').click();
  await expect(page.locator('#secret-workspace-modal')).toBeHidden();
  await page.locator('#tab-new-btn').click();
  await setEditorContent(page, '# Durable secret revision');
  await expect.poll(async () => (await readWorkspaceStore(page, 'secretRecords')).length).toBeGreaterThan(1);

  await page.evaluate(() => {
    const original = window.MarkdownWorkspaceStorage.prototype.applySecretRecordChanges;
    window.MarkdownWorkspaceStorage.prototype.applySecretRecordChanges = async function(...args) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      return original.apply(this, args);
    };
  });
  await setEditorContent(page, '# Latest encrypted journal revision');
  await expect.poll(async () => page.evaluate(() => {
    return Object.keys(localStorage).some(key => key.startsWith('markdownViewerSecretDirtyDocument:'));
  })).toBe(true);
  await page.close({ runBeforeUnload: false });

  const reopened = await context.newPage();
  await openApp(reopened);
  await reopened.locator('.document-tree-row[data-tree-id="workspace_secret"] .document-tree-main').click();
  await reopened.locator('#secret-workspace-key').fill('durable-secret-key');
  await reopened.locator('#secret-workspace-modal-confirm').click();
  await expect(reopened.locator('#secret-workspace-modal')).toBeHidden();
  await reopened.locator('.document-tree-row[data-document-id]', { hasText: 'Untitled' }).last().click();
  await expect(reopened.locator('#markdown-editor')).toHaveValue(/Latest encrypted journal revision/);
});

test('desktop journals recover a new file and a move before their index commits', async ({ page }) => {
  await openApp(page);
  const result = await page.evaluate(async () => {
    const files = new Map();
    const directories = new Set(['C:', 'C:/Documents']);
    const normalize = value => String(value).replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
    const join = (...parts) => normalize(parts.filter(Boolean).join('/'));
    const storageData = new Map();
    let failIndexWrite = false;
    let failIndexJournalWrite = false;
    window.NL_PORT = 1;
    window.Neutralino = {
      os: { getPath: async () => 'C:/Documents', open: async () => true },
      storage: {
        getData: async key => {
          if (!storageData.has(key)) throw new Error('missing');
          return storageData.get(key);
        },
        setData: async (key, value) => storageData.set(key, value),
        removeData: async key => storageData.delete(key)
      },
      filesystem: {
        getJoinedPath: (...parts) => join(...parts),
        getStats: async path => {
          path = normalize(path);
          if (directories.has(path)) return { isDirectory: true, size: 0, modifiedAt: Date.now() };
          if (files.has(path)) return { isDirectory: false, size: files.get(path).length, modifiedAt: Date.now() };
          throw new Error('missing');
        },
        createDirectory: async path => directories.add(normalize(path)),
        readFile: async path => {
          path = normalize(path);
          if (!files.has(path)) throw new Error('missing');
          return files.get(path);
        },
        writeFile: async (path, value) => {
          path = normalize(path);
          if (failIndexJournalWrite && path.includes('/.markdown-viewer/journal/') && path.endsWith('.index.json')) {
            failIndexJournalWrite = false;
            throw new Error('Injected index journal write failure');
          }
          if (failIndexWrite && path.endsWith('/.markdown-viewer/index.json')) {
            failIndexWrite = false;
            throw new Error('Injected index write failure');
          }
          files.set(path, String(value));
        },
        copy: async (source, destination) => files.set(normalize(destination), files.get(normalize(source))),
        move: async (source, destination) => {
          source = normalize(source);
          destination = normalize(destination);
          if (!files.has(source)) throw new Error('missing');
          files.set(destination, files.get(source));
          files.delete(source);
        },
        remove: async path => {
          path = normalize(path);
          files.delete(path);
          directories.delete(path);
        },
        readDirectory: async path => {
          path = normalize(path);
          const prefix = path + '/';
          const entries = new Map();
          directories.forEach(candidate => {
            if (!candidate.startsWith(prefix)) return;
            const rest = candidate.slice(prefix.length);
            if (rest && !rest.includes('/')) entries.set(rest, { entry: rest, type: 'DIRECTORY' });
          });
          files.forEach((_, candidate) => {
            if (!candidate.startsWith(prefix)) return;
            const rest = candidate.slice(prefix.length);
            if (rest && !rest.includes('/')) entries.set(rest, { entry: rest, type: 'FILE' });
          });
          return Array.from(entries.values());
        }
      }
    };

    const storage = new window.MarkdownWorkspaceStorage();
    await storage.init();
    const collidingTabs = [
      {
        id: 'collision_one_same1234', title: 'Same desktop title', content: '# First collision body',
        contentLoaded: true, workspaceId: 'workspace_default', folderId: null, isOpen: false, _storageRevision: 0
      },
      {
        id: 'collision_two_same1234', title: 'Same desktop title', content: '# Second collision body',
        contentLoaded: true, workspaceId: 'workspace_default', folderId: null, isOpen: false, _storageRevision: 0
      }
    ];
    await storage.saveDocuments(collidingTabs, { folders: [] }, {
      changedIds: collidingTabs.map(item => item.id), forceContent: true
    });
    const tab = {
      id: 'desktop_new_document', title: 'Desktop new document', content: '# Desktop body survives',
      contentLoaded: true, workspaceId: 'workspace_default', folderId: null, isOpen: false,
      _storageRevision: 0
    };
    // Simulate a crash after the Markdown body and its document journal are
    // durable, but before the index-commit journal can be created.
    failIndexJournalWrite = true;
    try {
      await storage.saveDocuments([tab], { folders: [] }, { changedIds: [tab.id], forceContent: true });
    } catch (_) {}

    const restarted = new window.MarkdownWorkspaceStorage();
    await restarted.init();
    const recovered = (await restarted.listDocumentMetadata()).find(item => item.id === tab.id);
    recovered.content = await restarted.loadDocumentContent(tab.id);
    recovered.contentLoaded = true;
    recovered.title = 'Desktop document renamed';
    // Leave only the durable index journal. Returning move journals before it
    // reproduces the unsafe filesystem ordering that previously orphaned data.
    failIndexWrite = true;
    try {
      await restarted.saveDocuments([recovered], { folders: [] }, { changedIds: [recovered.id], forceContent: true });
    } catch (_) {}
    Array.from(files.keys()).filter(path => path.endsWith('/.markdown-viewer/index.json.pending')).forEach(path => files.delete(path));

    const restartedAgain = new window.MarkdownWorkspaceStorage();
    await restartedAgain.init();
    const finalMetadata = await restartedAgain.listDocumentMetadata();
    const finalContent = await restartedAgain.loadDocumentContent(tab.id);
    const finalRecord = finalMetadata.find(item => item.id === tab.id);

    // Simulate a crash after Trash content moved back into Workspace but before
    // the restore index commit. Startup must put it back in recoverable Trash.
    await restartedAgain.deleteDocument(tab.id, { expectedRevision: finalRecord._storageRevision });
    const trashItem = (await restartedAgain.listTrash()).find(item => item.documentId === tab.id);
    const restoreMetadata = JSON.parse(JSON.stringify(trashItem.metadata));
    restoreMetadata.storageRevision = 1;
    restoreMetadata.storageWriterId = restartedAgain.writerId;
    restoreMetadata.workspaceId = 'workspace_default';
    restoreMetadata.folderId = null;
    const restoreRelativePath = await restartedAgain._desktopDocumentRelativePath(restoreMetadata, { folders: [] });
    restoreMetadata.vaultRelativePath = restoreRelativePath;
    const restoreDestination = await restartedAgain._desktopResolveVaultRelativePath(restoreRelativePath);
    const interruptedRestore = Object.assign({}, trashItem, {
      restoreInProgress: { destination: restoreDestination, metadata: restoreMetadata },
      updatedAt: Date.now()
    });
    delete interruptedRestore.metadataPath;
    await restartedAgain._writeJsonFileRecoverably(trashItem.metadataPath, interruptedRestore);
    await window.Neutralino.filesystem.move(trashItem.contentPath, restoreDestination);
    const afterRestoreCrash = new window.MarkdownWorkspaceStorage();
    await afterRestoreCrash.init();
    const recoveredTrash = (await afterRestoreCrash.listTrash()).find(item => item.trashId === trashItem.trashId);
    const interruptedRestoreReturnedToTrash = Boolean(
      recoveredTrash && files.has(normalize(recoveredTrash.contentPath)) &&
      !(await afterRestoreCrash.listDocumentMetadata()).some(item => item.id === tab.id)
    );
    const collisionBodies = [
      await afterRestoreCrash.loadDocumentContent('collision_one_same1234'),
      await afterRestoreCrash.loadDocumentContent('collision_two_same1234')
    ];

    // Simulate a crash after permanent deletion removed the Trash body but
    // before its metadata marker was removed. Startup must finish the purge.
    const interruptedPurge = Object.assign({}, recoveredTrash, {
      purgeInProgress: { requestedAt: Date.now() },
      updatedAt: Date.now()
    });
    delete interruptedPurge.metadataPath;
    await afterRestoreCrash._writeJsonFileRecoverably(recoveredTrash.metadataPath, interruptedPurge);
    await window.Neutralino.filesystem.remove(recoveredTrash.contentPath);
    const afterPurgeCrash = new window.MarkdownWorkspaceStorage();
    await afterPurgeCrash.init();
    const interruptedPurgeCompleted = !files.has(normalize(recoveredTrash.metadataPath)) &&
      !(await afterPurgeCrash.listTrash()).some(item => item.trashId === recoveredTrash.trashId);

    const explicitMetadata = (await afterPurgeCrash.listDocumentMetadata())
      .find(item => item.id === 'collision_one_same1234');
    await afterPurgeCrash.deleteDocument(explicitMetadata.id, {
      expectedRevision: explicitMetadata._storageRevision
    });
    const explicitTrash = (await afterPurgeCrash.listTrash())
      .find(item => item.documentId === explicitMetadata.id);
    await afterPurgeCrash.permanentlyDeleteTrashItem(explicitTrash.trashId);
    const explicitPurgeRemovedFiles = !files.has(normalize(explicitTrash.contentPath)) &&
      !files.has(normalize(explicitTrash.metadataPath)) &&
      !(await afterPurgeCrash.listTrash()).some(item => item.trashId === explicitTrash.trashId);
    return {
      ids: finalMetadata.map(item => item.id),
      title: finalRecord?.title,
      content: finalContent,
      interruptedRestoreReturnedToTrash,
      interruptedPurgeCompleted,
      explicitPurgeRemovedFiles,
      collisionBodies
    };
  });
  expect(result.ids).toContain('desktop_new_document');
  expect(result.title).toBe('Desktop document renamed');
  expect(result.content).toBe('# Desktop body survives');
  expect(result.interruptedRestoreReturnedToTrash).toBe(true);
  expect(result.interruptedPurgeCompleted).toBe(true);
  expect(result.explicitPurgeRemovedFiles).toBe(true);
  expect(result.collisionBodies).toEqual(['# First collision body', '# Second collision body']);
});

test('desktop delete rolls the file back when its index commit fails', async ({ page }) => {
  await openApp(page);
  const result = await page.evaluate(async () => {
    const files = new Map();
    const directories = new Set(['C:', 'C:/Documents']);
    const normalize = value => String(value).replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
    const join = (...parts) => normalize(parts.filter(Boolean).join('/'));
    const storageData = new Map();
    let failIndexWrite = false;
    window.NL_PORT = 1;
    window.Neutralino = {
      os: { getPath: async () => 'C:/Documents', open: async () => true },
      storage: {
        getData: async key => {
          if (!storageData.has(key)) throw new Error('missing');
          return storageData.get(key);
        },
        setData: async (key, value) => storageData.set(key, value),
        removeData: async key => storageData.delete(key)
      },
      filesystem: {
        getJoinedPath: (...parts) => join(...parts),
        getStats: async path => {
          path = normalize(path);
          if (directories.has(path)) return { isDirectory: true, size: 0, modifiedAt: Date.now() };
          if (files.has(path)) return { isDirectory: false, size: files.get(path).length, modifiedAt: Date.now() };
          throw new Error('missing');
        },
        createDirectory: async path => directories.add(normalize(path)),
        readFile: async path => {
          path = normalize(path);
          if (!files.has(path)) throw new Error('missing');
          return files.get(path);
        },
        writeFile: async (path, value) => {
          path = normalize(path);
          if (failIndexWrite && path.endsWith('/.markdown-viewer/index.json')) {
            failIndexWrite = false;
            throw new Error('Injected index write failure');
          }
          files.set(path, String(value));
        },
        copy: async (source, destination) => files.set(normalize(destination), files.get(normalize(source))),
        move: async (source, destination) => {
          source = normalize(source);
          destination = normalize(destination);
          if (!files.has(source)) throw new Error('missing');
          files.set(destination, files.get(source));
          files.delete(source);
        },
        remove: async path => {
          path = normalize(path);
          files.delete(path);
          directories.delete(path);
        },
        readDirectory: async path => {
          path = normalize(path);
          const prefix = path + '/';
          const entries = new Map();
          directories.forEach(candidate => {
            if (!candidate.startsWith(prefix)) return;
            const rest = candidate.slice(prefix.length);
            if (rest && !rest.includes('/')) entries.set(rest, { entry: rest, type: 'DIRECTORY' });
          });
          files.forEach((_, candidate) => {
            if (!candidate.startsWith(prefix)) return;
            const rest = candidate.slice(prefix.length);
            if (rest && !rest.includes('/')) entries.set(rest, { entry: rest, type: 'FILE' });
          });
          return Array.from(entries.values());
        }
      }
    };

    const storage = new window.MarkdownWorkspaceStorage();
    await storage.init();
    const tab = {
      id: 'desktop_delete_document', title: 'Desktop delete document', content: '# Desktop delete rollback body',
      contentLoaded: true, workspaceId: 'workspace_default', folderId: null, isOpen: false,
      _storageRevision: 0
    };
    await storage.saveDocuments([tab], { folders: [] }, { changedIds: [tab.id], forceContent: true });
    // Simulate process termination immediately after the file entered Trash,
    // before deleteDocument could commit the new index.
    await storage._desktopMoveToTrash(storage.vaultIndex.documents.find(item => item.id === tab.id));
    const afterInterruptedMove = new window.MarkdownWorkspaceStorage();
    await afterInterruptedMove.init();
    const recoveredMetadata = (await afterInterruptedMove.listDocumentMetadata()).find(item => item.id === tab.id);
    const recoveredContent = await afterInterruptedMove.loadDocumentContent(tab.id);

    failIndexWrite = true;
    let failed = false;
    try {
      await afterInterruptedMove.deleteDocument(tab.id, { expectedRevision: recoveredMetadata._storageRevision });
    } catch (_) { failed = true; }
    const restarted = new window.MarkdownWorkspaceStorage();
    await restarted.init();
    return {
      failed,
      recoveredContent,
      ids: (await restarted.listDocumentMetadata()).map(item => item.id),
      content: await restarted.loadDocumentContent(tab.id)
    };
  });
  expect(result.failed).toBe(true);
  expect(result.recoveredContent).toBe('# Desktop delete rollback body');
  expect(result.ids).toContain('desktop_delete_document');
  expect(result.content).toBe('# Desktop delete rollback body');
});
