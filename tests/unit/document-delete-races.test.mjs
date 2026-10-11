import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function setup() {
  const source = readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
  const start = source.indexOf('  let documentDeletionChain =');
  const end = source.indexOf('  function closeTab(', start);
  const deleted = [], gates = [];
  const context = { tabs: [{ id: 'A' }, { id: 'B' }, { id: 'C' }], activeTabId: null,
    secondarySplitTabId: null, pendingReviewDelete: null, liveCollaboration: null,
    SECRET_WORKSPACE_ID: 'secret', selectedDocumentId: null,
    workspacePersistenceChain: Promise.resolve(), shareSnapshotViewOnlyTabIds: new Set(), tabHistories: {}, console,
    workspaceStorage: { deleteDocument: async id => deleted.push(id) },
    _flushTabsToStorage: () => new Promise(resolve => gates.push(resolve)),
    isPrivateStorageMode: () => false, isTemporaryDocument: () => false };
  for (const name of ['saveSecondarySplitState', 'markReleaseNotesSeen', 'clearDirtyDocumentJournal',
    'renderDocumentSplitView', 'renderTabBar', 'closeReviewComposer', 'renderReviewPanel', 'renderDocumentSidebar', 'showAppToast']) context[name] = () => {};
  const remove = vm.runInNewContext(source.slice(start, end) + '\ndeleteTab;', context);
  return { context, remove, deleted, gates };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('simultaneous deletions serialize and remove only the requested IDs', async () => {
  const s = setup();
  const a = s.remove('A'), b = s.remove('B');
  await tick(); assert.equal(s.gates.length, 1);
  s.gates[0](true); assert.equal(await a, true);
  await tick(); s.gates[1](true); assert.equal(await b, true);
  assert.deepEqual(s.deleted, ['A', 'B']);
  assert.deepEqual(s.context.tabs.map(x => x.id), ['C']);
});

test('another list mutation during a deletion cannot remove a different document', async () => {
  const s = setup(); const b = s.remove('B'); await tick();
  s.context.tabs.shift(); s.gates[0](true); await b;
  assert.deepEqual(s.context.tabs.map(x => x.id), ['C']);
});

test('duplicate delete requests do not double-delete or remove a neighbour', async () => {
  const s = setup(); const a = s.remove('A'), again = s.remove('A');
  await tick(); s.gates[0](true); await a;
  assert.equal(await again, false);
  assert.deepEqual(s.deleted, ['A']);
  assert.deepEqual(s.context.tabs.map(x => x.id), ['B', 'C']);
});

test('a cancelled delete does not poison the deletion queue', async () => {
  const s = setup(); const a = s.remove('A'), b = s.remove('B');
  await tick(); s.gates[0](false); assert.equal(await a, false);
  await tick(); s.gates[1](true); await b;
  assert.deepEqual(s.context.tabs.map(x => x.id), ['A', 'C']);
});
