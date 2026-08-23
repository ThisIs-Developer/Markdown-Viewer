const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent, storedDocuments } = require('../helpers/app');

async function selectText(page, selector, text) {
  await page.locator(selector).evaluate((element, selectedText) => {
    const node = Array.from(element.childNodes).find(child => (
      child.nodeType === Node.TEXT_NODE && child.nodeValue.includes(selectedText)
    ));
    if (!node) throw new Error('Selection text not found');
    const start = node.nodeValue.indexOf(selectedText);
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, start + selectedText.length);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }, text);
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await setEditorContent(page, '# Stable heading\n\nA stable paragraph for comment lifecycle testing.');
  await expect(page.locator('#markdown-preview h1')).toHaveText('Stable heading');
});

test('comments persist without changing Markdown and retain selection anchors', async ({ page }) => {
  const markdown = await page.locator('#markdown-editor').inputValue();
  await page.locator('#review-toggle').click();
  await selectText(page, '#markdown-preview p', 'stable paragraph');
  await page.locator('#review-new-comment').click();
  await page.locator('#review-feedback-input').fill('Persistent anchored comment.');
  await page.locator('#review-feedback-submit').click();

  expect(await page.locator('#markdown-editor').inputValue()).toBe(markdown);
  await expect.poll(async () => JSON.stringify(await storedDocuments(page))).toContain('Persistent anchored comment.');
  const stored = JSON.stringify(await storedDocuments(page));
  expect(stored).toContain('Persistent anchored comment.');
  expect(stored).toContain('stable paragraph');
  expect(stored).toContain('"kind":"text"');

  await page.reload();
  await page.locator('#review-toggle').click();
  await expect(page.locator('.review-thread')).toContainText('Persistent anchored comment.');
  await expect(page.locator('.review-comment-highlight')).toHaveText('stable paragraph');
});

test('comments can be edited, resolved, reopened, and deleted', async ({ page }) => {
  await page.locator('#review-toggle').click();
  await selectText(page, '#markdown-preview h1', 'Stable heading');
  await page.locator('#review-new-comment').click();
  await page.locator('#review-feedback-input').fill('Original comment.');
  await page.locator('#review-feedback-submit').click();

  const card = page.locator('.review-thread');
  await card.locator('[data-review-action="edit"]').click();
  await page.locator('#review-feedback-input').fill('Edited comment.');
  await page.locator('#review-feedback-submit').click();
  await expect(card).toContainText('Edited comment.');

  await card.locator('[data-review-action="toggle-resolved"]').click();
  await page.locator('[data-review-filter="resolved"]').click();
  await page.locator('.review-thread').click();
  await expect(page.locator('.review-thread-time.is-closed')).toContainText('Closed:');
  await page.locator('[data-review-action="toggle-resolved"]').click();
  await page.locator('[data-review-filter="open"]').click();
  await expect(page.locator('.review-thread')).toContainText('Edited comment.');

  await page.locator('[data-review-action="delete"]').click();
  await page.locator('#review-delete-confirm').click();
  await expect(page.locator('.review-thread')).toHaveCount(0);
});

test('opening a new tab closes Comments and restores the previous view', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Markdown' }).click();
  await page.locator('#review-toggle').click();
  await expect(page.locator('.content-container')).toHaveClass(/view-preview-only/);
  await page.locator('#tab-new-btn').click();
  await expect(page.locator('#review-panel')).toBeHidden();
  await page.locator('#tab-list [role="tab"]').filter({ hasText: 'Welcome to Markdown' }).click();
  await expect(page.locator('.content-container')).toHaveClass(/view-editor-only/);
});
