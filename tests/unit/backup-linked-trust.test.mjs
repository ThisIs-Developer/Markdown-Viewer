import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import mock from '../helpers/desktop-filesystem.js';
const source=fs.readFileSync(new URL('../../workspace-storage.js',import.meta.url),'utf8');
async function setup(){
  const target={crypto:webcrypto,TextEncoder,console,localStorage:{getItem:()=>null,removeItem(){}}};
  target.window=target;target.self=target;mock.installDesktopFilesystem(target);
  vm.runInNewContext(source,target);
  const storage=new target.MarkdownWorkspaceStorage();await storage.init();return {target,storage};
}
function backup(){return {
  organization:{version:1,workspaces:[],folders:[],ui:{},linkedLocations:[{id:'root',path:'C:/Private',name:'Private'}]},
  documents:[{metadata:{id:'untrusted',title:'Recovered notes',sourcePath:'C:/Private/notes.md',sourceContentHash:'fake',sourceKind:'file',linkedRootId:'root',sourceRelativePath:'notes.md',sourceMissing:false,sourceConflict:false,_vaultRelativePath:'../../Private/notes.md',vaultRelativePath:'../../Private/notes.md',_persistedContent:'fake',temporary:true,workspaceId:'workspace_default',favorite:true},content:'# imported draft'}],secretRecords:[]
};}
test('imported metadata is allowlisted and source paths/root associations are detached',async()=>{
  const {storage}=await setup();const input=backup();const result=storage._normalizeBackupForRestore(input);
  assert.equal(result.tabs[0].kind,'linked-recovery');assert.equal(result.tabs[0].content,'# imported draft');
  assert.equal(result.tabs[0].favorite,true);
  for(const key of ['sourcePath','sourceContentHash','sourceKind','linkedRootId','sourceRelativePath','vaultRelativePath','_vaultRelativePath','temporary','_persistedContent'])assert.equal(result.tabs[0][key],undefined,key);
  assert.equal(result.organization.linkedLocations.length,0);assert.equal(result.recoveredLinkedDocumentCount,1);
  assert.equal(input.documents[0].metadata.sourcePath,'C:/Private/notes.md');
});
test('desktop restore/reopen stores draft internally without any external file access',async()=>{
  const {target,storage}=await setup();target.__desktopFiles.set('C:/Private/notes.md','# actual private original');
  const accesses=[];
  for(const method of ['getStats','readFile','writeFile','readDirectory','copy','move','remove']){
    const call=target.Neutralino.filesystem[method];target.Neutralino.filesystem[method]=async(...args)=>{if(args.some(a=>typeof a==='string'&&a.startsWith('C:/Private')))accesses.push([method,...args]);return call(...args);};
  }
  const result=await storage.restoreBackupData(backup(),{preserveLocalLinks:true});
  assert.equal(result.recoveredLinkedDocumentCount,1);assert.equal(result.detachedLinkedLocationCount,1);
  const reopened=new target.MarkdownWorkspaceStorage();await reopened.init();
  const meta=(await reopened.listDocumentMetadata()).find(x=>x.id==='untrusted');
  assert.equal(meta.sourcePath,undefined);assert.equal(meta.kind,'linked-recovery');
  assert.match(meta._vaultRelativePath,/^Linked Workspace\//);
  assert.equal(await reopened.loadDocumentContent(meta.id),'# imported draft');
  assert.equal((await reopened.getDocumentOrganization()).linkedLocations.length,0);
  assert.deepEqual(accesses,[]);assert.equal(target.__desktopFiles.get('C:/Private/notes.md'),'# actual private original');
});
test('failed desktop import rollback preserves trusted pre-existing links and roots',async()=>{
  const {target,storage}=await setup();
  const local={id:'local',title:'Local',content:'# local draft',contentLoaded:true,workspaceId:'workspace_default',sourcePath:'C:/Original/local.md',sourceContentHash:'local-hash',linkedRootId:'local-root',sourceRelativePath:'local.md'};
  const org={version:1,workspaces:[],folders:[],ui:{},linkedLocations:[{id:'local-root',path:'C:/Original',name:'Local'}]};
  await storage.saveDocumentOrganization(org);await storage.saveDocuments([local],org,{forceContent:true});
  const save=storage.saveDocuments.bind(storage);let first=true;
  storage.saveDocuments=async(...args)=>{if(first){first=false;throw new Error('Injected import failure');}return save(...args);};
  await assert.rejects(storage.restoreBackupData(backup()),/Injected import failure/);
  const reopened=new target.MarkdownWorkspaceStorage();await reopened.init();
  const meta=(await reopened.listDocumentMetadata()).find(x=>x.id==='local');
  assert.equal(meta.sourcePath,'C:/Original/local.md');assert.equal(meta.sourceContentHash,'local-hash');
  assert.equal(await reopened.loadDocumentContent('local'),'# local draft');
  assert.equal((await reopened.getDocumentOrganization()).linkedLocations[0].path,'C:/Original');
});
test('ordinary documents and linked guide remain editable without fabricated links',async()=>{
  const {storage}=await setup();const data=backup();data.documents=[
    {metadata:{id:'normal',title:'Normal',folderId:'folder',workspaceId:'workspace_default',viewMode:'split'},content:'# normal'},
    {metadata:{id:'guide',title:'Guide',kind:'linked-workspace-guide'},content:'# guide'},
    {metadata:{id:'vault-guide',title:'Renamed guide',kind:'workspace-guide'},content:'# edited guide'}];
  const n=storage._normalizeBackupForRestore(data);
  assert.equal(n.tabs[0].folderId,'folder');assert.equal(n.tabs[0].kind,undefined);
  assert.equal(n.tabs[1].kind,'linked-workspace-guide');assert.equal(n.tabs[1].sourcePath,undefined);
  assert.equal(n.tabs[2].kind,'workspace-guide');assert.equal(n.tabs[2].sourcePath,undefined);
});
