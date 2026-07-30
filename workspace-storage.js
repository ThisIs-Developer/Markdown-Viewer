(function () {
  'use strict';

  const DATABASE_NAME = 'markdownViewerWorkspace';
  const DATABASE_VERSION = 2;
  const VAULT_FORMAT_VERSION = 1;
  const VAULT_NAME = 'Markdown Viewer Vault';
  const LEGACY_VAULT_LOCATOR_KEY = 'markdownViewerVaultLocator';
  const LEGACY_PORTABLE_LOCATOR_FILE = '.markdown-viewer-vault-locator.json';
  const LEGACY_TABS_KEY = 'markdownViewerTabs';
  const LEGACY_SECRET_KEY = 'markdownViewerSecretWorkspace';
  const INTERNAL_DIR = '.markdown-viewer';
  const SECRET_FOLDER_RECORD_ID = '__folders__';

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
      this.lastError = null;
      this._desktopIndexWrite = Promise.resolve();
      this._normalContentCache = new Map();
      this._maxContentCacheEntries = 20;
    }

    async init() {
      if (this.ready) return this;
      if (this.desktop) await this._initDesktop();
      else await this._initBrowser();
      await this._migrateLegacyNormalDocuments();
      this.ready = true;
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
        };
        request.onsuccess = function () { resolve(request.result); };
        request.onerror = function () { reject(request.error || new Error('Unable to open workspace storage')); };
        request.onblocked = function () { reject(new Error('Workspace storage upgrade is blocked by another tab.')); };
      });
      this.vaultId = await this.getMetadata('vaultId');
      if (!this.vaultId) {
        this.vaultId = randomId('vault');
        await this.setMetadata('vaultId', this.vaultId);
      }
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
      await Neutralino.filesystem.writeFile(path, JSON.stringify(value, null, 2));
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
      this.vaultOrganization = await this._readJsonFile(organizationPath, null);
      this._organizationSnapshot = this.vaultOrganization ? JSON.stringify(this.vaultOrganization) : '';
      const indexPath = await this._pathJoin(internalPath, 'index.json');
      const loadedIndex = await this._readJsonFile(indexPath, null);
      if (loadedIndex && Array.isArray(loadedIndex.documents)) {
        this.vaultIndex = loadedIndex;
      } else {
        this.vaultIndex = await this._rebuildDesktopIndex(workspacePath);
        await this._writeJsonFile(indexPath, this.vaultIndex);
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
      } catch (_) {
        return;
      }
      const normalizedVault = normalizePathSeparators(this.vaultPath).toLowerCase().replace(/\/+$/, '') + '/';
      for (const entry of entries) {
        if (!entry || entry.type !== 'FILE' || !/\.json$/i.test(entry.entry || '')) continue;
        const recordPath = await this._pathJoin(journalPath, entry.entry);
        const record = await this._readJsonFile(recordPath, null);
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
          try { await Neutralino.filesystem.remove(temporary); } catch (_) {}
        }
        try { await Neutralino.filesystem.remove(recordPath); } catch (_) {}
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
      if (existing.length) return;
      let legacy = [];
      try {
        legacy = JSON.parse(localStorage.getItem(LEGACY_TABS_KEY) || '[]');
      } catch (_) {}
      if (!Array.isArray(legacy) || !legacy.length) return;
      const normal = legacy.filter(function (tab) {
        return tab && tab.temporary !== true && tab.kind !== 'share-snapshot' && tab.workspaceId !== 'workspace_secret';
      });
      if (!normal.length) return;
      await this.saveDocuments(normal.map(function (tab) {
        const copy = Object.assign({}, tab);
        copy.contentLoaded = true;
        return copy;
      }), null, { fullSnapshot: true, forceContent: true });
      await this.setMetadata('legacyMigration', {
        version: 1,
        completedAt: Date.now(),
        documentCount: normal.length
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
          const tab = Object.assign({}, item);
          tab.contentLoaded = false;
          tab.content = undefined;
          tab._vaultRelativePath = item.vaultRelativePath || '';
          return tab;
        });
      }
      const transaction = this.db.transaction('documents', 'readonly');
      const records = await requestToPromise(transaction.objectStore('documents').getAll());
      await transactionToPromise(transaction);
      return records.map(function (item) {
        const tab = Object.assign({}, item);
        tab.contentLoaded = false;
        tab.content = undefined;
        return tab;
      });
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
      if (this._normalContentCache.has(id)) {
        const content = this._normalContentCache.get(id);
        this._cacheContent(id, content);
        return content;
      }
      let content = '';
      if (this.desktop) {
        const metadata = this.vaultIndex.documents.find(function (item) { return item.id === id; });
        if (!metadata || !metadata.vaultRelativePath) return '';
        const path = await this._desktopResolveVaultRelativePath(metadata.vaultRelativePath);
        content = await Neutralino.filesystem.readFile(path);
      } else {
        const transaction = this.db.transaction('contents', 'readonly');
        const record = await requestToPromise(transaction.objectStore('contents').get(id));
        await transactionToPromise(transaction);
        content = record && typeof record.content === 'string' ? record.content : '';
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
      const suffix = String(tab.id || randomId('doc')).replace(/[^a-z0-9]/gi, '').slice(-8) || Date.now().toString(36);
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
      await this._writeJsonFile(indexPath, this.vaultIndex);
    }

    async _desktopMoveToTrash(metadata) {
      if (!metadata || !metadata.vaultRelativePath) return;
      const source = await this._desktopResolveVaultRelativePath(metadata.vaultRelativePath);
      if (!(await this._pathExists(source))) return;
      const trashName = Date.now() + '-' + sanitizePathSegment(metadata.title, 'Untitled') + '.md';
      const destination = await this._pathJoin(this.vaultPath, INTERNAL_DIR, 'trash', trashName);
      await Neutralino.filesystem.move(source, destination);
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

    async _desktopWriteDocumentSafely(tab, fullPath, content) {
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
        temporary: temporaryPath,
        startedAt: Date.now()
      });
      await Neutralino.filesystem.writeFile(fullPath, content);
      try { await Neutralino.filesystem.remove(temporaryPath); } catch (_) {}
      try { await Neutralino.filesystem.remove(journalPath); } catch (_) {}
    }

    async _desktopSaveDocument(tab, organization, forceContent) {
      const existing = this.vaultIndex.documents.find(function (item) { return item.id === tab.id; });
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
          await this._desktopWriteDocumentSafely(tab, fullPath, content);
          tab._persistedContent = content;
          this._cacheContent(tab.id, content);
        }
      }
      const metadata = metadataFromTab(tab);
      metadata.vaultRelativePath = relativePath;
      metadata.contentSize = typeof tab.content === 'string'
        ? new TextEncoder().encode(tab.content).byteLength
        : Number(existing && existing.contentSize) || 0;
      if (existing) Object.assign(existing, metadata);
      else this.vaultIndex.documents.push(metadata);
      tab._vaultRelativePath = relativePath;
    }

    async saveDocuments(tabs, organization, options) {
      const settings = options || {};
      const source = (tabs || []).filter(function (tab) {
        return tab && tab.id && tab.temporary !== true && tab.kind !== 'share-snapshot' && tab.workspaceId !== 'workspace_secret';
      });
      const changedIds = settings.changedIds ? new Set(settings.changedIds) : null;
      const selected = changedIds ? source.filter(function (tab) { return changedIds.has(tab.id); }) : source;
      if (this.desktop) {
        for (const tab of selected) {
          await this._desktopSaveDocument(tab, organization, settings.forceContent === true);
        }
        if (settings.fullSnapshot) {
          const currentIds = new Set(source.map(function (tab) { return tab.id; }));
          const removed = this.vaultIndex.documents.filter(function (item) { return !currentIds.has(item.id); });
          for (const item of removed) await this._desktopMoveToTrash(item);
          this.vaultIndex.documents = this.vaultIndex.documents.filter(function (item) { return currentIds.has(item.id); });
        }
        this._desktopIndexWrite = this._desktopIndexWrite.catch(function () {}).then(() => this._desktopWriteIndex());
        await this._desktopIndexWrite;
        return true;
      }

      const transaction = this.db.transaction(['documents', 'contents', 'trash'], 'readwrite');
      const documents = transaction.objectStore('documents');
      const contents = transaction.objectStore('contents');
      const trash = transaction.objectStore('trash');
      selected.forEach((tab) => {
        const metadata = metadataFromTab(tab);
        if (settings.forceContent || tab.contentLoaded !== false) {
          const content = typeof tab.content === 'string' ? tab.content : '';
          metadata.contentSize = utf8ByteLength(content);
          contents.put({ id: tab.id, content: content, updatedAt: Date.now() });
          tab._persistedContent = content;
          this._cacheContent(tab.id, content);
        }
        documents.put(metadata);
      });
      if (settings.fullSnapshot) {
        const currentIds = new Set(source.map(function (tab) { return tab.id; }));
        const existingIds = await requestToPromise(documents.getAllKeys());
        for (const id of existingIds) {
          if (!currentIds.has(id)) {
            const metadata = await requestToPromise(documents.get(id));
            const content = await requestToPromise(contents.get(id));
            trash.put({
              trashId: randomId('trash'),
              documentId: id,
              deletedAt: Date.now(),
              metadata: metadata || { id: id },
              content: content && typeof content.content === 'string' ? content.content : ''
            });
            documents.delete(id);
            contents.delete(id);
          }
        }
      }
      await transactionToPromise(transaction);
      return true;
    }

    async getDocumentOrganization() {
      if (this.desktop) return cloneJson(this.vaultOrganization, null);
      return this.getMetadata('documentOrganization');
    }

    async saveDocumentOrganization(organization) {
      const safeOrganization = cloneJson(organization, null);
      if (!safeOrganization) return;
      const serialized = JSON.stringify(safeOrganization);
      if (serialized === this._organizationSnapshot) return;
      if (this.desktop) {
        this.vaultOrganization = safeOrganization;
        await this._desktopEnsureOrganizationFolders(safeOrganization);
        const organizationPath = await this._pathJoin(this.vaultPath, INTERNAL_DIR, 'organization.json');
        await this._writeJsonFile(organizationPath, safeOrganization);
        this._organizationSnapshot = serialized;
        return;
      }
      await this.setMetadata('documentOrganization', safeOrganization);
      this._organizationSnapshot = serialized;
    }

    async deleteDocument(id) {
      this._normalContentCache.delete(id);
      if (this.desktop) {
        const metadata = this.vaultIndex.documents.find(function (item) { return item.id === id; });
        if (metadata) await this._desktopMoveToTrash(metadata);
        this.vaultIndex.documents = this.vaultIndex.documents.filter(function (item) { return item.id !== id; });
        await this._desktopWriteIndex();
        return;
      }
      const transaction = this.db.transaction(['documents', 'contents', 'trash'], 'readwrite');
      const documents = transaction.objectStore('documents');
      const contents = transaction.objectStore('contents');
      const metadata = await requestToPromise(documents.get(id));
      const content = await requestToPromise(contents.get(id));
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
        for (const item of existing) await this._desktopMoveToTrash(item);
        this.vaultIndex.documents = [];
        await this._desktopWriteIndex();
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
      if (stored) return stored;
      try {
        const legacy = JSON.parse(localStorage.getItem(LEGACY_SECRET_KEY) || 'null');
        return legacy || null;
      } catch (_) {
        return null;
      }
    }

    async setSecretManifest(manifest) {
      await this.setMetadata('secretManifest', manifest);
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
          const envelope = await this._readJsonFile(path, null);
          if (envelope) records.push({ id: entry.entry.replace(/\.mvault$/i, ''), envelope: envelope });
        }
        return records;
      }
      const transaction = this.db.transaction('secretRecords', 'readonly');
      const records = await requestToPromise(transaction.objectStore('secretRecords').getAll());
      await transactionToPromise(transaction);
      return records;
    }

    async saveSecretRecord(id, envelope) {
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
        for (const record of records) await this.deleteSecretRecord(record.id);
      } else {
        const transaction = this.db.transaction('secretRecords', 'readwrite');
        transaction.objectStore('secretRecords').clear();
        await transactionToPromise(transaction);
      }
      await this.setSecretManifest(null);
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

      const storeNames = ['documents', 'contents', 'metadata', 'secretRecords', 'trash'];
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

    async restoreBackupData(backup, options) {
      const source = backup && typeof backup === 'object' ? backup : {};
      const settings = options || {};
      const onProgress = typeof settings.onProgress === 'function' ? settings.onProgress : function() {};
      const organization = cloneJson(source.organization, {
        version: 1,
        workspaces: [],
        folders: [],
        ui: {}
      });
      const documents = Array.isArray(source.documents) ? source.documents : [];
      const secretRecords = Array.isArray(source.secretRecords) ? source.secretRecords : [];
      const total = documents.length + secretRecords.length;
      let processed = 0;

      await this.saveDocumentOrganization(organization);
      const tabs = documents.map(function(item) {
        const metadata = item && item.metadata && typeof item.metadata === 'object'
          ? cloneJson(item.metadata, {})
          : {};
        metadata.content = typeof item.content === 'string' ? item.content : '';
        metadata.contentLoaded = true;
        return metadata;
      });
      await this.saveDocuments(tabs, organization, {
        fullSnapshot: true,
        forceContent: true
      });
      for (const item of documents) {
        processed += 1;
        onProgress(processed, total, item && item.metadata && item.metadata.title || 'Untitled');
      }

      await this.clearSecretRecords();
      for (const record of secretRecords) {
        if (!record || !record.id || !record.envelope) continue;
        await this.saveSecretRecord(record.id, record.envelope);
        processed += 1;
        onProgress(processed, total, 'Encrypted Secret Workspace record');
      }
      await this.setSecretManifest(source.secretManifest || null);
      return {
        normalDocumentCount: tabs.length,
        secretRecordCount: secretRecords.length
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

      const storeNames = ['documents', 'contents', 'metadata', 'secretRecords', 'trash'];
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

  window.MarkdownWorkspaceStorage = MarkdownWorkspaceStorage;
  window.MARKDOWN_VIEWER_VAULT_NAME = VAULT_NAME;
  window.MARKDOWN_VIEWER_SECRET_FOLDER_RECORD_ID = SECRET_FOLDER_RECORD_ID;
})();
