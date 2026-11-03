const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

async function setup(page) {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await openApp(page);
  await page.evaluate(async () => {
    for (const path of ['C:/Original', 'C:/Original/sub', 'C:/Original/sub/deep']) await Neutralino.filesystem.createDirectory(path);
    window.__desktopFiles.set('C:/Original/top.md', '# top');
    window.__desktopFiles.set('C:/Original/sub/deep/notes.md', '# notes');
    await window.NL_LINK_MARKDOWN_FOLDER_PATH('C:/Original');
    await window.MarkdownViewerFlushWorkspace();
  });
}
async function convert(page, subfolder = false, cancel = false) {
  const row = page.locator(subfolder ? '[data-tree-type="linked-virtual-folder"]' : '[data-tree-type="linked-location"]').first();
  await row.dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
  await page.getByRole('menuitem', { name: 'Convert to Workspace copy', exact: true }).click();
  const toast = page.getByRole('alertdialog', { name: 'Convert linked folder', exact: true });
  await toast.getByRole('button', { name: cancel ? 'Cancel' : 'Convert to Workspace copy', exact: true }).click();
}
async function records(page) {
  return page.evaluate(async () => {
    await window.MarkdownViewerFlushWorkspace();
    const storage = new window.MarkdownWorkspaceStorage(); await storage.init();
    const items = (await storage.listDocumentMetadata()).filter(item => ['top', 'notes'].includes(item.title));
    return { items: await Promise.all(items.map(async item => ({ title: item.title, linked: !!item.sourcePath, path: item._vaultRelativePath, body: await storage.loadDocumentContent(item.id) }))),
      originals: [window.__desktopFiles.get('C:/Original/top.md'), window.__desktopFiles.get('C:/Original/sub/deep/notes.md')] };
  });
}
test('whole folder conversion preserves live drafts, subfolders and originals', async ({ page }) => {
  await setup(page);
  await page.locator('.is-linked-document').filter({ hasText: 'notes' }).click();
  await page.locator('#markdown-editor').fill('# edited draft');
  await convert(page);
  await expect(page.locator('.app-toast').filter({ hasText: 'Folder converted' })).toBeVisible();
  await expect(page.locator('[data-tree-type="linked-location"]')).toHaveCount(0);
  const result = await records(page);
  expect(result.originals).toEqual(['# top', '# notes']);
  expect(result.items.every(item => !item.linked)).toBe(true);
  expect(result.items.find(item => item.title === 'notes')).toMatchObject({ body: '# edited draft' });
  expect(result.items.find(item => item.title === 'notes').path).toMatch(/^Workspace\/Original\/sub\/deep\//);
});
test('subfolder conversion keeps other links and rescan can recreate independent links', async ({ page }) => {
  await setup(page); await convert(page, true);
  await expect(page.locator('.app-toast').filter({ hasText: 'Folder converted' })).toBeVisible();
  const result = await records(page);
  expect(result.items.find(item => item.title === 'top').linked).toBe(true);
  expect(result.items.find(item => item.title === 'notes').linked).toBe(false);
  await page.locator('[data-tree-type="linked-location"]').dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
  await page.getByRole('menuitem', { name: 'Rescan folder' }).click();
  await expect(page.locator('.is-linked-document').filter({ hasText: 'notes' })).toHaveCount(1);
});
test('cancel creates no Vault folder or converted documents', async ({ page }) => {
  await setup(page); await convert(page, false, true);
  expect((await records(page)).items.every(item => item.linked)).toBe(true);
  await expect(page.locator('[data-tree-type="folder"]')).toHaveCount(0);
});
test('partial failure keeps remaining linked draft and retries into the same Vault folder', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const save = window.MarkdownWorkspaceStorage.prototype.saveDocuments; let failed = false;
    window.MarkdownWorkspaceStorage.prototype.saveDocuments = async function(documents, ...args) {
      if (!failed && documents.some(item => item.title === 'top' && !item.sourcePath)) { failed = true; throw new Error('Simulated move failure'); }
      return save.call(this, documents, ...args);
    };
  });
  await convert(page);
  await expect(page.locator('.app-toast').filter({ hasText: 'Folder conversion incomplete' })).toBeVisible();
  const partial = await records(page);
  expect(partial.items.find(item => item.title === 'top').linked).toBe(true);
  expect(partial.originals).toEqual(['# top', '# notes']);
  await convert(page);
  await expect(page.locator('.app-toast').filter({ hasText: 'Folder converted' })).toBeVisible();
  expect((await records(page)).items.every(item => !item.linked)).toBe(true);
  await expect(page.locator('[data-tree-type="folder"]').filter({ hasText: 'Original' })).toHaveCount(1);
});

test('destination organization failure converts nothing and leaves no phantom folders', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const save = window.MarkdownWorkspaceStorage.prototype.saveDocumentOrganization;
    window.MarkdownWorkspaceStorage.prototype.saveDocumentOrganization = async function(organization, ...args) {
      if (organization.folders.some(folder => folder.name === 'Original')) throw new Error('Simulated folder metadata failure');
      return save.call(this, organization, ...args);
    };
  });
  await convert(page);
  await expect(page.locator('.app-toast').filter({ hasText: 'Folder conversion incomplete' })).toBeVisible();
  expect((await records(page)).items.every(item => item.linked)).toBe(true);
  await expect(page.locator('[data-tree-type="folder"]')).toHaveCount(0);
  await expect(page.locator('#markdown-editor')).toBeEditable();
});

test('failed pre-conversion recovery flush leaves every draft linked and creates no Vault folders', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const save = window.MarkdownWorkspaceStorage.prototype.saveDocuments;
    window.MarkdownWorkspaceStorage.prototype.saveDocuments = async function(...args) {
      throw new Error('Injected recovery flush failure');
    };
    window.__restoreFolderSafetyStorage = () => { window.MarkdownWorkspaceStorage.prototype.saveDocuments = save; };
  });
  await convert(page);
  await expect(page.locator('.app-toast').filter({ hasText: 'Folder conversion incomplete' })).toBeVisible();
  await expect(page.locator('[data-tree-type="folder"]')).toHaveCount(0);
  await page.evaluate(() => window.__restoreFolderSafetyStorage());
  const result = await records(page);
  expect(result.items.every(item => item.linked)).toBe(true);
  expect(result.originals).toEqual(['# top', '# notes']);
});

test('standard HTML folder drag uses the same conversion and hierarchy', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const source = document.querySelector('[data-tree-type="linked-location"]');
    const target = document.querySelector('[data-tree-type="workspace"][data-drop-workspace-id="workspace_default"]');
    const transfer = new DataTransfer();
    source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    source.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: transfer }));
  });
  await page.getByRole('alertdialog', { name: 'Convert linked folder', exact: true }).getByRole('button', { name: 'Convert to Workspace copy', exact: true }).click();
  await expect(page.locator('.app-toast').filter({ hasText: 'Folder converted' })).toBeVisible();
  expect((await records(page)).items.every(item => !item.linked)).toBe(true);
});

test('opt-in Windows pointer dragging a subfolder converts only that subtree', async ({ page }) => {
  await page.addInitScript(() => { window.MARKDOWN_VIEWER_DESKTOP_RUNTIME_FEATURES = { sidebarPointerDrag: true }; window.NL_OS = 'Windows'; });
  await setup(page);
  const source = page.locator('[data-tree-type="linked-virtual-folder"]').first();
  await expect(source).toHaveAttribute('data-pointer-draggable', 'true');
  const a = await source.boundingBox();
  const b = await page.locator('[data-tree-type="workspace"][data-drop-workspace-id="workspace_default"]').boundingBox();
  await page.mouse.move(a.x + 85, a.y + a.height / 2); await page.mouse.down();
  await page.mouse.move(b.x + 100, b.y + b.height / 2, { steps: 10 }); await page.mouse.up();
  await page.getByRole('alertdialog', { name: 'Convert linked folder', exact: true }).getByRole('button', { name: 'Convert to Workspace copy', exact: true }).click();
  await expect(page.locator('.app-toast').filter({ hasText: 'Folder converted' })).toBeVisible();
  const result = await records(page);
  expect(result.items.find(item => item.title === 'top').linked).toBe(true);
  expect(result.items.find(item => item.title === 'notes').path).toMatch(/^Workspace\/sub\/deep\//);
});

async function saveFolder(page, cancel = false) {
  await page.evaluate(async cancel => {
    await Neutralino.filesystem.createDirectory('C:/Exports');
    Neutralino.os.showFolderDialog = async () => cancel ? '' : 'C:/Exports';
  }, cancel);
  await page.locator('[data-tree-type="folder"]').filter({ hasText: 'Original' }).first().dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
  await page.getByRole('menuitem', { name: 'Save As linked folder…' }).click();
}
test('Vault folder Save As keeps Vault copies, writes hierarchy and focuses a new linked copy', async ({ page }) => {
  await setup(page); await convert(page);
  await expect(page.locator('.app-toast').filter({ hasText: 'Folder converted' })).toBeVisible();
  await saveFolder(page);
  await expect(page.locator('.app-toast').filter({ hasText: 'Saved as linked folder' })).toBeVisible();
  const result = await records(page);
  expect(result.items.filter(item => !item.linked)).toHaveLength(2);
  expect(result.items.filter(item => item.linked)).toHaveLength(2);
  expect(await page.evaluate(() => [window.__desktopFiles.get('C:/Exports/Original/top.md'), window.__desktopFiles.get('C:/Exports/Original/sub/deep/notes.md')])).toEqual(['# top', '# notes']);
  await expect(page.locator('#tab-list .tab-item.active .lucide-file-symlink')).toHaveCount(1);
});
test('folder Save As never merges with an existing destination folder', async ({ page }) => {
  await setup(page); await convert(page);
  await expect(page.locator('.app-toast').filter({ hasText: 'Folder converted' })).toBeVisible();
  await page.evaluate(async () => {
    await Neutralino.filesystem.createDirectory('C:/Exports'); await Neutralino.filesystem.createDirectory('C:/Exports/Original');
    window.__desktopFiles.set('C:/Exports/Original/top.md', '# existing');
  });
  await saveFolder(page);
  await expect(page.locator('.app-toast').filter({ hasText: 'Saved as linked folder' })).toBeVisible();
  expect(await page.evaluate(() => [window.__desktopFiles.get('C:/Exports/Original/top.md'), window.__desktopFiles.get('C:/Exports/Original (copy 2)/top.md')])).toEqual(['# existing', '# top']);
});
test('partial external folder write failure keeps Vault drafts and reports the retained partial destination', async ({ page }) => {
  await setup(page); await convert(page);
  await expect(page.locator('.app-toast').filter({ hasText: 'Folder converted' })).toBeVisible();
  await page.evaluate(() => {
    const write = Neutralino.filesystem.writeFile;
    Neutralino.filesystem.writeFile = async (path, content) => {
      if (path === 'C:/Exports/Original/top.md') throw new Error('Simulated permission failure');
      return write(path, content);
    };
  });
  await saveFolder(page);
  await expect(page.locator('.app-toast').filter({ hasText: 'Folder Save As incomplete' })).toContainText('C:/Exports/Original');
  expect((await records(page)).items.filter(item => !item.linked)).toHaveLength(2);
  await expect(page.locator('#markdown-editor')).toBeEditable();
});

test('cancelling folder Save As creates no new linked root or external files', async ({ page }) => {
  await setup(page); await convert(page);
  await expect(page.locator('.app-toast').filter({ hasText: 'Folder converted' })).toBeVisible();
  await saveFolder(page, true);
  await expect(page.locator('#markdown-editor')).toBeEditable();
  await expect(page.locator('[data-tree-type="linked-location"]')).toHaveCount(0);
  expect(await page.evaluate(() => Array.from(window.__desktopFiles.keys()).some(path => path.startsWith('C:/Exports/')))).toBe(false);
});

test('failed recovery flush prevents external folder creation and all export writes', async ({ page }) => {
  await setup(page); await convert(page);
  await expect(page.locator('.app-toast').filter({ hasText: 'Folder converted' })).toBeVisible();
  await page.evaluate(() => {
    const save = window.MarkdownWorkspaceStorage.prototype.saveDocuments;
    window.MarkdownWorkspaceStorage.prototype.saveDocuments = async function(...args) {
      throw new Error('Injected export recovery failure');
    };
    window.__restoreFolderSafetyStorage = () => { window.MarkdownWorkspaceStorage.prototype.saveDocuments = save; };
  });
  await saveFolder(page);
  await expect(page.locator('.app-toast').filter({ hasText: 'Folder Save As incomplete' })).toContainText('No external copy was created');
  expect(await page.evaluate(() => Array.from(window.__desktopFiles.keys()).some(path => path.startsWith('C:/Exports/')))).toBe(false);
  expect(await page.evaluate(async () => (await Neutralino.filesystem.readDirectory('C:/Exports')).filter(entry => !['.', '..'].includes(entry.entry || entry.name)))).toEqual([]);
  await page.evaluate(() => window.__restoreFolderSafetyStorage());
  expect((await records(page)).items.every(item => !item.linked)).toBe(true);
});

test('folder Save As rejects a destination inside managed Vault storage', async ({ page }) => {
  await setup(page); await convert(page);
  await expect(page.locator('.app-toast').filter({ hasText: 'Folder converted' })).toBeVisible();
  await page.evaluate(() => { Neutralino.os.showFolderDialog = async () => 'C:/Documents/Markdown Viewer Vault/Linked Workspace'; });
  await page.locator('[data-tree-type="folder"]').filter({ hasText: 'Original' }).first().dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
  await page.getByRole('menuitem', { name: 'Save As linked folder…' }).click();
  await expect(page.locator('.app-toast').filter({ hasText: 'Folder Save As incomplete' })).toContainText('outside the managed Vault');
  expect((await records(page)).items.every(item => !item.linked)).toBe(true);
});
