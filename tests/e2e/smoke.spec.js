const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const { openApp } = require('../helpers/app');

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
