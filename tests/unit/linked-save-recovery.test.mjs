import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
function extract(name) {
  let start = source.indexOf(`  async function ${name}(`);
  if (start < 0) start = source.indexOf(`  function ${name}(`);
  return source.slice(start, source.indexOf('\n  }', start) + 4);
}
function setup() {
  let text = '# old';
  const api = {
    getStats: async () => ({ isFile: true, size: new TextEncoder().encode(text).byteLength }), readFile: async () => text,
    writeFile: async (_, value) => { text = value; }
  };
  const ctx = { Neutralino: { filesystem: api }, NL_OS: 'Windows', TextEncoder };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(new URL('../../native-markdown-source.js', import.meta.url), 'utf8'), ctx);
  vm.runInContext(['getNativeParentPath','getNativePathName','readNativeMarkdownSource','readLinkedSourceForSave','writeLinkedSourceWithDraftRecovery'].map(extract).join('\n'), ctx);
  return { api, ctx, text: () => text, save: () => ctx.writeLinkedSourceWithDraftRecovery('C:/Docs/test.md','# new','# old',() => true) };
}
test('linked source writes in place without copy, move or remove APIs', async () => {
  const s = setup(); await s.save(); assert.equal(s.text(), '# new');
});
test('external change before write is rejected', async () => {
  const s = setup(); s.api.readFile = async () => '# external';
  await assert.rejects(s.save(), e => e.code === 'LINKED_SOURCE_CHANGED');
  assert.equal(s.text(), '# old');
});
test('partial write warns about original and persisted draft, without rollback', async () => {
  const s = setup(); const write = s.api.writeFile;
  s.api.writeFile = async p => { await write(p,'partial'); throw new Error('Disk full'); };
  await assert.rejects(s.save(), /original may be incomplete.*draft was saved/);
  assert.equal(s.text(), 'partial');
});
test('verification mismatch does not announce success', async () => {
  const s = setup(); s.api.writeFile = async () => {};
  await assert.rejects(s.save(), /could not be verified/);
});
test('stat failure with a still-present directory entry is not missing', async () => {
  const s = setup(); s.api.getStats = async () => { throw {code:'NE_FS_NOPATHE'}; };
  s.api.readDirectory = async () => [{entry:'test.md'}];
  await assert.rejects(s.ctx.readLinkedSourceForSave('C:/Docs/test.md'), /cannot be inspected/);
});
test('read permission failure is not missing', async () => {
  const s = setup(); s.api.readFile = async () => { throw new Error('Access denied'); };
  await assert.rejects(s.ctx.readLinkedSourceForSave('C:/Docs/test.md'), /Access denied/);
});
