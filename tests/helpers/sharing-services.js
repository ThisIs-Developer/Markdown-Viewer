const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { build } = require('esbuild');

const serviceOrigin = 'https://markdownviewer.pages.dev';
const yjsUrl = 'https://esm.sh/yjs@13.6.10/es2022/yjs.mjs';
let yjsBundle;
let shareHandler;

// Use the real snapshot handler and Yjs implementation. Backend I/O is
// intercepted for deterministic, non-publishing CI; hosted acceptance runs
// separately without these routes to cover real CORS and WebSocket upgrades.
async function installSharingServices(context) {
  const storage = new Map();
  const requests = [];
  const connections = [];
  const rooms = new Map();
  shareHandler ||= import(pathToFileURL(path.resolve(__dirname, '../../functions/api/share/[[id]].js')).href);
  yjsBundle ||= build({
    stdin: { contents: 'export * from "yjs";', resolveDir: path.resolve(__dirname, '../..') },
    bundle: true, format: 'esm', platform: 'browser', write: false
  }).then(result => result.outputFiles[0].text);
  await context.route(yjsUrl, async route => route.fulfill({
    contentType: 'application/javascript',
    headers: { 'access-control-allow-origin': '*' },
    body: await yjsBundle
  }));
  await context.route(serviceOrigin + '/api/share**', async route => {
    const incoming = route.request();
    const url = new URL(incoming.url());
    requests.push({ method: incoming.method(), url: incoming.url() });
    const request = new Request(incoming.url(), {
      method: incoming.method(), headers: incoming.headers(),
      ...(['GET', 'HEAD'].includes(incoming.method()) ? {} : { body: incoming.postData() })
    });
    const response = await (await shareHandler).onRequest({
      request, params: { id: url.pathname.slice('/api/share'.length).replace(/^\//, '') },
      env: { SHARE_KV: {
        async get(key) { return storage.get(key) ?? null; },
        async put(key, value) { storage.set(key, value); },
        async delete(key) { storage.delete(key); }
      } }
    });
    await route.fulfill({
      status: response.status, headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer())
    });
  });
  await context.routeWebSocket('wss://markdownviewer.pages.dev/live-room/**', socket => {
    const url = new URL(socket.url());
    connections.push(url);
    const roomKey = url.pathname + '?' + url.searchParams.get('secret');
    if (!rooms.has(roomKey)) rooms.set(roomKey, new Set());
    const peers = rooms.get(roomKey);
    peers.add(socket);
    socket.onMessage(message => {
      for (const peer of peers) if (peer !== socket) peer.send(message);
    });
    socket.onClose(() => peers.delete(socket));
  });
  return { requests, connections, storage };
}

module.exports = { installSharingServices, serviceOrigin };

