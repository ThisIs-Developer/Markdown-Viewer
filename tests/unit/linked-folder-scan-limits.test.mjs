import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function scanner(overrides = {}) {
  const source = readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
  const start = source.indexOf('  const LINKED_FOLDER_SCAN_LIMITS =');
  const end = source.indexOf('  async function reloadLinkedDocument(', start);
  const reads = [];
  const filesystem = {
    readDirectory: async () => [{ entry: 'notes.md', type: 'FILE' }],
    getJoinedPath: async (...parts) => parts.join('/'),
    getStats: async () => ({ size: 4, isDirectory: false }),
    readFile: async (path, options) => { reads.push({ path, options }); return 'test'; },
    ...overrides
  };
  const context = { Neutralino: { filesystem }, TextEncoder, Date,
    normalizeLinkedSourcePath: value => value.replace(/\\/g, '/').toLowerCase(),
    normalizeLinkedRelativePath: value => value };
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../../native-markdown-source.js', import.meta.url), 'utf8'), context);
  const collect = vm.runInContext(source.slice(start, end) + '\ncollectMarkdownFilesFromFolder;', context);
  return { collect, reads, filesystem };
}

test('stages byte-bounded reads including Unicode before returning results', async () => {
  const s = scanner({ readFile: async (path, options) => {
    assert.equal(options.size, 20 * 1024 * 1024 + 1);
    return 'Ελληνικά';
  } });
  const files = await s.collect('C:/Notes');
  assert.equal(files[0].content, 'Ελληνικά');
});

test('rejects oversized and unknown-size files before reading content', async () => {
  for (const size of [20 * 1024 * 1024 + 1, undefined, -1, Infinity]) {
    const s = scanner({ getStats: async () => ({ size }) });
    await assert.rejects(s.collect('C:/Notes'), error => error.code === 'LINKED_SCAN_LIMIT');
    assert.equal(s.reads.length, 0);
  }
});

test('checks file count at the root, total bytes and directory entry breadth', async () => {
  for (const [count, size] of [[10001, 0], [11, 20 * 1024 * 1024], [40001, 0]]) {
    const s = scanner({
      readDirectory: async () => Array.from({ length: count }, (_, i) => ({ entry: i + '.md', type: 'FILE' })),
      getStats: async () => ({ size })
    });
    await assert.rejects(s.collect('C:/Notes'), error => error.code === 'LINKED_SCAN_LIMIT');
    assert.equal(s.reads.length, 0);
  }
});

test('bounds expanding junction-like recursion and repeated normalized paths', async () => {
  let visits = 0;
  const s = scanner({ readDirectory: async () => { visits++; return [{ entry: 'cycle', type: 'DIRECTORY' }]; } });
  await assert.rejects(s.collect('C:/Notes'), /nesting/);
  assert.equal(visits, 33);
  const repeated = scanner({
    readDirectory: async () => [{ entry: 'cycle', type: 'DIRECTORY' }],
    getJoinedPath: async () => 'c:/notes'
  });
  await assert.rejects(repeated.collect('C:/Notes'), /Repeated folder/);
});

test('bounds directory count independently of depth and Markdown count', async () => {
  const s = scanner({ readDirectory: async path => path === 'C:/Notes'
    ? Array.from({ length: 2000 }, (_, i) => ({ entry: 'dir' + i, type: 'DIRECTORY' })) : [] });
  await assert.rejects(s.collect('C:/Notes'), /2,000 directories/);
});

test('cancels between native calls and stops reading subsequent files', async () => {
  let live = true;
  const s = scanner({ readDirectory: async () => { live = false; return [{ entry: 'notes.md', type: 'FILE' }]; } });
  await assert.rejects(s.collect('C:/Notes', () => live), error => error.code === 'LINKED_SCAN_CANCELLED');
  assert.equal(s.reads.length, 0);
});

test('rejects unsafe entry names and preserves ignored directory behavior', async () => {
  for (const entry of ['../escape.md', 'C:escape.md', 'nested\\escape.md']) {
    const s = scanner({ readDirectory: async () => [{ entry, type: 'FILE' }] });
    await assert.rejects(s.collect('C:/Notes'), /Unsafe folder entry/);
    assert.equal(s.reads.length, 0);
  }
  const s = scanner({ readDirectory: async () => [{ entry: '.git', type: 'DIRECTORY' }, { entry: 'node_modules', type: 'DIRECTORY' }] });
  assert.equal((await s.collect('C:/Notes')).length, 0);
});

test('rejects files that grow after stat without returning a truncated draft', async () => {
  const s = scanner({ readFile: async () => 'x'.repeat(20 * 1024 * 1024 + 1) });
  await assert.rejects(s.collect('C:/Notes'), /20 MiB/);
});

test('background exclusions do not read or stat removed links', async () => {
  const s = scanner({ getStats: async () => { throw new Error('excluded file must not be accessed'); } });
  assert.equal((await s.collect('C:/Notes', () => true, () => false)).length, 0);
  assert.equal(s.reads.length, 0);
});

test('stops after the cooperative deadline once pending I/O returns', async () => {
  const original = Date.now;
  let now = 0;
  try {
    Date.now = () => now;
    const s = scanner({ readDirectory: async () => { now = 60000; return []; } });
    await assert.rejects(s.collect('C:/Notes'), /60 seconds/);
  } finally { Date.now = original; }
});

test('accepts the expanded file count and byte budgets at their new boundaries', async () => {
  for (const [count, size] of [[10000, 0], [10, 20 * 1024 * 1024]]) {
    const s = scanner({
      readDirectory: async () => Array.from({ length: count }, (_, i) => ({ entry: i + '.md', type: 'FILE' })),
      getStats: async () => ({ size })
    });
    // Metadata simulates large sources without allocating hundreds of MiB.
    assert.equal((await s.collect('C:/Notes')).length, count);
  }
});

test('accepts 40,000 non-Markdown entries and 2,000 directories including root', async () => {
  const broad = scanner({ readDirectory: async () => Array.from({ length: 40000 }, (_, i) => ({ entry: i + '.txt', type: 'FILE' })) });
  assert.equal((await broad.collect('C:/Notes')).length, 0);
  const nested = scanner({ readDirectory: async path => path === 'C:/Notes'
    ? Array.from({ length: 1999 }, (_, i) => ({ entry: 'dir' + i, type: 'DIRECTORY' })) : [] });
  assert.equal((await nested.collect('C:/Notes')).length, 0);
});

test('permits discovery past the old deadline but before 60 seconds', async () => {
  const original = Date.now;
  let now = 0;
  try {
    Date.now = () => now;
    const s = scanner({ readDirectory: async () => { now = 59999; return []; } });
    assert.equal((await s.collect('C:/Notes')).length, 0);
  } finally { Date.now = original; }
});
