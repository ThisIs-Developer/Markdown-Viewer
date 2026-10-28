const {test,expect}=require('@playwright/test');
const {openApp}=require('../helpers/app');
const {installDesktopFilesystem}=require('../helpers/desktop-filesystem');
const key='markdownViewerOriginalSaveWarningDisabled';
async function setup(page){
  await page.addInitScript('('+installDesktopFilesystem.toString()+')(window); window.NL_TOKEN="test-token";');
  await openApp(page);
  await page.evaluate(async()=>{
    __desktopFiles.set('C:/Original/one.md','# original');
    await NL_IMPORT_EXTERNAL_FILE('# original','one','C:/Original/one.md');
    await MarkdownViewerFlushWorkspace();
  });
  await page.locator('#markdown-editor').fill('# draft');
}
const prompt=page=>page.getByRole('alertdialog',{name:'Save to original file?',exact:true});
async function save(page,context=false){
  if(context){
    await page.locator('#document-tree [data-tree-type="document"]').filter({hasText:'one'}).dispatchEvent('contextmenu',{clientX:120,clientY:120});
    await page.locator('.document-menu-context.open').getByRole('menuitem',{name:'Save',exact:true}).click();
  }else await page.locator('#markdown-editor').press('Control+s');
}

for(const context of [false,true])test((context?'context Save':'Ctrl+S')+' saves directly without an ordinary confirmation',async({page})=>{
  await setup(page);await save(page,context);
  await expect.poll(()=>page.evaluate(()=>__desktopFiles.get('C:/Original/one.md'))).toBe('# draft');
  await expect(prompt(page)).toHaveCount(0);
  await expect(page.locator('[data-original-save-warning-toggle]')).toHaveCount(0);
});
for(const value of ['true','false'])test('legacy warning preference '+value+' does not block saving',async({page})=>{
  await setup(page);await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key,value});
  await save(page);
  await expect.poll(()=>page.evaluate(()=>__desktopFiles.get('C:/Original/one.md'))).toBe('# draft');
  await expect(prompt(page)).toHaveCount(0);
});
async function conflict(page,missing=false){
  await setup(page);
  await page.evaluate(missing=>{
    if(missing)__desktopFiles.delete('C:/Original/one.md');
    else __desktopFiles.set('C:/Original/one.md','# external edits');
  },missing);
  await save(page);
  return page.getByRole('alertdialog',{name:missing?'Recreate linked file?':'Overwrite original file?',exact:true});
}
for(const missing of [false,true])test((missing?'missing source':'conflict')+' still requires explicit approval',async({page})=>{
  const dialog=await conflict(page,missing);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:'Keep draft',exact:true}).click();
  expect(await page.evaluate(()=>__desktopFiles.get('C:/Original/one.md'))).toBe(missing?undefined:'# external edits');
  await expect(page.locator('#markdown-editor')).toHaveValue('# draft');
});
for(const changed of ['draft','original'])test(changed+' changes during conflict confirmation cancel the stale save',async({page})=>{
  const dialog=await conflict(page);
  if(changed==='draft')await page.locator('#markdown-editor').fill('# newer draft');
  else await page.evaluate(()=>__desktopFiles.set('C:/Original/one.md','# newer original'));
  await dialog.getByRole('button',{name:'Overwrite original',exact:true}).click();
  await expect(page.locator('.app-toast').filter({hasText:'Save cancelled'})).toBeVisible();
  expect(await page.evaluate(()=>__desktopFiles.get('C:/Original/one.md'))).toBe(changed==='draft'?'# external edits':'# newer original');
});
test('web no longer contains the desktop confirmation setting',async({page})=>{
  await openApp(page);
  await expect(page.locator('[data-original-save-warning-toggle]')).toHaveCount(0);
});
for(const dismissal of ['Escape','close','backdrop'])test(dismissal+' safely cancels a conflict',async({page})=>{
  const dialog=await conflict(page);
  if(dismissal==='Escape')await dialog.getByRole('button',{name:'Keep draft',exact:true}).press('Escape');
  else if(dismissal==='backdrop')await dialog.click({position:{x:5,y:5}});
  else await dialog.getByRole('button',{name:'Close confirmation',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(()=>__desktopFiles.get('C:/Original/one.md'))).toBe('# external edits');
});
for(const theme of ['light','dark'])test('conflict confirmation is centered and keyboard-contained in '+theme+' theme',async({page})=>{
  const dialog=await conflict(page);
  await page.evaluate(theme=>document.documentElement.setAttribute('data-theme',theme),theme);
  await expect(dialog.getByRole('button',{name:'Keep draft',exact:true})).toBeFocused();
  const box=await dialog.locator('.linked-confirm-modal-box').boundingBox(),viewport=page.viewportSize();
  expect(Math.abs(box.x+box.width/2-viewport.width/2)).toBeLessThan(3);
  expect(Math.abs(box.y+box.height/2-viewport.height/2)).toBeLessThan(3);
  await dialog.getByRole('button',{name:'Overwrite original',exact:true}).focus();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button',{name:'Close confirmation',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#markdown-editor')).toBeFocused();
});
test('replacing a conflict confirmation cancels safely and permits another Save',async({page})=>{
  const dialog=await conflict(page);
  await page.getByRole('button',{name:'About Markdown Viewer',exact:true}).evaluate(button=>button.click());
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(()=>__desktopFiles.get('C:/Original/one.md'))).toBe('# external edits');
  await page.locator('#about-modal-close').click();
  await expect(page.locator('#about-modal')).toBeHidden();
  await save(page);await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:'Keep draft',exact:true}).click();
});
test('Save As does not ask the ordinary original-save confirmation',async({page})=>{
  await setup(page);
  await page.evaluate(()=>{Neutralino.os.showSaveDialog=async()=> 'C:/Original/new.md';});
  await page.locator('#document-tree [data-tree-type="document"]').filter({hasText:'one'}).dispatchEvent('contextmenu',{clientX:120,clientY:120});
  await page.locator('.document-menu-context.open').getByRole('menuitem',{name:'Save As…',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>__desktopFiles.get('C:/Original/new.md'))).toBe('# draft');
  await expect(prompt(page)).toHaveCount(0);
  expect(await page.evaluate(()=>__desktopFiles.get('C:/Original/one.md'))).toBe('# original');
});
for(const theme of ['light','dark'])test('only content replacement confirmations are red in '+theme+' theme',async({page})=>{
  await setup(page);
  await page.evaluate(theme=>document.documentElement.setAttribute('data-theme',theme),theme);
  const menu=async name=>{
    await page.locator('#document-tree [data-tree-type="document"]').filter({hasText:'one'}).dispatchEvent('contextmenu',{clientX:120,clientY:120});
    await page.locator('.document-menu-context.open').getByRole('menuitem',{name,exact:true}).click();
  };
  const checkDanger=async title=>{
    const dialog=page.getByRole('alertdialog',{name:title,exact:true});
    const button=dialog.locator('#linked-confirm-modal-confirm');
    await expect(button).toHaveClass(/linked-confirm-danger/);
    await expect(button).toHaveCSS('background-color','rgb(182, 35, 36)');
    await button.hover();
    await expect(button).toHaveCSS('background-color','rgb(161, 31, 32)');
    await expect(button).toHaveCSS('filter','none');
    await expect(button).toHaveCSS('color','rgb(255, 255, 255)');
    await dialog.locator('#linked-confirm-modal-cancel').click();
  };
  await menu('Reload from disk');await checkDanger('Reload linked file?');
  await page.evaluate(()=>__desktopFiles.set('C:/Original/one.md','# external'));
  await save(page);await checkDanger('Overwrite original file?');
  await page.evaluate(()=>{
    __desktopFiles.set('C:/Original/destination.md','# destination');
    Neutralino.os.showSaveDialog=async()=> 'C:/Original/destination.md';
  });
  await menu('Save As…');await checkDanger('Replace Markdown file?');
  await page.evaluate(()=>__desktopFiles.set('C:/Original/one.md','# original'));
  await save(page);
  await expect(prompt(page)).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>__desktopFiles.get('C:/Original/one.md'))).toBe('# draft');
});
test('long original paths remain complete rather than four-line-clamped',async({page})=>{
  await setup(page);
  const sourcePath='C:/Original/'+('nested-folder/'.repeat(40))+'long.md';
  await page.evaluate(async path=>{
    __desktopFiles.set(path,'# long original');
    await NL_IMPORT_EXTERNAL_FILE('# long original','long',path);
    __desktopFiles.set(path,'# changed original');
  },sourcePath);
  await page.locator('#markdown-editor').fill('# long draft');
  await page.locator('#markdown-editor').press('Control+s');
  const dialog=page.getByRole('alertdialog',{name:'Overwrite original file?',exact:true});
  const message=dialog.locator('#linked-confirm-modal-description');
  await expect(message).toContainText(sourcePath);
  await expect(message).toHaveCSS('-webkit-line-clamp','none');
  await expect(message).toHaveCSS('overflow','auto');
  await dialog.getByRole('button',{name:'Keep draft',exact:true}).click();
});
