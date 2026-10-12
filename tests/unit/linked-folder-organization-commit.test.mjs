import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
function functionSource(start, end) {
  const offset = source.indexOf(start);
  assert.ok(offset >= 0);
  return source.slice(offset, source.indexOf(end, offset));
}

function addHarness(save) {
  const events = [], organization = { linkedLocations: [] };
  const context = { Date, documentOrganization: organization,
    hasDesktopFileAccess: () => true, workspaceMaintenancePending: false, suspendWorkspacePersistence: false,
    normalizeLinkedSourcePath: x => x, createDocumentEntityId: () => 'new-root', getNativePathName: () => 'Root',
    saveDocumentOrganization: save, renderDocumentSidebar() { events.push('render'); },
    getLinkedLocation: id => organization.linkedLocations.find(x => x.id === id),
    reconcileLinkedLocation: async () => { events.push('scan'); },
    refreshLinkedSourceMonitoring: async () => { events.push('watch'); } };
  vm.runInNewContext(functionSource('  async function addLinkedFolderPath(', '\n  async function addLinkedFilePath(') + '\nthis.add = addLinkedFolderPath;', context);
  return { context, events, organization };
}

test('new linked root is not scanned or watched before its organization commit completes', async () => {
  let finish;
  const h = addHarness(() => new Promise(resolve => { finish = resolve; }));
  const pending = h.context.add('C:/Root');
  assert.deepEqual(h.events, []);
  finish(true);
  assert.equal((await pending).id, 'new-root');
  assert.deepEqual(h.events, ['scan', 'watch']);
});

test('failed initial organization commit removes only the new root and prevents scan/watch', async () => {
  const h = addHarness(async () => {
    h.organization.linkedLocations.push({ id: 'other', path: 'C:/Other' });
    return false;
  });
  assert.equal(await h.context.add('C:/Root'), null);
  assert.deepEqual(h.organization.linkedLocations.map(x => x.id), ['other']);
  assert.deepEqual(h.events, ['render']);
});

test('workspace maintenance beginning during initial commit prevents the scan', async () => {
  const h = addHarness(async () => { h.context.workspaceMaintenancePending = true; return true; });
  assert.equal(await h.context.add('C:/Root'), null);
  assert.deepEqual(h.events, []);
});
