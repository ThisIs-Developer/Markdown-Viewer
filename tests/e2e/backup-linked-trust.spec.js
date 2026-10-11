const {test,expect}=require('@playwright/test');
const {openApp}=require('../helpers/app');
const JSZip=require('jszip');
const {installDesktopFilesystem}=require('../helpers/desktop-filesystem');
test('browser restore drops active source authority before future desktop use',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async()=>{
    const storage=new window.MarkdownWorkspaceStorage();await storage.init();
    const summary=await storage.restoreBackupData({organization:{version:1,workspaces:[],folders:[],ui:{},linkedLocations:[{id:'root',path:'C:/Private'}]},documents:[{metadata:{id:'recovered',title:'Recovered',sourcePath:'C:/Private/notes.md',sourceContentHash:'spoofed',linkedRootId:'root',sourceRelativePath:'notes.md',workspaceId:'workspace_default',isOpen:true},content:'# recovered draft'}],secretRecords:[]});
    const reopened=new window.MarkdownWorkspaceStorage();await reopened.init();
    return {summary,metadata:await reopened.listDocumentMetadata(),organization:await reopened.getDocumentOrganization(),content:await reopened.loadDocumentContent('recovered')};
  });
  expect(result.metadata[0].sourcePath).toBeUndefined();
  expect(result.metadata[0].sourceContentHash).toBeUndefined();
  expect(result.metadata[0].kind).toBe('linked-recovery');
  expect(result.organization.linkedLocations).toEqual([]);
  expect(result.content).toBe('# recovered draft');
  expect(result.summary.recoveredLinkedDocumentCount).toBe(1);
  await page.reload();
  await page.locator('#document-tree [data-document-id="recovered"] .document-tree-main').click();
  await expect(page.locator('#markdown-editor')).toHaveValue('# recovered draft');
  await expect(page.locator('#document-tree [data-document-id="recovered"] .document-tree-main')).toHaveAttribute('title',/Recovered draft.*No external file/);
  await expect(page.locator('[data-tree-type="linked-workspace"]')).toHaveCount(0);
});
test('desktop recovered draft has no native Save authority or external watchers after restart',async({page})=>{
  await page.addInitScript('('+installDesktopFilesystem.toString()+')(window);window.NL_OS="Windows";');
  await page.addInitScript(()=>{
    const saved=sessionStorage.getItem('trust-test-files');
    if(saved)JSON.parse(saved).forEach(([path,body])=>window.__desktopFiles.set(path,body));
    window.__trustExternalCalls=[];window.__trustPickers=0;
    for(const method of ['getStats','readFile','writeFile','readDirectory','createWatcher','copy','move','remove']){
      const call=Neutralino.filesystem[method];
      Neutralino.filesystem[method]=async(...args)=>{
        if(args.some(a=>typeof a==='string'&&a.startsWith('C:/Private')))window.__trustExternalCalls.push(method);
        return call(...args);
      };
    }
    Neutralino.os.showSaveDialog=async()=>{window.__trustPickers++;return '';};
  });
  await openApp(page);
  await page.evaluate(async()=>{
    window.__desktopFiles.set('C:/Private/notes.md','# external original');
    const storage=new window.MarkdownWorkspaceStorage();await storage.init();
    await storage.restoreBackupData({organization:{version:1,workspaces:[],folders:[],ui:{},linkedLocations:[{id:'root',path:'C:/Private'}]},documents:[{metadata:{id:'desktop-recovered',title:'Desktop Recovered',sourcePath:'C:/Private/notes.md',sourceContentHash:'untrusted',workspaceId:'workspace_default',isOpen:true},content:'# desktop recovery'}],secretRecords:[]});
    sessionStorage.setItem('trust-test-files',JSON.stringify(Array.from(window.__desktopFiles.entries())));
  });
  await page.reload();
  const row=page.locator('#document-tree [data-document-id="desktop-recovered"]');
  await row.locator('.document-tree-main').click();
  await expect(page.locator('#markdown-editor')).toHaveValue('# desktop recovery');
  await expect(row.locator('.document-tree-main')).toHaveAttribute('title',/No external file is connected/);
  await expect(page.locator('#document-tree [data-tree-type="linked-workspace"]')).toBeVisible();
  await row.dispatchEvent('contextmenu',{clientX:120,clientY:120});
  await expect(page.getByRole('menuitem',{name:'Save',exact:true})).toHaveCount(0);
  await expect(page.getByRole('menuitem',{name:'Reload from disk',exact:true})).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.locator('#markdown-editor').press('Control+s');
  await expect.poll(()=>page.evaluate(()=>window.__trustPickers)).toBe(1);
  expect(await page.evaluate(()=>window.__trustExternalCalls)).toEqual([]);
  expect(await page.evaluate(()=>window.__desktopFiles.get('C:/Private/notes.md'))).toBe('# external original');
});
test('ZIP import reports detached links and keeps imported draft after reload',async({page})=>{
  await openApp(page);
  const zip=new JSZip();
  zip.file('Workspace/Recovered.md','# ZIP recovery draft');
  zip.file('.markdown-viewer/documents.json',JSON.stringify([{metadata:{id:'zip-recovered',title:'ZIP Recovered',workspaceId:'workspace_default',isOpen:true,sourcePath:'C:/Private/notes.md',linkedRootId:'zip-root',sourceRelativePath:'notes.md',sourceContentHash:'untrusted-hash'},path:'Workspace/Recovered.md'}]));
  zip.file('.markdown-viewer/organization.json',JSON.stringify({version:1,workspaces:[],folders:[],ui:{},linkedLocations:[{id:'zip-root',name:'Private',path:'C:/Private'}]}));
  zip.file('.markdown-viewer/preferences.json','{}');
  zip.file('markdown-viewer-backup.json',JSON.stringify({format:'markdown-viewer-backup',version:1,normalDocumentCount:1,secureRecordCount:0,includesSecureWorkspace:false}));
  await page.getByRole('button',{name:'Open workspace settings'}).click();
  await page.locator('#storage-settings-button').click();
  await page.locator('#storage-backup-file-input').setInputFiles({name:'linked-trust.zip',mimeType:'application/zip',buffer:await zip.generateAsync({type:'nodebuffer'})});
  await page.locator('#storage-import-confirm-confirm').click();
  await expect(page.locator('#import-progress-detail')).toContainText('without external connections');
  await expect(page.locator('#document-tree [data-document-id="zip-recovered"]')).toBeVisible({timeout:20000});
  await page.locator('#document-tree [data-document-id="zip-recovered"] .document-tree-main').click();
  await expect(page.locator('#markdown-editor')).toHaveValue('# ZIP recovery draft');
  const state=await page.evaluate(async()=>{
    const storage=new window.MarkdownWorkspaceStorage();await storage.init();
    return {meta:(await storage.listDocumentMetadata()).find(x=>x.id==='zip-recovered'),org:await storage.getDocumentOrganization()};
  });
  expect(state.meta.sourcePath).toBeUndefined();expect(state.meta.kind).toBe('linked-recovery');expect(state.org.linkedLocations).toEqual([]);
});
