/* Private diagrams run in an opaque-origin sandbox, never in a remote renderer. */
(function(root) {
  'use strict';
  let frame, ready, d2Worker, sequence = 0;
  const pending = new Map();
  const d2Pending = new Map();
  const rendered = new Map(), inFlight = new Map();
  let renderedBytes = 0, inFlightBytes = 0;
  const CACHE_LIMIT = 24 * 1024 * 1024;
  addEventListener('pagehide', () => { rendered.clear(); renderedBytes = 0; });
  function renderD2(source) {
    if (!d2Worker) {
      d2Worker = new Worker(new URL('assets/private-renderers/d2-worker.js', document.baseURI), { type: 'module' });
      d2Worker.onmessage = event => {
        const request = d2Pending.get(event.data?.id);
        if (!request) return;
        d2Pending.delete(event.data.id); clearTimeout(request.timer);
        if (typeof event.data.svg === 'string' && event.data.svg.length <= 20 * 1024 * 1024) request.resolve(event.data.svg);
        else request.reject(new Error(event.data.error || 'D2 rendering failed.'));
      };
      d2Worker.onerror = () => {
        d2Pending.forEach(request => { clearTimeout(request.timer); request.reject(new Error('Local D2 renderer unavailable.')); });
        d2Pending.clear(); d2Worker.terminate(); d2Worker = null;
      };
    }
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { d2Pending.delete(id); reject(new Error('D2 rendering timed out.')); }, 90000);
      d2Pending.set(id, { resolve, reject, timer }); d2Worker.postMessage({ id, source });
    });
  }
  function initialize() {
    if (ready) return ready;
    ready = new Promise((resolve, reject) => {
      frame = document.createElement('iframe');
      frame.setAttribute('sandbox', 'allow-scripts');
      frame.setAttribute('aria-hidden', 'true');
      frame.tabIndex = -1;
      frame.style.cssText = 'position:fixed;width:1000px;height:800px;left:0;top:0;border:0;opacity:0;z-index:-1;pointer-events:none';
      const assets = new URL('assets/private-renderers/', document.baseURI).href;
      const timeout = setTimeout(() => reject(new Error('Local renderers could not be loaded. Reload and retry.')), 45000);
      window.addEventListener('message', event => {
        if (event.source !== frame.contentWindow || !event.data || event.data.channel !== 'private-renderer') return;
        if (event.data.ready) { clearTimeout(timeout); resolve(); return; }
        const request = pending.get(event.data.id);
        if (!request) return;
        pending.delete(event.data.id); clearTimeout(request.timer);
        if (typeof event.data.svg === 'string' && event.data.svg.length <= 20 * 1024 * 1024 && /<svg[\s>]/.test(event.data.svg)) request.resolve(event.data.svg);
        else request.reject(new Error(event.data.error || 'Local rendering failed.'));
      });
      frame.src = assets + 'frame.html';
      document.body.appendChild(frame);
    });
    return ready;
  }
  async function renderUncached(engine, source, options = {}) {
    if (typeof source !== 'string' || source.length > 8 * 1024 * 1024) throw new Error('Diagram exceeds the local rendering limit.');
    if (engine === 'd2') return renderD2(source);
    await initialize();
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('Local diagram rendering timed out.')); }, 90000);
      pending.set(id, { resolve, reject, timer });
      frame.contentWindow.postMessage({ channel: 'private-renderer', id, engine, source, options }, '*');
    });
  }
  function render(engine, source, options = {}) {
    const key = engine + '\0' + JSON.stringify(options) + '\0' + source;
    const cached = rendered.get(key);
    if (cached && cached.expires > Date.now()) return Promise.resolve(cached.svg);
    if (cached) { rendered.delete(key); renderedBytes -= cached.bytes; }
    if (inFlight.has(key)) return inFlight.get(key);
    const inputBytes = key.length * 2;
    if (inFlight.size >= 256 || inFlightBytes + inputBytes > CACHE_LIMIT) return Promise.reject(new Error('Local render queue is full. Retry after current diagrams finish.'));
    inFlightBytes += inputBytes;
    const task = renderUncached(engine, source, options).then(svg => {
      const bytes = inputBytes + svg.length * 2;
      if (bytes <= CACHE_LIMIT) {
        while (rendered.size >= 32 || renderedBytes + bytes > CACHE_LIMIT) {
          const oldest = rendered.keys().next().value;
          renderedBytes -= rendered.get(oldest).bytes; rendered.delete(oldest);
        }
        rendered.set(key, { svg, bytes, expires: Date.now() + 60000 }); renderedBytes += bytes;
      }
      return svg;
    }).finally(() => { inFlight.delete(key); inFlightBytes -= inputBytes; });
    inFlight.set(key, task); return task;
  }
  root.MarkdownPrivateRenderers = Object.freeze({ render });
})(globalThis);
