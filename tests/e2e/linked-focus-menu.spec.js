const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

test.beforeEach(async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await page.addInitScript(() => {
    window.__nativeHandlers = {};
    window.Neutralino.events.on = async (name, handler) => { window.__nativeHandlers[name] = handler; };
  });
  await openApp(page);
});

for (const change of ['none', 'added', 'content']) {
  test(`focus rescan preserves the sidebar menu (${change})`, async ({ page }) => {
    await page.evaluate(async () => {
      await Neutralino.filesystem.createDirectory('C:/Notes');
      window.__desktopFiles.set('C:/Notes/one.md', '# original');
      Neutralino.os.showFolderDialog = async () => 'C:/Notes';
      document.getElementById('sidebar-link-folder').click();
      await window.NL_START_LINKED_MONITORING();
    });
    const row = page.locator('#document-tree [data-tree-type="document"]').filter({hasText:'one'});
    await row.locator('.document-tree-main').click();
    await row.dispatchEvent('contextmenu', {clientX:120,clientY:120});
    const menu = page.locator('.document-menu-context.open');
    await expect(menu).toBeVisible();
    await page.evaluate(change => {
      window.__originalMenu = document.querySelector('.document-menu-context.open');
      window.__originalRow = document.querySelector('#document-tree [data-document-id="' + document.querySelector('#tab-list .tab-item.active').dataset.tabId + '"]');
      if (change === 'added') window.__desktopFiles.set('C:/Notes/two.md', '# new');
      if (change === 'content') window.__desktopFiles.set('C:/Notes/one.md', '# external edit');
      window.__nativeHandlers.windowFocus();
    }, change);
    // The focus handler debounces its asynchronous scan by 350 ms.
    await page.waitForTimeout(800);
    await expect(menu).toBeVisible();
    expect(await page.evaluate(() => window.__originalMenu.isConnected)).toBe(true);
    expect(await page.evaluate(() => window.__originalRow.isConnected)).toBe(true);
    if (change === 'content') await expect(page.locator('#markdown-editor')).toHaveValue('# external edit');
    if (change === 'added') await expect(page.locator('#document-tree [data-tree-type="document"]').filter({hasText:'two'})).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    if (change === 'added') await expect(page.locator('#document-tree [data-tree-type="document"]').filter({hasText:'two'})).toBeVisible();
  });
}

test('individual missing-source refresh waits until the context menu closes', async ({ page }) => {
  await page.evaluate(async () => {
    window.__desktopFiles.set('C:/one.md', '# original');
    await window.NL_IMPORT_EXTERNAL_FILE('# original', 'one', 'C:/one.md');
    await window.NL_START_LINKED_MONITORING();
  });
  const row = page.locator('#document-tree [data-tree-type="document"]').filter({hasText:'one'});
  await row.dispatchEvent('contextmenu', {clientX:120,clientY:120});
  await page.evaluate(() => {
    window.__desktopFiles.delete('C:/one.md');
    window.__nativeHandlers.windowFocus();
  });
  await page.waitForTimeout(800);
  await expect(page.locator('.document-menu-context.open')).toBeVisible();
  await expect(row).not.toHaveClass(/is-source-missing/);
  await page.keyboard.press('Escape');
  await expect(row).toHaveClass(/is-source-missing/);
});
