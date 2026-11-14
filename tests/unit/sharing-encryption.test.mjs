import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const C = require('../../sharing-crypto.js');
const M = require('../../sharing-media.js');

test('offline asset caching never intercepts share/media APIs, live rooms, or mutations', () => {
  const listeners = new Map();
  runInNewContext(readFileSync('sw.js', 'utf8'), {
    URL, self: { location: { origin: 'https://markdownviewer.pages.dev' }, addEventListener: (type, handler) => listeners.set(type, handler) },
    caches: { open() { assert.fail('Sharing requests must not open an offline cache'); } }
  });
  for (const [path, method] of [['/api/share/s2_test', 'GET'], ['/api/image/e2_test', 'GET'], ['/api/media/e2_test', 'HEAD'],
    ['/live-room/room2_test?v=2', 'GET'], ['/api/share', 'POST'], ['/api/share/s2_test', 'DELETE']]) {
    listeners.get('fetch')({ request: { url: 'https://markdownviewer.pages.dev' + path, method },
      respondWith() { assert.fail('Sharing requests must use the network and its retention policy'); } });
  }
});

async function api(path) {
  const result = await build({ entryPoints: [path], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
  return (await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'))).onRequest;
}
const snapshotApi = await api('functions/api/share/[[id]].js');
const mediaApi = await api('functions/api/image/[[id]].js');
function kv() {
  const values = new Map(), writes = [];
  return { values, writes, async get(id) { return values.get(id) || null; },
    async put(id, value, options) { writes.push({ id, value, options }); values.set(id, value); },
    async delete(id) { values.delete(id); } };
}
function request(method, body, id = '', kind = 'share') {
  return new Request('https://markdownviewer.pages.dev/api/' + kind + (id ? '/' + id : ''), {
    method, headers: { Origin: 'https://markdownviewer.pages.dev', 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}
const call = (handler, store, method, body, id = '') => handler({ request: request(method, body, id), env: { SHARE_KV: store }, params: { id } });

test('snapshots encrypt all fields with fresh IVs and preserve Unicode', async () => {
  const value = { content: '# private\nहिन्दी 😀', title: 'secret title', mode: 'edit' }, key = C.random();
  const first = await C.seal(value, key, 'snapshot'), second = await C.seal(value, key, 'snapshot');
  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.ct, second.ct);
  assert.deepEqual(await C.open(first, key, 'snapshot'), value);
  assert.equal(JSON.stringify(first).includes('secret'), false);
  assert.equal(Buffer.from(C.decode(first.ct, 1000)).includes(Buffer.from(value.content)), false);
  assert.deepEqual(C.unpack(C.pack(first)), first);
});

test('snapshot authentication rejects wrong keys, contexts, tags, IVs and unsupported versions', async () => {
  const key = C.random(), encrypted = await C.seal({ content: 'sensitive' }, key, 'snapshot');
  await assert.rejects(C.open(encrypted, C.random(), 'snapshot'));
  await assert.rejects(C.open(encrypted, key, 'media'));
  await assert.rejects(C.open(encrypted, '', 'snapshot'));
  for (const field of ['iv', 'ct']) {
    const bytes = C.decode(encrypted[field], 1000); bytes[0] ^= 1;
    await assert.rejects(C.open({ ...encrypted, [field]: C.encode(bytes) }, key, 'snapshot'));
  }
  await assert.rejects(C.open({ ...encrypted, v: 3 }, key, 'snapshot'));
  await assert.rejects(C.open({ ...encrypted, key }, key, 'snapshot'));
  await assert.rejects(C.seal('too large', key, 'snapshot', 3));
  assert.throws(() => C.decode('abc=', 10));
  assert.throws(() => C.decode('AB', 10));
});

test('snapshot API stores only an envelope and separates creator deletion authority', async () => {
  const store = kv(), key = C.random(), content = 'PRIVATE API MARKER';
  const encrypted = await C.seal({ content, title: 'CONFIDENTIAL TITLE', mode: 'view' }, key, 'snapshot');
  const created = await call(snapshotApi, store, 'POST', { encrypted });
  assert.equal(created.status, 201);
  const { id, deleteToken, expiresIn } = await created.json();
  assert.match(id, /^s2_[A-Za-z0-9_-]{24}$/);
  assert.equal(expiresIn, 90 * 86400);
  const record = JSON.parse(store.values.get('share-v2:' + id));
  assert.deepEqual(Object.keys(record).sort(), ['createdAt', 'deleteTokenHash', 'encrypted', 'version']);
  assert.equal(store.writes[0].options.expirationTtl, 90 * 86400);
  for (const secret of [key, content, deleteToken, 'CONFIDENTIAL TITLE']) assert.equal(JSON.stringify(record).includes(secret), false);
  const fetched = await call(snapshotApi, store, 'GET', undefined, id);
  assert.equal(fetched.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await fetched.json(), { encrypted });
  assert.equal((await call(snapshotApi, store, 'DELETE', { deleteToken: key }, id)).status, 404);
  assert.equal((await call(snapshotApi, store, 'DELETE', { deleteToken }, id)).status, 200);
  assert.equal((await call(snapshotApi, store, 'GET', undefined, id)).status, 404);
});

test('legacy snapshots remain readable without rewriting or extending their TTL', async () => {
  const store = kv(), record = JSON.stringify({ content: 'legacy', title: 'Old title', mode: 'edit', createdAt: 1 });
  store.values.set('abcdefghjk', record);
  const response = await call(snapshotApi, store, 'GET', undefined, 'abcdefghjk');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).content, 'legacy');
  assert.equal(store.values.get('abcdefghjk'), record);
  assert.equal(store.writes.length, 0);
  assert.equal((await call(snapshotApi, store, 'POST', { content: 'new plaintext' })).status, 426);
  assert.equal(store.writes.length, 0);
});

test('snapshot API rejects unencrypted fields, invalid framing and missing bindings', async () => {
  const store = kv(), encrypted = await C.seal({ content: 'test' }, C.random(), 'snapshot');
  assert.equal((await call(snapshotApi, store, 'POST', { encrypted, key: C.random() })).status, 426);
  assert.equal((await call(snapshotApi, store, 'POST', { encrypted: { ...encrypted, ct: 'plaintext!' } })).status, 400);
  assert.equal((await snapshotApi({ request: request('GET'), env: {}, params: {} })).status, 503);
  assert.equal(store.writes.length, 0);
});

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=';
test('managed media uses encrypted random records; legacy media is not refreshed', async () => {
  const store = kv(), key = C.random(), encrypted = await C.seal({ dataUrl: png }, key, 'media', C.MEDIA_LIMIT);
  const response = await call(mediaApi, store, 'POST', { encrypted });
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.match(result.id, /^e2_[A-Za-z0-9_-]{24}$/);
  const raw = store.values.get('managed-media-v2:' + result.id);
  for (const secret of [png, key, 'image/png']) assert.equal(raw.includes(secret), false);
  const fetched = await call(mediaApi, store, 'GET', undefined, result.id);
  assert.deepEqual(await C.open((await fetched.json()).encrypted, key, 'media', C.MEDIA_LIMIT), { dataUrl: png });
  const duplicate = await (await call(mediaApi, store, 'POST', { encrypted })).json();
  assert.notEqual(duplicate.id, result.id);
  const id = 'abcdefgh1234567890123456';
  const legacy = JSON.stringify({ mimeType: 'image/png', base64: png.split(',')[1], createdAt: Date.now() - 86400000 });
  store.values.set('managed-image-v1:' + id, legacy);
  const writes = store.writes.length;
  assert.equal((await call(mediaApi, store, 'GET', undefined, id)).status, 200);
  assert.equal(store.values.get('managed-image-v1:' + id), legacy);
  assert.equal((await call(mediaApi, store, 'POST', { dataUrl: png })).status, 426);
  assert.equal(store.writes.length, writes);
});

test('media decryption validates signatures and never accepts active image types', () => {
  assert.equal(M.validateDataUrl(png).mime, 'image/png');
  assert.throws(() => M.validateDataUrl('data:image/png;base64,YmFk'));
  assert.throws(() => M.validateDataUrl('data:image/svg+xml;base64,PHN2Zy8+'));
  const key = C.random(), url = 'https://markdownviewer.pages.dev/api/image/e2_' + C.random(18) + '#key=' + key;
  const ref = M.reference(url, 'https://markdownviewer.pages.dev');
  assert.equal(ref.key, key);
  assert.equal(ref.url.includes('#'), false);
  assert.equal(M.reference(url.replace('markdownviewer.pages.dev', 'evil.example'), 'https://markdownviewer.pages.dev'), null);
});

async function roomPeers() {
  const roomId = 'room2_' + C.random(18), keys = await C.createRoom(roomId);
  const peer = role => C.liveSession({ roomId, config: keys.config, key: keys.key, role,
    sender: 'participant-' + C.random(12), signingKey: keys.signing[role] });
  return { roomId, keys, peer, host: await peer('host'), edit: await peer('edit'), view: await peer('view') };
}
test('live document, review, control and presence payloads are encrypted and role authenticated', async () => {
  const { host, edit, view } = await roomPeers();
  for (const [sender, type] of [[host, 'control-state'], [edit, 'y-update'], [view, 'review-update'], [view, 'presence']]) {
    const message = { type, update: 'PRIVATE DOCUMENT OR COMMENT', participant: { name: 'PRIVATE NAME' } };
    const frame = await sender.encrypt(message);
    assert.equal(JSON.stringify(frame).includes('PRIVATE'), false);
    const decoded = await host.decrypt(frame);
    assert.equal(decoded.update, message.update);
    assert.equal(decoded.participant.name, 'PRIVATE NAME');
  }
  await assert.rejects(view.encrypt({ type: 'y-update' }));
  await assert.rejects(view.encrypt({ type: 'session-end' }));
  await assert.rejects(edit.encrypt({ type: 'control-state' }));
});

test('live rejects signature/header tampering, role escalation, replay and cross-room frames', async () => {
  const { roomId, keys, host, edit, view } = await roomPeers();
  const frame = await edit.encrypt({ type: 'y-update', update: 'bytes' });
  for (const patch of [{ role: 'host' }, { type: 'control-state' }, { sender: 'participant-' + C.random(12) }, { seq: 999 }, { ct: C.random(32) }]) {
    await assert.rejects(view.decrypt({ ...frame, ...patch }));
  }
  await view.decrypt(frame);
  await assert.rejects(view.decrypt(frame), /Replayed/);
  const other = await roomPeers();
  await assert.rejects(other.host.decrypt(frame), /Wrong live room/);
  await assert.rejects(C.liveSession({ roomId, key: keys.key, config: keys.config, role: 'host', sender: 'participant-' + C.random(12), signingKey: keys.signing.view }), /role key/);
  const second = await edit.encrypt({ type: 'y-update', update: 'new' });
  await host.decrypt(second);
  await assert.rejects(host.decrypt(frame), /Replayed/);
});

test('reconnections derive fresh keys, and ciphertext does not decrypt with a different room key', async () => {
  const { roomId, keys, host, view, peer } = await roomPeers();
  const replacement = await peer('host');
  const one = await host.encrypt({ type: 'presence' }), two = await replacement.encrypt({ type: 'presence' });
  assert.notEqual(one.session, two.session);
  assert.notEqual(one.ct, two.ct);
  await view.decrypt(one); await view.decrypt(two);
  const wrong = await C.liveSession({ roomId, config: keys.config, key: C.random(), role: 'view', sender: 'participant-' + C.random(12), signingKey: keys.signing.view });
  await assert.rejects(wrong.decrypt(one));
});

test('streamed request limits work without a Content-Length header', async () => {
  const request = new Request('https://example.test', { method: 'POST', body: new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(100)); controller.close(); }
  }), duplex: 'half' });
  await assert.rejects(C.readJson(request, 10), /too large/);
});
