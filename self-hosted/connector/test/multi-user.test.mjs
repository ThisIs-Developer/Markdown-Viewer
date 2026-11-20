import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {request} from 'node:http';
import {createConnector} from '../server.mjs';
import {environmentConfiguration} from '../settings.mjs';
const root='https://dav.example/Selected/',nc='https://nc.example',password='profile-test-password';
const xml=url=>'<d:multistatus xmlns:d="DAV:"><d:response><d:href>'+url+'</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>';
async function fixture(t,{remember=true,rememberDevice=true,maxProfiles=100}={}){
 const directory=await mkdtemp(path.join(tmpdir(),'mv-multi-user-')),key=randomBytes(32),requests=[];
 const config={mode:'multi-user',enabled:true,publicApp:true,dynamicOrigin:true,development:true,remember,rememberDevice,maxProfiles,targets:[{providerId:'webdav',root},{providerId:'nextcloud',root:nc+'/'}]};
 const transport=async(_target,url,method,options={})=>{requests.push({url,method,options});return {transportVersion:1,status:url===nc+'/index.php/login/v2'?200:method==='PROPFIND'?207:200,headers:{etag:'"v1"'},body:url===nc+'/index.php/login/v2'?JSON.stringify({login:nc+'/login/flow/id',poll:{endpoint:nc+'/login/v2/poll',token:'poll-secret'}}):method==='PROPFIND'?xml(url):'# body for '+options.auth.password};};
 let app,origin;const start=async()=>{app=await createConnector({config,key,dataDirectory:directory,transport});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+app.server.address().port;};await start();
 const agent=()=>{
  const cookies=new Map();let csrf='',identity;
  const send=(route,body={},extra={})=>new Promise((resolve,reject)=>{const req=request(origin+route,{method:extra.method || 'POST',headers:{Origin:origin,'Content-Type':'application/json','X-MV-Connector':'1','X-MV-CSRF':csrf,...(identity?{'X-MV-Workspace':identity.id}:{}),Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...extra.headers}},res=>{for(const wire of res.headers['set-cookie'] || []){const [pair]=wire.split(';'),i=pair.indexOf('=');if(pair.slice(i+1))cookies.set(pair.slice(0,i),pair.slice(i+1));else cookies.delete(pair.slice(0,i));}let text='';res.setEncoding('utf8');res.on('data',part=>text+=part);res.on('end',()=>{let json;try{json=JSON.parse(text);}catch{}resolve({status:res.statusCode,text,json,headers:res.headers});});});req.on('error',reject);req.end(extra.method==='GET'?undefined:JSON.stringify(body));});
  const boot=async()=>{const result=await send('/api/cloud/bootstrap.js',{}, {method:'GET'});assert.equal(result.status,200,result.text);const value=JSON.parse(result.text.match(/MarkdownCloudConnector=(.*);\n/)[1]);csrf=value.csrf;identity=value.identity;return value;};
  const register=async(name,remember=false)=>{const result=await send('/api/cloud/profile/register',{username:name,password,remember});if(result.status===200){csrf=result.json.result.csrf;identity=result.json.result.identity;}return result;};
  const login=async(name,remember=false)=>{const result=await send('/api/cloud/login',{username:name,password,remember});if(result.status===200){csrf=result.json.csrf;identity=result.json.identity;}return result;};
  return {send,boot,register,login,cookies,get identity(){return identity;},set identity(value){identity=value;}};
 };
 t.after(async()=>{await app.close();await rm(directory,{recursive:true,force:true});});
 return {agent,config,key,directory,requests,restart:async()=>{await app.close();await start();},get app(){return app;}};
}
const connect=(agent,secret)=>agent.send('/api/cloud/connect/webdav',{root,username:'shared-name',password:secret});
const input=id=>({providerId:'webdav',root,url:root+'notes.md',method:'GET',auth:{credentialId:id},headers:{'Accept-Encoding':'identity'},maxBytes:1024});

test('guests are isolated and cannot remember credentials or poll another session login',async t=>{
 const f=await fixture(t),a=f.agent(),b=f.agent();await a.boot();await b.boot();assert.notEqual(a.identity.id,b.identity.id);
 const r=(await connect(a,'guest-a')).json.result;assert.equal((await b.send('/api/cloud/request',input(r.id))).status,403);
 assert.equal((await a.send('/api/cloud/accounts/store',r)).status,403);assert.deepEqual((await b.send('/api/cloud/accounts/list')).json.result,[]);
 const flow=await a.send('/api/cloud/connect/nextcloud/start',{server:nc}),before=f.requests.length;
 assert.notEqual((await b.send('/api/cloud/connect/nextcloud/poll',{id:flow.json.result.id})).status,200);assert.equal(f.requests.length,before);
 assert.equal((await b.send('/api/cloud/profile/register',{username:'guest-b',password},{headers:{Origin:'https://evil.example'}})).status,403);
});

test('profile creation adopts only its own guest connections; identical cloud IDs remain owner scoped',async t=>{
 const f=await fixture(t),a=f.agent(),b=f.agent();await a.boot();await b.boot();const r=(await connect(a,'alice-access')).json.result;
 assert.equal((await a.register('Alice')).status,200);assert.equal(a.identity.name,'alice');assert.equal((await b.register('Bob')).status,200);
 assert.equal((await b.send('/api/cloud/request',input(r.id))).status,403);assert.equal((await b.send('/api/cloud/accounts/forget',r)).status,403);
 const own=(await connect(b,'bob-access')).json.result;assert.equal(own.id,r.id);assert.equal((await b.send('/api/cloud/accounts/store',own)).status,200);
 assert.equal((await a.send('/api/cloud/request',input(r.id))).json.result.body,'# body for alice-access');assert.equal((await b.send('/api/cloud/request',input(r.id))).json.result.body,'# body for bob-access');
 assert.equal((await b.send('/api/cloud/accounts/forget',own)).status,200);assert.equal((await a.send('/api/cloud/request',input(r.id))).status,200);
 const wire=await readFile(path.join(f.directory,'profiles.sqlite'));assert.equal(wire.includes(Buffer.from('alice-access')),false);assert.equal(wire.includes(Buffer.from(password)),false);
});

test('remembered browser restores after restart and logout/revoke cannot restore access',async t=>{
 const f=await fixture(t),a=f.agent();await a.boot();const r=(await connect(a,'saved-access')).json.result;assert.equal((await a.register('Alice',true)).status,200);const id=a.identity.id;
 await f.restart();const restored=await a.boot();assert.equal(restored.identity.id,id);assert.equal((await a.send('/api/cloud/request',input(r.id))).json.result.body,'# body for saved-access');
 const b=f.agent();await b.boot();assert.equal((await b.login('alice',true)).status,200);
 assert.equal((await b.send('/api/cloud/devices/remember')).status,401);assert.equal((await b.send('/api/cloud/devices/remember',{password:'wrong-password'})).status,401);assert.equal((await b.send('/api/cloud/devices/remember',{password})).status,200);
 assert.equal((await a.send('/api/cloud/logout')).status,200);await a.boot();assert.equal(a.identity.kind,'guest');assert.equal((await a.send('/api/cloud/request',input(r.id))).status,403);assert.equal((await b.send('/api/cloud/accounts/list')).json.result.length,1);
 assert.equal((await b.send('/api/cloud/devices/revoke')).status,200);await f.restart();await b.boot();assert.equal(b.identity.kind,'guest');assert.equal((await b.send('/api/cloud/accounts/list')).json.result.length,0);
 assert.equal((await b.login('alice')).status,200);assert.equal((await b.send('/api/cloud/accounts/list')).json.result.length,1);
});

test('password-only profile sessions expire on restart but credentials survive; stale workspace headers are refused',async t=>{
 const f=await fixture(t),a=f.agent();await a.boot();assert.equal((await a.register('Alice')).status,200);const old=a.identity;
 await f.restart();await a.boot();assert.equal(a.identity.kind,'guest');assert.equal((await a.send('/api/cloud/accounts/list',{}, {headers:{'X-MV-Workspace':old.id}})).json.error.code,'IDENTITY_CHANGED');
 assert.equal((await a.login('alice')).status,200);
 assert.equal((await a.send('/api/cloud/accounts/list',{}, {headers:{'X-MV-CSRF':'invalid'}})).status,403);
});

test('disabled remember policy, profile limits and invalid registration cannot persist credentials',async t=>{
 const f=await fixture(t,{remember:false,rememberDevice:false,maxProfiles:1}),a=f.agent(),b=f.agent();await a.boot();await b.boot();
 assert.notEqual((await a.send('/api/cloud/profile/register',{username:'first',password:'short'})).status,200);
 assert.equal((await a.register('first',true)).status,403);assert.equal((await a.register('first')).status,200);
 assert.equal((await b.register('second')).status,429);const r=(await connect(a,'session-only')).json.result;assert.equal((await a.send('/api/cloud/accounts/store',r)).status,403);
 assert.equal((await a.send('/api/cloud/devices/remember')).status,403);
});

test('personal remember browser survives regenerated startup salt and changing its password revokes access',async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'mv-personal-remember-'));
 const env={CLOUD_ENABLED:'true',CLOUD_REMEMBER_DEVICE:'true',CLOUD_ACCESS_PASSWORD:'personal-test-password',CLOUD_DATA_DIR:directory,CLOUD_DEVELOPMENT:'true'};
 let app,origin;const start=async()=>{app=await createConnector(await environmentConfiguration(env));await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+app.server.address().port;};await start();
 t.after(async()=>{await app.close();await rm(directory,{recursive:true,force:true});});let cookies=[];
 const send=async(route,body)=>{const result=await fetch(origin+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-MV-Connector':'1',Cookie:cookies.join('; ')},body:JSON.stringify(body || {})});for(const wire of result.headers.getSetCookie()){const name=wire.split('=')[0];cookies=cookies.filter(value=>!value.startsWith(name+'='));if(!wire.includes('Max-Age=0'))cookies.push(wire.split(';')[0]);}return result;};
 assert.equal((await send('/api/cloud/login',{username:'owner',password:env.CLOUD_ACCESS_PASSWORD,remember:true})).status,200);await app.close();await start();assert.equal((await send('/api/cloud/session')).status,200);
 await app.close();env.CLOUD_ACCESS_PASSWORD='changed-personal-password';await start();assert.equal((await send('/api/cloud/session')).status,401);
});


test('wrong persistent key fails closed without replacing the profile store',async t=>{
 const f=await fixture(t),a=f.agent();await a.boot();assert.equal((await a.register('alice',true)).status,200);
 const {openProfiles}=await import('../profiles.mjs');await assert.rejects(openProfiles(f.directory,randomBytes(32)),/key mismatch/);
 assert.equal((await a.send('/api/cloud/accounts/list')).status,200);assert.equal((await a.login('alice')).status,200);
});


test('credential metadata endpoints reject oversized JSON before any credential operation',async t=>{
 const f=await fixture(t),a=f.agent();await a.boot();const before=f.requests.length;assert.equal((await a.send('/api/cloud/accounts/list',{padding:'x'.repeat(20000)})).status,413);assert.equal(f.requests.length,before);
});
