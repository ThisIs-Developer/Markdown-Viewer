const {test,expect}=require('@playwright/test');
const {setup,openConnections,cloudMenu,cloudAction,base}=require('../helpers/cloud-workspace');
const {storedDocuments}=require('../helpers/app');
const {installDesktopFilesystem}=require('../helpers/desktop-filesystem');
const root='https://dav.example/storage/Selected%20folder/';
async function connect(page,{remember=true,password='dav-secret',label='Personal DAV'}={}){
 await openConnections(page);await page.locator('#cloud-provider').selectOption('webdav');
 await page.locator('#cloud-label').fill(label);await page.locator('#cloud-root').fill(root);
 await page.locator('#cloud-username').fill('davuser');await page.locator('#cloud-password').fill(password);
 await page.locator('#nextcloud-remember').setChecked(remember);
 await page.getByRole('button',{name:'Connect to WebDAV',exact:true}).click();
}
async function openFile(page){await page.locator('[data-nextcloud-href="'+root+'notes.md"]').click();await expect(page.locator('#markdown-editor')).toHaveValue('# WebDAV original');}
async function create(page,name){
 await page.locator('.nextcloud-path').dispatchEvent('contextmenu',{clientX:140,clientY:230});
 await page.locator('.document-menu-dropdown.open').getByRole('menuitem',{name:'New Markdown file',exact:true}).click();
 await page.locator('#document-name-modal-input').fill(name);await page.locator('#document-name-modal-confirm').click();
}

test('WebDAV connects directly to a selected folder, opens a draft and conditionally saves without browser login',async({page})=>{
 await setup(page,{webdav:true,secure:true,connect:false});await connect(page,{remember:false});await openFile(page);
 await expect(page.locator('#markdown-editor')).toHaveValue('# WebDAV original');
 await expect(page.locator('#cloud-password')).toHaveValue('');
 expect(await page.evaluate(()=>__cloud.browser)).toEqual([]);
 expect(await page.evaluate(()=>__cloud.requests.some(item=>item.url.includes('/ocs/') || item.url.includes('/login/v2')))).toBe(false);
 await page.locator('#markdown-editor').fill('# My WebDAV draft');await cloudAction(page,'Save to cloud');
 await expect(page.locator('#nextcloud-status')).toHaveText('Saved to WebDAV.');
 const writes=await page.evaluate(()=>__cloud.requests.filter(item=>item.method==='PUT'));
 expect(writes).toHaveLength(1);expect(writes[0].headers['If-Match']).toBe('"dav1"');
 const docs=await storedDocuments(page);expect(docs.some(item=>item.remoteSource?.providerId==='webdav' && item.content==='# My WebDAV draft')).toBe(true);
 expect(JSON.stringify(docs)).not.toContain('dav-secret');
 const stored=await page.evaluate(()=>JSON.stringify({...localStorage}));expect(stored).not.toContain('dav-secret');
});

test('WebDAV folder navigation cannot go above the selected root and nested context creation stays inside it',async({page})=>{
 await setup(page,{webdav:true,secure:true,connect:false});await connect(page,{remember:false});
 await expect(page.getByRole('button',{name:'Up',exact:true})).toHaveCount(0);
 await page.locator('[data-nextcloud-href="'+root+'Nested/"]').click();
 await expect(page.locator('.nextcloud-path')).toHaveText('Nested/');
 await create(page,'Nested note');await expect(page.locator('#nextcloud-status')).toContainText('Created Nested note.md on WebDAV.');
 expect(await page.evaluate(root=>__cloud.webdavFiles[root+'Nested/Nested%20note.md']?.content,root)).toBe('');
 await page.getByRole('button',{name:'Up',exact:true}).click();await expect(page.locator('.nextcloud-path')).toHaveText('Files');
 await expect(page.getByRole('button',{name:'Up',exact:true})).toHaveCount(0);
});

for(const mode of ['missing','weak'])test('WebDAV '+mode+' version remains editable locally and refuses save/delete',async({page})=>{
 await page.addInitScript('('+installDesktopFilesystem.toString()+')(window);');
 await setup(page,{webdav:true,secure:true,connect:false});await page.evaluate(mode=>__cloud.webdavVersionMode=mode,mode);
 await connect(page,{remember:false});await openFile(page);await page.locator('#markdown-editor').fill('# Local only');
 await cloudMenu(page);
 const menu=page.locator('.document-menu-dropdown.open');
 await expect(menu.getByRole('menuitem',{name:'Save to cloud',exact:true})).toBeDisabled();
 await expect(menu.getByRole('menuitem',{name:'Delete from cloud',exact:true})).toBeDisabled();
 await page.keyboard.press('Escape');await page.locator('#markdown-editor').press('Control+s');
 await expect(page.locator('#nextcloud-status')).toContainText('read-only');
 expect(await page.evaluate(()=>__cloud.requests.filter(item=>['PUT','DELETE'].includes(item.method)).length)).toBe(0);
 await expect(page.locator('#markdown-editor')).toHaveValue('# Local only');
});

test('WebDAV competing edit preserves the draft and requires review before another save',async({page})=>{
 await setup(page,{webdav:true,secure:true,connect:false});await connect(page,{remember:false});await openFile(page);
 await page.locator('#markdown-editor').fill('# Local draft');await page.evaluate(root=>__cloud.webdavFiles[root+'notes.md']={content:'# Other device',etag:'"other"'},root);
 await cloudAction(page,'Save to cloud');await expect(page.locator('#nextcloud-status')).toContainText('changed');
 await expect(page.locator('#markdown-editor')).toHaveValue('# Local draft');
 await cloudAction(page,'Check server version');await expect(page.locator('#markdown-editor')).toHaveValue('# Other device');
 await page.locator('#tab-list .tab-item').filter({hasText:'notes.md'}).filter({hasNotText:'cloud version'}).click();
 await cloudAction(page,'Resolve using my draft');await page.locator('#linked-confirm-modal-confirm').click();
 await cloudAction(page,'Save to cloud');await expect(page.locator('#nextcloud-status')).toHaveText('Saved to WebDAV.');
});

test('WebDAV context-only create refuses collisions and deletion always confirms while retaining recovery content',async({page})=>{
 await setup(page,{webdav:true,secure:true,connect:false});await connect(page,{remember:false});await openFile(page);
 await page.locator('#markdown-editor').fill('# Existing draft');
 await page.evaluate(root=>__cloud.webdavFiles[root+'occupied.md']={content:'# Keep server file',etag:'"occupied"'},root);
 await create(page,'occupied');await expect(page.getByText('A file already exists with this name. Nothing was overwritten.',{exact:true})).toBeVisible();
 expect(await page.evaluate(root=>__cloud.webdavFiles[root+'occupied.md'].content,root)).toBe('# Keep server file');
 await create(page,'new');
 await expect(page.locator('#nextcloud-status')).toHaveText('Created new.md on WebDAV.');
 await cloudMenu(page);await page.locator('.document-menu-dropdown.open').getByRole('menuitem',{name:'Delete from cloud',exact:true}).click();
 await expect(page.locator('#linked-confirm-modal')).toHaveAttribute('aria-hidden','false');await expect(page.locator('#linked-confirm-modal-cancel')).toBeFocused();
 await page.locator('#linked-confirm-modal-confirm').click();await expect(page.locator('#nextcloud-status')).toContainText('local recovery copy was kept');
 const docs=await storedDocuments(page);expect(docs.some(item=>item.content==='# Existing draft' && item.remoteSource?.providerId==='webdav')).toBe(true);
 expect(docs.some(item=>item.title==='new.md' && item.kind==='cloud-recovery' && !item.remoteSource)).toBe(true);
 expect(await page.evaluate(root=>__cloud.webdavFiles[root+'new.md'],root)).toBeUndefined();
});

for(const mode of ['lost-save','lost-delete'])test('WebDAV '+mode+' stays uncertain and a server check never replays the write',async({page})=>{
 await setup(page,{webdav:true,secure:true,connect:false});await connect(page,{remember:false});await openFile(page);
 await page.evaluate(mode=>__cloud.webdavMode=mode,mode);
 if(mode==='lost-save'){await page.locator('#markdown-editor').fill('# Written but unconfirmed');await cloudAction(page,'Save to cloud');}
 else {await cloudMenu(page);await page.locator('.document-menu-dropdown.open').getByRole('menuitem',{name:'Delete from cloud',exact:true}).click();await page.locator('#linked-confirm-modal-confirm').click();}
 await expect.poll(async()=> (await storedDocuments(page)).find(item=>item.remoteSource?.providerId==='webdav')?.remoteSource.status).toBe('uncertain');
 const writes=await page.evaluate(()=>__cloud.requests.filter(item=>['PUT','DELETE'].includes(item.method)).length);
 await page.evaluate(()=>__cloud.webdavMode='');await cloudAction(page,'Check server version');
 await expect(page.locator('#nextcloud-status')).toContainText(mode==='lost-save'?'Server version checked':'Server deletion confirmed');
 expect(await page.evaluate(()=>__cloud.requests.filter(item=>['PUT','DELETE'].includes(item.method)).length)).toBe(writes);
 if(mode==='lost-save')await expect(page.locator('#markdown-editor')).toHaveValue('# Written but unconfirmed');
 else expect((await storedDocuments(page)).some(item=>item.kind==='cloud-recovery' && item.content==='# WebDAV original')).toBe(true);
});

for(const mode of ['redirect','foreign-href','xml-entity'])test('WebDAV rejects '+mode+' without requests outside the selected root',async({page})=>{
 await setup(page,{webdav:true,secure:true,connect:false});await page.evaluate(mode=>__cloud.webdavMode=mode,mode);await connect(page,{remember:false});
 await expect(page.locator('#cloud-settings-modal')).toHaveAttribute('aria-hidden','false');
 await expect(page.locator('.cloud-setup-status')).not.toHaveText('');
 expect(await page.evaluate(()=>__cloud.requests.some(item=>new URL(item.url).hostname!=='dav.example'))).toBe(false);
 expect(await page.evaluate(()=>__cloud.requests.some(item=>['PUT','DELETE'].includes(item.method)))).toBe(false);
});

test('WebDAV invalid credentials keep the setup open and clear its password',async({page})=>{
 await setup(page,{webdav:true,secure:true,connect:false});await connect(page,{password:'wrong',remember:false});
 await expect(page.locator('.cloud-setup-status')).toContainText('WebDAV sign-in was not accepted');await expect(page.locator('#cloud-password')).toHaveValue('');
 await expect(page.locator('#cloud-settings-modal')).toHaveAttribute('aria-hidden','false');
});

test('remembered WebDAV and Nextcloud coexist, preserve local drafts and keep save opt-outs isolated',async({page})=>{
 await setup(page,{webdav:true,secure:true});await page.locator('#markdown-editor').fill('# Nextcloud retained draft');
 await connect(page);await openFile(page);await page.locator('#markdown-editor').fill('# WebDAV retained draft');
 await cloudMenu(page);await page.locator('.document-menu-dropdown.open').getByRole('menuitem',{name:'Save to cloud',exact:true}).click();
 await page.locator('#linked-confirm-modal-checkbox').check();await page.locator('#linked-confirm-modal-confirm').click();
 await expect(page.locator('#nextcloud-status')).toHaveText('Saved to WebDAV.');
 await page.locator('#markdown-editor').fill('# New local WebDAV edits');await page.reload();
 await expect(page.locator('.cloud-account-row')).toHaveCount(2);await expect(page.locator('.cloud-account-row.is-active')).toContainText('Personal DAV');
 await expect(page.locator('#markdown-editor')).toHaveValue('# New local WebDAV edits');
 const docs=await storedDocuments(page);expect(docs.some(item=>item.content==='# Nextcloud retained draft')).toBe(true);
 await cloudMenu(page);await page.locator('.document-menu-dropdown.open').getByRole('menuitem',{name:'Save to cloud',exact:true}).click();await expect(page.locator('#linked-confirm-modal')).toHaveAttribute('aria-hidden','true');
 await expect(page.locator('#nextcloud-status')).toHaveText('Saved to WebDAV.');
 await cloudMenu(page);await page.locator('.document-menu-dropdown.open').getByRole('menuitem',{name:'Delete from cloud',exact:true}).click();
 await expect(page.locator('#linked-confirm-modal')).toHaveAttribute('aria-hidden','false');await expect(page.locator('#linked-confirm-modal-checkbox-label')).toBeHidden();await page.locator('#linked-confirm-modal-cancel').click();
 await page.getByRole('button',{name:'personal-cloud.example (alice)',exact:true}).click();
 await expect(page.locator('.cloud-account-row.is-active .cloud-connection-dot')).toHaveAttribute('data-connected','true');
 await expect(page.locator('[data-nextcloud-href="'+base+'/remote.php/dav/files/alice/notes.md"]')).toHaveCount(0);
 await expect(page.locator('.cloud-account-row.is-active')).toContainText('personal-cloud.example');
 const nextcloud=docs.find(item=>item.remoteSource?.providerId==='nextcloud');
 await page.locator('#nextcloud-panel [data-cloud-document="'+nextcloud.id+'"]').click();
 await expect(page.locator('#markdown-editor')).toHaveValue('# Nextcloud retained draft');
 await cloudMenu(page);await page.locator('.document-menu-dropdown.open').getByRole('menuitem',{name:'Save to cloud',exact:true}).click();
 await expect(page.locator('#linked-confirm-modal')).toHaveAttribute('aria-hidden','false');
 await page.locator('#linked-confirm-modal-cancel').click();
 expect(JSON.stringify(await storedDocuments(page))).not.toContain('dav-secret');
});

test('WebDAV parser accepts relative hrefs and namespace prefixes but refuses ambiguous file types and foreign paths',async({page})=>{
 await setup(page,{webdav:true,secure:true,connect:false});
 const result=await page.evaluate(root=>{
  const response=(href,props)=>'<x:response><x:href>'+href+'</x:href><x:propstat><x:prop>'+props+'</x:prop><x:status>HTTP/1.1 200 OK</x:status></x:propstat></x:response>';
  const wrap=body=>'<x:multistatus xmlns:x="DAV:">'+body+'</x:multistatus>';
  const collection=wrap(response(new URL(root).pathname.slice(0,-1),'<x:resourcetype><x:collection/></x:resourcetype>'));
  const collectionValid=MarkdownWebDAV.parseCollection(collection,root);
  const listing=MarkdownWebDAV.parseListing(wrap(response('a.md','<x:resourcetype/><x:getetag>"v1"</x:getetag>')),root,root+'Nested/');
  const version=MarkdownWebDAV.parseFileEtag(wrap(response('a.md','<x:resourcetype/><x:getetag>"v1"</x:getetag>')),root,root+'a.md');
  let unsafe=0;
  for(const xml of [wrap(response(root+'a.md','<x:getetag>"v1"</x:getetag>')),wrap(response('https://foreign.example/a.md','<x:resourcetype/><x:getetag>"v1"</x:getetag>'))]){
   try {MarkdownWebDAV.parseFileEtag(xml,root,root+'a.md');}catch(_){unsafe++;}
  }
  return {collectionValid,listing,version,unsafe};
 },root);
 expect(result.collectionValid).toBe(true);expect(result.listing[0].href).toBe(root+'Nested/a.md');expect(result.version).toBe('"v1"');expect(result.unsafe).toBe(2);
});

test('cancelling a WebDAV probe clears the password and cannot publish or remember a late connection',async({page})=>{
 await setup(page,{webdav:true,secure:true,connect:false});await page.evaluate(()=>__cloud.webdavMode='slow-connect');
 await connect(page);await expect.poll(()=>page.evaluate(()=>Boolean(__cloud.finishProbe))).toBe(true);
 await page.getByRole('button',{name:'Cancel connection',exact:true}).click();await expect(page.locator('#cloud-password')).toHaveValue('');
 await page.evaluate(()=>__cloud.finishProbe());await expect(page.locator('.cloud-account-row')).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>__nativeAccountList().then(items=>items.length))).toBe(0);
 expect(await page.evaluate(()=>__cloud.requests.some(item=>['PUT','DELETE'].includes(item.method)))).toBe(false);
});

test('desktop Ctrl+S uploads the WebDAV draft and its physical recovery is outside Vault',async({page})=>{
 await page.addInitScript('('+installDesktopFilesystem.toString()+')(window);');
 await setup(page,{webdav:true,secure:true,connect:false});await connect(page);await openFile(page);
 await page.locator('#markdown-editor').fill('# Desktop DAV draft');await page.locator('#markdown-editor').press('Control+s');
 await expect(page.locator('#linked-confirm-modal')).toHaveAttribute('aria-hidden','false');await page.locator('#linked-confirm-modal-confirm').click();
 await expect(page.locator('#nextcloud-status')).toHaveText('Saved to WebDAV.');
 const documents=await page.evaluate(async()=>{await MarkdownViewerFlushWorkspace();const storage=new MarkdownWorkspaceStorage();await storage.init();return storage.listDocumentMetadata();});
 const source=documents.find(item=>item.remoteSource?.providerId==='webdav');expect(source._vaultRelativePath).toMatch(/^Cloud Workspace\/WebDAV - /);
});

test('WebDAV setup uses the shared themed dialog with a hidden password and optional name',async({page})=>{
 await setup(page,{webdav:true,secure:true,connect:false});await page.evaluate(()=>document.documentElement.setAttribute('data-theme','dark'));
 await openConnections(page);await page.locator('#cloud-provider').selectOption('webdav');
 await expect(page.locator('#cloud-password')).toHaveAttribute('type','password');await expect(page.locator('#cloud-label')).not.toHaveAttribute('required','');
 const overflow=await page.locator('.cloud-settings-dialog').evaluate(node=>node.scrollWidth>node.clientWidth);expect(overflow).toBe(false);
 await page.screenshot({path:test.info().outputPath('webdav-settings-dark.png'),animations:'disabled'});
});

test('closing WebDAV setup during secure finalization keeps the authenticated connection and clears the password',async({page})=>{
 await setup(page,{webdav:true,secure:true,connect:false});await page.evaluate(()=>__cloud.webdavMode='slow-remember');await connect(page);
 await expect.poll(()=>page.evaluate(()=>Boolean(__cloud.finishRemember))).toBe(true);
 await expect(page.getByRole('button',{name:'Cancel connection',exact:true})).toBeHidden();await expect(page.locator('#cloud-password')).toHaveValue('');
 await page.getByRole('button',{name:'Close cloud connections',exact:true}).click();
 await page.evaluate(()=>__cloud.finishRemember());await expect(page.locator('.cloud-account-row')).toHaveCount(1);
 await expect(page.locator('.cloud-account-row .cloud-connection-dot')).toHaveAttribute('data-connected','true');
 expect(await page.evaluate(()=>__cloud.requests.some(item=>['PUT','DELETE'].includes(item.method)))).toBe(false);
});
