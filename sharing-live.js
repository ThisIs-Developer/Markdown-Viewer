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
      socket.send(JSON.stringify({ v: 2, type: 'authenticate', role: options.role,
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
        if (!opened && frame.type === 'ready' && frame.v === 2 && Object.keys(frame).length === 2) {
          opened = true;
          clearTimeout(timer);
          waiting.splice(0).forEach(value => socket.send(value));
          send({ type: 'hello', participant: options.getParticipant() });
          send({ type: 'sync-request' });
          send({ type: 'review-sync-request' });
          publishControlState(); publishCurrentState(); publishReviewState(); publishPresence(options.getCursor());
          options.onStatus('Connected to encrypted live room', 'connected');
          resolveReady();
          return;
        }
        if (!opened) throw new Error('Authentication required');
        const message = await cryptoSession.decrypt(frame);
        if (destroyed || failed || message.sender === options.participantId) return;
        options.onMessage(message, transport);
      }).catch(() => fail('An encrypted live message could not be verified. Rejoin with the complete invite link.'))
        .finally(() => { incomingCount -= 1; incomingBytes -= event.data.length; });
    });
    socket.addEventListener('close', () => fail('Live room disconnected.'));
    socket.addEventListener('error', () => fail('Encrypted live room connection failed.'));
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
