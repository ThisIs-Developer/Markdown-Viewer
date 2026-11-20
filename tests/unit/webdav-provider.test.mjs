import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
function setup(){
 const scope={URL,TextEncoder,crypto:webcrypto,console};vm.createContext(scope);
 for(const name of ['cloud-model','cloud-providers','webdav-source','nextcloud-source','nextcloud-provider','webdav-provider'])vm.runInContext(fs.readFileSync(new URL('../../'+name+'.js',import.meta.url),'utf8'),scope);
 return scope;
}
const root='https://dav.example/custom/Selected%20folder/';
test('WebDAV identities are rooted in provider, canonical folder and username without colliding with Nextcloud',async()=>{
 const scope=setup(),provider=scope.MarkdownCloudProviders.get('webdav');
 scope.MarkdownWebDAV.Client.prototype.identify=async function(){return this;};
 const connect=values=>provider.connect({root,username:'alice',password:'password',...values},{},null);
 const a=await connect({}),same=await connect({root:root.slice(0,-1)}),folder=await connect({root:root+'nested/'}),user=await connect({username:'bob'});
 assert.match(await a.accountId(),/^webdav-[a-f0-9]{64}$/);assert.equal(await a.accountId(),await same.accountId());
 assert.notEqual(await a.accountId(),await folder.accountId());assert.notEqual(await a.accountId(),await user.accountId());
 const source=a.source(root+'a.md','"v1"',{status:'draft',attemptDigest:'keep'});
 assert.equal(source.accountKey,a.account.key);assert.equal(source.attemptDigest,'keep');assert.equal(source.version,'"v1"');
 assert.equal(JSON.stringify(source).includes('password'),false);
 const policy=provider.recoveryIdentity(source);assert.match(policy.accountName,/WebDAV/);assert.equal(policy.accountIdentity,a.account.key);
});

test('WebDAV raw/session access rejects root escapes and encoded traversal before forwarding credentials',async()=>{
 const scope=setup(),protocol=scope.MarkdownWebDAV,requests=[];
 const client=new protocol.Client(root,async value=>{requests.push(value);return {status:200,body:'# read',headers:{ETag:'"v1"'}};},{username:'alice',password:'secret'});
 for(const value of [root+'../other/a.md',root+'%2e%2e/other.md',root+'%252e%252e/a.md',root+'x%2Fy.md',root+'a.md?token=x','https://dav.example/custom/Selected%20folder-evil/a.md','https://other.example/a.md',root+'%00.md'])await assert.rejects(client.read(value));
 assert.equal(requests.length,0);
 assert.equal(protocol.documentUrl('child.md',root,root+'nested/'),root+'nested/child.md');
 assert.equal(protocol.documentUrl('a.md',root,root+'a.md'),root+'a.md');
 await client.read(root+'a.md');assert.equal(requests[0].auth.username,'alice');
});

test('WebDAV rejects unsafe connection roots and credentials before any discovery request',async()=>{
 const scope=setup(),provider=scope.MarkdownCloudProviders.get('webdav');let requests=0;
 const platform={request:async()=>{requests++;throw Error('unexpected');}};
 for(const value of ['http://remote.example/dav/','https://user:secret@dav.example/root/',root+'../',root+'a%2fb/',root+'?x=secret','file:///local/'])await assert.rejects(provider.connect({root:value,username:'alice',password:'pw'},platform));
 for(const username of ['','a:b','a\n'])await assert.rejects(provider.connect({root,username,password:'pw'},platform));
 await assert.rejects(provider.connect({root,username:'alice',password:'pw\r\n'},platform));
 assert.equal(requests,0);
});

test('WebDAV secure remember keeps an opaque handle, verifies identity, and restores only the matching policy',async()=>{
 const scope=setup(),provider=scope.MarkdownCloudProviders.get('webdav'),requests=[];
 scope.MarkdownWebDAV.Client.prototype.identify=async function(){await this.call(this.root,'PROPFIND',{maxBytes:100});return this;};
 const platform={request:async value=>{requests.push(value);return {status:207};}};
 const client=await provider.connect({root,username:'alice',password:'ephemeral-secret',label:'NAS'},platform);
 let record;
 await client.remember(async value=>{record=value;const {loginName,appPassword,...metadata}=value;return metadata;});
 assert.equal(record.providerId,'webdav');assert.equal(record.root,root);assert.equal(record.appPassword,'ephemeral-secret');
 requests.length=0;await client.identify();assert.equal(requests[0].providerId,'webdav');assert.equal(requests[0].root,root);
 assert.equal(requests[0].auth.credentialId,record.id);assert.equal(requests[0].auth.password,undefined);
 const metadata={providerId:'webdav',id:record.id,root,username:'alice',label:'NAS'};
 const restored=await provider.restore(metadata,platform);assert.equal(await restored.accountId(),record.id);
 for(const bad of [{...metadata,id:'forged'},{...metadata,root:root+'other/'},{...metadata,username:'bob'},{...metadata,providerId:'nextcloud'}])await assert.rejects(provider.restore(bad,platform));
 assert.equal(scope.MarkdownCloudProviders.accountProvider({id:'legacy',server:'https://nextcloud.example',userId:'alice'}).id,'nextcloud');
});

test('WebDAV version checks never turn weak validators into write authority',async()=>{
 const scope=setup(),provider=scope.MarkdownCloudProviders.get('webdav');scope.MarkdownWebDAV.Client.prototype.identify=async function(){return this;};
 const client=await provider.connect({root,username:'alice',password:'pw'},{});
 for(const version of ['', 'W/"weak"','*'])assert.match(client.readOnlyReason(client.source(root+'a.md',version)),/read-only/);
 assert.equal(client.readOnlyReason(client.source(root+'a.md','"strong"')),'');
 await assert.rejects(client.save(root+'a.md','W/"weak"','# draft'),error=>error.code==='ETAG');
});

test('a cancelled WebDAV probe cannot return a credential-bearing client after late authentication',async()=>{
 const scope=setup(),provider=scope.MarkdownCloudProviders.get('webdav');let complete,raw;
 scope.MarkdownWebDAV.Client.prototype.identify=function(){raw=this;return new Promise(resolve=>complete=()=>resolve(this));};
 const controller=new AbortController();const request=provider.connect({root,username:'alice',password:'cancelled-secret'},{request:async value=>{assert.equal(value.auth,undefined);return {status:200,body:'local',headers:{ETag:'"v1"'}};}},null,controller.signal);
 controller.abort();complete();await assert.rejects(request,/cancelled/);await raw.read(root+'a.md');
});
