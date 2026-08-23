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

async function addTextComment(page, selector, selectedText, body) {
  await selectPreviewText(page, selector, selectedText);
  await page.locator('#review-new-comment').click();
  await page.locator('#review-feedback-input').fill(body);
  await page.locator('#review-feedback-submit').click();
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

\`\`\`js
console.log('reviewable code');
\`\`\`

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
  await expect(page.locator('.review-comment-highlight, .review-comment-element')).toHaveCount(0);

  await page.locator('#review-new-comment').click();
  await expect(page.locator('#review-composer')).toBeVisible();
  await expect(page.locator('#review-composer-author')).toHaveText('Author');
  await expect(page.locator('#review-composer-avatar')).toHaveText('A');
  await expect(page.locator('.review-composer-heading, #review-composer-anchor')).toHaveCount(0);
  const pendingHighlight = page.locator('.review-pending-highlight');
  await expect(pendingHighlight).toHaveText('precise phrase');
  await expect(pendingHighlight).toHaveClass(/review-selection-start/);
  await expect(pendingHighlight).toHaveClass(/review-selection-end/);
  expect(await pendingHighlight.evaluate(element => getComputedStyle(element, '::before').content)).toBe('""');
  expect(await pendingHighlight.evaluate(element => getComputedStyle(element, '::after').content)).toBe('""');
  const markerTypography = await pendingHighlight.evaluate(element => ({
    highlightHeight: element.getBoundingClientRect().height,
    markerHeight: parseFloat(getComputedStyle(element, '::before').height),
    markerWidth: parseFloat(getComputedStyle(element, '::before').width)
  }));
  expect(markerTypography.markerHeight).toBe(markerTypography.highlightHeight);
  expect(markerTypography.markerWidth).toBe(2);

  await page.locator('#review-composer-cancel').click();
  await expect(page.locator('.review-pending-highlight')).toHaveText('precise phrase');
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
  const metadataOrder = await card.evaluate(element => {
    const name = element.querySelector(':scope > .review-thread-header .review-author-name');
    const time = element.querySelector(':scope > .review-thread-header .review-thread-time');
    const body = element.querySelector(':scope > .review-thread-body');
    return {
      nameBeforeTime: Boolean(name.compareDocumentPosition(time) & Node.DOCUMENT_POSITION_FOLLOWING),
      timeBeforeBody: Boolean(time.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING),
      nameFontSize: parseFloat(getComputedStyle(name).fontSize),
      timeFontSize: parseFloat(getComputedStyle(time).fontSize)
    };
  });
  expect(metadataOrder.nameBeforeTime).toBe(true);
  expect(metadataOrder.timeBeforeBody).toBe(true);
  expect(metadataOrder.timeFontSize).toBeLessThan(metadataOrder.nameFontSize);

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
  await expect(card).toHaveCSS('border-color', 'rgb(196, 181, 253)');
  await expect(page.locator('#markdown-preview p').filter({ hasText: 'precise phrase' })).not.toHaveClass(/is-review-highlight-active/);
  await expect(highlight).toHaveClass(/is-review-highlight-active/);

  await page.locator('.review-panel-header').hover();
  await card.click();
  await expect(highlight).toHaveClass(/is-review-highlight-active/);
});

test('shows a light border only on the pointed or open comment card', async ({ page }) => {
  await page.locator('#review-toggle').click();
  await addTextComment(page, '#markdown-preview p', 'precise phrase', 'Comment one.');
  await addTextComment(page, '#markdown-preview p', 'focused comment', 'Comment two.');
  await addTextComment(page, '#markdown-preview li', 'list item', 'Comment three.');

  const first = page.locator('.review-thread').filter({ hasText: 'Comment one.' });
  const second = page.locator('.review-thread').filter({ hasText: 'Comment two.' });
  const third = page.locator('.review-thread').filter({ hasText: 'Comment three.' });
  await second.hover();
  await expect(second).toHaveCSS('border-color', 'rgb(196, 181, 253)');
  await expect(first).toHaveCSS('border-color', 'rgba(0, 0, 0, 0)');
  await expect(third).toHaveCSS('border-color', 'rgba(0, 0, 0, 0)');

  await page.locator('.review-panel-header').hover();
  await expect(third).toHaveCSS('border-color', 'rgb(196, 181, 253)');
  await expect(first).toHaveCSS('border-color', 'rgba(0, 0, 0, 0)');
  await expect(second).toHaveCSS('border-color', 'rgba(0, 0, 0, 0)');
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
  const replyOrder = await card.locator('.review-reply').evaluate(element => {
    const name = element.querySelector('.review-author-name');
    const time = element.querySelector('.review-reply-time');
    const body = element.querySelector('.review-reply-body');
    return {
      nameBeforeTime: Boolean(name.compareDocumentPosition(time) & Node.DOCUMENT_POSITION_FOLLOWING),
      timeBeforeBody: Boolean(time.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING),
      nameFontSize: parseFloat(getComputedStyle(name).fontSize),
      timeFontSize: parseFloat(getComputedStyle(time).fontSize)
    };
  });
  expect(replyOrder.nameBeforeTime).toBe(true);
  expect(replyOrder.timeBeforeBody).toBe(true);
  expect(replyOrder.timeFontSize).toBeLessThan(replyOrder.nameFontSize);

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
        activeBorder: getComputedStyle(element).borderColor,
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
    expect(metrics.activeBorder).toBe('rgb(196, 181, 253)');
    expect(metrics.replyButtonBackground).toBe('rgb(3, 102, 214)');
  });
});

test('comments on images, rendered math, diagrams, and resolves without empty closed metadata', async ({ page }) => {
  await page.locator('#review-toggle').click();

  const codeBlock = page.locator('#markdown-preview pre').filter({ hasText: 'reviewable code' });
  await expect(codeBlock).not.toHaveAttribute('data-review-anchor', /.+/);
  await codeBlock.click();
  await expect(page.locator('#review-new-comment')).toBeDisabled();

  const yamlTable = page.locator('#markdown-preview .frontmatter-table');
  await expect(yamlTable).not.toHaveAttribute('data-review-anchor', /.+/);
  await yamlTable.click();
  await expect(page.locator('#review-new-comment')).toBeDisabled();

  const image = page.locator('#markdown-preview img[alt="Reference image"]');
  await image.hover();
  await expect(image).toHaveCSS('outline-style', 'dotted');
  await expect(image).toHaveCSS('outline-color', 'rgb(124, 58, 237)');
  await image.click();
  await expect(image).toHaveClass(/is-review-element-selected/);
  await expect(page.locator('#review-new-comment')).toBeEnabled();
  await page.locator('#markdown-preview h1').click();
  await expect(image).not.toHaveClass(/is-review-element-selected|review-pending-element/);
  await expect(page.locator('#review-new-comment')).toBeDisabled();

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

test('collapses long nested conversations to first and last replies and expands on demand', async ({ page }) => {
  await page.locator('#review-toggle').click();
  await selectPreviewText(page, '#markdown-preview p', 'precise phrase');
  await page.locator('#review-new-comment').click();
  await page.locator('#review-feedback-input').fill('Long conversation root.');
  await page.locator('#review-feedback-submit').click();

  const card = page.locator('.review-thread');
  for (let index = 1; index <= 5; index += 1) {
    await card.locator('.review-reply-input').fill(`Nested reply ${index}.`);
    await card.locator('.review-reply-submit').click();
  }

  await expect(card).toHaveClass(/has-collapsible-replies/);
  await expect(card.locator('.review-reply')).toHaveCount(2);
  await expect(card.locator('.review-reply').first()).toContainText('Nested reply 1.');
  await expect(card.locator('.review-reply').last()).toContainText('Nested reply 5.');
  await expect(card.locator('.review-replies-more')).toHaveText('Show 3 more replies');
  const headerToggle = card.locator('.review-thread-actions [data-review-action="toggle-replies"]');
  await expect(headerToggle).toHaveAttribute('aria-label', 'Expand replies');
  await expect(headerToggle.locator('i')).toHaveClass(/lucide-unfold-vertical/);

  await card.locator('.review-replies-more').click();
  await expect(card.locator('.review-reply')).toHaveCount(5);
  await expect(headerToggle).toHaveAttribute('aria-label', 'Collapse replies');
  await expect(headerToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(headerToggle.locator('i')).toHaveClass(/lucide-fold-vertical/);

  await headerToggle.click();
  await expect(card.locator('.review-reply')).toHaveCount(2);
  await expect(headerToggle).toHaveAttribute('aria-label', 'Expand replies');
  await expect(headerToggle.locator('i')).toHaveClass(/lucide-unfold-vertical/);
});
