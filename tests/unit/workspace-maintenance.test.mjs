import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function setup() {
  const source = readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
  const start = source.indexOf('  async function beginWorkspaceMaintenance(');
  const end = source.indexOf('\n  // Browser lifecycle', start);
  const container = { inert: false }, events = [];
  const state = {
    workspaceMaintenancePending: false, suspendWorkspacePersistence: false,
    workspaceMaintenancePreviousInert: false, nativeMarkdownSaveInProgress: false,
    secretWorkspaceLockInProgress: false,
    liveCollaboration: null, linkedReadEpoch: 0, linkedLocationScanTokens: new Map([['root', {}]]),
    linkedSourceRefreshTimers: new Map(), saveTabStateTimeout: null, secretWorkspaceSaveTimeout: null,
    linkedMutationOperations: new Set(), documentDeletionChain: Promise.resolve(),
    secretWorkspaceSaveChain: Promise.resolve(), organizationPersistenceChain: Promise.resolve(true),
    document: { querySelector: () => container }, clearTimeout,
    saveSecondarySplitState: () => events.push('split'),
    flushWorkspaceBeforeExit: async () => events.push('flush')
  };
  vm.runInNewContext(source.slice(start, end) + '\nthis.begin = beginWorkspaceMaintenance; this.end = endWorkspaceMaintenance;', state);
  return { state, container, events };
}

test('maintenance rejects an active original Save without taking ownership', async () => {
  const { state, container } = setup(); state.nativeMarkdownSaveInProgress = true;
  await assert.rejects(state.begin(), /Save is still in progress/);
  assert.equal(state.workspaceMaintenancePending, false); assert.equal(container.inert, false);
});

test('maintenance cannot replace a workspace while its Secret lock is pending', async () => {
  const { state, container } = setup(); state.secretWorkspaceLockInProgress = true;
  await assert.rejects(state.begin(), /still locking/);
  assert.equal(state.workspaceMaintenancePending, false);
  assert.equal(container.inert, false);
});

test('maintenance waits for existing mutations and deletions then flushes split drafts', async () => {
  const { state, container, events } = setup(); let release;
  state.linkedMutationOperations.add(new Promise(resolve => { release = resolve; }));
  const pending = state.begin();
  assert.equal(state.workspaceMaintenancePending, true); assert.equal(container.inert, true);
  assert.equal(state.linkedLocationScanTokens.size, 0); assert.equal(state.linkedReadEpoch, 1);
  assert.equal(state.suspendWorkspacePersistence, false); assert.deepEqual(events, []);
  release(); await pending; assert.deepEqual(events, ['split', 'flush']);
  assert.equal(state.suspendWorkspacePersistence, true);
  state.end(); assert.equal(container.inert, false); assert.equal(state.workspaceMaintenancePending, false);
});

test('failed draft persistence re-enables editing instead of starting destructive work', async () => {
  const { state, container } = setup(); state.flushWorkspaceBeforeExit = async () => { throw new Error('disk full'); };
  await assert.rejects(state.begin(), /disk full/);
  assert.equal(state.workspaceMaintenancePending, false); assert.equal(state.suspendWorkspacePersistence, false);
  assert.equal(container.inert, false);
});

test('a second maintenance request cannot unblock the first request', async () => {
  const { state, container } = setup(); await state.begin();
  await assert.rejects(state.begin(), /already active/);
  assert.equal(state.suspendWorkspacePersistence, true); assert.equal(container.inert, true);
});

test('live collaboration prevents maintenance without taking ownership', async () => {
  const { state, container } = setup(); state.liveCollaboration = {};
  await assert.rejects(state.begin(), /live collaboration/);
  assert.equal(state.workspaceMaintenancePending, false); assert.equal(container.inert, false);
});

test('ending maintenance preserves an existing inert state', async () => {
  const { state, container } = setup(); container.inert = true;
  await state.begin(); state.end(); assert.equal(container.inert, true);
});
