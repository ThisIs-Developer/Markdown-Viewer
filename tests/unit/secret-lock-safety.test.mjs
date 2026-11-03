import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
function extract(start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first);
  return source.slice(first, last);
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function setup({ privateMode = false, previousInert = false } = {}) {
  const entered = deferred();
  const resume = deferred();
  const key = {};
  const container = { inert: previousInert };
  const records = new Map([['existing', '# existing']]);
  const writes = [];
  const c = {
    console, Set, Map, Uint8Array, clearTimeout,
    workspaceMaintenancePending: false, suspendWorkspacePersistence: false,
    linkedReadEpoch: 0,
    secretWorkspaceLockInProgress: false, secretWorkspaceKey: key,
    secretWorkspaceSalt: new Uint8Array(16), secretWorkspaceIterations: 1,
    secretWorkspaceSaveChain: Promise.resolve(), secretWorkspaceSaveTimeout: null,
    secretWorkspaceStoredDocumentIds: new Set(['existing']),
    secretWorkspaceRecordRevisions: new Map(), secretWorkspacePersistedFolders: '',
    secretWorkspaceEnvelopeCache: null, secretWorkspaceDocumentCount: 1,
    SECRET_WORKSPACE_VERSION: 2, SECRET_KDF_ITERATIONS: 1,
    SECRET_WORKSPACE_ID: 'secret', DEFAULT_WORKSPACE_ID: 'vault',
    tabs: [{ id: 'existing', workspaceId: 'secret', content: '# existing' }],
    documentOrganization: { folders: [], ui: {} },
    activeTabId: null, secondarySplitTabId: null, window: {},
    document: { querySelector: () => container },
    isTemporaryDocument: () => false, isPrivateStorageMode: () => privateMode,
    getSecretDocumentStorageValue: tab => ({ id: tab.id, content: tab.content }),
    bytesToBase64: () => 'salt', clearSecretDirtyDocumentJournal() {},
    resolveSecretWorkspaceConflict: async () => false,
    getWorkspaceById: () => null, getOpenTabs: () => [],
    createTab: (content, title, mode, location) => ({ id: 'import', content, title, ...location }),
    normalizeTabDocumentMetadata() {},
    workspaceStorage: {
      async applySecretRecordChanges(changes, manifest) {
        writes.push({ changes, manifest });
        changes.upserts.forEach(item => records.set(item.id, item.envelope));
        changes.deletions.forEach(item => records.delete(item.id));
        return { revisions: [] };
      }
    }
  };
  c.isSecretWorkspaceUnlocked = () => Boolean(c.secretWorkspaceKey && c.secretWorkspaceSalt);
  c.encryptSecretWorkspaceValue = async value => {
    if (value.id === 'existing') { entered.resolve(); await resume.promise; }
    return value;
  };
  for (const name of ['saveCurrentTabState', 'saveSecondarySplitState', '_flushTabsToStorage',
    'saveDocumentOrganization', 'renderDocumentSidebar', 'announceToScreenReader', 'renderTabBar']) c[name] = () => {};
  vm.createContext(c);
  vm.runInContext(
    extract('  function getSecretWorkspacePayload()', '  function getSecretDocumentStorageValue(') +
    extract('  function enqueueSecretWorkspaceSave()', '  function scheduleSecretWorkspaceSave()') +
    extract('  function flushSecretWorkspaceToStorage()', '  async function decryptSecretWorkspace(') +
    extract('  async function lockSecretWorkspace()', '  async function resetSecretWorkspaceData()') +
    extract('  function createImportedDocument(', '  async function persistImportedDocuments('), c);
  return { c, key, container, records, writes, entered, resume };
}

test('a save queued during lock cannot delete existing encrypted records after tabs are removed', async () => {
  const t = setup();
  const locking = t.c.lockSecretWorkspace();
  await t.entered.promise;
  const queued = t.c.flushSecretWorkspaceToStorage();
  t.resume.resolve();
  await Promise.all([locking, queued]);
  assert.ok(t.records.has('existing'));
  assert.equal(t.writes.length, 1);
  assert.equal(t.writes[0].manifest.documentCount, 1);
});

test('an asynchronous import cannot add a Secret document while locking', async () => {
  const t = setup();
  const locking = t.c.lockSecretWorkspace();
  await t.entered.promise;
  assert.equal(t.c.createImportedDocument('# late', 'Late', { workspaceId: 'secret' }), null);
  assert.equal(t.c.tabs.length, 1);
  t.resume.resolve();
  await locking;
});

test('failed encryption leaves the workspace unlocked and restores interaction state', async () => {
  for (const previousInert of [false, true]) {
    const t = setup({ previousInert });
    t.c.encryptSecretWorkspaceValue = async () => { throw new Error('Encryption failed'); };
    await assert.rejects(t.c.lockSecretWorkspace(), /Encryption failed/);
    assert.equal(t.c.secretWorkspaceKey, t.key);
    assert.equal(t.c.tabs.length, 1);
    assert.equal(t.c.secretWorkspaceLockInProgress, false);
    assert.equal(t.container.inert, previousInert);
    assert.equal(t.writes.length, 0);
  }
});

test('a queued save from an earlier unlock cannot write into a new session', async () => {
  const t = setup();
  const queue = deferred();
  t.c.secretWorkspaceSaveChain = queue.promise;
  const saved = t.c.flushSecretWorkspaceToStorage();
  t.c.secretWorkspaceKey = {};
  queue.resolve();
  assert.equal(await saved, false);
  assert.equal(t.writes.length, 0);
});

test('a session change during encryption cancels the write before storage mutation', async () => {
  const t = setup();
  const saved = t.c.flushSecretWorkspaceToStorage();
  await t.entered.promise;
  t.c.secretWorkspaceKey = {};
  t.resume.resolve();
  assert.equal(await saved, false);
  assert.equal(t.writes.length, 0);
});

test('a second lock request cannot overlap the first flush', async () => {
  const t = setup();
  const locking = t.c.lockSecretWorkspace();
  await t.entered.promise;
  await t.c.lockSecretWorkspace();
  t.resume.resolve();
  await locking;
  assert.equal(t.writes.length, 1);
});

test('Private mode lock remains session-only and never deletes persistent records', async () => {
  const t = setup({ privateMode: true });
  await t.c.lockSecretWorkspace();
  assert.equal(t.writes.length, 0);
  assert.equal(t.c.tabs.length, 0);
  assert.equal(t.c.secretWorkspaceKey, null);
  assert.ok(t.records.has('existing'));
});
