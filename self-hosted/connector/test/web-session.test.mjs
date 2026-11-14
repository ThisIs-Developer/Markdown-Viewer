import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {createConnector} from '../server.mjs';
import {passwordHash,hash} from '../security.mjs';
const require=createRequire(new URL('../../../package.json',import.meta.url));
const {chromium,expect}=require('@playwright/test');
const {openApp}=require('./tests/helpers/app.js');
const root='https://dav.example/Selected/',password='owner-review-test',salt='0123456789abcdef0123456789abcdef';
async function fixture(t){
 const directory=await mkdtemp(path.join(tmpdir(),'mv-web-session-review-'));
 const record={providerId:'webdav',id:'webdav-'+hash(JSON.stringify(['webdav',root,'alice'])),root,username:'alice',label:'Review DAV',appPassword:'fixture-only-secret',targetRoot:root};
 const app=await createConnector({config:{origin:null,dynamicOrigin:true,publicApp:true,enabled:true,remember:true,development:true,owner:{username:'owner',salt,passwordHash:passwordHash(password,salt)},targets:[{providerId:'webdav',root}]},key:randomBytes(32),dataDirectory:directory,transport:async()=>({transportVersion:1,status:207,headers:{},body:'<d:multistatus xmlns:d="DAV:"><d:response><d:href>'+root+'</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>'})});
 await app.vault.put(record);await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+app.server.address().port,browser=await chromium.launch({headless:true}),context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
 t.after(async()=>{await browser.close();await app.close();await rm(directory,{recursive:true,force:true});});
 await openApp(page,origin);await page.getByRole('button',{name:'Open workspace settings',exact:true}).click();await page.locator('#cloud-connections-button').click();
 return {page,context,origin,app,record};
}
test('disabling locked cloud never requests the installation password or changes remembered records',async t=>{
 const {page,app,record}=await fixture(t);const original=await page.locator('#markdown-editor').inputValue();
 await page.locator('#cloud-enabled').check();await expect(page.locator('#cloud-enabled')).toBeEnabled();await page.locator('#cloud-enabled').uncheck();
 await expect(page.locator('#cloud-enabled')).toBeEnabled();await expect(page.locator('#cloud-enabled')).not.toBeChecked();assert.equal(await page.locator('dialog[open]').count(),0);
 assert.equal(await page.locator('#markdown-editor').inputValue(),original);assert.equal(app.vault.get(record.id).appPassword,record.appPassword);
});
test('disabling after server session revocation settles locally without relogin',async t=>{
 const {page,context,origin}=await fixture(t);
 const login=await context.request.post(origin+'/api/cloud/login',{headers:{Origin:origin,'X-MV-Connector':'1'},data:{username:'owner',password}});assert.equal(login.status(),200);
 const session=await context.request.post(origin+'/api/cloud/session',{headers:{Origin:origin,'X-MV-Connector':'1'},data:{}});const csrf=(await session.json()).result.csrf;await page.evaluate(token=>MarkdownCloudConnector.csrf=token,csrf);
 assert.equal((await context.request.post(origin+'/api/cloud/logout',{headers:{Origin:origin,'X-MV-CSRF':csrf},data:{}})).status(),200);
 await page.locator('#cloud-enabled').check();await expect(page.locator('#cloud-enabled')).toBeEnabled();await page.locator('#cloud-enabled').uncheck();
 await expect(page.locator('#cloud-enabled')).toBeEnabled();await expect(page.locator('#cloud-enabled')).not.toBeChecked();assert.equal(await page.locator('dialog[open]').count(),0);
});
test('explicit Load remembered accounts unlocks existing records without a new provider login',async t=>{
 const {page,app,record}=await fixture(t);const original=await page.locator('#markdown-editor').inputValue();
 await page.getByRole('button',{name:'Load remembered accounts',exact:true}).click();await expect(page.locator('#cloud-access-password')).toBeVisible();
 await page.locator('#cloud-access-password').fill(password);await page.getByRole('button',{name:'Unlock',exact:true}).click();
 await expect(page.locator('.cloud-settings-account')).toContainText('Review DAV');await expect(page.locator('#nextcloud-panel')).toContainText('Review DAV');
 assert.equal(await page.locator('#markdown-editor').inputValue(),original);assert.equal(app.vault.get(record.id).appPassword,record.appPassword);
});
