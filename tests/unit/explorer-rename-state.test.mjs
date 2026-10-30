import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
function functionSource(start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first);
  return source.slice(first, last);
}
function folderRename() {
  const context = {
    documentOrganization: { folders: [{ id: 'folder', name: 'Before', workspaceId: 'workspace_default', parentFolderId: null }] },
    saves: 0, options: null,
    renderDocumentSidebar() {}, announceToScreenReader() {}
  };
  context.getFolderById = id => context.documentOrganization.folders.find(folder => folder.id === id);
  context.openExplorerRename = options => { context.options = options; };
  context.saveDocumentOrganization = () => { context.saves++; };
  vm.runInNewContext(functionSource('  function renameFolder(', '  function deleteFolder('), context);
  context.renameFolder('folder');
  return context;
}

test('folder rename survives an organization merge replacing an unchanged folder object', () => {
  const context = folderRename();
  const previous = context.getFolderById('folder');
  context.documentOrganization.folders = [{ ...previous, expanded: false }];
  assert.equal(context.options.validate('After'), '');
  context.options.onConfirm('After');
  assert.equal(context.getFolderById('folder').name, 'After');
  assert.equal(previous.name, 'Before');
  assert.equal(context.saves, 1);
});

test('folder rename refuses to overwrite a concurrent rename, move or removal', () => {
  for (const change of [
    folder => { folder.name = 'Changed elsewhere'; },
    folder => { folder.workspaceId = 'other_workspace'; },
    folder => { folder.parentFolderId = 'other_parent'; },
    (_, context) => { context.documentOrganization.folders = []; }
  ]) {
    const context = folderRename();
    change(context.getFolderById('folder'), context);
    assert.throws(() => context.options.onConfirm('After'), error => error.userMessage === 'Item changed. Start Rename again.');
    assert.equal(context.saves, 0);
  }
});

test('confirming the unchanged folder name does not start persistence', () => {
  const context = folderRename();
  context.options.onConfirm('Before');
  assert.equal(context.saves, 0);
});

test('linked rename preserves POSIX backslashes and accepts Windows drive and UNC separators', () => {
  const context = {};
  vm.runInNewContext(functionSource('  function getLinkedRenameParts(', '  async function renameLinkedOriginal('), context);
  for (const [os, path, parent, name] of [
    ['Windows', 'C:\\Notes\\file.md', 'C:/Notes/', 'file.md'],
    ['Windows', '\\\\server\\share\\file.md', '//server/share/', 'file.md'],
    ['Windows', 'C:/Notes\\file.md', 'C:/Notes/', 'file.md'],
    ['Linux', '/home/notes\\literal/file\\name.md', '/home/notes\\literal/', 'file\\name.md'],
    ['Darwin', '/file.md', '/', 'file.md'],
    ['Linux', 'nested\\literal/file.md', 'nested\\literal/', 'file.md']
  ]) {
    context.NL_OS = os;
    const parts = context.getLinkedRenameParts(path);
    assert.equal(parts.parent, parent);
    assert.equal(parts.name, name);
  }
});
