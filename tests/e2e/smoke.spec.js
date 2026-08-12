const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const { openApp, stubClipboard } = require('../helpers/app');

test('static build smoke check passes', () => {
  const output = execFileSync('node', ['tests/helpers/static-build-check.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  expect(output).toContain('Static build smoke check passed.');
});

test('app starts, loads the main UI, and has no critical first-load errors', async ({ page }) => {
  const criticalErrors = await openApp(page);

  await expect(page.getByRole('heading', { name: 'Markdown Viewer', exact: true })).toBeVisible();
  await expect(page.locator('#markdown-editor')).toBeVisible();
  await expect(page.locator('#markdown-preview')).toBeVisible();
  await expect(page.locator('#tab-list [role="tab"]')).toHaveCount(1);

  expect(criticalErrors).toEqual([]);
});

test('first run opens release notes in the background without stealing editor focus', async ({ page }) => {
  const criticalErrors = await openApp(page, '/', { showReleaseNotes: true });

  await expect(page.locator('#tab-list [role="tab"]')).toHaveCount(2);
  await expect(page.locator('#tab-list .tab-item', { hasText: 'Release Notes:' })).toHaveCount(1);
  await expect(page.locator('#tab-list .tab-item.active')).not.toContainText('Release Notes:');
  await expect(page.locator('#markdown-editor')).toBeEditable();
  expect(criticalErrors).toEqual([]);
});

test('release notes behave as an application surface instead of a document', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openApp(page);
  await stubClipboard(page);

  await page.locator('#review-toggle').click();
  await expect(page.locator('#review-panel')).toBeVisible();
  await page.locator('#header-about-button').click();
  await page.getByRole('button', { name: 'Show Release Notes' }).click();

  const releaseTab = page.locator('#tab-list .release-notes-tab');
  await expect(releaseTab).toHaveClass(/active/);
  await expect(page.locator('body')).toHaveClass(/release-notes-active/);
  await expect(page.locator('#document-tree [aria-current="page"]')).toHaveCount(0);
  await expect(page.locator('#review-panel')).toBeHidden();
  await expect(page.locator('.review-target-actions')).toHaveCount(0);

  await expect(page.locator('.header-view-toolbar')).toBeVisible();
  await expect(page.locator('.header-view-toolbar button')).toHaveCount(3);
  await expect(page.locator('.header-view-toolbar button:not(:disabled)')).toHaveCount(0);
  await expect(page.locator('#toggle-sync')).toBeVisible();
  await expect(page.locator('#toggle-sync')).toBeDisabled();
  await expect(page.locator('#copy-markdown-button')).toBeVisible();
  await expect(page.locator('#copy-markdown-button')).toBeDisabled();
  await expect(page.locator('#exportDropdown')).toBeVisible();
  await expect(page.locator('#exportDropdown')).toBeDisabled();
  await expect(page.locator('#share-button')).toBeVisible();
  await expect(page.locator('#share-button')).toBeDisabled();
  await expect(page.locator('#live-share-button')).toBeVisible();
  await expect(page.locator('#live-share-button')).toBeDisabled();
  await expect(page.locator('#review-toggle')).toBeVisible();
  await expect(page.locator('#review-toggle')).toBeDisabled();
  await expect(page.locator('#markdown-format-toolbar')).toBeVisible();
  await expect(page.locator('#markdown-format-toolbar button:not(:disabled)')).toHaveCount(0);
  await expect(page.locator('.app-status-bar')).toBeVisible();

  await expect(page.locator('#importDropdown')).toBeVisible();
  await expect(page.locator('[aria-label="Report an issue"]')).toBeVisible();
  await expect(page.locator('#header-about-button')).toBeVisible();
  await expect(page.locator('#workspaceSettingsDropdown')).toBeVisible();

  await page.keyboard.press('Control+Shift+C');
  await expect.poll(() => page.evaluate(() => window.__copiedText)).toBe('');
  await page.evaluate(() => document.getElementById('review-toggle').click());
  await expect(page.locator('#review-panel')).toBeHidden();

  await expect(releaseTab.locator('.tab-menu-btn')).toHaveCount(0);
  await expect(releaseTab.locator('.tab-close-btn')).toBeVisible();

  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator('#mobile-menu-toggle').click();
  await expect(page.locator('.mobile-menu-overview')).toBeVisible();
  await expect(page.locator('.mobile-view-mode-btn:not(:disabled)')).toHaveCount(0);
  await expect(page.locator('#mobile-document-tools')).toBeVisible();
  await expect(page.locator('#mobile-document-tools button:not(:disabled)')).toHaveCount(0);
  await expect(page.locator('#mobile-export-section')).toBeVisible();
  await expect(page.locator('[aria-controls="mobile-menu-export-panel"]')).toBeDisabled();
  await expect(page.locator('#mobile-share-button')).toBeVisible();
  await expect(page.locator('#mobile-share-button')).toBeDisabled();
  await expect(page.locator('#mobile-live-share-button')).toBeVisible();
  await expect(page.locator('#mobile-live-share-button')).toBeDisabled();
  await expect(page.locator('[aria-controls="mobile-menu-new-panel"]')).toBeVisible();
  await page.locator('#close-mobile-menu').click();

  await page.locator('#tab-list .tab-item:not(.release-notes-tab)').first().click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('body')).not.toHaveClass(/release-notes-active/);
  await expect(page.locator('#tab-list .tab-item:not(.release-notes-tab)').first().locator('.tab-menu-btn')).toBeVisible();
  await expect(page.locator('.header-view-toolbar button[data-view-mode="split"]')).toBeEnabled();
  await expect(page.locator('#toggle-sync')).toBeEnabled();
  await expect(page.locator('#copy-markdown-button')).toBeVisible();
  await expect(page.locator('#copy-markdown-button')).toBeEnabled();
  await expect(page.locator('#exportDropdown')).toBeEnabled();
  await expect(page.locator('#share-button')).toBeEnabled();
  await expect(page.locator('#live-share-button')).toBeEnabled();
  await expect(page.locator('#review-toggle')).toBeVisible();
  await expect(page.locator('#review-toggle')).toBeEnabled();
  await expect(page.locator('#markdown-format-toolbar')).toBeVisible();
  await expect(page.locator('#markdown-format-toolbar [data-md-action="bold"]')).toBeEnabled();
  await expect(page.locator('.app-status-bar')).toBeVisible();
  await expect(page.locator('#document-tree [aria-current="page"]')).toHaveCount(1);
});
