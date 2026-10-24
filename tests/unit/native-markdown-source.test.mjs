import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const context = { TextEncoder };
vm.runInNewContext(readFileSync(new URL('../../native-markdown-source.js', import.meta.url), 'utf8'), context);
const reader = context.MarkdownNativeSourceReader;

test('rejects oversized, unknown and non-regular sources before a read', async () => {
  for (const stats of [{ size: reader.maxBytes + 1 }, {}, { size: -1 }, { size: 1, isFile: false }, { size: 1, isDirectory: true }]) {
    let read = false;
    await assert.rejects(reader.read({ getStats: async () => stats, readFile: async () => { read = true; } }, 'x.md'));
    assert.equal(read, false);
  }
});

test('bounded read accepts Unicode and detects file growth after the first stat', async () => {
  const content = 'Δοκιμή'; let calls = 0;
  const api = { getStats: async () => ({ size: new TextEncoder().encode(content).byteLength }),
    readFile: async (_, options) => { assert.equal(options.size, reader.maxBytes + 1); return content; } };
  assert.equal(await reader.read(api, 'x.md'), content);
  api.getStats = async () => ({ size: ++calls === 1 ? 4 : reader.maxBytes + 1 });
  await assert.rejects(reader.read(api, 'x.md'), /20 MiB/);
});

test('UTF-8 bytes, not characters, bound reads and outgoing Saves', async () => {
  const huge = 'α'.repeat(reader.maxBytes / 2 + 1);
  assert.throws(() => reader.assertContent(huge), /20 MiB/);
  await assert.rejects(reader.read({ getStats: async () => ({ size: 1 }), readFile: async () => huge }, 'x.md'), /20 MiB/);
});
