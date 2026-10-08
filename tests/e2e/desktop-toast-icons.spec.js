const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

for (const theme of ['light', 'dark']) {
  test(`linked workflow toast icons are consistent and render in ${theme} theme`, async ({ page }) => {
    await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window); window.NL_TOKEN = "test-token";');
    await openApp(page);
    await page.evaluate(theme => {
      document.documentElement.setAttribute('data-theme', theme);
      window.__desktopFiles.set('C:/Original/notes.md', '# original');
      Neutralino.os.showFolderDialog = async () => 'C:/Original';
      Neutralino.os.showOpenDialog = async () => ['C:/Original/notes.md'];
    }, theme);
    await page.evaluate(() => Neutralino.filesystem.createDirectory('C:/Original'));
    const assertToast = async (text, tone, iconClass) => {
      const toast = page.locator('.app-toast').filter({ hasText: text }).last();
      await expect(toast).toBeVisible();
      await expect(toast).toHaveAttribute('data-tone', tone);
      const icon = toast.locator('.app-toast-icon-shell > i');
      await expect(icon).toHaveClass('lucide ' + iconClass);
      const rendered = await icon.evaluate(element => {
        const style = getComputedStyle(element);
        return { mask: style.maskImage, width: style.width, height: style.height };
      });
      expect(rendered.mask).not.toBe('none');
      expect(rendered.width).toBe(rendered.height);
      expect(parseFloat(rendered.width)).toBeGreaterThan(0);
      return toast;
    };
    await page.locator('#sidebar-link-folder').click();
    await assertToast('Linked folder scanned.', 'success', 'lucide-check');
    const location = page.locator('#document-tree [data-tree-type="linked-location"]');
    await location.dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
    await page.getByRole('menuitem', { name: 'Rescan folder' }).click();
    await assertToast('Linked folder scanned.', 'success', 'lucide-check');
    await page.locator('#sidebar-link-files').click();
    await assertToast('Linked files', 'success', 'lucide-check');
    await page.evaluate(async () => {
      await window.NL_IMPORT_EXTERNAL_FILE('# loose', 'loose', 'C:/loose.md');
    });
    await assertToast('Linked Markdown file', 'info', 'lucide-info');
    const loose = page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: 'loose' });
    await loose.dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
    await page.getByRole('menuitem', { name: 'Remove linked file' }).click();
    await assertToast('Linked file closed', 'success', 'lucide-check');
    await location.dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
    await page.getByRole('menuitem', { name: 'Remove linked folder' }).click();
    const confirmation = await assertToast('Remove linked folder', 'warning', 'lucide-triangle-alert');
    await confirmation.getByRole('button', { name: 'Remove link', exact: true }).click();
    await assertToast('Folder unlinked', 'success', 'lucide-check');
    await page.evaluate(() => {
      Neutralino.os.showFolderDialog = async () => { throw new Error('Picker unavailable'); };
    });
    await page.locator('#sidebar-link-folder').click();
    await assertToast('Link failed', 'error', 'lucide-circle-alert');
  });
}
