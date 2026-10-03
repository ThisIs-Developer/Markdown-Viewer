const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

for (const action of ['rescan', 're-add']) {
  test(`${action} restores excluded folder links without relinking a converted Vault copy`, async ({ page }) => {
    await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
    await openApp(page);
    await page.evaluate(async () => {
      await Neutralino.filesystem.createDirectory('C:/Original');
      window.__desktopFiles.set('C:/Original/notes.md', '# original');
      window.__linkedHandlers = {};
      Neutralino.events.on = async (name, handler) => { window.__linkedHandlers[name] = handler; };
      const readDirectory = Neutralino.filesystem.readDirectory;
      window.__folderReads = 0;
      Neutralino.filesystem.readDirectory = async path => {
        if (path === 'C:/Original') window.__folderReads++;
        return readDirectory(path);
      };
      await window.NL_HANDLE_NATIVE_DROP(['C:/Original']);
      await window.NL_START_LINKED_MONITORING();
    });
    const rows = page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: 'notes' });
    const location = page.locator('#document-tree [data-tree-type="linked-location"]');
    const copyId = await rows.getAttribute('data-document-id');
    await rows.dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
    await page.getByRole('menuitem', { name: 'Convert to Workspace copy' }).click();
    await expect(rows).not.toHaveClass(/is-linked-document/);
    const reads = await page.evaluate(() => window.__folderReads);
    await page.evaluate(() => window.__linkedHandlers.windowFocus());
    await expect.poll(() => page.evaluate(() => window.__folderReads)).toBeGreaterThan(reads);
    await page.waitForTimeout(500);
    await expect(rows).toHaveCount(1);

    const restore = async () => {
      if (action === 'rescan') {
        await location.dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
        await page.getByRole('menuitem', { name: 'Rescan folder' }).click();
      } else {
        await page.evaluate(() => window.NL_HANDLE_NATIVE_DROP(['C:/Original']));
      }
      await expect(rows).toHaveCount(2);
      await expect(location).toHaveCount(1);
      await expect(page.locator(`#document-tree [data-document-id="${copyId}"]`)).not.toHaveClass(/is-linked-document/);
    };
    await restore();
    await restore();
    const linked = page.locator('#document-tree [data-tree-type="document"].is-linked-document').filter({ hasText: 'notes' });
    await expect(linked).toHaveCount(1);
    await linked.dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
    await page.getByRole('menuitem', { name: 'Remove linked file' }).click();
    await expect(rows).toHaveCount(1);
    await restore();
    await expect(linked).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => {
      const index = JSON.parse(window.__desktopFiles.get('C:/Documents/Markdown Viewer Vault/.markdown-viewer/index.json'));
      return index.documents.filter(item => item.title === 'notes').length;
    })).toBe(2);
    const records = await page.evaluate(async id => {
      const restarted = new window.MarkdownWorkspaceStorage();
      await restarted.init();
      const metadata = await restarted.listDocumentMetadata();
      const copy = metadata.find(item => item.id === id);
      return { copyLinked: Boolean(copy.sourcePath), copyPath: copy._vaultRelativePath,
        links: metadata.filter(item => item.sourcePath === 'C:/Original/notes.md').length,
        original: window.__desktopFiles.get('C:/Original/notes.md') };
    }, copyId);
    expect(records.copyLinked).toBe(false);
    expect(records.copyPath).toMatch(/^Workspace\//);
    expect(records.links).toBe(1);
    expect(records.original).toBe('# original');
  });
}

test('linked context menus use the normal danger style and omit Copy source path', async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await openApp(page);
  await page.evaluate(async () => {
    await Neutralino.filesystem.createDirectory('C:/Original');
    window.__desktopFiles.set('C:/Original/notes.md', '# original');
    await window.NL_HANDLE_NATIVE_DROP(['C:/Original']);
    await window.NL_IMPORT_EXTERNAL_FILE('# loose', 'loose', 'C:/loose.md');
  });
  const menu = page.locator('.document-menu-context.open');
  const tree = page.locator('#document-tree');
  await tree.locator('[data-tree-type="document"]').filter({ hasText: 'Welcome to Markdown' })
    .dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
  const deleteColor = await menu.getByRole('menuitem', { name: 'Delete', exact: true }).evaluate(item => getComputedStyle(item).color);
  await page.keyboard.press('Escape');
  await tree.locator('[data-tree-type="document"]').filter({ hasText: 'loose' })
    .dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
  await expect(menu.getByRole('menuitem')).toHaveText(['Open', 'Reload from disk', 'Open containing folder', 'Convert to Workspace copy', 'Remove linked file']);
  const removeFile = menu.getByRole('menuitem', { name: 'Remove linked file' });
  await expect(removeFile).toHaveClass(/tab-menu-item-danger/);
  expect(await removeFile.evaluate(item => getComputedStyle(item).color)).toBe(deleteColor);
  await page.keyboard.press('Escape');
  await tree.locator('[data-tree-type="linked-location"]').dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
  const removeFolder = menu.getByRole('menuitem', { name: 'Remove linked folder' });
  await expect(removeFolder).toHaveClass(/tab-menu-item-danger/);
  expect(await removeFolder.evaluate(item => getComputedStyle(item).color)).toBe(deleteColor);
});

test('desktop linked autosave uses recovery storage and UI conversion persists a normal Vault copy', async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await openApp(page);
  await page.evaluate(async () => {
    window.__desktopFiles.set('C:/Original/notes.md', '# original');
    await window.NL_IMPORT_EXTERNAL_FILE('# original', 'notes', 'C:/Original/notes.md');
  });
  const editor = page.locator('#markdown-editor');
  await editor.fill('# local unsaved draft');
  await editor.dispatchEvent('input');
  const readIndex = () => page.evaluate(() => JSON.parse(window.__desktopFiles.get('C:/Documents/Markdown Viewer Vault/.markdown-viewer/index.json')));
  await expect.poll(async () => (await readIndex()).documents.find(item => item.title === 'notes')?.vaultRelativePath).toMatch(/^Linked Workspace\//);
  await expect.poll(() => page.evaluate(() => {
    const index = JSON.parse(window.__desktopFiles.get('C:/Documents/Markdown Viewer Vault/.markdown-viewer/index.json'));
    return window.__desktopFiles.get('C:/Documents/Markdown Viewer Vault/' + index.documents.find(item => item.title === 'notes').vaultRelativePath);
  })).toBe('# local unsaved draft');
  const before = (await readIndex()).documents;
  expect(before.find(item => item.title === 'Welcome to Markdown').vaultRelativePath).toMatch(/^Workspace\//);
  const oldPath = before.find(item => item.title === 'notes').vaultRelativePath;
  const row = page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: 'notes' });
  await row.dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
  await page.getByRole('menuitem', { name: 'Convert to Workspace copy' }).click();
  const toast = page.locator('.app-toast').filter({ hasText: 'Converted to Workspace copy' });
  await expect(toast.locator('.lucide-check')).toBeVisible();
  expect(await toast.locator('.lucide-check').evaluate(icon => getComputedStyle(icon).maskImage)).not.toBe('none');
  await expect.poll(async () => (await readIndex()).documents.find(item => item.title === 'notes')?.vaultRelativePath).toMatch(/^Workspace\//);
  const result = await page.evaluate(async oldRelativePath => {
    const restarted = new window.MarkdownWorkspaceStorage();
    await restarted.init();
    const record = (await restarted.listDocumentMetadata()).find(item => item.title === 'notes');
    return {
      linked: Boolean(record.sourcePath),
      content: await restarted.loadDocumentContent(record.id),
      original: window.__desktopFiles.get('C:/Original/notes.md'),
      oldRecoveryExists: window.__desktopFiles.has('C:/Documents/Markdown Viewer Vault/' + oldRelativePath)
    };
  }, oldPath);
  expect(result).toEqual({ linked: false, content: '# local unsaved draft', original: '# original', oldRecoveryExists: false });
});

for (const edited of [false, true]) {
  test(`reopening the original keeps an ${edited ? 'edited' : 'identical'} converted Vault copy independent`, async ({ page }) => {
    await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
    await openApp(page);
    await page.evaluate(async () => {
      window.__desktopFiles.set('C:/Original/notes.md', '# original');
      await window.NL_IMPORT_EXTERNAL_FILE('# original', 'notes', 'C:/Original/notes.md');
    });
    const rows = page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: 'notes' });
    const copyId = await rows.getAttribute('data-document-id');
    await rows.dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
    await page.getByRole('menuitem', { name: 'Convert to Workspace copy' }).click();
    await expect(rows).not.toHaveClass(/is-linked-document/);
    if (edited) {
      await page.locator('#markdown-editor').fill('# independent copy edit');
      await page.locator('#markdown-editor').dispatchEvent('input');
    }
    await page.evaluate(async () => {
      await window.NL_IMPORT_EXTERNAL_FILE('# original', 'notes', 'C:/Original/notes.md');
      await window.NL_IMPORT_EXTERNAL_FILE('# original', 'notes', 'c:\\original\\notes.md');
    });
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ has: page.locator('.lucide-file-symlink') })).toHaveCount(1);
    await expect(page.locator(`#document-tree [data-document-id="${copyId}"]`)).not.toHaveClass(/is-linked-document/);
    await expect.poll(() => page.evaluate(() => {
      const index = JSON.parse(window.__desktopFiles.get('C:/Documents/Markdown Viewer Vault/.markdown-viewer/index.json'));
      return index.documents.filter(item => item.title === 'notes').length;
    })).toBe(2);
    const result = await page.evaluate(async id => {
      const restarted = new window.MarkdownWorkspaceStorage();
      await restarted.init();
      const records = (await restarted.listDocumentMetadata()).filter(item => item.title === 'notes');
      const copy = records.find(item => item.id === id);
      const linked = records.find(item => item.sourcePath);
      return { count: records.length, copyLinked: Boolean(copy.sourcePath), copyPath: copy._vaultRelativePath,
        linkedPath: linked._vaultRelativePath, copyContent: await restarted.loadDocumentContent(copy.id),
        original: window.__desktopFiles.get('C:/Original/notes.md') };
    }, copyId);
    expect(result.count).toBe(2);
    expect(result.copyLinked).toBe(false);
    expect(result.copyPath).toMatch(/^Workspace\//);
    expect(result.linkedPath).toMatch(/^Linked Workspace\//);
    expect(result.copyContent).toBe(edited ? '# independent copy edit' : '# original');
    expect(result.original).toBe('# original');
  });
}
