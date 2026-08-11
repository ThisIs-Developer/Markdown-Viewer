const { test, expect } = require('@playwright/test');
const {
  openApp,
  setEditorContent,
  editorValue,
  storedDocuments,
  stubLazyRendererLibraries
} = require('../helpers/app');

const reviewMarkdown = `# Review heading

Paragraph for focused feedback.

\`\`\`javascript
console.log('review');
\`\`\`

\`\`\`mermaid
flowchart LR
  A --> B
\`\`\``;

test.beforeEach(async ({ page }) => {
  await stubLazyRendererLibraries(page);
  await openApp(page);
  await setEditorContent(page, reviewMarkdown);
  await expect(page.locator('#markdown-preview h1')).toHaveText('Review heading');
});

test('adds persistent comments and suggestions without changing Markdown', async ({ page }) => {
  const original = await editorValue(page);
  await page.locator('#review-toggle').click();

  await expect(page.locator('#review-panel')).toBeVisible();
  await expect(page.locator('#markdown-editor')).toHaveAttribute('readonly', '');
  await expect(page.locator('#review-pins-layer .review-target-button')).toHaveCount(4);
  const pinWidths = await page.locator('#review-pins-layer .review-target-button').evaluateAll((pins) => (
    pins.map((pin) => pin.getBoundingClientRect().width)
  ));
  expect(Math.max(...pinWidths)).toBeLessThanOrEqual(44);
  await expect(page.locator('#markdown-preview > h1.review-target')).toHaveText('Review heading');

  await page.locator('#review-pins-layer .review-target-button[data-review-anchor^="heading:"]').click();
  await page.locator('#review-feedback-input').fill('Clarify the audience for this section.');
  await page.locator('#review-feedback-submit').click();
  await expect(page.locator('.review-thread')).toContainText('Clarify the audience');

  await page.locator('#review-pins-layer .review-target-button[data-review-anchor^="paragraph:"]').click();
  await page.locator('[data-review-kind="suggestion"]').click();
  await page.locator('#review-feedback-input').fill('Use a shorter opening sentence.');
  await page.locator('#review-feedback-submit').click();

  await expect(page.locator('.review-thread[data-kind="suggestion"]')).toContainText('Use a shorter opening');
  await expect(page.locator('.review-thread-dates')).toHaveCount(2);
  await expect(page.locator('.review-thread-dates').first()).toContainText('Opened:');
  await expect(page.locator('.review-thread-dates').first()).toContainText('Closed: Not closed');
  await expect(page.locator('#review-toolbar-count')).toHaveText('2');
  const reviewButtonMetrics = await page.locator('#review-toggle').evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const count = button.querySelector('#review-toolbar-count');
    return {
      height: rect.height,
      width: rect.width,
      countVisible: count && getComputedStyle(count).display !== 'none',
      countText: count && count.textContent,
      active: button.classList.contains('is-active')
    };
  });
  expect(reviewButtonMetrics.height).toBe(30);
  expect(reviewButtonMetrics.width).toBeGreaterThan(30);
  expect(reviewButtonMetrics).toMatchObject({ countVisible: true, countText: '2', active: true });
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text) => { window.__copiedReviewSummary = text; } }
    });
  });
  await page.locator('#review-copy-summary').click();
  const copiedSummary = await page.evaluate(() => window.__copiedReviewSummary);
  expect(copiedSummary).toContain('Generated:');
  expect(copiedSummary).toContain('Total items: 2');
  expect(copiedSummary).toContain('Open items: 2');
  expect(copiedSummary).toContain('Resolved items: 0');
  expect(copiedSummary).toContain('Opened:');
  expect(copiedSummary).toContain('Closed: Not closed');
  await expect.poll(() => editorValue(page)).toBe(original);
  await expect.poll(async () => JSON.stringify(await storedDocuments(page))).toContain('Clarify the audience');

  await page.reload();
  await expect(page.locator('#markdown-editor')).toBeVisible();
  await page.locator('#review-toggle').click();
  await expect(page.locator('.review-thread')).toHaveCount(2);
  await expect(page.locator('#review-toolbar-count')).toHaveText('2');
});

test('uses an in-app confirmation modal when deleting a review item', async ({ page }) => {
  await page.evaluate(() => {
    window.confirm = () => { throw new Error('Native confirm should not be used for review deletion.'); };
  });
  await page.locator('#review-toggle').click();
  await page.locator('#review-pins-layer .review-target-button[data-review-anchor^="heading:"]').click();
  await page.locator('#review-feedback-input').fill('Delete this through the app modal.');
  await page.locator('#review-feedback-submit').click();

  await page.locator('[data-review-action="delete"]').click();
  await expect(page.locator('#review-delete-modal')).toBeVisible();
  await expect(page.locator('#review-delete-modal')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#review-delete-title')).toHaveText('Delete review item?');
  await expect.poll(() => page.evaluate(() => document.activeElement && document.activeElement.id)).toBe('review-delete-cancel');

  await page.locator('#review-delete-modal').press('Escape');
  await expect(page.locator('#review-delete-modal')).toBeHidden();
  await expect(page.locator('#review-panel')).toBeVisible();
  await expect(page.locator('.review-thread')).toHaveCount(1);

  await page.locator('[data-review-action="delete"]').click();
  await page.locator('#review-delete-confirm').click();
  await expect(page.locator('.review-thread')).toHaveCount(0);
  await expect(page.locator('#review-toolbar-count')).toBeHidden();
  await expect(page.locator('#review-delete-modal')).toBeHidden();
});

test('resolves and deletes all review items from the panel toolbar', async ({ page }) => {
  await page.locator('#review-toggle').click();
  await page.locator('#review-pins-layer .review-target-button[data-review-anchor^="heading:"]').click();
  await page.locator('#review-feedback-input').fill('First bulk review item.');
  await page.locator('#review-feedback-submit').click();
  await page.locator('#review-pins-layer .review-target-button[data-review-anchor^="paragraph:"]').click();
  await page.locator('#review-feedback-input').fill('Second bulk review item.');
  await page.locator('#review-feedback-submit').click();

  await expect(page.locator('#review-resolve-all')).toBeEnabled();
  await expect(page.locator('#review-delete-all')).toBeEnabled();
  await page.locator('#review-resolve-all').click();
  await expect(page.locator('#review-toolbar-count')).toBeHidden();
  await expect(page.locator('#review-panel-summary')).toHaveText('All feedback resolved');
  await page.locator('[data-review-filter="resolved"]').click();
  await expect(page.locator('.review-thread')).toHaveCount(2);
  await expect(page.locator('.review-thread-dates').first()).toContainText('Closed:');
  await expect(page.locator('.review-thread-dates').first()).not.toContainText('Closed: Not closed');
  const readResolvedAtValues = async () => {
    const documents = await storedDocuments(page);
    return documents.flatMap((tab) => (tab.reviewThreads || []).map((thread) => thread.resolvedAt));
  };
  await expect.poll(async () => (await readResolvedAtValues()).length).toBe(2);
  const resolvedAtValues = await readResolvedAtValues();
  expect(resolvedAtValues).toHaveLength(2);
  expect(resolvedAtValues.every(Number.isFinite)).toBe(true);

  await page.locator('#review-delete-all').click();
  await expect(page.locator('#review-delete-title')).toHaveText('Delete all review items?');
  await expect(page.locator('#review-delete-description')).toContainText('All 2 review items in this document');
  await page.locator('#review-delete-cancel').click();
  await expect(page.locator('.review-thread')).toHaveCount(2);

  await page.locator('#review-delete-all').click();
  await page.locator('#review-delete-confirm').click();
  await expect(page.locator('.review-thread')).toHaveCount(0);
  await expect(page.locator('#review-copy-summary')).toBeDisabled();
  await expect(page.locator('#review-resolve-all')).toBeDisabled();
  await expect(page.locator('#review-delete-all')).toBeDisabled();
});

test('resolves feedback and retains an orphaned thread when its block changes', async ({ page }) => {
  await page.locator('#review-toggle').click();
  await page.locator('#review-pins-layer .review-target-button[data-review-anchor^="heading:"]').click();
  await page.locator('#review-feedback-input').fill('Rework this heading.');
  await page.locator('#review-feedback-submit').click();

  await page.locator('.review-thread-action', { hasText: 'Resolve' }).click();
  await expect(page.locator('#review-toolbar-count')).toBeHidden();
  await page.locator('[data-review-filter="resolved"]').click();
  await expect(page.locator('.review-thread')).toContainText('Resolved');

  await page.locator('#review-panel-close').click();
  await setEditorContent(page, reviewMarkdown.replace('# Review heading', '# Replacement heading'));
  await expect(page.locator('#markdown-preview h1')).toHaveText('Replacement heading');
  await page.locator('#review-toggle').click();
  await page.locator('[data-review-filter="all"]').click();
  await expect(page.locator('.review-thread')).toHaveClass(/is-orphaned/);
  await expect(page.locator('.review-thread-anchor')).toContainText('Anchor no longer in preview');
});

test('does not duplicate review mode inside mobile settings', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator('#mobile-menu-toggle').click();
  await page.locator('[data-mobile-menu-section-toggle]', { hasText: 'Settings' }).click();

  await expect(page.locator('#mobile-review-toggle')).toHaveCount(1);
  await expect(page.locator('#review-toggle')).toBeAttached();
});

test('keeps feedback orphaned when the number of identical blocks changes', async ({ page }) => {
  await setEditorContent(page, '# Duplicates\n\nRepeated paragraph.\n\nRepeated paragraph.');
  await expect(page.locator('#markdown-preview p')).toHaveCount(2);
  await page.locator('#review-toggle').click();
  await page.locator('#review-pins-layer .review-target-button[data-review-anchor^="paragraph:"]').nth(1).click();
  await page.locator('#review-feedback-input').fill('Feedback for the second copy.');
  await page.locator('#review-feedback-submit').click();
  await page.locator('#review-panel-close').click();

  await setEditorContent(page, '# Duplicates\n\nRepeated paragraph.\n\nRepeated paragraph.\n\nRepeated paragraph.');
  await expect(page.locator('#markdown-preview p')).toHaveCount(3);
  await page.locator('#review-toggle').click();
  await expect(page.locator('.review-thread')).toHaveClass(/is-orphaned/);
});

test('keeps feedback orphaned when identical blocks are reordered', async ({ page }) => {
  const firstOrder = '# First\n\nRepeated paragraph.\n\n# Second\n\nRepeated paragraph.';
  const secondOrder = '# Second\n\nRepeated paragraph.\n\n# First\n\nRepeated paragraph.';
  await setEditorContent(page, firstOrder);
  await expect(page.locator('#markdown-preview p')).toHaveCount(2);
  await page.locator('#review-toggle').click();
  await page.locator('#review-pins-layer .review-target-button[data-review-anchor^="paragraph:"]').nth(1).click();
  await page.locator('#review-feedback-input').fill('Feedback for the paragraph under Second.');
  await page.locator('#review-feedback-submit').click();
  await page.locator('#review-panel-close').click();

  await setEditorContent(page, secondOrder);
  await expect(page.locator('#markdown-preview h1').first()).toHaveText('Second');
  await page.locator('#review-toggle').click();
  await expect(page.locator('.review-thread')).toHaveClass(/is-orphaned/);
});

test('keeps feedback attached when content near a unique block changes', async ({ page }) => {
  await setEditorContent(page, '# Stable\n\nUnique reviewed paragraph.\n\nOriginal neighbor.');
  await page.locator('#review-toggle').click();
  await page.locator('#review-pins-layer .review-target-button[data-review-anchor^="paragraph:"]').first().click();
  await page.locator('#review-feedback-input').fill('Keep this attached to the unique paragraph.');
  await page.locator('#review-feedback-submit').click();
  await page.locator('#review-panel-close').click();

  await setEditorContent(page, '# Stable\n\nUnique reviewed paragraph.\n\nInserted neighbor.\n\nOriginal neighbor.');
  await page.locator('#review-toggle').click();
  await expect(page.locator('.review-thread')).not.toHaveClass(/is-orphaned/);
  await expect(page.locator('.review-thread-anchor')).not.toContainText('Anchor no longer in preview');
});

test('keeps math feedback attached after asynchronous typesetting and reload', async ({ page }) => {
  const installMathJaxStub = () => {
    window.MathJax = {
      startup: { promise: Promise.resolve() },
      typesetClear() {},
      async typesetPromise(targets) {
        await new Promise((resolve) => setTimeout(resolve, 30));
        targets.forEach((target) => {
          target.innerHTML = 'Typeset equation <mjx-container>output</mjx-container>';
        });
      }
    };
  };
  await page.addInitScript(installMathJaxStub);
  await page.evaluate(installMathJaxStub);
  await setEditorContent(page, '# Math review\n\nEquation $x^2$ stays anchored.');
  await expect(page.locator('#markdown-preview p')).toContainText('Typeset equation output');

  await page.locator('#review-toggle').click();
  await page.locator('#review-pins-layer .review-target-button[data-review-anchor^="paragraph:"]').click();
  await page.locator('#review-feedback-input').fill('Check the exponent notation.');
  await page.locator('#review-feedback-submit').click();
  await expect(page.locator('.review-thread')).not.toHaveClass(/is-orphaned/);

  await page.reload();
  await expect(page.locator('#markdown-preview p')).toContainText('Typeset equation output');
  await page.locator('#review-toggle').click();
  await expect(page.locator('.review-thread')).not.toHaveClass(/is-orphaned/);
  await expect(page.locator('.review-thread-anchor')).not.toContainText('Anchor no longer in preview');
});

test('closes Review mode for a new tab and restores the previous tab view', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Markdown' }).click();
  await expect(page.locator('.content-container')).toHaveClass(/view-editor-only/);
  await page.locator('#review-toggle').click();
  await expect(page.locator('.content-container')).toHaveClass(/view-preview-only/);

  await page.locator('#tab-new-btn').click();
  await expect(page.locator('#review-panel')).toBeHidden();
  await expect(page.locator('#review-toggle')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.content-container')).toHaveClass(/view-split/);

  await page.locator('#tab-list [role="tab"]').filter({ hasText: 'Welcome to Markdown' }).click();
  await expect(page.locator('.content-container')).toHaveClass(/view-editor-only/);
});
