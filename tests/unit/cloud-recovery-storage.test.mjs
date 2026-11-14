import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import mock from '../helpers/desktop-filesystem.js';
const code = fs.readFileSync(new URL('../../workspace-storage.js', import.meta.url), 'utf8');
const vault = 'C:/Documents/Markdown Viewer Vault/';
const indexPath = vault + '.markdown-viewer/index.json';
const remoteSource = { provider:'nextcloud', server:'https://cloud.example', userId:'alice', href:'https://cloud.example/remote.php/dav/files/alice/sub/notes.md', etag:'"v1"', savedDigest:'original', status:'draft' };
async function setup() {
  const target = { URL, crypto:webcrypto, TextEncoder, console, localStorage:{ getItem:() => null, removeItem() {} } }; target.self = target; target.window = target;
  mock.installDesktopFilesystem(target); for(const name of ['cloud-model','cloud-providers','webdav-source','nextcloud-source','nextcloud-provider','webdav-provider'])vm.runInNewContext(fs.readFileSync(new URL('../../'+name+'.js',import.meta.url),'utf8'),target); vm.runInNewContext(code,target);
  const storage = new target.MarkdownWorkspaceStorage(); await storage.init();
  return { target, storage, organization:{ folders:[], linkedLocations:[], ui:{} } };
}
function tab(id = 'cloud-one') { return { id, title:'Notes', workspaceId:'workspace_default', content:'# My unsaved cloud draft', contentLoaded:true, remoteSource:{ ...remoteSource } }; }
async function legacy() {
  const state = await setup(); const old = tab(); delete old.remoteSource;
  await state.storage.saveDocuments([old],state.organization,{forceContent:true});
  const index = JSON.parse(state.target.__desktopFiles.get(indexPath)); index.documents[0].remoteSource = { ...remoteSource };
  state.target.__desktopFiles.set(indexPath,JSON.stringify(index));
  return { ...state, oldPath:vault + old._vaultRelativePath };
}
test('cloud recovery has its own root and preserves account and folder identity', async () => {
  const {storage,target,organization} = await setup(); const draft = tab();
  await storage.saveDocuments([draft],organization,{forceContent:true});
  assert.match(draft._vaultRelativePath,/^Cloud Workspace\/cloud.example - alice--[a-f0-9]{32}\/sub\/Notes--[a-f0-9]{32}\.md$/);
  assert.equal(target.__desktopFiles.get(vault + draft._vaultRelativePath),draft.content);
  const other = tab('other'); other.remoteSource.userId = 'bob'; other.remoteSource.href = other.remoteSource.href.replace('/alice/','/bob/');
  assert.notEqual((await storage._desktopDocumentRelativePath(other,organization)).split('/')[1],draft._vaultRelativePath.split('/')[1]);
});
test('old Vault cloud drafts migrate with content, source, ETag and dirty state intact', async () => {
  const {target,oldPath} = await legacy(); const storage = new target.MarkdownWorkspaceStorage(); await storage.init();
  const item = (await storage.listDocumentMetadata())[0];
  assert.match(item._vaultRelativePath,/^Cloud Workspace\//);
  assert.equal(await storage.loadDocumentContent(item.id),'# My unsaved cloud draft');
  assert.deepEqual(JSON.parse(JSON.stringify(item.remoteSource)),remoteSource);
  assert.equal(target.__desktopFiles.has(oldPath),false);
  const again = new target.MarkdownWorkspaceStorage(); await again.init();
  assert.equal(await again.loadDocumentContent(item.id),'# My unsaved cloud draft');
});
for (const phase of ['before-index','after-index']) test('interrupted cloud migration recovers ' + phase, async () => {
  const {target} = await legacy(); const write = target.Neutralino.filesystem.writeFile; const remove = target.Neutralino.filesystem.remove; let failed = false;
  if (phase === 'before-index') target.Neutralino.filesystem.writeFile = async (path,content) => { if (!failed && path.includes('/journal/') && path.endsWith('.index.json')) { failed = true; throw new Error('Interrupted migration'); } return write(path,content); };
  else target.Neutralino.filesystem.remove = async path => { if (!failed && path.endsWith('.move.json')) { failed = true; throw new Error('Interrupted cleanup'); } return remove(path); };
  if (phase === 'before-index') await assert.rejects(new target.MarkdownWorkspaceStorage().init()); else await new target.MarkdownWorkspaceStorage().init();
  const recovered = new target.MarkdownWorkspaceStorage(); await recovered.init(); const item = (await recovered.listDocumentMetadata())[0];
  assert.match(item._vaultRelativePath,/^Cloud Workspace\//); assert.equal(await recovered.loadDocumentContent(item.id),'# My unsaved cloud draft');
});
test('occupied cloud destination preserves both bodies', async () => {
  const {target,storage,oldPath,organization} = await legacy();
  const item = JSON.parse(target.__desktopFiles.get(indexPath)).documents[0];
  const destination = vault + await storage._desktopDocumentRelativePath(item,organization);
  target.__desktopFiles.set(destination,'# Occupied');
  await assert.rejects(new target.MarkdownWorkspaceStorage().init(),error => error.code === 'WORKSPACE_MOVE_BLOCKED');
  assert.equal(target.__desktopFiles.get(destination),'# Occupied'); assert.equal(target.__desktopFiles.get(oldPath),'# My unsaved cloud draft');
});

test('partial multi-document migration preserves every draft after restart', async () => {
  const {target,storage,organization} = await setup();
  const drafts = [tab('first'),tab('second')];
  drafts.forEach((draft,index) => { delete draft.remoteSource; draft.content = '# Unique draft ' + index; });
  await storage.saveDocuments(drafts,organization,{forceContent:true});
  const index = JSON.parse(target.__desktopFiles.get(indexPath));
  index.documents.forEach(item => { item.remoteSource = {...remoteSource}; });
  target.__desktopFiles.set(indexPath,JSON.stringify(index));
  const move = target.Neutralino.filesystem.move; let count = 0;
  target.Neutralino.filesystem.move = async (from,to) => {
    if (to.includes('/Cloud Workspace/') && ++count === 2) throw new Error('Second draft interrupted');
    return move(from,to);
  };
  await assert.rejects(new target.MarkdownWorkspaceStorage().init(),/Second draft interrupted/);
  target.Neutralino.filesystem.move = move;
  const reopened = new target.MarkdownWorkspaceStorage(); await reopened.init();
  for (const draft of drafts) {
    assert.equal(await reopened.loadDocumentContent(draft.id),draft.content);
    const metadata = (await reopened.listDocumentMetadata()).find(item => item.id === draft.id);
    assert.match(metadata._vaultRelativePath,/^Cloud Workspace\//);
    assert.deepEqual(JSON.parse(JSON.stringify(metadata.remoteSource)),remoteSource);
  }
});
test('all migration bodies are validated before the first cloud draft moves', async () => {
  const {target,oldPath} = await legacy(); const index = JSON.parse(target.__desktopFiles.get(indexPath));
  index.documents.push({ ...index.documents[0], id:'missing', vaultRelativePath:'Workspace/missing.md' });
  target.__desktopFiles.set(indexPath,JSON.stringify(index));
  await assert.rejects(new target.MarkdownWorkspaceStorage().init());
  assert.equal(target.__desktopFiles.get(oldPath),'# My unsaved cloud draft');
});
test('backup restore preserves cloud recovery grouping without importing server authority', async () => {
  const {storage,target,organization} = await setup(); const draft = tab(); await storage.saveDocuments([draft],organization,{forceContent:true});
  const backup = await storage.createBackupData(); const normalized = storage._normalizeBackupForRestore(backup);
  assert.equal(normalized.tabs[0].remoteSource,undefined); assert.equal(normalized.tabs[0].kind,'cloud-recovery');
  assert.equal(await storage._desktopDocumentRelativePath(normalized.tabs[0],normalized.organization),draft._vaultRelativePath);
  await storage.restoreBackupData(backup); const reopened = new target.MarkdownWorkspaceStorage(); await reopened.init();
  const item = (await reopened.listDocumentMetadata())[0]; assert.equal(item.remoteSource,undefined);
  assert.equal(await reopened.loadDocumentContent(item.id),'# My unsaved cloud draft');
});
test('index rebuild preserves Cloud Workspace bodies as detached recovery documents', async () => {
  const {storage,target,organization} = await setup(); const draft = tab(); await storage.saveDocuments([draft],organization,{forceContent:true}); target.__desktopFiles.delete(indexPath);
  const rebuilt = new target.MarkdownWorkspaceStorage(); await rebuilt.init(); const item = (await rebuilt.listDocumentMetadata())[0];
  assert.equal(item.remoteSource,undefined); assert.equal(item.kind,'cloud-recovery'); assert.match(item._vaultRelativePath,/^Cloud Workspace\//);
  assert.equal(await rebuilt.loadDocumentContent(item.id),'# My unsaved cloud draft');
});
test('Trash restores cloud source identity and its separate recovery root', async () => {
  const {storage,organization} = await setup(); const draft = tab(); await storage.saveDocuments([draft],organization,{forceContent:true});
  await storage.deleteDocument(draft.id); const trash = await storage.listTrash(); await storage.restoreTrashItem(trash[0].trashId);
  const item = (await storage.listDocumentMetadata())[0]; assert.match(item._vaultRelativePath,/^Cloud Workspace\//);
  assert.equal(item.remoteSource.href,remoteSource.href); assert.equal(await storage.loadDocumentContent(item.id),draft.content);
});
for (const href of ['https://evil.example/a.md','https://cloud.example/remote.php/dav/files/bob/a.md','https://cloud.example/remote.php/dav/files/alice/a%2Fb.md']) test('unsafe cloud identity cannot redirect local recovery: ' + href, async () => {
  const {storage,organization} = await setup(); const draft = tab(); draft.remoteSource.href = href;
  await assert.rejects(storage._desktopDocumentRelativePath(draft,organization));
});

test('confirmed cloud deletion detaches the same durable desktop draft into local cloud recovery and survives reopen',async()=>{
  const {storage,target,organization}=await setup();const draft=tab('deleted-cloud-draft');
  await storage.saveDocuments([draft],organization,{forceContent:true});
  draft.remoteSource={...draft.remoteSource,status:'uncertain',deletePending:true};
  await storage.saveDocuments([draft],organization,{forceContent:true});
  const body=draft.content;
  draft.kind='cloud-recovery';delete draft.remoteSource;
  await storage.saveDocuments([draft],organization,{forceContent:true});
  assert.match(draft._vaultRelativePath,/^Cloud Workspace\/[^/]+\.md$/);
  assert.equal(target.__desktopFiles.get(vault+draft._vaultRelativePath),body);
  const reopened=new target.MarkdownWorkspaceStorage();await reopened.init();
  const metadata=(await reopened.listDocumentMetadata()).find(item=>item.id===draft.id);
  assert.equal(metadata.kind,'cloud-recovery');assert.equal(metadata.remoteSource,undefined);
  assert.equal(await reopened.loadDocumentContent(draft.id,{fresh:true}),body);
});

 test('cloud remote folder labels retain the legacy portable recovery mapping',async()=>{
  const {storage,organization}=await setup(),draft=tab();
  draft.remoteSource.href=draft.remoteSource.href.replace('/sub/','/a%3Ab/');
  const path=await storage._desktopDocumentRelativePath(draft,organization);
  assert.match(path,/^Cloud Workspace\/cloud.example - alice--[a-f0-9]{32}\/a b\//);
 });

test('WebDAV desktop drafts have separate identities and survive reopen and backup beside Nextcloud',async()=>{
 const {target,storage,organization}=await setup(),nextcloud=tab('nc-retained');
 const dav=tab('dav-retained');dav.content='# Local DAV edits';dav.remoteSource={providerId:'webdav',sourceVersion:2,account:{root:'https://cloud.example/dav/selected/',username:'alice'},fileRef:'https://cloud.example/dav/selected/sub/notes.md',version:'"dav"',savedDigest:'original',status:'uncertain',deletePending:true};
 await storage.saveDocuments([nextcloud,dav],organization,{forceContent:true});
 assert.notEqual(dav._vaultRelativePath,nextcloud._vaultRelativePath);assert.match(dav._vaultRelativePath,/^Cloud Workspace\/WebDAV - cloud.example - alice--[a-f0-9]{32}\/sub\//);
 const reopened=new target.MarkdownWorkspaceStorage();await reopened.init();
 const docs=await reopened.listDocumentMetadata();assert.equal(docs.length,2);
 assert.equal(await reopened.loadDocumentContent(dav.id),'# Local DAV edits');assert.equal(await reopened.loadDocumentContent(nextcloud.id),nextcloud.content);
 assert.deepEqual(JSON.parse(JSON.stringify(docs.find(item=>item.id===dav.id).remoteSource)),dav.remoteSource);
 const backup=await reopened.createBackupData();assert.equal(backup.documents.find(item=>item.metadata.id===dav.id).content,dav.content);
});
