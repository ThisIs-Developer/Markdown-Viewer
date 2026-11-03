const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

for (const changed of [false, true]) {
  test('watcher retains a local draft when a missing original returns ' + (changed ? 'changed' : 'unchanged'), async ({ page }) => {
    await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
    await openApp(page);
    await page.evaluate(async () => {
      window.__linkedHandlers = {};
      Neutralino.events.on = async (name, handler) => { window.__linkedHandlers[name] = handler; };
      window.__desktopFiles.set('C:/Original/return.md', '# baseline');
      await window.NL_IMPORT_EXTERNAL_FILE('# baseline', 'return', 'C:/Original/return.md');
      await window.NL_START_LINKED_MONITORING();
    });
    const row = page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: /^return/ });
    await page.locator('#markdown-editor').fill('# local draft');
    await page.evaluate(() => {
      window.__desktopFiles.delete('C:/Original/return.md');
      window.__linkedHandlers.windowFocus();
    });
    await expect(row).toHaveClass(/is-source-missing/);
    await expect(row.locator('.document-source-missing-indicator')).toBeVisible();
    await expect(page.locator('#markdown-editor')).toHaveValue('# local draft');
    await page.evaluate(changed => {
      window.__desktopFiles.set('C:/Original/return.md', changed ? '# external change' : '# baseline');
      window.__linkedHandlers.windowFocus();
    }, changed);
    await expect(row).not.toHaveClass(/is-source-missing/);
    await expect(row.locator('.document-source-missing-indicator')).toHaveCount(0);
    await expect(page.locator('#markdown-editor')).toHaveValue('# local draft');
    if (changed) await expect(row.locator('.document-source-conflict-indicator')).toBeVisible();
    else await expect(row.locator('.document-source-conflict-indicator')).toHaveCount(0);
    await page.evaluate(() => window.MarkdownViewerFlushWorkspace());
    // Read persisted recovery through a fresh storage instance, not the editor.
    expect(await page.evaluate(async () => {
      const storage = new window.MarkdownWorkspaceStorage();
      await storage.init();
      const records = await storage.listDocumentMetadata();
      const linked = records.find(item => item.sourcePath === 'C:/Original/return.md');
      return storage.loadDocumentContent(linked.id);
    })).toBe('# local draft');
  });
}
