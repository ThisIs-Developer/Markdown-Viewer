const { test, expect } = require('@playwright/test');
const {
  fixture,
  openApp,
  setEditorContent,
  stubExportLibraries
} = require('../helpers/app');

test.beforeEach(async ({ page }) => {
  await stubExportLibraries(page);
  await openApp(page);
  await setEditorContent(page, await fixture('export.md'));
  await page.evaluate(() => {
    window.__savedFiles = [];
    window.saveAs = (blob, name) => {
      window.__savedFiles.push({
        name,
        type: blob && blob.type ? blob.type : '',
        size: blob && typeof blob.size === 'number' ? blob.size : 0
      });
    };
  });
});

test('exports Markdown as a download', async ({ page }) => {
  await page.locator('#export-md').dispatchEvent('click');

  await expect.poll(() => page.evaluate(() => window.__savedFiles.at(-1))).toMatchObject({
    name: expect.stringMatching(/\.md$/),
    type: expect.stringContaining('text/markdown')
  });
});

test('exports rendered HTML as a download', async ({ page }) => {
  await page.locator('#export-html').dispatchEvent('click');

  await expect.poll(() => page.evaluate(() => window.__savedFiles.at(-1))).toMatchObject({
    name: expect.stringMatching(/\.html$/),
    type: expect.stringContaining('text/html')
  });
});

test('browser PDF export opens options and triggers window.print for vector mode', async ({ page }) => {
  await page.locator('#export-pdf').dispatchEvent('click');
  await expect(page.locator('#pdf-export-modal')).toHaveClass(/is-visible/);
  await expect(page.locator('#pdf-export-mode-vector')).toBeChecked();

  await page.locator('#pdf-export-confirm').click();
  await expect.poll(() => page.evaluate(() => window.__printCalled)).toBeGreaterThan(0);
});

test('PNG export produces an image download with a mocked local canvas renderer', async ({ page }) => {
  await page.locator('#export-png').dispatchEvent('click');

  await expect.poll(() => page.evaluate(() => window.__savedFiles.at(-1)), { timeout: 20_000 }).toMatchObject({
    name: expect.stringMatching(/\.png$/),
    type: expect.stringContaining('image/png')
  });
});
