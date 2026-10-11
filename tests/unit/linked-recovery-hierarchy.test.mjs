import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import mock from '../helpers/desktop-filesystem.js';
const source=fs.readFileSync(new URL('../../workspace-storage.js',import.meta.url),'utf8');
const vault='C:/Documents/Markdown Viewer Vault/';
const indexPath=vault+'.markdown-viewer/index.json';
async function setup(){
 const target={crypto:webcrypto,TextEncoder,console,localStorage:{getItem:()=>null,removeItem(){}}};target.self=target;target.window=target;
 mock.installDesktopFilesystem(target);vm.runInNewContext(source,target);
 const storage=new target.MarkdownWorkspaceStorage();await storage.init();
 const organization={folders:[],linkedLocations:[{id:'root-a',name:'Projects',path:'C:/Original/A'},{id:'root-b',name:'Projects',path:'C:/Original/B'}],ui:{}};
 await storage.saveDocumentOrganization(organization);
 return {target,storage,organization};
}
function draft(id='one',root='a',relative='sub/deep/notes.md'){
 return {id,title:'Notes',sourcePath:'C:/Original/'+root.toUpperCase()+'/'+relative,linkedRootId:'root-'+root,sourceRelativePath:relative,workspaceId:'workspace_default',content:'# draft '+id,contentLoaded:true};
}
test('same-named roots stay distinct and subfolders mirror source hierarchy without touching originals',async()=>{
 const {target,storage,organization}=await setup();const one=draft(),two=draft('two','b');
 for(const tab of [one,two])target.__desktopFiles.set(tab.sourcePath,'# original '+tab.id);
 await storage.saveDocuments([one,two],organization,{forceContent:true});
 assert.match(one._vaultRelativePath,/^Linked Workspace\/Projects--[a-f0-9]{32}\/sub\/deep\/Notes--[a-f0-9]{32}\.md$/);
 assert.notEqual(one._vaultRelativePath.split('/')[1],two._vaultRelativePath.split('/')[1]);
 const before=one._vaultRelativePath;await storage.saveDocuments([one],organization,{changedIds:[one.id]});assert.equal(one._vaultRelativePath,before);
 for(const tab of [one,two])assert.equal(target.__desktopFiles.get(tab.sourcePath),'# original '+tab.id);
});
async function legacy(){
 const state=await setup();const tab=draft();
 delete tab.linkedRootId;delete tab.sourceRelativePath;
 await state.storage.saveDocuments([tab],state.organization,{forceContent:true});
 const index=JSON.parse(state.target.__desktopFiles.get(indexPath));Object.assign(index.documents[0],{linkedRootId:'root-a',sourceRelativePath:'sub/deep/notes.md'});
 state.target.__desktopFiles.set(indexPath,JSON.stringify(index));
 return {...state,tab,oldPath:vault+tab._vaultRelativePath};
}
test('flat linked recovery migrates safely and remains readable after restart',async()=>{
 const {target,oldPath}=await legacy();const reopened=new target.MarkdownWorkspaceStorage();await reopened.init();
 const tab=(await reopened.listDocumentMetadata())[0];assert.match(tab._vaultRelativePath,/\/sub\/deep\//);
 assert.equal(await reopened.loadDocumentContent(tab.id),'# draft one');assert.equal(target.__desktopFiles.has(oldPath),false);
 const again=new target.MarkdownWorkspaceStorage();await again.init();assert.equal(await again.loadDocumentContent(tab.id),'# draft one');
});
for(const phase of ['before-index','after-index'])test('interrupted hierarchy migration recovers '+phase,async()=>{
 const {target}=await legacy();const write=target.Neutralino.filesystem.writeFile,remove=target.Neutralino.filesystem.remove;let failed=false;
 if(phase==='before-index')target.Neutralino.filesystem.writeFile=async(path,content)=>{if(!failed&&path.includes('/journal/')&&path.endsWith('.index.json')){failed=true;throw new Error('Interrupted migration');}return write(path,content);};
 else target.Neutralino.filesystem.remove=async path=>{if(!failed&&path.endsWith('.move.json')){failed=true;throw new Error('Interrupted cleanup');}return remove(path);};
 if(phase==='before-index')await assert.rejects(new target.MarkdownWorkspaceStorage().init(),/Interrupted/);
 else await new target.MarkdownWorkspaceStorage().init();
 const recovered=new target.MarkdownWorkspaceStorage();await recovered.init();
 const tab=(await recovered.listDocumentMetadata())[0];assert.match(tab._vaultRelativePath,/\/sub\/deep\//);assert.equal(await recovered.loadDocumentContent(tab.id),'# draft one');
});
test('occupied migration destination never overwrites either body',async()=>{
 const {target,storage,oldPath,organization}=await legacy();const item=JSON.parse(target.__desktopFiles.get(indexPath)).documents[0];
 const destination=vault+await storage._desktopDocumentRelativePath(item,organization);target.__desktopFiles.set(destination,'# occupied');
 await assert.rejects(new target.MarkdownWorkspaceStorage().init(),error=>error.code==='WORKSPACE_MOVE_BLOCKED');
 assert.equal(target.__desktopFiles.get(destination),'# occupied');assert.equal(target.__desktopFiles.get(oldPath),'# draft one');
});
test('backup restore keeps internal hierarchy but detaches original authority',async()=>{
 const {target,storage,organization}=await setup();const tab=draft();await storage.saveDocuments([tab],organization,{forceContent:true});
 const backup=await storage.createBackupData();const normalized=storage._normalizeBackupForRestore(backup);
 const restored=normalized.tabs[0];assert.equal(restored.sourcePath,undefined);assert.equal(restored.linkedRootId,undefined);
 assert.equal(restored.kind,'linked-recovery');assert.equal(await storage._desktopDocumentRelativePath(restored,normalized.organization),tab._vaultRelativePath);
 await storage.restoreBackupData(backup);const reopened=new target.MarkdownWorkspaceStorage();await reopened.init();
 const metadata=(await reopened.listDocumentMetadata())[0];assert.equal(metadata.sourcePath,undefined);assert.equal(metadata._vaultRelativePath,tab._vaultRelativePath);
 assert.equal(await reopened.loadDocumentContent(metadata.id),'# draft one');
});
test('index rebuilding retains nested recovery bodies and cannot invent source links',async()=>{
 const {target,storage,organization}=await setup();const tab=draft();await storage.saveDocuments([tab],organization,{forceContent:true});target.__desktopFiles.delete(indexPath);
 const rebuilt=new target.MarkdownWorkspaceStorage();await rebuilt.init();const item=(await rebuilt.listDocumentMetadata())[0];
 assert.equal(item.sourcePath,undefined);assert.equal(item.kind,'linked-recovery');assert.match(await rebuilt._desktopDocumentRelativePath(item,organization),/\/sub\/deep\//);
 assert.equal(await rebuilt.loadDocumentContent(item.id),'# draft one');
});
test('Trash restore and conversion respect recovery hierarchy and ordinary Vault destinations',async()=>{
 const {storage,organization,target}=await setup();const tab=draft();await storage.saveDocuments([tab],organization,{forceContent:true});const linkedPath=tab._vaultRelativePath;
 await storage.deleteDocument(tab.id);const trash=await storage.listTrash();await storage.restoreTrashItem(trash[0].trashId);
 const restored=(await storage.listDocumentMetadata())[0];assert.equal(restored._vaultRelativePath,linkedPath);
 restored.content=await storage.loadDocumentContent(restored.id);restored.contentLoaded=true;
 delete restored.sourcePath;delete restored.linkedRootId;delete restored.sourceRelativePath;
 await storage.saveDocuments([restored],organization,{changedIds:[restored.id]});assert.match(restored._vaultRelativePath,/^Workspace\//);
 assert.equal(target.__desktopFiles.has(vault+linkedPath),false);assert.equal(await storage.loadDocumentContent(restored.id),'# draft one');
});
for(const relative of ['../notes.md','/sub/notes.md','sub/../../notes.md','C:/outside.md'])test('reject unsafe relative hierarchy '+relative,async()=>{
 const {storage,organization}=await setup();await assert.rejects(storage._desktopDocumentRelativePath(draft('one','a',relative),organization),/Invalid linked/);
});
test('untrusted backup hierarchy cannot escape the internal recovery root',async()=>{
 const {storage}=await setup();assert.throws(()=>storage._normalizeBackupForRestore({documents:[{metadata:{id:'bad',sourcePath:'C:/Other.md',vaultRelativePath:'Linked Workspace/../Other.md'},content:'draft'}]}),/Invalid Linked Workspace/);
});

test('a mismatched root association cannot redirect recovery storage',async()=>{
 const {storage,organization}=await setup();const tab=draft();tab.sourcePath='C:/Other/notes.md';
 await assert.rejects(storage._desktopDocumentRelativePath(tab,organization),/does not belong/);
});

test('migration validates every draft before moving any body',async()=>{
 const {target,oldPath}=await legacy();const index=JSON.parse(target.__desktopFiles.get(indexPath));
 index.documents.push({...index.documents[0],id:'missing',vaultRelativePath:'Linked Workspace/missing.md'});
 target.__desktopFiles.set(indexPath,JSON.stringify(index));
 await assert.rejects(new target.MarkdownWorkspaceStorage().init());
 assert.equal(target.__desktopFiles.get(oldPath),'# draft one');
});

test('a partial multi-document move is rolled back before migration retries',async()=>{
 const {target,storage,organization}=await setup();const tabs=[draft('one'),draft('two')];
 for(const tab of tabs){delete tab.linkedRootId;delete tab.sourceRelativePath;}
 await storage.saveDocuments(tabs,organization,{forceContent:true});
 const index=JSON.parse(target.__desktopFiles.get(indexPath));
 for(const item of index.documents)Object.assign(item,{linkedRootId:'root-a',sourceRelativePath:'sub/deep/notes.md'});
 target.__desktopFiles.set(indexPath,JSON.stringify(index));
 const move=target.Neutralino.filesystem.move;let count=0;
 target.Neutralino.filesystem.move=async(...args)=>{if(++count===2)throw new Error('Interrupted second move');return move(...args);};
 await assert.rejects(new target.MarkdownWorkspaceStorage().init(),/Interrupted second move/);
 target.Neutralino.filesystem.move=move;
 const reopened=new target.MarkdownWorkspaceStorage();await reopened.init();
 for(const tab of tabs)assert.equal(await reopened.loadDocumentContent(tab.id),'# draft '+tab.id);
});

test('Trash restoration never overwrites an occupied hierarchical destination',async()=>{
 const {target,storage,organization}=await setup();const tab=draft();await storage.saveDocuments([tab],organization,{forceContent:true});
 const path=vault+tab._vaultRelativePath;await storage.deleteDocument(tab.id);const [item]=await storage.listTrash();
 target.__desktopFiles.set(path,'# occupied');
 await assert.rejects(storage.restoreTrashItem(item.trashId),error=>error.code==='WORKSPACE_MOVE_BLOCKED');
 assert.equal(target.__desktopFiles.get(path),'# occupied');assert.equal((await storage.listTrash()).length,1);
});
