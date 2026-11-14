import { build } from 'esbuild';
import { Miniflare, Log, LogLevel } from 'miniflare';
import { fileURLToPath } from 'node:url';

export async function sharingRuntime() {
  const result = await build({ entryPoints: [fileURLToPath(new URL('./encrypted-sharing-worker.mjs', import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent' });
  const runtime = new Miniflare({ modules: true, script: result.outputFiles[0].text, compatibilityDate: '2026-07-02',
    host: '127.0.0.1', port: 0, kvNamespaces: ['SHARE_KV'],
    durableObjects: { LIVE_ROOMS: { className: 'TestLiveRoom', useSQLite: true } },
    log: new Log(LogLevel.ERROR) });
  await runtime.ready;
  return runtime;
}
