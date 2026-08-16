const { test, expect } = require('@playwright/test');
const {
  openApp,
  setEditorContent,
  stubLazyRendererLibraries
} = require('../helpers/app');

const reviewMarkdown = `# Review design

This paragraph is ready for focused feedback.`;

test.beforeEach(async ({ page }) => {
  await stubLazyRendererLibraries(page);
  await openApp(page);
  await setEditorContent(page, reviewMarkdown);
  await expect(page.locator('#markdown-preview h1')).toHaveText('Review design');
});

test('reserves the accent color for selected and primary review controls', async ({ page }) => {
  await page.locator('#review-toggle').click();

  const neutralState = await page.evaluate(() => {
    const activeFilter = document.querySelector('.review-filter-btn.is-active');
    const inactiveFilter = document.querySelector('.review-filter-btn:not(.is-active)');
    const emptyIcon = document.querySelector('.review-empty-state i');
    const submit = document.querySelector('#review-feedback-submit');
    return {
      accent: getComputedStyle(activeFilter).backgroundColor,
      inactiveFilter: getComputedStyle(inactiveFilter).backgroundColor,
      emptyIcon: getComputedStyle(emptyIcon).color,
      disabledSubmit: getComputedStyle(submit).backgroundColor
    };
  });

  expect(neutralState.inactiveFilter).not.toBe(neutralState.accent);
  expect(neutralState.emptyIcon).not.toBe(neutralState.accent);
  expect(neutralState.disabledSubmit).not.toBe(neutralState.accent);

  await page.locator('#review-pins-layer .review-target-button[data-review-anchor^="heading:"]').click();
  await expect(page.locator('#review-composer')).toBeVisible();

  const selectedKindColor = await page.locator('.review-kind-btn.is-active').evaluate((button) => (
    getComputedStyle(button).backgroundColor
  ));
  expect(selectedKindColor).toBe(neutralState.accent);

  await page.locator('#review-feedback-input').fill('Make the heading more specific.');
  await expect(page.locator('#review-feedback-submit')).toBeEnabled();
  await expect.poll(() => page.locator('#review-feedback-submit').evaluate((button) => (
    getComputedStyle(button).backgroundColor
  ))).toBe(neutralState.accent);
  await page.locator('#review-feedback-submit').click();

  const threadBorder = await page.locator('.review-thread').evaluate((thread) => (
    getComputedStyle(thread).borderInlineStartColor
  ));
  expect(threadBorder).not.toBe(neutralState.accent);

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  const darkState = await page.evaluate(() => {
    const activeFilter = document.querySelector('.review-filter-btn.is-active');
    const thread = document.querySelector('.review-thread');
    return {
      accent: getComputedStyle(activeFilter).backgroundColor,
      threadBorder: getComputedStyle(thread).borderInlineStartColor
    };
  });
  expect(darkState.threadBorder).not.toBe(darkState.accent);
});

test('keeps the review sheet touch-friendly and stable in narrow layouts', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 375, height: 667 });
  await page.locator('#mobile-menu-toggle').click();
  await page.locator('#mobile-review-toggle').click();
  await expect(page.locator('#review-panel')).toBeVisible();

  const portraitMetrics = await page.locator('#review-panel').evaluate((panel) => {
    const rect = panel.getBoundingClientRect();
    const targets = panel.querySelectorAll(
      '.review-panel-header .review-icon-btn, .review-panel-actions .review-icon-btn, .review-filter-btn'
    );
    return {
      left: rect.left,
      right: rect.right,
      viewportWidth: window.innerWidth,
      scrollWidth: panel.scrollWidth,
      clientWidth: panel.clientWidth,
      animationName: getComputedStyle(panel).animationName,
      targetHeights: Array.from(targets, (target) => target.getBoundingClientRect().height)
    };
  });

  expect(portraitMetrics.left).toBeGreaterThanOrEqual(0);
  expect(portraitMetrics.right).toBeLessThanOrEqual(portraitMetrics.viewportWidth);
  expect(portraitMetrics.scrollWidth).toBeLessThanOrEqual(portraitMetrics.clientWidth);
  expect(portraitMetrics.animationName).toBe('none');
  portraitMetrics.targetHeights.forEach((height) => expect(height).toBeGreaterThanOrEqual(44));

  await page.setViewportSize({ width: 667, height: 375 });
  const landscapeMetrics = await page.locator('#review-panel').evaluate((panel) => {
    const rect = panel.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollWidth: panel.scrollWidth,
      clientWidth: panel.clientWidth
    };
  });

  expect(landscapeMetrics.left).toBeGreaterThanOrEqual(0);
  expect(landscapeMetrics.right).toBeLessThanOrEqual(landscapeMetrics.viewportWidth);
  expect(landscapeMetrics.bottom).toBeLessThanOrEqual(landscapeMetrics.viewportHeight);
  expect(landscapeMetrics.scrollWidth).toBeLessThanOrEqual(landscapeMetrics.clientWidth);
});
