const {test,expect}=require('@playwright/test');
const {setup,root,cloudAction}=require('../helpers/cloud-workspace');
const {storedDocuments}=require('../helpers/app');
const {installDesktopFilesystem}=require('../helpers/desktop-filesystem');
async function seed(page,linked=false){
 if(linked)await page.addInitScript('('+installDesktopFilesystem.toString()+')(window);');
 await page.addInitScript(linked=>{
  if(linked)return;
  if(localStorage.getItem('markdownViewerTabs'))return;
  const docs=[{id:'source-a',title:'alpha',content:'# Local alpha',folderId:linked?null:'copy-root'}, {id:'source-b',title:'beta.markdown',content:'# Local beta',folderId:linked?null:'copy-nested'}].map((item,i)=>({...item,workspaceId:'workspace_default',isOpen:true,createdAt:i+1,lastOpenedAt:i+1,...(linked?{sourcePath:'C:/Source/'+(i?'Nested/b.markdown':'a.md'),sourceRelativePath:i?'Nested/b.markdown':'a.md',linkedRootId:'source-link',sourceContentHash:'old-disk-version'}:{})}));
  localStorage.setItem('markdownViewerTabs',JSON.stringify(docs));
  localStorage.setItem('markdownViewerDocumentOrganization',JSON.stringify({version:1,workspaces:[],folders:linked?[]:[{id:'copy-root',name:'Project',workspaceId:'workspace_default',parentFolderId:null,expanded:true},{id:'copy-nested',name:'Nested',workspaceId:'workspace_default',parentFolderId:'copy-root',expanded:true},{id:'copy-empty',name:'Empty',workspaceId:'workspace_default',parentFolderId:'copy-root',expanded:true}],linkedLocations:linked?[{id:'source-link',name:'Source',path:'C:/Source',expanded:true}]:[],ui:{linkedWorkspaceExpanded:true}}));
  if(linked){__desktopFiles.set('C:/Source/a.md','# Disk alpha');__desktopFiles.set('C:/Source/Nested/b.markdown','# Disk beta');}
 },linked);
 await setup(page);
 if(linked){
  await page.evaluate(async()=>{await Neutralino.filesystem.createDirectory('C:/Source');await Neutralino.filesystem.createDirectory('C:/Source/Nested');__desktopFiles.set('C:/Source/a.md','# Local alpha');__desktopFiles.set('C:/Source/Nested/b.markdown','# Local beta');await NL_LINK_MARKDOWN_FOLDER_PATH('C:/Source');});
  return page.evaluate(async()=>{await MarkdownViewerFlushWorkspace();const storage=new MarkdownWorkspaceStorage();await storage.init();const records=await storage.listDocumentMetadata();return {id:records.find(d=>d.sourcePath==='C:/Source/a.md').id,rootId:records.find(d=>d.sourcePath==='C:/Source/a.md').linkedRootId};});
 }
 return {id:'source-a',rootId:'copy-root'};
}
async function recordsFor(page,linked){
 if(!linked)return storedDocuments(page);
 return page.evaluate(async()=>{await MarkdownViewerFlushWorkspace();const storage=new MarkdownWorkspaceStorage();await storage.init();const records=await storage.listDocumentMetadata();return Promise.all(records.map(async item=>({...item,content:await storage.loadDocumentContent(item.id)})));});
}
async function menu(page,selector){await page.locator(selector).dispatchEvent('contextmenu',{clientX:130,clientY:240});await page.locator('.document-menu-dropdown.open').getByRole('menuitem',{name:'Copy to cloud…',exact:true}).click();await expect(page.locator('#cloud-copy-modal')).toBeVisible();await expect(page.locator('#cloud-copy-modal .reset-modal-confirm')).toBeEnabled();}
async function start(page,name){await page.locator('#cloud-copy-name').fill(name);await page.locator('#cloud-copy-modal .reset-modal-confirm').click();}
for(const linked of [false,true]){
 test((linked?'Linked':'Vault')+' file copies current editor input and keeps original association',async({page})=>{
  const source=await seed(page,linked);await page.locator('#document-tree [data-document-id="'+source.id+'"] .document-tree-main').click();await page.locator('#markdown-editor').fill('# Latest unsaved alpha');
  await menu(page,'#document-tree [data-document-id="'+source.id+'"]');await start(page,'cloud-alpha.md');await expect(page.locator('.cloud-copy-status')).toContainText('Copy complete');
  expect(await page.evaluate(href=>__cloud.files[href].content,root+'cloud-alpha.md')).toBe('# Latest unsaved alpha');await expect(page.locator('#markdown-editor')).toHaveValue('# Latest unsaved alpha');
  const records=await recordsFor(page,linked);expect(records.find(d=>d.id===source.id).content).toBe('# Latest unsaved alpha');expect(records.find(d=>d.remoteSource?.fileRef===root+'cloud-alpha.md').content).toBe('# Latest unsaved alpha');
  if(linked){expect(await page.evaluate(()=>__desktopFiles.get('C:/Source/a.md'))).toBe('# Local alpha');expect(records.find(d=>d.id===source.id).sourcePath).toBe('C:/Source/a.md');}
  await page.locator('#cloud-copy-modal .reset-modal-confirm').click();await expect(page.locator('#cloud-copy-modal')).toHaveCount(0);await expect(page.locator('#tab-list .active')).toContainText('cloud-alpha.md');
 });
 test((linked?'Linked':'Vault')+' folder preserves nested Markdown paths and originals',async({page})=>{
  const source=await seed(page,linked);await menu(page,linked?'[data-tree-type="linked-location"][data-tree-id="'+source.rootId+'"]':'[data-tree-type="folder"][data-tree-id="copy-root"]');await start(page,'Folder copy');await expect(page.locator('.cloud-copy-status')).toContainText('Copy complete');
  const remote=await page.evaluate(()=>({files:__cloud.files,folders:__cloud.folders}));expect(remote.folders).toContain(root+'Folder%20copy/');expect(remote.folders).toContain(root+'Folder%20copy/Nested/');
  expect(Object.values(remote.files).map(d=>d.content)).toEqual(expect.arrayContaining(['# Local alpha','# Local beta']));expect(Object.keys(remote.files).some(p=>p.endsWith('.markdown'))).toBe(false);
  if(!linked)expect(remote.folders).toContain(root+'Folder%20copy/Empty/');
  const records=await recordsFor(page,linked);expect(records.find(d=>d.id===source.id).content).toBe('# Local alpha');expect(records.filter(d=>d.remoteSource?.fileRef.includes('Folder%20copy/'))).toHaveLength(2);
 });
}
test('copy cancellation performs no writes and occupied paths retain a recovery copy',async({page})=>{
 await seed(page);await menu(page,'#document-tree [data-document-id="source-a"]');await page.locator('#cloud-copy-modal .reset-modal-cancel').click();expect(await page.evaluate(()=>__cloud.requests.filter(r=>['PUT','MKCOL'].includes(r.method)))).toHaveLength(0);
 await menu(page,'#document-tree [data-document-id="source-a"]');await page.evaluate(root=>__cloud.files[root+'occupied.md']={content:'# Existing remote',etag:'"occupied"'},root);await start(page,'occupied.md');await expect(page.locator('.cloud-copy-status')).toContainText('already exists');expect(await page.evaluate(()=>__cloud.content)).toBe('# Original');
 const records=await storedDocuments(page);expect(records.some(d=>d.kind==='cloud-recovery' && d.content==='# Local alpha')).toBe(true);
});


test('stopping an in-flight folder copy settles one write and preserves remaining drafts on reload',async({page})=>{
 await seed(page);await menu(page,'[data-tree-type="folder"][data-tree-id="copy-root"]');await page.evaluate(()=>__cloud.mode='copy-blocked');await start(page,'Partial');
 await page.waitForFunction(()=>!!__cloud.finishCreate);await expect(page.locator('#cloud-copy-modal .reset-modal-cancel')).toBeFocused();await page.keyboard.press('Escape');await expect(page.locator('#cloud-copy-modal')).toBeVisible();await page.evaluate(()=>{__cloud.mode='';__cloud.finishCreate();});
 await expect(page.locator('.cloud-copy-status')).toContainText('Copy stopped');expect(await page.evaluate(()=>__cloud.requests.filter(r=>r.method==='PUT'))).toHaveLength(1);
 await page.locator('#cloud-copy-modal .reset-modal-cancel').click();await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true');
 const records=await storedDocuments(page);expect(records.filter(d=>d.remoteSource?.fileRef.includes('/Partial/'))).toHaveLength(2);expect(records.find(d=>d.id==='source-b').content).toBe('# Local beta');
});
test('invalid source descriptors and private mode cannot grant cloud copy authority',async({page})=>{
 await seed(page);await page.evaluate(()=>MarkdownCloudUI.copyLocal({type:'file',id:'does-not-exist'}));await expect(page.locator('#cloud-copy-modal')).toHaveCount(0);
 await page.getByRole('button',{name:'Open workspace settings',exact:true}).click();await page.locator('#private-mode-toggle').click();await page.evaluate(()=>MarkdownCloudUI.copyLocal({type:'file',id:'source-a'}));
 await expect(page.locator('#cloud-copy-modal')).toHaveCount(0);expect(await page.evaluate(()=>__cloud.requests.filter(r=>['PUT','MKCOL'].includes(r.method)))).toHaveLength(0);
});


test('the destination picker supports folder navigation and fits dark and small layouts',async({page})=>{
 await seed(page);await page.evaluate(()=>{document.documentElement.setAttribute('data-theme','dark');__cloud.listing=['Nested/'];});
 await menu(page,'#document-tree [data-document-id="source-a"]');await page.locator('.cloud-copy-folders button').filter({hasText:'Nested'}).click();await expect(page.locator('.cloud-copy-path')).toHaveText('Nested/');
 await expect(page.locator('.cloud-copy-up')).toBeEnabled();await page.locator('.cloud-copy-up').click();await expect(page.locator('.cloud-copy-path')).toHaveText('Files');
 await expect(page.locator('.cloud-copy-source')).toHaveText('alpha \u00b7 1 Markdown file(s)');
 await expect(page.locator('#cloud-copy-account')).toContainText(' \u00b7 Nextcloud \u00b7 alice');
 await page.screenshot({path:test.info().outputPath('cloud-copy-dark.png')});
 await page.setViewportSize({width:390,height:700});
 const bounds=await page.locator('#cloud-copy-modal .modal-box').boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(391);expect(bounds.height).toBeLessThanOrEqual(700);
 await expect(page.locator('#cloud-copy-modal .reset-modal-cancel')).toBeInViewport();
});


test('Escape cancels the picker without leaving a stale modal lock',async({page})=>{
 await seed(page);await menu(page,'#document-tree [data-document-id="source-a"]');await page.locator('#cloud-copy-name').press('Escape');await expect(page.locator('#cloud-copy-modal')).toHaveCount(0);
 await cloudAction(page,'New Markdown file');await expect(page.locator('#document-name-modal')).toBeVisible();await page.locator('#document-name-modal-cancel').click();
 expect(await page.evaluate(()=>__cloud.requests.filter(r=>['PUT','MKCOL'].includes(r.method)))).toHaveLength(0);
});


test('new linked members while choosing a destination require a new copy review',async({page})=>{
 const source=await seed(page,true);await menu(page,'[data-tree-type="linked-location"][data-tree-id="'+source.rootId+'"]');
 await page.evaluate(async()=>{__desktopFiles.set('C:/Source/late.md','# Added later');await NL_LINK_MARKDOWN_FOLDER_PATH('C:/Source');});
 await start(page,'Reviewed copy');await expect(page.locator('.cloud-copy-status')).toContainText('source folder changed');
 expect(await page.evaluate(()=>__cloud.requests.filter(r=>['PUT','MKCOL'].includes(r.method)))).toHaveLength(0);
});

test('portable copy names do not require renaming local files or folders',async({page})=>{
 await seed(page);
 const rename=async(selector,value)=>{await page.locator(selector).dispatchEvent('contextmenu',{clientX:120,clientY:200});await page.locator('.document-menu-dropdown.open').getByRole('menuitem',{name:'Rename',exact:true}).click();const input=page.locator('.document-tree-rename-input');await input.fill(value);await input.press('Enter');await expect(input).toHaveCount(0);};
 const file='#document-tree [data-document-id="source-a"]',folder='[data-tree-type="folder"][data-tree-id="copy-root"]';
 await rename(file,'Report:2026%');await menu(page,file);await expect(page.locator('#cloud-copy-name')).toHaveValue('Report_2026_.md');await page.locator('#cloud-copy-modal .reset-modal-cancel').click();
 await rename(folder,'Project:2026%');await menu(page,folder);await expect(page.locator('#cloud-copy-name')).toHaveValue('Project_2026_');await page.locator('#cloud-copy-modal .reset-modal-confirm').click();await expect(page.locator('.cloud-copy-status')).toContainText('Copy complete');
 expect(await page.evaluate(href=>__cloud.files[href].content,root+'Project_2026_/Report_2026_.md')).toBe('# Local alpha');
 const docs=await storedDocuments(page);expect(docs.find(d=>d.id==='source-a').title).toBe('Report:2026%');
});
