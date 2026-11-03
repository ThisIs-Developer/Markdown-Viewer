const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

test.beforeEach(async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);window.NL_OS="Windows";window.NL_TOKEN="test-token";');
  await openApp(page);
  await page.evaluate(async () => {
    await Neutralino.filesystem.createDirectory('C:/Progress');
    await Neutralino.filesystem.createDirectory('C:/Progress/Nested');
    __desktopFiles.set('C:/Progress/one.md', '# One');
    __desktopFiles.set('C:/Progress/Nested/two.md', '# Two');
    Neutralino.os.showFolderDialog = async () => 'C:/Progress';
  });
});

for (const theme of ['light', 'dark']) {
  test(`folder progress covers discovery, reading and durable saving in ${theme} theme`, async ({ page }, testInfo) => {
    await page.evaluate(theme => {
      document.documentElement.setAttribute('data-theme', theme);
      const readDirectory = Neutralino.filesystem.readDirectory;
      Neutralino.filesystem.readDirectory = async path => {
        if (path === 'C:/Progress') await new Promise(resolve => { window.__releaseScan = resolve; });
        return readDirectory(path);
      };
      const readFile = Neutralino.filesystem.readFile;
      Neutralino.filesystem.readFile = async (...args) => {
        if (args[0] === 'C:/Progress/Nested/two.md') await new Promise(resolve => { window.__releaseRead = resolve; });
        return readFile(...args);
      };
      const save = MarkdownWorkspaceStorage.prototype.saveDocumentOrganization;
      MarkdownWorkspaceStorage.prototype.saveDocumentOrganization = async function(org, ...args) {
        if (org.linkedLocations?.some(root => root.lastScanAt > 0)) {
          await new Promise(resolve => { window.__releaseSave = resolve; });
        }
        return save.call(this, org, ...args);
      };
    }, theme);
    await page.locator('#sidebar-link-folder').click();
    const card = page.locator('.linked-folder-progress-toast');
    const bar = card.getByRole('progressbar', { name: 'Linking folder' });
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-phase', 'scan');
    await expect(bar).not.toHaveAttribute('aria-valuenow');
    await expect(card.locator('.import-progress-detail')).toContainText('Scanning folder');
    await expect(card.locator('[id]')).toHaveCount(0);
    await expect(page.locator('#import-progress-toast')).toBeHidden();
    await expect.poll(() => page.evaluate(() => typeof __releaseScan)).toBe('function');
    await page.screenshot({ path: testInfo.outputPath('folder-scan.png') });
    await page.evaluate(() => __releaseScan());
    await expect(card).toHaveAttribute('data-phase', 'read');
    await expect(card.locator('.import-progress-count')).toHaveText('0 of 2');
    await expect(bar).toHaveAttribute('aria-valuenow', '0');
    await expect.poll(() => page.evaluate(() => typeof __releaseRead)).toBe('function');
    await page.evaluate(() => __releaseRead());
    await expect.poll(() => page.evaluate(() => typeof __releaseSave)).toBe('function');
    await expect(card).toHaveAttribute('data-phase', 'save');
    await expect(card).toHaveAttribute('data-state', 'loading');
    await expect(bar).toHaveAttribute('aria-valuenow', '95');
    await expect(card.locator('.import-progress-count')).toHaveText('2 of 2');
    await page.screenshot({ path: testInfo.outputPath('folder-saving.png') });
    await page.evaluate(() => __releaseSave());
    await expect(card).toHaveAttribute('data-state', 'complete');
    await expect(bar).toHaveAttribute('aria-valuenow', '100');
    await expect(card).toContainText('Folder linked');
    await expect(card.locator('.import-progress-count')).toHaveText('2 files');
    expect(await page.evaluate(() => [__desktopFiles.get('C:/Progress/one.md'), __desktopFiles.get('C:/Progress/Nested/two.md')])).toEqual(['# One', '# Two']);
  });
}

for (const failure of ['read', 'initial metadata', 'documents', 'final metadata']) {
  test(`folder progress reports ${failure} failure without claiming completion`, async ({ page }) => {
    await page.evaluate(failure => {
      if (failure === 'read') {
        const read = Neutralino.filesystem.readFile;
        Neutralino.filesystem.readFile = async (...args) => {
          if (args[0].startsWith('C:/Progress/')) throw Error('Injected read failure');
          return read(...args);
        };
      } else if (failure === 'documents') {
        MarkdownWorkspaceStorage.prototype.saveDocuments = async () => { throw Error('Injected document failure'); };
      } else {
        const save = MarkdownWorkspaceStorage.prototype.saveDocumentOrganization;
        MarkdownWorkspaceStorage.prototype.saveDocumentOrganization = async function(org, ...args) {
          if (org.linkedLocations?.some(root => failure === 'initial metadata' || root.lastScanAt > 0)) throw Error('Injected metadata failure');
          return save.call(this, org, ...args);
        };
      }
    }, failure);
    await page.locator('#sidebar-link-folder').click();
    const card = page.locator('.linked-folder-progress-toast');
    await expect(card).toHaveAttribute('data-state', 'partial');
    await expect(card).toContainText('Link failed');
    await expect(card.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow', '100');
    await expect(card).not.toContainText('Folder linked');
    expect(await page.evaluate(() => __desktopFiles.get('C:/Progress/one.md'))).toBe('# One');
  });
}

test('empty folder completes with zero files and cancelling the picker creates no progress', async ({ page }) => {
  await page.evaluate(() => { Neutralino.os.showFolderDialog = async () => ''; });
  await page.locator('#sidebar-link-folder').click();
  await expect(page.locator('.linked-folder-progress-toast')).toHaveCount(0);
  await page.evaluate(async () => {
    await Neutralino.filesystem.createDirectory('C:/Empty');
    Neutralino.os.showFolderDialog = async () => 'C:/Empty';
  });
  await page.locator('#sidebar-link-folder').click();
  const card = page.locator('.linked-folder-progress-toast');
  await expect(card).toHaveAttribute('data-state', 'complete');
  await expect(card.locator('.import-progress-count')).toHaveText('0 files');
  await expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
});

test('simultaneous path-based folder links keep separate progress cards', async ({ page }) => {
  await page.evaluate(async () => {
    await Neutralino.filesystem.createDirectory('C:/Other');
    const read = Neutralino.filesystem.readDirectory;
    Neutralino.filesystem.readDirectory = async path => {
      if (path === 'C:/Progress') await new Promise(resolve => { window.__releaseFirst = resolve; });
      if (path === 'C:/Other') await new Promise(resolve => { window.__releaseSecond = resolve; });
      return read(path);
    };
    window.__firstLink = NL_LINK_MARKDOWN_FOLDER_PATH('C:/Progress');
    window.__secondLink = NL_LINK_MARKDOWN_FOLDER_PATH('C:/Other');
  });
  const cards = page.locator('.linked-folder-progress-toast');
  await expect(cards).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => typeof __releaseFirst)).toBe('function');
  await page.evaluate(() => __releaseFirst());
  await expect(cards.nth(0)).toHaveAttribute('data-state', 'complete');
  await expect(cards.nth(1)).toHaveAttribute('data-state', 'loading');
  await expect.poll(() => page.evaluate(() => typeof __releaseSecond)).toBe('function');
  await page.evaluate(() => __releaseSecond());
  await expect(cards.nth(1)).toHaveAttribute('data-state', 'complete');
  await page.evaluate(() => Promise.all([__firstLink, __secondLink]));
});

test('progress is localized, fits narrow screens and respects reduced motion', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 720 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openApp(page, '/?lang=fr');
  await page.evaluate(async () => {
    await Neutralino.filesystem.createDirectory('C:/Progress');
    const read = Neutralino.filesystem.readDirectory;
    Neutralino.filesystem.readDirectory = async path => path === 'C:/Progress' ? new Promise(() => {}) : read(path);
    void NL_LINK_MARKDOWN_FOLDER_PATH('C:/Progress');
  });
  const card = page.locator('.linked-folder-progress-toast');
  await expect(card).toContainText('Liaison du dossier');
  await expect(card).toContainText('Analyse du dossier');
  await expect(card.getByRole('progressbar')).toHaveAttribute('aria-label', 'Liaison du dossier');
  expect(await card.locator('.import-progress-value').evaluate(node => getComputedStyle(node).animationName)).toBe('none');
  const box = await card.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(375);
  await page.screenshot({ path: testInfo.outputPath('folder-progress-mobile.png') });
});
