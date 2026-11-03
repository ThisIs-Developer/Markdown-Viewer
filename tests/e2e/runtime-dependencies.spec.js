const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent } = require('../helpers/app');

test('updated YAML and sanitizer preserve frontmatter and reject active HTML', async ({ page }) => {
  const errors = await openApp(page);
  await setEditorContent(page, '---\ntitle: Dependency smoke test\ntags:\n  - markdown\n  - safety\n---\n\n# Safe preview\n\n**Formatted text**\n\n<img src="data:," onerror="window.__unsafePreview = true">\n\n<a href="javascript:window.__unsafePreview=true">Unsafe link</a>');
  const preview = page.locator('#markdown-preview');
  await expect(preview.locator('.frontmatter-table')).toContainText('Dependency smoke test');
  await expect(preview.locator('h1')).toHaveText('Safe preview');
  await expect(preview.locator('strong')).toContainText('Formatted text');
  await expect(preview.locator('[onerror], [href^="javascript:"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__unsafePreview)).toBeUndefined();
  expect(errors).toEqual([]);
});
