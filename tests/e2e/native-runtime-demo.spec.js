const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

test('native Windows paths open the chooser and link without a second picker', async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await page.addInitScript(() => {
    window.NL_OS = 'Windows';
    window.MARKDOWN_VIEWER_DESKTOP_RUNTIME_FEATURES = { nativeFileDrop: true };
  });
  await openApp(page);
  await page.evaluate(() => {
    window.__desktopFiles.set('C:/Original/δοκιμή notes.md', '# original');
    window.__nativePickerCalls = 0;
    Neutralino.os.showOpenDialog = async () => { window.__nativePickerCalls++; return []; };
    void window.NL_HANDLE_NATIVE_DROP(['C:/Original/δοκιμή notes.md']);
  });
  await expect(page.locator('#desktop-drop-modal')).toBeVisible();
  await page.locator('#desktop-drop-link').click();
  const row = page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: 'δοκιμή notes' });
  await expect(row).toHaveCount(1);
  await expect(row.locator('.lucide-file-symlink')).toHaveCount(1);
  expect(await page.evaluate(() => window.__nativePickerCalls)).toBe(0);
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Original/δοκιμή notes.md'))).toBe('# original');
});

test('native drop can create an independent Vault copy and cancellation imports nothing', async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await page.addInitScript(() => {
    window.NL_OS = 'Windows';
    window.MARKDOWN_VIEWER_DESKTOP_RUNTIME_FEATURES = { nativeFileDrop: true };
  });
  await openApp(page);
  await page.evaluate(() => {
    window.__desktopFiles.set('C:/Original/copy-demo.md', '# original');
    void window.NL_HANDLE_NATIVE_DROP(['C:/Original/copy-demo.md']);
  });
  await page.locator('#desktop-drop-copy').click();
  const row = page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: 'copy-demo' });
  await expect(row).toHaveCount(1);
  await expect(row.locator('.lucide-file-symlink')).toHaveCount(0);
  await page.evaluate(() => {
    window.__desktopFiles.set('C:/Original/cancel-demo.md', '# cancelled');
    void window.NL_HANDLE_NATIVE_DROP(['C:/Original/cancel-demo.md']);
  });
  await page.locator('#desktop-drop-modal-cancel').click();
  await expect(page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: 'cancel-demo' })).toHaveCount(0);
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Original/copy-demo.md'))).toBe('# original');
});

for (const mode of ['web', 'stock-windows', 'other-platform']) {
  test(`experimental native drop and pointer behavior stay inactive in ${mode}`, async ({ page }) => {
    if (mode !== 'web') await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
    await page.addInitScript(mode => {
      window.NL_OS = mode === 'other-platform' ? 'Linux' : 'Windows';
      window.MARKDOWN_VIEWER_DESKTOP_RUNTIME_FEATURES = mode === 'stock-windows'
        ? {} : { nativeFileDrop: true, sidebarPointerDrag: true };
    }, mode);
    await openApp(page);
    const row = page.locator('#document-tree [data-tree-type="document"]').first();
    await expect(row).toHaveAttribute('draggable', 'true');
    await expect(row).not.toHaveAttribute('data-pointer-draggable', 'true');
    await page.evaluate(() => window.NL_HANDLE_NATIVE_DROP(['C:/Original/ignored.md']));
    await expect(page.locator('#desktop-drop-modal')).toBeHidden();
  });
}
