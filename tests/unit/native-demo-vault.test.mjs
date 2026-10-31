import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import mock from '../helpers/desktop-filesystem.js';

test('the packaged Windows demo creates an isolated vault without cleaning normal vault locators', async () => {
  const target = { crypto: webcrypto, TextEncoder, console, NL_OS: 'Windows',
    MARKDOWN_VIEWER_DESKTOP_RUNTIME_FEATURES: { isolatedVault: true },
    localStorage: { getItem: () => null, removeItem() {} } };
  target.self = target; target.window = target;
  mock.installDesktopFilesystem(target);
  const locator = 'C:/Documents/.markdown-viewer-vault-locator.json';
  const normal = 'C:/Documents/Markdown Viewer Vault/Workspace/important.md';
  target.__desktopFiles.set(locator, 'keep locator');
  target.__desktopFiles.set(normal, '# unchanged');
  vm.runInNewContext(fs.readFileSync(new URL('../../workspace-storage.js', import.meta.url), 'utf8'), target);
  const storage = new target.MarkdownWorkspaceStorage();
  await storage.init();
  assert.equal(storage.vaultPath, 'C:/Documents/Markdown Viewer Native Demo Vault');
  assert.equal(target.__desktopFiles.get(normal), '# unchanged');
  assert.equal(target.__desktopFiles.get(locator), 'keep locator');
  assert.ok([...target.__desktopFiles.keys()].filter(x => x !== normal && x !== locator).every(x => x.startsWith(storage.vaultPath + '/')));
});
