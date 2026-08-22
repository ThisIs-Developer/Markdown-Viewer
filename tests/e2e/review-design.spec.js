const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent } = require('../helpers/app');

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await setEditorContent(page, '# Compact comments\n\nSelect this content to review.');
  await expect(page.locator('#markdown-preview h1')).toHaveText('Compact comments');
});

test('uses a compact selection-first panel with application tokens', async ({ page }) => {
  await page.locator('#review-toggle').click();
  await expect(page.locator('.review-target-button')).toHaveCount(0);
  await expect(page.locator('#review-new-comment')).toBeDisabled();
  await expect(page.locator('#review-panel-title')).toHaveText('Comments');

  const metrics = await page.locator('#review-panel').evaluate(panel => {
    const header = panel.querySelector('.review-panel-header');
    const toolbar = panel.querySelector('.review-panel-toolbar');
    const filters = Array.from(panel.querySelectorAll('.review-filter-btn'));
    return {
      width: panel.getBoundingClientRect().width,
      headerHeight: header.getBoundingClientRect().height,
      toolbarOverflow: toolbar.scrollWidth - toolbar.clientWidth,
      filterHeights: filters.map(button => button.getBoundingClientRect().height),
      fontFamily: getComputedStyle(panel).fontFamily,
      bodyFontFamily: getComputedStyle(document.body).fontFamily
    };
  });
  expect(metrics.width).toBeLessThanOrEqual(345);
  expect(metrics.headerHeight).toBeLessThanOrEqual(48);
  expect(metrics.toolbarOverflow).toBeLessThanOrEqual(0);
  expect(metrics.fontFamily).toBe(metrics.bodyFontFamily);
  metrics.filterHeights.forEach(height => expect(height).toBeGreaterThanOrEqual(24));
});

test('mobile Comments sheet remains usable without horizontal overflow', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 375, height: 667 });
  await page.locator('#mobile-menu-toggle').click();
  await page.locator('#mobile-review-toggle').click();
  await expect(page.locator('#review-panel')).toBeVisible();

  const metrics = await page.locator('#review-panel').evaluate(panel => {
    const rect = panel.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      viewportWidth: window.innerWidth,
      scrollWidth: panel.scrollWidth,
      clientWidth: panel.clientWidth,
      animationName: getComputedStyle(panel).animationName,
      closeHeight: panel.querySelector('#review-panel-close').getBoundingClientRect().height,
      newHeight: panel.querySelector('#review-new-comment').getBoundingClientRect().height
    };
  });
  expect(metrics.left).toBeGreaterThanOrEqual(0);
  expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
  expect(metrics.animationName).toBe('none');
  expect(metrics.closeHeight).toBeGreaterThanOrEqual(40);
  expect(metrics.newHeight).toBeGreaterThanOrEqual(40);
});
