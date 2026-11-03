import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import mock from '../helpers/desktop-filesystem.js';
const source = fs.readFileSync(new URL('../../workspace-storage.js', import.meta.url), 'utf8');
async function setup() {
  const target = {crypto:webcrypto, TextEncoder, console, NL_OS:'Windows', localStorage:{getItem:()=>null,removeItem(){}}};
  target.window=target; target.self=target; mock.installDesktopFilesystem(target);
  vm.runInNewContext(source,target);
  const storage = new target.MarkdownWorkspaceStorage(); await storage.init();
  const tab = {id:'moving',title:'Before',content:'# original',contentLoaded:true,workspaceId:'workspace_default',_storageRevision:0};
  await storage.saveDocuments([tab],{folders:[]},{forceContent:true});
  const original = storage.vaultPath + '/' + tab._vaultRelativePath;
  const index = target.__desktopFiles.get(storage.vaultPath+'/.markdown-viewer/index.json');
  tab.title='After';
  const destination = storage.vaultPath + '/' + await storage._desktopDocumentRelativePath(tab,{folders:[]});
  return {target,storage,tab,original,destination,index,save:()=>storage.saveDocuments([tab],{folders:[]},{changedIds:[tab.id]})};
}
test('occupied move destination preserves both files and committed index', async () => {
  const s=await setup(); s.target.__desktopFiles.set(s.destination,'# unrelated existing file');
  await assert.rejects(s.save(),/destination.*exists/i);
  assert.equal(s.target.__desktopFiles.get(s.original),'# original');
  assert.equal(s.target.__desktopFiles.get(s.destination),'# unrelated existing file');
  assert.equal(s.target.__desktopFiles.get(s.storage.vaultPath+'/.markdown-viewer/index.json'),s.index);
});
test('missing move source does not silently create a replacement body', async () => {
  const s=await setup(); s.target.__desktopFiles.delete(s.original);
  await assert.rejects(s.save(),/source.*missing/i);
  assert.equal(s.target.__desktopFiles.has(s.destination),false);
});
test('stat failure with an existing destination entry must not permit overwrite', async () => {
  const s=await setup(); s.target.__desktopFiles.set(s.destination,'# private existing file');
  const stat=s.target.Neutralino.filesystem.getStats;
  s.target.Neutralino.filesystem.getStats=async p=>{if(p===s.destination)throw {code:'NE_FS_NOPATHE'}; return stat(p);};
  await assert.rejects(s.save(),/cannot be inspected/i);
  assert.equal(s.target.__desktopFiles.get(s.original),'# original');
  assert.equal(s.target.__desktopFiles.get(s.destination),'# private existing file');
});
test('destination appearing while move journal is written is not overwritten', async () => {
  const s=await setup(); const write=s.target.Neutralino.filesystem.writeFile;
  s.target.Neutralino.filesystem.writeFile=async(p,text)=>{await write(p,text); if(p.endsWith('.move.json'))s.target.__desktopFiles.set(s.destination,'# externally created');};
  await assert.rejects(s.save(),/destination.*exists/i);
  assert.equal(s.target.__desktopFiles.get(s.original),'# original');
  assert.equal(s.target.__desktopFiles.get(s.destination),'# externally created');
});
test('normal document rename persists and reopens its body', async () => {
  const s=await setup(); await s.save();
  assert.equal(s.target.__desktopFiles.has(s.original),false);
  assert.equal(s.target.__desktopFiles.get(s.destination),'# original');
  const reopened=new s.target.MarkdownWorkspaceStorage(); await reopened.init();
  assert.equal(await reopened.loadDocumentContent(s.tab.id),'# original');
});
test('move permission failure leaves source and index unchanged', async () => {
  const s=await setup(); s.target.Neutralino.filesystem.move=async()=>{throw new Error('Access denied');};
  await assert.rejects(s.save(),/Access denied/);
  assert.equal(s.target.__desktopFiles.get(s.original),'# original');
  assert.equal(s.target.__desktopFiles.has(s.destination),false);
  assert.equal(s.target.__desktopFiles.get(s.storage.vaultPath+'/.markdown-viewer/index.json'),s.index);
  const reopened=new s.target.MarkdownWorkspaceStorage(); await reopened.init();
  assert.equal(await reopened.loadDocumentContent(s.tab.id),'# original');
});
test('unavailable parent listing stops move rather than assuming absence', async () => {
  const s=await setup(); s.target.Neutralino.filesystem.readDirectory=async()=>{throw new Error('Parent access denied');};
  await assert.rejects(s.save(),/Parent access denied/);
  assert.equal(s.target.__desktopFiles.get(s.original),'# original');
  assert.equal(s.target.__desktopFiles.has(s.destination),false);
});

test('distinct files differing only by case are still protected on a case-sensitive directory', async () => {
  const s = await setup();
  s.tab.title = 'before';
  const destination = s.storage.vaultPath + '/' + await s.storage._desktopDocumentRelativePath(s.tab, {folders:[]});
  s.target.__desktopFiles.set(destination, '# unrelated case-sensitive file');
  await assert.rejects(s.save(), /destination.*exists/i);
  assert.equal(s.target.__desktopFiles.get(s.original), '# original');
  assert.equal(s.target.__desktopFiles.get(destination), '# unrelated case-sensitive file');
});

test('case-sensitive parent folders are not mistaken for aliases', async () => {
  const s = await setup();
  const first = s.storage.vaultPath + '/Workspace/Folder';
  const second = s.storage.vaultPath + '/Workspace/folder';
  await s.target.Neutralino.filesystem.createDirectory(first);
  await s.target.Neutralino.filesystem.createDirectory(second);
  s.target.__desktopFiles.set(first + '/note.md', '# first');
  s.target.__desktopFiles.set(second + '/note.md', '# second');
  await assert.rejects(s.storage._desktopCheckMovePaths(first + '/note.md', second + '/note.md'), /destination.*exists/i);
});

test('POSIX move checks preserve literal backslashes when listing the original parent', async () => {
  const { target, storage } = await setup();
  target.NL_OS = 'Linux';
  const parent = '/home/notes\\literal';
  const sourcePath = parent + '/Before.md';
  const destination = parent + '/After.md';
  const listings = [];
  let names = ['Before.md'];
  target.Neutralino.filesystem.getStats = async path => {
    if (path === sourcePath) return { isFile: true, isDirectory: false };
    throw { code: 'NE_FS_NOPATHE' };
  };
  target.Neutralino.filesystem.readDirectory = async path => {
    listings.push(path);
    assert.equal(path, parent);
    return names.map(entry => ({ entry, type: 'FILE' }));
  };
  await storage._desktopCheckMovePaths(sourcePath, destination);
  names.push('After.md');
  await assert.rejects(storage._desktopCheckMovePaths(sourcePath, destination), /cannot be inspected/i);
  names = ['Before.md'];
  assert.equal(await storage._desktopPathsShareCaseAlias(sourcePath, parent + '/before.md'), true);
  names.push('before.md');
  assert.equal(await storage._desktopPathsShareCaseAlias(sourcePath, parent + '/before.md'), false);
  assert.equal(listings.length, 4);
});
