import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const source = fs.readFileSync(new URL('../../desktop-app/resources/js/main.js', import.meta.url), 'utf8');
function harness({ native = true, custom = true, os = 'Windows', args = [] } = {}) {
  const listeners = new Map();
  const calls = [], opened = [];
  const window = {
    MARKDOWN_VIEWER_DESKTOP_RUNTIME_FEATURES: { nativeSingleInstance: custom },
    addEventListener(name, listener) {
      const previous = listeners.get(name);
      listeners.set(name, (...args) => { previous?.(...args); listener(...args); });
    },
    NL_IMPORT_EXTERNAL_FILE: async (content, name, filePath) => { opened.push(filePath); }
  };
  const context = vm.createContext({ window, console, sessionStorage: { getItem: () => null }, NL_OS: os, NL_ARGS: args, NL_CWD: 'C:/Startup',
    ...(native ? { NL_PORT: 1, NL_TOKEN: 'test', Neutralino: {
      init() { calls.push('init'); },
      events: { on(name, listener) { calls.push(name); listeners.set(name, listener); } },
      filesystem: {
        getJoinedPath: async (...parts) => path.win32.join(...parts),
        getNormalizedPath: async file => path.win32.normalize(file).replaceAll('\\', '/'),
        getStats: async () => ({ size: 1 }), readFile: async () => '# test'
      },
      window: { isMinimized: async () => false, show: async () => {}, focus: async () => {} }
    } } : {}) });
  vm.runInContext(source, context);
  return { context, listeners, calls, opened };
}

test('registers secondInstance before init, only in opt-in Windows desktop', () => {
  const desktop = harness();
  assert.ok(desktop.calls.indexOf('secondInstance') < desktop.calls.indexOf('init'));
  for (const options of [{ native: false }, { custom: false }, { os: 'Linux' }]) {
    assert.equal(harness(options).listeners.has('secondInstance'), false);
  }
  assert.equal(source.includes('startSingleInstanceInbox'), false);
});

test('queues startup launches, resolves cwd, filters options and preserves file order', async () => {
  const h = harness();
  const first = h.listeners.get('secondInstance')({ detail: {
    args: ['viewer.exe', '--config=ignore.md', 'δοκιμή one.md', 'sub/second.markdown', 'image.png'], cwd: 'C:/Examples'
  } });
  const second = h.listeners.get('secondInstance')({ detail: { args: ['D:/Other/third.md'], cwd: 'C:/Elsewhere' } });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(h.opened, []);
  h.listeners.get('markdown-viewer:ready')();
  await Promise.all([first, second]);
  assert.deepEqual(h.opened, ['C:/Examples/δοκιμή one.md', 'C:/Examples/sub/second.markdown', 'D:/Other/third.md']);
});

test('initial file finishes before queued secondary launch', async () => {
  const h = harness({ args: ['C:/Original/initial.md'] });
  const pending = h.listeners.get('secondInstance')({ detail: { args: ['next.md'], cwd: 'C:/Secondary' } });
  h.listeners.get('markdown-viewer:ready')();
  await pending;
  assert.deepEqual(h.opened, ['C:/Original/initial.md', 'C:/Secondary/next.md']);
});

test('handles rooted and UNC paths without resolving against primary cwd', async () => {
  const h = harness();
  const paths = await vm.runInContext("resolveLaunchMarkdownPaths(['\\\\root.md', '\\\\\\\\server\\\\share\\\\file.md', 'C:ambiguous.md'], 'D:/Folder')", h.context);
  assert.deepEqual(Array.from(paths), ['D:/root.md', '//server/share/file.md']);
});

test('opens every initial Markdown argument after the editor becomes ready', async () => {
  const h = harness({ args: ['first.md', 'sub/second.markdown', '--config=ignored.md'] });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(h.opened, []);
  h.listeners.get('markdown-viewer:ready')();
  await vm.runInContext('initialFileLoad', h.context);
  assert.deepEqual(h.opened, ['C:/Startup/first.md', 'C:/Startup/sub/second.markdown']);
});
