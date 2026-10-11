const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

async function setup(page) {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);window.NL_OS="Windows";');
  await openApp(page);
  await page.evaluate(async () => {
    window.__watchHandlers = {};
    window.__watchCalls = [];
    window.__activeWatchers = new Map();
    window.__nextWatcher = 0;
    window.__watchFail = false;
    window.__removeFail = false;
    Neutralino.events.on = async (name, handler) => { window.__watchHandlers[name] = handler; };
    Neutralino.filesystem.createWatcher = async path => {
      window.__watchCalls.push(path);
      await new Promise(resolve => setTimeout(resolve, 10));
      if (window.__watchFail) throw new Error('watch registration denied');
      const id = ++window.__nextWatcher;
      window.__activeWatchers.set(id, path);
      return id;
    };
    Neutralino.filesystem.removeWatcher = async id => {
      if (window.__removeFail) throw new Error('watch removal denied');
      window.__activeWatchers.delete(id);
    };
    Neutralino.os.showSaveDialog = async () => 'C:/NewDirectory/copy.md';
    await window.NL_START_LINKED_MONITORING();
  });
}

async function saveAs(page, title) {
  const row = page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: title });
  const linked = await row.evaluate(node => node.classList.contains('is-linked-document'));
  await row.dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
  await page.locator('.document-menu-context.open').getByRole('menuitem', { name: linked ? 'Save As…' : 'Save As linked file…', exact: true }).click();
  await expect(page.locator('#tab-list .tab-item.active .tab-title')).toHaveText('copy');
  await expect(page.locator('.app-toast').filter({ hasText: 'Markdown file saved' })).toBeVisible();
}

async function diskChange(page, path, content) {
  await page.evaluate(({ path, content }) => {
    window.__desktopFiles.set(path, content);
    const parent = path.slice(0, path.lastIndexOf('/'));
    const id = [...window.__activeWatchers].find(([, value]) => value === parent)[0];
    window.__watchHandlers.watchFile({ detail: { id } });
  }, { path, content });
}

for (const source of ['Vault', 'linked']) {
  test(`Save As from ${source} immediately watches the new directory and keeps old subscriptions`, async ({ page }) => {
    await setup(page);
    if (source === 'linked') {
      await page.evaluate(async () => {
        window.__desktopFiles.set('C:/Original/notes.md', '# original');
        await window.NL_IMPORT_EXTERNAL_FILE('# original', 'notes', 'C:/Original/notes.md');
      });
    }
    await setEditorContent(page, '# local draft');
    await saveAs(page, source === 'linked' ? 'notes' : 'Welcome to Markdown');
    expect(await page.evaluate(() => [...window.__activeWatchers.values()].filter(x => x === 'C:/NewDirectory'))).toHaveLength(1);
    await diskChange(page, 'C:/NewDirectory/copy.md', '# externally edited copy');
    await expect(page.locator('#markdown-editor')).toHaveValue('# externally edited copy');
    if (source === 'linked') {
      expect(await page.evaluate(() => [...window.__activeWatchers.values()])).toContain('C:/Original');
      await diskChange(page, 'C:/Original/notes.md', '# externally edited original');
      const old = page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: 'notes' });
      await expect(old.locator('.document-source-conflict-indicator')).toBeVisible();
      await expect.poll(() => page.evaluate(async () => {
        const storage = new MarkdownWorkspaceStorage(); await storage.init();
        const doc = (await storage.listDocumentMetadata()).find(x => x.sourcePath === 'C:/Original/notes.md');
        return storage.loadDocumentContent(doc.id);
      })).toBe('# local draft');
      expect(await page.evaluate(() => window.__desktopFiles.get('C:/Original/notes.md'))).toBe('# externally edited original');
    }
  });
}

test('same-directory links and overlapping linked folder share one watcher across concurrent refreshes', async ({ page }) => {
  await setup(page);
  await page.evaluate(async () => {
    await Neutralino.filesystem.createDirectory('C:/Shared');
    window.__desktopFiles.set('C:/Shared/a.md', '# a');
    await window.NL_IMPORT_EXTERNAL_FILE('# a', 'a', 'C:/Shared/a.md');
    window.__desktopFiles.set('C:/Shared/b.md', '# b');
    await window.NL_IMPORT_EXTERNAL_FILE('# b', 'b', 'C:/Shared/b.md');
    await window.NL_LINK_MARKDOWN_FOLDER_PATH('C:/Shared');
    for (let i = 0; i < 5; i++) window.__watchHandlers.windowFocus();
  });
  await expect.poll(() => page.evaluate(() => window.__watchCalls.filter(x => x === 'C:/Shared').length)).toBe(1);
  expect(await page.evaluate(() => [...window.__activeWatchers.values()])).toEqual(['C:/Shared']);
  await diskChange(page, 'C:/Shared/b.md', '# b changed');
  await expect.poll(() => page.evaluate(async () => {
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    const doc = (await storage.listDocumentMetadata()).find(x => x.sourcePath === 'C:/Shared/b.md');
    return doc && storage.loadDocumentContent(doc.id);
  })).toBe('# b changed');
  expect(await page.evaluate(() => window.__watchCalls.filter(x => x === 'C:/Shared').length)).toBe(1);
});

test('failed registration preserves saved link, warns once, checks on focus and retries', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { window.__watchFail = true; });
  await setEditorContent(page, '# draft');
  await saveAs(page, 'Welcome to Markdown');
  await expect(page.locator('.app-toast').filter({ hasText: 'Linked monitoring unavailable' })).toHaveCount(1);
  await page.evaluate(() => {
    window.__desktopFiles.set('C:/NewDirectory/copy.md', '# external with no watcher');
    window.__watchHandlers.windowFocus();
    window.__watchHandlers.windowFocus();
  });
  await expect(page.locator('#markdown-editor')).toHaveValue('# external with no watcher');
  await expect(page.locator('.app-toast').filter({ hasText: 'Linked monitoring unavailable' })).toHaveCount(1);
  expect(await page.evaluate(() => window.__activeWatchers.size)).toBe(0);
  await page.evaluate(() => { window.__watchFail = false; window.__watchHandlers.windowFocus(); });
  await expect.poll(() => page.evaluate(() => window.__activeWatchers.size)).toBe(1);
  await diskChange(page, 'C:/NewDirectory/copy.md', '# watcher recovered');
  await expect(page.locator('#markdown-editor')).toHaveValue('# watcher recovered');
});

test('failed watcher removal is retained for retry without processing events for an unlinked document', async ({ page }) => {
  await setup(page);
  await setEditorContent(page, '# retained copy');
  await saveAs(page, 'Welcome to Markdown');
  await page.evaluate(() => { window.__removeFail = true; });
  await page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: 'copy' }).dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
  await page.getByRole('menuitem', { name: 'Convert to Workspace copy', exact: true }).click();
  await expect(page.locator('.app-toast').filter({ hasText: 'Converted to Workspace copy' })).toBeVisible();
  await diskChange(page, 'C:/NewDirectory/copy.md', '# no longer linked');
  await expect(page.locator('#markdown-editor')).toHaveValue('# retained copy');
  expect(await page.evaluate(() => window.__activeWatchers.size)).toBe(1);
  await page.evaluate(() => { window.__removeFail = false; window.__watchHandlers.windowFocus(); });
  await expect.poll(() => page.evaluate(() => window.__activeWatchers.size)).toBe(0);
});

test('cancelled or failed Save As registers no destination watcher', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { Neutralino.os.showSaveDialog = async () => ''; });
  const row = page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: 'Welcome to Markdown' });
  await row.dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
  await page.getByRole('menuitem', { name: 'Save As linked file…', exact: true }).click();
  // Waiting for a second picker call also proves the cancelled save released
  // its in-progress guard; no timing-based sleep is needed.
  await page.evaluate(() => {
    Neutralino.os.showSaveDialog = async () => 'C:/NewDirectory/copy.md';
    const write = Neutralino.filesystem.writeFile;
    Neutralino.filesystem.writeFile = async (path, body) => {
      if (path === 'C:/NewDirectory/copy.md') throw new Error('destination write denied');
      return write(path, body);
    };
  });
  await row.dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
  await page.getByRole('menuitem', { name: 'Save As linked file…', exact: true }).click();
  await expect(page.locator('.app-toast').filter({ hasText: 'destination write denied' })).toBeVisible();
  expect(await page.evaluate(() => window.__watchCalls)).toEqual([]);
  expect(await page.evaluate(() => window.__activeWatchers.size)).toBe(0);
  await expect(page.locator('#tab-list .tab-item.active .tab-title')).toHaveText('Welcome to Markdown');
});
