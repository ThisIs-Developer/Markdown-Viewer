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
    linkedReadEpoch: 0, linkedLocationScanTokens: new Map(), linkedLocationMutations: new Map(),
    linkedMutationOperations: new Set(), linkedLocationMutationChains: new Map(),
    hasDesktopFileAccess: () => true, assertOutsideManagedVault: async () => {}, workspaceMaintenancePending: false, suspendWorkspacePersistence: false,
    normalizeLinkedSourcePath: x => x, createDocumentEntityId: () => 'new-root', getNativePathName: () => 'Root',
    saveDocumentOrganization: save, renderDocumentSidebar() { events.push('render'); },
    getLinkedLocation: id => organization.linkedLocations.find(x => x.id === id),
    reconcileLinkedLocation: async () => { events.push('scan'); },
    refreshLinkedSourceMonitoring: async () => { events.push('watch'); } };
  vm.runInNewContext(functionSource('  async function withLinkedLocationMutation(', '\n  async function reconcileLinkedLocation(') + functionSource('  async function addLinkedFolderPath(', '\n  async function addLinkedFilePath(') + '\nthis.add = addLinkedFolderPath;', context);
  return { context, events, organization };
}

test('new linked root is not scanned or watched before its organization commit completes', async () => {
  let finish;
  const h = addHarness(() => new Promise(resolve => { finish = resolve; }));
  const pending = h.context.add('C:/Root');
  while (!finish) await new Promise(resolve => setImmediate(resolve));
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

test('concurrent linking of the same root cannot bypass a failed initial commit', async () => {
  let finish;
  const h = addHarness(() => new Promise(resolve => { finish = resolve; }));
  const first = h.context.add('C:/Root');
  const second = h.context.add('C:/Root');
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(h.events, []);
  finish(false);
  assert.equal(await first, null);
  assert.equal(await second, null);
  assert.deepEqual(h.organization.linkedLocations, []);
  assert.equal(h.events.includes('scan'), false);
});

test('workspace read epoch changing during initial commit prevents stale follow-up', async () => {
  const h = addHarness(async () => { h.context.linkedReadEpoch++; return true; });
  assert.equal(await h.context.add('C:/Root'), null);
  assert.deepEqual(h.events, []);
});

function scanHarness(save) {
  const root = { id: 'root', path: 'C:/Root', name: 'Root', excludedPaths: ['notes.md'], lastScanAt: 123, unavailable: true };
  const token = {}, toasts = [], persisted = [];
  const context = { Date, tabs: [], linkedReadEpoch: 0, linkedLocationScanTokens: new Map([['root', token]]),
    linkedLocationMutations: new Map(), linkedFolderScanErrors: new Map(), activeTabId: null,
    getLinkedLocation: () => root, normalizeLinkedSourcePath: x => x, normalizeLinkedRelativePath: x => x,
    linkedSidebarState: () => '', findTabBySourcePath: () => null, getNativePathName: () => 'notes.md',
    collectMarkdownFilesFromFolder: async () => [{ path: 'C:/Root/notes.md', relativePath: 'notes.md', content: '# source' }],
    openLinkedMarkdownDocument: async () => { context.tabs.push({ id: 'draft', linkedRootId: 'root', sourcePath: 'C:/Root/notes.md', content: '# kept draft' }); return true; },
    saveDocumentOrganization: save, saveTabsToStorage: tabs => persisted.push(tabs.map(x => x.content)),
    renderTabBar() {}, renderDocumentSidebar() {}, requestLinkedBackgroundUIRefresh() {},
    showAppToast: (_, options) => toasts.push(options), console };
  vm.runInNewContext(functionSource('  async function reconcileLinkedLocationSnapshot(', '\n  async function addLinkedFolderPath(') + '\nthis.scan = reconcileLinkedLocationSnapshot;', context);
  return { context, root, token, toasts, persisted };
}

test('failed scan organization commit retains records but restores exclusions and scan metadata', async () => {
  const h = scanHarness(async () => false);
  assert.equal(await h.context.scan('root', { notify: true, restoreExcluded: true }, h.token), 0);
  assert.deepEqual(Array.from(h.root.excludedPaths), ['notes.md']);
  assert.equal(h.root.lastScanAt, 123);
  assert.equal(h.root.unavailable, true);
  assert.equal(h.context.tabs[0].content, '# kept draft');
  assert.equal(h.persisted.length, 1);
  assert.equal(h.context.linkedFolderScanErrors.has('root'), true);
  assert.equal(h.toasts.some(x => x.tone === 'success'), false);
});

test('scan success notification waits for durable organization metadata', async () => {
  let finish;
  const h = scanHarness(() => new Promise(resolve => { finish = resolve; }));
  const pending = h.context.scan('root', { notify: true, restoreExcluded: true }, h.token);
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.toasts.length, 0);
  finish(true);
  assert.equal(await pending, 1);
  assert.equal(h.toasts[0].tone, 'success');
  assert.deepEqual(Array.from(h.root.excludedPaths), []);
});

test('stale scan completion does not undo newer exclusions or report success', async () => {
  const h = scanHarness(async () => {
    h.root.excludedPaths = ['newer.md'];
    h.context.linkedLocationScanTokens.delete('root');
    return false;
  });
  assert.equal(await h.context.scan('root', { notify: true, restoreExcluded: true }, h.token), 0);
  assert.deepEqual(h.root.excludedPaths, ['newer.md']);
  assert.equal(h.toasts.length, 0);
});
