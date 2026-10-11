const {test,expect}=require('@playwright/test');
const {openApp}=require('../helpers/app');
const {installDesktopFilesystem}=require('../helpers/desktop-filesystem');
test('conversion collision preserves linked draft, unrelated Vault file and original',async({page})=>{
  await page.addInitScript('('+installDesktopFilesystem.toString()+')(window); window.NL_OS="Windows";');
  await openApp(page);
  const info=await page.evaluate(async()=>{
    window.__desktopFiles.set('C:/Original/move.md','# external original');
    await window.NL_IMPORT_EXTERNAL_FILE('# external original','move','C:/Original/move.md');
    await window.MarkdownViewerFlushWorkspace();
    const storage=new window.MarkdownWorkspaceStorage();await storage.init();
    const record=(await storage.listDocumentMetadata()).find(x=>x.sourcePath==='C:/Original/move.md');
    const vaultCopy={...record};delete vaultCopy.sourcePath;delete vaultCopy.sourceContentHash;
    const destination=storage.vaultPath+'/'+await storage._desktopDocumentRelativePath(vaultCopy,{folders:[]});
    window.__desktopFiles.set(destination,'# unrelated Vault body');
    return {id:record.id,destination};
  });
  await page.locator('#markdown-editor').fill('# live linked draft');
  await page.locator(`#document-tree [data-document-id="${info.id}"]`).dispatchEvent('contextmenu',{clientX:120,clientY:120});
  await page.getByRole('menuitem',{name:'Convert to Workspace copy',exact:true}).click();
  await expect(page.locator('.app-toast').filter({hasText:'destination already exists'})).toBeVisible();
  await expect(page.locator('.app-toast').filter({hasText:'Converted to Workspace copy'})).toHaveCount(0);
  await expect(page.locator('#markdown-editor')).toHaveValue('# live linked draft');
  const state=await page.evaluate(async info=>{
    await window.MarkdownViewerFlushWorkspace();
    const storage=new window.MarkdownWorkspaceStorage();await storage.init();
    const record=(await storage.listDocumentMetadata()).find(x=>x.id===info.id);
    return {source:record.sourcePath,draft:await storage.loadDocumentContent(info.id),collision:window.__desktopFiles.get(info.destination),original:window.__desktopFiles.get('C:/Original/move.md')};
  },info);
  expect(state).toEqual({source:'C:/Original/move.md',draft:'# live linked draft',collision:'# unrelated Vault body',original:'# external original'});
});
