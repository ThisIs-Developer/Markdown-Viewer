// Runs only the extension process against a synthetic Neutralino IPC peer and loopback DAV.
// Never launches a desktop window or accesses a real Nextcloud account.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { createServer as createHttpsServer } from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { once } from 'node:events';
const require = createRequire(import.meta.url);
const { wsServer: WebSocketServer } = require('../../node_modules/playwright-core/lib/utilsBundle.js');
const executable = process.argv[2] || new URL('../../desktop-app/cloud-extension/build/markdown-cloud.exe', import.meta.url).pathname.replace(/^\/(.:)/, '$1');
let content = '# Original Ελληνικά', etag = '"v1"', redirects = 0, requests = 0;
let createdMarkdown=null;const collections=new Set();
const expected = 'Basic ' + Buffer.from('alice:synthetic-secret').toString('base64');
const dav = createServer(async (req, res) => {
  requests++;
  if (req.url === '/redirected') redirects++;
  if (req.headers.authorization !== expected) { res.writeHead(401).end(); return; }
  if(req.method==='MKCOL'){assert.equal(req.headers['content-type'],undefined,'empty MKCOL should not claim a JSON body');if(req.headers['if-none-match']!=='*' || collections.has(req.url)){res.writeHead(412).end();return;}collections.add(req.url);res.writeHead(201).end();return;}
  if((req.url==='/remote.php/dav/files/alice/new.md' || req.url==='/generic/selected/new.md')) {
    if(req.method==='PUT') {
      if(req.headers['if-none-match']!=='*' || createdMarkdown!==null){res.writeHead(412).end();return;}
      let text='';for await(const part of req)text+=part;createdMarkdown=text;res.writeHead(201,{ETag:'"created-native"'}).end();return;
    }
    if(createdMarkdown===null){res.writeHead(404).end();return;}
    if(req.method==='DELETE') {
      if(req.headers['if-match']!=='"created-native"'){res.writeHead(412).end();return;}
      createdMarkdown=null;res.writeHead(204).end();return;
    }
    res.writeHead(200,{ETag:'"created-native"'}).end(createdMarkdown);return;
  }
  if (req.url === '/redirect') { res.writeHead(302, {Location:'/redirected'}).end(); return; }
  if (req.url === '/slow') { setTimeout(() => { res.writeHead(200); res.flushHeaders(); setTimeout(() => res.end('late'), 200); }, 200); return; }
  if (req.url === '/large') { res.end('x'.repeat(1025)); return; }
  if (req.url.startsWith('/ocs/')) { res.end('{"ocs":{"data":{"id":"alice"}}}'); return; }
  if (req.method === 'PROPFIND') { res.writeHead(207);res.end('<d:multistatus xmlns:d="DAV:"/>');return; }
  if (req.method === 'PUT') {
    if (req.headers['if-match'] !== etag) { res.writeHead(412).end(); return; }
    let text = ''; for await (const chunk of req) text += chunk;
    content = text; etag = '"v2"';res.writeHead(204).end();return;
  }
  res.writeHead(200, {ETag:etag});res.end(content);
});
await new Promise(resolve => dav.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + dav.address().port;
async function host(runtimePid = process.pid) {
  const server = new WebSocketServer({host:'127.0.0.1', port:0});
  await once(server, 'listening');
  const connection = once(server, 'connection');
  const child = spawn(executable, [], {stdio:['pipe','ignore','pipe'], windowsHide:true});
  let diagnostics = '';child.stderr.on('data', bytes => diagnostics += bytes.toString());
  child.stdin.end(JSON.stringify({nlPort:String(server.address().port), nlToken:'native-token', nlConnectToken:'connect-token', nlExtensionId:'com.markdownviewer.cloud'}));
  const [socket] = await Promise.race([connection, once(child, 'exit').then(([code]) => {throw Error('Extension exited: '+code+' '+diagnostics);}), new Promise((_,reject) => {const t=setTimeout(()=>reject(Error('Extension connect timeout')),10000);t.unref();})]);
  let markReady;
  const ready = new Promise(resolve => { markReady = resolve; });
  const pending = new Map();
  socket.on('message', raw => {
    const reply = JSON.parse(raw);
    assert.equal(reply.accessToken, 'native-token');
    if(reply.method === 'app.getProcessId') {
      socket.send(JSON.stringify({id:reply.id,data:{success:true,returnValue:runtimePid}}));
      markReady();return;
    }
    assert.equal(reply.method, 'app.broadcast');
    assert.equal(reply.data.event, 'cloudResponse');
    const item = pending.get(reply.data.data.id);if(!item)return;
    pending.delete(reply.data.data.id);clearTimeout(item.timer);
    if(reply.data.data.error)item.reject(Object.assign(Error(reply.data.data.error.message),{code:reply.data.data.error.code}));
    else item.resolve(reply.data.data.returnValue);
  });
  await ready;
  return {
    child, socket, server,
    call: (operation,input={}) => new Promise((resolve,reject) => {
      const id=randomUUID(), timer=setTimeout(()=>reject(Error('Extension response timeout')),45000);
      pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({event:'cloudRequest',data:{id,operation,input}}));
    }),
    async close() {
      const exit = once(child,'exit');socket.close();
      const timeout=setTimeout(()=>child.kill(),3000);timeout.unref();
      const [code]=await exit;clearTimeout(timeout);assert.equal(code,0,'extension exits with its IPC connection');
      await new Promise(resolve=>server.close(resolve));
    }
  };
}
async function verifyHostExitWithLiveSocket() {
  const runtime = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {stdio:'ignore',windowsHide:true});
  const runtimeExit = once(runtime,'exit');
  const orphan = await host(runtime.pid);
  const stopped = once(orphan.child,'exit');
  let deadline;
  try {
    runtime.kill();await runtimeExit;
    const [code] = await Promise.race([stopped, new Promise((_, reject) => { deadline=setTimeout(()=>reject(Error('Extension survived runtime process exit with live IPC')),2000); })]);
    assert.equal(code,0,'extension exits when runtime process dies, despite live WebSocket server');
  } finally {
    clearTimeout(deadline);
    if(orphan.child.exitCode===null)orphan.child.kill();
    orphan.socket.terminate();await new Promise(resolve=>orphan.server.close(resolve));
    if(runtime.exitCode===null)runtime.kill();
  }
}
await verifyHostExitWithLiveSocket();
let peer = await host();
const auth = {username:'alice',password:'synthetic-secret'};
const request = (method,route='/',extra={}) => peer.call('request',{url:base+route,method,auth,maxBytes:1024,...extra});
const id=createHash('sha256').update(randomUUID()).digest('hex');
let stored = false;
let storedWebDAV;
try {
  assert.equal((await peer.call('capabilities')).version,5);
  assert.deepEqual((await peer.call('capabilities')).providerIds,['nextcloud','webdav']);
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'markdown-cloud-tls-'));
  let tls;
  try {
    const key=path.join(temporary,'key.pem'), cert=path.join(temporary,'cert.pem');
    execFileSync('C:/Program Files/Git/usr/bin/openssl.exe',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{stdio:'ignore',windowsHide:true});
    let insecureRequests=0;
    tls=createHttpsServer({key:fs.readFileSync(key),cert:fs.readFileSync(cert)},(_req,res)=>{insecureRequests++;res.end('must not be trusted');});
    await new Promise(resolve=>tls.listen(0,'127.0.0.1',resolve));
    await assert.rejects(request('GET','/',{url:'https://127.0.0.1:'+tls.address().port+'/'}));
    assert.equal(insecureRequests,0,'invalid certificates must fail before authenticated HTTP');
  } finally {
    if(tls)await new Promise(resolve=>tls.close(resolve));
    assert.ok(fs.realpathSync(temporary).startsWith(fs.realpathSync(os.tmpdir())+path.sep));
    assert.ok(path.basename(temporary).startsWith('markdown-cloud-tls-'));
    fs.rmSync(temporary,{recursive:true});
  }
  const beforeRejected=requests;
  for (const headers of [{},{'If-Match':'*'},{'If-Match':'W/"v1"'},{'If-Match':'"v1"','if-match':'"v2"'}]) await assert.rejects(request('PUT','/',{headers,body:'# must not write'}));
  assert.equal(requests,beforeRejected,'unsafe PUT must fail before reaching HTTP server');
  const started=Date.now();
  await assert.rejects(request('GET','/slow',{timeoutMs:300}));
  assert.ok(Date.now()-started<1200,'one aggregate deadline covers headers and body');
  const busyRequests=Array.from({length:8},()=>request('GET','/slow',{timeoutMs:1500}));
  const rejectedBusy=assert.rejects(request('GET','/',{timeoutMs:1500}),{code:'BUSY'});
  await rejectedBusy;await Promise.all(busyRequests);
  assert.equal((await request('GET')).body,content);
  assert.equal((await request('PROPFIND','/',{headers:{Depth:'1'},body:'<propfind/>'})).status,207);
  assert.equal((await request('PUT','/',{headers:{'If-Match':'"stale"'},body:'# Wrong'})).status,412);
  assert.equal(content,'# Original Ελληνικά');
  assert.equal((await request('PUT','/',{headers:{'If-Match':'"v1"'},body:'# Updated Ελληνικά'})).status,204);
  assert.equal((await request('GET')).body,'# Updated Ελληνικά');
  assert.equal((await request('GET','/redirect')).status,302);assert.equal(redirects,0);
  await assert.rejects(request('GET','/large'));
  await assert.rejects(request('DELETE'));
  await assert.rejects(request('GET','/',{headers:{Host:'evil.example'}}));
  await assert.rejects(request('GET','/',{url:'http://cloud.example/file'}));
  await assert.rejects(request('GET','/',{maxBytes:20*1024*1024+1}));
  const account={id,server:base,userId:'alice',loginName:'alice',appPassword:'synthetic-secret'};
  const metadata=await peer.call('accountStore',account);stored=true;
  assert.deepEqual(metadata,{id,server:base,userId:'alice',providerId:'nextcloud'});
  const mkdirAuth={providerId:'nextcloud',auth:{credentialId:id},headers:{'If-None-Match':'*'}};
  for(const change of [{headers:{}},{body:'XML'},{headers:{'If-None-Match':'*','If-Match':'"v1"'}},{url:base+'/remote.php/dav/files/alice/'},{url:base+'/remote.php/dav/files/alice/%252e%252e/'}])await assert.rejects(request('MKCOL','/remote.php/dav/files/alice/Copy/',{...mkdirAuth,...change}));
  assert.equal((await request('MKCOL','/remote.php/dav/files/alice/Copy/',mkdirAuth)).status,201);
  assert.equal((await request('MKCOL','/remote.php/dav/files/alice/Copy/',mkdirAuth)).status,412);
  assert.deepEqual((await peer.call('accountList')).find(item=>item.id===id),metadata);
  await peer.close();peer=await host();
  assert.deepEqual((await peer.call('accountList')).find(item=>item.id===id),metadata);
  const scoped={auth:{credentialId:id}};
  const beforeUnknownProvider=requests;
  await assert.rejects(request('GET','/remote.php/dav/files/alice/notes.md',{...scoped,providerId:'unregistered'}),error=>error.code==='CLOUD_EXTENSION');
  assert.equal(requests,beforeUnknownProvider,'unknown provider must fail before any HTTP or credential forwarding');
  await assert.rejects(peer.call('accountStore',{...account,providerId:'unregistered'}),error=>error.code==='CLOUD_EXTENSION');
  await assert.rejects(peer.call('accountForget',{id,providerId:'unregistered'}),error=>error.code==='CLOUD_EXTENSION');
  await assert.rejects(peer.call('accountList',{providerId:'unregistered'}),error=>error.code==='CLOUD_EXTENSION');
  assert.deepEqual((await peer.call('accountList')).find(item=>item.id===id),metadata,'unknown-provider forget cannot remove a legacy account');

  assert.equal((await request('GET','/remote.php/dav/files/alice/notes.md',scoped)).body,content);
  assert.equal((await request('GET','/ocs/v2.php/cloud/user?format=json',scoped)).status,200);
  for (const route of ['/remote.php/dav/files/bob/notes.md','/remote.php/dav/files/alice/../bob/notes.md','/remote.php/dav/files/alice/%2e%2e/bob/notes.md','/remote.php/dav/files/alice/a%2fb.md','/remote.php/dav/files/alice/notes.md?token=x']) {
    const before=requests;await assert.rejects(request('GET',route,scoped));assert.equal(requests,before);
  }
  const beforeUnsafeWrites=requests;
  for(const route of ['/folder/','/notes.txt','/folder.md/','/note.md?x=1']) {
    await assert.rejects(request('PUT',route,{...scoped,headers:{'If-None-Match':'*'},body:''}));
    await assert.rejects(request('DELETE',route,{...scoped,headers:{'If-Match':'"v1"'}}));
  }
  await assert.rejects(request('PUT','/remote.php/dav/files/alice/new.md',{...scoped,headers:{'If-None-Match':'*','If-Match':'"v1"'},body:''}));
  assert.equal(requests,beforeUnsafeWrites,'unsafe create/delete must not reach HTTP');
  const created='/remote.php/dav/files/alice/new.md';
  assert.equal((await request('PUT',created,{...scoped,headers:{'If-None-Match':'*'},body:'# new native'})).status,201);
  assert.equal((await request('PUT',created,{...scoped,headers:{'If-None-Match':'*'},body:'# must not overwrite'})).status,412);
  assert.equal(createdMarkdown,'# new native');
  assert.equal((await request('DELETE',created,{...scoped,headers:{'If-Match':'"stale"'}})).status,412);
  assert.equal((await request('DELETE',created,{...scoped,headers:{'If-Match':'"created-native"'}})).status,204);
  assert.equal((await request('GET',created,scoped)).status,404);
  // Exercise the second native policy with a separate namespace and fixed root.
  const davRoot=base+'/generic/selected/';
  const davId='webdav-'+createHash('sha256').update(randomUUID()).digest('hex');
  const davAccount={providerId:'webdav',id:davId,root:davRoot,username:'alice',loginName:'alice',appPassword:'synthetic-secret',label:'Isolated DAV'};
  const davMetadata=await peer.call('accountStore',davAccount);storedWebDAV=davId;
  assert.deepEqual(davMetadata,{providerId:'webdav',id:davId,root:davRoot,username:'alice',label:'Isolated DAV'});
  const all=await peer.call('accountList');
  assert.deepEqual(all.find(item=>item.id===id),metadata);
  assert.deepEqual(all.find(item=>item.id===davId),davMetadata);
  assert.equal(JSON.stringify(all).includes('synthetic-secret'),false);
  await peer.close();peer=await host();
  assert.deepEqual((await peer.call('accountList',{providerId:'webdav'})).find(item=>item.id===davId),davMetadata);
  const davScope={providerId:'webdav',root:davRoot,auth:{credentialId:davId}};
  const beforeMkdir=requests;
  for(const route of ['/generic/other/Folder/','/generic/selected/','/generic/selected/%252e%252e/','/generic/selected/NoSlash'])await assert.rejects(request('MKCOL',route,{...davScope,headers:{'If-None-Match':'*'}}));
  assert.equal(requests,beforeMkdir);
  assert.equal((await request('MKCOL','/generic/selected/Copy/',{...davScope,headers:{'If-None-Match':'*'}})).status,201);

  assert.equal((await request('GET','/generic/selected/notes.md',davScope)).body,content);
  for(const route of ['/generic/other/notes.md','/generic/selected-evil/notes.md','/generic/selected/../other/notes.md','/generic/selected/%2e%2e/other/notes.md','/generic/selected/a%2fb.md','/generic/selected/%252e%252e/notes.md','/generic/selected/a%00.md','/generic/selected/a.md?x=1','/generic/selected/plain.txt']){
    const before=requests;await assert.rejects(request('GET',route,davScope));assert.equal(requests,before,route);
  }
  for(const badRoot of ['http://untrusted.example/dav/','https://user:secret@cloud.example/dav/',davRoot+'../',davRoot+'a%2fb/',davRoot+'%252e%252e/',davRoot+'?secret=x'])await assert.rejects(peer.call('accountStore',{...davAccount,root:badRoot}));
  const beforeWrongIdentity=requests;
  await assert.rejects(request('GET','/generic/selected/notes.md',{...davScope,auth:{credentialId:id}}));
  await assert.rejects(request('GET','/remote.php/dav/files/alice/notes.md',{auth:{credentialId:davId}}));
  await assert.rejects(request('GET','/generic/other/notes.md',{...davScope,root:base+'/generic/other/'}));
  assert.equal(requests,beforeWrongIdentity,'stored authority cannot be widened by request metadata or provider changes');
  const sessionScope={providerId:'webdav',root:davRoot};
  assert.equal((await request('GET','/generic/selected/notes.md',sessionScope)).status,200);
  const beforeSessionEscape=requests;await assert.rejects(request('GET','/generic/other/notes.md',sessionScope));assert.equal(requests,beforeSessionEscape);
  assert.equal((await request('PUT','/generic/selected/new.md',{...davScope,headers:{'If-None-Match':'*'},body:'# WebDAV native'})).status,201);
  assert.equal((await request('PUT','/generic/selected/new.md',{...davScope,headers:{'If-None-Match':'*'},body:'# collision'})).status,412);
  assert.equal(createdMarkdown,'# WebDAV native');
  await assert.rejects(request('PUT','/generic/selected/new.md',{...davScope,body:'# no precondition'}));
  assert.equal((await request('DELETE','/generic/selected/new.md',{...davScope,headers:{'If-Match':'"created-native"'}})).status,204);
  await assert.rejects(peer.call('accountForget',{providerId:'webdav',id}));
  await assert.rejects(peer.call('accountForget',{id:davId}));
  assert.deepEqual((await peer.call('accountList')).find(item=>item.id===id),metadata);
  await peer.call('accountForget',{providerId:'webdav',id:davId});storedWebDAV=undefined;
  await assert.rejects(request('GET','/generic/selected/notes.md',davScope));
  await peer.call('accountForget',{id});stored=false;
  await assert.rejects(request('GET','/remote.php/dav/files/alice/notes.md',scoped));
  assert.equal((await peer.call('accountList')).some(item=>item.id===id),false);
  console.log('Extension IPC, bounded DAV, conditional saves, Unicode, redirects, credential restart/scoping/removal, IPC lifecycle and runtime-exit-with-live-socket regression passed.');
} finally {
  if(storedWebDAV)await peer.call('accountForget',{providerId:'webdav',id:storedWebDAV});
  if(stored)await peer.call('accountForget',{id});
  await peer.close();await new Promise(resolve=>dav.close(resolve));
}
