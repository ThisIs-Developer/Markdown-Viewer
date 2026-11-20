import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { onRequest } from '../../functions/live-room/[[room]].js';
import { LiveRoom } from '../../workers/live-room-worker.js';

test('relay protocol health probes the bound Worker without accessing room storage', async () => {
  const state = { storage: new Proxy({}, { get() { throw Error('Health must not access storage'); } }) };
  const room = new LiveRoom(state, {});
  const env = { LIVE_ROOMS: { idFromName(name) { assert.equal(name, 'protocol-health'); return name; },
    get() { return { fetch: request => room.fetch(request) }; } } };
  const result = await onRequest({ env, request: new Request('https://markdownviewer.pages.dev/live-room/__protocol'), params: { room: ['__protocol'] } });
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { protocol: 2, freshness: 1, invitations: 1 });
  assert.equal(result.headers.get('cache-control'), 'no-store');
});

test('Pages reports missing and stale relay deployments as unavailable', async () => {
  const request = new Request('https://markdownviewer.pages.dev/live-room/__protocol');
  for (const env of [{}, { LIVE_ROOMS: { idFromName: name => name, get: () => ({ fetch: async () => new Response('Markdown Viewer live room Durable Object') }) } }]) {
    const result = await onRequest({ env, request, params: { room: ['__protocol'] } });
    assert.equal(result.status, 503);
  }
});

test('Pages forwards only bounded invitation GETs and never forwards fragment keys', async () => {
  const room = 'room2_' + 'a'.repeat(24);
  let forwarded = 0;
  const env = { LIVE_ROOMS: { idFromName: name => { assert.equal(name,'encrypted-v2:'+room); return name; },
    get: () => ({ fetch: async request => { forwarded++; assert.equal(new URL(request.url).hash,''); return Response.json({encrypted:{}}); } }) } };
  const params = { room:[room] };
  const url = 'https://markdownviewer.pages.dev/live-room/'+room+'?v=2&invite=view';
  assert.equal((await onRequest({env,params,request:new Request(url)})).status,200);
  assert.equal((await onRequest({env,params,request:new Request(url+'&key=must-not-be-sent')})).status,400);
  assert.equal((await onRequest({env,params,request:new Request(url,{headers:{Upgrade:'websocket',Origin:'https://markdownviewer.pages.dev'}})})).status,400);
  assert.equal(forwarded,1);
});

test('client relay diagnostics strip room credentials and detect outdated deployments', async () => {
  let response = new Response(JSON.stringify({ protocol: 2, freshness: 1, invitations: 1 }));
  const context = { URL, AbortSignal, fetch: async (url, options) => {
    assert.equal(url.href, 'https://example.test/live-room/__protocol');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.cache, 'no-store');
    return response;
  } };
  runInNewContext(readFileSync('sharing-live.js','utf8'), context);
  await context.MarkdownShareLive.checkRelay('wss://example.test/live-room/room2_test?v=2#private-key');
  response = new Response('Old relay');
  await assert.rejects(context.MarkdownShareLive.checkRelay('wss://example.test/live-room/room2_test?secret=private#key'), /relay update/);
});

test('view-only encrypted updates require the authenticated host role', () => {
  const source = readFileSync('script.js','utf8');
  const start = source.indexOf('  function handleLiveRoomMessage(');
  const end = source.indexOf('\n  function ',start+1);
  const applied = [];
  const context = { liveCollaboration: { roomId: 'test', localParticipantId: 'local', encryption: {},
    sessionMap: new Map([['hostId','host-id']]), Y: { applyUpdate: (...args) => applied.push(args) }, ydoc: {} },
    getCurrentLiveAccessMode: () => 'view', LIVE_SHARE_ACCESS_VIEW: 'view', LIVE_RELAY_ORIGIN: 'relay',
    decodeLiveBytes: value => value, markLiveJoinSynced: () => {} };
  runInNewContext(source.slice(start,end), context);
  const message = { roomId: 'test', sender: 'host-id', type: 'y-update', update: [1], role: 'edit' };
  context.handleLiveRoomMessage(message, {});
  assert.equal(applied.length, 0);
  context.handleLiveRoomMessage({ ...message, role: 'host' }, {});
  assert.equal(applied.length, 1);
});

test('a failed socket checks relay compatibility only once for error and close events', async () => {
  let socket, checks = 0;
  class Socket extends EventTarget {
    constructor() { super(); socket = this; }
    close() {}
  }
  const realm = { URL, AbortSignal, WebSocket: Socket, setTimeout, clearTimeout,
    fetch: async () => { checks++; return new Response('Old relay'); },
    MarkdownShareCrypto: { random: () => 'test' } };
  runInNewContext(readFileSync('sharing-live.js','utf8'),realm);
  const doc = { on() {}, off() {} };
  const connection = realm.MarkdownShareLive.connect({ socketUrl: 'wss://example.test/live-room/test',
    encryption: { transport: {} }, ydoc: doc, reviewDoc: doc, controlDoc: doc, onStatus() {} });
  socket.dispatchEvent(new Event('error'));
  socket.dispatchEvent(new Event('close'));
  await assert.rejects(connection.ready, /relay update/);
  assert.equal(checks, 1);
  connection.destroy();
});
