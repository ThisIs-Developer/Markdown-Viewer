import test from 'node:test';
import assert from 'node:assert/strict';
import drop from '../../browser-drop-source.js';

function file(name, content = '# markdown') {
  return { name, isFile: true, file: resolve => resolve(new File([content], name)) };
}
function folder(name, children) {
  return { name, isDirectory: true, createReader() {
    let index = 0;
    return { readEntries(resolve) { resolve(children.slice(index, index += 100)); } };
  } };
}
const snapshot = entry => [{ entry }];

test('capture retains browser entries and files synchronously without duplicate FileList imports', () => {
  const entry = folder('Notes', []);
  const transfer = { items: [{ kind: 'file', webkitGetAsEntry: () => entry, getAsFile: () => null }], files: [new File([], 'Notes')] };
  const captured = drop.capture(transfer);
  transfer.items.length = 0;
  assert.equal(captured.length, 1);
  assert.equal(captured[0].entry, entry);
  assert.deepEqual(drop.describe(captured), [{ name: 'Notes', directory: true, unknown: false }]);
});

test('protected hover payload stays unknown and FileList fallback still works', () => {
  assert.deepEqual(drop.describe(drop.capture({ items: [{ kind: 'file', getAsFile: () => null }] })), [{ name: '', directory: false, unknown: true }]);
  assert.equal(drop.capture({ files: [new File(['body'], 'one.md')] })[0].file.name, 'one.md');
});

test('drains directory batches and preserves nested and empty folders without importing media or dependencies', async () => {
  const entry = folder('δοκιμή', [...Array.from({ length: 101 }, (_, i) => file(i + '.md')),
    folder('Sub', [file('nested.markdown')]), folder('Empty', []), file('image.png'),
    folder('.git', [file('secret.md')]), folder('node_modules', [file('dependency.md')])]);
  const result = await drop.collectFolders(snapshot(entry));
  assert.equal(result.files.length, 102);
  assert.deepEqual(result.files.at(-1).path, ['δοκιμή', 'Sub', 'nested.markdown']);
  assert.equal(result.directories.length, 3);
});

test('read failure rejects the staged operation', async () => {
  const bad = { name: 'broken.md', isFile: true, file: (_, reject) => reject(new Error('denied')) };
  await assert.rejects(drop.collectFolders(snapshot(folder('Root', [file('good.md'), bad]))), /denied/);
});

test('rejects unsafe names, recursive graphs, binary Markdown and oversized content', async () => {
  await assert.rejects(drop.collectFolders(snapshot(folder('Root', [file('../bad.md')]))), /Invalid/);
  const loop = folder('Loop', []); loop.createReader = () => ({ readEntries: resolve => resolve([loop]) });
  await assert.rejects(drop.collectFolders(snapshot(loop)), /limit/);
  await assert.rejects(drop.collectFolders(snapshot(folder('Root', [file('bad.md', '\0binary')]))), /Binary/);
  await assert.rejects(drop.collectFolders(snapshot(folder('Root', [file('big.md', '12345')])), { limits: { fileBytes: 4 } }), /size/);
});

test('bounds file count, aggregate bytes, depth, directories and traversal entries', async () => {
  const root = snapshot(folder('Root', [file('a.md', '123'), file('b.md', '456'), folder('Nested', [])]));
  for (const limits of [{ files: 1 }, { totalBytes: 5 }, { depth: 0 }, { directories: 1 }, { entries: 1 }]) {
    await assert.rejects(drop.collectFolders(root, { limits }));
  }
});

test('checks cancellation after asynchronous reads before accepting the result', async () => {
  let active = true;
  const entry = file('a.md'); entry.file = resolve => { active = false; resolve(new File(['body'], 'a.md')); };
  await assert.rejects(drop.collectFolders(snapshot(folder('Root', [entry])), { canContinue: () => active }), /cancelled/);
});

test('times out a filesystem callback that never completes', async () => {
  const entry = folder('Root', []); entry.createReader = () => ({ readEntries() {} });
  await assert.rejects(drop.collectFolders(snapshot(entry), { limits: { milliseconds: 15 } }), /timed out/);
});
