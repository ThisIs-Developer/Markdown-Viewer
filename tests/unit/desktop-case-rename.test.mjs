import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import mock from '../helpers/desktop-filesystem.js';

const source = await fs.readFile(new URL('../../workspace-storage.js', import.meta.url), 'utf8');

async function setup(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'markdown-case-rename-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('markdown-case-rename-'));
    await fs.rm(root, {recursive:true, force:true});
  });
  const target = {crypto:webcrypto, TextEncoder, console, NL_OS:process.platform === 'win32' ? 'Windows' : 'Linux',
    localStorage:{getItem:()=>null, removeItem(){}}};
  target.window = target; target.self = target;
  mock.installDesktopFilesystem(target);
  target.Neutralino.os.getPath = async () => root;
  target.Neutralino.filesystem = {
    getJoinedPath: async (...parts) => path.join(...parts).replaceAll('\\', '/'),
    getStats: async file => {
      try {
        const stats = await fs.stat(file);
        return {isFile:stats.isFile(), isDirectory:stats.isDirectory(), size:stats.size, modifiedAt:stats.mtimeMs};
      } catch (error) {
        if (error.code === 'ENOENT') error.code = 'NE_FS_NOPATHE';
        throw error;
      }
    },
    createDirectory: file => fs.mkdir(file),
    readDirectory: async file => (await fs.readdir(file, {withFileTypes:true})).map(entry => ({
      entry:entry.name, type:entry.isDirectory() ? 'DIRECTORY' : 'FILE'
    })),
    readFile: file => fs.readFile(file, 'utf8'),
    writeFile: (file, content) => fs.writeFile(file, content),
    copy: (from, to) => fs.copyFile(from, to),
    move: (from, to) => fs.rename(from, to),
    remove: file => fs.unlink(file)
  };
  vm.runInNewContext(source, target);
  const storage = new target.MarkdownWorkspaceStorage();
  await storage.init();
  return {target, storage};
}

for (const unloaded of [false, true]) {
  test(`case-only document rename preserves ${unloaded ? 'unloaded' : 'loaded'} content on the real filesystem`, async t => {
    const {target, storage} = await setup(t);
    let tab = {id:'case-rename', title:'Notes', content:'# retained', contentLoaded:true, workspaceId:'workspace_default'};
    await storage.saveDocuments([tab], {folders:[]}, {forceContent:true});
    if (unloaded) tab = (await storage.listDocumentMetadata()).find(item => item.id === tab.id);
    tab.title = 'notes';
    await storage.saveDocuments([tab], {folders:[]}, {changedIds:[tab.id]});
    assert.ok((await fs.readdir(path.join(storage.vaultPath, 'Workspace'))).some(name => name.startsWith('notes--')));
    const reopened = new target.MarkdownWorkspaceStorage();
    await reopened.init();
    assert.equal((await reopened.listDocumentMetadata()).find(item => item.id === tab.id).title, 'notes');
    assert.equal(await reopened.loadDocumentContent(tab.id), '# retained');
    tab.content = '# edited after rename'; tab.contentLoaded = true;
    await storage.saveDocuments([tab], {folders:[]}, {changedIds:[tab.id]});
    assert.equal(await reopened.loadDocumentContent(tab.id, {fresh:true}), '# edited after rename');
  });
}

test('case-only containing-folder rename keeps lazy document content available after restart', async t => {
  const {target, storage} = await setup(t);
  const folder = {id:'case-folder', name:'Folder', workspaceId:'workspace_default', parentFolderId:null};
  const organization = {folders:[folder]};
  const tab = {id:'case-child', title:'Notes', content:'# nested', contentLoaded:true,
    workspaceId:'workspace_default', folderId:folder.id};
  await storage.saveDocumentOrganization(organization);
  await storage.saveDocuments([tab], organization, {forceContent:true});
  const lazy = (await storage.listDocumentMetadata()).find(item => item.id === tab.id);
  folder.name = 'folder';
  await storage.saveDocumentOrganization(organization);
  await storage.saveDocuments([lazy], organization, {changedIds:[lazy.id]});
  const reopened = new target.MarkdownWorkspaceStorage(); await reopened.init();
  assert.equal(await reopened.loadDocumentContent(tab.id), '# nested');
  assert.equal((await reopened.getDocumentOrganization()).folders[0].name, 'folder');
});
