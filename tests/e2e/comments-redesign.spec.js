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
  await expect(page.locator('.review-pending-highlight, .review-pending-element')).toHaveCount(0);
  await expect(page.locator('.review-comment-highlight, .review-comment-element')).toHaveCount(0);

  await page.locator('#review-new-comment').click();
  await expect(page.locator('#review-composer')).toBeVisible();
  await expect(page.locator('#review-composer-author')).toHaveText('Author');
  await expect(page.locator('#review-composer-avatar')).toHaveText('A');
  await expect(page.locator('.review-composer-heading, #review-composer-anchor')).toHaveCount(0);
  await expect(page.locator('.review-pending-highlight')).toHaveText('precise phrase');

  await page.locator('#review-composer-cancel').click();
  await expect(page.locator('.review-pending-highlight, .review-pending-element')).toHaveCount(0);
  await expect(page.locator('#review-new-comment')).toBeEnabled();
  await page.locator('#review-new-comment').click();
  await expect(page.locator('.review-pending-highlight')).toHaveText('precise phrase');
  await page.locator('#review-feedback-input').fill('This wording is clear.');
  await page.locator('#review-feedback-submit').click();

  const card = page.locator('.review-thread');
  await expect(card).toHaveCount(1);
  await expect(card.locator('.review-author-name').first()).toHaveText('Author');
  await expect(card.locator('.review-author-avatar').first()).toHaveText('A');
  await expect(card.locator('.review-thread-body')).toHaveText('This wording is clear.');
  await expect(page.locator('.review-comment-highlight')).toHaveText('precise phrase');
  await expect(card.locator('.review-thread-details, .review-thread-anchor')).toHaveCount(0);
  await expect(card.locator('.review-thread-dates')).toBeVisible();
  await expect(card.locator('.review-thread-time').first()).not.toContainText('Opened:');
  await expect(card).not.toContainText('Closed: Not closed');

  await page.locator('#review-panel-close').click();
  await page.reload();
  await page.locator('#review-toggle').click();
  await expect(page.locator('.review-thread')).toContainText('This wording is clear.');
  await expect(page.locator('.review-thread-dates')).toBeVisible();
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
  await expect(card.locator('.review-thread-details, .review-thread-anchor')).toHaveCount(0);
  await expect(card).toHaveCSS('border-color', 'rgb(3, 102, 214)');
  await expect(page.locator('#markdown-preview p').filter({ hasText: 'precise phrase' })).not.toHaveClass(/is-review-highlight-active/);
  await expect(highlight).toHaveClass(/is-review-highlight-active/);

  await page.locator('.review-panel-header').hover();
  await card.click();
  await expect(highlight).toHaveClass(/is-review-highlight-active/);
});

test('adds nested replies and persists their author and timestamp', async ({ page }) => {
  await page.locator('#review-toggle').click();
  await selectPreviewText(page, '#markdown-preview p', 'precise phrase');
  await page.locator('#review-new-comment').click();
  await page.locator('#review-feedback-input').fill('Top-level comment.');
  await page.locator('#review-feedback-submit').click();

  const card = page.locator('.review-thread');
  await expect(card.locator('.review-reply-input')).toBeVisible();
  await card.locator('.review-reply-input').fill('First nested reply.');
  await card.locator('.review-reply-submit').click();
  await expect(card.locator('.review-reply')).toHaveCount(1);
  await expect(card.locator('.review-reply .review-author-name')).toHaveText('Author');
  await expect(card.locator('.review-reply-body')).toHaveText('First nested reply.');
  await expect(card.locator('.review-reply-time')).not.toBeEmpty();

  await card.locator('.review-reply-input').fill('Second nested reply.');
  await card.locator('.review-reply-input').press('Enter');
  await expect(card.locator('.review-reply')).toHaveCount(2);

  await page.reload();
  await page.locator('#review-toggle').click();
  await page.locator('.review-thread').click();
  await expect(page.locator('.review-reply')).toHaveCount(2);
  expect(JSON.stringify(await storedDocuments(page))).toContain('Second nested reply.');
});

test('keeps comment actions and nested indentation consistent across screen sizes', async ({ page }) => {
  await page.locator('#review-toggle').click();
  await selectPreviewText(page, '#markdown-preview p', 'precise phrase');
  await page.locator('#review-new-comment').click();
  await page.locator('#review-feedback-input').fill('Responsive comment.');
  await page.locator('#review-feedback-submit').click();

  const card = page.locator('.review-thread');
  await card.locator('.review-reply-input').fill('Indented reply.');
  await card.locator('.review-reply-submit').click();

  const measurements = [];
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 900, height: 720 },
    { width: 375, height: 667 }
  ]) {
    await page.setViewportSize(viewport);
    await card.scrollIntoViewIfNeeded();
    measurements.push(await card.evaluate(element => {
      const actions = element.querySelector('.review-thread-actions');
      const buttons = Array.from(element.querySelectorAll('.review-thread-action'));
      const icons = Array.from(element.querySelectorAll('.review-thread-action i'));
      const topAvatar = element.querySelector(':scope > .review-thread-header .review-author-avatar');
      const replyAvatar = element.querySelector('.review-reply .review-author-avatar');
      const panel = element.closest('#review-panel');
      return {
        actionWidth: Math.round(actions.getBoundingClientRect().width),
        actionHeight: Math.round(actions.getBoundingClientRect().height),
        buttonWidths: buttons.map(button => Math.round(button.getBoundingClientRect().width)),
        buttonHeights: buttons.map(button => Math.round(button.getBoundingClientRect().height)),
        buttonRows: new Set(buttons.map(button => Math.round(button.getBoundingClientRect().top))).size,
        iconSizes: icons.map(icon => Math.round(icon.getBoundingClientRect().width)),
        replyIndent: Math.round(replyAvatar.getBoundingClientRect().left - topAvatar.getBoundingClientRect().left),
        cardOverflow: element.scrollWidth - element.clientWidth,
        panelOverflow: panel.scrollWidth - panel.clientWidth,
        nameFont: getComputedStyle(element.querySelector('.review-author-name')).fontFamily,
        bodyFont: getComputedStyle(document.body).fontFamily,
        activeBackground: getComputedStyle(element).backgroundColor,
        replyButtonBackground: getComputedStyle(element.querySelector('.review-reply-submit')).backgroundColor
      };
    }));
  }

  measurements.forEach(metrics => {
    expect(metrics.actionWidth).toBeLessThanOrEqual(82);
    expect(metrics.actionHeight).toBe(30);
    expect(metrics.buttonWidths).toEqual([24, 24, 24]);
    expect(metrics.buttonHeights).toEqual([24, 24, 24]);
    expect(metrics.buttonRows).toBe(1);
    expect(metrics.iconSizes).toEqual([14, 14, 14]);
    expect(metrics.replyIndent).toBeGreaterThanOrEqual(18);
    expect(metrics.cardOverflow).toBeLessThanOrEqual(0);
    expect(metrics.panelOverflow).toBeLessThanOrEqual(0);
    expect(metrics.nameFont).toBe(metrics.bodyFont);
    expect(metrics.activeBackground).toBe('rgb(255, 255, 255)');
    expect(metrics.replyButtonBackground).toBe('rgb(3, 102, 214)');
  });
});

test('comments on images, rendered math, diagrams, and resolves without empty closed metadata', async ({ page }) => {
  await page.locator('#review-toggle').click();

  for (const [selector, clickSelector, text] of [
    ['#markdown-preview img[alt="Reference image"]', '#markdown-preview img[alt="Reference image"]', 'Image comment.'],
    ['#markdown-preview mjx-container', '#markdown-preview mjx-container', 'Math comment.'],
    ['#markdown-preview .diagram-viewer', '#markdown-preview .diagram-viewer svg', 'Diagram comment.']
  ]) {
    await expect(page.locator(selector).first()).toBeVisible();
    await expect(page.locator(clickSelector).first()).toBeVisible();
    await page.locator(clickSelector).first().click();
    await expect(page.locator('#review-new-comment')).toBeEnabled();
    await page.locator('#review-new-comment').click();
    await expect(page.locator(selector).first()).toHaveClass(/review-pending-element/);
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
