const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent } = require('../helpers/app');

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

async function openOutline(page) {
  await page.getByRole('button', { name: 'Document Outline', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Document Outline' })).toBeVisible();
}

test('toolbar toggles a keyboard-accessible outline beside fullscreen', async ({ page }) => {
  const toggle = page.getByRole('button', { name: 'Document Outline', exact: true });
  await expect(page.locator('#document-outline')).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle.locator('.lucide-square-menu')).toBeVisible();
  expect(await toggle.evaluate(button => button.previousElementSibling.dataset.mdAction)).toBe('fullscreen');

  await toggle.focus();
  await toggle.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: 'Close Document Outline', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#document-outline')).toBeHidden();
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');

  await openOutline(page);
  await toggle.click();
  await expect(page.locator('#document-outline')).toBeHidden();
});

test('lists rendered headings in order with hierarchy and plain text labels', async ({ page }) => {
  await setEditorContent(page, [
    '---', 'title: Metadata only', '---', '',
    '# **Project** &amp; `API`', '',
    '## [Setup](https://example.com)', '',
    '### Install', '', '#### Configure', '', '##### Advanced', '', '###### Details', '',
    'Setext heading', '---', '',
    '> ## Quoted heading', '',
    '```markdown', '# Fenced code is not a heading', '```', '',
    '    # Indented code is not a heading', '',
    '<h2>HTML <em>heading</em></h2>', '',
    '## <img alt="Image label">', '',
    '##', ''
  ].join('\n'));
  await openOutline(page);
  const items = page.locator('#document-outline-list button');
  await expect(items).toHaveText([
    'Project & API', 'Setup', 'Install', 'Configure', 'Advanced', 'Details',
    'Setext heading', 'Quoted heading', 'HTML heading', 'Image label', 'Untitled heading'
  ]);
  await expect(page.locator('#document-outline-list a, #document-outline-list img')).toHaveCount(0);
  const indents = await items.evaluateAll(buttons => buttons.slice(0, 6).map(button => parseFloat(getComputedStyle(button).paddingInlineStart)));
  expect(indents.every((indent, index) => index === 0 || indent > indents[index - 1])).toBe(true);
});

test('updates while editing, switching documents, and closing the last tab', async ({ page }) => {
  await setEditorContent(page, '# First document');
  await openOutline(page);
  const items = page.locator('#document-outline-list button');
  await expect(items).toHaveText(['First document']);
  await setEditorContent(page, '# Renamed heading\n\n## Added section');
  await expect(items).toHaveText(['Renamed heading', 'Added section']);
  await setEditorContent(page, 'Plain text without headings.');
  await expect(items).toHaveCount(0);
  await expect(page.getByText('No headings in this document.', { exact: true })).toBeVisible();

  await setEditorContent(page, '# First document');
  await page.locator('#tab-new-btn').click();
  await setEditorContent(page, '# Second document');
  await expect(items).toHaveText(['Second document']);
  await page.locator('#tab-list .tab-item').first().click();
  await expect(items).toHaveText(['First document']);

  while (await page.locator('#tab-list .tab-item').count()) {
    await page.locator('#tab-list .tab-item.active .tab-menu-btn').click();
    await page.locator('.tab-menu-dropdown.open [data-action="close"]').click();
  }
  await expect(page.locator('#document-outline')).toBeHidden();
  await expect(items).toHaveCount(0);
  await expect(page.locator('#document-outline-toggle')).toBeDisabled();
});

test('navigates repeated headings and follows the current preview section', async ({ page }) => {
  await setEditorContent(page, '# Repeated\n\n' + 'Paragraph content.\n\n'.repeat(70) +
    '## Repeated\n\n' + 'More paragraph content.\n\n'.repeat(70));
  await openOutline(page);
  const items = page.locator('#document-outline-list button');
  await expect(items).toHaveText(['Repeated', 'Repeated']);
  await items.nth(1).click();
  await expect(items.nth(1)).toHaveAttribute('aria-current', 'location');
  const sectionOffset = await page.locator('#markdown-preview h2').evaluate(heading =>
    heading.getBoundingClientRect().top - document.querySelector('.preview-pane').getBoundingClientRect().top);
  expect(sectionOffset).toBeGreaterThanOrEqual(0);
  expect(sectionOffset).toBeLessThan(50);
  await page.locator('.preview-pane').click();
  await page.locator('.preview-pane').evaluate(pane => { pane.scrollTop = 0; });
  await expect(items.first()).toHaveAttribute('aria-current', 'location');

  await page.getByRole('button', { name: 'Edit Markdown' }).click();
  await items.nth(1).click();
  await expect(page.locator('.content-container')).toHaveClass(/view-preview-only/);
  await expect(page.locator('#markdown-preview h2')).toBeInViewport();
});

test('works with large documents rendered by the preview worker', async ({ page }) => {
  const paragraphs = Array.from({ length: 90 }, (_, index) => `Paragraph ${index} ${'worker filler '.repeat(70)}`);
  await setEditorContent(page, ['# Large document', ...paragraphs, '## Last section', 'Final paragraph.'].join('\n\n'));
  await openOutline(page);
  await expect(page.locator('#markdown-preview .preview-render-block')).not.toHaveCount(0);
  await expect(page.locator('#document-outline-list button')).toHaveText(['Large document', 'Last section']);
  await page.locator('#document-outline-list button').last().click();
  await expect(page.locator('#markdown-preview h2')).toBeInViewport();
  await expect(page.locator('#document-outline-list button').last()).toHaveAttribute('aria-current', 'location');

  // A lazy block can change height after the browser has completed the jump.
  await page.locator('#markdown-preview h2').evaluate(heading => {
    heading.closest('.preview-render-block').previousElementSibling.style.minHeight = '1800px';
  });
  await expect(page.locator('#markdown-preview h2')).toBeInViewport();

  // Subsequent user scrolling must take precedence over the outline's target.
  await page.locator('.preview-pane').click();
  await page.locator('.preview-pane').evaluate(pane => { pane.scrollTop = 0; });
  await expect(page.locator('#markdown-preview h1')).toBeInViewport();
  await page.locator('#markdown-preview h2').evaluate(heading => {
    heading.closest('.preview-render-block').previousElementSibling.style.minHeight = '2000px';
  });
  await expect(page.locator('#markdown-preview h1')).toBeInViewport();
});

test('shares the right side with Comments and stays out of print', async ({ page }) => {
  await setEditorContent(page, '# A document');
  await openOutline(page);
  await page.locator('#review-toggle').click();
  await expect(page.locator('#review-panel')).toBeVisible();
  await expect(page.locator('#document-outline')).toBeHidden();
  await openOutline(page);
  await expect(page.locator('#review-panel')).toBeHidden();
  await expect(page.locator('#document-outline-list button')).toHaveText(['A document']);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#document-outline')).toBeHidden();
});

test('fits small screens, wraps long headings, and closes after navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setEditorContent(page, '# Mobile document\n\n## A very long heading that should wrap inside the outline without overflowing the screen');
  await openOutline(page);
  const panel = page.locator('#document-outline');
  const bounds = await panel.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(391);
  expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await panel.getByRole('button', { name: 'A very long heading', exact: false }).click();
  await expect(panel).toBeHidden();
  await expect(page.locator('#markdown-preview h2')).toBeInViewport();
});
