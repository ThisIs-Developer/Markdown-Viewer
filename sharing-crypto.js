/* Shared browser/Worker protocol. No content keys are held by the service. */
(function(root) {
  'use strict';
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const SNAPSHOT_LIMIT = 8 * 1024 * 1024;
  const MEDIA_LIMIT = 15 * 1024 * 1024;
  const LIVE_LIMIT = 8 * 1024 * 1024;
  const MAX_SEQUENCE = 0xffffffff;
  const TOKEN = /^[A-Za-z0-9_-]{16,160}$/;
  const TYPES = ['hello', 'presence', 'sync-request', 'sync-state', 'y-update',
    'review-sync-request', 'review-sync-state', 'review-update', 'control-state', 'leave', 'session-end'];

  function cryptoApi() {
    if (!root.crypto || !root.crypto.subtle) throw new Error('Encrypted sharing requires a secure connection and Web Crypto.');
    return root.crypto;
  }
  function encode(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decode(value, limit) {
    if (typeof value !== 'string' || !value || value.length > Math.ceil(limit * 4 / 3) || !/^[A-Za-z0-9_-]+$/.test(value)) {
      throw new Error('Invalid encrypted sharing data.');
    }
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
    if (binary.length > limit) throw new Error('Encrypted sharing data is too large.');
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    if (encode(bytes) !== value) throw new Error('Non-canonical encrypted sharing data.');
    return bytes;
  }
  function random(bytes = 32) { return encode(cryptoApi().getRandomValues(new Uint8Array(bytes))); }
  function jsonBytes(value, limit) {
    const bytes = encoder.encode(JSON.stringify(value));
    if (bytes.length > limit) throw new Error('The content is too large for encrypted sharing.');
    return bytes;
  }
  function exactKeys(value, keys) {
    return value && typeof value === 'object' && !Array.isArray(value) &&
      Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
  }
  function envelope(value, limit) {
    if (!exactKeys(value, ['v', 'alg', 'iv', 'ct']) || value.v !== 2 || value.alg !== 'A256GCM' ||
        typeof value.iv !== 'string' || value.iv.length !== 16 || typeof value.ct !== 'string' ||
        value.ct.length < 23 || value.ct.length > Math.ceil((limit + 16) * 4 / 3) ||
        !/^[A-Za-z0-9_-]+$/.test(value.iv) || !/^[A-Za-z0-9_-]+$/.test(value.ct)) {
      throw new Error('A supported encrypted sharing envelope is required.');
    }
    return { v: 2, alg: 'A256GCM', iv: value.iv, ct: value.ct };
  }
  async function importAes(key) {
    const bytes = decode(key, 32);
    if (bytes.length !== 32) throw new Error('The share key is missing or invalid.');
    return cryptoApi().subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  async function seal(value, key, purpose, limit = SNAPSHOT_LIMIT) {
    const bytes = jsonBytes(value, limit);
    const iv = cryptoApi().getRandomValues(new Uint8Array(12));
    const ct = await cryptoApi().subtle.encrypt({ name: 'AES-GCM', iv,
      additionalData: encoder.encode('markdown-viewer:v2:' + purpose), tagLength: 128 },
    await importAes(key), bytes);
    return { v: 2, alg: 'A256GCM', iv: encode(iv), ct: encode(new Uint8Array(ct)) };
  }
  async function open(value, key, purpose, limit = SNAPSHOT_LIMIT) {
    const record = envelope(value, limit);
    try {
      const bytes = await cryptoApi().subtle.decrypt({ name: 'AES-GCM', iv: decode(record.iv, 12),
        additionalData: encoder.encode('markdown-viewer:v2:' + purpose), tagLength: 128 },
      await importAes(key), decode(record.ct, limit + 16));
      if (bytes.byteLength > limit) throw new Error();
      return JSON.parse(decoder.decode(bytes));
    } catch (_) { throw new Error('Unable to decrypt this share. Check that the complete link is present.'); }
  }
  function pack(value, limit = SNAPSHOT_LIMIT * 2) { return encode(jsonBytes(value, limit)); }
  function unpack(value, limit = SNAPSHOT_LIMIT * 2) { return JSON.parse(decoder.decode(decode(value, limit))); }
  async function hash(value) { return encode(new Uint8Array(await cryptoApi().subtle.digest('SHA-256', encoder.encode(value)))); }
  function canSend(role, type) {
    if (!TYPES.includes(type)) return false;
    if (role === 'host') return true;
    if (role !== 'edit' && role !== 'view') return false;
    if (['session-end', 'control-state', 'review-sync-state'].includes(type)) return false;
    return role === 'edit' || !['sync-state', 'y-update'].includes(type);
  }
  async function signingPair() {
    const pair = await cryptoApi().subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    return {
      privateKey: encode(new Uint8Array(await cryptoApi().subtle.exportKey('pkcs8', pair.privateKey))),
      publicKey: encode(new Uint8Array(await cryptoApi().subtle.exportKey('raw', pair.publicKey)))
    };
  }
  function publicConfig(config, roomId) {
    if (!exactKeys(config, ['v', 'roomId', 'expiresAt', 'host', 'edit', 'view']) || config.v !== 2 ||
        config.roomId !== roomId || typeof roomId !== 'string' || !TOKEN.test(roomId) ||
        !Number.isSafeInteger(config.expiresAt) || config.expiresAt <= 0 ||
        !['host', 'edit', 'view'].every(role => typeof config[role] === 'string' && decode(config[role], 65).length === 65)) {
      throw new Error('Invalid encrypted room configuration.');
    }
    return { v: 2, roomId, expiresAt: config.expiresAt, host: config.host, edit: config.edit, view: config.view };
  }
  async function createRoom(roomId) {
    const host = await signingPair(), edit = await signingPair(), view = await signingPair();
    return { key: random(), config: { v: 2, roomId, expiresAt: Date.now() + 86400000, host: host.publicKey, edit: edit.publicKey, view: view.publicKey },
      signing: { host: host.privateKey, edit: edit.privateKey, view: view.privateKey } };
  }
  function header(frame) {
    return JSON.stringify(['markdown-viewer:live', 2, frame.roomId, frame.sender, frame.session, frame.seq, frame.type, frame.role]);
  }
  function signedBytes(frame) { return encoder.encode(JSON.stringify([header(frame), frame.iv, frame.ct])); }
  function liveFrame(frame) {
    if (!exactKeys(frame, ['v', 'roomId', 'sender', 'session', 'seq', 'type', 'role', 'iv', 'ct', 'sig']) ||
        frame.v !== 2 || ![frame.roomId, frame.sender, frame.session].every(value => typeof value === 'string' && TOKEN.test(value)) ||
        !Number.isSafeInteger(frame.seq) || frame.seq < 1 || frame.seq > MAX_SEQUENCE || !canSend(frame.role, frame.type)) {
      throw new Error('Invalid encrypted live frame.');
    }
    envelope({ v: 2, alg: 'A256GCM', iv: frame.iv, ct: frame.ct }, LIVE_LIMIT);
    if (typeof frame.sig !== 'string' || decode(frame.sig, 64).length !== 64) throw new Error('Invalid live signature.');
    return frame;
  }
  async function verifyFrame(frame, config) {
    liveFrame(frame);
    publicConfig(config, frame.roomId);
    const key = await cryptoApi().subtle.importKey('raw', decode(config[frame.role], 65), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    if (!await cryptoApi().subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, decode(frame.sig, 64), signedBytes(frame))) {
      throw new Error('Invalid live signature.');
    }
    return true;
  }
  async function liveSession(options) {
    const config = publicConfig(options.config, options.roomId);
    if (config.expiresAt <= Date.now()) throw new Error('This encrypted room has expired.');
    const rootBytes = decode(options.key, 32);
    if (rootBytes.length !== 32 || typeof options.sender !== 'string' || !TOKEN.test(options.sender)) throw new Error('Invalid encrypted room key.');
    const rootKey = await cryptoApi().subtle.importKey('raw', rootBytes, 'HKDF', false, ['deriveKey']);
    const signer = await cryptoApi().subtle.importKey('pkcs8', decode(options.signingKey, 256), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const verifier = await cryptoApi().subtle.importKey('raw', decode(config[options.role], 65), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const challenge = encoder.encode('markdown-viewer:live:role-check');
    const proof = await cryptoApi().subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signer, challenge);
    if (!await cryptoApi().subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verifier, proof, challenge)) throw new Error('Invalid live role key.');
    const session = random(16);
    let sequence = 0;
    const received = new Map();
    async function derive(frame) {
      return cryptoApi().subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: decode(frame.session, 32),
        info: encoder.encode(JSON.stringify(['markdown-viewer:live:v2', frame.roomId, frame.sender])) },
      rootKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    }
    const ownKey = await derive({ session, roomId: options.roomId, sender: options.sender });
    return {
      session,
      async encrypt(message) {
        if (!canSend(options.role, message.type) || sequence >= MAX_SEQUENCE) throw new Error('Live message is not permitted.');
        const frame = { v: 2, roomId: options.roomId, sender: options.sender, session,
          seq: ++sequence, type: message.type, role: options.role };
        // A fresh session has a fresh HKDF key. Its counter IV is never reused.
        const iv = new Uint8Array(12);
        new DataView(iv.buffer).setUint32(8, frame.seq);
        const ciphertext = await cryptoApi().subtle.encrypt({ name: 'AES-GCM', iv,
          additionalData: encoder.encode(header(frame)), tagLength: 128 }, ownKey, jsonBytes(message, LIVE_LIMIT));
        frame.iv = encode(iv);
        frame.ct = encode(new Uint8Array(ciphertext));
        frame.sig = encode(new Uint8Array(await cryptoApi().subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signer, signedBytes(frame))));
        // Detect a mismatched/tampered invitation before sending any room data.
        await verifyFrame(frame, config);
        return frame;
      },
      async decrypt(frame) {
        if (frame.roomId !== options.roomId) throw new Error('Wrong live room.');
        await verifyFrame(frame, config);
        const peer = frame.role + ':' + frame.sender + ':' + frame.session;
        if (frame.seq <= (received.get(peer) || 0)) throw new Error('Replayed live frame.');
        if (!received.has(peer) && received.size >= 1024) throw new Error('Too many live sessions.');
        const plaintext = await cryptoApi().subtle.decrypt({ name: 'AES-GCM', iv: decode(frame.iv, 12),
          additionalData: encoder.encode(header(frame)), tagLength: 128 }, await derive(frame), decode(frame.ct, LIVE_LIMIT + 16));
        const message = JSON.parse(decoder.decode(plaintext));
        if (!message || message.type !== frame.type) throw new Error('Wrong live channel.');
        received.set(peer, frame.seq);
        return Object.assign({}, message, { sender: frame.sender, roomId: frame.roomId, role: frame.role });
      }
    };
  }
  async function readJson(request, limit) {
    if (!request.body || Number(request.headers.get('Content-Length')) > limit) throw new Error('Request is too large.');
    const reader = request.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > limit) { await reader.cancel(); throw new Error('Request is too large.'); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(decoder.decode(bytes));
  }
  const api = { SNAPSHOT_LIMIT, MEDIA_LIMIT, LIVE_LIMIT, MAX_SEQUENCE, encode, decode, random, pack, unpack,
    seal, open, envelope, exactKeys, hash, canSend, publicConfig, createRoom, liveFrame, verifyFrame, liveSession, readJson };
  root.MarkdownShareCrypto = Object.freeze(api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
