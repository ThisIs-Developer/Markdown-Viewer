(function(root) {
  'use strict';
  function connect(options) {
    const C = root.MarkdownShareCrypto;
    const cryptoSession = options.encryption.transport;
    const socket = new WebSocket(options.socketUrl);
    let opened = false, destroyed = false, failed = false;
    let sendChain = Promise.resolve(), receiveChain = Promise.resolve();
    let queuedBytes = 0, queuedCount = 0, incomingBytes = 0, incomingCount = 0;
    const waiting = [];
    const challenge = C.random(16), peers = new Map();
    let resolveReady, rejectReady;
    const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    // A rejected connection is also reported through onStatus; callers may await ready.
    ready.catch(() => {});
    const timer = setTimeout(() => fail('Encrypted room connection timed out.'), 8000);
    function fail(message) {
      if (destroyed || failed) return;
      failed = true;
      clearTimeout(timer);
      waiting.length = 0;
      options.onStatus(message, 'error');
      rejectReady(new Error(message));
      socket.close();
    }
    function send(message) {
      if (destroyed || failed || !C.canSend(options.role, message.type)) return;
      let copy;
      try { copy = JSON.stringify(message); } catch (_) { fail('Unable to encrypt a live update.'); return; }
      if (copy.length > C.LIVE_LIMIT || queuedCount >= 100 || queuedBytes + copy.length > C.LIVE_LIMIT * 2) {
        fail('Live update queue is full. Rejoin the room to synchronize.'); return;
      }
      queuedCount += 1; queuedBytes += copy.length;
      sendChain = sendChain.then(async () => {
        if (destroyed || failed) return;
        const frame = JSON.stringify(await cryptoSession.encrypt(JSON.parse(copy)));
        if (destroyed || failed) return;
        if (opened) {
          if (socket.bufferedAmount > C.LIVE_LIMIT * 2) throw new Error('Backpressure');
          socket.send(frame);
        } else {
          if (waiting.length >= 100 || waiting.reduce((n, value) => n + value.length, 0) + frame.length > C.LIVE_LIMIT * 2) throw new Error('Backpressure');
          waiting.push(frame);
        }
      }).catch(() => fail('Unable to send an encrypted live update. Rejoin the room.'))
        .finally(() => { queuedCount -= 1; queuedBytes -= copy.length; });
      return sendChain;
    }
    function publishCurrentState() {
      if (options.canPublishState && !options.canPublishState()) return;
      send({ type: 'sync-state', update: C.encode(options.Y.encodeStateAsUpdate(options.ydoc)) });
    }
    function publishReviewState() {
      if (!options.reviewDoc || (options.canPublishReviewState && !options.canPublishReviewState())) return;
      send({ type: 'review-sync-state', update: C.encode(options.Y.encodeStateAsUpdate(options.reviewDoc)) });
    }
    function publishControlState() {
      if (options.role === 'host') send({ type: 'control-state', update: C.encode(options.Y.encodeStateAsUpdate(options.controlDoc)) });
    }
    function publishPresence(cursor) {
      send({ type: 'presence', participant: options.getParticipant(), cursor: cursor || null });
    }
    const transport = { publishCurrentState, publishReviewState, publishControlState, publishPresence };
    function hello() { return send({ type: 'hello', challenge }); }
    function receiveVerified(message) {
      const id = message.role + ':' + message.sender + ':' + message.session;
      if (!peers.has(id)) {
        if (peers.size >= 1024) throw new Error('Too many live sessions.');
        peers.set(id, { proven: false, challenged: false, replies: new Set() });
      }
      const peer = peers.get(id);
      if (message.type === 'hello') {
        if (typeof message.challenge !== 'string' || C.decode(message.challenge, 16).length !== 16) throw new Error('Fresh challenge required.');
        if (!peer.replies.has(message.challenge)) {
          if (peer.replies.size >= 4) throw new Error('Too many session challenges.');
          peer.replies.add(message.challenge);
          send({ type: 'session-proof', recipient: message.sender, recipientSession: message.session,
            challenge: message.challenge, participant: options.getParticipant() });
        }
        if (!peer.challenged) { peer.challenged = true; hello(); }
        return;
      }
      if (message.type === 'session-proof') {
        if (message.recipient !== options.participantId || message.recipientSession !== cryptoSession.session ||
            message.challenge !== challenge || peer.proven) return;
        peer.proven = true;
        // The authenticated proof establishes this receiver's sequence floor.
        // No replayed data, presence, or host controls are applied before it.
        options.onMessage(Object.assign({}, message, { type: 'hello' }), transport);
        send({ type: 'sync-request' }); send({ type: 'review-sync-request' });
        publishControlState(); publishCurrentState(); publishReviewState(); publishPresence(options.getCursor());
        return;
      }
      if (peer.proven) options.onMessage(message, transport);
    }
    const update = (bytes, origin) => {
      if (origin === options.relayOrigin || (options.canSendUpdate && !options.canSendUpdate())) return;
      send({ type: 'y-update', update: C.encode(bytes) });
    };
    const reviewUpdate = (bytes, origin) => {
      if (origin === options.reviewRelayOrigin || (options.canSendReviewUpdate && !options.canSendReviewUpdate())) return;
      send({ type: 'review-update', update: C.encode(bytes) });
    };
    options.ydoc.on('update', update);
    options.reviewDoc.on('update', reviewUpdate);
    options.controlDoc.on('update', publishControlState);
    socket.addEventListener('open', () => {
      if (destroyed || failed) return;
      socket.send(JSON.stringify({ v: 2, freshness: 1, type: 'authenticate', role: options.role,
        capability: options.capability, capabilities: options.role === 'host' ? options.capabilities : undefined,
        sender: options.participantId, session: cryptoSession.session, config: options.encryption.config }));
    });
    socket.addEventListener('message', event => {
      if (destroyed || failed) return;
      if (typeof event.data !== 'string' || event.data.length > Math.ceil((C.LIVE_LIMIT + 16) * 4 / 3) + 4096 ||
          incomingCount >= 100 || incomingBytes + event.data.length > C.LIVE_LIMIT * 3) {
        fail('Encrypted room receive limit exceeded.'); return;
      }
      incomingCount += 1; incomingBytes += event.data.length;
      receiveChain = receiveChain.then(async () => {
        if (destroyed || failed) return;
        const frame = JSON.parse(event.data);
        if (!opened && frame.type === 'ready' && frame.v === 2 && frame.freshness === 1 && Object.keys(frame).length === 3) {
          opened = true;
          clearTimeout(timer);
          waiting.splice(0).forEach(value => socket.send(value));
          hello();
          options.onStatus('Connected to encrypted live room', 'connected');
          resolveReady();
          return;
        }
        if (!opened) throw new Error('Authentication required');
        const message = await cryptoSession.decrypt(frame);
        if (destroyed || failed || message.sender === options.participantId) return;
        receiveVerified(message);
      }).catch(() => fail('An encrypted live message could not be verified. Rejoin with the complete invite link.'))
        .finally(() => { incomingCount -= 1; incomingBytes -= event.data.length; });
    });
    // A valid signed session-end may already be queued for asynchronous AES-GCM
    // verification when the relay sends its closing frame. Process received
    // ciphertext before reporting the transport as disconnected; otherwise
    // fast-close browsers can discard the host's authenticated end command.
    function reportTransportClosed(message) {
      receiveChain.then(() => fail(message), () => fail(message));
    }
    socket.addEventListener('close', () => reportTransportClosed('Live room disconnected.'));
    socket.addEventListener('error', () => reportTransportClosed('Encrypted live room connection failed.'));
    return Object.assign({ ready, send, destroy() {
      if (destroyed) return;
      destroyed = true;
      clearTimeout(timer);
      rejectReady(new Error('Live room closed.'));
      options.ydoc.off('update', update);
      options.reviewDoc.off('update', reviewUpdate);
      options.controlDoc.off('update', publishControlState);
      waiting.length = 0;
      // Complete queued cryptography before the signed leave so sequence numbers stay ordered.
      sendChain.then(async () => {
        if (opened && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(await cryptoSession.encrypt({ type: 'leave' })));
        }
      }).catch(() => {}).finally(() => socket.close());
    } }, transport);
  }
  root.MarkdownShareLive = Object.freeze({ connect });
})(globalThis);
