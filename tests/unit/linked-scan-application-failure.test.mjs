import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('partial snapshot application is not reported as a successful complete scan', async () => {
  const source = readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
  const start = source.indexOf('  async function reconcileLinkedLocationSnapshot(');
  const end = source.indexOf('\n  async function addLinkedFolderPath(', start);
  const token = {}, root = { id: 'root', path: 'C:/Root', name: 'Root', excludedPaths: [], lastScanAt: 123 }, toasts = [];
  const ctx = { Date, tabs: [], linkedReadEpoch: 0, linkedLocationScanTokens: new Map([['root', token]]),
    linkedLocationMutations: new Map(), linkedFolderScanErrors: new Map(), activeTabId: null,
    getLinkedLocation: () => root, normalizeLinkedSourcePath: x => x, normalizeLinkedRelativePath: x => x,
    linkedSidebarState: () => '', findTabBySourcePath: () => null, getNativePathName: () => 'notes.md',
    collectMarkdownFilesFromFolder: async () => [{ path: 'C:/Root/notes.md', relativePath: 'notes.md', content: '# source' }],
    openLinkedMarkdownDocument: async () => { throw new Error('Recovery content unavailable'); },
    saveDocumentOrganization: async () => true, saveTabsToStorage() {}, renderTabBar() {}, renderDocumentSidebar() {},
    requestLinkedBackgroundUIRefresh() {}, showAppToast: (_, options) => toasts.push(options), console: { warn() {} } };
  vm.runInNewContext(source.slice(start, end) + '\nthis.scan = reconcileLinkedLocationSnapshot;', ctx);
  await ctx.scan('root', { notify: true }, token);
  assert.equal(root.lastScanAt, 123); assert.equal(ctx.linkedFolderScanErrors.has('root'), true);
  assert.equal(toasts.some(x => x.tone === 'success'), false);
  assert.equal(toasts[0].title, 'Folder scan incomplete');
});
