const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');

const requiredViewports = [320, 375, 768, 1024, 1440];

for (const width of requiredViewports) {
  test(`workspace redesign has no page overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
    const errors = await openApp(page);

    await expect(page.locator('#document-workspace-shell')).toBeVisible();
    await expect(page.locator('#markdown-format-toolbar')).toBeVisible();
    await expect(page.locator('#document-sidebar-status')).toBeAttached();

    const overflow = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth
    }));
    expect(overflow.page).toBeLessThanOrEqual(overflow.viewport);
    expect(errors).toEqual([]);
  });
}

test('mobile workspace switches between editor, split, and preview', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await openApp(page);

  const container = page.locator('.content-container');
  const openMobileViewMenu = async () => {
    await page.locator('#mobile-menu-toggle').click();
    await expect(page.locator('#mobile-menu-panel')).toHaveClass(/active/);
  };

  await openMobileViewMenu();
  await page.locator('.mobile-view-mode-btn[data-mode="preview"]').click();
  await expect(container).toHaveClass(/view-preview-only/);
  await expect(page.locator('#markdown-preview')).toBeVisible();

  await openMobileViewMenu();
  await page.locator('.mobile-view-mode-btn[data-mode="editor"]').click();
  await expect(container).toHaveClass(/view-editor-only/);
  await expect(page.locator('#markdown-editor')).toBeVisible();

  await openMobileViewMenu();
  await page.locator('.mobile-view-mode-btn[data-mode="split"]').click();
  await expect(container).toHaveClass(/view-split/);
  await expect(page.locator('#markdown-preview')).toBeVisible();
});

test('workspace search and sidebar commands remain interactive', async ({ page }) => {
  await openApp(page);

  const sidebarSearch = page.locator('#document-sidebar-search');
  await sidebarSearch.focus();
  await expect(sidebarSearch).toBeFocused();
  await sidebarSearch.fill('Welcome');
  await expect(page.locator('#document-sidebar-status')).toContainText('result');

  await page.locator('[data-md-action="table"]').click();
  await expect(page.locator('#table-modal')).toBeVisible();
});
