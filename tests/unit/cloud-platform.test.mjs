import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
const source=fs.readFileSync(new URL('../../cloud-platform.js',import.meta.url),'utf8');
function setup() {
  const listeners=new Map(), calls=[], timers=new Map();let sequence=0;
  const native={
    events:{on:async(name,handler)=>listeners.set(name,handler)},
    extensions:{getStats:async()=>({loaded:['com.markdownviewer.cloud'],connected:['com.markdownviewer.cloud']}),dispatch:async(extension,event,call)=>{if(call.operation==='capabilities')listeners.get('cloudResponse')({detail:{id:call.id,returnValue:{version:5,providerIds:['nextcloud','webdav'],conditionalWrites:true,requestDeadlineMs:35000}}});else calls.push({extension,event,call});}},
    net:{request(){throw Error('No runtime cloud API allowed');}},
    custom:new Proxy({}, {get(){throw Error('No runtime custom API allowed');}})
  };
  const context={NL_OS:'Windows',Neutralino:native,crypto:{randomUUID},TextEncoder,
    setTimeout:handler=>{const id=++sequence;timers.set(id,handler);return id;},clearTimeout:id=>timers.delete(id)};
  vm.createContext(context);vm.runInContext(source,context);
  const adapter=context.MarkdownCloudPlatform.create();
  adapter.keepAlive(true);
  return {context,adapter,calls,timers,native,
    reply:(id,returnValue,error)=>listeners.get('cloudResponse')({detail:{id,returnValue,error}}),
    disconnect:()=>listeners.get('extClientDisconnect')({detail:'com.markdownviewer.cloud'})};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('extension adapter correlates overlapping replies without custom runtime APIs',async()=>{
  const state=setup();const a=state.adapter.listAccounts(), b=state.adapter.forgetAccount({id:'account'});
  await tick();assert.equal(state.calls.length,2);
  for(const {extension,event} of state.calls){assert.equal(extension,'com.markdownviewer.cloud');assert.equal(event,'cloudRequest');}
  state.reply('unknown', 'ignored');
  state.reply(state.calls[1].call.id,true);state.reply(state.calls[0].call.id,[]);
  assert.equal(await b,true);assert.deepEqual(await a,[]);assert.equal(state.timers.size,0);
});
test('extension timeout rejects the operation and ignores a late completion',async()=>{
  const state=setup();const promise=state.adapter.listAccounts();const rejected=assert.rejects(promise,/timed out/);
  await tick();[...state.timers.values()][0]();await rejected;
  state.reply(state.calls[0].call.id,[]);
});
test('extension disconnect rejects pending work and leaves no timers',async()=>{
  const state=setup();const promise=state.adapter.listAccounts();const rejected=assert.rejects(promise,/draft was kept/);
  await tick();state.disconnect();await rejected;assert.equal(state.timers.size,0);
});
test('extension errors propagate without falling back to raw credentials or network',async()=>{
  const state=setup();const promise=state.adapter.listAccounts();const rejected=assert.rejects(promise,{code:'NEXTCLOUD_CREDENTIALS'});
  await tick();state.reply(state.calls[0].call.id,undefined,{code:'NEXTCLOUD_CREDENTIALS',message:'Reconnect'});await rejected;
});
test('extension response validation checks byte size and transport version',async()=>{
  for(const reply of [{transportVersion:1,body:'éé'},{transportVersion:0,body:'x'}]){
    const state=setup();const promise=state.adapter.request({maxBytes:3});const rejected=assert.rejects(promise,{code:'SIZE'});
    await tick();state.reply(state.calls[0].call.id,reply);await rejected;
  }
});
test('extension transport availability is independent of native net and custom APIs',()=>{
  const {context,native}=setup();delete native.net;delete native.custom;
  assert.equal(context.MarkdownCloudPlatform.available(),true);
  delete native.extensions;assert.equal(context.MarkdownCloudPlatform.available(),false);
});

test('timed-out native operation blocks reconciliation until its completion is observed',async()=>{
  const state=setup();const request=state.adapter.listAccounts();const rejected=assert.rejects(request,/timed out/);
  await tick();[...state.timers.values()][0]();await rejected;
  await assert.rejects(state.adapter.listAccounts(),/still settling/);
  state.reply(state.calls[0].call.id,[]);
  const next=state.adapter.listAccounts();await tick();state.reply(state.calls[1].call.id,[]);assert.deepEqual(await next,[]);
});
test('creating a platform adapter does not dispatch work or start a process',async()=>{
  const state=setup();await tick();assert.equal(state.calls.length,0);assert.equal(state.timers.size,0);
});

test('disabled platform cannot start or dispatch a helper operation',async()=>{
  const state=setup();state.adapter.setEnabled(false);
  await assert.rejects(state.adapter.listAccounts(),/disabled/);
  assert.equal(state.calls.length,0);
});

test('a helper lost during capability handshake never receives the requested operation',async()=>{
  const state=setup();
  state.native.extensions.dispatch=async(_extension,_event,call)=>{
    if(call.operation==='capabilities') {
      state.reply(call.id,{version:5,providerIds:['nextcloud','webdav'],conditionalWrites:true,requestDeadlineMs:35000});state.disconnect();
    } else throw Error('operation must not be dispatched after disconnect');
  };
  await assert.rejects(state.adapter.listAccounts(),/stopped while connecting/);
  assert.equal(state.calls.length,0);
});

test('old or incomplete helper capabilities cannot receive account or network operations',async()=>{
 for(const capabilities of [{version:3,conditionalWrites:true,requestDeadlineMs:35000},{version:5,providerIds:['nextcloud'],conditionalWrites:true,requestDeadlineMs:35000}]){
  const state=setup();state.native.extensions.dispatch=async(_extension,_event,call)=>{assert.equal(call.operation,'capabilities');state.reply(call.id,capabilities);};
  await assert.rejects(state.adapter.listAccounts(),/outdated/);assert.equal(state.calls.length,0);
 }
});
