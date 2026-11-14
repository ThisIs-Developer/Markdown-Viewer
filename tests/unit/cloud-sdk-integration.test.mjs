import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
const sdk=fs.readFileSync(new URL('../../desktop-app/resources/js/neutralino.js',import.meta.url),'utf8');
const bridge=fs.readFileSync(new URL('../../cloud-platform.js',import.meta.url),'utf8');
const config=JSON.parse(fs.readFileSync(new URL('../../desktop-app/neutralino.config.json',import.meta.url),'utf8'));
const extension='com.markdownviewer.cloud';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function setup() {
  const allowed=new Set(config.nativeAllowList), calls=[], events=new EventTarget();
  const sockets=[];
  class Socket extends EventTarget {
    static OPEN=1;
    constructor(){super();this.readyState=1;sockets.push(this);queueMicrotask(()=>this.dispatchEvent(new Event('open')));}
    send(wire){
      const request=JSON.parse(wire);calls.push(request.method);
      queueMicrotask(()=>{
        const data=allowed.has(request.method)
          ? {success:true,returnValue:request.method==='extensions.getStats'?{loaded:[extension],connected:[extension]}:undefined}
          : {error:{code:'NE_RT_NATPRME',message:'Permission denied'}};
        this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({id:request.id,data})}));
        if(data.success && request.method==='extensions.dispatch') {
          this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({event:'cloudResponse',data:{id:request.data.data.id,returnValue:request.data.data.operation==='capabilities'?{version:5,providerIds:['nextcloud','webdav'],conditionalWrites:true,requestDeadlineMs:35000}:[]}})}));
        }
      });
    }
  }
  const context={WebSocket:Socket,crypto:webcrypto,TextEncoder,CustomEvent,Event,Uint8Array,
    setTimeout,clearTimeout,sessionStorage:{setItem(){},getItem(){return null;}},
    addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),dispatchEvent:events.dispatchEvent.bind(events),
    NL_OS:'Windows',NL_PORT:1,NL_TOKEN:'test.token',NL_ARGS:[],NL_EXTENABLED:true,location:{hostname:'127.0.0.1'}};
  context.window=context;vm.createContext(context);vm.runInContext(sdk,context);context.Neutralino.init();
  await tick();vm.runInContext(bridge,context);
  const adapter=context.MarkdownCloudPlatform.create();adapter.keepAlive(true);
  return {allowed,calls,adapter};
}
test('packaged permissions let the actual official SDK reach the cloud extension',async()=>{
  for(const method of ['extensions.getStats','extensions.dispatch','app.broadcast','app.getProcessId'])assert.ok(config.nativeAllowList.includes(method),method);
  const state=await setup();assert.equal(JSON.stringify(await state.adapter.listAccounts()),'[]');
  assert.ok(state.calls.includes('extensions.getStats'));assert.ok(state.calls.includes('extensions.dispatch'));
});
test('permission failure in the official SDK rejects before dispatch rather than waiting for timeout',async()=>{
  const state=await setup();state.allowed.delete('extensions.getStats');
  await assert.rejects(state.adapter.listAccounts(),/extension is unavailable/);
  assert.ok(!state.calls.includes('extensions.dispatch'));
});
