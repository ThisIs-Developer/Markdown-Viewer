import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { LiveRoom } from '../../workers/live-room-worker.js';
const C = createRequire(import.meta.url)('../../sharing-crypto.js');

test('compact inline snapshots keep the same authenticated envelope and reduce URL size without storage', async () => {
  const payload = { content:'# Private हिन्दी 😀\n'.repeat(30), title:'Private', mode:'view' }, key=C.random();
  const sealed=await C.seal(payload,key,'snapshot');
  const compact=C.compactSnapshot(sealed,key), parsed=C.parseCompactSnapshot(compact);
  assert.deepEqual(await C.open(parsed.encrypted,parsed.key,'snapshot'),payload);
  assert.ok(compact.length < ('#share=v2.'+C.pack(sealed)+'&key='+key).length*.8);
  await assert.rejects(C.open(parsed.encrypted,C.random(),'snapshot'));
  await assert.rejects(C.open({...parsed.encrypted,ct:C.random(100)},key,'snapshot'));
  assert.throws(()=>C.parseCompactSnapshot(compact+'!'));
});

test('short live links isolate roles, bind room identity, and reject tampering and expiry', async () => {
  const roomId='room2_'+C.random(18), room=await C.createRoom(roomId);
  const caps={host:C.random(),edit:C.random(),view:C.random()};
  const {invites,inviteKeys}=await C.createInvites(room,caps);
  const hash='#l='+roomId.slice(6)+'.v'+inviteKeys.view;
  assert.equal(('https://markdownviewer.pages.dev/'+hash).length,105);
  const link=C.parseShortLive(hash), opened=await C.openInvite(invites.view,link);
  assert.equal(opened.encryption.key,room.key);
  assert.equal(opened.capability,caps.view);
  await C.liveSession({...opened,...opened.encryption,sender:'participant-'+C.random(12)});
  await assert.rejects(C.openInvite(invites.edit,link));
  await assert.rejects(C.openInvite(invites.view,{...link,roomId:'room2_'+C.random(18)}));
  await assert.rejects(C.openInvite(invites.view,{...link,inviteKey:C.random()}));
  room.config.expiresAt=Date.now()-1;
  const expired=await C.createInvites(room,caps);
  await assert.rejects(C.openInvite(expired.invites.view,{...link,inviteKey:expired.inviteKeys.view}),/expired/);
  for(const secret of [room.key,...Object.values(room.signing),...Object.values(caps),...Object.values(inviteKeys)]) assert.ok(!JSON.stringify(invites).includes(secret));
});

test('relay stores immutable encrypted invites with the existing admission write and enforces lifecycle', async () => {
  const roomId='room2_'+C.random(18), room=await C.createRoom(roomId), caps={host:C.random(),edit:C.random(),view:C.random()};
  const {invites}=await C.createInvites(room,caps);
  let stored, writes=0, reads=0;
  const storage={get:async()=>{reads++;return stored&&structuredClone(stored);},put:async(_key,value)=>{writes++;stored=structuredClone(value);},setAlarm:async()=>{}};
  storage.transaction=async fn=>fn(storage);
  const relay=new LiveRoom({storage},{});
  const auth={type:'authenticate',v:2,freshness:1,role:'host',sender:'participant-'+C.random(12),session:C.random(16),config:room.config,capability:caps.host,capabilities:caps,invites};
  assert.ok(await relay.authenticateEncrypted(auth,roomId));
  assert.equal(writes,1); assert.deepEqual(stored.invites,invites);
  const request=new Request('https://local/live-room/'+roomId+'?v=2&invite=view');
  reads=0;
  const response=await relay.fetch(request);
  assert.deepEqual(await response.json(),{encrypted:invites.view}); assert.equal(reads,1);assert.equal(writes,1);
  assert.equal(response.headers.get('cache-control'),'no-store');
  const replacement=await C.createInvites(room,caps);
  assert.ok(await relay.authenticateEncrypted({...auth,session:C.random(16),invites:replacement.invites},roomId));
  assert.deepEqual(stored.invites,invites);
  assert.equal(await relay.authenticateEncrypted({...auth,role:'view',capability:caps.view},roomId),null);
  stored.ended=true;assert.equal((await relay.fetch(request)).status,404);
  stored.ended=false;stored.expiresAt=Date.now()-1;assert.equal((await relay.fetch(request)).status,404);
  stored=undefined;assert.equal((await relay.fetch(request)).status,404);assert.equal(writes,2);
});

test('private export retains its rendering policy while asynchronous media resolution changes tabs', async () => {
  const source=readFileSync('script.js','utf8'), start=source.indexOf('  async function renderExportRichContent('), end=source.indexOf('\n  async function createExportRenderElement',start);
  const calls=[];
  const realm={MarkdownShareMedia:{resolve:async()=>calls.push('media')},getShareApiBaseUrl:()=>'',
    isEncryptedSharingActive:()=>false,waitForExportWork:async(_state,work)=>work,
    renderPrivateRichContent:async()=>calls.push('private'),waitForAllImages:async()=>{},getExportTheme:()=>{throw Error('Private content reached ordinary renderers');}};
  runInNewContext(source.slice(start,end),realm);
  await realm.renderExportRichContent({},'private','light',null,true);
  assert.deepEqual(calls,['media','private']);
});
