import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
function setup(os = 'Windows', filesystem = {}) {
  const c = { window: { NL_OS: os }, workspaceStorage: { vaultPath: 'C:/Documents/Vault' }, Neutralino: { filesystem } };
  const start = source.indexOf('  function normalizeLinkedSourcePath(');
  const end = source.indexOf('  function findTabBySourcePath(', start);
  vm.runInNewContext(source.slice(start, end) + '\nthis.check = assertOutsideManagedVault;', c);
  return c;
}
test('managed bodies, internal metadata, root and dot aliases are rejected', async () => {
  const c = setup();
  for (const path of ['C:/Documents/Vault', 'c:/documents/vault/.markdown-viewer/index.json', 'C:/Documents/Vault/Workspace/a.md', 'C:/Documents/Else/../Vault/a.md']) {
    await assert.rejects(c.check(path), /outside the managed Vault/);
  }
  await c.check('C:/Documents/Vault-other/a.md');
  await c.check('C:/Documents/Original/a.md');
});
test('native normalized identities and UNC Windows case are checked', async () => {
  const c = setup('Windows', { getNormalizedPath: async p => p === 'alias' ? 'C:/Documents/Vault/a.md' : p });
  await assert.rejects(c.check('alias'), /outside/);
  c.workspaceStorage.vaultPath = '\\\\Server\\Share\\Vault';
  await assert.rejects(c.check('\\\\server\\share\\VAULT\\a.md'), /outside/);
});
test('POSIX paths retain case and unavailable normalization fails closed', async () => {
  const c = setup('Darwin'); c.workspaceStorage.vaultPath = '/Users/a/Vault';
  await assert.rejects(c.check('/Users/a/Vault/a.md'), /outside/);
  await c.check('/Users/a/vault/a.md');
  c.Neutralino.filesystem.getNormalizedPath = async () => { throw Error('path denied'); };
  await assert.rejects(c.check('/external/a.md'), /path denied/);
});

test('only an IndexedDB backend can omit a physical Vault root', async () => {
  const c = setup(); c.workspaceStorage = { desktop: false, vaultPath: null };
  await c.check('C:/external/a.md');
  c.workspaceStorage.desktop = true;
  await assert.rejects(c.check('C:/external/a.md'), /not ready/);
});
