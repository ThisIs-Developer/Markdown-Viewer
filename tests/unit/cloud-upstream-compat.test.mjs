import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import mock from '../helpers/desktop-filesystem.js';
const fixture=JSON.parse(fs.readFileSync(new URL('../fixtures/cloud/preview5-storage.json',import.meta.url),'utf8'));
const source=fs.readFileSync(new URL('../../workspace-storage.js',import.meta.url),'utf8');
async function reopen(){
  const target={URL,crypto:webcrypto,TextEncoder,console,localStorage:{getItem:()=>null,removeItem(){}}};target.self=target;target.window=target;mock.installDesktopFilesystem(target);
  for(const [name,body] of fixture.files){const parts=name.split('/');for(let end=2;end<parts.length;end++)await target.Neutralino.filesystem.createDirectory(parts.slice(0,end).join('/'));target.__desktopFiles.set(name,body);}
  for(const name of ['cloud-model','cloud-providers','webdav-source','nextcloud-source','nextcloud-provider','webdav-provider'])vm.runInNewContext(fs.readFileSync(new URL('../../'+name+'.js',import.meta.url),'utf8'),target); vm.runInNewContext(source,target);const store=new target.MarkdownWorkspaceStorage();await store.init();return {target,store};
}
test('upstream cloud port reopens preview-5 drafts, conflicts and unconfirmed uploads without changing their bodies or source versions',async()=>{
  const {target,store}=await reopen();
  for(const storage of [store,new target.MarkdownWorkspaceStorage()]){
    await storage.init();const metadata=await storage.listDocumentMetadata();assert.equal(metadata.length,fixture.expected.length);
    for(const expected of fixture.expected){const actual=metadata.find(doc=>doc.id===expected.id);assert.ok(actual);assert.equal(await storage.loadDocumentContent(actual.id),expected.content);assert.deepEqual(actual.remoteSource&&JSON.parse(JSON.stringify(actual.remoteSource)),expected.remoteSource);assert.equal(actual.kind,expected.kind);assert.match(actual._vaultRelativePath,expected.remoteSource||expected.kind==='cloud-recovery'?/^Cloud Workspace\//:/^Workspace\//);}
  }
  for(const [path,body] of fixture.files.filter(([name])=>name.endsWith('.md')))assert.equal(target.__desktopFiles.get(path),body);
});
test('preview-5 drafts remain exportable after upgrading without any server connection',async()=>{
  const {store}=await reopen();const backup=await store.createBackupData();
  for(const expected of fixture.expected){const actual=backup.documents.find(doc=>doc.metadata.id===expected.id);assert.ok(actual);assert.equal(actual.content,expected.content);assert.deepEqual(actual.metadata.remoteSource&&JSON.parse(JSON.stringify(actual.metadata.remoteSource)),expected.remoteSource);}
});