const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');

test('middle-click closes active and inactive tabs without deleting drafts', async ({ page }) => {
    await openApp(page);
    const firstId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
    await page.locator('#tab-new-btn').click();
    const secondId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
    const tab = id => page.locator(`#tab-list .tab-item[data-tab-id="${id}"]`);
    await page.locator('#markdown-editor').fill('# preserved draft');
    // A genuine middle-button click must not activate the inactive tab first.
    await tab(firstId).locator('.tab-title').click({button:'middle'});
    await expect(tab(firstId)).toHaveCount(0);
    await expect(tab(secondId)).toHaveClass(/active/);
    await expect(page.locator('#markdown-editor')).toHaveValue('# preserved draft');
    await page.locator('#tab-new-btn').click();
    const thirdId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
    await tab(thirdId).locator('.tab-close-btn').click({button:'middle'});
    await expect(tab(thirdId)).toHaveCount(0);
    await expect(tab(secondId)).toHaveClass(/active/);
    await tab(secondId).locator('.tab-title').click({button:'middle'});
    await expect(page.locator('#tab-list .tab-item')).toHaveCount(0);
    const row = page.locator(`#document-tree [data-document-id="${secondId}"]`);
    await expect(row).toBeVisible();
    await row.locator('.document-tree-main').click();
    await expect(tab(secondId)).toHaveClass(/active/);
    await expect(page.locator('#markdown-editor')).toHaveValue('# preserved draft');
    // Only the middle button closes; right-click retains its context menu.
    await tab(secondId).locator('.tab-title').click({button:'right'});
    await expect(tab(secondId)).toBeVisible();
    await expect(page.locator('[data-tab-context-menu="true"]')).toBeVisible();
  });

test('middle mousedown is cancelled on both the tab title and nested close button', async ({ page }) => {
  await openApp(page);
  for (const selector of ['.tab-title', '.tab-close-btn']) {
    expect(await page.locator('#tab-list .tab-item').first().locator(selector).evaluate(element =>
      element.dispatchEvent(new MouseEvent('mousedown', {button:1,bubbles:true,cancelable:true}))
    )).toBe(false);
  }
});
