import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
function extract(name) {
  let start = source.indexOf(`  function ${name}(`);
  if (start < 0) start = source.indexOf(`  async function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n  }', start) + 4);
}
function setup({ disk = 'DISK CHANGED', draft = 'BASE', editor = draft, secondary = false } = {}) {
  const tab = { id: 'linked', content: draft, contentLoaded: true, sourcePath: 'C:/notes.md', sourceContentHash: 'BASE' };
  const target = {
    tabs: [tab], activeTabId: secondary ? 'other' : tab.id, secondarySplitTabId: secondary ? tab.id : null,
    document: { documentElement: { dataset: { appReady: 'true' } } },
    markdownEditor: { value: secondary ? 'UNRELATED' : editor }, documentSplitEditor: { value: editor },
    Neutralino: { filesystem: { readFile: async () => disk, getStats: async () => ({ size: new TextEncoder().encode(disk).byteLength }) } }, TextEncoder,
    isLinkedDocument: tab => Boolean(tab?.sourcePath), ensureTabContent: async () => {},
    workspaceMaintenancePending: false, suspendWorkspacePersistence: false,
    workspaceStorage: { getLinkedRenameRecovery: () => null },
    linkedReadEpoch: 0, linkedSourceSavePaths: new Set(), normalizeLinkedSourcePath: path => path,
    hashLinkedSourceContent: async text => text, journal: [], toasts: [], saves: [],
    writeDirtyDocumentJournal: (tab, text) => { target.journal.push(text); return true; },
    persistEditWithoutDurableJournal() { throw Error('Unexpected fallback'); },
    saveTabsToStorage: () => target.saves.push(tab.content),
    showAppToast: text => target.toasts.push(text), linkedSidebarState: () => String(tab.sourceConflict),
    requestLinkedBackgroundUIRefresh() {}, renderDocumentSidebar() {}, renderTabBar() {},
    renderMarkdown() {}, renderDocumentSplitView() { target.documentSplitEditor.value = tab.content; },
    window: { confirm: () => { throw Error('Native confirmation is forbidden'); } },
    showLinkedConfirmation: async () => false
  };
  vm.createContext(target);
  vm.runInContext(fs.readFileSync(new URL('../../native-markdown-source.js', import.meta.url), 'utf8'), target);
  vm.runInContext(['readNativeMarkdownSource', 'captureLiveLinkedDraft', 'inspectLinkedDraftForRefresh', 'linkedDraftChangedAfterInspection',
    'updateLinkedConflictState', 'refreshLinkedEditors', 'reloadLinkedDocument'].map(extract).join('\n'), target);
  return { target, tab };
}

for (const secondary of [false, true]) {
  test(`background refresh retains live ${secondary ? 'secondary' : 'primary'} editor input before debounce`, async () => {
    const { target, tab } = setup({ editor: 'LOCAL NEW', secondary });
    assert.equal(await target.reloadLinkedDocument(tab.id, { background: true }), false);
    assert.equal(tab.content, 'LOCAL NEW');
    assert.equal(tab.sourceConflict, true);
    assert.ok(target.journal.includes('LOCAL NEW'));
  });
}

test('an edit arriving during async hashing is preserved even for an explicit reload', async () => {
  const { target, tab } = setup();
  target.hashLinkedSourceContent = async text => {
    if (text === 'BASE') target.markdownEditor.value = 'EDIT DURING HASH';
    return text;
  };
  assert.equal(await target.reloadLinkedDocument(tab.id, { force: true }), false);
  assert.equal(tab.content, 'EDIT DURING HASH');
});

test('clean secondary editor updates when the disk content changes', async () => {
  const { target, tab } = setup({ secondary: true });
  assert.equal(await target.reloadLinkedDocument(tab.id, { background: true }), true);
  assert.equal(target.documentSplitEditor.value, 'DISK CHANGED');
  assert.equal(target.markdownEditor.value, 'UNRELATED');
});

test('conflict notification is emitted once across repeated background refreshes', async () => {
  const { target, tab } = setup({ editor: 'LOCAL NEW' });
  for (let i = 0; i < 3; i++) await target.reloadLinkedDocument(tab.id, { background: true });
  assert.equal(target.toasts.length, 1);
  assert.equal(tab.content, 'LOCAL NEW');
});

test('cancelled force reload leaves local changes and source baseline intact', async () => {
  const { target, tab } = setup({ editor: 'LOCAL NEW' });
  assert.equal(await target.reloadLinkedDocument(tab.id, { force: true }), false);
  assert.equal(tab.content, 'LOCAL NEW');
  assert.equal(tab.sourceContentHash, 'BASE');
});

test('an unresolved rename prevents a watcher or explicit reload from changing the retained draft', async () => {
  const { target, tab } = setup({ editor: 'LOCAL NEW' });
  target.workspaceStorage.getLinkedRenameRecovery = () => ({ source: 'C:/notes.md', destination: 'C:/renamed.md' });
  for (const options of [{ background: true }, { force: true }]) {
    assert.equal(await target.reloadLinkedDocument(tab.id, options), false);
    assert.equal(tab.content, 'BASE');
    assert.equal(target.markdownEditor.value, 'LOCAL NEW');
    assert.equal(tab.sourceContentHash, 'BASE');
  }
});

test('startup placeholder text is not mistaken for a linked draft', async () => {
  const { target, tab } = setup({ editor: 'STARTUP PLACEHOLDER' });
  target.document.documentElement.dataset.appReady = 'false';
  const snapshot = target.captureLiveLinkedDraft(tab);
  assert.equal(snapshot.content, 'BASE');
  assert.equal(target.journal.length, 0);
});

for (const secondary of [false, true]) {
  test(`returning unchanged source retains the ${secondary ? 'secondary' : 'primary'} draft`, async () => {
    const { target, tab } = setup({ disk: 'BASE', editor: 'LOCAL NEW', secondary });
    target.Neutralino.filesystem.readFile = async () => { throw Error('temporarily missing'); };
    assert.equal(await target.reloadLinkedDocument(tab.id, { background: true }), false);
    assert.equal(tab.sourceMissing, true);
    assert.equal(tab.content, 'LOCAL NEW');
    assert.ok(target.journal.includes('LOCAL NEW'));
    target.Neutralino.filesystem.readFile = async () => 'BASE';
    assert.equal(await target.reloadLinkedDocument(tab.id, { background: true }), true);
    assert.equal(tab.sourceMissing, false);
    assert.equal(tab.content, 'LOCAL NEW');
    assert.equal(tab.sourceContentHash, 'BASE');
    assert.equal(tab.sourceConflict, false);
    assert.equal(target.toasts.length, 0);
  });
}

test('returning changed source reports conflict without replacing the local draft', async () => {
  const { target, tab } = setup({ editor: 'LOCAL NEW' });
  tab.sourceMissing = true;
  assert.equal(await target.reloadLinkedDocument(tab.id, { background: true }), false);
  assert.equal(tab.sourceMissing, false);
  assert.equal(tab.sourceConflict, true);
  assert.equal(tab.content, 'LOCAL NEW');
});

test('returning changed source refreshes a clean draft', async () => {
  const { target, tab } = setup();
  tab.sourceMissing = true;
  assert.equal(await target.reloadLinkedDocument(tab.id, { background: true }), true);
  assert.equal(tab.sourceMissing, false);
  assert.equal(tab.content, 'DISK CHANGED');
});
