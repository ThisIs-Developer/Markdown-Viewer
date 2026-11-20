import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
const context=vm.createContext({TextEncoder,crypto:webcrypto});
for(const file of ['cloud-model.js','cloud-copy.js'])vm.runInContext(await readFile(file,'utf8'),context);
const copy=context.MarkdownCloudCopy;
const plan={folder:true,folders:[['Nested']],files:[{path:['a.md'],content:'# Unsaved'},{path:['Nested','b.md'],content:'# Second'}]};
function fixture({failPersist=0,failFile=0,folderConflict=false,cancelAfter=0,failUpdate=false}={}){
 const bodies=new Map(),events=[],drafts=new Map(),saves=new Set();let writes=0,created=0;
 const client={root:'https://dav.example/root/',source:(href,version='',fields={})=>({...fields,fileRef:href,version}),childRef:(parent,name)=>parent+encodeURIComponent(name),folderRef:ref=>ref.replace(/\/?$/,'/'),validateRef:ref=>assert.ok(ref.startsWith('https://dav.example/root/')),validateFile:ref=>assert.ok(ref.endsWith('.md')),fileName:ref=>ref.split('/').at(-1),
  createFolder:async href=>{events.push('mkdir');if(folderConflict)throw Object.assign(Error('occupied'),{code:'CONFLICT'});bodies.set(href,'folder');},
  create:async(href,content)=>{events.push('put');writes++;bodies.set(href,content);if(failFile===writes)throw Object.assign(Error('lost reply'),{code:'UNCERTAIN'});return {version:'"created"'};}};
 const api={findRemote:()=>null,statusChanged(){},createRemoteDraft:async(content,name,source)=>{events.push('persist');created++;if(failPersist===created)throw Error('disk full');const id=String(created);drafts.set(id,{content,name,source});return id;},updateRemote:async(id,source)=>{if(failUpdate)throw Error('disk failed after write');drafts.get(id).source=source;},detachRemote:async id=>{delete drafts.get(id).source;}};
 return {client,api,saves,bodies,events,drafts,run:()=>copy.execute({plan,client,api,saves,parent:client.root,name:'Copy',isConnected:()=>true,cancelled:()=>!!cancelAfter && writes>=cancelAfter})};
}
test('folder copy persists every body before writes and keeps exact nested paths',async()=>{const f=fixture();const r=await f.run();assert.equal(r.completed,2);assert.deepEqual(f.events,['persist','persist','mkdir','mkdir','put','put']);assert.equal(f.bodies.get('https://dav.example/root/Copy/Nested/b.md'),'# Second');assert.equal(f.saves.size,0);});
test('partial local persistence failure starts no remote writes',async()=>{const f=fixture({failPersist:2});await assert.rejects(f.run(),/disk full/);assert.equal(f.bodies.size,0);assert.equal(f.drafts.get('1').content,'# Unsaved');assert.equal(f.drafts.get('1').source,undefined);});
test('existing root never merges, uploads or discards recovery bodies',async()=>{const f=fixture({folderConflict:true});await assert.rejects(f.run(),/occupied/);assert.equal(f.events.filter(x=>x==='put').length,0);assert.ok([...f.drafts.values()].every(d=>!d.source));});
test('lost acknowledgement stops the batch and keeps uncertain drafts without retry or cleanup',async()=>{const f=fixture({failFile:1});await assert.rejects(f.run(),/lost reply/);assert.equal(f.events.filter(x=>x==='put').length,1);assert.equal(f.drafts.get('1').source.status,'uncertain');assert.equal(f.drafts.get('2').content,'# Second');assert.equal(f.saves.size,0);});
test('cancellation after a completed file leaves verified and pending recovery intact',async()=>{const f=fixture({cancelAfter:1});await assert.rejects(f.run(),/Copy stopped/);assert.equal(f.events.filter(x=>x==='put').length,1);assert.equal(f.drafts.get('1').source.status,'saved');assert.equal(f.drafts.get('2').source.status,'uncertain');});
test('failure to persist acknowledgement does not replay a successful remote write',async()=>{const f=fixture({failUpdate:true});await assert.rejects(f.run(),/disk failed after write/);assert.equal(f.events.filter(x=>x==='put').length,1);assert.equal(f.drafts.get('1').source.status,'uncertain');});
test('malicious paths, case collisions, missing parents and oversized batches fail before writes',()=>{
 for(const bad of [{...plan,folders:[['..']]},{...plan,folders:[['%2e']]},{...plan,files:[{path:['a.md'],content:''},{path:['A.md'],content:''}]},{...plan,files:[{path:['missing','a.md'],content:''}]},{...plan,files:[{path:['image.png'],content:''}]},{...plan,files:Array.from({length:501},(_,i)=>({path:[i+'.md'],content:''}))}])assert.throws(()=>copy.validatePlan(bad));
});

test('local display names get bounded portable proposals without weakening manual path validation',()=>{
 assert.equal(copy.suggestName('Project:2026%'),'Project_2026_');
 assert.equal(copy.suggestName('Report:2026%.markdown',{file:true}),'Report_2026_.md');
 assert.equal(copy.suggestName('CON',{file:true}),'_CON.md');
 assert.equal(copy.suggestName('notes.txt',{file:true}),'notes.txt.md');
 assert.ok(new TextEncoder().encode(copy.suggestName('Δ'.repeat(180),{file:true})).length<=160);
 assert.throws(()=>copy.segment('../Outside'));
});
