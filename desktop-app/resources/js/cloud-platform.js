// Shared cloud protocol/UI depend only on this platform boundary.
(function(target) {
  'use strict';
  const EXTENSION = 'com.markdownviewer.cloud';
  const COMMAND = '"extensions/cloud/markdown-cloud.exe"';
  function extension(native) {
    const pending = new Map();
    const disconnectListeners = new Set();
    let starting, stopping, healthChecked = false, leased = false, idleTimer;
    let failed = false, enabled = true, generation = 0;
    const fail = (message, code = 'NETWORK') => Object.assign(new Error(message), { code });
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    function scheduleIdle() {
      clearTimeout(idleTimer);
      if (!leased && !pending.size && healthChecked) idleTimer = setTimeout(() => void stop().catch(() => {}), 10000);
    }
    const ready = Promise.all([
      native.events.on('cloudResponse', event => {
        const reply = event.detail;
        const item = pending.get(reply?.id);
        if (!item) return;
        pending.delete(reply.id); clearTimeout(item.timeout);
        if (!item.timedOut) {
          if (reply.error) item.reject(fail(reply.error.message || 'Cloud operation failed.', reply.error.code));
          else item.resolve(reply.returnValue);
        }
        scheduleIdle();
      }),
      native.events.on('extClientDisconnect', event => {
        if (event.detail !== EXTENSION && event.detail?.extensionId !== EXTENSION) return;
        generation++; healthChecked = false; failed = false;
        for (const item of pending.values()) { clearTimeout(item.timeout); item.reject(fail('The cloud connection service stopped. Your draft was kept.')); }
        pending.clear(); clearTimeout(idleTimer);
        if (!stopping) for (const listener of disconnectListeners) listener();
      })
    ]);
    function send(operation, input = {}) {
      if (failed || [...pending.values()].some(item => item.timedOut)) throw fail('A previous cloud operation is still settling. Wait before checking or saving again.');
      if (pending.size >= 8) throw fail('Cloud service is busy. Try again shortly.', 'BUSY');
      clearTimeout(idleTimer);
      const id = crypto.randomUUID();
      return new Promise((resolve, reject) => {
        const item = { resolve, reject, timedOut:false };
        item.timeout = setTimeout(() => {
          // Keep the identity until native completion/disconnection: never let a
          // caller reconcile or retry while a native operation might still run.
          item.timedOut = true;
          reject(fail('Cloud request timed out. Its outcome is unconfirmed; your local draft was kept.'));
        }, 45000);
        pending.set(id, item);
        Promise.resolve().then(() => native.extensions.dispatch(EXTENSION, 'cloudRequest', { id, operation, input })).catch(() => {
          clearTimeout(item.timeout); pending.delete(id);
          reject(fail('Cloud extension is unavailable. Your local draft was kept.'));
        });
      });
    }
    async function ensureStarted() {
      await ready;
      if (!enabled) throw fail('Cloud connections are disabled.');
      if (stopping) await stopping;
      if (!enabled) throw fail('Cloud connections are disabled.');
      if (failed || [...pending.values()].some(item => item.timedOut)) throw fail('A previous cloud operation is still settling. Wait before checking or saving again.');
      if (starting) return starting;
      starting = (async () => {
        const epoch=generation;
        // Explicit preflight avoids the SDK dispatch async-executor rejection gap.
        let stats;
        try { stats = await native.extensions.getStats(); }
        catch (_) { throw fail('Cloud extension is unavailable. Your local draft was kept.'); }
        if (!enabled) throw fail('Cloud connections are disabled.');
        if (!stats?.loaded?.includes(EXTENSION)) throw fail('Cloud extension is not configured.');
        if (!stats.connected.includes(EXTENSION)) {
          healthChecked = false;
          const token = target.NL_TOKEN || target.sessionStorage?.getItem('NL_TOKEN');
          const port = Number(target.NL_PORT);
          if (!token || !token.includes('.') || !Number.isInteger(port) || port < 1 || port > 65535 || !target.NL_PATH) throw fail('Cloud startup information is unavailable.');
          // Only a fixed relative executable is passed to the shell. cwd is a
          // separate native option; no URL, account, filename or token is an arg.
          const child = await native.os.spawnProcess(COMMAND, { cwd: target.NL_PATH });
          try {
            await native.os.updateSpawnedProcess(child.id, 'stdIn', JSON.stringify({ nlPort:String(port), nlToken:token, nlConnectToken:token.split('.')[1], nlExtensionId:EXTENSION }));
            await native.os.updateSpawnedProcess(child.id, 'stdInEnd');
          } catch (_) {
            await native.os.updateSpawnedProcess(child.id, 'stdInEnd').catch(() => {});
            throw fail('Could not start the cloud helper. Check the extensions folder.');
          }
          const deadline = Date.now() + 5000;
          do {
            stats = await native.extensions.getStats();
            if (stats.connected.includes(EXTENSION)) break;
            await sleep(100);
          } while (Date.now() < deadline);
          if (!stats.connected.includes(EXTENSION)) throw fail('Cloud helper did not become ready. Check the extensions folder.');
        }
        if (!healthChecked) {
          const capabilities = await send('capabilities');
          if (capabilities?.version !== 5 || capabilities?.conditionalWrites !== true || capabilities?.requestDeadlineMs !== 35000 || !['nextcloud','webdav'].every(id=>capabilities?.providerIds?.includes(id))) {
            failed = true; throw fail('Cloud helper is outdated. Replace the whole application package.');
          }
          if (epoch !== generation) throw fail('Cloud helper stopped while connecting. Try Reconnect.');
          healthChecked = true;
        }
      })();
      try { await starting; } finally { starting = undefined; }
    }
    async function call(operation, input = {}) {
      await ensureStarted();
      while (!healthChecked) await ensureStarted();
      if (!enabled) throw fail('Cloud connections are disabled.');
      return send(operation, input);
    }
    async function stop() {
      await ready;
      clearTimeout(idleTimer);
      if (starting) await starting;
      if (stopping) return stopping;
      if (pending.size) throw fail('Wait for the current cloud operation to finish.');
      stopping = (async () => {
        const stats = await native.extensions.getStats();
        if (!stats.connected.includes(EXTENSION)) { healthChecked=false; failed=false; clearTimeout(idleTimer); return; }
        await send('shutdown');
        const deadline=Date.now()+3000;
        while (Date.now()<deadline) {
          if (!(await native.extensions.getStats()).connected.includes(EXTENSION)) { healthChecked=false; failed=false; clearTimeout(idleTimer); return; }
          await sleep(50);
        }
        failed=true; throw fail('Cloud helper is still stopping. Wait before reconnecting.');
      })();
      try { await stopping; } finally { stopping=undefined; }
    }
    return Object.freeze({
      secureAccounts: true,
      setEnabled: value => { enabled=Boolean(value); if (!enabled) { leased=false; clearTimeout(idleTimer); } },
      onDisconnect: listener => { disconnectListeners.add(listener); return () => disconnectListeners.delete(listener); },
      keepAlive: active => { leased=Boolean(active); scheduleIdle(); },
      stop,
      request: async input => {
        const response = await call('request', input);
        if (response?.transportVersion !== 1 || typeof response.body !== 'string' || new TextEncoder().encode(response.body).byteLength > input.maxBytes) throw fail('Invalid or oversized cloud response.', 'SIZE');
        return response;
      },
      storeAccount: account => call('accountStore', account),
      listAccounts: () => call('accountList'),
      forgetAccount: account => call('accountForget', account)
    });
  }
  target.MarkdownCloudPlatform = Object.freeze({
    extension,
    available: () => Boolean(target.NL_OS === 'Windows' && target.Neutralino?.extensions?.dispatch && target.Neutralino?.events?.on),
    create: () => extension(target.Neutralino)
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
