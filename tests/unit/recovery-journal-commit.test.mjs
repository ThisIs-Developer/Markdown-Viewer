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
    console: { warn() {} }, saved: [], journals: new Map()
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
  const names = ['getDirtyDocumentJournalKey', 'clearDirtyDocumentJournal', '_flushTabsToStorage'];
  if (source.includes('function captureDirtyDocumentJournalSnapshot(')) names.unshift('captureDirtyDocumentJournalSnapshot');
  vm.createContext(target);
  vm.runInContext(names.map(productionFunction).join('\n'), target);
  tab._dirtyJournalKeys = ['journal:writer:notes'];
  return { target, tab, key: tab._dirtyJournalKeys[0] };
}
function journal(content, savedAt = 1) { return { documentId: 'notes', content, savedAt }; }

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
