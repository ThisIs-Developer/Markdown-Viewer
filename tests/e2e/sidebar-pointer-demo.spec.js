const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

async function drag(page, source, target, cancel = false) {
  await source.scrollIntoViewIfNeeded();
  await source.locator('.document-tree-main').hover({ position: { x: 45, y: 14 } });
  const from = await source.locator('.document-tree-main').boundingBox();
  const to = await target.boundingBox();
  await page.mouse.move(from.x + 45, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + 50, to.y + to.height / 2, { steps: 12 });
  if (cancel) await page.keyboard.press('Escape');
  await page.mouse.up();
}

async function addFolder(page, name) {
  await page.locator('#sidebar-new-folder').click();
  await page.locator('#document-name-modal-input').fill(name);
  await page.locator('#document-name-modal-confirm').click();
  return page.locator('#document-tree [data-tree-type="folder"]').filter({ hasText: name });
}

for (const desktop of [false, true]) {
  test(`real mouse dragging moves Vault documents into folders and back (${desktop ? 'desktop' : 'web'})`, async ({ page }) => {
    if (desktop) await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window); window.NL_OS = "Windows"; window.MARKDOWN_VIEWER_DESKTOP_RUNTIME_FEATURES = { sidebarPointerDrag: true };');
    await openApp(page);
    const folder = await addFolder(page, 'Destination');
    const row = page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: 'Welcome to Markdown' });
    const root = page.locator('#document-tree [data-tree-type="workspace"]').filter({ hasText: desktop ? 'Workspace (Vault)' : /^Workspace/ });
    await drag(page, row, folder);
    await expect(row).toHaveAttribute('data-tree-depth', '2');
    await drag(page, row, root);
    await expect(row).toHaveAttribute('data-tree-depth', '1');
    await drag(page, row, folder, true);
    await expect(row).toHaveAttribute('data-tree-depth', '1');
    await expect(page.locator('.document-drag-preview')).toHaveCount(0);
  });
}

test('dragging linked documents converts into the destination folder without changing originals or allowing reverse drops', async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window); window.NL_OS = "Windows"; window.MARKDOWN_VIEWER_DESKTOP_RUNTIME_FEATURES = { sidebarPointerDrag: true };');
  await openApp(page);
  const folder = await addFolder(page, 'Destination');
  await page.evaluate(async () => {
    window.__desktopFiles.set('C:/Original/notes.md', '# original');
    await window.NL_IMPORT_EXTERNAL_FILE('# original', 'notes', 'C:/Original/notes.md');
  });
  const row = page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: 'notes' });
  const linkedRoot = page.locator('#document-tree [data-tree-type="linked-workspace"]');
  const secret = page.locator('#document-tree [data-tree-type="workspace"]').filter({ hasText: 'Secret Workspace' });
  await drag(page, row, secret);
  await expect(row).toHaveClass(/is-linked-document/);
  await drag(page, row, folder);
  await expect(row).not.toHaveClass(/is-linked-document/);
  await expect(row).toHaveAttribute('data-tree-depth', '2');
  await expect(page.locator('.app-toast').filter({ hasText: 'Converted to Workspace copy' })).toBeVisible();
  await drag(page, row, linkedRoot);
  await expect(row).not.toHaveClass(/is-linked-document/);
  await expect(row).toHaveAttribute('data-tree-depth', '2');
  const result = await page.evaluate(async () => {
    const storage = new window.MarkdownWorkspaceStorage();
    await storage.init();
    const item = (await storage.listDocumentMetadata()).find(record => record.title === 'notes');
    return { path: item.vaultRelativePath, linked: Boolean(item.sourcePath), content: await storage.loadDocumentContent(item.id), original: window.__desktopFiles.get('C:/Original/notes.md') };
  });
  expect(result.path).toMatch(/^Workspace\/Destination\//);
  expect(result).toMatchObject({ linked: false, content: '# original', original: '# original' });
});

test('selected Vault documents drag together and hovering expands a collapsed destination', async ({ page }) => {
  await page.addInitScript(() => {
    // Keep browser persistence across reload while simulating custom UI APIs.
    window.NL_PORT = 1;
    window.NL_OS = 'Windows';
    window.MARKDOWN_VIEWER_DESKTOP_RUNTIME_FEATURES = { sidebarPointerDrag: true };
    window.Neutralino = { filesystem: { readFile: async () => '', writeFile: async () => true }, os: {} };
  });
  await openApp(page);
  await page.locator('#tab-new-btn').click();
  const newId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
  const folder = await addFolder(page, 'Destination');
  const row = page.locator(`#document-tree [data-document-id="${newId}"]`);
  const welcome = page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: 'Welcome to Markdown' });
  await folder.locator('.document-tree-toggle').click();
  await welcome.click();
  await row.click({ modifiers: ['Control'] });
  await row.locator('.document-tree-main').hover({ position: { x: 45, y: 14 } });
  const from = await row.locator('.document-tree-main').boundingBox();
  const to = await folder.boundingBox();
  await page.mouse.move(from.x + 45, from.y + 14);
  await page.mouse.down();
  await page.mouse.move(to.x + 50, to.y + to.height / 2, { steps: 12 });
  await expect(folder).toHaveClass(/is-drop-target/);
  await expect(folder).toHaveAttribute('aria-expanded', 'true');
  await page.mouse.up();
  await expect(row).toHaveAttribute('data-tree-depth', '2');
  await expect(welcome).toHaveAttribute('data-tree-depth', '2');
  await page.reload();
  await expect(row).toHaveAttribute('data-tree-depth', '2');
  await expect(welcome).toHaveAttribute('data-tree-depth', '2');
});

test('failed conversion keeps the linked document and its original file', async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window); window.NL_OS = "Windows"; window.MARKDOWN_VIEWER_DESKTOP_RUNTIME_FEATURES = { sidebarPointerDrag: true };');
  await openApp(page);
  const folder = await addFolder(page, 'Destination');
  await page.evaluate(async () => {
    window.__desktopFiles.set('C:/Original/notes.md', '# original');
    await window.NL_IMPORT_EXTERNAL_FILE('# original', 'notes', 'C:/Original/notes.md');
    await window.MarkdownViewerFlushWorkspace();
    const originalSave = window.MarkdownWorkspaceStorage.prototype.saveDocuments;
    window.MarkdownWorkspaceStorage.prototype.saveDocuments = function(documents, ...args) {
      if (documents.some(item => item.title === 'notes' && !item.sourcePath)) return Promise.reject(new Error('Simulated disk failure'));
      return originalSave.call(this, documents, ...args);
    };
  });
  const row = page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: 'notes' });
  await drag(page, row, folder);
  await expect(page.locator('.app-toast').filter({ hasText: 'Conversion failed' })).toBeVisible();
  await expect(row).toHaveClass(/is-linked-document/);
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Original/notes.md'))).toBe('# original');
  await expect(page.locator('.app-toast').filter({ hasText: 'Converted to Workspace copy' })).toHaveCount(0);
});
