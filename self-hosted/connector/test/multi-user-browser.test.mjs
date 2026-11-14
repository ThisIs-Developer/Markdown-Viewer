import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {createConnector} from '../server.mjs';
const require=createRequire(new URL('../../../package.json',import.meta.url));
const {chromium,expect}=require('@playwright/test');
const {openApp,appVersion}=require('./tests/helpers/app.js');
const root='https://dav.example/Selected/',password='browser-profile-password';
const xml=(url,folder)=>'<d:response><d:href>'+url+'</d:href><d:propstat><d:prop><d:resourcetype>'+(folder?'<d:collection/>':'')+'</d:resourcetype><d:getetag>"v1"</d:getetag></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>';
async function fixture(t,{development=true}={}){
 const directory=await mkdtemp(path.join(tmpdir(),'mv-profile-browser-')),key=randomBytes(32),config={mode:'multi-user',enabled:true,publicApp:true,dynamicOrigin:true,development,remember:true,rememberDevice:true,targets:[{providerId:'webdav',root}]};
 const transport=async(_target,url,method,options={})=>({transportVersion:1,status:method==='PROPFIND'?207:200,headers:{etag:'"v1"'},body:method==='PROPFIND'?'<d:multistatus xmlns:d="DAV:">'+xml(url,url.endsWith('/'))+(options.headers.Depth==='1'?xml(root+'notes.md',false):'')+'</d:multistatus>':'# Remote original'});
 let app,port;const start=async()=>{app=await createConnector({config,key,dataDirectory:directory,transport});await new Promise(resolve=>app.server.listen(port || 0,'127.0.0.1',resolve));port=app.server.address().port;};await start();
 const origin='http://127.0.0.1:'+port,browser=await chromium.launch({headless:true}),context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 const scope='guest-fixture-'+randomBytes(12).toString('hex');
 await page.addInitScript(({scope,version})=>{if(localStorage.getItem('profile-test-seeded'))return;localStorage.setItem('profile-test-seeded','true');localStorage.setItem('mv-cloud-guest-scope',scope);const prefix='mv-cloud-workspace:'+scope+':';for(const key of ['markdownViewerLastVersion','markdownViewerReleaseNotesSeenVersion'])localStorage.setItem(prefix+key,version);localStorage.setItem(prefix+'markdownViewerTabs',JSON.stringify([{id:'guest-draft',title:'Guest draft',content:'# Guest draft',workspaceId:'workspace_default',isOpen:true,createdAt:1,lastOpenedAt:1}]));},{scope,version:await appVersion()});
 t.after(async()=>{await browser.close();await app.close();await rm(directory,{recursive:true,force:true});});
 await openApp(page,origin);return {page,context,origin,errors,restart:async()=>{await app.close();await start();}};
}
async function settings(page){await page.getByRole('button',{name:'Open workspace settings',exact:true}).click();await page.locator('#cloud-connections-button').click();}
async function profileForm(page,name,{register=true,remember=true}={}){
 await page.getByRole('button',{name:register?'Create personal profile':'Sign in to profile',exact:true}).click();
 await page.locator('#cloud-profile-name').fill(name);await page.locator('#cloud-profile-password').fill(password);if(register)await page.locator('#cloud-profile-confirm').fill(password);if(remember)await page.locator('#cloud-profile-remember').check();
 await page.locator('.cloud-profile-dialog').getByRole('button',{name:register?'Create profile':'Sign in',exact:true}).click();await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true' && !document.querySelector('.cloud-profile-dialog'));
}
const records=page=>page.evaluate(async()=>{await MarkdownViewerFlushWorkspace();const storage=new MarkdownWorkspaceStorage();await storage.init();return Promise.all((await storage.listDocumentMetadata()).map(async item=>({...item,content:await storage.loadDocumentContent(item.id)})));});

test('guest connects without server password, creates a remembered profile and retains cloud draft across restart',async t=>{
 const f=await fixture(t),{page}=f;await settings(page);
 await page.locator('#cloud-provider').selectOption('webdav');await page.locator('#cloud-root').fill(root);await page.locator('#cloud-username').fill('alice');await page.locator('#cloud-password').fill('disposable-dav-secret');await expect(page.locator('#nextcloud-remember')).toBeDisabled();await page.getByRole('button',{name:'Connect to WebDAV',exact:true}).click();
 assert.equal(await page.locator('#cloud-access-password').count(),0);await page.locator('#nextcloud-panel').getByRole('button',{name:'notes.md',exact:true}).click();await expect(page.locator('#markdown-editor')).toHaveValue('# Remote original');await page.locator('#markdown-editor').fill('# Alice unsaved cloud draft');
 await page.evaluate(()=>MarkdownViewerFlushWorkspace());await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true');await expect(page.locator('#markdown-editor')).toHaveValue('# Alice unsaved cloud draft');await expect(page.locator('#nextcloud-panel')).toContainText('alice');
 await settings(page);await profileForm(page,'alice');await expect(page.locator('#markdown-editor')).toHaveValue('# Alice unsaved cloud draft');
 const identity=await page.evaluate(()=>MarkdownCloudConnector.identity);assert.equal(identity.kind,'profile');
 await expect(page.locator('#nextcloud-panel')).toContainText('alice');await f.restart();await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true');
 assert.equal(await page.evaluate(()=>MarkdownCloudConnector.identity.id),identity.id);await expect(page.locator('#markdown-editor')).toHaveValue('# Alice unsaved cloud draft');
 assert.ok((await records(page)).some(record=>record.content==='# Guest draft'));assert.deepEqual(f.errors,[]);
});

test('profile switch scopes IndexedDB/preferences and pauses stale tabs without losing their drafts',async t=>{
 const f=await fixture(t),{page,context}=f;await settings(page);await profileForm(page,'alice');
 // Creating the profile preserves the existing local draft rather than moving it through the connector.
 await page.locator('#markdown-editor').fill('# Alice local private draft');await page.evaluate(()=>MarkdownViewerFlushWorkspace());
 const oldDatabase=await page.evaluate(()=>MarkdownCloudBrowserStorage.databaseName),old=await context.newPage();await openApp(old,f.origin);await expect(old.locator('#markdown-editor')).toHaveValue('# Alice local private draft');
 await old.evaluate(()=>{MarkdownWorkspaceStorage.prototype.saveDocuments=async()=>{throw Error('simulated old-tab storage conflict');};});await old.locator('#markdown-editor').fill('# Alice old-tab recovery draft');
 await settings(page);await page.getByRole('button',{name:'Sign out profile',exact:true}).click();await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true' && MarkdownCloudConnector.identity.kind==='guest');
 await expect(old.locator('.cloud-identity-block')).toBeVisible();await expect(old.locator('.cloud-identity-block')).toContainText('drafts were saved');
 await assert.rejects(old.evaluate(()=>MarkdownCloudPlatform.create().request({url:'https://dav.example/Selected/notes.md',maxBytes:1024})),/paused/);
 await settings(page);await profileForm(page,'bob');assert.notEqual(await page.evaluate(()=>MarkdownCloudBrowserStorage.databaseName),oldDatabase);
 assert.equal((await records(page)).some(record=>record.content.includes('Alice local private') || record.content.includes('Alice old-tab recovery')),false);
 await settings(page);await page.getByRole('button',{name:'Sign out profile',exact:true}).click();await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true' && MarkdownCloudConnector.identity.kind==='guest');
 await settings(page);await profileForm(page,'alice',{register:false});assert.equal(await page.evaluate(()=>MarkdownCloudBrowserStorage.databaseName),oldDatabase);assert.ok((await records(page)).some(record=>record.content==='# Alice local private draft'));assert.ok((await records(page)).some(record=>record.content==='# Alice old-tab recovery draft'));
 assert.deepEqual(f.errors,[]);
});


test('production HTTP cannot send profile or provider passwords even with guest bootstrap CSRF',async t=>{
 const f=await fixture(t,{development:false}),{page}=f,credentials=[];page.on('request',request=>{if(request.method()==='POST' && /\/api\/cloud\/(?:login|profile\/register|connect\/webdav)$/.test(request.url()))credentials.push(request.url());});
 await settings(page);await page.getByRole('button',{name:'Sign in to profile',exact:true}).click();await page.locator('#cloud-profile-name').fill('alice');await page.locator('#cloud-profile-password').fill(password);await page.locator('.cloud-profile-dialog').getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('.cloud-profile-dialog [role=status]')).toContainText('HTTPS');
 await page.locator('.cloud-profile-dialog').getByRole('button',{name:'Cancel',exact:true}).click();await page.locator('#cloud-provider').selectOption('webdav');await page.locator('#cloud-root').fill(root);await page.locator('#cloud-username').fill('alice');await page.locator('#cloud-password').fill('do-not-transmit');await page.getByRole('button',{name:'Connect to WebDAV',exact:true}).click();await expect(page.locator('.cloud-setup-status')).toContainText('HTTPS');assert.deepEqual(credentials,[]);
});


test('failed multi-user bootstrap cannot fall back to the legacy shared browser workspace',async t=>{
 const f=await fixture(t),{page}=f;
 await page.evaluate(()=>localStorage.setItem('markdownViewerTabs',JSON.stringify([{id:'legacy-private',title:'Legacy private',content:'# Legacy private content'}])));
 await page.route('**/api/cloud/bootstrap.js',route=>route.abort());await page.reload();await expect(page.locator('#cloud-storage-error')).toBeVisible();
 assert.equal(await page.locator('body').textContent().then(value=>value.includes('# Legacy private content')),false);
 assert.equal(await page.evaluate(async()=>(await indexedDB.databases()).some(item=>item.name==='markdownViewerWorkspace')),false);
});


test('enabling remember browser from profile settings asks for the password again',async t=>{
 const f=await fixture(t),{page}=f;await settings(page);await profileForm(page,'alice',{remember:false});
 await settings(page);await page.getByRole('button',{name:'Remember this browser',exact:true}).click();await expect(page.locator('#cloud-profile-name')).toHaveValue('alice');await expect(page.locator('#cloud-profile-name')).toHaveAttribute('readonly','');
 await page.locator('#cloud-profile-password').fill('incorrect-password');await page.getByRole('button',{name:'Remember browser',exact:true}).click();await expect(page.locator('.cloud-profile-dialog [role=status]')).toContainText('Invalid');
 await page.locator('#cloud-profile-password').fill(password);await page.getByRole('button',{name:'Remember browser',exact:true}).click();await expect(page.locator('.cloud-profile-dialog')).not.toBeVisible();
 await f.restart();await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true');assert.equal(await page.evaluate(()=>MarkdownCloudConnector.identity.name),'alice');
});
