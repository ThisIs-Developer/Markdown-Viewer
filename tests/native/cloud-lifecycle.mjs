// Actual framework + actual SDK + actual extension, with an isolated headless
// profile. Never creates a desktop window or connects to a personal server.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import {createServer} from 'node:http';
import { nativeFilesystemSession } from '../helpers/native-filesystem-session.mjs';
const root=process.cwd(), extension='com.markdownviewer.cloud';
const binary=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'desktop-app/bin/neutralino-win_x64.exe');
const methods=['extensions.getStats','extensions.dispatch','app.broadcast','app.getProcessId','os.spawnProcess','os.updateSpawnedProcess','os.getSpawnedProcesses'];
const session=await nativeFilesystemSession(binary,methods,{profileName:'profile Ελληνικά & %literal%',extensions:[{id:extension}],commandAllowList:['extensions/cloud/markdown-cloud.exe']});
await fs.mkdir(path.join(session.root,'extensions/cloud'),{recursive:true});
await fs.copyFile(path.join(root,'desktop-app/cloud-extension/build/markdown-cloud.exe'),path.join(session.root,'extensions/cloud/markdown-cloud.exe'));
const server=createServer((_req,res)=>{res.writeHead(200,{ETag:'"test"'});res.end('# isolated test');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const events=new EventTarget();
const context={document:{body:{replaceChildren(){},appendChild(){}},createElement(){return{innerHTML:''};}},WebSocket,crypto:webcrypto,TextEncoder,CustomEvent,Event,Uint8Array,setTimeout,clearTimeout,
  sessionStorage:{setItem(){},getItem(){return null;}},
  addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),dispatchEvent:events.dispatchEvent.bind(events),
  NL_OS:'Windows',NL_PORT:session.auth.nlPort,NL_PATH:session.root,NL_TOKEN:session.auth.nlToken,NL_ARGS:[],NL_EXTENABLED:true,location:{hostname:'127.0.0.1'}};
context.window=context;vm.createContext(context);
vm.runInContext(await fs.readFile(path.join(root,'desktop-app/resources/js/neutralino.js'),'utf8'),context);
context.Neutralino.init();
vm.runInContext(await fs.readFile(path.join(root,'cloud-platform.js'),'utf8'),context);
const adapter=context.MarkdownCloudPlatform.create();adapter.keepAlive(true);
let disconnects=0;await context.Neutralino.events.on('extClientDisconnect',event=>{if(event.detail===extension || event.detail?.extensionId===extension)disconnects++;});
const stats=()=>session.call('extensions.getStats',{});
async function until(predicate){const end=Date.now()+5000;while(Date.now()<end){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Lifecycle state timeout');}
try{
 assert.equal((await stats()).connected.length,0,'declared helper must not auto-start');
 assert.equal((await session.call('os.getSpawnedProcesses',{})).length,0);
 const request={url:'http://127.0.0.1:'+server.address().port+'/',method:'GET',maxBytes:1024};
 const replies=await Promise.all([adapter.request(request),adapter.request(request)]);
 assert.equal(replies[0].body,'# isolated test');assert.equal(replies[1].body,'# isolated test');
 assert.deepEqual((await stats()).connected,[extension]);
 assert.equal((await session.call('os.getSpawnedProcesses',{})).length,1,'concurrent starts must share one helper');
 const beforeStop=disconnects;await adapter.stop();await until(async()=>!(await stats()).connected.length && disconnects>beforeStop);
 assert.equal((await adapter.request(request)).status,200,'explicit request restarts stopped helper');
 const beforeCrash=disconnects;
 await context.Neutralino.extensions.dispatch(extension,'cloudRequest',{}); // controlled crash of this isolated helper
 await until(async()=>!(await stats()).connected.length && disconnects>beforeCrash);
 assert.equal((await adapter.request(request)).status,200,'new reads recover after helper crash without replaying old calls');
 await adapter.stop();
 await assert.rejects(session.call('os.spawnProcess',{command:'cmd.exe /c echo forbidden'}));
 console.log('Actual runtime + SDK + extension: zero automatic launch, one concurrent start, stdin bootstrap, safe stop, crash restart and command allowlist passed.');
}finally{
 await session.close();await new Promise(resolve=>server.close(resolve));
 // SDK WebSocket remains held by the VM; allow normal disconnect delivery.
 setTimeout(()=>process.exit(0),100).unref();
}
