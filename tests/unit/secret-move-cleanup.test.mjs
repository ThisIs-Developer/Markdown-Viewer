import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import mock from '../helpers/desktop-filesystem.js';

const source = fs.readFileSync(new URL('../../workspace-storage.js', import.meta.url), 'utf8');
const envelope = { iv: Buffer.alloc(12).toString('base64'), ciphertext: Buffer.alloc(32, 1).toString('base64') };
async function setup() {
  const target = { crypto: webcrypto, TextEncoder, atob, btoa, console, localStorage: { getItem: () => null, removeItem() {} } };
  target.window = target; target.self = target;
  mock.installDesktopFilesystem(target);
  vm.runInNewContext(source, target);
  const storage = new target.MarkdownWorkspaceStorage(); await storage.init();
  const tab = { id: 'moving', title: 'Moving', content: '# first', contentLoaded: true, workspaceId: 'workspace_default' };
  await storage.saveDocuments([tab], {}, { forceContent: true });
  tab.content = '# latest';
  await storage.saveDocuments([tab], {}, { forceContent: true });
  return { target, storage, tab };
}

test('Secret move cleanup requires a stored encrypted destination', async () => {
  const { storage, tab } = await setup();
  await assert.rejects(storage.deleteDocument(tab.id, { discardAfterSecretMove: true }), /encrypted record/);
  assert.equal(await storage.loadDocumentContent(tab.id), '# latest');
  assert.equal((await storage.listTrash()).length, 0);
});

test('Secret move removes the current plaintext and automatic history without creating a Trash copy', async () => {
  const { target, storage, tab } = await setup();
  await storage.saveSecretRecord(tab.id, envelope);
  assert.ok([...target.__desktopFiles].some(([path, body]) => path.includes('/history/') && body === '# first'));
  await storage.deleteDocument(tab.id, { expectedRevision: tab._storageRevision, discardAfterSecretMove: true });
  assert.equal((await storage.listDocumentMetadata()).length, 0);
  assert.equal((await storage.listTrash()).length, 0);
  assert.equal([...target.__desktopFiles.values()].some(body => body === '# first' || body === '# latest'), false);
  assert.equal((await storage.listSecretRecords())[0].envelope.ciphertext, envelope.ciphertext);
});

test('a revision conflict retains the Vault body and encrypted record', async () => {
  const { storage, tab } = await setup();
  await storage.saveSecretRecord(tab.id, envelope);
  await assert.rejects(storage.deleteDocument(tab.id, { expectedRevision: 0, discardAfterSecretMove: true }), error => error.name === 'WorkspaceConflictError');
  assert.equal(await storage.loadDocumentContent(tab.id), '# latest');
  assert.equal((await storage.listSecretRecords()).length, 1);
});

test('an uncommitted encrypted save cannot remove the existing plaintext', async () => {
  const script = fs.readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
  const start = script.indexOf('  async function moveDocumentToLocation(');
  const end = script.indexOf('  async function moveDocumentsToLocation(', start);
  const tab = { id: 'moving', workspaceId: 'workspace_default', folderId: null };
  let deletes = 0;
  const context = {
    tabs: [tab], SECRET_WORKSPACE_ID: 'workspace_secret', DEFAULT_WORKSPACE_ID: 'workspace_default',
    LINKED_WORKSPACE_GUIDE_KIND: 'linked-workspace-guide', isTemporaryDocument: () => false,
    isLinkedDocument: () => false, isSecretWorkspaceUnlocked: () => true,
    ensureTabContent: async () => '', activeTabId: null, secondarySplitTabId: null,
    setDocumentLocation(item, workspaceId) { item.workspaceId = workspaceId; return true; },
    flushSecretWorkspaceToStorage: async () => false, _flushTabsToStorage: async () => true,
    workspaceStorage: { deleteDocument: async () => { deletes++; } },
    saveDocumentOrganization() {}, renderDocumentSidebar() {}, alert() {}
  };
  vm.createContext(context); vm.runInContext(script.slice(start, end), context);
  assert.equal(await context.moveDocumentToLocation(tab.id, 'workspace_secret', null), false);
  assert.equal(deletes, 0);
  assert.equal(tab.workspaceId, 'workspace_default');
});

test('a failed Vault restore after cleanup retains the durable encrypted document', async () => {
  const script = fs.readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
  const start = script.indexOf('  async function moveDocumentToLocation(');
  const end = script.indexOf('  async function moveDocumentsToLocation(', start);
  const tab = { id: 'moving', workspaceId: 'workspace_default', content: '# retained', folderId: null };
  let encrypted = false;
  let plaintext = true;
  const context = {
    tabs: [tab], SECRET_WORKSPACE_ID: 'workspace_secret', DEFAULT_WORKSPACE_ID: 'workspace_default',
    LINKED_WORKSPACE_GUIDE_KIND: 'linked-workspace-guide', isTemporaryDocument: () => false,
    isLinkedDocument: () => false, isSecretWorkspaceUnlocked: () => true,
    ensureTabContent: async () => tab.content, activeTabId: null, secondarySplitTabId: null,
    setDocumentLocation(item, workspaceId) { item.workspaceId = workspaceId; return true; },
    getSecretDocumentStorageValue: item => ({ content: item.content }),
    flushSecretWorkspaceToStorage: async () => {
      encrypted = tab.workspaceId === 'workspace_secret';
      tab._secretPersistedSnapshot = JSON.stringify({ content: tab.content });
      return true;
    },
    _flushTabsToStorage: async () => tab.workspaceId === 'workspace_secret',
    workspacePersistenceChain: Promise.resolve(),
    workspaceStorage: { deleteDocument: async () => {
      plaintext = false;
      throw new Error('Cleanup failed after deletion');
    } },
    saveDocumentOrganization() {}, renderDocumentSidebar() {}, alert() {}
  };
  vm.createContext(context); vm.runInContext(script.slice(start, end), context);
  assert.equal(await context.moveDocumentToLocation(tab.id, 'workspace_secret', null), false);
  assert.equal(plaintext, false);
  assert.equal(encrypted, true);
  assert.equal(tab.workspaceId, 'workspace_secret');
  assert.equal(tab.content, '# retained');
});
