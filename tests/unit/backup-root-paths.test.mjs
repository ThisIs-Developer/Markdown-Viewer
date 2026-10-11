import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the actual shared ZIP path validator without exposing app internals.
const source = readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
const validator = source.slice(source.indexOf('  function normalizeTrustedBackupPath('), source.indexOf('  async function sha256Text('));
const normalize = vm.runInNewContext(validator + '\nnormalizeTrustedBackupPath;');
const roots = ['Workspace/', 'Linked Workspace/'];

test('normal ZIP documents allow only Vault and linked recovery roots', () => {
  for (const path of ['Workspace/notes.md', 'Workspace/sub/notes.md', 'Linked Workspace/draft.md']) {
    assert.equal(normalize(path, roots), path);
  }
  assert.equal(normalize('Linked Workspace\\guide.md', roots), 'Linked Workspace/guide.md');
  for (const path of ['Secret Workspace/objects/plain.md', '.markdown-viewer/index.json', 'WorkspaceExtra/a.md']) {
    assert.throws(() => normalize(path, roots), /unsafe or invalid/);
  }
});

test('ZIP root expansion does not admit absolute, traversal or stream paths', () => {
  for (const path of ['/Workspace/a.md', '\\Workspace\\a.md', 'C:/Workspace/a.md', '//host/Workspace/a.md',
    'Workspace/../a.md', 'Linked Workspace/./a.md', 'Workspace//a.md', 'Workspace/',
    'Linked Workspace/a.md:stream', 'Linked Workspace/a\u0000.md']) {
    assert.throws(() => normalize(path, roots), /unsafe or invalid/);
  }
  assert.equal(normalize('Secret Workspace/objects/a.mvault', 'Secret Workspace/objects/'), 'Secret Workspace/objects/a.mvault');
  assert.throws(() => normalize('Linked Workspace/a.mvault', 'Secret Workspace/objects/'), /unsafe or invalid/);
});
