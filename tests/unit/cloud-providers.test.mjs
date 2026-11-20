import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
function setup(){
 const scope={URL,TextEncoder,crypto:webcrypto,console};vm.createContext(scope);
 for(const name of ['cloud-model','cloud-providers','webdav-source','nextcloud-source','nextcloud-provider','webdav-provider','cloud-operations'])vm.runInContext(fs.readFileSync(new URL('../../'+name+'.js',import.meta.url),'utf8'),scope);
 return scope;
}
const legacy={provider:'nextcloud',server:'https://cloud.example/subdir',userId:'alice',href:'https://cloud.example/subdir/remote.php/dav/files/alice/folder/a.md',etag:'"v1"',status:'uncertain',attemptDigest:'pending',deletePending:true};
test('Nextcloud and WebDAV are registered; old sources keep their identity and recovery path policy',async()=>{
 const scope=setup(),registry=scope.MarkdownCloudProviders;
 assert.deepEqual(Array.from(registry.list(),item=>item.id),['nextcloud','webdav']);
 const source=registry.normalizeSource(legacy);
 assert.equal(source.fileRef,legacy.href);assert.equal(source.version,legacy.etag);assert.equal(source.attemptDigest,'pending');assert.equal(source.deletePending,true);
 assert.equal(registry.sameFile(legacy,source),true);
 const policy=registry.recoveryIdentity(source);
 assert.equal(policy.accountIdentity,JSON.stringify([legacy.server,legacy.userId]));assert.deepEqual(Array.from(policy.folders),['folder']);
 const oldId=await scope.MarkdownCloudModel.digest(JSON.stringify([legacy.server,legacy.userId]));
 const calls=[];const client=await registry.get('nextcloud').restore({id:oldId,server:legacy.server,userId:legacy.userId},{request:async value=>{calls.push(value);throw Error('offline');}});
 assert.equal(await client.accountId(),oldId);
 await assert.rejects(client.identify(),/offline/);assert.equal(calls[0].providerId,'nextcloud');assert.equal(calls[0].auth.credentialId,oldId);
 await assert.rejects(registry.get('nextcloud').restore({id:'wrong',server:legacy.server,userId:legacy.userId},{}),/identity/);
});
test('unknown providers and contradictory legacy aliases cannot acquire remote authority',()=>{
 const {MarkdownCloudProviders:r}=setup();
 for(const value of [{...legacy,provider:'unknown'},{...legacy,providerId:'unknown'},{...legacy,fileRef:legacy.href.replace('a.md','b.md')},{...legacy,version:'"other"'},{...legacy,account:{server:'https://evil.example',userId:'alice'}}]){
   assert.throws(()=>r.normalizeSource(value));assert.equal(r.sameFile(legacy,value),false);
 }
 const normalized=r.normalizeSource({...legacy,accountKey:'forged-session-key'});assert.notEqual(normalized.accountKey,'forged-session-key');
 const saved=r.serializeSource({...r.normalizeSource(legacy),version:'"v2"'});assert.equal(saved.etag,'"v2"');assert.equal(saved.href,legacy.href);
});
function workflows(capabilities={read:true,conditionalSave:true,create:true,delete:true}){
 const scope=setup(),events=[],preferences={skipSaveConfirmation:true};
 scope.MarkdownCloudProviders.register({id:'test-only',label:'Synthetic',normalizeSource:x=>({...x,accountKey:'opaque-account'}),serializeSource:x=>x,recoveryIdentity:()=>({accountName:'Synthetic',accountIdentity:'opaque-account',folders:[]}),restore(){},connect(){}});
 const source=(ref,version='',fields={})=>({providerId:'test-only',accountKey:'opaque-account',fileRef:ref,version,...fields});
 let document={id:'draft',title:'a.md',content:'# New',remoteSource:source('opaque:file-17',{revision:1},{savedDigest:'old',status:'draft'})};
 const client={providerId:'test-only',account:{label:'My cloud',userLabel:'Alice'},capabilities,accountId:()=> 'opaque-account',source,
  folderRef:ref=>ref,childRef:(ref,name)=>ref+'|'+name,locationLabel:()=> 'Selected folder',validateFile:()=>{},isVersion:version=>Number.isInteger(version?.revision),
  async read(){return {content:'# Server',version:{revision:1}};},async readVersion(){return {revision:1};},
  async save(ref,version,body){events.push(['save',ref,version,body]);return {content:body,version:{revision:2}};},
  async create(ref,body){events.push(['create',ref,body]);return {content:body,version:{revision:1}};},async remove(ref,version){events.push(['delete',ref,version]);}
 };
 const context={api:{beginSave(){events.push(['lock']);},endSave(){events.push(['unlock']);},statusChanged(){},snapshot:async()=>structuredClone(document),confirm:async()=>{events.push(['confirm']);return true;},
  requestName:async()=> 'new.md',findRemote:()=>null,
  async updateRemote(id,remoteSource){events.push(['persist',remoteSource.status]);document.remoteSource=scope.MarkdownCloudProviders.serializeSource(remoteSource);return remoteSource.status;},
  async createRemoteDraft(content,title,remoteSource){events.push(['durable-create']);document={id:'created',content,title,remoteSource};return document.id;},
  async detachRemote(){events.push(['detach']);},notify(){}},
  sessions:new Map([['opaque-account',client]]),saves:new Set(),uploading:new Set(),reviewedVersions:new Map(),sessionKey:()=> 'opaque-account',clientFor:()=>client,accountState:()=>preferences,saveWorkspace:async()=>{},browse:async()=>{},message:(...args)=>events.push(['message',...args]),refresh(){},workspace:{enabled:true},isHidden:()=>false};
 return {operations:scope.MarkdownCloudOperations.create(context),events,context,client,get document(){return document;}};
}
test('shared save accepts opaque file IDs and structured versions with durable intent before upload',async()=>{
 const state=workflows();await state.operations.save('draft');
 assert.deepEqual(state.events.find(item=>item[0]==='save'),['save','opaque:file-17',{revision:1},'# New']);
 assert.ok(state.events.findIndex(item=>item[0]==='persist' && item[1]==='uncertain')<state.events.findIndex(item=>item[0]==='save'));
 assert.equal(state.document.remoteSource.version.revision,2);assert.equal(state.document.remoteSource.status,'saved');
 assert.equal(state.events.some(item=>item[0]==='confirm'),false,'existing account preference retained');
});
test('capabilities stop unsupported mutations even when handlers are called directly',async()=>{
 const state=workflows({read:true});
 await state.operations.save('draft');await assert.rejects(state.operations.newFile(state.client,'opaque-folder'),/support/);await assert.rejects(state.operations.deleteRemote(state.client,'opaque:file-17','a.md'),/support/);
 assert.equal(state.events.some(item=>['save','create','delete','durable-create'].includes(item[0])),false);
 assert.equal(state.document.remoteSource.status,'draft');
});
test('opaque create keeps durable intent and delete always confirms despite save opt-out',async()=>{
 const state=workflows();await state.operations.newFile(state.client,'opaque-folder');
 assert.ok(state.events.findIndex(item=>item[0]==='durable-create')<state.events.findIndex(item=>item[0]==='create'));
 await state.operations.deleteRemote(state.client,'opaque-folder|new.md','new.md','created');
 const confirmation=state.events.findIndex(item=>item[0]==='confirm'),deletion=state.events.findIndex(item=>item[0]==='delete');
 assert.ok(confirmation>=0 && deletion>confirmation);assert.ok(state.events.findIndex(item=>item[0]==='persist' && item[1]==='uncertain')<deletion);assert.equal(state.events.at(-1)[0],'unlock');
});
