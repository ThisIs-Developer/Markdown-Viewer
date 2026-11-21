import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
const functions = ['getPublicAppBaseUrl', 'normalizeLiveAccessMode',
  'getLiveCapabilityForAccess', 'getSafeLiveTitle', 'buildLiveInviteUrl'];
const code = functions.map(name => {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, `Missing ${name}`);
  return source.slice(start, source.indexOf('\n  }', start) + 4);
}).join('\n');

const publicBase = 'https://markdownviewer.pages.dev/';
const cases = [
  { name: 'IPv4 Docker loopback', url: 'http://127.0.0.1:18081/', base: publicBase },
  { name: 'localhost Docker', url: 'http://localhost:8080/', base: publicBase },
  { name: 'local subpath', url: 'http://127.0.0.1:8080/editor/', base: publicBase },
  { name: 'local file', url: 'file:///app/index.html', base: publicBase },
  { name: 'desktop runtime', url: 'http://desktop.internal:8000/', desktop: true, base: publicBase },
  { name: 'public web', url: publicBase, base: publicBase },
  { name: 'custom deployment', url: 'https://markdown.example/editor/', base: 'https://markdown.example/editor/' }
];

for (const scenario of cases) {
  for (const mode of ['view', 'edit']) {
    test(`${scenario.name} creates a reachable ${mode} invitation without changing room credentials`, () => {
      const target = {
        window: { location: new URL(scenario.url) },
        LIVE_SHARE_ACCESS_VIEW: 'view', LIVE_SHARE_ACCESS_EDIT: 'edit',
        ...(scenario.desktop ? { Neutralino: {} } : {})
      };
      vm.createContext(target);
      vm.runInContext(code, target);
      const capabilities = { host: 'host-only', view: 'view-only', edit: 'edit-only' };
      const invite = new URL(target.buildLiveInviteUrl('room-test', 'secret-test', ' Notes & ideas ', mode, capabilities));
      assert.equal(invite.origin + invite.pathname, scenario.base);
      const params = new URLSearchParams(invite.hash.slice(1));
      assert.equal(params.get('live'), 'room-test.secret-test');
      assert.equal(params.get('title'), 'Notes & ideas');
      assert.equal(params.get('access'), mode);
      assert.equal(params.get('role'), mode);
      assert.equal(params.get('cap'), capabilities[mode]);
      assert.equal(invite.href.includes(capabilities.host), false);
    });
  }
}
