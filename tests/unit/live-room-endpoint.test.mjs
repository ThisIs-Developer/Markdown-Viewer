import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
const extract = (start, next) => source.slice(source.indexOf('  function ' + start),
  source.indexOf('  function ' + next));
const functions = extract('getShareApiBaseUrl()', 'getCurrentShareMode()') +
  extract('getLiveRoomSocketUrl(', 'ensureLiveShareCompressionReady()');

function endpoint(href, override, desktop = false) {
  const location = new URL(href);
  const context = {
    window: { location, MARKDOWN_VIEWER_LIVE_ROOM_URL: override },
    URLSearchParams, normalizeLiveSocketRole: role => role,
    ...(desktop ? { Neutralino: {} } : {})
  };
  vm.createContext(context);
  vm.runInContext(functions, context);
  return context.getLiveRoomSocketUrl('room/test', 'test secret', { role: 'view', capability: 'test-cap' });
}

test('loopback Docker clients use the hosted secure relay', () => {
  for (const origin of ['http://localhost:8095/', 'http://127.0.0.1:8080/']) {
    const url = new URL(endpoint(origin));
    assert.equal(url.origin, 'wss://markdownviewer.pages.dev');
    assert.equal(url.pathname, '/live-room/room%2Ftest');
    assert.equal(url.searchParams.get('secret'), 'test secret');
    assert.equal(url.searchParams.get('role'), 'view');
  }
});
test('web deployments retain their same-origin relay', () => {
  assert.equal(new URL(endpoint('https://example.test/editor')).origin, 'wss://example.test');
});
test('file and desktop clients retain the hosted relay', () => {
  assert.equal(new URL(endpoint('file:///C:/index.html')).origin, 'wss://markdownviewer.pages.dev');
  assert.equal(new URL(endpoint('http://desktop.local/', undefined, true)).origin, 'wss://markdownviewer.pages.dev');
});
test('an explicit self-hosted relay takes precedence', () => {
  const url = new URL(endpoint('http://localhost:8095/', 'http://127.0.0.1:8787/live-room/'));
  assert.equal(url.origin, 'ws://127.0.0.1:8787');
  assert.equal(url.pathname, '/live-room/room%2Ftest');
});

