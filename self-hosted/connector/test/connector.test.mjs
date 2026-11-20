import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createConnector } from '../server.mjs';
import { passwordHash, publicAddress, pinnedAddress, remoteURL, targetFor, upstream, hash } from '../security.mjs';
import { openVault } from '../vault.mjs';
const salt='0123456789abcdef0123456789abcdef',password='test-owner-password',root='https://dav.example/Selected/',base='https://nc.example/cloud';
const prop=(url,etag='"v1"',folder=false)=>'<d:multistatus xmlns:d="DAV:"><d:response><d:href>'+url+'</d:href><d:propstat><d:prop><d:resourcetype>'+(folder?'<d:collection/>':'')+'</d:resourcetype><d:getetag>'+etag+'</d:getetag></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>';
async function fixture(t) {
 const directory=await mkdtemp(path.join(tmpdir(),'mv-connector-')),key=randomBytes(32),requests=[];
 const state={body:'# Original',etag:'"v1"',folder:false,mode:'',pending:null};
 const config={origin:'http://127.0.0.1:1',development:true,owner:{username:'owner',salt,passwordHash:passwordHash(password,salt)},targets:[{providerId:'webdav',root},{providerId:'nextcloud',root:base+'/'}]};
 const transport=async(target,url,method,options={})=>{
  requests.push({target,url,method,options});const reply=(status,body='',headers={})=>({transportVersion:1,status,body,headers});
  if(url===base+'/index.php/login/v2')return reply(200,JSON.stringify({login:base+'/login/flow/id',poll:{endpoint:base+'/login/v2/poll',token:'hidden-poll-token'}}));
  if(url===base+'/login/v2/poll')return reply(200,JSON.stringify({server:base,loginName:'alice',appPassword:'hidden-nextcloud-secret'}));
  if(url===base+'/ocs/v2.php/cloud/user?format=json')return reply(200,JSON.stringify({ocs:{data:{id:'alice'}}}));
  if(options.auth?.username!=='davuser' || options.auth?.password!=='hidden-dav-secret')return reply(401);
  if(state.mode==='block'){await new Promise(resolve=>state.pending=resolve);state.mode='';}
  if(method==='PROPFIND')return reply(207,prop(url,state.etag,url===root || state.folder));
  if(method==='PUT'){if(options.headers['If-Match'] && options.headers['If-Match']!==state.etag)return reply(412);if(options.headers['If-None-Match']==='*' && !url.endsWith('new.md'))return reply(412);state.body=options.body;state.etag='"v2"';return reply(204);}
  if(method==='DELETE')return reply(options.headers['If-Match']===state.etag?204:412);
  return reply(200,state.body,{etag:state.etag});
 };
 const app=await createConnector({config,key,dataDirectory:directory,transport});
 // Bind a reserved ephemeral socket first, then configure the exact origin before requests.
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+app.server.address().port;
 // createConnector captured its URL object, so use its fixed host via a local HTTP client.
 const {request}=await import('node:http');let cookie='',csrf='';
 const send=(route,body={},extra={})=>new Promise((resolve,reject)=>{const payload=JSON.stringify(body);const req=request(origin+route,{method:extra.method || 'POST',headers:{Host:'127.0.0.1:1',Origin:config.origin,'Content-Type':'application/json','X-MV-Connector':'1','X-MV-CSRF':csrf,Cookie:cookie,...extra.headers}},res=>{let text='';res.setEncoding('utf8');res.on('data',c=>text+=c);res.on('end',()=>{let json;try{json=JSON.parse(text);}catch{}resolve({status:res.statusCode,headers:res.headers,text,json});});});req.on('error',reject);req.end((extra.method || 'POST')==='GET'?undefined:payload);});
 const login=async()=>{const response=await send('/api/cloud/login',{username:'owner',password});assert.equal(response.status,200,response.text);cookie=response.headers['set-cookie'][0].split(';')[0];const bootstrap=await send('/api/cloud/bootstrap.js',{}, {method:'GET'});csrf=JSON.parse(bootstrap.text.match(/MarkdownCloudConnector=(.*);\n/)[1]).csrf;return bootstrap;};
 const connect=async()=>{const res=await send('/api/cloud/connect/webdav',{root,username:'davuser',password:'hidden-dav-secret'});assert.equal(res.status,200,res.text);return res.json.result;};
 const input=record=>({providerId:'webdav',root,url:root+'notes.md',method:'GET',auth:{credentialId:record.id},headers:{'Accept-Encoding':'identity'},maxBytes:1024});
 t.after(async()=>{state.pending?.();await app.close();await rm(directory,{recursive:true,force:true});});
 return {app,config,key,directory,send,login,connect,input,state,requests};
}
test('deny unauthenticated API, hostile host/origin and missing CSRF; cookies and bootstrap are private',async t=>{
 const f=await fixture(t);assert.equal((await f.send('/api/cloud/accounts/list')).status,401);
 assert.equal((await f.send('/api/cloud/login',{username:'owner',password},{headers:{Origin:'https://hostile.example'}})).status,403);
 const boot=await f.login();assert.equal(boot.headers['cache-control'],'no-store');assert.doesNotMatch(boot.text,/test-owner-password|hidden-nextcloud-secret/);
 assert.equal((await f.send('/api/cloud/accounts/list',{}, {headers:{'X-MV-CSRF':'wrong'}})).status,403);
 assert.equal((await f.send('/api/cloud/accounts/list',{}, {headers:{Host:'evil.example'}})).status,403);
 assert.equal((await f.send('/package.json',{}, {method:'GET'})).status,404);
 assert.equal((await f.send('/self-hosted/connector/server.mjs',{}, {method:'GET'})).status,404);
 assert.equal((await f.send('/assets/%2e%2e%2fself-hosted/connector/server.mjs',{}, {method:'GET'})).status,404);
 assert.equal((await f.send('/seo/%2e%2e%2fpackage.json',{}, {method:'GET'})).status,404);
});
test('WebDAV scoped handles, encrypted remember/reopen/forget and no credential response',async t=>{
 const f=await fixture(t);await f.login();const record=await f.connect();assert.doesNotMatch(JSON.stringify(record),/secret|password/i);
 assert.deepEqual((await f.send('/api/cloud/accounts/list')).json.result,[]);
 assert.equal((await f.send('/api/cloud/accounts/store',record)).status,200);
 const disk=await readFile(path.join(f.directory,'credentials.enc'),'utf8');assert.doesNotMatch(disk,/hidden-dav-secret|davuser|Selected/);
 const reopened=await openVault(f.directory,f.key,'owner');assert.equal(reopened.get(record.id).appPassword,'hidden-dav-secret');
 await assert.rejects(openVault(f.directory,randomBytes(32),'owner'),/refusing to overwrite/);assert.equal(await readFile(path.join(f.directory,'credentials.enc'),'utf8'),disk);
 assert.equal((await f.send('/api/cloud/disconnect')).status,200);
 assert.equal((await f.send('/api/cloud/request',f.input(record))).json.result.body,'# Original');
 assert.equal((await f.send('/api/cloud/accounts/forget',record)).status,200);
 assert.equal((await f.send('/api/cloud/request',f.input(record))).status,403);
});
test('reject unapproved targets, root substitution, foreign paths, missing guards and folder deletion',async t=>{
 const f=await fixture(t);await f.login();const r=await f.connect(),input=f.input(r),before=f.requests.length;
 for(const change of [{url:'https://foreign.example/notes.md'},{url:root+'%252e%252e/private.md'},{root:'https://dav.example/'},{auth:{credentialId:r.id,password:'stolen'}},{method:'MOVE'},{method:'PUT',body:'# Bad'},{method:'DELETE',headers:{'If-Match':'W/"v1"'}},{method:'PUT',url:root+'image.png',headers:{'If-None-Match':'*'},body:'x'}])assert.notEqual((await f.send('/api/cloud/request',{...input,...change})).status,200);
 assert.equal(f.requests.length,before);
 assert.equal((await f.send('/api/cloud/connect/webdav',{root:'https://private.example/',username:'x',password:'y'})).status,403);
 f.state.folder=true;assert.notEqual((await f.send('/api/cloud/request',{...input,method:'DELETE',headers:{'If-Match':'"v1"'}})).status,200);assert.equal(f.requests.filter(r=>r.method==='DELETE').length,0);
});
test('conditional writes retain guards; stale updates and occupied creates never overwrite',async t=>{
 const f=await fixture(t);await f.login();const r=await f.connect(),input=f.input(r);
 const stale=await f.send('/api/cloud/request',{...input,method:'PUT',headers:{'If-Match':'"stale"'},body:'# Stale'});assert.equal(stale.json.result.status,412);assert.equal(f.state.body,'# Original');
 const saved=await f.send('/api/cloud/request',{...input,method:'PUT',headers:{'If-Match':'"v1"'},body:'# Updated'});assert.equal(saved.status,200,saved.text);assert.equal(saved.json.result.status,204);assert.equal(f.state.body,'# Updated');
 const occupied=await f.send('/api/cloud/request',{...input,method:'PUT',headers:{'If-None-Match':'*'},body:'# Collision'});assert.equal(occupied.json.result.status,412);assert.equal(f.state.body,'# Updated');
});
test('Nextcloud secrets and poll tokens never cross the browser API boundary',async t=>{
 const f=await fixture(t);await f.login();const start=await f.send('/api/cloud/connect/nextcloud/start',{server:base});assert.equal(start.status,200,start.text);assert.doesNotMatch(start.text,/hidden-poll-token/);
 const poll=await f.send('/api/cloud/connect/nextcloud/poll',{id:start.json.result.id});assert.equal(poll.status,200,poll.text);assert.doesNotMatch(poll.text,/hidden-nextcloud-secret|appPassword/);
 assert.equal(poll.json.result.account.id,hash(JSON.stringify([base,'alice'])));
 await f.send('/api/cloud/accounts/store',poll.json.result.account);assert.equal(f.app.vault.get(poll.json.result.account.id).appPassword,'hidden-nextcloud-secret');
 assert.notEqual((await f.send('/api/cloud/connect/nextcloud/poll',{id:start.json.result.id})).status,200);
});
test('in-flight operations cannot be overlapped/replayed by the same session',async t=>{
 const f=await fixture(t);await f.login();const r=await f.connect();f.state.mode='block';const first=f.send('/api/cloud/request',f.input(r));while(!f.state.pending)await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal((await f.send('/api/cloud/request',f.input(r))).status,429);f.state.pending();assert.equal((await first).status,200);
});
test('logout revokes session and limits repeated password attempts',async t=>{
 const f=await fixture(t);await f.login();assert.equal((await f.send('/api/cloud/logout')).status,200);assert.equal((await f.send('/api/cloud/accounts/list')).status,401);
 for(let i=0;i<9;i++)assert.equal((await f.send('/api/cloud/login',{username:'owner',password:'bad'})).status,401);
 assert.equal((await f.send('/api/cloud/login',{username:'owner',password:'bad'})).status,429);
});
test('SSRF filtering rejects private/mapped DNS answers and pins public addresses',async()=>{
 for(const address of ['127.0.0.1','10.1.1.1','169.254.169.254','172.16.0.1','192.168.1.1','100.64.0.1','::1','::ffff:127.0.0.1','fc00::1','fe80::1','2001:db8::1','2001::7f00:1','2001:0000::1','2002:7f00:1::'])assert.equal(publicAddress(address),false,address);
 assert.equal(publicAddress('8.8.8.8'),true);assert.equal(publicAddress('2606:4700:4700::1111'),true);
 await assert.rejects(pinnedAddress(new URL('https://dav.example/'),{},async()=>[{address:'8.8.8.8',family:4},{address:'127.0.0.1',family:4}]),/not permitted/);
 assert.equal((await pinnedAddress(new URL('https://dav.example/'),{},async()=>[{address:'8.8.8.8',family:4}])).address,'8.8.8.8');
 for(const url of ['https://dav.example/%2e%2e/secret','https://dav.example/%252fetc','https://user:secret@dav.example/'])assert.throws(()=>remoteURL(url));
 assert.throws(()=>targetFor({targets:[]},'webdav',root));
});
test('real HTTP transport refuses redirects/compression/oversize and sends conditional headers',async t=>{
 const seen=[];const remote=createServer((req,res)=>{seen.push(req.headers);if(req.url==='/redirect'){res.writeHead(302,{Location:'http://127.0.0.1/secret'});res.end();}else if(req.url==='/invalid'){res.end(Buffer.from([0xff,0xfe]));}else if(req.url==='/compressed'){res.setHeader('Content-Encoding','gzip');res.end('bad');}else res.end('12345');});await new Promise(resolve=>remote.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>remote.close(resolve)));
 const origin='http://127.0.0.1:'+remote.address().port,target={root:origin+'/',allowPrivate:true,allowHttpLoopback:true};
 await assert.rejects(upstream(target,origin+'/redirect','GET'),/redirect/);await assert.rejects(upstream(target,origin+'/compressed','GET'),/compressed/);
 await assert.rejects(upstream(target,origin+'/invalid','GET'),/UTF-8/);
 await assert.rejects(upstream(target,origin+'/large','GET',{maxBytes:2}),/limit|interrupted/);
 const response=await upstream(target,origin+'/file','PUT',{headers:{'If-Match':'"v1"'},body:'md',auth:{username:'alice',password:'secret'}});assert.equal(response.body,'12345');assert.equal(seen.at(-1)['if-match'],'"v1"');
 await assert.rejects(upstream({...target,allowPrivate:false},origin+'/file','GET'),/not permitted/);
});

test('unremember retains only the newly authenticated session; session-only disconnect releases credentials',async t=>{
 const f=await fixture(t);await f.login();const record=await f.connect();await f.send('/api/cloud/accounts/store',record);
 assert.equal((await f.send('/api/cloud/accounts/unremember',record)).status,200);assert.equal(f.app.vault.get(record.id),undefined);
 assert.equal((await f.send('/api/cloud/request',f.input(record))).status,200);
 await f.send('/api/cloud/accounts/release',record);assert.equal((await f.send('/api/cloud/request',f.input(record))).status,403);
});

test('untrusted TLS certificates are rejected before credentials reach the remote handler',async t=>{
 const openssl=process.platform==='win32'?'C:/Program Files/Git/usr/bin/openssl.exe':'openssl';if(process.platform==='win32' && !existsSync(openssl)){t.skip('OpenSSL unavailable');return;}
 const directory=await mkdtemp(path.join(tmpdir(),'mv-connector-tls-')),key=path.join(directory,'key.pem'),cert=path.join(directory,'cert.pem');
 execFileSync(openssl,['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{stdio:'ignore',windowsHide:true});
 let count=0;const remote=createHttpsServer({key:await readFile(key),cert:await readFile(cert)},(_req,res)=>{count++;res.end('unexpected');});await new Promise(resolve=>remote.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>remote.close(resolve));await rm(directory,{recursive:true,force:true});});
 const origin='https://127.0.0.1:'+remote.address().port;
 await assert.rejects(upstream({root:origin+'/',allowPrivate:true},origin+'/file','GET',{auth:{username:'alice',password:'secret'}}),/Cloud request failed/);assert.equal(count,0);
});


test('collection creation is bounded, create-only, empty and never authorizes root mutation',async t=>{
 const f=await fixture(t);await f.login();const r=await f.connect(),input=f.input(r),before=f.requests.length;
 const valid={...input,url:root+'New/',method:'MKCOL',headers:{'If-None-Match':'*'}};
 for(const change of [{url:root},{url:root+'NoSlash'},{headers:{}},{headers:{'If-None-Match':'*','If-Match':'"v1"'}},{body:'untrusted XML'},{url:root+'%252e%252e/'}])assert.notEqual((await f.send('/api/cloud/request',{...valid,...change})).status,200);
 assert.equal(f.requests.length,before);
 assert.equal((await f.send('/api/cloud/request',valid)).status,200);
 assert.equal(f.requests.at(-1).method,'MKCOL');assert.equal(f.requests.at(-1).options.headers['If-None-Match'],'*');assert.equal(f.requests.at(-1).options.body,undefined);
});
