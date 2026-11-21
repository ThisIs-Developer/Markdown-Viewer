import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const workerSource = fs.readFileSync(new URL('../../sw.js', import.meta.url), 'utf8');
const { version } = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

function workerHarness(base = 'https://example.test/') {
  const listeners = {};
  const entries = new Map();
  const requests = [];
  const cacheKey = request => new URL(typeof request === 'string' ? request : request.url, base).href;
  let fetchResponse = () => new Response('Current notes');
  const cache = {
    async match(request) { return entries.get(cacheKey(request))?.clone(); },
    async put(request, response) { entries.set(cacheKey(request), response.clone()); },
    async addAll(urls) {
      for (const url of urls) await this.put(url, new Response('Precached notes'));
    }
  };
  const context = {
    URL, Response, console,
    self: {
      location: new URL('sw.js', base),
      addEventListener(type, listener) { listeners[type] = listener; },
      skipWaiting() {},
      clients: { claim() {} }
    },
    caches: { async open() { return cache; } },
    async fetch(request, options) {
      requests.push({ url: cacheKey(request), options });
      return fetchResponse();
    }
  };
  vm.runInNewContext(workerSource, context);
  return {
    cache, requests,
    setResponse(callback) { fetchResponse = callback; },
    install() {
      let completion;
      listeners.install({ waitUntil(promise) { completion = promise; } });
      return completion;
    },
    fetch(url) {
      let response;
      listeners.fetch({ request: new Request(new URL(url, base)), respondWith(promise) { response = promise; } });
      return response;
    }
  };
}

for (const base of ['https://example.test/', 'https://example.test/viewer/']) {
  test(`release notes prefer fresh content over an existing cache at ${base}`, async () => {
    const worker = workerHarness(base);
    await worker.cache.put('RELEASE_NOTES', new Response('Previous release'));
    const response = await worker.fetch('RELEASE_NOTES');
    assert.equal(await response.text(), 'Current notes');
    assert.equal(worker.requests[0].options.cache, 'no-cache');
    assert.equal(await (await worker.cache.match('RELEASE_NOTES')).text(), 'Current notes');
  });
}

test('installation precaches the versioned request for a first offline launch', async () => {
  const worker = workerHarness();
  await worker.install();
  worker.setResponse(() => { throw new Error('Offline'); });
  const response = await worker.fetch('RELEASE_NOTES?v=' + version);
  assert.equal(await response.text(), 'Precached notes');
});

test('an offline request cannot reuse another version or the unversioned cache', async () => {
  const worker = workerHarness();
  await worker.cache.put('RELEASE_NOTES', new Response('Previous release'));
  await worker.cache.put('RELEASE_NOTES?v=old', new Response('Previous release'));
  worker.setResponse(() => { throw new Error('Offline'); });
  assert.equal((await worker.fetch('RELEASE_NOTES?v=' + version)).type, 'error');
});

test('a server failure falls back to the exact version without overwriting it', async () => {
  const worker = workerHarness();
  const url = 'RELEASE_NOTES?v=' + version;
  await worker.cache.put(url, new Response('Matching notes'));
  worker.setResponse(() => new Response('Unavailable', { status: 503 }));
  assert.equal(await (await worker.fetch(url)).text(), 'Matching notes');
  assert.equal(await (await worker.cache.match(url)).text(), 'Matching notes');
});
