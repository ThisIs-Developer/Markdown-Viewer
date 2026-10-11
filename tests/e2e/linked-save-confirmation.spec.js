const {test,expect}=require('@playwright/test');
const {openApp}=require('../helpers/app');
const {installDesktopFilesystem}=require('../helpers/desktop-filesystem');
const key='markdownViewerOriginalSaveWarningDisabled';
async function setup(page){
  await page.addInitScript('('+installDesktopFilesystem.toString()+')(window); window.NL_TOKEN="test-token";');
  await openApp(page,'/',{originalSaveConfirmation:true});
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
for(const context of [false,true])test((context?'context Save':'Ctrl+S')+' asks with full path; Cancel preserves the draft and original',async({page})=>{
  await setup(page);await save(page,context);
  await expect(prompt(page)).toContainText('C:/Original/one.md');
  await expect(prompt(page).getByRole('button',{name:'Cancel',exact:true})).toBeFocused();
  await prompt(page).getByRole('checkbox').check();
  await prompt(page).getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(prompt(page)).toHaveCount(0);
  expect(await page.evaluate(()=>__desktopFiles.get('C:/Original/one.md'))).toBe('# original');
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
  await expect(page.locator('#markdown-editor')).toHaveValue('# draft');
  await save(page,context);
  await prompt(page).getByRole('button',{name:'Save to original',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>__desktopFiles.get('C:/Original/one.md'))).toBe('# draft');
});
test('opt-out is global and persistent, and can be re-enabled from settings',async({page})=>{
  await setup(page);await save(page);
  await prompt(page).getByRole('checkbox').check();
  await prompt(page).getByRole('button',{name:'Save to original',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>__desktopFiles.get('C:/Original/one.md'))).toBe('# draft');
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe('true');
  expect(await page.evaluate(async key=>Neutralino.storage.getData(key),key)).toBe('true');
  await page.evaluate(async()=>{
    __desktopFiles.set('C:/Original/two.md','# second');
    await NL_IMPORT_EXTERNAL_FILE('# second','two','C:/Original/two.md');
  });
  await page.locator('#markdown-editor').fill('# second updated');
  await page.locator('#markdown-editor').press('Control+s');
  await expect.poll(()=>page.evaluate(()=>__desktopFiles.get('C:/Original/two.md'))).toBe('# second updated');
  await expect(prompt(page)).toHaveCount(0);
  await page.locator('#workspaceSettingsDropdown').click();
  const toggle=page.locator('.settings-menu [data-original-save-warning-toggle]');
  await expect(toggle).toHaveAttribute('aria-pressed','false');
  await toggle.click();await expect(toggle).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('Escape');
  await page.locator('#markdown-editor').press('Control+s');
  await expect(prompt(page)).toBeVisible();
});
test('draft changes while confirmation is open cancel the stale save',async({page})=>{
  await setup(page);await save(page);await expect(prompt(page)).toBeVisible();
  await page.locator('#markdown-editor').fill('# newer draft');
  await prompt(page).getByRole('button',{name:'Save to original',exact:true}).click();
  await expect(page.locator('.app-toast').filter({hasText:'Save cancelled'})).toBeVisible();
  expect(await page.evaluate(()=>__desktopFiles.get('C:/Original/one.md'))).toBe('# original');
  await expect(page.locator('#markdown-editor')).toHaveValue('# newer draft');
});
test('original changes while confirmation is open cancel the stale save',async({page})=>{
  await setup(page);await save(page);await expect(prompt(page)).toBeVisible();
  await page.evaluate(()=>__desktopFiles.set('C:/Original/one.md','# newer original'));
  await prompt(page).getByRole('button',{name:'Save to original',exact:true}).click();
  await expect(page.locator('.app-toast').filter({hasText:'Save cancelled'})).toBeVisible();
  expect(await page.evaluate(()=>__desktopFiles.get('C:/Original/one.md'))).toBe('# newer original');
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
for(const missing of [false,true])test('opt-out does not bypass '+(missing?'missing source':'conflict')+' confirmation',async({page})=>{
  await setup(page);await page.evaluate(({key,missing})=>{
    localStorage.setItem(key,'true');
    if(missing)__desktopFiles.delete('C:/Original/one.md');
    else __desktopFiles.set('C:/Original/one.md','# external edits');
  },{key,missing});
  await save(page);
  const dialog=page.getByRole('alertdialog',{name:missing?'Recreate linked file?':'Overwrite original file?',exact:true});
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:'Keep draft',exact:true}).click();
  expect(await page.evaluate(()=>__desktopFiles.get('C:/Original/one.md'))).toBe(missing?undefined:'# external edits');
});
test('web hides the setting and does not store desktop preferences',async({page})=>{
  await openApp(page,'/',{originalSaveConfirmation:true});
  for(const button of await page.locator('[data-original-save-warning-toggle]').all())await expect(button).toBeHidden();
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
});
for(const dismissal of ['Escape','close','backdrop'])test(dismissal+' cancels without applying the opt-out',async({page})=>{
  await setup(page);await save(page);
  await prompt(page).getByRole('checkbox').check();
  if(dismissal==='Escape')await prompt(page).getByRole('checkbox').press('Escape');
  else if(dismissal==='backdrop')await prompt(page).click({position:{x:5,y:5}});
  else await prompt(page).getByRole('button',{name:'Close confirmation',exact:true}).click();
  await expect(prompt(page)).toHaveCount(0);
  expect(await page.evaluate(()=>__desktopFiles.get('C:/Original/one.md'))).toBe('# original');
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
});

for(const theme of ['light','dark'])test('confirmation is centered and keyboard-contained in '+theme+' theme',async({page})=>{
  await setup(page);
  await page.evaluate(theme=>document.documentElement.setAttribute('data-theme',theme),theme);
  await save(page);await expect(prompt(page)).toBeVisible();
  await expect(prompt(page).getByRole('button',{name:'Cancel',exact:true})).toBeFocused();
  const box=await prompt(page).locator('.linked-confirm-modal-box').boundingBox();
  const viewport=page.viewportSize();
  expect(Math.abs(box.x+box.width/2-viewport.width/2)).toBeLessThan(3);
  expect(Math.abs(box.y+box.height/2-viewport.height/2)).toBeLessThan(3);
  await prompt(page).getByRole('button',{name:'Save to original',exact:true}).focus();
  await page.keyboard.press('Tab');
  await expect(prompt(page).getByRole('button',{name:'Close confirmation',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#markdown-editor')).toBeFocused();
  await save(page);
  await expect(prompt(page).getByRole('checkbox')).not.toBeChecked();
  await prompt(page).getByRole('button',{name:'Cancel',exact:true}).click();
});

test('replacing a confirmation cancels safely and permits another Save',async({page})=>{
  await setup(page);await save(page);await expect(prompt(page)).toBeVisible();
  // A background UI action, unlike a pointer click, can open another modal.
  await page.getByRole('button',{name:'About Markdown Viewer',exact:true}).evaluate(button=>button.click());
  await expect(prompt(page)).toHaveCount(0);
  expect(await page.evaluate(()=>__desktopFiles.get('C:/Original/one.md'))).toBe('# original');
  await page.locator('#about-modal-close').click();
  await expect(page.locator('#about-modal')).toBeHidden();
  await save(page);await expect(prompt(page)).toBeVisible();
  await prompt(page).getByRole('button',{name:'Cancel',exact:true}).click();
});

for(const theme of ['light','dark'])test('confirmation button text contrast remains readable in '+theme+' theme',async({page})=>{
  await setup(page);
  await page.evaluate(theme=>document.documentElement.setAttribute('data-theme',theme),theme);
  await save(page);await expect(prompt(page)).toBeVisible();
  const button=prompt(page).getByRole('button',{name:'Save to original',exact:true});
  await expect(button).not.toHaveClass(/linked-confirm-danger/);
  await expect(button).toHaveCSS('background-color',theme==='dark'?'rgb(31, 111, 235)':'rgb(3, 102, 214)');
  for(const hover of [false,true]){
    if(hover)await button.hover();
    const ratio=await button.evaluate(element=>{
      const style=getComputedStyle(element);
      const brightness=Number((style.filter.match(/brightness\(([^)]+)\)/)||[])[1]||1);
      const luminance=color=>{
        const channels=color.match(/[\d.]+/g).slice(0,3).map(value=>{
          const channel=Math.min(255,Number(value)*brightness)/255;
          return channel<=0.04045?channel/12.92:Math.pow((channel+0.055)/1.055,2.4);
        });
        return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
      };
      const foreground=luminance(style.color),background=luminance(style.backgroundColor);
      return (Math.max(foreground,background)+0.05)/(Math.min(foreground,background)+0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  }
  await prompt(page).getByRole('button',{name:'Cancel',exact:true}).click();
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
  await expect(prompt(page).locator('#linked-confirm-modal-confirm')).not.toHaveClass(/linked-confirm-danger/);
  await prompt(page).getByRole('button',{name:'Cancel',exact:true}).click();
});
test('long original paths remain complete rather than four-line-clamped',async({page})=>{
  await setup(page);
  const sourcePath='C:/Original/'+('nested-folder/'.repeat(40))+'long.md';
  await page.evaluate(async path=>{
    __desktopFiles.set(path,'# long original');
    await NL_IMPORT_EXTERNAL_FILE('# long original','long',path);
  },sourcePath);
  await page.locator('#markdown-editor').fill('# long draft');
  await page.locator('#markdown-editor').press('Control+s');
  const message=prompt(page).locator('#linked-confirm-modal-description');
  await expect(message).toContainText(sourcePath);
  await expect(message).toHaveCSS('-webkit-line-clamp','none');
  await expect(message).toHaveCSS('overflow','auto');
  await prompt(page).getByRole('button',{name:'Cancel',exact:true}).click();
});
