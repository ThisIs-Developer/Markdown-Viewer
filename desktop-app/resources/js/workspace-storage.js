(function () {
  'use strict';

  const DATABASE_NAME = 'markdownViewerWorkspace';
  const DATABASE_VERSION = 3;
  const VAULT_FORMAT_VERSION = 1;
  const VAULT_NAME = 'Markdown Viewer Vault';
  const LEGACY_VAULT_LOCATOR_KEY = 'markdownViewerVaultLocator';
  const LEGACY_PORTABLE_LOCATOR_FILE = '.markdown-viewer-vault-locator.json';
  const LEGACY_TABS_KEY = 'markdownViewerTabs';
  const LEGACY_SECRET_KEY = 'markdownViewerSecretWorkspace';
  const INTERNAL_DIR = '.markdown-viewer';
  const SECRET_FOLDER_RECORD_ID = '__folders__';
  const SECRET_MANIFEST_BACKUP_RECORD_ID = '__manifest_backup__';
  const TRASH_RETENTION_DAYS = 30;
  const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

  function isDesktopRuntime() {
    try {
      return Boolean(
        typeof Neutralino !== 'undefined' &&
        typeof NL_PORT !== 'undefined' &&
        Neutralino.filesystem &&
        Neutralino.storage &&
        Neutralino.os
      );
    } catch (_) {
      return false;
    }
  }

  function randomId(prefix) {
    if (self.crypto && typeof self.crypto.randomUUID === 'function') {
      return prefix + '_' + self.crypto.randomUUID();
    }
    return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
  }

  function normalizePathSeparators(value) {
    return String(value || '').replace(/\\/g, '/').replace(/\/+/g, '/');
  }

  function sanitizePathSegment(value, fallback) {
    let segment = String(value || '')
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[. ]+$/g, '');
    if (!segment) segment = fallback || 'Untitled';
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(segment)) segment = '_' + segment;
    return segment.slice(0, 120);
  }

  function metadataFromTab(tab) {
    const metadata = {};
    Object.keys(tab || {}).forEach(function (key) {
      if (
        key === 'content' ||
        key === 'contentLoaded' ||
        key === '_vaultRelativePath' ||
        key === '_persistedContent' ||
        key.indexOf('_storage') === 0
      ) return;
      metadata[key] = tab[key];
    });
    metadata.id = String(metadata.id || '');
    metadata.contentLoaded = false;
    return metadata;
  }

  function cloneJson(value, fallback) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return fallback;
    }
  }

  function utf8ByteLength(value) {
    return new TextEncoder().encode(String(value == null ? '' : value)).byteLength;
  }

  async function stableDocumentIdSuffix(value) {
    const bytes = new TextEncoder().encode(String(value == null ? '' : value));
    if (!self.crypto || !self.crypto.subtle) {
      throw new Error('Cryptographic document path generation is unavailable.');
    }
    const digest = new Uint8Array(await self.crypto.subtle.digest('SHA-256', bytes));
    return Array.from(digest.slice(0, 16)).map(function(byte) {
      return byte.toString(16).padStart(2, '0');
    }).join('');
  }

  function requestToPromise(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error('IndexedDB request failed')); };
    });
  }

  function transactionToPromise(transaction) {
    return new Promise(function (resolve, reject) {
      transaction.oncomplete = function () { resolve(); };
      transaction.onabort = function () { reject(transaction.error || new Error('IndexedDB transaction aborted')); };
      transaction.onerror = function () { reject(transaction.error || new Error('IndexedDB transaction failed')); };
    });
  }

  function base64ByteLength(value) {
    if (typeof value !== 'string' || !value || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
      return -1;
    }
    try {
      return atob(value).length;
    } catch (_) {
      return -1;
    }
  }

  function validateEncryptedEnvelope(envelope) {
    return Boolean(
      envelope && typeof envelope === 'object' &&
      base64ByteLength(envelope.iv) === 12 &&
      base64ByteLength(envelope.ciphertext) >= 16
    );
  }

  function isSecretManifestStructurallyValid(manifest) {
    return Boolean(
      manifest && typeof manifest === 'object' &&
      base64ByteLength(manifest.salt) >= 16 &&
      Number.isSafeInteger(Number(manifest.iterations)) &&
      Number(manifest.iterations) >= 100000
    );
  }

  function isSecretRecordStructurallyValid(record) {
    if (!record || typeof record !== 'object') return false;
    try {
      requireSecretRecordId(record.id);
    } catch (_) {
      return false;
    }
    return validateEncryptedEnvelope(record.envelope);
  }

  function isTrashRecordRestorable(record, desktop) {
    if (!record || typeof record.trashId !== 'string' || !record.trashId) return false;
    const kind = record.kind || 'normal-document';
    if (kind === 'normal-document') {
      return Boolean(
        record.metadata && typeof record.metadata.id === 'string' && record.metadata.id &&
        (desktop ? typeof record.contentPath === 'string' && record.contentPath : typeof record.content === 'string')
      );
    }
    if (kind === 'secret-workspace-snapshot') {
      if (!isSecretManifestStructurallyValid(record.secretManifest) || !Array.isArray(record.secretRecords)) return false;
      const ids = new Set();
      return record.secretRecords.every(function(secretRecord) {
        if (!isSecretRecordStructurallyValid(secretRecord) || ids.has(secretRecord.id)) return false;
        ids.add(secretRecord.id);
        return true;
      });
    }
    if (kind === 'secret-record') {
      return Boolean(
        isSecretManifestStructurallyValid(record.secretManifest) &&
        isSecretRecordStructurallyValid(record.secretRecord) &&
        record.documentId === record.secretRecord.id
      );
    }
    return false;
  }

  function isTrashRecordEligibleForAutomaticPurge(record, cutoff) {
    if (!record || typeof record.trashId !== 'string' || !record.trashId) return false;
    const deletedAt = Number(record.deletedAt);
    if (!Number.isSafeInteger(deletedAt) || deletedAt <= 0 || deletedAt > cutoff) return false;
    return isTrashRecordRestorable(record, typeof record.contentPath === 'string');
  }

  function requireDocumentId(id) {
    if (typeof id !== 'string' || !id.trim()) {
      throw new TypeError('Document IDs must be non-empty strings.');
    }
    return id;
  }

  function requireSecretRecordId(id) {
    if (typeof id !== 'string' || !id || id.length > 120 || sanitizePathSegment(id, '') !== id ||
        id === SECRET_MANIFEST_BACKUP_RECORD_ID) {
      throw new TypeError('Secret Workspace record IDs must be safe, non-empty strings of at most 120 characters.');
    }
    return id;
  }

  function normalizedStorageRevision(value) {
    const revision = Number(value);
    return Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
  }

  function jsonEqual(left, right) {
    return JSON.stringify(left == null ? null : left) === JSON.stringify(right == null ? null : right);
  }

  function mergeObjectChanges(base, local, remote) {
    const result = Object.assign({}, remote || {});
    const keys = new Set(Object.keys(base || {}).concat(Object.keys(local || {}), Object.keys(remote || {})));
    keys.forEach(function(key) {
      if (key === '_storageRevision' || key === '_storageWriterId') return;
      const baseValue = base && base[key];
      const localValue = local && local[key];
      const remoteValue = remote && remote[key];
      if (jsonEqual(localValue, baseValue)) return;
      if (jsonEqual(remoteValue, baseValue) || jsonEqual(localValue, remoteValue)) {
        if (localValue === undefined) delete result[key];
        else result[key] = cloneJson(localValue, localValue);
      }
    });
    return result;
  }

  function mergeOrganizationChanges(baseValue, localValue, remoteValue) {
    const base = baseValue && typeof baseValue === 'object' ? baseValue : {};
    const local = localValue && typeof localValue === 'object' ? localValue : {};
    const remote = remoteValue && typeof remoteValue === 'object' ? remoteValue : {};
    const merged = Object.assign({}, remote);
    merged.version = Math.max(Number(remote.version) || 1, Number(local.version) || 1);

    const mergeCollection = function(key) {
      const baseItems = Array.isArray(base[key]) ? base[key] : [];
      const localItems = Array.isArray(local[key]) ? local[key] : [];
      const remoteItems = Array.isArray(remote[key]) ? remote[key] : [];
      const baseById = new Map(baseItems.filter(Boolean).map(function(item) { return [item.id, item]; }));
      const localById = new Map(localItems.filter(Boolean).map(function(item) { return [item.id, item]; }));
      const remoteById = new Map(remoteItems.filter(Boolean).map(function(item) { return [item.id, item]; }));
      const output = remoteItems.filter(Boolean).map(function(item) { return cloneJson(item, item); });
      const outputById = new Map(output.map(function(item) { return [item.id, item]; }));

      localById.forEach(function(localItem, id) {
        const baseItem = baseById.get(id);
        const remoteItem = remoteById.get(id);
        if (!baseItem) {
          if (!remoteItem) {
            const copy = cloneJson(localItem, localItem);
            output.push(copy);
            outputById.set(id, copy);
          } else if (!jsonEqual(localItem, remoteItem)) {
            const copy = cloneJson(localItem, localItem);
            copy.id = randomId(key === 'folders' ? 'folder_conflict' : 'workspace_conflict');
            if (copy.name) copy.name = String(copy.name) + ' (conflict copy)';
            output.push(copy);
          }
          return;
        }
        if (jsonEqual(localItem, baseItem)) return;
        if (!remoteItem) {
          const copy = cloneJson(localItem, localItem);
          copy.id = randomId(key === 'folders' ? 'folder_recovered' : 'workspace_recovered');
          if (copy.name) copy.name = String(copy.name) + ' (recovered)';
          output.push(copy);
          return;
        }
        const combined = mergeObjectChanges(baseItem, localItem, remoteItem);
        Object.assign(outputById.get(id), combined);
      });

      baseById.forEach(function(baseItem, id) {
        if (localById.has(id)) return;
        const remoteItem = remoteById.get(id);
        if (remoteItem && jsonEqual(remoteItem, baseItem)) {
          const index = output.findIndex(function(item) { return item.id === id; });
          if (index >= 0) output.splice(index, 1);
        }
      });
      merged[key] = output;
    };

    mergeCollection('workspaces');
    mergeCollection('folders');
    merged.ui = mergeObjectChanges(base.ui || {}, local.ui || {}, remote.ui || {});
    return merged;
  }

  function tabFromStoredMetadata(item) {
    const tab = Object.assign({}, item || {});
    tab._storageRevision = normalizedStorageRevision(tab.storageRevision);
    tab._storageWriterId = typeof tab.storageWriterId === 'string' ? tab.storageWriterId : '';
    delete tab.storageRevision;
    delete tab.storageWriterId;
    tab.contentLoaded = false;
    tab.content = undefined;
    return tab;
  }

  class WorkspaceConflictError extends Error {
    constructor(documentId, attemptedTab, storedMetadata, storedContent) {
      super('This document changed in another tab before the current update could be saved.');
      this.name = 'WorkspaceConflictError';
      this.documentId = documentId;
      this.attemptedTab = attemptedTab;
      this.storedMetadata = tabFromStoredMetadata(storedMetadata);
      this.storedContent = typeof storedContent === 'string' ? storedContent : '';
      this.contentConflict = Boolean(
        attemptedTab &&
        attemptedTab.contentLoaded !== false &&
        typeof attemptedTab.content === 'string' &&
        attemptedTab.content !== this.storedContent
      );
    }
  }

  class WorkspaceCorruptionError extends Error {
    constructor(documentId, message) {
      super(message || 'The saved document body is missing from workspace storage.');
      this.name = 'WorkspaceCorruptionError';
      this.documentId = documentId;
    }
  }

  class WorkspaceSecretConflictError extends Error {
    constructor(recordId, attemptedRecord, storedRecord) {
      super('This Secret Workspace record changed in another tab before the current update could be saved.');
      this.name = 'WorkspaceSecretConflictError';
      this.recordId = recordId;
      this.attemptedRecord = cloneJson(attemptedRecord, null);
      this.storedRecord = cloneJson(storedRecord, null);
    }
  }

  class MarkdownWorkspaceStorage {
    constructor() {
      this.desktop = isDesktopRuntime();
      this.db = null;
      this.ready = false;
      this.vaultPath = '';
      this.vaultId = '';
      this.vaultIndex = { version: VAULT_FORMAT_VERSION, documents: [], updatedAt: 0 };
      this.vaultOrganization = null;
      this.desktopSettings = {};
      this._organizationSnapshot = '';
      this._organizationRevision = 0;
      this.lastError = null;
      this._desktopIndexWrite = Promise.resolve();
      this._normalContentCache = new Map();
      this._maxContentCacheEntries = 20;
      this.writerId = randomId('writer');
    }

    async init() {
      if (this.ready) return this;
      if (this.desktop) await this._initDesktop();
      else await this._initBrowser();
      await this._migrateLegacyNormalDocuments();
      this.ready = true;
      try {
        await this.purgeExpiredTrash();
      } catch (error) {
        this.lastError = error;
        console.warn('Expired Trash items could not be removed:', error);
      }
      return this;
    }

    async _initBrowser() {
      if (!('indexedDB' in self)) throw new Error('IndexedDB is unavailable in this browser.');
      this.db = await new Promise(function (resolve, reject) {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = function () {
          const db = request.result;
          if (!db.objectStoreNames.contains('documents')) {
            const documents = db.createObjectStore('documents', { keyPath: 'id' });
            documents.createIndex('workspaceId', 'workspaceId', { unique: false });
            documents.createIndex('folderId', 'folderId', { unique: false });
            documents.createIndex('lastOpenedAt', 'lastOpenedAt', { unique: false });
          }
          if (!db.objectStoreNames.contains('contents')) {
            db.createObjectStore('contents', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('metadata')) {
            db.createObjectStore('metadata', { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains('secretRecords')) {
            db.createObjectStore('secretRecords', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('trash')) {
            const trash = db.createObjectStore('trash', { keyPath: 'trashId' });
            trash.createIndex('documentId', 'documentId', { unique: false });
            trash.createIndex('deletedAt', 'deletedAt', { unique: false });
          }
          if (!db.objectStoreNames.contains('journals')) {
            db.createObjectStore('journals', { keyPath: 'journalId' });
          }
        };
        request.onsuccess = function () { resolve(request.result); };
        request.onerror = function () { reject(request.error || new Error('Unable to open workspace storage')); };
        request.onblocked = function () { reject(new Error('Workspace storage upgrade is blocked by another tab.')); };
      });
      this.db.onversionchange = function() {
        try { this.close(); } catch (_) {}
      };
      this.vaultId = await this.getMetadata('vaultId');
      if (!this.vaultId) {
        this.vaultId = randomId('vault');
        await this.setMetadata('vaultId', this.vaultId);
      }
      // Persistence is an optional durability improvement. Some browsers keep
      // this request pending indefinitely, so it must never gate workspace
      // initialization or make otherwise healthy data inaccessible.
      this.requestPersistentStorage();
    }

    async _pathJoin() {
      const parts = Array.from(arguments).filter(Boolean);
      if (this.desktop && Neutralino.filesystem.getJoinedPath) {
        return Neutralino.filesystem.getJoinedPath.apply(Neutralino.filesystem, parts);
      }
      return normalizePathSeparators(parts.join('/'));
    }

    async _pathExists(path) {
      try {
        const stats = await Neutralino.filesystem.getStats(path);
        return stats || null;
      } catch (_) {
        return null;
      }
    }

    async _ensureDirectory(path) {
      const stats = await this._pathExists(path);
      if (stats && stats.isDirectory) return;
      if (stats) throw new Error('Expected a folder but found a file: ' + path);
      await Neutralino.filesystem.createDirectory(path);
    }

    async _readJsonFile(path, fallback) {
      try {
        const raw = await Neutralino.filesystem.readFile(path);
        return JSON.parse(raw);
      } catch (_) {
        return fallback;
      }
    }

    async _writeJsonFile(path, value) {
      const serialized = JSON.stringify(value, null, 2);
      await Neutralino.filesystem.writeFile(path, serialized);
      const verified = await Neutralino.filesystem.readFile(path);
      if (verified !== serialized) {
        throw new Error('A desktop storage write could not be verified: ' + path);
      }
    }

    async _writeJsonFileRecoverably(path, value) {
      const temporaryPath = path + '.pending';
      const backupPath = path + '.backup';
      const serialized = JSON.stringify(value, null, 2);
      await Neutralino.filesystem.writeFile(temporaryPath, serialized);
      if (await this._pathExists(path)) {
        await Neutralino.filesystem.copy(path, backupPath, { overwrite: true });
      }
      await Neutralino.filesystem.writeFile(path, serialized);
      const verified = await Neutralino.filesystem.readFile(path);
      if (verified !== serialized) {
        throw new Error('A desktop storage write could not be verified: ' + path);
      }
      try { await Neutralino.filesystem.remove(temporaryPath); } catch (_) {}
      try { await Neutralino.filesystem.remove(backupPath); } catch (_) {}
    }

    async _readJsonFileRecoverably(path, fallback) {
      const primary = await this._readJsonFile(path, null);
      const backupPath = path + '.backup';
      const backup = await this._readJsonFile(backupPath, null);
      const pendingPath = path + '.pending';
      const pending = await this._readJsonFile(pendingPath, null);
      const candidates = [
        { value: primary, priority: 3 },
        { value: pending, priority: 2 },
        { value: backup, priority: 1 }
      ].filter(function(item) { return item.value && typeof item.value === 'object'; });
      if (!candidates.length) return fallback;
      candidates.sort(function(left, right) {
        const leftTime = Number(left.value.updatedAt || left.value.committedAt) || 0;
        const rightTime = Number(right.value.updatedAt || right.value.committedAt) || 0;
        return rightTime - leftTime || right.priority - left.priority;
      });
      const selected = candidates[0];
      if (selected.value !== primary) await this._writeJsonFile(path, selected.value);
      try { if (pending) await Neutralino.filesystem.remove(pendingPath); } catch (_) {}
      try { if (backup) await Neutralino.filesystem.remove(backupPath); } catch (_) {}
      return selected.value;
    }

    async _removeLegacyVaultLocator(documentsPath) {
      try {
        await Neutralino.storage.removeData(LEGACY_VAULT_LOCATOR_KEY);
      } catch (_) {}
      try {
        const legacyLocatorPath = await this._pathJoin(documentsPath, LEGACY_PORTABLE_LOCATOR_FILE);
        const stats = await this._pathExists(legacyLocatorPath);
        if (stats && !stats.isDirectory) {
          await Neutralino.filesystem.remove(legacyLocatorPath);
        }
      } catch (_) {}
    }

    async _initDesktop() {
      const documentsPath = await Neutralino.os.getPath('documents');
      // Cleanup from the preview locator design is non-blocking and never gates startup.
      this._removeLegacyVaultLocator(documentsPath);
      const vaultPath = await this._pathJoin(documentsPath, VAULT_NAME);
      this.vaultPath = vaultPath;

      const workspacePath = await this._pathJoin(vaultPath, 'Workspace');
      const secretPath = await this._pathJoin(vaultPath, 'Secret Workspace', 'objects');
      const internalPath = await this._pathJoin(vaultPath, INTERNAL_DIR);
      const historyPath = await this._pathJoin(internalPath, 'history');
      const trashPath = await this._pathJoin(internalPath, 'trash');
      const journalPath = await this._pathJoin(internalPath, 'journal');
      await this._ensureDirectory(vaultPath);
      await this._ensureDirectory(workspacePath);
      await this._ensureDirectory(await this._pathJoin(vaultPath, 'Secret Workspace'));
      await this._ensureDirectory(secretPath);
      await this._ensureDirectory(internalPath);
      await this._ensureDirectory(historyPath);
      await this._ensureDirectory(trashPath);
      await this._ensureDirectory(journalPath);
      await this._recoverDesktopJournal();

      const manifestPath = await this._pathJoin(internalPath, 'vault.json');
      let manifest = await this._readJsonFile(manifestPath, null);
      if (!manifest) {
        manifest = {
          format: 'markdown-viewer-vault',
          version: VAULT_FORMAT_VERSION,
          id: randomId('vault'),
          name: VAULT_NAME,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        await this._writeJsonFile(manifestPath, manifest);
      }
      if (manifest.format !== 'markdown-viewer-vault') {
        throw new Error('The selected folder is not a Markdown Viewer Vault.');
      }
      if (Number(manifest.version) > VAULT_FORMAT_VERSION) {
        throw new Error('This vault was created by a newer version of Markdown Viewer.');
      }
      this.vaultId = manifest.id || randomId('vault');

      const settingsPath = await this._pathJoin(internalPath, 'settings.json');
      this.desktopSettings = await this._readJsonFile(settingsPath, {});
      const organizationPath = await this._pathJoin(internalPath, 'organization.json');
      this.vaultOrganization = await this._readJsonFileRecoverably(organizationPath, null);
      const organizationSnapshot = cloneJson(this.vaultOrganization, null);
      if (organizationSnapshot) {
        delete organizationSnapshot._storageRevision;
        delete organizationSnapshot._storageWriterId;
        delete organizationSnapshot.updatedAt;
      }
      this._organizationRevision = normalizedStorageRevision(this.vaultOrganization && this.vaultOrganization._storageRevision);
      this._organizationSnapshot = organizationSnapshot ? JSON.stringify(organizationSnapshot) : '';
      const indexPath = await this._pathJoin(internalPath, 'index.json');
      const loadedIndex = await this._readJsonFileRecoverably(indexPath, null);
      if (loadedIndex && Array.isArray(loadedIndex.documents)) {
        this.vaultIndex = loadedIndex;
      } else {
        this.vaultIndex = await this._rebuildDesktopIndex(workspacePath);
        await this._writeJsonFileRecoverably(indexPath, this.vaultIndex);
        if (this.vaultOrganization) {
          await this._writeJsonFile(organizationPath, this.vaultOrganization);
          this._organizationSnapshot = JSON.stringify(this.vaultOrganization);
        }
      }
    }

    async _rebuildDesktopIndex(workspacePath) {
      const organization = this.vaultOrganization && typeof this.vaultOrganization === 'object'
        ? cloneJson(this.vaultOrganization, null)
        : { version: 1, workspaces: [], folders: [], ui: {} };
      if (!Array.isArray(organization.folders)) organization.folders = [];
      const documents = [];
      const seenIds = new Set();

      const findOrCreateFolder = function(name, parentFolderId) {
        let folder = organization.folders.find(function(item) {
          return item &&
            item.workspaceId !== 'workspace_secret' &&
            (item.parentFolderId || null) === (parentFolderId || null) &&
            String(item.name || '').toLowerCase() === String(name || '').toLowerCase();
        });
        if (!folder) {
          folder = {
            id: randomId('folder'),
            workspaceId: 'workspace_default',
            parentFolderId: parentFolderId || null,
            name: sanitizePathSegment(name, 'Folder'),
            expanded: true,
            createdAt: Date.now()
          };
          organization.folders.push(folder);
        }
        return folder;
      };

      const walk = async (currentPath, relativeSegments, parentFolderId) => {
        let entries = [];
        try {
          entries = await Neutralino.filesystem.readDirectory(currentPath);
        } catch (_) {
          return;
        }
        entries.sort(function(a, b) {
          return String(a && a.entry || '').localeCompare(String(b && b.entry || ''));
        });
        for (const entry of entries) {
          if (!entry || !entry.entry) continue;
          const entryPath = await this._pathJoin(currentPath, entry.entry);
          if (entry.type === 'DIRECTORY') {
            const folder = findOrCreateFolder(entry.entry, parentFolderId);
            await walk(entryPath, relativeSegments.concat(entry.entry), folder.id);
            continue;
          }
          if (entry.type !== 'FILE' || !/\.md$/i.test(entry.entry)) continue;
          const nameMatch = /^(.*?)(?:--([a-z0-9]{1,32}))?\.md$/i.exec(entry.entry);
          const recoveredSuffix = nameMatch && nameMatch[2] ? nameMatch[2] : '';
          let id = recoveredSuffix ? 'recovered_' + recoveredSuffix : randomId('recovered');
          while (seenIds.has(id)) id = randomId('recovered');
          seenIds.add(id);
          let stats = null;
          try { stats = await Neutralino.filesystem.getStats(entryPath); } catch (_) {}
          const timestamp = Number(stats && (stats.modifiedAt || stats.createdAt)) || Date.now();
          documents.push({
            id: id,
            title: sanitizePathSegment(nameMatch && nameMatch[1], 'Recovered document'),
            workspaceId: 'workspace_default',
            folderId: parentFolderId || null,
            favorite: false,
            isOpen: false,
            viewMode: 'split',
            reviewThreads: [],
            createdAt: timestamp,
            lastOpenedAt: timestamp,
            lastEditedAt: timestamp,
            contentSize: Number(stats && stats.size) || 0,
            vaultRelativePath: normalizePathSeparators(['Workspace'].concat(relativeSegments, entry.entry).join('/')),
            contentLoaded: false
          });
        }
      };

      await walk(workspacePath, [], null);
      if (documents.length) documents[0].isOpen = true;
      this.vaultOrganization = organization;
      return {
        version: VAULT_FORMAT_VERSION,
        documents: documents,
        rebuiltAt: Date.now(),
        updatedAt: Date.now()
      };
    }

    async _recoverDesktopJournal() {
      const journalPath = await this._pathJoin(this.vaultPath, INTERNAL_DIR, 'journal');
      let entries = [];
      try {
        entries = await Neutralino.filesystem.readDirectory(journalPath);
      } catch (_) {}
      const normalizedVault = normalizePathSeparators(this.vaultPath).toLowerCase().replace(/\/+$/, '') + '/';
      const pendingRecords = [];
      for (const entry of entries) {
        if (!entry || entry.type !== 'FILE' || !/\.json$/i.test(entry.entry || '')) continue;
        const recordPath = await this._pathJoin(journalPath, entry.entry);
        const record = await this._readJsonFile(recordPath, null);
        pendingRecords.push({ recordPath: recordPath, record: record });
      }
      // A committed index is authoritative for move recovery. Process it before
      // move journals even when the filesystem returns directory entries in the
      // opposite order.
      pendingRecords.sort(function(left, right) {
        const priority = function(item) {
          if (item.record && item.record.operation === 'index-commit') return 0;
          if (item.record && item.record.operation === 'move') return 1;
          return 2;
        };
        return priority(left) - priority(right);
      });
      for (const pendingRecord of pendingRecords) {
        const recordPath = pendingRecord.recordPath;
        const record = pendingRecord.record;
        if (record && record.operation === 'index-commit' && record.index && Array.isArray(record.index.documents)) {
          const indexPath = await this._pathJoin(this.vaultPath, INTERNAL_DIR, 'index.json');
          const currentIndex = await this._readJsonFileRecoverably(indexPath, null);
          if (!currentIndex || Number(record.index.updatedAt) >= Number(currentIndex.updatedAt || 0)) {
            await this._writeJsonFileRecoverably(indexPath, record.index);
          }
          try { await Neutralino.filesystem.remove(recordPath); } catch (_) {}
          continue;
        }
        if (record && record.operation === 'move') {
          const source = normalizePathSeparators(record.source);
          const destination = normalizePathSeparators(record.destination);
          const indexPath = await this._pathJoin(this.vaultPath, INTERNAL_DIR, 'index.json');
          const index = await this._readJsonFileRecoverably(indexPath, null);
          const indexedDocument = index && Array.isArray(index.documents)
            ? index.documents.find(function(item) { return item.id === record.documentId; })
            : null;
          const committed = Boolean(
            indexedDocument &&
            normalizePathSeparators(indexedDocument.vaultRelativePath) === normalizePathSeparators(record.destinationRelativePath)
          );
          if (!committed &&
              source.toLowerCase().startsWith(normalizedVault) &&
              destination.toLowerCase().startsWith(normalizedVault) &&
              !source.split('/').includes('..') &&
              !destination.split('/').includes('..') &&
              await this._pathExists(destination) &&
              !(await this._pathExists(source))) {
            await Neutralino.filesystem.move(destination, source);
          }
          try { await Neutralino.filesystem.remove(recordPath); } catch (_) {}
          continue;
        }
        if (!record || !record.destination || !record.temporary) {
          try { await Neutralino.filesystem.remove(recordPath); } catch (_) {}
          continue;
        }
        const destination = normalizePathSeparators(record.destination);
        const temporary = normalizePathSeparators(record.temporary);
        if (
          destination.split('/').includes('..') ||
          temporary.split('/').includes('..') ||
          !destination.toLowerCase().startsWith(normalizedVault) ||
          !temporary.toLowerCase().startsWith(normalizedVault)
        ) {
          continue;
        }
        if (await this._pathExists(temporary)) {
          const recoveredContent = await Neutralino.filesystem.readFile(temporary);
          await Neutralino.filesystem.writeFile(destination, recoveredContent);
          const verifiedContent = await Neutralino.filesystem.readFile(destination);
          if (verifiedContent !== recoveredContent) {
            throw new Error('A recovered desktop document write could not be verified.');
          }
          try { await Neutralino.filesystem.remove(temporary); } catch (_) {}
        }
        if (record.metadata && typeof record.metadata === 'object' && await this._pathExists(destination)) {
          const indexPath = await this._pathJoin(this.vaultPath, INTERNAL_DIR, 'index.json');
          const currentIndex = await this._readJsonFileRecoverably(indexPath, null) || {
            version: VAULT_FORMAT_VERSION,
            documents: [],
            updatedAt: 0
          };
          if (!Array.isArray(currentIndex.documents)) currentIndex.documents = [];
          const recoveredMetadata = cloneJson(record.metadata, {}) || {};
          const existingIndex = currentIndex.documents.findIndex(function(item) {
            return item.id === recoveredMetadata.id;
          });
          const existing = existingIndex >= 0 ? currentIndex.documents[existingIndex] : null;
          if (!existing || normalizedStorageRevision(recoveredMetadata.storageRevision) > normalizedStorageRevision(existing.storageRevision)) {
            if (existingIndex >= 0) currentIndex.documents.splice(existingIndex, 1, recoveredMetadata);
            else currentIndex.documents.push(recoveredMetadata);
            currentIndex.updatedAt = Math.max(Date.now(), Number(currentIndex.updatedAt) || 0);
            await this._writeJsonFileRecoverably(indexPath, currentIndex);
          }
        }
        try { await Neutralino.filesystem.remove(recordPath); } catch (_) {}
      }
      await this._recoverDesktopTrashTransactions();
    }

    async _completeDesktopTrashPurge(record, metadataPath) {
      const trashPath = await this._pathJoin(this.vaultPath, INTERNAL_DIR, 'trash');
      const normalizedTrashPath = normalizePathSeparators(trashPath).toLowerCase().replace(/\/+$/, '') + '/';
      const isSafeTrashPath = function(path) {
        const normalized = normalizePathSeparators(path);
        return Boolean(
          normalized &&
          normalized.toLowerCase().startsWith(normalizedTrashPath) &&
          !normalized.split('/').includes('..')
        );
      };
      if (!isSafeTrashPath(metadataPath)) {
        throw new Error('Trash metadata points outside the managed Trash folder.');
      }
      if ((record.kind || 'normal-document') === 'normal-document') {
        if (!isSafeTrashPath(record.contentPath)) {
          throw new Error('Trash content points outside the managed Trash folder.');
        }
        if (await this._pathExists(record.contentPath)) {
          await Neutralino.filesystem.remove(record.contentPath);
        }
      }
      if (await this._pathExists(metadataPath)) {
        await Neutralino.filesystem.remove(metadataPath);
      }
    }

    async _recoverDesktopTrashTransactions() {
      const trashPath = await this._pathJoin(this.vaultPath, INTERNAL_DIR, 'trash');
      let entries = [];
      try { entries = await Neutralino.filesystem.readDirectory(trashPath); } catch (_) { return; }
      const indexPath = await this._pathJoin(this.vaultPath, INTERNAL_DIR, 'index.json');
      const currentIndex = await this._readJsonFileRecoverably(indexPath, null);
      const hasCurrentIndex = Boolean(currentIndex && Array.isArray(currentIndex.documents));
      const normalizedVault = normalizePathSeparators(this.vaultPath).toLowerCase().replace(/\/+$/, '') + '/';
      for (const entry of entries) {
        if (!entry || entry.type !== 'FILE' || !/(?:\.md\.json|\.secret\.json)$/i.test(entry.entry || '')) continue;
        const metadataPath = await this._pathJoin(trashPath, entry.entry);
        const record = await this._readJsonFileRecoverably(metadataPath, null);
        if (!record) continue;
        if (record.purgeInProgress) {
          try {
            await this._completeDesktopTrashPurge(record, metadataPath);
          } catch (error) {
            console.warn('An interrupted Trash purge could not be completed:', error);
          }
          continue;
        }
        if (record.kind !== 'normal-document' || !hasCurrentIndex) continue;
        const source = normalizePathSeparators(record.originalPath || record.source);
        const destination = normalizePathSeparators(record.contentPath || record.destination);
        if (!source || !destination || !source.toLowerCase().startsWith(normalizedVault) ||
            !destination.toLowerCase().startsWith(normalizedVault) || source.split('/').includes('..') ||
            destination.split('/').includes('..')) continue;
        if (record.restoreInProgress && typeof record.restoreInProgress === 'object') {
          const restoreDestination = normalizePathSeparators(record.restoreInProgress.destination);
          const restoreMetadata = record.restoreInProgress.metadata;
          if (restoreDestination && restoreMetadata && typeof restoreMetadata.id === 'string' &&
              restoreDestination.toLowerCase().startsWith(normalizedVault) &&
              !restoreDestination.split('/').includes('..')) {
            const indexedRestore = currentIndex.documents.some(function(item) {
              return item.id === restoreMetadata.id &&
                normalizePathSeparators(item.vaultRelativePath) === normalizePathSeparators(restoreMetadata.vaultRelativePath);
            });
            const restoreExists = await this._pathExists(restoreDestination);
            const trashContentExists = await this._pathExists(destination);
            if (indexedRestore && restoreExists) {
              try { await Neutralino.filesystem.remove(metadataPath); } catch (_) {}
              continue;
            }
            if (!indexedRestore && restoreExists && !trashContentExists) {
              await Neutralino.filesystem.move(restoreDestination, destination);
            }
            if (!indexedRestore) {
              const preservedTrashRecord = cloneJson(record, record);
              delete preservedTrashRecord.restoreInProgress;
              preservedTrashRecord.updatedAt = Date.now();
              await this._writeJsonFileRecoverably(metadataPath, preservedTrashRecord);
              continue;
            }
          }
        }
        const indexed = currentIndex.documents.find(function(item) {
          return item.id === record.documentId && record.metadata &&
            normalizePathSeparators(item.vaultRelativePath) === normalizePathSeparators(record.metadata.vaultRelativePath);
        });
        const sourceExists = await this._pathExists(source);
        const destinationExists = await this._pathExists(destination);
        if (indexed && !sourceExists && destinationExists) {
          await Neutralino.filesystem.move(destination, source);
          try { await Neutralino.filesystem.remove(metadataPath); } catch (_) {}
        } else if (indexed && sourceExists && !destinationExists) {
          try { await Neutralino.filesystem.remove(metadataPath); } catch (_) {}
        }
      }
    }

    async _desktopResolveVaultRelativePath(relativePath) {
      const normalized = normalizePathSeparators(relativePath).replace(/^\/+/, '');
      const segments = normalized.split('/').filter(Boolean);
      if (!segments.length || segments.some(function(segment) {
        return segment === '.' || segment === '..';
      })) {
        throw new Error('The vault index contains an invalid document path.');
      }
      return this._pathJoin.apply(this, [this.vaultPath].concat(segments));
    }

    async _migrateLegacyNormalDocuments() {
      const existing = await this.listDocumentMetadata();
      let legacy = [];
      try {
        legacy = JSON.parse(localStorage.getItem(LEGACY_TABS_KEY) || '[]');
      } catch (_) {}
      if (!Array.isArray(legacy) || !legacy.length) return;
      const normal = legacy.filter(function (tab) {
        return tab && tab.temporary !== true && tab.kind !== 'share-snapshot' && tab.workspaceId !== 'workspace_secret';
      });
      if (!normal.length) return;
      const existingById = new Map(existing.map(function(item) { return [item.id, item]; }));
      const pending = [];
      const migratedLegacyIds = [];
      for (const legacyTab of normal) {
        const legacyContent = typeof legacyTab.content === 'string' ? legacyTab.content : '';
        const legacyId = typeof legacyTab.id === 'string' && legacyTab.id.trim()
          ? legacyTab.id
          : randomId('legacy_recovered');
        const storedMetadata = existingById.get(legacyId);
        if (!storedMetadata) {
          const copy = Object.assign({}, legacyTab, {
            id: legacyId,
            content: legacyContent,
            contentLoaded: true,
            _storageRevision: 0
          });
          pending.push(copy);
          existingById.set(legacyId, copy);
          migratedLegacyIds.push(legacyId);
          continue;
        }

        let storedContent = null;
        try {
          storedContent = await this.loadDocumentContent(legacyId);
        } catch (error) {
          if (!error || error.name !== 'WorkspaceCorruptionError') throw error;
        }
        if (storedContent === null) {
          pending.push(Object.assign({}, storedMetadata, legacyTab, {
            id: legacyId,
            content: legacyContent,
            contentLoaded: true,
            _storageRevision: storedMetadata._storageRevision
          }));
          migratedLegacyIds.push(legacyId);
          continue;
        }
        if (storedContent !== legacyContent) {
          const recoveryId = randomId('legacy_recovered');
          pending.push(Object.assign({}, legacyTab, {
            id: recoveryId,
            title: String(legacyTab.title || storedMetadata.title || 'Untitled') + ' (legacy recovery)',
            content: legacyContent,
            contentLoaded: true,
            _storageRevision: 0
          }));
          migratedLegacyIds.push(recoveryId);
        }
      }
      if (pending.length) await this.saveDocuments(pending, null, {
        changedIds: pending.map(function(tab) { return tab.id; }),
        forceContent: true
      });
      for (const id of migratedLegacyIds) await this.loadDocumentContent(id);
      await this.setMetadata('legacyMigration', {
        version: 3,
        completedAt: Date.now(),
        documentCount: pending.length,
        existingDocumentCount: existing.length
      });
      try {
        localStorage.removeItem(LEGACY_TABS_KEY);
      } catch (_) {}
      if (this.desktop && Neutralino.storage.removeData) {
        try {
          await Neutralino.storage.removeData(LEGACY_TABS_KEY);
        } catch (_) {}
      }
    }

    async listDocumentMetadata() {
      if (this.desktop) {
        return this.vaultIndex.documents.map(function (item) {
          const tab = tabFromStoredMetadata(item);
          tab._vaultRelativePath = item.vaultRelativePath || '';
          return tab;
        });
      }
      const transaction = this.db.transaction('documents', 'readonly');
      const records = await requestToPromise(transaction.objectStore('documents').getAll());
      await transactionToPromise(transaction);
      return records.map(tabFromStoredMetadata);
    }

    async loadDocumentMetadata(id) {
      requireDocumentId(id);
      if (this.desktop) {
        const item = this.vaultIndex.documents.find(function(record) { return record.id === id; });
        return item ? tabFromStoredMetadata(item) : null;
      }
      const transaction = this.db.transaction('documents', 'readonly');
      const record = await requestToPromise(transaction.objectStore('documents').get(id));
      await transactionToPromise(transaction);
      return record ? tabFromStoredMetadata(record) : null;
    }

    async auditAndRepairDocuments() {
      if (this.desktop) return { recoveredOrphans: 0, missingContents: 0 };
      const transaction = this.db.transaction(['documents', 'contents'], 'readwrite');
      const completion = transactionToPromise(transaction);
      const documents = transaction.objectStore('documents');
      const contents = transaction.objectStore('contents');
      const metadataRecords = await requestToPromise(documents.getAll());
      const contentRecords = await requestToPromise(contents.getAll());
      const metadataIds = new Set(metadataRecords.map(function(item) { return item.id; }));
      const contentIds = new Set(contentRecords.map(function(item) { return item.id; }));
      let recoveredOrphans = 0;
      let missingContents = 0;

      for (const record of contentRecords) {
        if (metadataIds.has(record.id)) continue;
        const recoveredId = typeof record.id === 'string' && record.id.trim()
          ? record.id
          : randomId('recovered');
        const content = typeof record.content === 'string' ? record.content : '';
        contents.put({
          id: recoveredId,
          content: content,
          updatedAt: Number(record.updatedAt) || Date.now(),
          storageRevision: 1,
          storageWriterId: this.writerId
        });
        if (recoveredId !== record.id) contents.delete(record.id);
        documents.put({
          id: recoveredId,
          title: 'Recovered document',
          workspaceId: 'workspace_default',
          folderId: null,
          favorite: false,
          isOpen: false,
          viewMode: 'split',
          reviewThreads: [],
          createdAt: Number(record.updatedAt) || Date.now(),
          lastOpenedAt: Number(record.updatedAt) || Date.now(),
          lastEditedAt: Number(record.updatedAt) || Date.now(),
          contentSize: utf8ByteLength(content),
          storageRevision: 1,
          storageWriterId: this.writerId,
          recoveredFromOrphan: true
        });
        recoveredOrphans += 1;
      }

      for (const metadata of metadataRecords) {
        if (contentIds.has(metadata.id)) continue;
        metadata.storageCorruption = 'missing-content';
        documents.put(metadata);
        missingContents += 1;
      }
      await completion;
      return { recoveredOrphans: recoveredOrphans, missingContents: missingContents };
    }

    _cacheContent(id, content) {
      if (this._normalContentCache.has(id)) this._normalContentCache.delete(id);
      this._normalContentCache.set(id, content);
      while (this._normalContentCache.size > this._maxContentCacheEntries) {
        const oldest = this._normalContentCache.keys().next().value;
        this._normalContentCache.delete(oldest);
      }
    }

    async loadDocumentContent(id) {
      requireDocumentId(id);
      if (this._normalContentCache.has(id)) {
        const content = this._normalContentCache.get(id);
        this._cacheContent(id, content);
        return content;
      }
      let content = '';
      if (this.desktop) {
        const metadata = this.vaultIndex.documents.find(function (item) { return item.id === id; });
        if (!metadata || !metadata.vaultRelativePath) {
          throw new WorkspaceCorruptionError(id);
        }
        const path = await this._desktopResolveVaultRelativePath(metadata.vaultRelativePath);
        if (!(await this._pathExists(path))) throw new WorkspaceCorruptionError(id);
        content = await Neutralino.filesystem.readFile(path);
      } else {
        const transaction = this.db.transaction('contents', 'readonly');
        const record = await requestToPromise(transaction.objectStore('contents').get(id));
        await transactionToPromise(transaction);
        if (!record || typeof record.content !== 'string') throw new WorkspaceCorruptionError(id);
        content = record.content;
      }
      this._cacheContent(id, content);
      return content;
    }

    async _desktopFolderSegments(tab, organization) {
      const folders = organization && Array.isArray(organization.folders) ? organization.folders : [];
      const byId = new Map(folders.map(function (folder) { return [folder.id, folder]; }));
      const segments = [];
      const visited = new Set();
      let folder = byId.get(tab.folderId);
      while (folder && !visited.has(folder.id)) {
        visited.add(folder.id);
        segments.unshift(sanitizePathSegment(folder.name, 'Folder'));
        folder = byId.get(folder.parentFolderId);
      }
      return segments;
    }

    async _desktopDocumentRelativePath(tab, organization) {
      const segments = ['Workspace'].concat(await this._desktopFolderSegments(tab, organization));
      requireDocumentId(tab && tab.id);
      const suffix = await stableDocumentIdSuffix(tab.id);
      segments.push(sanitizePathSegment(tab.title, 'Untitled') + '--' + suffix + '.md');
      return normalizePathSeparators(segments.join('/'));
    }

    async _backupDocumentRelativePath(tab, organization) {
      const storedPath = normalizePathSeparators(tab && (tab.vaultRelativePath || tab._vaultRelativePath));
      if (
        storedPath &&
        storedPath.startsWith('Workspace/') &&
        !storedPath.split('/').some(function(segment) { return segment === '.' || segment === '..'; })
      ) {
        return storedPath;
      }
      return this._desktopDocumentRelativePath(tab, organization);
    }

    async _desktopEnsureOrganizationFolders(organization) {
      if (!organization || !Array.isArray(organization.folders)) return;
      for (const folder of organization.folders) {
        if (!folder || folder.workspaceId === 'workspace_secret') continue;
        const segments = ['Workspace'].concat(await this._desktopFolderSegments({
          folderId: folder.id
        }, organization));
        let folderPath = this.vaultPath;
        for (const segment of segments) {
          folderPath = await this._pathJoin(folderPath, segment);
          await this._ensureDirectory(folderPath);
        }
      }
    }

    async _desktopWriteIndex() {
      const internalPath = await this._pathJoin(this.vaultPath, INTERNAL_DIR);
      const indexPath = await this._pathJoin(internalPath, 'index.json');
      this.vaultIndex.updatedAt = Date.now();
      await this._writeJsonFileRecoverably(indexPath, this.vaultIndex);
    }

    async _desktopMoveToTrash(metadata) {
      if (!metadata || !metadata.vaultRelativePath) return null;
      const source = await this._desktopResolveVaultRelativePath(metadata.vaultRelativePath);
      if (!(await this._pathExists(source))) return null;
      const trashId = randomId('trash');
      const trashName = Date.now() + '-' + sanitizePathSegment(metadata.id, 'document') + '-' +
        sanitizePathSegment(metadata.title, 'Untitled') + '.md';
      const destination = await this._pathJoin(this.vaultPath, INTERNAL_DIR, 'trash', trashName);
      const metadataPath = destination + '.json';
      try {
        await this._writeJsonFileRecoverably(metadataPath, {
          version: 1,
          trashId: trashId,
          kind: 'normal-document',
          documentId: metadata.id,
          deletedAt: Date.now(),
          metadata: cloneJson(metadata, {}),
          contentPath: destination,
          originalPath: source,
          updatedAt: Date.now()
        });
        await Neutralino.filesystem.move(source, destination);
      } catch (error) {
        if (await this._pathExists(destination) && !(await this._pathExists(source))) {
          try { await Neutralino.filesystem.move(destination, source); } catch (_) {}
        }
        try { await Neutralino.filesystem.remove(metadataPath); } catch (_) {}
        throw error;
      }
      return {
        trashId: trashId,
        source: source,
        destination: destination,
        metadataPath: metadataPath,
        metadata: cloneJson(metadata, {})
      };
    }

    async _desktopSaveHistory(tab, fullPath) {
      if (!(await this._pathExists(fullPath))) return;
      const historyDirectory = await this._pathJoin(
        this.vaultPath,
        INTERNAL_DIR,
        'history',
        sanitizePathSegment(tab.id, 'document')
      );
      await this._ensureDirectory(historyDirectory);
      const historyPath = await this._pathJoin(historyDirectory, Date.now() + '.md');
      await Neutralino.filesystem.copy(fullPath, historyPath);
      try {
        const entries = (await Neutralino.filesystem.readDirectory(historyDirectory))
          .filter(function (entry) {
            return entry && entry.type === 'FILE' && /\.md$/i.test(entry.entry || '');
          })
          .sort(function (a, b) { return String(b.entry).localeCompare(String(a.entry)); });
        for (const entry of entries.slice(20)) {
          try {
            await Neutralino.filesystem.remove(await this._pathJoin(historyDirectory, entry.entry));
          } catch (_) {}
        }
      } catch (_) {}
    }

    async _desktopWriteDocumentSafely(tab, fullPath, content, relativePath, nextRevision) {
      await this._desktopSaveHistory(tab, fullPath);
      const journalDirectory = await this._pathJoin(this.vaultPath, INTERNAL_DIR, 'journal');
      const safeId = sanitizePathSegment(tab.id, 'document');
      const temporaryPath = await this._pathJoin(journalDirectory, safeId + '.pending');
      const journalPath = await this._pathJoin(journalDirectory, safeId + '.json');
      await Neutralino.filesystem.writeFile(temporaryPath, content);
      await this._writeJsonFile(journalPath, {
        version: 1,
        documentId: tab.id,
        destination: fullPath,
        destinationRelativePath: relativePath,
        temporary: temporaryPath,
        metadata: Object.assign(metadataFromTab(tab), {
          vaultRelativePath: relativePath,
          storageRevision: normalizedStorageRevision(nextRevision),
          storageWriterId: this.writerId,
          contentSize: utf8ByteLength(content)
        }),
        startedAt: Date.now()
      });
      await Neutralino.filesystem.writeFile(fullPath, content);
      const verified = await Neutralino.filesystem.readFile(fullPath);
      if (verified !== content) {
        throw new Error('A desktop document write could not be verified.');
      }
      try { await Neutralino.filesystem.remove(temporaryPath); } catch (_) {}
      tab._storageContentJournalPaths = Array.from(new Set((tab._storageContentJournalPaths || []).concat(journalPath)));
    }

    async _desktopSaveDocument(tab, organization, forceContent) {
      requireDocumentId(tab && tab.id);
      const existing = this.vaultIndex.documents.find(function (item) { return item.id === tab.id; });
      const actualRevision = normalizedStorageRevision(existing && existing.storageRevision);
      const expectedRevision = normalizedStorageRevision(tab && tab._storageRevision);
      if (existing && actualRevision !== expectedRevision) {
        let storedContent = '';
        if (existing.vaultRelativePath) {
          const storedPath = await this._desktopResolveVaultRelativePath(existing.vaultRelativePath);
          if (await this._pathExists(storedPath)) storedContent = await Neutralino.filesystem.readFile(storedPath);
        }
        throw new WorkspaceConflictError(tab.id, tab, existing, storedContent);
      }
      const relativePath = await this._desktopDocumentRelativePath(tab, organization);
      const fullPath = await this._pathJoin(this.vaultPath, relativePath);
      const pathParts = relativePath.split('/');
      pathParts.pop();
      let folderPath = this.vaultPath;
      for (const part of pathParts) {
        folderPath = await this._pathJoin(folderPath, part);
        await this._ensureDirectory(folderPath);
      }

      if (existing && existing.vaultRelativePath && existing.vaultRelativePath !== relativePath) {
        const oldPath = await this._desktopResolveVaultRelativePath(existing.vaultRelativePath);
        const journalDirectory = await this._pathJoin(this.vaultPath, INTERNAL_DIR, 'journal');
        const moveJournalPath = await this._pathJoin(journalDirectory, sanitizePathSegment(tab.id, 'document') + '.move.json');
        await this._writeJsonFile(moveJournalPath, {
          version: 1,
          operation: 'move',
          documentId: tab.id,
          source: oldPath,
          destination: fullPath,
          destinationRelativePath: relativePath,
          startedAt: Date.now()
        });
        tab._storageMoveJournalPath = moveJournalPath;
        if (await this._pathExists(oldPath)) {
          if (await this._pathExists(fullPath)) {
            await Neutralino.filesystem.writeFile(fullPath, typeof tab.content === 'string' ? tab.content : await Neutralino.filesystem.readFile(oldPath));
            await Neutralino.filesystem.remove(oldPath);
          } else {
            await Neutralino.filesystem.move(oldPath, fullPath);
          }
        }
      }
      if (forceContent || tab.contentLoaded !== false) {
        const content = typeof tab.content === 'string' ? tab.content : '';
        if (forceContent || !existing || tab._persistedContent !== content || !(await this._pathExists(fullPath))) {
          await this._desktopWriteDocumentSafely(tab, fullPath, content, relativePath, actualRevision + 1);
          tab._persistedContent = content;
          this._cacheContent(tab.id, content);
        }
      }
      const metadata = metadataFromTab(tab);
      metadata.vaultRelativePath = relativePath;
      metadata.storageRevision = actualRevision + 1;
      metadata.storageWriterId = this.writerId;
      metadata.contentSize = typeof tab.content === 'string'
        ? new TextEncoder().encode(tab.content).byteLength
        : Number(existing && existing.contentSize) || 0;
      if (existing) Object.assign(existing, metadata);
      else this.vaultIndex.documents.push(metadata);
      tab._vaultRelativePath = relativePath;
      tab._pendingStorageRevision = metadata.storageRevision;
    }

    async saveDocuments(tabs, organization, options) {
      const settings = options || {};
      const source = (tabs || []).filter(function (tab) {
        return tab && tab.id && tab.temporary !== true && tab.kind !== 'share-snapshot' && tab.workspaceId !== 'workspace_secret';
      });
      const seenIds = new Set();
      source.forEach(function(tab) {
        requireDocumentId(tab.id);
        if (seenIds.has(tab.id)) throw new TypeError('Duplicate document ID: ' + tab.id);
        seenIds.add(tab.id);
      });
      const changedIds = settings.changedIds ? new Set(settings.changedIds) : null;
      const selected = changedIds ? source.filter(function (tab) { return changedIds.has(tab.id); }) : source;
      if (this.desktop) {
        const indexPath = await this._pathJoin(this.vaultPath, INTERNAL_DIR, 'index.json');
        const currentIndex = await this._readJsonFileRecoverably(indexPath, null);
        if (currentIndex && Array.isArray(currentIndex.documents)) this.vaultIndex = currentIndex;
        for (const tab of selected) {
          await this._desktopSaveDocument(tab, organization, settings.forceContent === true);
        }
        this.vaultIndex.updatedAt = Date.now();
        const journalDirectory = await this._pathJoin(this.vaultPath, INTERNAL_DIR, 'journal');
        const indexJournalPath = await this._pathJoin(journalDirectory, randomId('index') + '.index.json');
        await this._writeJsonFile(indexJournalPath, {
          version: 1,
          operation: 'index-commit',
          index: cloneJson(this.vaultIndex, this.vaultIndex),
          startedAt: Date.now()
        });
        this._desktopIndexWrite = this._desktopIndexWrite.catch(function () {}).then(() => this._desktopWriteIndex());
        await this._desktopIndexWrite;
        try { await Neutralino.filesystem.remove(indexJournalPath); } catch (_) {}
        for (const tab of selected) {
          tab._storageRevision = normalizedStorageRevision(tab._pendingStorageRevision);
          delete tab._pendingStorageRevision;
          const contentJournalPaths = Array.isArray(tab._storageContentJournalPaths)
            ? tab._storageContentJournalPaths.slice()
            : [];
          for (const contentJournalPath of contentJournalPaths) {
            try { await Neutralino.filesystem.remove(contentJournalPath); } catch (_) {}
          }
          delete tab._storageContentJournalPaths;
          if (tab._storageMoveJournalPath) {
            try { await Neutralino.filesystem.remove(tab._storageMoveJournalPath); } catch (_) {}
            delete tab._storageMoveJournalPath;
          }
        }
        return true;
      }

      const transaction = this.db.transaction(['documents', 'contents', 'trash'], 'readwrite');
      const completion = transactionToPromise(transaction);
      const documents = transaction.objectStore('documents');
      const contents = transaction.objectStore('contents');
      const writes = [];
      try {
        for (const tab of selected) {
          const existingMetadata = await requestToPromise(documents.get(tab.id));
          const existingContentRecord = existingMetadata ? await requestToPromise(contents.get(tab.id)) : null;
          const actualRevision = normalizedStorageRevision(existingMetadata && existingMetadata.storageRevision);
          const expectedRevision = normalizedStorageRevision(tab._storageRevision);
          if (existingMetadata && actualRevision !== expectedRevision) {
            transaction.abort();
            await completion.catch(function() {});
            throw new WorkspaceConflictError(
              tab.id,
              tab,
              existingMetadata,
              existingContentRecord && existingContentRecord.content
            );
          }
          const metadata = metadataFromTab(tab);
          const nextRevision = actualRevision + 1;
          metadata.storageRevision = nextRevision;
          metadata.storageWriterId = this.writerId;
          if (settings.forceContent || tab.contentLoaded !== false) {
            const content = typeof tab.content === 'string' ? tab.content : '';
            metadata.contentSize = utf8ByteLength(content);
            contents.put({
              id: tab.id,
              content: content,
              updatedAt: Date.now(),
              storageRevision: nextRevision,
              storageWriterId: this.writerId
            });
          }
          documents.put(metadata);
          writes.push({ tab: tab, revision: nextRevision });
        }
        await completion;
      } catch (error) {
        try { transaction.abort(); } catch (_) {}
        await completion.catch(function() {});
        throw error;
      }
      writes.forEach((write) => {
        write.tab._storageRevision = write.revision;
        if (settings.forceContent || write.tab.contentLoaded !== false) {
          const content = typeof write.tab.content === 'string' ? write.tab.content : '';
          write.tab._persistedContent = content;
          this._cacheContent(write.tab.id, content);
        }
      });
      return true;
    }

    async getDocumentOrganizationState() {
      let stored;
      if (this.desktop) {
        const organizationPath = await this._pathJoin(this.vaultPath, INTERNAL_DIR, 'organization.json');
        stored = await this._readJsonFileRecoverably(organizationPath, null);
        this.vaultOrganization = stored;
      } else {
        stored = await this.getMetadata('documentOrganization');
      }
      const organization = cloneJson(stored, null);
      const revision = normalizedStorageRevision(organization && organization._storageRevision);
      if (organization) {
        delete organization._storageRevision;
        delete organization._storageWriterId;
        delete organization.updatedAt;
      }
      this._organizationRevision = revision;
      this._organizationSnapshot = organization ? JSON.stringify(organization) : '';
      return { organization: organization, revision: revision };
    }

    async getDocumentOrganization() {
      return (await this.getDocumentOrganizationState()).organization;
    }

    async saveDocumentOrganization(organization, options) {
      const settings = options || {};
      const safeOrganization = cloneJson(organization, null);
      if (!safeOrganization) return { organization: null, revision: this._organizationRevision };
      delete safeOrganization._storageRevision;
      delete safeOrganization._storageWriterId;
      delete safeOrganization.updatedAt;
      const expectedRevision = normalizedStorageRevision(
        settings.expectedRevision === undefined ? this._organizationRevision : settings.expectedRevision
      );
      const baseOrganization = cloneJson(settings.baseOrganization, null) ||
        (this._organizationSnapshot ? JSON.parse(this._organizationSnapshot) : {});
      if (this.desktop) {
        const organizationPath = await this._pathJoin(this.vaultPath, INTERNAL_DIR, 'organization.json');
        const stored = await this._readJsonFileRecoverably(organizationPath, null);
        const storedRevision = normalizedStorageRevision(stored && stored._storageRevision);
        const storedOrganization = cloneJson(stored, {}) || {};
        delete storedOrganization._storageRevision;
        delete storedOrganization._storageWriterId;
        delete storedOrganization.updatedAt;
        const merged = storedRevision === expectedRevision
          ? safeOrganization
          : mergeOrganizationChanges(baseOrganization, safeOrganization, storedOrganization);
        const nextRevision = storedRevision + 1;
        const persisted = Object.assign({}, merged, {
          _storageRevision: nextRevision,
          _storageWriterId: this.writerId,
          updatedAt: Date.now()
        });
        await this._desktopEnsureOrganizationFolders(merged);
        await this._writeJsonFileRecoverably(organizationPath, persisted);
        this.vaultOrganization = persisted;
        this._organizationRevision = nextRevision;
        this._organizationSnapshot = JSON.stringify(merged);
        return { organization: cloneJson(merged, merged), revision: nextRevision, merged: storedRevision !== expectedRevision };
      }

      const transaction = this.db.transaction('metadata', 'readwrite');
      const completion = transactionToPromise(transaction);
      const store = transaction.objectStore('metadata');
      try {
        const record = await requestToPromise(store.get('documentOrganization'));
        const stored = record && record.value && typeof record.value === 'object' ? record.value : null;
        const storedRevision = normalizedStorageRevision(stored && stored._storageRevision);
        const storedOrganization = cloneJson(stored, {}) || {};
        delete storedOrganization._storageRevision;
        delete storedOrganization._storageWriterId;
        delete storedOrganization.updatedAt;
        const merged = storedRevision === expectedRevision
          ? safeOrganization
          : mergeOrganizationChanges(baseOrganization, safeOrganization, storedOrganization);
        const nextRevision = storedRevision + 1;
        store.put({ key: 'documentOrganization', value: Object.assign({}, merged, {
          _storageRevision: nextRevision,
          _storageWriterId: this.writerId
        }) });
        await completion;
        this._organizationRevision = nextRevision;
        this._organizationSnapshot = JSON.stringify(merged);
        return { organization: cloneJson(merged, merged), revision: nextRevision, merged: storedRevision !== expectedRevision };
      } catch (error) {
        try { transaction.abort(); } catch (_) {}
        await completion.catch(function() {});
        throw error;
      }
    }

    async deleteDocument(id, options) {
      requireDocumentId(id);
      const settings = options || {};
      this._normalContentCache.delete(id);
      if (this.desktop) {
        const indexPath = await this._pathJoin(this.vaultPath, INTERNAL_DIR, 'index.json');
        const currentIndex = await this._readJsonFileRecoverably(indexPath, null);
        if (currentIndex && Array.isArray(currentIndex.documents)) this.vaultIndex = currentIndex;
        const metadata = this.vaultIndex.documents.find(function (item) { return item.id === id; });
        if (metadata && settings.expectedRevision !== undefined &&
            normalizedStorageRevision(metadata.storageRevision) !== normalizedStorageRevision(settings.expectedRevision)) {
          let storedContent = '';
          if (metadata.vaultRelativePath) {
            const storedPath = await this._desktopResolveVaultRelativePath(metadata.vaultRelativePath);
            if (await this._pathExists(storedPath)) storedContent = await Neutralino.filesystem.readFile(storedPath);
          }
          throw new WorkspaceConflictError(id, null, metadata, storedContent);
        }
        const previousIndex = cloneJson(this.vaultIndex, this.vaultIndex);
        const trashRecord = metadata ? await this._desktopMoveToTrash(metadata) : null;
        this.vaultIndex.documents = this.vaultIndex.documents.filter(function (item) { return item.id !== id; });
        try {
          await this._desktopWriteIndex();
        } catch (error) {
          this.vaultIndex = previousIndex;
          try { await Neutralino.filesystem.remove(indexPath + '.pending'); } catch (_) {}
          try { await Neutralino.filesystem.remove(indexPath + '.backup'); } catch (_) {}
          if (trashRecord && await this._pathExists(trashRecord.destination) && !(await this._pathExists(trashRecord.source))) {
            try { await Neutralino.filesystem.move(trashRecord.destination, trashRecord.source); } catch (rollbackError) {
              error.rollbackError = rollbackError;
            }
          }
          if (trashRecord) {
            try { await Neutralino.filesystem.remove(trashRecord.metadataPath); } catch (_) {}
          }
          throw error;
        }
        return;
      }
      const transaction = this.db.transaction(['documents', 'contents', 'trash'], 'readwrite');
      const documents = transaction.objectStore('documents');
      const contents = transaction.objectStore('contents');
      const metadata = await requestToPromise(documents.get(id));
      const content = await requestToPromise(contents.get(id));
      if (metadata && settings.expectedRevision !== undefined &&
          normalizedStorageRevision(metadata.storageRevision) !== normalizedStorageRevision(settings.expectedRevision)) {
        transaction.abort();
        throw new WorkspaceConflictError(id, null, metadata, content && content.content);
      }
      if (metadata || content) {
        transaction.objectStore('trash').put({
          trashId: randomId('trash'),
          documentId: id,
          deletedAt: Date.now(),
          metadata: metadata || { id: id },
          content: content && typeof content.content === 'string' ? content.content : ''
        });
      }
      documents.delete(id);
      contents.delete(id);
      await transactionToPromise(transaction);
    }

    async clearNormalDocuments() {
      this._normalContentCache.clear();
      if (this.desktop) {
        const existing = this.vaultIndex.documents.slice();
        const indexPath = await this._pathJoin(this.vaultPath, INTERNAL_DIR, 'index.json');
        const trashRecords = [];
        for (const item of existing) {
          const record = await this._desktopMoveToTrash(item);
          if (record) trashRecords.push(record);
        }
        this.vaultIndex.documents = [];
        try {
          await this._desktopWriteIndex();
        } catch (error) {
          this.vaultIndex.documents = existing;
          try { await Neutralino.filesystem.remove(indexPath + '.pending'); } catch (_) {}
          try { await Neutralino.filesystem.remove(indexPath + '.backup'); } catch (_) {}
          for (const record of trashRecords.reverse()) {
            if (await this._pathExists(record.destination) && !(await this._pathExists(record.source))) {
              try { await Neutralino.filesystem.move(record.destination, record.source); } catch (rollbackError) {
                error.rollbackError = rollbackError;
              }
            }
            try { await Neutralino.filesystem.remove(record.metadataPath); } catch (_) {}
          }
          throw error;
        }
        return;
      }
      const transaction = this.db.transaction(['documents', 'contents', 'trash'], 'readwrite');
      const documents = transaction.objectStore('documents');
      const contents = transaction.objectStore('contents');
      const trash = transaction.objectStore('trash');
      const allMetadata = await requestToPromise(documents.getAll());
      for (const metadata of allMetadata) {
        const content = await requestToPromise(contents.get(metadata.id));
        trash.put({
          trashId: randomId('trash'),
          documentId: metadata.id,
          deletedAt: Date.now(),
          metadata: metadata,
          content: content && typeof content.content === 'string' ? content.content : ''
        });
      }
      documents.clear();
      contents.clear();
      await transactionToPromise(transaction);
    }

    async getMetadata(key) {
      if (this.desktop) {
        if (key === 'vaultSettings') return cloneJson(this.desktopSettings, {});
        if (key === 'secretManifest') {
          const manifestPath = await this._pathJoin(this.vaultPath, INTERNAL_DIR, 'secret-manifest.json');
          const manifest = await this._readJsonFile(manifestPath, null);
          if (manifest) return manifest;
        }
        try {
          const raw = await Neutralino.storage.getData('markdownViewerMeta_' + key);
          return JSON.parse(raw);
        } catch (_) {
          return null;
        }
      }
      const transaction = this.db.transaction('metadata', 'readonly');
      const record = await requestToPromise(transaction.objectStore('metadata').get(key));
      await transactionToPromise(transaction);
      return record ? record.value : null;
    }

    async setMetadata(key, value) {
      if (this.desktop) {
        if (key === 'vaultSettings') {
          this.desktopSettings = cloneJson(value, {});
          const settingsPath = await this._pathJoin(this.vaultPath, INTERNAL_DIR, 'settings.json');
          await this._writeJsonFile(settingsPath, this.desktopSettings);
          return;
        }
        if (key === 'secretManifest') {
          const manifestPath = await this._pathJoin(this.vaultPath, INTERNAL_DIR, 'secret-manifest.json');
          if (value) await this._writeJsonFile(manifestPath, value);
          else if (await this._pathExists(manifestPath)) await Neutralino.filesystem.remove(manifestPath);
          return;
        }
        await Neutralino.storage.setData('markdownViewerMeta_' + key, JSON.stringify(value));
        return;
      }
      const transaction = this.db.transaction('metadata', 'readwrite');
      transaction.objectStore('metadata').put({ key: key, value: value });
      await transactionToPromise(transaction);
    }

    async deleteMetadata(key) {
      if (this.desktop) {
        if (key === 'vaultSettings') {
          this.desktopSettings = {};
          const settingsPath = await this._pathJoin(this.vaultPath, INTERNAL_DIR, 'settings.json');
          if (await this._pathExists(settingsPath)) await Neutralino.filesystem.remove(settingsPath);
          return;
        }
        if (key === 'secretManifest') {
          const manifestPath = await this._pathJoin(this.vaultPath, INTERNAL_DIR, 'secret-manifest.json');
          if (await this._pathExists(manifestPath)) await Neutralino.filesystem.remove(manifestPath);
          return;
        }
        if (Neutralino.storage.removeData) {
          try {
            await Neutralino.storage.removeData('markdownViewerMeta_' + key);
          } catch (_) {}
        }
        return;
      }
      const transaction = this.db.transaction('metadata', 'readwrite');
      transaction.objectStore('metadata').delete(key);
      await transactionToPromise(transaction);
    }

    async getSecretManifest() {
      const stored = await this.getMetadata('secretManifest');
      if (stored) {
        await this._storeSecretManifestBackup(stored);
        return stored;
      }
      try {
        const legacy = JSON.parse(localStorage.getItem(LEGACY_SECRET_KEY) || 'null');
        if (legacy) {
          await this.setSecretManifest(legacy);
          return legacy;
        }
      } catch (_) {}
      const backup = await this._readSecretManifestBackup();
      if (backup) {
        await this.setSecretManifest(backup);
        return backup;
      }
      const records = await this.listSecretRecords();
      if (records.length) {
        throw new WorkspaceCorruptionError(
          SECRET_MANIFEST_BACKUP_RECORD_ID,
          'Encrypted Secret Workspace records exist, but every manifest copy is missing. New setup is blocked to preserve them.'
        );
      }
      return null;
    }

    async _readSecretManifestBackup() {
      if (this.desktop) {
        const path = await this._pathJoin(this.vaultPath, 'Secret Workspace', 'manifest-backup.json');
        return this._readJsonFileRecoverably(path, null);
      }
      const transaction = this.db.transaction('secretRecords', 'readonly');
      const record = await requestToPromise(transaction.objectStore('secretRecords').get(SECRET_MANIFEST_BACKUP_RECORD_ID));
      await transactionToPromise(transaction);
      return record && record.manifest ? cloneJson(record.manifest, null) : null;
    }

    async _storeSecretManifestBackup(manifest) {
      if (!manifest) return;
      if (this.desktop) {
        const path = await this._pathJoin(this.vaultPath, 'Secret Workspace', 'manifest-backup.json');
        await this._writeJsonFileRecoverably(path, manifest);
        return;
      }
      const transaction = this.db.transaction('secretRecords', 'readwrite');
      transaction.objectStore('secretRecords').put({
        id: SECRET_MANIFEST_BACKUP_RECORD_ID,
        manifest: cloneJson(manifest, null),
        updatedAt: Date.now()
      });
      await transactionToPromise(transaction);
    }

    async listTrash() {
      if (this.desktop) {
        const directory = await this._pathJoin(this.vaultPath, INTERNAL_DIR, 'trash');
        const entries = await Neutralino.filesystem.readDirectory(directory);
        const items = [];
        for (const entry of entries) {
          if (!entry || entry.type !== 'FILE' || !/(?:\.md\.json|\.secret\.json)$/i.test(entry.entry || '')) continue;
          const path = await this._pathJoin(directory, entry.entry);
          const record = await this._readJsonFileRecoverably(path, null);
          if (!record || !record.trashId) continue;
          items.push(Object.assign({}, record, {
            metadataPath: path,
            restorable: isTrashRecordRestorable(record, true)
          }));
        }
        return items.sort(function(left, right) { return Number(right.deletedAt) - Number(left.deletedAt); });
      }
      const transaction = this.db.transaction('trash', 'readonly');
      const records = await requestToPromise(transaction.objectStore('trash').getAll());
      await transactionToPromise(transaction);
      return records.map(function(record) {
        return Object.assign({}, record, { restorable: isTrashRecordRestorable(record, false) });
      }).sort(function(left, right) { return Number(right.deletedAt) - Number(left.deletedAt); });
    }

    async permanentlyDeleteTrashItem(trashId) {
      if (typeof trashId !== 'string' || !trashId) throw new TypeError('A Trash item ID is required.');
      if (this.desktop) {
        const items = await this.listTrash();
        const item = items.find(function(record) { return record.trashId === trashId; });
        if (!item) throw new Error('The Trash item is no longer available.');
        const purgeRecord = Object.assign({}, cloneJson(item, {}) || {}, {
          purgeInProgress: { requestedAt: Date.now() },
          updatedAt: Date.now()
        });
        delete purgeRecord.metadataPath;
        delete purgeRecord.restorable;
        await this._writeJsonFileRecoverably(item.metadataPath, purgeRecord);
        await this._completeDesktopTrashPurge(purgeRecord, item.metadataPath);
        return true;
      }
      const transaction = this.db.transaction('trash', 'readwrite');
      const completion = transactionToPromise(transaction);
      const store = transaction.objectStore('trash');
      const item = await requestToPromise(store.get(trashId));
      if (!item) {
        await completion;
        throw new Error('The Trash item is no longer available.');
      }
      store.delete(trashId);
      await completion;
      return true;
    }

    async emptyTrash() {
      if (this.desktop) {
        const items = await this.listTrash();
        let deletedCount = 0;
        const failures = [];
        for (const item of items) {
          try {
            await this.permanentlyDeleteTrashItem(item.trashId);
            deletedCount += 1;
          } catch (error) {
            failures.push({ trashId: item.trashId, error: error });
          }
        }
        if (failures.length) {
          const error = new Error(
            deletedCount + ' Trash item' + (deletedCount === 1 ? '' : 's') +
            ' deleted, but ' + failures.length + ' could not be removed.'
          );
          error.deletedCount = deletedCount;
          error.failures = failures;
          throw error;
        }
        return deletedCount;
      }
      const transaction = this.db.transaction('trash', 'readwrite');
      const completion = transactionToPromise(transaction);
      const store = transaction.objectStore('trash');
      const count = await requestToPromise(store.count());
      store.clear();
      await completion;
      return count;
    }

    async purgeExpiredTrash(options) {
      const settings = options || {};
      const now = Number.isFinite(Number(settings.now)) ? Number(settings.now) : Date.now();
      const retentionMs = Number.isFinite(Number(settings.retentionMs)) && Number(settings.retentionMs) >= 0
        ? Number(settings.retentionMs)
        : TRASH_RETENTION_MS;
      const cutoff = now - retentionMs;
      const items = (await this.listTrash()).filter(function(record) {
        return isTrashRecordEligibleForAutomaticPurge(record, cutoff);
      });
      let deletedCount = 0;
      const failures = [];
      for (const item of items) {
        try {
          await this.permanentlyDeleteTrashItem(item.trashId);
          deletedCount += 1;
        } catch (error) {
          failures.push({ trashId: item.trashId, error: error });
        }
      }
      if (failures.length) {
        const error = new Error('One or more expired Trash items could not be removed.');
        error.deletedCount = deletedCount;
        error.failures = failures;
        throw error;
      }
      return deletedCount;
    }

    async saveDirtyJournal(journal) {
      if (this.desktop || !journal || typeof journal.journalId !== 'string' || !journal.journalId) return false;
      const transaction = this.db.transaction('journals', 'readwrite');
      transaction.objectStore('journals').put(cloneJson(journal, journal));
      await transactionToPromise(transaction);
      return true;
    }

    async listDirtyJournals() {
      if (this.desktop) return [];
      const transaction = this.db.transaction('journals', 'readonly');
      const records = await requestToPromise(transaction.objectStore('journals').getAll());
      await transactionToPromise(transaction);
      return records;
    }

    async deleteDirtyJournals(journalIds) {
      if (this.desktop) return;
      const ids = Array.isArray(journalIds) ? journalIds.filter(Boolean) : [];
      if (!ids.length) return;
      const transaction = this.db.transaction('journals', 'readwrite');
      const store = transaction.objectStore('journals');
      ids.forEach(function(id) { store.delete(id); });
      await transactionToPromise(transaction);
    }

    async restoreTrashItem(trashId) {
      if (typeof trashId !== 'string' || !trashId) throw new TypeError('A trash item ID is required.');
      this._normalContentCache.clear();
      if (this.desktop) {
        const items = await this.listTrash();
        const item = items.find(function(record) { return record.trashId === trashId; });
        if (!item) throw new Error('The deleted document is no longer available.');
        if (!item.restorable) {
          throw new WorkspaceCorruptionError(
            trashId,
            'This Trash item has incomplete or unsupported recovery data. It was kept in Trash and was not changed.'
          );
        }
        if (item.kind === 'secret-workspace-snapshot') {
          const currentRecords = await this.listSecretRecords();
          const currentManifest = await this.getSecretManifest();
          if (currentRecords.length) {
            const currentTrashPath = await this._pathJoin(
              this.vaultPath,
              INTERNAL_DIR,
              'trash',
              Date.now() + '-' + randomId('secret_snapshot') + '.secret.json'
            );
            await this._writeJsonFileRecoverably(currentTrashPath, {
              version: 1,
              trashId: randomId('secret_snapshot'),
              kind: 'secret-workspace-snapshot',
              documentId: SECRET_MANIFEST_BACKUP_RECORD_ID,
              deletedAt: Date.now(),
              secretManifest: cloneJson(currentManifest, null),
              secretRecords: cloneJson(currentRecords, []),
              updatedAt: Date.now()
            });
          }
          await this.replaceSecretRecords(item.secretRecords || [], item.secretManifest || null, { preservePrevious: false });
          try { await Neutralino.filesystem.remove(item.metadataPath); } catch (_) {}
          return { id: SECRET_MANIFEST_BACKUP_RECORD_ID, kind: 'secret-workspace-snapshot' };
        }
        if (item.kind === 'secret-record') {
          const manifest = await this.getSecretManifest();
          if (!manifest || !item.secretManifest || manifest.salt !== item.secretManifest.salt) {
            throw new Error('This encrypted record belongs to a different Secret Workspace key.');
          }
          const existingSecret = (await this.listSecretRecords()).find(function(record) {
            return record.id === item.documentId;
          });
          if (existingSecret) throw new Error('A Secret Workspace record with this ID already exists.');
          await this.applySecretRecordChanges({
            upserts: [{
              id: item.documentId,
              envelope: item.secretRecord.envelope,
              expectedRevision: 0
            }],
            deletions: []
          }, manifest);
          try { await Neutralino.filesystem.remove(item.metadataPath); } catch (_) {}
          return { id: item.documentId, kind: 'secret-record' };
        }
        if (item.kind !== 'normal-document') throw new Error('The deleted document is no longer available.');
        const currentIndex = cloneJson(this.vaultIndex, this.vaultIndex);
        const metadata = cloneJson(item.metadata, {}) || {};
        if (this.vaultIndex.documents.some(function(record) { return record.id === metadata.id; })) {
          metadata.id = randomId('restored');
          metadata.title = String(metadata.title || 'Untitled') + ' (restored)';
        }
        metadata.storageRevision = 1;
        metadata.storageWriterId = this.writerId;
        metadata.workspaceId = metadata.workspaceId === 'workspace_secret' ? 'workspace_default' : (metadata.workspaceId || 'workspace_default');
        metadata.folderId = null;
        const relativePath = await this._desktopDocumentRelativePath(metadata, { folders: [] });
        metadata.vaultRelativePath = relativePath;
        const destination = await this._desktopResolveVaultRelativePath(relativePath);
        const restoringTrashRecord = Object.assign({}, cloneJson(item, {}) || {}, {
          restoreInProgress: {
            destination: destination,
            metadata: cloneJson(metadata, metadata)
          },
          updatedAt: Date.now()
        });
        delete restoringTrashRecord.metadataPath;
        delete restoringTrashRecord.restorable;
        await this._writeJsonFileRecoverably(item.metadataPath, restoringTrashRecord);
        await Neutralino.filesystem.move(item.contentPath, destination);
        this.vaultIndex.documents.push(metadata);
        try {
          await this._desktopWriteIndex();
          try { await Neutralino.filesystem.remove(item.metadataPath); } catch (_) {}
          return { id: metadata.id, kind: 'normal-document' };
        } catch (error) {
          this.vaultIndex = currentIndex;
          try { await Neutralino.filesystem.move(destination, item.contentPath); } catch (rollbackError) {
            error.rollbackError = rollbackError;
          }
          try {
            const preservedTrashRecord = cloneJson(item, {}) || {};
            delete preservedTrashRecord.metadataPath;
            preservedTrashRecord.updatedAt = Date.now();
            await this._writeJsonFileRecoverably(item.metadataPath, preservedTrashRecord);
          } catch (_) {}
          throw error;
        }
      }

      const transaction = this.db.transaction(['documents', 'contents', 'metadata', 'secretRecords', 'trash'], 'readwrite');
      const completion = transactionToPromise(transaction);
      const trash = transaction.objectStore('trash');
      try {
        const item = await requestToPromise(trash.get(trashId));
        if (!item) throw new Error('The deleted item is no longer available.');
        if (!isTrashRecordRestorable(item, false)) {
          throw new WorkspaceCorruptionError(
            trashId,
            'This Trash item has incomplete or unsupported recovery data. It was kept in Trash and was not changed.'
          );
        }
        if (item.kind === 'secret-workspace-snapshot') {
          const records = transaction.objectStore('secretRecords');
          const metadataStore = transaction.objectStore('metadata');
          const currentManifestRecord = await requestToPromise(metadataStore.get('secretManifest'));
          const currentManifest = currentManifestRecord && currentManifestRecord.value ? currentManifestRecord.value : null;
          const currentRecords = (await requestToPromise(records.getAll())).filter(function(record) {
            return record.id !== SECRET_MANIFEST_BACKUP_RECORD_ID;
          });
          if (currentRecords.length) {
            trash.put({
              trashId: randomId('secret_snapshot'),
              kind: 'secret-workspace-snapshot',
              documentId: SECRET_MANIFEST_BACKUP_RECORD_ID,
              deletedAt: Date.now(),
              reason: 'recovery-replacement',
              secretManifest: cloneJson(currentManifest, null),
              secretRecords: cloneJson(currentRecords, [])
            });
          }
          records.clear();
          (item.secretRecords || []).forEach(function(record) {
            if (record.id !== SECRET_MANIFEST_BACKUP_RECORD_ID) records.put(cloneJson(record, record));
          });
          const restoredManifest = Object.assign({}, item.secretManifest || {}, {
            generation: normalizedStorageRevision(currentManifest && currentManifest.generation) + 1,
            updatedAt: Date.now()
          });
          metadataStore.put({ key: 'secretManifest', value: restoredManifest });
          records.put({ id: SECRET_MANIFEST_BACKUP_RECORD_ID, manifest: restoredManifest, updatedAt: Date.now() });
          trash.delete(trashId);
          await completion;
          return { id: SECRET_MANIFEST_BACKUP_RECORD_ID, kind: 'secret-workspace-snapshot' };
        }
        if (item.kind === 'secret-record') {
          const records = transaction.objectStore('secretRecords');
          const metadataStore = transaction.objectStore('metadata');
          const manifestRecord = await requestToPromise(metadataStore.get('secretManifest'));
          const currentManifest = manifestRecord && manifestRecord.value ? manifestRecord.value : null;
          if (!currentManifest || !item.secretManifest || currentManifest.salt !== item.secretManifest.salt) {
            throw new Error('This encrypted record belongs to a different Secret Workspace key. Restore its complete snapshot instead.');
          }
          if (await requestToPromise(records.get(item.documentId))) {
            throw new Error('A Secret Workspace record with this ID already exists.');
          }
          records.put(Object.assign({}, cloneJson(item.secretRecord, {}), {
            storageRevision: 1,
            updatedAt: Date.now()
          }));
          const nextManifest = Object.assign({}, currentManifest, {
            generation: normalizedStorageRevision(currentManifest.generation) + 1,
            documentCount: Number(currentManifest.documentCount || 0) + 1,
            updatedAt: Date.now()
          });
          metadataStore.put({ key: 'secretManifest', value: nextManifest });
          records.put({ id: SECRET_MANIFEST_BACKUP_RECORD_ID, manifest: nextManifest, updatedAt: Date.now() });
          trash.delete(trashId);
          await completion;
          return { id: item.documentId, kind: 'secret-record' };
        }

        const documents = transaction.objectStore('documents');
        const contents = transaction.objectStore('contents');
        const storedMetadata = cloneJson(item.metadata, {}) || {};
        let id = typeof storedMetadata.id === 'string' && storedMetadata.id ? storedMetadata.id : randomId('restored');
        if (await requestToPromise(documents.get(id))) {
          id = randomId('restored');
          storedMetadata.title = String(storedMetadata.title || 'Untitled') + ' (restored)';
        }
        storedMetadata.id = id;
        storedMetadata.workspaceId = storedMetadata.workspaceId === 'workspace_secret' ? 'workspace_default' : (storedMetadata.workspaceId || 'workspace_default');
        storedMetadata.folderId = null;
        storedMetadata.storageRevision = 1;
        storedMetadata.storageWriterId = this.writerId;
        storedMetadata.contentSize = utf8ByteLength(typeof item.content === 'string' ? item.content : '');
        delete storedMetadata.storageCorruption;
        documents.put(storedMetadata);
        contents.put({
          id: id,
          content: typeof item.content === 'string' ? item.content : '',
          updatedAt: Date.now(),
          storageRevision: 1,
          storageWriterId: this.writerId
        });
        trash.delete(trashId);
        await completion;
        return { id: id, kind: 'normal-document' };
      } catch (error) {
        try { transaction.abort(); } catch (_) {}
        await completion.catch(function() {});
        throw error;
      }
    }

    async setSecretManifest(manifest) {
      if (this.desktop) {
        await this.setMetadata('secretManifest', manifest);
        if (manifest) await this._storeSecretManifestBackup(manifest);
        else {
          const backupPath = await this._pathJoin(this.vaultPath, 'Secret Workspace', 'manifest-backup.json');
          if (await this._pathExists(backupPath)) await Neutralino.filesystem.remove(backupPath);
        }
      } else {
        const transaction = this.db.transaction(['metadata', 'secretRecords'], 'readwrite');
        const metadata = transaction.objectStore('metadata');
        const records = transaction.objectStore('secretRecords');
        if (manifest) {
          metadata.put({ key: 'secretManifest', value: cloneJson(manifest, null) });
          records.put({
            id: SECRET_MANIFEST_BACKUP_RECORD_ID,
            manifest: cloneJson(manifest, null),
            updatedAt: Date.now()
          });
        } else {
          metadata.delete('secretManifest');
          records.delete(SECRET_MANIFEST_BACKUP_RECORD_ID);
        }
        await transactionToPromise(transaction);
      }
      try {
        if (manifest) localStorage.setItem(LEGACY_SECRET_KEY, JSON.stringify(manifest));
        else localStorage.removeItem(LEGACY_SECRET_KEY);
      } catch (_) {}
      if (this.desktop && Neutralino.storage.removeData) {
        try {
          await Neutralino.storage.removeData(LEGACY_SECRET_KEY);
        } catch (_) {}
      }
    }

    async listSecretRecords() {
      if (this.desktop) {
        const directory = await this._pathJoin(this.vaultPath, 'Secret Workspace', 'objects');
        const entries = await Neutralino.filesystem.readDirectory(directory);
        const records = [];
        for (const entry of entries) {
          if (!entry || entry.type !== 'FILE' || !/\.mvault$/i.test(entry.entry || '')) continue;
          const path = await this._pathJoin(directory, entry.entry);
          const stored = await this._readJsonFileRecoverably(path, null);
          if (!stored) {
            throw new WorkspaceCorruptionError(entry.entry, 'An encrypted Secret Workspace record is unreadable.');
          }
          const wrapped = stored.format === 'markdown-viewer-secret-record' && stored.envelope;
          const id = wrapped && stored.id ? stored.id : entry.entry.replace(/\.mvault$/i, '');
          const envelope = wrapped ? stored.envelope : stored;
          requireSecretRecordId(id);
          if (!validateEncryptedEnvelope(envelope)) {
            throw new WorkspaceCorruptionError(id, 'An encrypted Secret Workspace record is corrupt.');
          }
          records.push({
            id: id,
            envelope: envelope,
            storageRevision: normalizedStorageRevision(wrapped && stored.storageRevision)
          });
        }
        return records;
      }
      const transaction = this.db.transaction('secretRecords', 'readonly');
      const records = await requestToPromise(transaction.objectStore('secretRecords').getAll());
      await transactionToPromise(transaction);
      return records.filter(function(record) { return record.id !== SECRET_MANIFEST_BACKUP_RECORD_ID; }).map(function(record) {
        requireSecretRecordId(record.id);
        if (!validateEncryptedEnvelope(record.envelope)) {
          throw new WorkspaceCorruptionError(record.id, 'An encrypted Secret Workspace record is corrupt.');
        }
        return {
          id: record.id,
          envelope: cloneJson(record.envelope, null),
          storageRevision: normalizedStorageRevision(record.storageRevision)
        };
      });
    }

    async replaceSecretRecords(records, manifest, options) {
      const settings = options || {};
      const source = Array.isArray(records) ? records : [];
      const seenIds = new Set();
      source.forEach(function(record) {
        if (!record || !record.envelope) {
          throw new TypeError('Secret Workspace records require a non-empty string ID and encrypted envelope.');
        }
        requireSecretRecordId(record.id);
        if (seenIds.has(record.id)) throw new TypeError('Duplicate Secret Workspace record ID: ' + record.id);
        seenIds.add(record.id);
      });
      if (this.desktop) {
        const previousRecords = await this.listSecretRecords();
        const previousManifest = await this.getSecretManifest();
        const replaceDesktopSet = async (nextRecords, nextManifest) => {
          const nextIds = new Set(nextRecords.map(function(record) { return record.id; }));
          for (const record of nextRecords) {
            const path = await this._pathJoin(
              this.vaultPath,
              'Secret Workspace',
              'objects',
              sanitizePathSegment(record.id, 'secret') + '.mvault'
            );
            await this._writeJsonFileRecoverably(path, {
              format: 'markdown-viewer-secret-record',
              id: record.id,
              storageRevision: normalizedStorageRevision(record.storageRevision) || 1,
              envelope: record.envelope,
              updatedAt: Date.now()
            });
          }
          const currentRecords = await this.listSecretRecords();
          for (const record of currentRecords) {
            if (!nextIds.has(record.id)) await this.deleteSecretRecord(record.id);
          }
          const previousGeneration = normalizedStorageRevision(previousManifest && previousManifest.generation);
          const committedManifest = Object.assign({}, nextManifest || {}, {
            generation: previousGeneration + 1,
            updatedAt: Date.now()
          });
          await this.setSecretManifest(committedManifest);
          return committedManifest;
        };
        try {
          const committedManifest = await replaceDesktopSet(source, manifest || null);
          return { manifest: committedManifest, revisions: source.map(function(record) { return { id: record.id, revision: 1 }; }) };
        } catch (error) {
          try {
            await replaceDesktopSet(previousRecords, previousManifest);
          } catch (rollbackError) {
            error.rollbackError = rollbackError;
          }
          throw error;
        }
        return;
      }

      const transaction = this.db.transaction(['secretRecords', 'metadata', 'trash'], 'readwrite');
      const completion = transactionToPromise(transaction);
      try {
        const secretRecords = transaction.objectStore('secretRecords');
        const metadata = transaction.objectStore('metadata');
        const manifestRecord = await requestToPromise(metadata.get('secretManifest'));
        const previousManifest = manifestRecord && manifestRecord.value ? manifestRecord.value : null;
        const previousRecords = (await requestToPromise(secretRecords.getAll())).filter(function(record) {
          return record.id !== SECRET_MANIFEST_BACKUP_RECORD_ID;
        });
        if (previousRecords.length && settings.preservePrevious !== false) {
          transaction.objectStore('trash').put({
            trashId: randomId('secret_snapshot'),
            kind: 'secret-workspace-snapshot',
            documentId: SECRET_MANIFEST_BACKUP_RECORD_ID,
            deletedAt: Date.now(),
            reason: settings.reason || 'secret-replacement',
            secretManifest: cloneJson(previousManifest, null),
            secretRecords: cloneJson(previousRecords, [])
          });
        }
        secretRecords.clear();
        source.forEach(function(record) {
          secretRecords.put({
            id: record.id,
            envelope: cloneJson(record.envelope, null),
            storageRevision: 1,
            updatedAt: Date.now()
          });
        });
        const committedManifest = Object.assign({}, manifest || {}, {
          generation: normalizedStorageRevision(previousManifest && previousManifest.generation) + 1,
          updatedAt: Date.now()
        });
        metadata.put({ key: 'secretManifest', value: committedManifest });
        secretRecords.put({
          id: SECRET_MANIFEST_BACKUP_RECORD_ID,
          manifest: committedManifest,
          updatedAt: Date.now()
        });
        await completion;
        manifest = committedManifest;
      } catch (error) {
        try { transaction.abort(); } catch (_) {}
        await completion.catch(function() {});
        throw error;
      }
      try {
        if (manifest) localStorage.setItem(LEGACY_SECRET_KEY, JSON.stringify(manifest));
        else localStorage.removeItem(LEGACY_SECRET_KEY);
      } catch (_) {}
      return {
        manifest: cloneJson(manifest, manifest),
        revisions: source.map(function(record) { return { id: record.id, revision: 1 }; })
      };
    }

    async applySecretRecordChanges(changes, manifest) {
      const source = changes && typeof changes === 'object' ? changes : {};
      const upserts = Array.isArray(source.upserts) ? source.upserts : [];
      const deletions = Array.isArray(source.deletions) ? source.deletions : [];
      const seenIds = new Set();
      upserts.forEach(function(record) {
        if (!record || !record.envelope) {
          throw new TypeError('Secret Workspace updates require a valid encrypted record.');
        }
        requireSecretRecordId(record.id);
        if (seenIds.has(record.id)) throw new TypeError('Duplicate Secret Workspace record ID: ' + record.id);
        seenIds.add(record.id);
      });
      deletions.forEach(function(record) {
        if (!record || seenIds.has(record.id)) {
          throw new TypeError('Secret Workspace deletions require a unique record ID.');
        }
        requireSecretRecordId(record.id);
        seenIds.add(record.id);
      });

      if (this.desktop) {
        const previousRecords = await this.listSecretRecords();
        const previousManifest = await this.getSecretManifest();
        const previousById = new Map(previousRecords.map(function(record) { return [record.id, record]; }));
        for (const change of upserts.concat(deletions)) {
          const stored = previousById.get(change.id);
          if (normalizedStorageRevision(stored && stored.storageRevision) !== normalizedStorageRevision(change.expectedRevision)) {
            throw new WorkspaceSecretConflictError(change.id, change, stored || null);
          }
        }
        try {
          for (const record of upserts) {
            const path = await this._pathJoin(this.vaultPath, 'Secret Workspace', 'objects', sanitizePathSegment(record.id, 'secret') + '.mvault');
            await this._writeJsonFileRecoverably(path, {
              format: 'markdown-viewer-secret-record',
              id: record.id,
              storageRevision: normalizedStorageRevision(record.expectedRevision) + 1,
              envelope: cloneJson(record.envelope, null),
              updatedAt: Date.now()
            });
          }
          for (const deletion of deletions) {
            const stored = previousById.get(deletion.id);
            if (stored) {
              const trashPath = await this._pathJoin(
                this.vaultPath,
                INTERNAL_DIR,
                'trash',
                Date.now() + '-' + randomId('secret_record') + '.secret.json'
              );
              await this._writeJsonFileRecoverably(trashPath, {
                version: 1,
                trashId: randomId('secret_record'),
                kind: 'secret-record',
                documentId: deletion.id,
                deletedAt: Date.now(),
                secretManifest: cloneJson(previousManifest, null),
                secretRecord: cloneJson(stored, null),
                updatedAt: Date.now()
              });
            }
            await this.deleteSecretRecord(deletion.id);
          }
          const remaining = await this.listSecretRecords();
          const committedManifest = Object.assign({}, manifest || {}, {
            generation: normalizedStorageRevision(previousManifest && previousManifest.generation) + 1,
            documentCount: remaining.filter(function(record) { return record.id !== SECRET_FOLDER_RECORD_ID; }).length,
            folderCount: Number(manifest && manifest.folderCount) || 0,
            updatedAt: Date.now()
          });
          await this.setSecretManifest(committedManifest);
          return {
            manifest: committedManifest,
            revisions: upserts.map(function(record) {
              return { id: record.id, revision: normalizedStorageRevision(record.expectedRevision) + 1 };
            })
          };
        } catch (error) {
          try { await this.replaceSecretRecords(previousRecords, previousManifest, { preservePrevious: false }); } catch (rollbackError) {
            error.rollbackError = rollbackError;
          }
          throw error;
        }
      }

      const transaction = this.db.transaction(['secretRecords', 'metadata', 'trash'], 'readwrite');
      const completion = transactionToPromise(transaction);
      const records = transaction.objectStore('secretRecords');
      const metadata = transaction.objectStore('metadata');
      const revisions = [];
      try {
        const manifestRecord = await requestToPromise(metadata.get('secretManifest'));
        const previousManifest = manifestRecord && manifestRecord.value ? manifestRecord.value : null;
        for (const change of upserts.concat(deletions)) {
          const stored = await requestToPromise(records.get(change.id));
          if (normalizedStorageRevision(stored && stored.storageRevision) !== normalizedStorageRevision(change.expectedRevision)) {
            transaction.abort();
            await completion.catch(function() {});
            throw new WorkspaceSecretConflictError(change.id, change, stored || null);
          }
          if (upserts.includes(change)) {
            const revision = normalizedStorageRevision(change.expectedRevision) + 1;
            records.put({
              id: change.id,
              envelope: cloneJson(change.envelope, null),
              storageRevision: revision,
              updatedAt: Date.now()
            });
            revisions.push({ id: change.id, revision: revision });
          } else if (stored) {
            transaction.objectStore('trash').put({
              trashId: randomId('secret_trash'),
              kind: 'secret-record',
              documentId: change.id,
              deletedAt: Date.now(),
              secretManifest: cloneJson(previousManifest, null),
              secretRecord: cloneJson(stored, null)
            });
            records.delete(change.id);
          }
        }
        const allRecords = (await requestToPromise(records.getAll())).filter(function(record) {
          return record.id !== SECRET_MANIFEST_BACKUP_RECORD_ID;
        });
        const committedManifest = Object.assign({}, manifest || {}, {
          generation: normalizedStorageRevision(previousManifest && previousManifest.generation) + 1,
          documentCount: allRecords.filter(function(record) { return record.id !== SECRET_FOLDER_RECORD_ID; }).length,
          updatedAt: Date.now()
        });
        metadata.put({ key: 'secretManifest', value: committedManifest });
        records.put({
          id: SECRET_MANIFEST_BACKUP_RECORD_ID,
          manifest: committedManifest,
          updatedAt: Date.now()
        });
        await completion;
        try { localStorage.setItem(LEGACY_SECRET_KEY, JSON.stringify(committedManifest)); } catch (_) {}
        return { manifest: committedManifest, revisions: revisions };
      } catch (error) {
        try { transaction.abort(); } catch (_) {}
        await completion.catch(function() {});
        throw error;
      }
    }

    async saveSecretRecord(id, envelope) {
      requireSecretRecordId(id);
      if (!validateEncryptedEnvelope(envelope)) throw new TypeError('The encrypted record is invalid.');
      if (this.desktop) {
        const path = await this._pathJoin(this.vaultPath, 'Secret Workspace', 'objects', sanitizePathSegment(id, 'secret') + '.mvault');
        await this._writeJsonFile(path, envelope);
        return;
      }
      const transaction = this.db.transaction('secretRecords', 'readwrite');
      transaction.objectStore('secretRecords').put({ id: id, envelope: envelope });
      await transactionToPromise(transaction);
    }

    async deleteSecretRecord(id) {
      requireSecretRecordId(id);
      if (this.desktop) {
        const path = await this._pathJoin(this.vaultPath, 'Secret Workspace', 'objects', sanitizePathSegment(id, 'secret') + '.mvault');
        if (await this._pathExists(path)) await Neutralino.filesystem.remove(path);
        return;
      }
      const transaction = this.db.transaction('secretRecords', 'readwrite');
      transaction.objectStore('secretRecords').delete(id);
      await transactionToPromise(transaction);
    }

    async clearSecretRecords() {
      if (this.desktop) {
        const records = await this.listSecretRecords();
        const manifest = await this.getSecretManifest();
        if (records.length) {
          const trashPath = await this._pathJoin(
            this.vaultPath,
            INTERNAL_DIR,
            'trash',
            Date.now() + '-' + randomId('secret_snapshot') + '.secret.json'
          );
          await this._writeJsonFileRecoverably(trashPath, {
            version: 1,
            trashId: randomId('secret_snapshot'),
            kind: 'secret-workspace-snapshot',
            documentId: SECRET_MANIFEST_BACKUP_RECORD_ID,
            deletedAt: Date.now(),
            secretManifest: cloneJson(manifest, null),
            secretRecords: cloneJson(records, []),
            updatedAt: Date.now()
          });
        }
        try {
          for (const record of records) await this.deleteSecretRecord(record.id);
          await this.setSecretManifest(null);
        } catch (error) {
          try { await this.replaceSecretRecords(records, manifest, { preservePrevious: false }); } catch (rollbackError) {
            error.rollbackError = rollbackError;
          }
          throw error;
        }
      } else {
        const transaction = this.db.transaction(['secretRecords', 'metadata', 'trash'], 'readwrite');
        const records = transaction.objectStore('secretRecords');
        const metadata = transaction.objectStore('metadata');
        const manifestRecord = await requestToPromise(metadata.get('secretManifest'));
        const manifest = manifestRecord && manifestRecord.value ? manifestRecord.value : null;
        const existing = (await requestToPromise(records.getAll())).filter(function(record) {
          return record.id !== SECRET_MANIFEST_BACKUP_RECORD_ID;
        });
        if (existing.length) {
          transaction.objectStore('trash').put({
            trashId: randomId('secret_snapshot'),
            kind: 'secret-workspace-snapshot',
            documentId: SECRET_MANIFEST_BACKUP_RECORD_ID,
            deletedAt: Date.now(),
            reason: 'secret-reset',
            secretManifest: cloneJson(manifest, null),
            secretRecords: cloneJson(existing, [])
          });
        }
        records.clear();
        metadata.delete('secretManifest');
        await transactionToPromise(transaction);
      }
      try { localStorage.removeItem(LEGACY_SECRET_KEY); } catch (_) {}
    }

    async getWorkspaceUsage() {
      if (this.desktop) {
        let total = 0;
        const walk = async (directory) => {
          let entries = [];
          try {
            entries = await Neutralino.filesystem.readDirectory(directory);
          } catch (_) {
            return;
          }
          for (const entry of entries) {
            if (!entry || !entry.entry) continue;
            const path = await this._pathJoin(directory, entry.entry);
            if (entry.type === 'DIRECTORY') {
              await walk(path);
            } else if (entry.type === 'FILE') {
              try {
                const stats = await Neutralino.filesystem.getStats(path);
                total += Number(stats && stats.size) || 0;
              } catch (_) {}
            }
          }
        };
        await walk(this.vaultPath);
        return total;
      }

      const storeNames = ['documents', 'contents', 'metadata', 'secretRecords', 'trash', 'journals'];
      let total = 0;
      for (const storeName of storeNames) {
        const transaction = this.db.transaction(storeName, 'readonly');
        const completion = transactionToPromise(transaction);
        const store = transaction.objectStore(storeName);
        await new Promise(function(resolve, reject) {
          const request = store.openCursor();
          request.onsuccess = function() {
            const cursor = request.result;
            if (!cursor) {
              resolve();
              return;
            }
            total += utf8ByteLength(JSON.stringify(cursor.value));
            cursor.continue();
          };
          request.onerror = function() {
            reject(request.error || new Error('Unable to calculate workspace storage usage.'));
          };
        });
        await completion;
      }
      return total;
    }

    async createBackupData(options) {
      const settings = options || {};
      const includeSecure = settings.includeSecure === true;
      const onProgress = typeof settings.onProgress === 'function' ? settings.onProgress : function() {};
      const organization = cloneJson(settings.organization, null) || await this.getDocumentOrganization() || {
        version: 1,
        workspaces: [],
        folders: [],
        ui: {}
      };
      const storedMetadata = await this.listDocumentMetadata();
      const overrideDocuments = Array.isArray(settings.documentOverrides)
        ? settings.documentOverrides.filter(function(item) {
          return item && item.id && item.temporary !== true && item.kind !== 'share-snapshot' && item.workspaceId !== 'workspace_secret';
        })
        : [];
      const overridesById = new Map(overrideDocuments.map(function(item) { return [item.id, item]; }));
      const metadataById = new Map(storedMetadata.map(function(item) { return [item.id, item]; }));
      overrideDocuments.forEach(function(item) {
        const existing = metadataById.get(item.id) || {};
        metadataById.set(item.id, Object.assign({}, existing, item));
      });
      const metadata = Array.from(metadataById.values());
      const secretRecords = includeSecure ? await this.listSecretRecords() : [];
      const total = metadata.length + secretRecords.length;
      const documents = [];
      let processed = 0;

      for (const item of metadata) {
        const override = overridesById.get(item.id);
        const content = override && override.contentLoaded !== false && typeof override.content === 'string'
          ? override.content
          : await this.loadDocumentContent(item.id);
        documents.push({
          metadata: metadataFromTab(override ? Object.assign({}, item, override) : item),
          path: await this._backupDocumentRelativePath(item, organization),
          content: content
        });
        processed += 1;
        onProgress(processed, total, item.title || 'Untitled');
      }

      const secure = [];
      for (const record of secretRecords) {
        secure.push({
          id: record.id,
          envelope: cloneJson(record.envelope, null)
        });
        processed += 1;
        onProgress(processed, total, 'Encrypted Secret Workspace record');
      }

      return {
        organization: cloneJson(organization, {}),
        documents: documents,
        secretManifest: includeSecure ? cloneJson(await this.getSecretManifest(), null) : null,
        secretRecords: secure,
        includesSecureWorkspace: includeSecure,
        totalEntries: total
      };
    }

    _normalizeBackupForRestore(backup) {
      const source = backup && typeof backup === 'object' ? backup : {};
      const organization = cloneJson(source.organization, {
        version: 1,
        workspaces: [],
        folders: [],
        ui: {}
      });
      const documents = Array.isArray(source.documents) ? source.documents : [];
      const secretRecords = Array.isArray(source.secretRecords) ? source.secretRecords : [];
      const seenDocumentIds = new Set();
      const tabs = documents.map(function(item) {
        const metadata = item && item.metadata && typeof item.metadata === 'object'
          ? cloneJson(item.metadata, {})
          : {};
        requireDocumentId(metadata.id);
        if (seenDocumentIds.has(metadata.id)) throw new TypeError('Duplicate document ID: ' + metadata.id);
        seenDocumentIds.add(metadata.id);
        metadata.content = typeof item.content === 'string' ? item.content : '';
        metadata.contentLoaded = true;
        delete metadata.storageRevision;
        delete metadata.storageWriterId;
        delete metadata._storageRevision;
        delete metadata._storageWriterId;
        return metadata;
      });
      const seenSecretIds = new Set();
      secretRecords.forEach(function(record) {
        if (!record || !validateEncryptedEnvelope(record.envelope)) {
          throw new TypeError('The backup contains an invalid encrypted record.');
        }
        requireSecretRecordId(record.id);
        if (seenSecretIds.has(record.id)) throw new TypeError('Duplicate encrypted record ID: ' + record.id);
        seenSecretIds.add(record.id);
      });
      const secretManifest = cloneJson(source.secretManifest, null);
      if (secretRecords.length && (
        !secretManifest || base64ByteLength(secretManifest.salt) < 16 ||
        !Number.isSafeInteger(Number(secretManifest.iterations)) || Number(secretManifest.iterations) < 100000
      )) {
        throw new TypeError('The backup contains an invalid Secret Workspace manifest.');
      }
      return {
        organization: organization,
        documents: documents,
        tabs: tabs,
        secretRecords: secretRecords,
        secretManifest: secretManifest
      };
    }

    async _restoreBrowserBackupDataAtomically(normalized, onProgress) {
      const storeNames = ['documents', 'contents', 'metadata', 'secretRecords', 'trash', 'journals'];
      const transaction = this.db.transaction(storeNames, 'readwrite');
      const completion = transactionToPromise(transaction);
      const documents = transaction.objectStore('documents');
      const contents = transaction.objectStore('contents');
      const metadata = transaction.objectStore('metadata');
      const secretRecords = transaction.objectStore('secretRecords');
      const trash = transaction.objectStore('trash');
      try {
        const existingMetadata = await requestToPromise(documents.getAll());
        for (const existing of existingMetadata) {
          const content = await requestToPromise(contents.get(existing.id));
          trash.put({
            trashId: randomId('trash'),
            documentId: existing.id,
            deletedAt: Date.now(),
            reason: 'backup-replacement',
            metadata: existing,
            content: content && typeof content.content === 'string' ? content.content : ''
          });
        }
        const previousSecretManifestRecord = await requestToPromise(metadata.get('secretManifest'));
        const previousSecretManifest = previousSecretManifestRecord && previousSecretManifestRecord.value
          ? previousSecretManifestRecord.value
          : null;
        const previousSecretRecords = (await requestToPromise(secretRecords.getAll())).filter(function(record) {
          return record.id !== SECRET_MANIFEST_BACKUP_RECORD_ID;
        });
        if (previousSecretRecords.length) {
          trash.put({
            trashId: randomId('secret_snapshot'),
            kind: 'secret-workspace-snapshot',
            documentId: SECRET_MANIFEST_BACKUP_RECORD_ID,
            deletedAt: Date.now(),
            reason: 'backup-replacement',
            secretManifest: cloneJson(previousSecretManifest, null),
            secretRecords: cloneJson(previousSecretRecords, [])
          });
        }
        documents.clear();
        contents.clear();
        secretRecords.clear();
        transaction.objectStore('journals').clear();
        metadata.put({ key: 'documentOrganization', value: Object.assign({}, normalized.organization, {
          _storageRevision: 1,
          _storageWriterId: this.writerId
        }) });
        const restoredSecretManifest = normalized.secretManifest
          ? Object.assign({}, normalized.secretManifest, {
              generation: normalizedStorageRevision(previousSecretManifest && previousSecretManifest.generation) + 1,
              updatedAt: Date.now()
            })
          : null;
        if (restoredSecretManifest) {
          metadata.put({ key: 'secretManifest', value: restoredSecretManifest });
          secretRecords.put({
            id: SECRET_MANIFEST_BACKUP_RECORD_ID,
            manifest: restoredSecretManifest,
            updatedAt: Date.now()
          });
        } else {
          metadata.delete('secretManifest');
        }

        normalized.tabs.forEach((tab) => {
          const storedMetadata = metadataFromTab(tab);
          storedMetadata.storageRevision = 1;
          storedMetadata.storageWriterId = this.writerId;
          storedMetadata.contentSize = utf8ByteLength(tab.content);
          documents.put(storedMetadata);
          contents.put({
            id: tab.id,
            content: tab.content,
            updatedAt: Date.now(),
            storageRevision: 1,
            storageWriterId: this.writerId
          });
        });
        normalized.secretRecords.forEach(function(record) {
          secretRecords.put({
            id: record.id,
            envelope: cloneJson(record.envelope, null),
            storageRevision: 1,
            updatedAt: Date.now()
          });
        });
        await completion;
      } catch (error) {
        try { transaction.abort(); } catch (_) {}
        await completion.catch(function() {});
        throw error;
      }
      this._normalContentCache.clear();
      this._organizationSnapshot = JSON.stringify(normalized.organization);
      normalized.tabs.forEach((tab) => {
        tab._storageRevision = 1;
        tab._persistedContent = tab.content;
        this._cacheContent(tab.id, tab.content);
      });
      let processed = 0;
      const total = normalized.tabs.length + normalized.secretRecords.length;
      normalized.tabs.forEach(function(tab) {
        processed += 1;
        onProgress(processed, total, tab.title || 'Untitled');
      });
      normalized.secretRecords.forEach(function() {
        processed += 1;
        onProgress(processed, total, 'Encrypted Secret Workspace record');
      });
    }

    async _restoreDesktopBackupData(normalized, onProgress) {
      await this.clearNormalDocuments();
      await this.saveDocumentOrganization(normalized.organization);
      await this.saveDocuments(normalized.tabs, normalized.organization, {
        changedIds: normalized.tabs.map(function(tab) { return tab.id; }),
        forceContent: true
      });
      await this.clearSecretRecords();
      let processed = 0;
      const total = normalized.tabs.length + normalized.secretRecords.length;
      for (const tab of normalized.tabs) {
        processed += 1;
        onProgress(processed, total, tab.title || 'Untitled');
      }
      for (const record of normalized.secretRecords) {
        await this.saveSecretRecord(record.id, record.envelope);
        processed += 1;
        onProgress(processed, total, 'Encrypted Secret Workspace record');
      }
      await this.setSecretManifest(normalized.secretManifest);
    }

    async restoreBackupData(backup, options) {
      const settings = options || {};
      const onProgress = typeof settings.onProgress === 'function' ? settings.onProgress : function() {};
      const normalized = this._normalizeBackupForRestore(backup);
      if (!this.desktop) {
        await this._restoreBrowserBackupDataAtomically(normalized, onProgress);
      } else {
        const rollbackData = await this.createBackupData({
          includeSecure: true,
          organization: this.vaultOrganization
        });
        const rollback = this._normalizeBackupForRestore(rollbackData);
        try {
          await this._restoreDesktopBackupData(normalized, onProgress);
        } catch (error) {
          try {
            await this._restoreDesktopBackupData(rollback, function() {});
          } catch (rollbackError) {
            error.rollbackError = rollbackError;
          }
          throw error;
        }
      }
      return {
        normalDocumentCount: normalized.tabs.length,
        secretRecordCount: normalized.secretRecords.length
      };
    }

    async resetAllData() {
      this._normalContentCache.clear();
      if (this.desktop) {
        const manifestPath = await this._pathJoin(this.vaultPath, INTERNAL_DIR, 'vault.json');
        const manifest = await this._readJsonFile(manifestPath, null);
        if (!manifest || manifest.format !== 'markdown-viewer-vault') {
          throw new Error('The active folder is not a valid Markdown Viewer Vault.');
        }
        const ownedPaths = [
          await this._pathJoin(this.vaultPath, 'Workspace'),
          await this._pathJoin(this.vaultPath, 'Secret Workspace'),
          await this._pathJoin(this.vaultPath, INTERNAL_DIR)
        ];
        const normalizedVault = normalizePathSeparators(this.vaultPath).toLowerCase().replace(/\/+$/, '') + '/';
        for (const path of ownedPaths) {
          const normalizedPath = normalizePathSeparators(path).toLowerCase();
          if (!normalizedPath.startsWith(normalizedVault)) {
            throw new Error('Refusing to reset a path outside the active vault.');
          }
          if (await this._pathExists(path)) await Neutralino.filesystem.remove(path);
        }
        this.ready = false;
        this.vaultId = '';
        this.vaultIndex = { version: VAULT_FORMAT_VERSION, documents: [], updatedAt: 0 };
        this.vaultOrganization = null;
        this.desktopSettings = {};
        this._organizationSnapshot = '';
        await this._initDesktop();
        this.ready = true;
        return;
      }

      const storeNames = ['documents', 'contents', 'metadata', 'secretRecords', 'trash', 'journals'];
      const transaction = this.db.transaction(storeNames, 'readwrite');
      storeNames.forEach(function(storeName) {
        transaction.objectStore(storeName).clear();
      });
      await transactionToPromise(transaction);
      this.vaultId = randomId('vault');
      this._organizationSnapshot = '';
      await this.setMetadata('vaultId', this.vaultId);
    }

    async getStorageEstimate() {
      if (this.desktop) {
        return { usage: await this.getWorkspaceUsage(), quota: null, persistent: true };
      }
      let estimate = {};
      let persistent = false;
      if (navigator.storage && typeof navigator.storage.estimate === 'function') {
        estimate = await navigator.storage.estimate();
      }
      if (navigator.storage && typeof navigator.storage.persisted === 'function') {
        persistent = await navigator.storage.persisted();
      }
      return {
        usage: Number.isFinite(estimate.usage) ? estimate.usage : null,
        quota: Number.isFinite(estimate.quota) ? estimate.quota : null,
        persistent: persistent
      };
    }

    async requestPersistentStorage() {
      if (this.desktop) return true;
      if (!navigator.storage || typeof navigator.storage.persist !== 'function') return false;
      const request = Promise.resolve()
        .then(function() { return navigator.storage.persist(); })
        .then(Boolean)
        .catch(function() { return false; });
      return new Promise(function(resolve) {
        let settled = false;
        const finish = function(value) {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          resolve(Boolean(value));
        };
        const timeoutId = setTimeout(function() { finish(false); }, 1500);
        request.then(finish);
      });
    }

    async openVaultFolder() {
      if (!this.desktop || !this.vaultPath) return false;
      await Neutralino.os.open(this.vaultPath);
      return true;
    }

    getStatus() {
      return {
        backend: this.desktop ? 'Desktop vault' : 'Browser IndexedDB',
        desktop: this.desktop,
        vaultName: VAULT_NAME,
        vaultPath: this.vaultPath,
        vaultId: this.vaultId,
        documentCount: this.desktop ? this.vaultIndex.documents.length : null,
        ready: this.ready,
        lastError: this.lastError
      };
    }
  }

  MarkdownWorkspaceStorage.TRASH_RETENTION_DAYS = TRASH_RETENTION_DAYS;
  MarkdownWorkspaceStorage.TRASH_RETENTION_MS = TRASH_RETENTION_MS;
  window.MarkdownWorkspaceStorage = MarkdownWorkspaceStorage;
  window.MARKDOWN_VIEWER_VAULT_NAME = VAULT_NAME;
  window.MARKDOWN_VIEWER_SECRET_FOLDER_RECORD_ID = SECRET_FOLDER_RECORD_ID;
  window.MARKDOWN_VIEWER_TRASH_RETENTION_DAYS = TRASH_RETENTION_DAYS;
})();
