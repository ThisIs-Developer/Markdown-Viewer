import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { sharingRuntime } from '../helpers/encrypted-sharing-runtime.mjs';
const C = createRequire(import.meta.url)('../../sharing-crypto.js');
const origin = 'https://markdownviewer.pages.dev';
function next(socket, type = 'message') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.removeEventListener(type, handler); reject(new Error('Timed out waiting for ' + type)); }, 5000);
    const handler = event => { clearTimeout(timer); socket.removeEventListener(type, handler); resolve(type === 'message' ? JSON.parse(event.data) : event); };
    socket.addEventListener(type, handler);
  });
}

test('real Durable Object relays only signed encrypted frames and stores no content keys or raw capabilities', { timeout: 30000 }, async () => {
  const runtime = await sharingRuntime();
  const sockets = [];
  try {
    const roomId = 'room2_' + C.random(18), keys = await C.createRoom(roomId);
    const caps = { host: C.random(), edit: C.random(), view: C.random() };
    async function join(role) {
      const sender = 'participant-' + C.random(12);
      const crypto = await C.liveSession({ roomId, config: keys.config, key: keys.key, role, sender, signingKey: keys.signing[role] });
      const response = await runtime.dispatchFetch(origin + '/live-room/' + roomId + '?v=2', { headers: { Origin: origin, Upgrade: 'websocket' } });
      assert.equal(response.status, 101);
      const socket = response.webSocket; sockets.push(socket); socket.accept();
      const ready = next(socket);
      socket.send(JSON.stringify({ type: 'authenticate', v: 2, role, sender, session: crypto.session, config: keys.config,
        capability: caps[role], ...(role === 'host' ? { capabilities: caps } : {}) }));
      assert.deepEqual(await ready, { type: 'ready', v: 2 });
      return { socket, crypto };
    }
    const host = await join('host'), editor = await join('edit'), viewer = await join('view');
    const pending = next(viewer.socket), update = await editor.crypto.encrypt({ type: 'y-update', update: 'SECRET DOCUMENT' });
    editor.socket.send(JSON.stringify(update));
    const wire = await pending;
    assert.deepEqual(wire, update);
    assert.equal(JSON.stringify(wire).includes('SECRET DOCUMENT'), false);
    assert.equal((await viewer.crypto.decrypt(wire)).update, 'SECRET DOCUMENT');
    const ns = await runtime.getDurableObjectNamespace('LIVE_ROOMS');
    const stub = ns.get(ns.idFromName('encrypted-v2:' + roomId));
    const auth = await (await stub.fetch('https://local/__test/inspect')).json();
    for (const secret of [keys.key, ...Object.values(keys.signing), ...Object.values(caps), 'SECRET DOCUMENT']) {
      assert.equal(JSON.stringify(auth).includes(secret), false);
    }
    assert.equal(auth.expiresAt, keys.config.expiresAt);
    assert.equal(await (await stub.fetch('https://local/__test/alarm')).json(), keys.config.expiresAt);

    const denied = next(viewer.socket, 'close');
    // A legitimate editor frame cannot be replayed through a viewer connection.
    viewer.socket.send(JSON.stringify(update));
    assert.equal((await denied).code, 1008);

    const ended = next(editor.socket);
    host.socket.send(JSON.stringify(await host.crypto.encrypt({ type: 'session-end' })));
    assert.equal((await editor.crypto.decrypt(await ended)).type, 'session-end');
    const persisted = await (await stub.fetch('https://local/__test/inspect')).json();
    assert.equal(persisted.ended, true);
    const reconnect = await runtime.dispatchFetch(origin + '/live-room/' + roomId + '?v=2', { headers: { Origin: origin, Upgrade: 'websocket' } });
    const rejected = reconnect.webSocket; sockets.push(rejected); rejected.accept();
    const closed = next(rejected, 'close');
    rejected.send(JSON.stringify({ type: 'authenticate', v: 2, role: 'view', sender: 'participant-' + C.random(12),
      session: C.random(16), config: keys.config, capability: caps.view }));
    assert.equal((await closed).code, 1008);
    await stub.fetch('https://local/__test/expire', { method: 'POST' });
    assert.equal(await (await stub.fetch('https://local/__test/inspect')).json(), null);
  } finally {
    for (const socket of sockets) try { socket.close(); } catch (_) {}
    await runtime.dispose();
  }
});

test('real relay rejects plaintext v2 messages and preserves an existing legacy room', { timeout: 30000 }, async () => {
  const runtime = await sharingRuntime(), sockets = [];
  try {
    const roomId = 'room2_' + C.random(18);
    for (const query of ['?v=3', '?v=2&key=must-not-be-in-url']) {
      const invalid = await runtime.dispatchFetch(origin + '/live-room/' + roomId + query, { headers: { Origin: origin, Upgrade: 'websocket' } });
      assert.equal(invalid.status, 400);
    }
    const response = await runtime.dispatchFetch(origin + '/live-room/' + roomId + '?v=2', { headers: { Origin: origin, Upgrade: 'websocket' } });
    const socket = response.webSocket; sockets.push(socket); socket.accept();
    const denied = next(socket, 'close');
    socket.send(JSON.stringify({ type: 'y-update', update: 'plaintext' }));
    assert.equal((await denied).code, 1008);
    const caps = { hostCap: C.random(), editCap: C.random(), viewCap: C.random() }, legacyRoom = 'legacy-' + C.random(9), secret = C.random();
    const ns = await runtime.getDurableObjectNamespace('LIVE_ROOMS');
    const stub = ns.get(ns.idFromName(legacyRoom + ':' + secret));
    await stub.fetch('https://local/__test/legacy', { method: 'POST', body: JSON.stringify(caps) });
    const legacy = await runtime.dispatchFetch(origin + '/live-room/' + legacyRoom + '?secret=' + secret + '&role=view&cap=' + caps.viewCap,
      { headers: { Origin: origin, Upgrade: 'websocket' } });
    assert.equal(legacy.status, 101); sockets.push(legacy.webSocket); legacy.webSocket.accept();
  } finally { for (const socket of sockets) try { socket.close(); } catch (_) {} await runtime.dispose(); }
});
