import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto, createHash } from 'node:crypto';
import vm from 'node:vm';
import mock from '../helpers/desktop-filesystem.js';

const source = readFileSync(new URL('../../workspace-storage.js', import.meta.url), 'utf8');
const original = 'C:/Original/Before.md';
const destination = 'C:/Original/After.md';
const hash = text => createHash('sha256').update(text).digest('hex');
async function setup() {
  const target = { crypto: webcrypto, TextEncoder, console, NL_OS: 'Windows', localStorage: { getItem: () => null, removeItem() {} } };
  target.window = target; target.self = target;
  mock.installDesktopFilesystem(target);
  vm.runInNewContext(source, target);
  const storage = new target.MarkdownWorkspaceStorage(); await storage.init();
  await target.Neutralino.filesystem.createDirectory('C:/Original');
  target.__desktopFiles.set(original, '# external original');
  const tab = { id: 'linked', title: 'Before', sourcePath: original,
    content: '# retained draft', contentLoaded: true, workspaceId: 'workspace_default' };
  await storage.saveDocuments([tab], { folders: [] }, { forceContent: true });
  return { target, storage, tab, prepare: (from = original, to = destination) => storage.prepareLinkedRename([tab.id], from, to, hash('# external original')) };
}
async function reopen(t) {
  const storage = new t.target.MarkdownWorkspaceStorage(); await storage.init();
  return { storage, tab: await storage.loadDocumentMetadata('linked') };
}

test('write-ahead intent exists and is verified before an external move', async () => {
  const t = await setup(); const path = await t.prepare();
  const record = JSON.parse(t.target.__desktopFiles.get(path));
  assert.equal(record.operation, 'linked-rename');
  assert.equal(record.documents[0].id, 'linked');
  assert.equal(record.sourceHash, hash('# external original'));
  assert.equal(t.target.__desktopFiles.get(original), '# external original');
  assert.ok(t.storage.getLinkedRenameRecovery('linked'));
});

test('restart before the move clears a verified unchanged intent without moving an original', async () => {
  const t = await setup(); const path = await t.prepare();
  const r = await reopen(t);
  assert.equal(r.tab.sourcePath, original);
  assert.equal(await r.storage.loadDocumentContent('linked'), '# retained draft');
  assert.equal(t.target.__desktopFiles.has(path), false);
  assert.equal(t.target.__desktopFiles.get(original), '# external original');
  assert.equal(t.target.__desktopFiles.has(destination), false);
});

test('restart after move and before metadata commit repairs only the link and preserves draft bytes', async () => {
  const t = await setup(); await t.prepare();
  await t.target.Neutralino.filesystem.move(original, destination);
  const r = await reopen(t);
  assert.equal(r.tab.sourcePath, destination);
  assert.equal(r.tab.title, 'After');
  assert.equal(await r.storage.loadDocumentContent('linked'), '# retained draft');
  assert.equal(t.target.__desktopFiles.get(destination), '# external original');
  assert.equal(t.target.__desktopFiles.has(original), false);
  assert.equal(r.storage.getLinkedRenameRecovery('linked'), null);
});

test('a lost native response is reconciled without replaying the external move', async () => {
  const t = await setup(); await t.prepare();
  await t.target.Neutralino.filesystem.move(original, destination);
  t.target.Neutralino.filesystem.move = async () => { throw new Error('Recovery must not move originals'); };
  assert.equal(await t.storage.recoverLinkedRename('linked'), 'renamed');
  assert.equal((await t.storage.loadDocumentMetadata('linked')).sourcePath, destination);
  assert.equal(await t.storage.loadDocumentContent('linked'), '# retained draft');
});

test('both paths present, neither present, changed contents and access failure retain recovery evidence', async () => {
  for (const scenario of ['both', 'neither', 'changed', 'denied']) {
    const t = await setup(); const path = await t.prepare();
    if (scenario !== 'both') await t.target.Neutralino.filesystem.move(original, destination);
    if (scenario === 'both') t.target.__desktopFiles.set(destination, '# occupied');
    if (scenario === 'neither') t.target.__desktopFiles.delete(destination);
    if (scenario === 'changed') t.target.__desktopFiles.set(destination, '# newer external edit');
    if (scenario === 'denied') t.target.Neutralino.filesystem.readDirectory = async () => { throw new Error('Access denied'); };
    const before = [...t.target.__desktopFiles];
    assert.equal(await t.storage.recoverLinkedRename('linked'), 'pending', scenario);
    assert.ok(t.target.__desktopFiles.has(path), scenario);
    assert.deepEqual([...t.target.__desktopFiles], before, scenario);
    assert.equal((await t.storage.loadDocumentMetadata('linked')).sourcePath, original);
    assert.equal(await t.storage.loadDocumentContent('linked'), '# retained draft');
  }
});

test('a newer document revision or an explicit rebind is not overwritten by recovery', async () => {
  for (const rebind of [false, true]) {
    const t = await setup(); await t.prepare();
    await t.target.Neutralino.filesystem.move(original, destination);
    t.tab.content = '# newer local draft';
    if (rebind) t.tab.sourcePath = 'C:/Original/Other.md';
    await t.storage.saveDocuments([t.tab], { folders: [] });
    assert.equal(await t.storage.recoverLinkedRename('linked'), 'pending');
    assert.equal(await t.storage.loadDocumentContent('linked'), '# newer local draft');
    assert.equal((await t.storage.loadDocumentMetadata('linked')).sourcePath, rebind ? 'C:/Original/Other.md' : original);
  }
});

test('metadata already committed to the new path clears the journal without rejecting later external edits', async () => {
  const t = await setup(); const path = await t.prepare();
  await t.target.Neutralino.filesystem.move(original, destination);
  t.tab.sourcePath = destination; t.tab.title = 'After';
  await t.storage.saveDocuments([t.tab], { folders: [] });
  t.target.__desktopFiles.set(destination, '# later external edit');
  const r = await reopen(t);
  assert.equal(r.tab.sourcePath, destination);
  assert.equal(t.target.__desktopFiles.has(path), false);
  assert.equal(t.target.__desktopFiles.get(destination), '# later external edit');
});

test('case-only rename recovery uses actual directory spelling', async () => {
  const t = await setup(); await t.prepare(original, 'C:/Original/before.md');
  await t.target.Neutralino.filesystem.move(original, 'C:/Original/before.md');
  // The shared mock uses case-sensitive Maps. Match normal Windows stat
  // behavior when the recovery-draft migration changes only filename case.
  const stat = t.target.Neutralino.filesystem.getStats;
  t.target.Neutralino.filesystem.getStats = async path => {
    const actual = [...t.target.__desktopFiles.keys()].find(key => key.toLowerCase() === path.toLowerCase());
    return stat(actual || path);
  };
  const r = await reopen(t);
  assert.equal(r.tab.sourcePath, 'C:/Original/before.md');
  assert.equal(await r.storage.loadDocumentContent('linked'), '# retained draft');
});

test('malformed and traversal recovery records never touch external originals', async () => {
  const t = await setup(); const path = await t.prepare();
  const record = JSON.parse(t.target.__desktopFiles.get(path));
  record.destination = 'C:/Original/../Other.md';
  t.target.__desktopFiles.set(path, JSON.stringify(record));
  const before = [...t.target.__desktopFiles];
  const r = await reopen(t);
  assert.equal(r.tab.sourcePath, original);
  assert.deepEqual([...t.target.__desktopFiles], before);
});

test('an unverified journal write cannot authorize a move', async () => {
  const t = await setup();
  const write = t.storage._writeJsonFileRecoverably.bind(t.storage);
  t.storage._writeJsonFileRecoverably = async (path, value) => {
    await write(path, value);
    if (value.operation === 'linked-rename') t.target.__desktopFiles.set(path, '{}');
  };
  await assert.rejects(t.prepare(), /could not be verified/);
  assert.equal(t.target.__desktopFiles.get(original), '# external original');
  assert.equal(t.target.__desktopFiles.has(destination), false);
});

test('failed recovery index commit retains the original journal for retry', async () => {
  const t = await setup(); const path = await t.prepare();
  await t.target.Neutralino.filesystem.move(original, destination);
  const write = t.storage._writeJsonFileRecoverably.bind(t.storage);
  t.storage._writeJsonFileRecoverably = async (path, value) => {
    if (path.endsWith('/index.json')) throw new Error('Index unavailable');
    return write(path, value);
  };
  assert.equal(await t.storage.recoverLinkedRename('linked'), 'pending');
  assert.ok(t.target.__desktopFiles.has(path));
  t.storage._writeJsonFileRecoverably = write;
  assert.equal(await t.storage.recoverLinkedRename('linked'), 'renamed');
});

test('manual recovery cannot discard intent before the selected link is durable', async () => {
  const t = await setup(); const path = await t.prepare();
  await assert.rejects(t.storage.clearLinkedRenameRecovery('linked', destination), /has not been saved/);
  assert.ok(t.target.__desktopFiles.has(path));
  t.tab.sourcePath = destination;
  await t.storage.saveDocuments([t.tab], { folders: [] });
  await t.storage.clearLinkedRenameRecovery('linked', destination);
  assert.equal(t.target.__desktopFiles.has(path), false);
});

test('a destination already linked elsewhere is not automatically adopted', async () => {
  const t = await setup(); await t.prepare();
  await t.target.Neutralino.filesystem.move(original, destination);
  await t.storage.saveDocuments([{ id: 'other', title: 'Other', sourcePath: destination,
    content: '# other retained draft', contentLoaded: true, workspaceId: 'workspace_default' }], { folders: [] });
  assert.equal(await t.storage.recoverLinkedRename('linked'), 'pending');
  assert.equal((await t.storage.loadDocumentMetadata('linked')).sourcePath, original);
  assert.equal(await t.storage.loadDocumentContent('other'), '# other retained draft');
});

test('backup import excludes rename intents and does not reconnect external paths', async () => {
  const t = await setup(); await t.prepare();
  const backup = await t.storage.createBackupData();
  assert.equal(JSON.stringify(backup).includes('linked-rename'), false);
  assert.equal(JSON.stringify(backup).includes(destination), false);
  const normalized = t.storage._normalizeBackupForRestore(backup);
  assert.equal(normalized.tabs[0].sourcePath, undefined);
  assert.equal(normalized.tabs[0].kind, 'linked-recovery');
  assert.equal(normalized.tabs[0].content, '# retained draft');
});

test('a retained Vault copy is not reconnected by an older rename intent', async () => {
  const t = await setup(); const path = await t.prepare();
  delete t.tab.sourcePath;
  await t.storage.saveDocuments([t.tab], { folders: [] });
  const r = await reopen(t);
  assert.equal(r.tab.sourcePath, undefined);
  assert.equal(await r.storage.loadDocumentContent('linked'), '# retained draft');
  assert.equal(r.storage.getLinkedRenameRecovery('linked'), null);
  assert.equal(t.target.__desktopFiles.has(path), false);
  assert.equal(t.target.__desktopFiles.get(original), '# external original');
});
