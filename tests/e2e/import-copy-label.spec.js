const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

for (const desktop of [false, true]) {
  test(`copy import label survives startup and language changes (${desktop ? 'desktop' : 'web'})`, async ({ page }) => {
    if (desktop) await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);window.NL_OS="Windows";window.NL_TOKEN="test-token";');
    await openApp(page);
    for (const [locale, label] of [['en', 'Import copies'], ['de', 'Kopien importieren'], ['en', 'Import copies']]) {
      await page.locator(`.lang-select-item[data-lang="${locale}"]`).first().evaluate(el => el.click());
      await expect(page.locator('#import-from-file .app-menu-label')).toHaveText(label);
      await expect(page.locator('#mobile-import-button')).toHaveText(label);
    }
  });
}
