const { test, expect } = require('@playwright/test');
const {
  fixture,
  openApp,
  setEditorContent,
  editorValue,
  storedDocuments,
  waitForPreviewText
} = require('../helpers/app');

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('typing markdown updates the live preview', async ({ page }) => {
  await setEditorContent(page, await fixture('basic.md'));

  await expect(page.locator('#markdown-preview h1')).toHaveText('Local Test Document');
  await expect(page.locator('#markdown-preview strong')).toContainText('bold text');
  await expect(page.locator('#markdown-preview blockquote')).toContainText('A blockquote');
});

test('renders verified GFM features', async ({ page }) => {
  await setEditorContent(page, await fixture('gfm.md'));

  await expect(page.locator('#markdown-preview h1')).toHaveText('GFM Coverage');
  await expect(page.locator('#markdown-preview table').filter({ hasText: 'Tables' })).toBeVisible();
  await expect(page.locator('#markdown-preview input[type="checkbox"]')).toHaveCount(2);
  await expect(page.locator('#markdown-preview pre code')).toContainText('console.log');
  await expect(page.locator('#markdown-preview a[href="https://example.com"]')).toContainText('Example link');
  await expect(page.locator('#markdown-preview blockquote')).toContainText('GitHub-style blockquote');
  await expect(page.locator('#markdown-preview .footnotes')).toContainText('Footnote body');
});

test('view mode buttons switch editor, split, and preview layouts', async ({ page }) => {
  const container = page.locator('.content-container');

  await page.getByRole('button', { name: 'Edit Markdown' }).click();
  await expect(container).toHaveClass(/view-editor-only/);
  await expect(page.getByRole('button', { name: 'Edit Markdown' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Preview Markdown' }).click();
  await expect(container).toHaveClass(/view-preview-only/);
  await expect(page.getByRole('button', { name: 'Preview Markdown' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Split editor and preview' }).click();
  await expect(container).toHaveClass(/view-split/);
});

test('formatting toolbar applies bold to the selected text', async ({ page }) => {
  await setEditorContent(page, 'bold me');
  await page.locator('#markdown-editor').evaluate(editor => {
    editor.focus();
    editor.setSelectionRange(0, editor.value.length);
  });

  await page.getByRole('button', { name: 'Bold' }).click();

  await expect.poll(() => editorValue(page)).toBe('**bold me**');
  await expect(page.locator('#markdown-preview strong')).toHaveText('bold me');
});

test('right-clicking selected text keeps the editor selection active', async ({ page }) => {
  const editor = page.locator('#markdown-editor');
  const selectedText = 'keep this selected';
  await setEditorContent(page, selectedText);
  await page.getByRole('button', { name: 'Edit Markdown' }).click();
  await editor.evaluate((element, end) => {
    element.focus();
    element.setSelectionRange(0, end);
  }, selectedText.length);

  await editor.click({ button: 'right', position: { x: 40, y: 18 } });

  await expect(page.locator('.document-menu-context')).toBeVisible();
  await expect.poll(() => editor.evaluate(element => ({
    start: element.selectionStart,
    end: element.selectionEnd,
    active: document.activeElement === element
  }))).toEqual({ start: 0, end: selectedText.length, active: true });
});

test('tabs can be created, renamed, duplicated, and deleted', async ({ page }) => {
  await page.locator('#tab-new-btn').click();
  await expect(page.locator('#tab-list [role="tab"]')).toHaveCount(2);

  await setEditorContent(page, '# Tab Content');
  await page.locator('#tab-list .tab-item.active .tab-menu-btn').click();
  await page.locator('.tab-menu-dropdown.open [data-action="rename"]').click();
  await page.locator('#rename-modal-input').fill('Renamed Test Tab');
  await page.locator('#rename-modal-confirm').click();
  await expect(page.locator('#tab-list .tab-item.active .tab-title')).toHaveText('Renamed Test Tab');

  await page.locator('#tab-list .tab-item.active .tab-menu-btn').click();
  await page.locator('.tab-menu-dropdown.open [data-action="duplicate"]').click();
  await expect(page.locator('#tab-list [role="tab"]')).toHaveCount(3);
  await expect(page.locator('#tab-list .tab-item.active .tab-title')).toHaveText('Renamed Test Tab (copy)');
  await waitForPreviewText(page, 'Tab Content');

  await page.locator('#tab-list .tab-item.active .tab-menu-btn').click();
  await page.locator('.tab-menu-dropdown.open [data-action="close"]').click();
  await expect(page.locator('#tab-list [role="tab"]')).toHaveCount(2);
});

test('imports a local Markdown file into Explorer without opening a tab', async ({ page }) => {
  const initialTabCount = await page.locator('#tab-list [role="tab"]').count();
  await page.locator('#file-input').setInputFiles('tests/fixtures/imported-file.md');

  await expect(page.locator('#tab-list [role="tab"]')).toHaveCount(initialTabCount);
  await expect(page.locator('#tab-list .tab-title').filter({ hasText: 'imported-file' })).toHaveCount(0);
  await expect.poll(async () => (await storedDocuments(page)).some(document => document.title === 'imported-file' && document.isOpen === false)).toBe(true);
  const importedRow = page.locator('.document-tree-row[data-document-id]').filter({ hasText: 'imported-file' });
  await expect(importedRow).toBeVisible();
  await importedRow.locator('.document-tree-main').click();
  await expect(page.locator('#tab-list .tab-item.active .tab-title')).toHaveText('imported-file');
  await expect(page.locator('#markdown-preview h1')).toHaveText('Imported Fixture');
});

test('imports a dropped Markdown file into Explorer without opening a tab', async ({ page }) => {
  const body = await fixture('imported-file.md');
  const initialTabCount = await page.locator('#tab-list [role="tab"]').count();
  const dataTransfer = await page.evaluateHandle(({ name, body }) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([body], name, { type: 'text/markdown' }));
    return transfer;
  }, { name: 'dropped-file.md', body });

  await page.dispatchEvent('body', 'dragenter', { dataTransfer });
  await expect(page.locator('#drag-overlay')).toHaveClass(/active/);

  await page.dispatchEvent('body', 'drop', { dataTransfer });

  await expect(page.locator('#drag-overlay')).not.toHaveClass(/active/);
  await expect(page.locator('#tab-list [role="tab"]')).toHaveCount(initialTabCount);
  await expect(page.locator('#tab-list .tab-title').filter({ hasText: 'dropped-file' })).toHaveCount(0);
  await expect.poll(async () => (await storedDocuments(page)).some(document => document.title === 'dropped-file' && document.isOpen === false)).toBe(true);
  const droppedRow = page.locator('.document-tree-row[data-document-id]').filter({ hasText: 'dropped-file' });
  await droppedRow.locator('.document-tree-main').click();
  await expect(page.locator('#tab-list .tab-item.active .tab-title')).toHaveText('dropped-file');
  await expect(page.locator('#markdown-preview h1')).toHaveText('Imported Fixture');
});
