import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { sharingGuard } from '../../server/sharing-guard.js';
const require = createRequire(import.meta.url);
const C = require('../../sharing-crypto.js'), M = require('../../sharing-media.js'), R = require('../../sharing-recovery.js');
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=';
const until = async predicate => { const deadline = performance.now() + 5000; while (!predicate()) {
  if (performance.now() > deadline) throw new Error('Async test timed out'); await new Promise(resolve => setTimeout(resolve, 5));
} };

test('Docker applies the web security headers and ships all local sharing dependencies', () => {
  const nginx = readFileSync('nginx.conf', 'utf8'), docker = readFileSync('Dockerfile', 'utf8');
  for (const line of readFileSync('_headers', 'utf8').trim().split(/\r?\n/).slice(1)) {
    const split = line.indexOf(':');
    const value = line.slice(split + 1).trim().replace('; upgrade-insecure-requests', '');
    assert.ok(nginx.includes('add_header ' + line.slice(0, split).trim() + ' "' + value + '" always;'));
  }
  // The HTTP-only container must not upgrade its own script/style URLs to HTTPS.
  assert.equal(nginx.includes('upgrade-insecure-requests'), false);
  assert.ok(docker.includes('COPY nginx.conf /etc/nginx/conf.d/default.conf'));
  assert.ok(docker.includes('sharing-recovery.js /usr/share/nginx/html/'));
  assert.ok(docker.includes('COPY assets/ /usr/share/nginx/html/assets/'));
});

test('recovery round trip is local and rejects wrong keys, altered bytes and share substitution', async () => {
  const value = { content: '# Private हिन्दी 😀\n![](' + png + ')', title: 'Private title', reviewThreads: [{ text: 'Private comment' }], createdAt: Date.now() };
  const first = await R.create(value), second = await R.create(value);
  assert.notEqual(first.key, second.key); assert.notEqual(first.file, second.file);
  for (const secret of ['Private', png, first.key]) assert.equal(first.file.includes(secret), false);
  assert.deepEqual(await R.restore(first.file, first.key), value);
  await assert.rejects(R.restore(first.file, second.key));
  const tampered = JSON.parse(first.file); const bytes = C.decode(tampered.encrypted.ct, C.SNAPSHOT_LIMIT); bytes[0] ^= 1;
  tampered.encrypted.ct = C.encode(bytes);
  await assert.rejects(R.restore(JSON.stringify(tampered), first.key));
  await assert.rejects(C.open(JSON.parse(first.file).encrypted, first.key, 'snapshot'));
  await assert.rejects(R.restore(JSON.stringify({ ...JSON.parse(first.file), version: 2 }), first.key));
});

test('media deduplicates cold requests and reuses only ciphertext, with expiry and bounds', async () => {
  const key = C.random(), base = 'https://markdownviewer.pages.dev', url = base + '/api/image/e2_' + C.random(18);
  const encrypted = await C.seal({ dataUrl: png }, key, 'media', C.MEDIA_LIMIT);
  const originalFetch = globalThis.fetch, originalNow = Date.now; let reads = 0;
  const now = Date.now();
  globalThis.fetch = async request => {
    reads += 1; assert.equal(request, url); assert.equal(request.includes(key), false);
    await new Promise(resolve => setTimeout(resolve, 10));
    return Response.json({ encrypted, expiresAt: now + 120000 });
  };
  M.clearCache();
  try {
    const input = '![](' + url + '#key=' + key + ')';
    const values = await Promise.all([M.inlineMarkdown(input, base), M.inlineMarkdown(input, base)]);
    assert.equal(reads, 1); assert.ok(values.every(value => value.includes(png)));
    await M.inlineMarkdown(input, base); assert.equal(reads, 1);
    const relative = new URL(url).pathname + '#key=' + key;
    const mixed = '![](' + relative + ')\n![](' + url.replace('https:', '') + '#key=' + key + ')\n' + input;
    const portable = await M.inlineMarkdown(mixed, base);
    assert.equal(portable, ['![](' + png + ')', '![](' + png + ')', '![](' + png + ')'].join('\n'));
    assert.equal(reads, 1);
    await assert.rejects(M.inlineMarkdown(input.replace(key, C.random()), base)); assert.equal(reads, 1);
    const excessive = Array.from({ length: 33 }, () => '![](' + base + '/api/image/e2_' + C.random(18) + '#key=' + key + ')').join('\n');
    await assert.rejects(M.inlineMarkdown(excessive, base), /32/); assert.equal(reads, 1);
    Date.now = () => now + 61000; await M.inlineMarkdown(input, base); assert.equal(reads, 2);
    Date.now = () => now + 121000; await assert.rejects(M.inlineMarkdown(input, base), /expired/); assert.equal(reads, 3);
  } finally { globalThis.fetch = originalFetch; Date.now = originalNow; M.clearCache(); }
});

test('portable export checks repeated-attachment expansion before allocating the result', async () => {
  const bytes = new Uint8Array(280 * 1024); bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const dataUrl = 'data:image/png;base64,' + Buffer.from(bytes).toString('base64');
  const key = C.random(), base = 'https://markdownviewer.pages.dev', url = base + '/api/image/e2_' + C.random(18) + '#key=' + key;
  const encrypted = await C.seal({ dataUrl }, key, 'media', C.MEDIA_LIMIT), originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ encrypted, expiresAt: Date.now() + 60000 });
  M.clearCache();
  try {
    await assert.rejects(M.inlineMarkdown(('![](' + url + ')\n').repeat(100), base), /size limit/);
    await assert.rejects(M.inlineMarkdown(('![](' + url + ')\n').repeat(30), base, C.SNAPSHOT_LIMIT), /size limit/);
    assert.ok((await M.inlineMarkdown('![](' + url + ')', base)).includes(dataUrl));
  } finally { globalThis.fetch = originalFetch; M.clearCache(); }
});

test('burst guard and maintenance mode need no persistent storage and preserve existing reads', () => {
  const post = new Request('https://example.test/api/share', { method: 'POST', headers: { 'CF-Connecting-IP': '192.0.2.3' } });
  assert.equal(sharingGuard(post, { SHARING_WRITES_ENABLED: 'false' }).status, 503);
  for (let i = 0; i < 60; i++) assert.equal(sharingGuard(post), null);
  assert.equal(sharingGuard(post).status, 429);
  assert.equal(sharingGuard(new Request('https://example.test/api/share/s2_id'), { SHARING_WRITES_ENABLED: 'false' }), null);
});

test('live crypto enforces expiry on existing sessions, not just construction', async () => {
  const roomId = 'room2_' + C.random(18), keys = await C.createRoom(roomId);
  const session = await C.liveSession({ roomId, config: keys.config, key: keys.key, role: 'host', sender: C.random(18), signingKey: keys.signing.host });
  const frame = await session.encrypt({ type: 'presence' }), originalNow = Date.now;
  try {
    Date.now = () => keys.config.expiresAt;
    await assert.rejects(session.encrypt({ type: 'presence' }), /expired/);
    await assert.rejects(session.decrypt(frame), /expired/);
  } finally { Date.now = originalNow; }
});

test('fresh recipient-bound proofs gate replayed state and allow legitimate synchronization', async () => {
  const roomId = 'room2_' + C.random(18), keys = await C.createRoom(roomId), hostId = C.random(18), viewerId = C.random(18);
  const host = await C.liveSession({ roomId, config: keys.config, key: keys.key, role: 'host', sender: hostId, signingKey: keys.signing.host });
  const oldState = await host.encrypt({ type: 'control-state', update: 'old control' });
  const applied = [], statuses = [], sockets = [];
  class Socket {
    static OPEN = 1;
    constructor() { this.listeners = {}; this.sent = []; this.bufferedAmount = 0; this.readyState = 1; sockets.push(this); }
    addEventListener(type, handler) { this.listeners[type] = handler; }
    send(value) { this.sent.push(JSON.parse(value)); }
    close() { this.readyState = 3; }
    emit(type, value) { this.listeners[type]?.({ data: JSON.stringify(value) }); }
  }
  const context = { MarkdownShareCrypto: C, WebSocket: Socket, setTimeout, clearTimeout };
  runInNewContext(readFileSync('sharing-live.js', 'utf8'), context);
  const doc = { on() {}, off() {} };
  const viewer = await C.liveSession({ roomId, config: keys.config, key: keys.key, role: 'view', sender: viewerId, signingKey: keys.signing.view });
  const transport = context.MarkdownShareLive.connect({ encryption: { transport: viewer, config: keys.config }, role: 'view', participantId: viewerId,
    socketUrl: 'ws://local', capability: C.random(), ydoc: doc, reviewDoc: doc, controlDoc: doc,
    Y: { encodeStateAsUpdate() { return new Uint8Array(); } }, getParticipant: () => ({ name: 'Viewer' }), getCursor: () => null,
    onMessage: message => applied.push(message), onStatus: status => statuses.push(status) });
  try {
    const socket = sockets[0]; socket.emit('open'); socket.emit('message', { type: 'ready', v: 2, freshness: 1 });
    await transport.ready; await until(() => socket.sent.some(frame => frame.type === 'hello'));
    const hello = await host.decrypt(socket.sent.find(frame => frame.type === 'hello'));
    socket.emit('message', oldState);
    socket.emit('message', await host.encrypt({ type: 'session-proof', recipient: viewerId, recipientSession: viewer.session, challenge: C.random(16) }));
    socket.emit('message', await host.encrypt({ type: 'session-proof', recipient: viewerId, recipientSession: C.random(16), challenge: hello.challenge }));
    socket.emit('message', await host.encrypt({ type: 'session-proof', recipient: viewerId, recipientSession: viewer.session, challenge: hello.challenge, participant: { name: 'Host' } }));
    await until(() => applied.length === 1); assert.equal(applied[0].type, 'hello');
    socket.emit('message', await host.encrypt({ type: 'control-state', update: 'fresh control' }));
    await until(() => applied.length === 2); assert.equal(applied[1].update, 'fresh control');
    socket.emit('message', oldState);
    await until(() => statuses.some(status => status.includes('could not be verified')));
    assert.equal(applied.length, 2);
  } finally { transport.destroy(); }
});
