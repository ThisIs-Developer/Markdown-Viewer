const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

test.beforeEach(async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await openApp(page);
});

test('oversized linked source stops before reading the source body', async ({ page }) => {
  const result = await page.evaluate(async () => {
    __desktopFiles.set('C:/large.md', '# placeholder');
    const stats = Neutralino.filesystem.getStats, read = Neutralino.filesystem.readFile;
    window.__largeReads = 0;
    Neutralino.filesystem.getStats = async path => path === 'C:/large.md' ? { size: 20 * 1024 * 1024 + 1 } : stats(path);
    Neutralino.filesystem.readFile = async (...args) => { if (args[0] === 'C:/large.md') window.__largeReads++; return read(...args); };
    window.__drop = NL_OPEN_EXTERNAL_MARKDOWN_FILE('C:/large.md').catch(error => error.message);
    return { initialReads: window.__largeReads };
  });
  expect(await page.evaluate(() => __drop)).toContain('20 MiB');
  expect(result.initialReads).toBe(0);
  expect(await page.evaluate(() => window.__largeReads)).toBe(0);
  await expect(page.locator('#document-tree')).not.toContainText('large');
});

test('a failed folder scan retains drafts and a quiet hover indicator until successful retry', async ({ page }) => {
  await page.evaluate(async () => {
    await Neutralino.filesystem.createDirectory('C:/Root');
    __desktopFiles.set('C:/Root/notes.md', '# original');
    await NL_LINK_MARKDOWN_FOLDER_PATH('C:/Root');
    const stats = Neutralino.filesystem.getStats;
    Neutralino.filesystem.getStats = async path => path === 'C:/Root/notes.md' && window.__oversized ? { size: 20 * 1024 * 1024 + 1 } : stats(path);
    window.__oversized = true;
    await NL_LINK_MARKDOWN_FOLDER_PATH('C:/Root');
  });
  await expect(page.locator('.linked-folder-scan-indicator')).toHaveAttribute('title', /20 MiB.*drafts were kept/);
  await expect(page.locator('#document-tree')).toContainText('notes');
  await page.evaluate(async () => { window.__oversized = false; await NL_LINK_MARKDOWN_FOLDER_PATH('C:/Root'); });
  await expect(page.locator('.linked-folder-scan-indicator')).toHaveCount(0);
});

test('different roots stage native reads sequentially instead of multiplying scan budgets', async ({ page }) => {
  await page.evaluate(async () => {
    for (const root of ['A', 'B']) {
      await Neutralino.filesystem.createDirectory('C:/' + root);
      __desktopFiles.set('C:/' + root + '/notes.md', '#' + root);
    }
    const read = Neutralino.filesystem.readFile;
    window.__BReads = 0;
    Neutralino.filesystem.readFile = async (...args) => {
      if (args[0] === 'C:/A/notes.md') { window.__APaused = true; await new Promise(resolve => { window.__releaseA = resolve; }); }
      if (args[0] === 'C:/B/notes.md') window.__BReads++;
      return read(...args);
    };
    window.__A = NL_LINK_MARKDOWN_FOLDER_PATH('C:/A');
  });
  await expect.poll(() => page.evaluate(() => window.__APaused)).toBe(true);
  await page.evaluate(() => { window.__B = NL_LINK_MARKDOWN_FOLDER_PATH('C:/B'); });
  expect(await page.evaluate(() => window.__BReads)).toBe(0);
  await page.evaluate(async () => { __releaseA(); await Promise.all([__A, __B]); });
  expect(await page.evaluate(() => window.__BReads)).toBe(1);
});
