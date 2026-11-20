import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../cloud-workspace.js',import.meta.url),'utf8');
const start=source.indexOf('  async function activateAccount('),end=source.indexOf('\n  async function pinFolder(',start);
assert.ok(start>=0 && end>start);
const implementation=source.slice(start,end);
function setup(){
 const state={pendingLogin:false,saves:new Set(),connectionEpoch:0,workspace:{enabled:true},sessions:new Map(),activeClient:undefined,
   accountState:()=>({}),resetBrowser(){},tools(){},renderAccounts(){},platform:{keepAlive(){}},
   sessionKey:profile=>profile.id,MarkdownNextcloud:{documentUrl:href=>href},browsed:[],messages:[]};
 state.browse=async(href,client)=>state.browsed.push({href,client});state.message=text=>state.messages.push(text);
 vm.createContext(state);vm.runInContext(implementation,state);
 function profile(id){let resolve,reject;const pending=new Promise((yes,no)=>{resolve=yes;reject=no;});return{id,userId:id,client:{validateRef:href=>href,account:{userLabel:id},userId:id,root:'https://test/'+id+'/',identify:()=>pending},resolve,reject};}
 return{state,profile};
}
test('a late reconnect cannot publish a session or browse through a newly selected account',async()=>{
 const {state,profile}=setup(),a=profile('alice'),b=profile('bob');
 const first=state.activateAccount(a),second=state.activateAccount(b);
 assert.equal(state.sessions.size,0,'unverified sessions must not be published');
 b.resolve();await second;a.resolve();await first;
 assert.equal(state.activeClient,b.client);assert.equal(state.sessions.has('alice'),false);assert.equal(state.sessions.get('bob'),b.client);
 assert.equal(state.browsed.length,1);assert.equal(state.browsed[0].client,b.client);
});
test('disabling cloud during identify prevents late session activation',async()=>{
 const {state,profile}=setup(),a=profile('alice');const pending=state.activateAccount(a);
 state.workspace.enabled=false;state.connectionEpoch++;a.resolve();await pending;
 assert.equal(state.sessions.size,0);assert.equal(state.browsed.length,0);
});
