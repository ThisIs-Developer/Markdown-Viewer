import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
function productionFunction(name) {
  const start = source.indexOf(`  function ${name}(`) >= 0
    ? source.indexOf(`  function ${name}(`) : source.indexOf(`  async function ${name}(`);
  assert.ok(start >= 0, `Missing production function ${name}`);
  const end = source.indexOf('\n  }', start) + 4;
  return source.slice(start, end);
}
function storage() {
  const records = new Map();
  return { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value), removeItem: key => records.delete(key) };
}
function setup() {
  const tab = { id: 'notes', content: 'OLD', contentLoaded: true };
  const target = {
    tabs: [tab], documentOrganization: {}, localStorage: storage(), sessionStorage: storage(),
    DIRTY_DOCUMENT_JOURNAL_PREFIX: 'journal:', workspaceWriterId: 'writer',
    saveTabStateTimeout: null, suspendWorkspacePersistence: false,
    pendingWorkspacePersistAll: false, pendingWorkspacePersistIds: new Set(),
    workspacePersistenceChain: Promise.resolve(), clearTimeout() {},
    getTabsForStorage: tabs => tabs, isPrivateStorageMode: () => false,
    evictInactiveDocumentContent() {}, updateSaveStatus() {},
    preserveWorkspaceConflict: async () => false, showAppToast() {},
    console: { warn() {} }, saved: [], journals: new Map(),
    recoveredDocumentJournalSources: new WeakMap(),
    readDirtyDocumentJournals: async () => [],
    normalizeReviewThreads: threads => threads || [],
    DEFAULT_WORKSPACE_ID: 'workspace_default',
    createTab: (content, title, viewMode, location) => ({
      id: 'recovered-copy', content, contentLoaded: true, title, viewMode, ...location
    })
  };
  target.workspaceStorage = {
    async saveDocuments(tabs) { target.saved.push(tabs[0].content); },
    async listDirtyJournals() { return [...target.journals.values()]; },
    async deleteDirtyJournals(ids, options) {
      for (const id of ids) {
        const current = target.journals.get(id);
        if (!options || !options.expectedJournals || JSON.stringify(current) === JSON.stringify(options.expectedJournals[id])) target.journals.delete(id);
      }
    }
  };
  const names = ['getDirtyDocumentJournalKey', 'clearDirtyDocumentJournal', '_flushTabsToStorage', 'recoverDirtyDocumentJournals'];
  if (source.includes('function captureDirtyDocumentJournalSnapshot(')) names.unshift('captureDirtyDocumentJournalSnapshot');
  vm.createContext(target);
  vm.runInContext(names.map(productionFunction).join('\n'), target);
  tab._dirtyJournalKeys = ['journal:writer:notes'];
  return { target, tab, key: tab._dirtyJournalKeys[0] };
}
function journal(content, savedAt = 1) { return { documentId: 'notes', content, savedAt }; }

test('conflict recovery is not an exact commit but ordinary autosave remains recovered', async () => {
  for (const exact of [false, true]) {
    const { target, tab } = setup(); let recovered = 0;
    target.workspaceStorage.saveDocuments = async () => { throw Error('conflict'); };
    target.preserveWorkspaceConflict = async () => { recovered++; return true; };
    assert.equal(await target._flushTabsToStorage([tab], { changedIds: [tab.id], requireExactCommit: exact }), !exact);
    assert.equal(recovered, 1);
  }
});

test('private or suspended persistence cannot satisfy a required exact commit', async () => {
  const { target, tab } = setup();
  target.isPrivateStorageMode = () => true;
  assert.equal(await target._flushTabsToStorage([tab], { requireExactCommit: true }), false);
  target.suspendWorkspacePersistence = true;
  assert.equal(await target._flushTabsToStorage([tab], { requireExactCommit: true }), false);
});

test('a newer comments-only journal survives an older save of unchanged Markdown', async () => {
  const { target, tab, key } = setup();
  tab.reviewThreads = [{ body: 'OLD COMMENT' }];
  target.localStorage.setItem(key, JSON.stringify({ ...journal('OLD'), metadata: { reviewThreads: [{ body: 'NEW COMMENT' }] } }));
  await target._flushTabsToStorage([tab], { changedIds: [tab.id] });
  assert.equal(JSON.parse(target.localStorage.getItem(key)).metadata.reviewThreads[0].body, 'NEW COMMENT');
});

test('a matching comments journal clears only after its save succeeds', async () => {
  const { target, tab, key } = setup();
  tab.reviewThreads = [{ body: 'COMMENT' }];
  target.localStorage.setItem(key, JSON.stringify({ ...journal('OLD'), metadata: { reviewThreads: tab.reviewThreads } }));
  await target._flushTabsToStorage([tab], { changedIds: [tab.id] });
  assert.equal(target.localStorage.getItem(key), null);
});

for (const location of ['localStorage', 'sessionStorage', 'indexeddb']) {
  test(`older save must retain newer ${location} recovery journal`, async () => {
    const { target, tab, key } = setup();
    if (location === 'indexeddb') target.journals.set(key, { journalId: key, ...journal('OLD') });
    else target[location].setItem(key, JSON.stringify(journal('OLD')));
    target.workspaceStorage.saveDocuments = async () => {
      target.saved.push('OLD');
      tab.content = 'NEW';
      if (location === 'indexeddb') target.journals.set(key, { journalId: key, ...journal('NEW', 2) });
      else target[location].setItem(key, JSON.stringify(journal('NEW', 2)));
    };
    assert.equal(await target._flushTabsToStorage([tab], { changedIds: [tab.id] }), true);
    const current = location === 'indexeddb' ? target.journals.get(key) : JSON.parse(target[location].getItem(key));
    assert.equal(current?.content, 'NEW');
  });
}

test('successful save clears matching journals but retains a journal newer than tab.content', async () => {
  const { target, tab, key } = setup();
  target.localStorage.setItem(key, JSON.stringify(journal('OLD')));
  target.sessionStorage.setItem(key, JSON.stringify(journal('NEW', 2)));
  target.journals.set(key, { journalId: key, ...journal('OLD') });
  assert.equal(await target._flushTabsToStorage([tab], { changedIds: [tab.id] }), true);
  assert.equal(target.localStorage.getItem(key), null);
  assert.equal(target.journals.has(key), false);
  assert.equal(JSON.parse(target.sessionStorage.getItem(key)).content, 'NEW');
});

test('failed save preserves the existing recovery journal', async () => {
  const { target, tab, key } = setup();
  target.localStorage.setItem(key, JSON.stringify(journal('OLD')));
  target.workspaceStorage.saveDocuments = async () => { throw Error('simulated failure'); };
  assert.equal(await target._flushTabsToStorage([tab], { changedIds: [tab.id] }), false);
  assert.equal(JSON.parse(target.localStorage.getItem(key)).content, 'OLD');
});

test('metadata-only save must not discard recovery content', async () => {
  const { target, tab, key } = setup();
  tab.contentLoaded = false;
  tab.content = undefined;
  target.localStorage.setItem(key, JSON.stringify(journal('RECOVER ME')));
  assert.equal(await target._flushTabsToStorage([tab], { changedIds: [tab.id] }), true);
  assert.equal(JSON.parse(target.localStorage.getItem(key)).content, 'RECOVER ME');
});

test('a newer journal survives an old save, then is cleared by its own successful save', async () => {
  const { target, tab, key } = setup();
  target.localStorage.setItem(key, JSON.stringify(journal('OLD')));
  const normalSave = target.workspaceStorage.saveDocuments;
  target.workspaceStorage.saveDocuments = async () => {
    tab.content = 'NEW';
    target.localStorage.setItem(key, JSON.stringify(journal('NEW', 2)));
  };
  await target._flushTabsToStorage([tab], { changedIds: [tab.id] });
  assert.equal(JSON.parse(target.localStorage.getItem(key)).content, 'NEW');
  target.workspaceStorage.saveDocuments = normalSave;
  await target._flushTabsToStorage([tab], { changedIds: [tab.id] });
  assert.equal(target.localStorage.getItem(key), null);
  assert.equal(target.saved.at(-1), 'NEW');
});

for (const location of ['localStorage', 'sessionStorage', 'indexeddb']) {
  for (const scenario of ['saved', 'failed', 'metadata-only', 'newer-before-save', 'newer-during-save']) {
    test(`recovered copy ${scenario}: ${location} source journal is consumed only by its matching successful save`, async () => {
      const { target, tab, key } = setup();
      tab._storageRevision = 2;
      const source = { ...journal('RECOVERED'), expectedRevision: 1, metadata: { reviewThreads: [] } };
      const write = value => location === 'indexeddb'
        ? target.journals.set(key, { ...value, journalId: key })
        : target[location].setItem(key, JSON.stringify(value));
      const read = () => location === 'indexeddb' ? target.journals.get(key) : JSON.parse(target[location].getItem(key));
      write(source);
      target.readDirtyDocumentJournals = async () => [{ key, value: source }];
      const ids = await target.recoverDirtyDocumentJournals();
      const recovered = target.tabs.find(item => item.id === ids[0]);
      assert.notEqual(recovered.id, source.documentId);

      const newer = { ...source, savedAt: 2, metadata: { reviewThreads: [{ body: 'NEW COMMENT' }] } };
      if (scenario === 'newer-before-save') write(newer);
      if (scenario === 'metadata-only') { recovered.contentLoaded = false; recovered.content = undefined; }
      target.workspaceStorage.saveDocuments = async () => {
        if (scenario === 'failed') throw Error('disk full');
        if (scenario === 'newer-during-save') write(newer);
      };
      const result = await target._flushTabsToStorage(target.tabs, { changedIds: ids });
      assert.equal(result, scenario !== 'failed');
      if (scenario === 'saved') assert.ok(!read(), 'saved recovery copy must consume its source journal');
      else if (scenario.startsWith('newer')) assert.equal(read().metadata.reviewThreads[0].body, 'NEW COMMENT');
      else assert.equal(read().content, source.content);
    });
  }
}

test('a tracked key alone cannot authorize cleanup of another document journal', async () => {
  const { target, tab, key } = setup();
  const unrelated = { documentId: 'unrelated', content: tab.content };
  target.localStorage.setItem(key, JSON.stringify(unrelated));
  target.journals.set(key, { ...unrelated, journalId: key });
  await target._flushTabsToStorage([tab], { changedIds: [tab.id] });
  assert.equal(JSON.parse(target.localStorage.getItem(key)).documentId, 'unrelated');
  assert.equal(target.journals.get(key).documentId, 'unrelated');
});
