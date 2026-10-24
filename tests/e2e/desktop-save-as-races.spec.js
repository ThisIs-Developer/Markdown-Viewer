const {test,expect}=require('@playwright/test');
const {openApp}=require('../helpers/app');
const {installDesktopFilesystem}=require('../helpers/desktop-filesystem');
async function setup(page) {
  await page.addInitScript('('+installDesktopFilesystem.toString()+')(window);window.NL_OS="Windows";');
  await openApp(page);
  await page.locator('#markdown-editor').fill('# export snapshot');
  await page.evaluate(()=>{Neutralino.os.showSaveDialog=async()=> 'C:/Saved/target.md';});
}
async function saveAs(page) {
  await page.locator('#document-tree [data-tree-type="document"]').filter({hasText:'Welcome to Markdown'}).dispatchEvent('contextmenu',{clientX:120,clientY:120});
  await page.getByRole('menuitem',{name:'Save As linked file…',exact:true}).click();
}
test('existing exact-extension destination changing during confirmation is not overwritten',async({page})=>{
  await setup(page);
  await page.evaluate(()=>window.__desktopFiles.set('C:/Saved/target.md','# destination baseline'));
  await saveAs(page);
  const confirmation=page.getByRole('alertdialog',{name:'Replace Markdown file?',exact:true});
  await expect(confirmation).toBeVisible();
  await page.evaluate(()=>window.__desktopFiles.set('C:/Saved/target.md','# external newer edit'));
  await confirmation.getByRole('button',{name:'Replace',exact:true}).click();
  await expect(page.locator('.app-toast').filter({hasText:'destination changed'})).toBeVisible();
  expect(await page.evaluate(()=>window.__desktopFiles.get('C:/Saved/target.md'))).toBe('# external newer edit');
  await expect(page.locator('#markdown-editor')).toHaveValue('# export snapshot');
});
test('source editing while picker is open cancels obsolete Save As',async({page})=>{
  await setup(page);
  await page.evaluate(()=>{Neutralino.os.showSaveDialog=async()=>{window.__pickerPending=true;return new Promise(resolve=>{window.__releasePicker=()=>resolve('C:/Saved/target.md');});};});
  await saveAs(page);await page.waitForFunction(()=>window.__pickerPending);
  await page.locator('#markdown-editor').fill('# newer source draft');
  await page.evaluate(()=>window.__releasePicker());
  await expect(page.locator('.app-toast').filter({hasText:'draft or link changed'})).toBeVisible();
  expect(await page.evaluate(()=>window.__desktopFiles.has('C:/Saved/target.md'))).toBe(false);
  await expect(page.locator('#markdown-editor')).toHaveValue('# newer source draft');
});
test('new destination appearing after absence snapshot is not overwritten',async({page})=>{
  await setup(page);
  await page.evaluate(()=>{
    const read=Neutralino.filesystem.readDirectory;let first=true;
    Neutralino.filesystem.readDirectory=async p=>{
      const entries=await read(p);
      if(p==='C:/Saved' && first){first=false;window.__absencePending=true;await new Promise(resolve=>window.__releaseAbsence=resolve);}
      return entries;
    };
  });
  await saveAs(page);await page.waitForFunction(()=>window.__absencePending);
  await page.evaluate(()=>{window.__desktopFiles.set('C:/Saved/target.md','# appeared externally');window.__releaseAbsence();});
  await expect(page.locator('.app-toast').filter({hasText:'destination changed'})).toBeVisible();
  expect(await page.evaluate(()=>window.__desktopFiles.get('C:/Saved/target.md'))).toBe('# appeared externally');
});
test('existing linked destination edited during async hash retains live draft and disk body',async({page})=>{
  await setup(page);
  await page.evaluate(async()=>{
    window.__desktopFiles.set('C:/Saved/target.md','# linked baseline');
    await window.NL_IMPORT_EXTERNAL_FILE('# linked baseline','target','C:/Saved/target.md');
    await window.MarkdownViewerFlushWorkspace();
    const digest=crypto.subtle.digest.bind(crypto.subtle);let first=true;
    crypto.subtle.digest=async(a,bytes)=>{
      if(first && new TextDecoder().decode(bytes)==='# linked baseline'){
        first=false;window.__hashPending=true;await new Promise(resolve=>window.__releaseHash=resolve);
      }
      return digest(a,bytes);
    };
  });
  await saveAs(page);
  await page.getByRole('alertdialog',{name:'Replace Markdown file?',exact:true}).getByRole('button',{name:'Replace',exact:true}).click();
  await page.waitForFunction(()=>window.__hashPending);
  await page.locator('#markdown-editor').fill('# newest linked destination draft');
  await page.evaluate(()=>window.__releaseHash());
  await expect(page.locator('.app-toast').filter({hasText:'Unsaved linked draft'})).toBeVisible();
  expect(await page.evaluate(()=>window.__desktopFiles.get('C:/Saved/target.md'))).toBe('# linked baseline');
  await expect(page.locator('#markdown-editor')).toHaveValue('# newest linked destination draft');
});
test('new edits during Save As write stay in source document after new link takes focus',async({page})=>{
  await setup(page);
  const id=await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
  await page.evaluate(()=>{
    const write=Neutralino.filesystem.writeFile;
    Neutralino.filesystem.writeFile=async(p,text)=>{
      if(p==='C:/Saved/target.md'){window.__writePending=true;await new Promise(resolve=>window.__releaseWrite=resolve);}
      return write(p,text);
    };
  });
  await saveAs(page);await page.waitForFunction(()=>window.__writePending);
  await page.locator('#markdown-editor').fill('# newest source draft');
  await page.evaluate(()=>window.__releaseWrite());
  await expect(page.locator('#tab-list .tab-item.active .tab-title')).toHaveText('target');
  expect(await page.evaluate(()=>window.__desktopFiles.get('C:/Saved/target.md'))).toBe('# export snapshot');
  expect(await page.evaluate(async id=>{
    const storage=new window.MarkdownWorkspaceStorage();await storage.init();return storage.loadDocumentContent(id);
  },id)).toBe('# newest source draft');
});
test('destination live draft changing during final read cancels before write',async({page})=>{
  await setup(page);
  await page.evaluate(async()=>{
    window.__desktopFiles.set('C:/Saved/target.md','# linked baseline');
    await window.NL_IMPORT_EXTERNAL_FILE('# linked baseline','target','C:/Saved/target.md');
    await window.MarkdownViewerFlushWorkspace();
    const read=Neutralino.filesystem.readFile;let reads=0;
    Neutralino.filesystem.readFile=async p=>{
      const text=await read(p);
      if(p==='C:/Saved/target.md' && ++reads===2){window.__finalReadPending=true;await new Promise(resolve=>window.__releaseFinalRead=resolve);}
      return text;
    };
  });
  await saveAs(page);
  await page.getByRole('alertdialog',{name:'Replace Markdown file?',exact:true}).getByRole('button',{name:'Replace',exact:true}).click();
  await page.waitForFunction(()=>window.__finalReadPending);
  await page.locator('#markdown-editor').fill('# destination edited after hash');
  await page.evaluate(()=>window.__releaseFinalRead());
  await expect(page.locator('.app-toast').filter({hasText:'A draft or workspace link changed'})).toBeVisible();
  expect(await page.evaluate(()=>window.__desktopFiles.get('C:/Saved/target.md'))).toBe('# linked baseline');
  await expect(page.locator('#markdown-editor')).toHaveValue('# destination edited after hash');
});
test('Save As does not interpret an unreadable destination as absent',async({page})=>{
  await setup(page);
  await page.evaluate(()=>{
    window.__desktopFiles.set('C:/Saved/target.md','# protected destination');
    const stat=Neutralino.filesystem.getStats;
    Neutralino.filesystem.getStats=async p=>{if(p==='C:/Saved/target.md')throw {code:'NE_FS_NOPATHE'};return stat(p);};
  });
  await saveAs(page);
  await expect(page.locator('.app-toast').filter({hasText:'cannot be inspected'})).toBeVisible();
  expect(await page.evaluate(()=>window.__desktopFiles.get('C:/Saved/target.md'))).toBe('# protected destination');
  await expect(page.getByRole('alertdialog',{name:'Replace Markdown file?',exact:true})).toHaveCount(0);
});
