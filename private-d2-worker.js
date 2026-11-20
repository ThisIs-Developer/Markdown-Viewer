// D2 uses a nested worker, which browsers reject from an opaque iframe origin.
// This dedicated worker receives diagram text only, with outbound connections
// blocked in both worker layers, even on hosts without CSP response headers.
// No document keys or application state are passed.
import { lockNetwork } from './private-renderer-network.mjs';
lockNetwork(true);
globalThis.window = {};
const ready = import('@d2lang/d2').then(({ D2 }) => new D2());
let queue = Promise.resolve();
addEventListener('message', event => {
  const { id, source } = event.data || {};
  if (!Number.isSafeInteger(id) || typeof source !== 'string' || source.length > 8 * 1024 * 1024) return;
  queue = queue.then(async () => {
    try {
      const d2 = await ready;
      const result = await d2.compile(source);
      postMessage({ id, svg: await d2.render(result.diagram, result.renderOptions) });
    } catch (error) { postMessage({ id, error: String(error.message || error).slice(0, 300) }); }
  });
});
