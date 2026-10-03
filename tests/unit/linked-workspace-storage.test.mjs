import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import mock from '../helpers/desktop-filesystem.js';

const source = fs.readFileSync(new URL('../../workspace-storage.js', import.meta.url), 'utf8');
const vault = 'C:/Documents/Markdown Viewer Vault/';
const indexPath = vault + '.markdown-viewer/index.json';

async function setupLegacyLinkedDraft() {
  const target = { crypto: webcrypto, TextEncoder, console, localStorage: { getItem: () => null, removeItem() {} } };
  target.self = target;
  target.window = target;
  mock.installDesktopFilesystem(target);
  vm.runInNewContext(source, target);
  const storage = new target.MarkdownWorkspaceStorage();
  await storage.init();
  const draft = { id: 'linked_draft', title: 'Notes', content: '# unsaved draft', contentLoaded: true, workspaceId: 'workspace_default', _storageRevision: 0 };
  await storage.saveDocuments([draft], { folders: [] }, { forceContent: true });
  const metadata = storage.vaultIndex.documents[0];
  metadata.sourcePath = 'C:/Original/notes.md';
  metadata.sourceContentHash = 'original-hash';
  target.__desktopFiles.set(metadata.sourcePath, '# original on disk');
  target.__desktopFiles.set(indexPath, JSON.stringify(storage.vaultIndex));
  return { target, oldPath: vault + metadata.vaultRelativePath };
}

test('upgrade moves existing linked recovery drafts without changing originals', async () => {
  const { target, oldPath } = await setupLegacyLinkedDraft();
  const upgraded = new target.MarkdownWorkspaceStorage();
  await upgraded.init();
  const record = upgraded.vaultIndex.documents[0];
  assert.match(record.vaultRelativePath, /^Linked Workspace\//);
  assert.equal(await upgraded.loadDocumentContent(record.id), '# unsaved draft');
  assert.equal(record.sourcePath, 'C:/Original/notes.md');
  assert.equal(target.__desktopFiles.get(record.sourcePath), '# original on disk');
  assert.equal(target.__desktopFiles.has(oldPath), false);
  const restarted = new target.MarkdownWorkspaceStorage();
  await restarted.init();
  assert.equal(await restarted.loadDocumentContent(record.id), '# unsaved draft');
});

test('interrupted linked-draft migration recovers its move and index journals', async () => {
  const { target } = await setupLegacyLinkedDraft();
  const write = target.Neutralino.filesystem.writeFile;
  let failOnce = true;
  target.Neutralino.filesystem.writeFile = async (path, content) => {
    if (failOnce && path.includes('/journal/') && path.endsWith('.index.json')) {
      failOnce = false;
      throw new Error('Simulated interruption before index commit');
    }
    return write(path, content);
  };
  await assert.rejects(new target.MarkdownWorkspaceStorage().init(), /Simulated interruption/);
  const restarted = new target.MarkdownWorkspaceStorage();
  await restarted.init();
  assert.match(restarted.vaultIndex.documents[0].vaultRelativePath, /^Linked Workspace\//);
  assert.equal(await restarted.loadDocumentContent('linked_draft'), '# unsaved draft');
  assert.equal(target.__desktopFiles.get('C:/Original/notes.md'), '# original on disk');
});

test('migration stops if an indexed draft body is missing and retains the old index', async () => {
  const { target, oldPath } = await setupLegacyLinkedDraft();
  const oldIndex = target.__desktopFiles.get(indexPath);
  target.__desktopFiles.delete(oldPath);
  await assert.rejects(new target.MarkdownWorkspaceStorage().init(), error => error.name === 'WorkspaceCorruptionError');
  assert.equal(target.__desktopFiles.get(indexPath), oldIndex);
});

test('conversion moves the draft to Workspace and backup preserves both storage roots', async () => {
  const { target } = await setupLegacyLinkedDraft();
  const storage = new target.MarkdownWorkspaceStorage();
  await storage.init();
  const draft = (await storage.listDocumentMetadata())[0];
  const linkedPath = vault + draft._vaultRelativePath;
  assert.match(await storage._backupDocumentRelativePath(draft, {}), /^Linked Workspace\//);
  draft.content = await storage.loadDocumentContent(draft.id);
  draft.contentLoaded = true;
  delete draft.sourcePath;
  delete draft.sourceContentHash;
  await storage.saveDocuments([draft], { folders: [] }, { changedIds: [draft.id] });
  assert.match(draft._vaultRelativePath, /^Workspace\//);
  assert.equal(target.__desktopFiles.has(linkedPath), false);
  assert.equal(target.__desktopFiles.get(vault + draft._vaultRelativePath), '# unsaved draft');
  assert.equal(target.__desktopFiles.get('C:/Original/notes.md'), '# original on disk');
  assert.match(await storage._backupDocumentRelativePath(draft, {}), /^Workspace\//);
  const restarted = new target.MarkdownWorkspaceStorage();
  await restarted.init();
  assert.equal(restarted.vaultIndex.documents[0].sourcePath, undefined);
  assert.match(restarted.vaultIndex.documents[0].vaultRelativePath, /^Workspace\//);
});

test('index rebuilding preserves recovery files from Linked Workspace', async () => {
  const { target } = await setupLegacyLinkedDraft();
  const storage = new target.MarkdownWorkspaceStorage();
  await storage.init();
  target.__desktopFiles.delete(indexPath);
  const rebuilt = new target.MarkdownWorkspaceStorage();
  await rebuilt.init();
  const record = rebuilt.vaultIndex.documents[0];
  assert.equal(record.kind, 'linked-recovery');
  assert.equal(await rebuilt.loadDocumentContent(record.id), '# unsaved draft');
  assert.match(await rebuilt._desktopDocumentRelativePath(record, {}), /^Linked Workspace\//);
});

test('new linked drafts and normal documents use separate physical roots', async () => {
  const { target } = await setupLegacyLinkedDraft();
  const storage = new target.MarkdownWorkspaceStorage();
  await storage.init();
  const organization = { folders: [{ id: 'folder', name: 'Projects', workspaceId: 'workspace_default', parentFolderId: null }] };
  const linked = { id: 'new_linked', title: 'Same title', content: '# recovery', contentLoaded: true, sourcePath: 'C:/Original/new.md', folderId: 'folder', workspaceId: 'workspace_default' };
  const normal = { id: 'new_normal', title: 'Same title', content: '# normal', contentLoaded: true, folderId: 'folder', workspaceId: 'workspace_default' };
  target.__desktopFiles.set(linked.sourcePath, '# source unchanged');
  await storage.saveDocuments([linked, normal], organization, { forceContent: true });
  assert.match(linked._vaultRelativePath, /^Linked Workspace\//);
  assert.match(normal._vaultRelativePath, /^Workspace\/Projects\//);
  assert.equal(target.__desktopFiles.get(vault + linked._vaultRelativePath), '# recovery');
  assert.equal(target.__desktopFiles.get(vault + normal._vaultRelativePath), '# normal');
  assert.equal(target.__desktopFiles.get(linked.sourcePath), '# source unchanged');
});

test('migration validates all bodies before moving any legacy draft', async () => {
  const { target, oldPath } = await setupLegacyLinkedDraft();
  const index = JSON.parse(target.__desktopFiles.get(indexPath));
  index.documents.push({ ...index.documents[0], id: 'missing_draft', vaultRelativePath: 'Workspace/missing.md' });
  target.__desktopFiles.set(indexPath, JSON.stringify(index));
  const oldIndex = target.__desktopFiles.get(indexPath);
  await assert.rejects(new target.MarkdownWorkspaceStorage().init(), error => error.name === 'WorkspaceCorruptionError');
  assert.equal(target.__desktopFiles.get(oldPath), '# unsaved draft');
  assert.equal(target.__desktopFiles.get(indexPath), oldIndex);
});
