import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const context = { TextEncoder, ArrayBuffer };
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

test('native media reads are bounded and reject unsafe sizes before reading', async () => {
  for (const stats of [{}, { size: -1 }, { size: 9 }, { size: 4, isDirectory: true }, { size: 4, isFile: false }]) {
    let reads = 0;
    await assert.rejects(reader.readBinary({ getStats: async () => stats, readBinaryFile: async () => { reads++; } }, 'x.gif', 8));
    assert.equal(reads, 0);
  }
  const data = new ArrayBuffer(4);
  assert.equal(await reader.readBinary({ getStats: async () => ({ size: 4, isFile: true }),
    readBinaryFile: async (_, options) => { assert.equal(options.size, 9); return data; } }, 'x.gif', 8), data);
});

test('native media rejects growth and unexpected binary responses', async () => {
  let stats = 0;
  await assert.rejects(reader.readBinary({ getStats: async () => ({ size: ++stats === 1 ? 4 : 9 }),
    readBinaryFile: async () => new ArrayBuffer(4) }, 'x.gif', 8));
  for (const data of [new ArrayBuffer(9), 'unbounded text', null]) {
    await assert.rejects(reader.readBinary({ getStats: async () => ({ size: 4 }), readBinaryFile: async () => data }, 'x.gif', 8));
  }
});
