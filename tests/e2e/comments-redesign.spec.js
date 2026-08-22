const { test, expect } = require('@playwright/test');
const {
  openApp,
  setEditorContent,
  stubLazyRendererLibraries,
  storedDocuments
} = require('../helpers/app');

async function selectPreviewText(page, selector, selectedText) {
  await page.locator(selector).filter({ hasText: selectedText }).first().evaluate((element, text) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    let offset = 0;
    let startNode = null;
    let startOffset = 0;
    let endNode = null;
    let endOffset = 0;
    const fullText = element.textContent || '';
    const start = fullText.indexOf(text);
    const end = start + text.length;
    while ((node = walker.nextNode())) {
      const nextOffset = offset + node.nodeValue.length;
      if (!startNode && start >= offset && start <= nextOffset) {
        startNode = node;
        startOffset = start - offset;
      }
      if (!endNode && end >= offset && end <= nextOffset) {
        endNode = node;
        endOffset = end - offset;
        break;
      }
      offset = nextOffset;
    }
    if (!startNode || !endNode) throw new Error('Unable to build selection');
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }, selectedText);
}

test.beforeEach(async ({ page }) => {
  await stubLazyRendererLibraries(page);
  await openApp(page);
  await setEditorContent(page, `---
author: Baivab Sarkar
---

# Comments redesign

Select this precise phrase for a focused comment.

- A list item can be commented on too.

![Reference image](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=)

Equation $x^2$ remains reviewable.

\`\`\`mermaid
graph LR
  A --> B
\`\`\``);
  await expect(page.locator('#markdown-preview h1')).toHaveText('Comments redesign');
});

test('uses selection → New → Submit and keeps comment metadata compact', async ({ page }) => {
  await page.locator('#review-toggle').click();

  await expect(page.locator('#review-panel-title')).toHaveText('Comments');
  await expect(page.locator('#review-new-comment')).toBeDisabled();
  await expect(page.locator('.review-target-button')).toHaveCount(0);

  await selectPreviewText(page, '#markdown-preview p', 'precise phrase');
  await expect(page.locator('#review-new-comment')).toBeEnabled();
  await expect(page.locator('.review-pending-highlight')).toHaveText('precise phrase');

  await page.locator('#review-new-comment').click();
  await expect(page.locator('#review-composer')).toBeVisible();
  await expect(page.locator('#review-composer-author')).toHaveText('Baivab Sarkar');
  await expect(page.locator('#review-composer-anchor')).toHaveText('precise phrase');
  await page.locator('#review-feedback-input').fill('This wording is clear.');
  await page.locator('#review-feedback-submit').click();

  const card = page.locator('.review-thread');
  await expect(card).toHaveCount(1);
  await expect(card.locator('.review-author-name')).toHaveText('Baivab Sarkar');
  await expect(card.locator('.review-thread-body')).toHaveText('This wording is clear.');
  await expect(page.locator('.review-comment-highlight')).toHaveText('precise phrase');
  await expect(card.locator('.review-thread-details')).toBeVisible();
  await expect(card.locator('.review-thread-time')).toContainText('Opened:');
  await expect(card).not.toContainText('Closed: Not closed');

  await page.locator('#review-panel-close').click();
  await page.reload();
  await page.locator('#review-toggle').click();
  await expect(page.locator('.review-thread')).toContainText('This wording is clear.');
  await expect(page.locator('.review-comment-highlight')).toHaveText('precise phrase');
  expect(JSON.stringify(await storedDocuments(page))).toContain('This wording is clear.');
});

test('synchronizes hover and click states in both directions', async ({ page }) => {
  await page.locator('#review-toggle').click();
  await selectPreviewText(page, '#markdown-preview p', 'precise phrase');
  await page.locator('#review-new-comment').click();
  await page.locator('#review-feedback-input').fill('Synchronized comment.');
  await page.locator('#review-feedback-submit').click();

  const card = page.locator('.review-thread');
  const highlight = page.locator('.review-comment-highlight');
  await page.locator('.review-panel-header').hover();
  await card.hover();
  await expect(highlight).toHaveClass(/is-review-highlight-hover|is-review-highlight-active/);

  await page.locator('.review-panel-header').hover();
  await highlight.hover();
  await expect(card).toHaveClass(/is-review-thread-active|is-review-thread-hover/);

  await highlight.click();
  await expect(card).toHaveClass(/is-review-thread-active/);
  await expect(card.locator('.review-thread-details')).toBeVisible();

  await page.locator('.review-panel-header').hover();
  await card.click();
  await expect(highlight).toHaveClass(/is-review-highlight-active/);
});

test('comments on images, rendered math, diagrams, and resolves without empty closed metadata', async ({ page }) => {
  await page.locator('#review-toggle').click();

  for (const [selector, text] of [
    ['#markdown-preview img', 'Image comment.'],
    ['#markdown-preview mjx-container', 'Math comment.'],
    ['#markdown-preview .diagram-viewer', 'Diagram comment.']
  ]) {
    await expect(page.locator(selector).first()).toBeVisible();
    await page.locator(selector).first().click();
    await expect(page.locator('#review-new-comment')).toBeEnabled();
    await page.locator('#review-new-comment').click();
    await page.locator('#review-feedback-input').fill(text);
    await page.locator('#review-feedback-submit').click();
  }

  await expect(page.locator('.review-thread')).toHaveCount(3);
  await expect(page.locator('.review-comment-element')).toHaveCount(3);
  const activeCard = page.locator('.review-thread').filter({ hasText: 'Math comment.' });
  await activeCard.click();
  await activeCard.locator('[data-review-action="toggle-resolved"]').click();
  await page.locator('[data-review-filter="resolved"]').click();
  const resolvedCard = page.locator('.review-thread').filter({ hasText: 'Math comment.' });
  await expect(resolvedCard).toBeVisible();
  await resolvedCard.click();
  await expect(resolvedCard.locator('.review-thread-time.is-closed')).toContainText('Closed:');
  await expect(page.locator('.review-status-label')).toHaveAttribute('aria-label', 'Resolved');
});
