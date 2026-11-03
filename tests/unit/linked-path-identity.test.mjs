import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
const start = source.indexOf('  function normalizeLinkedSourcePath(');
const end = source.indexOf('\n  async function hashLinkedSourceContent(', start);
function harness(os) {
  const context = { window: { NL_OS: os }, tabs: [] };
  vm.runInNewContext(source.slice(start, end) + '\nthis.normalize = normalizeLinkedSourcePath; this.find = findTabBySourcePath;', context);
  return context;
}

test('Windows UNC identity ignores case, separator style and trailing separators', () => {
  const h = harness('Windows');
  assert.equal(h.normalize('\\\\Server\\Share\\Notes.md'), h.normalize('//server/share/notes.md'));
  assert.equal(h.normalize('\\\\Server\\Share\\'), h.normalize('//SERVER/SHARE'));
  h.tabs.push({ id: 'existing', sourcePath: '\\\\Server\\Share\\Notes.md' });
  assert.equal(h.find('//server/share/NOTES.md').id, 'existing');
});

test('Windows drive identity remains case insensitive and distinct shares remain distinct', () => {
  const h = harness('Windows');
  assert.equal(h.normalize('C:/Notes.md'), h.normalize('c:\\notes.md'));
  assert.notEqual(h.normalize('//server/share/notes.md'), h.normalize('//server/other/notes.md'));
});

test('UNC-like paths and POSIX paths do not acquire Windows case folding on Linux or macOS', () => {
  for (const os of ['Linux', 'Darwin', undefined]) {
    const h = harness(os);
    assert.notEqual(h.normalize('//Server/Share/Notes.md'), h.normalize('//server/share/notes.md'));
    assert.notEqual(h.normalize('/home/Notes.md'), h.normalize('/home/notes.md'));
  }
});
