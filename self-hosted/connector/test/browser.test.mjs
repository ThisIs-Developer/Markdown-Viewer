import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { createConnector } from '../server.mjs';
import { passwordHash } from '../security.mjs';
const require=createRequire(new URL('../../../package.json',import.meta.url));
const {chromium,expect}=require('@playwright/test');
const {openApp}=require('./tests/helpers/app.js');
const {cloudAction}=require('./tests/helpers/cloud-workspace.js');
const root='https://dav.example/Selected/',nc='https://nc.example/cloud',ncRoot=nc+'/remote.php/dav/files/alice/';
const xml=(url,folder,etag)=>'<d:response><d:href>'+url+'</d:href><d:propstat><d:prop><d:resourcetype>'+(folder?'<d:collection/>':'')+'</d:resourcetype><d:getetag>'+(etag || '')+'</d:getetag></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>';
test('self-hosted browser connects, confirms save, preserves draft on reload/logout, creates and deletes Markdown',async t=>{
 const reservation=createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
 const origin='http://127.0.0.1:'+port,directory=await mkdtemp(path.join(tmpdir(),'mv-connector-browser-')),salt='0123456789abcdef0123456789abcdef';
 const folders=new Set([root,ncRoot]);
 const files=new Map([[root+'notes.md',{body:'# Original',etag:'"v1"'}],[ncRoot+'cloud.md',{body:'# Nextcloud original',etag:'"nc1"'}]]),requests=[];let version=1;
 const transport=async(_target,url,method,options={})=>{
  requests.push({url,method,options});const reply=(status,body='',headers={})=>({transportVersion:1,status,body,headers});
  if(url===nc+'/index.php/login/v2')return reply(200,JSON.stringify({login:nc+'/login/flow/id',poll:{endpoint:nc+'/login/v2/poll',token:'nc-poll-secret'}}));
  if(url===nc+'/login/v2/poll')return reply(200,JSON.stringify({server:nc,loginName:'alice',appPassword:'nc-app-secret'}));
  if(url===nc+'/ocs/v2.php/cloud/user?format=json')return reply(200,JSON.stringify({ocs:{data:{id:'alice'}}}));
  const davRoot=url.startsWith(ncRoot)?ncRoot:root;
  if(davRoot===root && (options.auth?.username!=='davuser' || options.auth?.password!=='dav-secret'))return reply(401);
  if(davRoot===ncRoot && (options.auth?.username!=='alice' || options.auth?.password!=='nc-app-secret'))return reply(401);
  const file=files.get(url);
  if(method==='MKCOL'){if(options.headers['If-None-Match']!=='*' || folders.has(url) || files.has(url))return reply(412);folders.add(url);return reply(201);}
  if(method==='PROPFIND'){if(!folders.has(url) && !file)return reply(404);let body=xml(url,folders.has(url),file?.etag);if(options.headers.Depth==='1')body+=[...files].filter(([u])=>u.startsWith(url)).map(([u,f])=>xml(u,false,f.etag)).join('');return reply(207,'<d:multistatus xmlns:d="DAV:">'+body+'</d:multistatus>');}
  if(method==='GET')return file?reply(200,file.body,{etag:file.etag}):reply(404);
  if(method==='PUT'){if(options.headers['If-None-Match']==='*'?!!file:!file || options.headers['If-Match']!==file.etag)return reply(412);files.set(url,{body:options.body,etag:'"v'+ ++version+'"'});return reply(file?204:201);}
  if(method==='DELETE'){if(!file || options.headers['If-Match']!==file.etag)return reply(412);files.delete(url);return reply(204);}
 };
 const app=await createConnector({config:{origin:null,dynamicOrigin:true,publicApp:true,enabled:true,remember:true,development:true,owner:{username:'owner',salt,passwordHash:passwordHash('owner-test-secret',salt)},targets:[{providerId:'webdav',root},{providerId:'nextcloud',root:nc+'/'}]},key:randomBytes(32),dataDirectory:directory,transport});await new Promise(resolve=>app.server.listen(port,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true}),context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 t.after(async()=>{await browser.close();await app.close();await rm(directory,{recursive:true,force:true});});
 // Simulate the stale edge cache that hid Cloud connections in the previous release.
 await context.route(origin+'/script.js',route=>route.fulfill({contentType:'text/javascript',body:'throw Error("stale unversioned script loaded");'}));
 await context.addInitScript(()=>{
  if(localStorage.__webCopySeed)return;localStorage.__webCopySeed='true';
  localStorage.setItem('markdownViewerTabs',JSON.stringify([{id:'web-copy-source',title:'Web source',content:'# Web Vault copy',workspaceId:'workspace_default',folderId:'web-folder',isOpen:true,createdAt:1,lastOpenedAt:1}]));
  localStorage.setItem('markdownViewerDocumentOrganization',JSON.stringify({version:1,workspaces:[],folders:[{id:'web-folder',name:'Web folder',workspaceId:'workspace_default',parentFolderId:null,expanded:true}],ui:{},linkedLocations:[]}));
 });
 await openApp(page,origin);assert.equal(await page.evaluate(()=>Boolean(window.Neutralino?.extensions)),false);
 await page.getByRole('button',{name:'Open workspace settings',exact:true}).click();await page.locator('#cloud-connections-button').click();
 await page.locator('#cloud-provider').selectOption('webdav');await page.locator('#cloud-root').fill(root);await page.locator('#cloud-username').fill('davuser');await page.locator('#cloud-password').fill('dav-secret');
 await expect(page.locator('#nextcloud-remember')).not.toBeChecked();await page.locator('#nextcloud-remember').check();await page.getByRole('button',{name:'Connect to WebDAV',exact:true}).click();
 const unlock=await page.locator('dialog[open]').boundingBox();assert.ok(Math.abs(unlock.x+unlock.width/2-720)<2);assert.ok(Math.abs(unlock.y+unlock.height/2-500)<2);
 await page.screenshot({path:process.env.TEMP+'/mv-3105-unlock.png'});
 await page.locator('#cloud-access-password').fill('owner-test-secret');await page.getByRole('button',{name:'Unlock',exact:true}).click();
 await expect(page.locator('.cloud-settings-dialog')).not.toBeVisible();await page.locator('#nextcloud-panel').getByRole('button',{name:'notes.md',exact:true}).click();
 await expect(page.locator('#markdown-editor')).toHaveValue('# Original');await page.locator('#markdown-editor').fill('# Browser draft');
 await page.locator('#markdown-editor').press('Control+s');await expect(page.locator('#linked-confirm-modal')).toHaveAttribute('aria-hidden','false');assert.equal(files.get(root+'notes.md').body,'# Original');await page.locator('#linked-confirm-modal-confirm').click();
 await expect.poll(()=>files.get(root+'notes.md').body).toBe('# Browser draft');await expect(page.locator('#nextcloud-status')).toContainText('Saved');
 await page.locator('#markdown-editor').fill('# Newer unsaved draft');await page.waitForTimeout(1200);await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true');await expect(page.locator('#markdown-editor')).toHaveValue('# Newer unsaved draft');assert.equal(files.get(root+'notes.md').body,'# Browser draft');
 for(const folderCopy of [false,true]){
  const selector=folderCopy?'[data-tree-type="folder"][data-tree-id="web-folder"]':'#document-tree [data-document-id="web-copy-source"]';
  await page.locator(selector).dispatchEvent('contextmenu',{clientX:120,clientY:200});await page.locator('.document-menu-dropdown.open').getByRole('menuitem',{name:'Copy to cloud…',exact:true}).click();
  await expect(page.locator('#cloud-copy-modal .reset-modal-confirm')).toBeEnabled();await page.locator('#cloud-copy-name').fill(folderCopy?'Web folder copy':'web-copy.md');await page.locator('#cloud-copy-modal .reset-modal-confirm').click();await expect(page.locator('.cloud-copy-status')).toContainText('Copy complete');
  assert.equal(files.get(root+(folderCopy?'Web%20folder%20copy/Web%20source.md':'web-copy.md')).body,'# Web Vault copy');
  await page.locator('#cloud-copy-modal .reset-modal-cancel').click();
 }
 const storage=await page.evaluate(async()=>({local:JSON.stringify(localStorage),config:MarkdownCloudConnector}));assert.doesNotMatch(storage.local,/dav-secret|owner-test-secret/);
 // Create and delete through the context menus, preserving the source draft.
 await cloudAction(page,'New Markdown file');await page.locator('#document-name-modal-input').fill('new.md');await page.locator('#document-name-modal-confirm').click();
 await expect.poll(()=>files.has(root+'new.md')).toBe(true);await expect(page.locator('#markdown-editor')).toHaveValue('');
 await page.locator('#markdown-editor').fill('# Deletion recovery');await cloudAction(page,'Delete from cloud');await expect(page.locator('#linked-confirm-modal')).toBeVisible();assert.equal(files.has(root+'new.md'),true);
 await page.locator('#linked-confirm-modal-cancel').click();assert.equal(files.has(root+'new.md'),true);
 await cloudAction(page,'Delete from cloud');await page.locator('#linked-confirm-modal-confirm').click();await expect.poll(()=>files.has(root+'new.md')).toBe(false);
 await expect(page.locator('#markdown-editor')).toHaveValue('# Deletion recovery');
 await page.locator('#tab-list .tab-item').filter({hasText:'notes.md'}).click();await expect(page.locator('#markdown-editor')).toHaveValue('# Newer unsaved draft');
 await page.getByRole('button',{name:'Open workspace settings',exact:true}).click();await page.locator('#cloud-connections-button').click();await page.getByRole('button',{name:'Lock cloud access'}).click();await page.waitForFunction(()=>!MarkdownCloudConnector.csrf);await expect(page.locator('#markdown-editor')).toHaveValue('# Newer unsaved draft');
 await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true');await expect(page.locator('#markdown-editor')).toHaveValue('# Newer unsaved draft');
 assert.equal(await page.evaluate(()=>JSON.stringify(localStorage).includes('dav-secret')),false);
 const stranger=await browser.newContext();const otherPage=await stranger.newPage();assert.equal((await stranger.request.get(origin)).status(),200);assert.equal((await stranger.request.post(origin+'/api/cloud/accounts/list',{data:{}})).status(),401);await stranger.close();
 await context.route(nc+'/login/flow/id',route=>route.fulfill({contentType:'text/html',body:'<p>Controlled Nextcloud approval</p>'}));
 await page.getByRole('button',{name:'Open workspace settings',exact:true}).click();await page.locator('#cloud-connections-button').click();
 await page.locator('#cloud-provider').selectOption('nextcloud');await page.locator('#nextcloud-server').fill(nc);await page.getByRole('button',{name:'Connect to Nextcloud',exact:true}).click();
 await page.locator('#cloud-access-password').fill('owner-test-secret');await page.getByRole('button',{name:'Unlock',exact:true}).click();
 await expect(page.locator('.cloud-settings-dialog')).not.toBeVisible();await page.locator('#nextcloud-panel').getByRole('button',{name:'cloud.md',exact:true}).click();await expect(page.locator('#markdown-editor')).toHaveValue('# Nextcloud original');
 await page.locator('#markdown-editor').fill('# Nextcloud browser edit');await page.locator('#markdown-editor').press('Control+s');await expect(page.locator('#linked-confirm-modal')).toBeVisible();await page.locator('#linked-confirm-modal-confirm').click();await expect.poll(()=>files.get(ncRoot+'cloud.md').body).toBe('# Nextcloud browser edit');
 assert.equal(await page.evaluate(()=>JSON.stringify(localStorage).includes('nc-app-secret')),false);
 assert.deepEqual(errors,[]);assert.ok(requests.some(r=>r.method==='PUT' && r.options.headers['If-Match']==='"v1"'));
});
