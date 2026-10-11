import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function coordinator() {
  const source = readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
  const start = source.indexOf('  async function withLinkedLocationMutation(');
  const end = source.indexOf('  async function reconcileLinkedLocation(', start);
  const context = {
    workspaceMaintenancePending: false, suspendWorkspacePersistence: false, linkedMutationOperations: new Set(),
    linkedLocationScanTokens: new Map(),
    linkedLocationMutations: new Map(),
    linkedLocationMutationChains: new Map()
  };
  context.run = vm.runInNewContext(source.slice(start, end) + '\nwithLinkedLocationMutation;', context);
  return context;
}

test('same-root mutations serialize while other roots proceed and old scan tokens are invalidated', async () => {
  const state = coordinator();
  const events = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  state.linkedLocationScanTokens.set('root', {});
  const first = state.run('root', async () => { events.push('first'); await gate; events.push('first done'); });
  const second = state.run('root', async () => { events.push('second'); });
  await state.run('other', async () => { events.push('other'); });
  assert.deepEqual(events, ['first', 'other']);
  assert.equal(state.linkedLocationScanTokens.has('root'), false);
  assert.equal(state.linkedLocationMutations.get('root'), 2);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(events, ['first', 'other', 'first done', 'second']);
  assert.equal(state.linkedLocationMutations.size, 0);
  assert.equal(state.linkedLocationMutationChains.size, 0);
});

test('failed mutation releases its root and does not poison the queued operation', async () => {
  const state = coordinator();
  const first = state.run('root', async () => { throw new Error('injected failure'); });
  const rejection = assert.rejects(first, /injected failure/);
  const second = state.run('root', async () => 'kept running');
  await rejection;
  assert.equal(await second, 'kept running');
  assert.equal(state.linkedLocationMutations.size, 0);
  assert.equal(state.linkedLocationMutationChains.size, 0);
  assert.equal(await state.run(null, async () => 'loose file'), 'loose file');
});
