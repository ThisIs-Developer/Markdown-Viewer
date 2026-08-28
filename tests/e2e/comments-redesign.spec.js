const { test, expect } = require('@playwright/test');
const {
  openApp,
  setEditorContent,
  stubLazyRendererLibraries,
  storedDocuments,
  waitForAppReady
} = require('../helpers/app');

async function selectPreviewText(page, selector, selectedText, clickAfterMouseup = false) {
  await page.locator(selector).filter({ hasText: selectedText }).first().evaluate((element, options) => {
    const { text, clickAfterMouseup } = options;
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
    if (clickAfterMouseup) {
      const rect = range.getClientRects()[0];
      element.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        clientX: rect.left + (rect.width / 2),
        clientY: rect.top + (rect.height / 2)
      }));
    }
  }, { text: selectedText, clickAfterMouseup });
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
  await expect(page.locator('.review-pending-highlight')).toHaveCount(0);
  await expect(page.locator('.review-comment-highlight, .review-comment-element')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.getSelection().toString())).toBe('precise phrase');

  await page.locator('#markdown-preview h1').click();
  await expect(page.locator('#review-new-comment')).toBeDisabled();
  await expect.poll(() => page.evaluate(() => window.getSelection().isCollapsed)).toBe(true);

  await selectPreviewText(page, '#markdown-preview p', 'precise phrase');
  await expect(page.locator('#review-new-comment')).toBeEnabled();

  await page.locator('#review-new-comment').click();
  await expect(page.locator('#review-composer')).toBeVisible();
  await expect(page.locator('#review-composer-author')).toHaveText('Author');
  await expect(page.locator('#review-composer-avatar')).toHaveText('A');
  await expect(page.locator('.review-composer-heading, #review-composer-anchor')).toHaveCount(0);
  await expect(page.locator('.review-pending-highlight')).toHaveCount(0);
  await expect(page.locator('#review-feedback-input')).toBeFocused();
  await expect.poll(() => page.evaluate(() => {
    const highlight = CSS.highlights.get('review-pending-native-selection');
    const range = highlight ? Array.from(highlight)[0] : null;
    return {
      nativeSelection: window.getSelection().toString(),
      selectedText: range ? range.toString() : '',
      inputFocused: document.activeElement === document.querySelector('#review-feedback-input')
    };
  })).toEqual({ nativeSelection: '', selectedText: 'precise phrase', inputFocused: true });
  await expect.poll(() => page.locator('#review-feedback-input').evaluate(input => ({
    start: input.selectionStart,
    end: input.selectionEnd
  }))).toEqual({ start: 0, end: 0 });

  await page.locator('.review-panel-header').click();
  await expect(page.locator('#review-composer')).toBeHidden();
  await expect(page.locator('#review-new-comment')).toBeDisabled();
  await expect.poll(() => page.evaluate(() => window.getSelection().isCollapsed)).toBe(true);
  await expect.poll(() => page.evaluate(() => CSS.highlights.has('review-pending-native-selection'))).toBe(false);

  await selectPreviewText(page, '#markdown-preview p', 'precise phrase');
  await page.locator('#review-new-comment').click();
  await expect(page.locator('#review-composer')).toBeVisible();
  await page.keyboard.type('Unsaved draft');
  await page.locator('.review-panel-header').click();
  await expect(page.locator('#review-composer')).toBeVisible();
  await expect(page.locator('#review-feedback-input')).toHaveValue('Unsaved draft');
  await page.locator('#review-composer-cancel').click();
  await expect(page.locator('#review-composer')).toBeHidden();
  await expect(page.locator('#review-new-comment')).toBeDisabled();

  await selectPreviewText(page, '#markdown-preview p', 'precise phrase');
  await page.locator('#review-new-comment').click();
  await expect(page.locator('#review-composer')).toBeVisible();
  await expect(page.locator('.review-pending-highlight')).toHaveCount(0);
  await page.locator('#review-feedback-input').fill('This wording is clear.');
  await expect(page.locator('#review-feedback-submit')).toBeEnabled();
  await page.locator('#review-feedback-submit').click();
  await expect(page.locator('#review-composer')).toBeHidden();
  expect(await page.evaluate(() => ({
    inputValue: document.querySelector('#review-feedback-input').value,
    summary: document.querySelector('#review-panel-summary').textContent,
    selection: window.getSelection().toString()
  }))).toEqual({ inputValue: '', summary: '1 comment', selection: '' });

  const card = page.locator('.review-thread');
  await expect(card).toHaveCount(1);
  await expect(card.locator('.review-author-name').first()).toHaveText('Author');
  await expect(card.locator('.review-author-avatar').first()).toHaveText('A');
  await expect(card.locator('.review-thread-body')).toHaveText('This wording is clear.');
  const submittedHighlight = page.locator('.review-comment-highlight');
  await expect(submittedHighlight).toHaveText('precise phrase');
  await expect(submittedHighlight).toHaveClass(/is-review-selection-start/);
  await expect(submittedHighlight).toHaveClass(/is-review-selection-end/);
  const markerTypography = await submittedHighlight.evaluate(element => ({
    highlightHeight: element.getBoundingClientRect().height,
    startBorderWidth: parseFloat(getComputedStyle(element).borderInlineStartWidth),
    endBorderWidth: parseFloat(getComputedStyle(element).borderInlineEndWidth),
    startBorderStyle: getComputedStyle(element).borderInlineStartStyle,
    endBorderStyle: getComputedStyle(element).borderInlineEndStyle
  }));
  expect(markerTypography.highlightHeight).toBeGreaterThan(0);
  expect(markerTypography.startBorderWidth).toBe(2);
  expect(markerTypography.endBorderWidth).toBe(2);
  expect(markerTypography.startBorderStyle).toBe('solid');
  expect(markerTypography.endBorderStyle).toBe('solid');
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
  await waitForAppReady(page);
  await page.locator('#review-toggle').click();
  await expect(page.locator('.review-thread')).toContainText('This wording is clear.');
  await expect(page.locator('.review-thread-dates')).toBeVisible();
  const persistedHighlight = page.locator('.review-comment-highlight');
  await expect(persistedHighlight).toHaveText('precise phrase');
  const persistedHighlightStyle = await persistedHighlight.evaluate(element => ({
    background: getComputedStyle(element).backgroundColor,
    underline: getComputedStyle(element).boxShadow,
    visibleRects: element.getClientRects().length
  }));
  expect(persistedHighlightStyle.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(persistedHighlightStyle.background).not.toBe('transparent');
  expect(persistedHighlightStyle.underline).not.toBe('none');
  expect(persistedHighlightStyle.visibleRects).toBeGreaterThan(0);
  expect(JSON.stringify(await storedDocuments(page))).toContain('This wording is clear.');
});

test('highlights complete and cross-format inline text-node selections after submit and reload', async ({ page }) => {
  const leadText = 'A local-first Markdown editor and viewer with live preview.';
  const mixedText = 'Plain bold italic linked code struck.';
  const mixedMarkdown = 'Plain **bold** *italic* [linked](https://example.com) `code` ~~struck~~.';
  await setEditorContent(page, `<div align="center">

  **${leadText}**

  Open, write, organize, review, render, export, and optionally share Markdown.

</div>

${mixedMarkdown}`);
  await expect(page.locator('#markdown-preview strong').filter({ hasText: leadText })).toBeVisible();
  await page.locator('#review-toggle').click();

  await addTextComment(page, '#markdown-preview p', leadText, 'Whole bold-node comment.');
  const leadParagraph = page.locator('#markdown-preview p').filter({ hasText: leadText });
  await expect(leadParagraph.locator('strong > .review-comment-highlight')).toHaveText(leadText);

  await addTextComment(page, '#markdown-preview p', mixedText, 'Cross-format comment.');
  const mixedParagraph = page.locator('#markdown-preview p').filter({ hasText: mixedText });
  await expect.poll(async () => {
    return (await mixedParagraph.locator('.review-comment-highlight').allTextContents()).join('');
  }).toBe(mixedText);
  expect(await mixedParagraph.evaluate(element => ({
    bold: Boolean(element.querySelector('strong > .review-comment-highlight')),
    italic: Boolean(element.querySelector('em > .review-comment-highlight')),
    link: Boolean(element.querySelector('a > .review-comment-highlight')),
    code: Boolean(element.querySelector('code > .review-comment-highlight')),
    struck: Boolean(element.querySelector('del > .review-comment-highlight'))
  }))).toEqual({ bold: true, italic: true, link: true, code: true, struck: true });

  await page.locator('#review-panel-close').click();
  await setEditorContent(page, `<div align="center">

  ***${leadText}***

  Open, write, organize, review, render, export, and optionally share Markdown.

</div>

Intro ${mixedMarkdown}`);
  await expect(page.locator('#markdown-preview p').filter({ hasText: `Intro ${mixedText}` })).toBeVisible();
  await page.locator('#review-toggle').click();
  await expect(page.locator('#markdown-preview p').filter({ hasText: leadText })
    .locator('em > strong > .review-comment-highlight')).toHaveText(leadText);
  await expect.poll(async () => {
    return (await page.locator('#markdown-preview p').filter({ hasText: `Intro ${mixedText}` })
      .locator('.review-comment-highlight').allTextContents()).join('');
  }).toBe(mixedText);

  await page.locator('#review-panel-close').click();
  await page.reload();
  await waitForAppReady(page);
  await page.locator('#review-toggle').click();
  await expect(page.locator('.review-thread')).toHaveCount(2);
  await expect(page.locator('#markdown-preview p').filter({ hasText: leadText })
    .locator('strong > .review-comment-highlight')).toHaveText(leadText);
  await expect.poll(async () => {
    return (await page.locator('#markdown-preview p').filter({ hasText: mixedText })
      .locator('.review-comment-highlight').allTextContents()).join('');
  }).toBe(mixedText);
});

test('blocks hyperlinks and linked badges only while Comments mode is active', async ({ page }) => {
  await setEditorContent(page, `[External link](https://example.com)

[Jump to target](#review-link-target)

<a href="https://github.com/ThisIs-Developer/Markdown-Viewer"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" alt="GitHub badge" width="120" height="24"></a>

<h2 id="review-link-target">Target heading</h2>`);
  await expect(page.locator('#markdown-preview img[alt="GitHub badge"]')).toBeVisible();
  await page.evaluate(() => {
    window.__reviewOpenedUrls = [];
    window.__reviewAnchorScrolls = 0;
    window.open = url => {
      window.__reviewOpenedUrls.push(url);
      return null;
    };
    document.querySelector('#review-link-target').scrollIntoView = () => {
      window.__reviewAnchorScrolls += 1;
    };
  });
  await page.locator('#review-toggle').click();

  await page.getByRole('link', { name: 'External link' }).click();
  await page.getByRole('link', { name: 'Jump to target' }).click();
  await page.locator('#markdown-preview img[alt="GitHub badge"]').click();
  expect(await page.getByRole('link', { name: 'External link' }).evaluate(link => {
    return !link.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }));
  })).toBe(true);
  await expect(page.locator('#markdown-preview img[alt="GitHub badge"]')).toHaveClass(/is-review-element-selected/);
  await expect(page.locator('#review-new-comment')).toBeEnabled();
  expect(await page.evaluate(() => ({
    openedUrls: window.__reviewOpenedUrls,
    anchorScrolls: window.__reviewAnchorScrolls
  }))).toEqual({ openedUrls: [], anchorScrolls: 0 });

  await page.locator('#review-panel-close').click();
  await page.getByRole('link', { name: 'External link' }).click();
  await page.getByRole('link', { name: 'Jump to target' }).click();
  expect(await page.evaluate(() => ({
    openedUrls: window.__reviewOpenedUrls,
    anchorScrolls: window.__reviewAnchorScrolls
  }))).toEqual({ openedUrls: ['https://example.com'], anchorScrolls: 1 });
});

test('keeps image dimensions and visual alignment stable after adding a comment', async ({ page }) => {
  await setEditorContent(page, `<div align="center">

<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" alt="Review logo" width="100" height="100">

</div>`);
  const image = page.locator('#markdown-preview img[alt="Review logo"]');
  await expect(image).toBeVisible();
  const readGeometry = () => image.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const parentRect = element.parentElement.getBoundingClientRect();
    const style = getComputedStyle(element);
    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const paddingRight = parseFloat(style.paddingRight) || 0;
    const borderLeft = parseFloat(style.borderLeftWidth) || 0;
    const borderRight = parseFloat(style.borderRightWidth) || 0;
    const contentWidth = rect.width - paddingLeft - paddingRight - borderLeft - borderRight;
    const contentCenter = rect.left + borderLeft + paddingLeft + (contentWidth / 2);
    return {
      width: rect.width,
      height: rect.height,
      paddingLeft,
      paddingRight,
      contentCenterOffset: contentCenter - (parentRect.left + (parentRect.width / 2))
    };
  });
  const beforeComment = await readGeometry();

  await page.locator('#review-toggle').click();
  await image.click();
  expect(await readGeometry()).toEqual(beforeComment);
  await page.locator('#review-new-comment').click();
  expect(await readGeometry()).toEqual(beforeComment);
  await page.locator('#review-feedback-input').fill('Logo comment.');
  await page.locator('#review-feedback-submit').click();
  await expect(image).toHaveClass(/review-comment-element/);
  const afterComment = await readGeometry();
  expect(afterComment).toEqual(beforeComment);

  await page.locator('#review-panel-close').click();
  await page.reload();
  await waitForAppReady(page);
  await page.locator('#review-toggle').click();
  await expect(page.locator('.review-thread')).toContainText('Logo comment.');
  expect(await readGeometry()).toEqual(beforeComment);
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

test('keeps toolbar borders at rest and changes only the pointed or open border to blue', async ({ page }) => {
  await page.locator('#review-toggle').click();
  await addTextComment(page, '#markdown-preview p', 'precise phrase', 'Comment one.');
  await addTextComment(page, '#markdown-preview p', 'focused comment', 'Comment two.');
  await addTextComment(page, '#markdown-preview li', 'list item', 'Comment three.');

  const first = page.locator('.review-thread').filter({ hasText: 'Comment one.' });
  const second = page.locator('.review-thread').filter({ hasText: 'Comment two.' });
  const third = page.locator('.review-thread').filter({ hasText: 'Comment three.' });
  const backgroundsBeforeHover = await Promise.all([first, second, third].map(card =>
    card.evaluate(element => getComputedStyle(element).backgroundColor)
  ));
  await second.hover();
  await expect(second).toHaveCSS('border-color', 'rgb(3, 102, 214)');
  await expect(first).toHaveCSS('border-color', 'rgb(225, 228, 232)');
  await expect(third).toHaveCSS('border-color', 'rgb(3, 102, 214)');
  expect(await Promise.all([first, second, third].map(card =>
    card.evaluate(element => getComputedStyle(element).backgroundColor)
  ))).toEqual(backgroundsBeforeHover);

  await page.locator('.review-panel-header').hover();
  await expect(third).toHaveCSS('border-color', 'rgb(3, 102, 214)');
  await expect(first).toHaveCSS('border-color', 'rgb(225, 228, 232)');
  await expect(second).toHaveCSS('border-color', 'rgb(225, 228, 232)');
  expect(await Promise.all([first, second, third].map(card =>
    card.evaluate(element => getComputedStyle(element).backgroundColor)
  ))).toEqual(backgroundsBeforeHover);
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

  const firstReply = card.locator('.review-reply').first();
  await firstReply.hover();
  const replyActions = firstReply.locator('.review-reply-actions');
  await expect(replyActions.locator('[data-review-action="edit-reply"]')).toBeVisible();
  await expect(replyActions.locator('[data-review-action="delete-reply"]')).toBeVisible();
  const actionPosition = await firstReply.evaluate(element => {
    const header = element.querySelector('.review-reply-header').getBoundingClientRect();
    const actions = element.querySelector('.review-reply-actions').getBoundingClientRect();
    return {
      alignedAtTop: Math.abs(actions.top - header.top) <= 1,
      alignedAtEnd: Math.abs(actions.right - header.right) <= 1
    };
  });
  expect(actionPosition).toEqual({ alignedAtTop: true, alignedAtEnd: true });

  await replyActions.locator('[data-review-action="edit-reply"]').click();
  const editInput = card.locator('.review-reply-edit-input');
  await expect(editInput).toBeVisible();
  await expect(editInput).toHaveValue('First nested reply.');
  await editInput.fill('Edited nested reply.');
  await card.locator('[data-review-action="save-reply"]').click();
  await expect(card.locator('.review-reply-body')).toHaveText('Edited nested reply.');

  await card.locator('.review-reply-input').fill('Second nested reply.');
  await card.locator('.review-reply-input').press('Enter');
  await expect(card.locator('.review-reply')).toHaveCount(2);

  const secondReply = card.locator('.review-reply').last();
  await secondReply.hover();
  await secondReply.locator('[data-review-action="delete-reply"]').click();
  await expect(card.locator('.review-reply')).toHaveCount(1);

  await card.locator('.review-reply-input').fill('Persisted nested reply.');
  await card.locator('.review-reply-input').press('Enter');
  await expect(card.locator('.review-reply')).toHaveCount(2);

  await page.reload();
  await waitForAppReady(page);
  await expect(page.locator('#markdown-preview h1')).toHaveText('Comments redesign');
  await page.locator('#review-toggle').click();
  await expect(page.locator('#review-panel')).toBeVisible();
  await page.locator('.review-thread').click();
  await expect(page.locator('.review-reply')).toHaveCount(2);
  await expect(page.locator('.review-reply').first()).toContainText('Edited nested reply.');
  expect(JSON.stringify(await storedDocuments(page))).toContain('Persisted nested reply.');
  expect(JSON.stringify(await storedDocuments(page))).not.toContain('Second nested reply.');
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
      const buttons = Array.from(element.querySelectorAll(':scope > .review-thread-header > .review-thread-actions > .review-thread-action'));
      const icons = Array.from(element.querySelectorAll(':scope > .review-thread-header > .review-thread-actions > .review-thread-action i'));
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
    expect(metrics.activeBorder).toBe('rgb(3, 102, 214)');
    expect(metrics.replyButtonBackground).toBe('rgb(3, 102, 214)');
  });
});

test('comments on YAML, images, rendered math, diagrams, and resolves without empty closed metadata', async ({ page }) => {
  await page.locator('#review-toggle').click();

  const codeBlock = page.locator('#markdown-preview pre').filter({ hasText: 'reviewable code' });
  await expect(codeBlock).not.toHaveAttribute('data-review-anchor', /.+/);
  await codeBlock.click();
  await expect(page.locator('#review-new-comment')).toBeDisabled();

  const yamlTable = page.locator('#markdown-preview .frontmatter-table');
  await expect(yamlTable).toHaveAttribute('data-review-anchor', /.+/);
  await selectPreviewText(page, '#markdown-preview .frontmatter-table', 'Baivab Sarkar', true);
  await expect(page.locator('#review-new-comment')).toBeEnabled();
  await expect(yamlTable).toHaveClass(/has-review-native-text-selection/);
  await expect(yamlTable).not.toHaveClass(/is-review-element-selected|review-pending-element/);
  await expect(yamlTable).toHaveCSS('outline-style', 'none');
  await page.locator('#markdown-preview h1').click();
  await expect(page.locator('#review-new-comment')).toBeDisabled();

  await yamlTable.click();
  await expect(yamlTable).toHaveClass(/is-review-element-selected/);
  await expect(page.locator('#review-new-comment')).toBeEnabled();
  await page.locator('#markdown-preview h1').click();
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
    ['#markdown-preview .frontmatter-table', '#markdown-preview .frontmatter-table', 'YAML comment.'],
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

  await expect(page.locator('.review-thread')).toHaveCount(4);
  await expect(page.locator('.review-comment-element')).toHaveCount(4);
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
