const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent } = require('../helpers/app');

const markdown = `# Clipboard document

A **bold phrase**, *italic text*, and [a link](https://example.com).

- First item
- Second item

> A quotation

| Name | Value |
| --- | --- |
| Example | 42 |

\`\`\`js
const answer = 42;
\`\`\``;

async function captureClipboard(page) {
  await page.evaluate(() => {
    window.__clipboard = null;
    window.__writeClipboard = navigator.clipboard.write.bind(navigator.clipboard);
    window.__writeClipboardText = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = async text => {
      window.__clipboard = { 'text/plain': text };
    };
    navigator.clipboard.write = async items => {
      const data = {};
      for (const type of items[0].types) {
        data[type] = await (await items[0].getType(type)).text();
      }
      window.__clipboard = data;
    };
  });
}

async function selectPreview(page, selector = '#markdown-preview', start, end) {
  await page.locator(selector).evaluate((element, offsets) => {
    document.activeElement.blur();
    const range = document.createRange();
    if (offsets.start !== undefined) {
      range.setStart(element.firstChild, offsets.start);
      range.setEnd(element.firstChild, offsets.end);
    } else {
      range.selectNodeContents(element);
    }
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }, { start, end });
}

async function openSurfaceMenu(page, selector) {
  await page.locator(selector).dispatchEvent('contextmenu', { button: 2, clientX: 120, clientY: 220 });
  const menu = page.locator('.document-menu-context.open');
  await expect(menu).toBeVisible();
  return menu;
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await setEditorContent(page, markdown);
  await expect(page.locator('#markdown-preview h1')).toHaveText('Clipboard document');
  await captureClipboard(page);
});

test('preview Copy includes rich HTML and readable text without preview controls', async ({ page }) => {
  await selectPreview(page);
  const menu = await openSurfaceMenu(page, '#markdown-preview');
  await menu.getByRole('menuitem', { name: 'Copy', exact: true }).click();
  await expect(menu).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => Object.keys(window.__clipboard || {}))).toContain('text/html');
  const copied = await page.evaluate(() => window.__clipboard);
  expect(copied['text/html']).toMatch(/<h1[^>]*>Clipboard document<\/h1>/);
  expect(copied['text/html']).toContain('<strong>bold phrase</strong>');
  expect(copied['text/html']).toContain('<em>italic text</em>');
  expect(copied['text/html']).toContain('href="https://example.com"');
  expect(copied['text/html']).toMatch(/<ul>[\s\S]*<li>First item<\/li>/);
  expect(copied['text/html']).toContain('<blockquote>');
  expect(copied['text/html']).toContain('<table>');
  expect(copied['text/html']).toContain('<pre>');
  expect(copied['text/html']).not.toMatch(/<button|code-preview-toolbar|data-review-/);
  expect(copied['text/plain']).toContain('Clipboard document\n');
  expect(copied['text/plain']).toContain('A bold phrase, italic text, and a link.');
  expect(copied['text/plain']).toContain('const answer = 42;');
  expect(copied['text/plain']).not.toMatch(/\*\*|Copy|\bJS\b/);
});

test('editor Select All closes the menu, focuses the editor, and Copy copies raw Markdown', async ({ page }) => {
  await page.locator('#markdown-editor').evaluate(editor => editor.setSelectionRange(4, 4));
  const menu = await openSurfaceMenu(page, '#markdown-editor');
  await expect(menu.getByRole('menuitem', { name: 'Copy', exact: true })).toBeDisabled();
  await menu.getByRole('menuitem', { name: 'Select All', exact: true }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.locator('#markdown-editor')).toBeFocused();
  await expect(page.locator('#save-status')).toHaveAttribute('data-state', 'saved');
  await expect.poll(() => page.locator('#markdown-editor').evaluate(editor => [editor.selectionStart, editor.selectionEnd]))
    .toEqual([0, markdown.length]);
  expect(await page.evaluate(() => window.__clipboard)).toBeNull();
  await page.locator('#markdown-editor').click({ button: 'right' });
  await expect(menu.getByRole('menuitem', { name: 'Copy', exact: true })).toBeEnabled();
  await expect(menu.getByRole('menuitem', { name: 'Cut', exact: true })).toBeEnabled();
  await menu.getByRole('menuitem', { name: 'Copy', exact: true }).click();
  await expect(menu).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__clipboard)).toEqual({ 'text/plain': markdown });
  await expect(page.locator('#markdown-editor')).toHaveValue(markdown);
});

test('preview Select All closes the menu and focuses a native selection of only its document', async ({ page }) => {
  await page.evaluate(() => window.getSelection().removeAllRanges());
  const menu = await openSurfaceMenu(page, '#markdown-preview');
  await expect(menu.getByRole('menuitem', { name: 'Copy', exact: true })).toBeDisabled();
  await menu.getByRole('menuitem', { name: 'Select All', exact: true }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.locator('#markdown-preview')).toBeFocused();
  await expect(page.locator('#save-status')).toHaveAttribute('data-state', 'saved');
  expect(await page.locator('#markdown-preview').evaluate(preview => {
    const range = window.getSelection().getRangeAt(0);
    return range.startContainer === preview && range.startOffset === 0 &&
      range.endContainer === preview && range.endOffset === preview.childNodes.length;
  })).toBe(true);
  expect(await page.evaluate(() => window.__clipboard)).toBeNull();
  await page.locator('#markdown-preview').click({ button: 'right', position: { x: 50, y: 40 } });
  await expect(menu.getByRole('menuitem', { name: 'Cut', exact: true })).toBeDisabled();
  await expect(menu.getByRole('menuitem', { name: 'Paste', exact: true })).toBeDisabled();
  await menu.getByRole('menuitem', { name: 'Copy', exact: true }).click();
  await expect(menu).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__clipboard?.['text/html'])).toContain('<strong>bold phrase</strong>');
  const text = await page.evaluate(() => window.__clipboard['text/plain']);
  expect(text).toContain('Clipboard document');
  expect(text).toContain('const answer = 42;');
  expect(text).not.toMatch(/New file|Select All|Rename|Explorer|Copy/);
});

test('copying part of a bold phrase preserves formatting without copying surrounding text', async ({ page }) => {
  await selectPreview(page, '#markdown-preview strong', 5, 11);
  const menu = await openSurfaceMenu(page, '#markdown-preview');
  await menu.getByRole('menuitem', { name: 'Copy', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__clipboard?.['text/html'])).toContain('<strong>phrase</strong>');
  expect(await page.evaluate(() => window.__clipboard['text/plain'])).toBe('phrase');
  expect(await page.evaluate(() => window.__clipboard['text/html'])).not.toMatch(/Clipboard document|italic text|bold /);
});

test('native preview Copy supplies rich data and leaves editor Copy untouched', async ({ page }) => {
  await selectPreview(page, '#markdown-preview strong');
  const copied = await page.evaluate(() => {
    const clipboardData = new DataTransfer();
    const event = new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData });
    document.querySelector('#markdown-preview strong').dispatchEvent(event);
    return { html: event.clipboardData.getData('text/html'), text: event.clipboardData.getData('text/plain'), prevented: event.defaultPrevented };
  });
  expect(copied).toEqual({ html: '<p><strong>bold phrase</strong></p>', text: 'bold phrase', prevented: true });
  const editorCopy = await page.locator('#markdown-editor').evaluate(editor => {
    editor.focus();
    editor.select();
    const clipboardData = new DataTransfer();
    const event = new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData });
    editor.dispatchEvent(event);
    return { prevented: event.defaultPrevented, types: Array.from(event.clipboardData.types) };
  });
  expect(editorCopy).toEqual({ prevented: false, types: [] });
});

test('keyboard Select All returns focus so typing replaces the native editor selection', async ({ page }) => {
  const menu = await openSurfaceMenu(page, '#markdown-editor');
  const selectAll = menu.getByRole('menuitem', { name: 'Select All', exact: true });
  await selectAll.focus();
  await page.keyboard.press('Enter');
  await expect(menu).toHaveCount(0);
  await expect(page.locator('#markdown-editor')).toBeFocused();
  await page.keyboard.type('Replacement document');
  await expect(page.locator('#markdown-editor')).toHaveValue('Replacement document');
  await openSurfaceMenu(page, '#markdown-editor');
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(page.locator('#markdown-editor')).toBeFocused();
});

test('Ctrl/Cmd+A follows the focused editor or preview without selecting the application', async ({ page }) => {
  const editor = page.locator('#markdown-editor');
  const preview = page.locator('#markdown-preview');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+A');
  expect(await editor.evaluate(element => element.value.slice(element.selectionStart, element.selectionEnd))).toBe(markdown);
  await preview.click({ position: { x: 50, y: 40 } });
  await expect(preview).toBeFocused();
  await page.keyboard.press('ControlOrMeta+A');
  expect(await preview.evaluate(element => {
    const selection = window.getSelection();
    return element.contains(selection.anchorNode) && element.contains(selection.focusNode) && selection.toString();
  })).toContain('Clipboard document');
  await expect(editor).toHaveValue(markdown);
  const menu = await openSurfaceMenu(page, '#markdown-preview');
  await menu.getByRole('menuitem', { name: 'Copy', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__clipboard?.['text/html'])).toContain('<strong>bold phrase</strong>');
  expect(await page.evaluate(() => window.__clipboard['text/plain'])).not.toMatch(/Explorer|Select All|New file/);
});

test('Select All shortcuts leave nested text controls to the browser', async ({ page }) => {
  await page.locator('#markdown-preview').evaluate(preview => {
    const input = document.createElement('input');
    input.id = 'preview-text-input';
    input.value = 'Editable control';
    preview.prepend(input);
    const editable = document.createElement('div');
    editable.id = 'preview-editable';
    editable.contentEditable = 'true';
    editable.textContent = 'Editable content';
    preview.prepend(editable);
  });
  for (const selector of ['#preview-text-input', '#preview-editable']) {
    await page.locator(selector).focus();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('Replacement');
  }
  await expect(page.locator('#preview-text-input')).toHaveValue('Replacement');
  await expect(page.locator('#preview-editable')).toHaveText('Replacement');
  await expect(page.locator('#markdown-preview h1')).toHaveText('Clipboard document');
  await expect(page.locator('#markdown-editor')).toHaveValue(markdown);
});

test('read-only and empty editors can Select All without enabling editing commands', async ({ page }) => {
  await page.locator('#markdown-editor').evaluate(editor => { editor.readOnly = true; });
  let menu = await openSurfaceMenu(page, '#markdown-editor');
  await menu.getByRole('menuitem', { name: 'Select All', exact: true }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.locator('#markdown-editor')).toBeFocused();
  await page.keyboard.type('Cannot edit');
  await expect(page.locator('#markdown-editor')).toHaveValue(markdown);
  menu = await openSurfaceMenu(page, '#markdown-editor');
  await expect(menu.getByRole('menuitem', { name: 'Cut', exact: true })).toBeDisabled();
  await expect(menu.getByRole('menuitem', { name: 'Paste', exact: true })).toBeDisabled();
  await menu.getByRole('menuitem', { name: 'Copy', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__clipboard)).toEqual({ 'text/plain': markdown });
  await page.locator('#markdown-editor').evaluate(editor => { editor.readOnly = false; });
  await setEditorContent(page, '');
  menu = await openSurfaceMenu(page, '#markdown-editor');
  await menu.getByRole('menuitem', { name: 'Select All', exact: true }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.locator('#markdown-editor')).toBeFocused();
  menu = await openSurfaceMenu(page, '#markdown-editor');
  await expect(menu.getByRole('menuitem', { name: 'Copy', exact: true })).toBeDisabled();
  await expect(menu.getByRole('menuitem', { name: 'Cut', exact: true })).toBeDisabled();
});

test('Cut and Paste use the complete editor selection after Select All', async ({ page }) => {
  let menu = await openSurfaceMenu(page, '#markdown-editor');
  await menu.getByRole('menuitem', { name: 'Select All', exact: true }).click();
  menu = await openSurfaceMenu(page, '#markdown-editor');
  await menu.getByRole('menuitem', { name: 'Cut', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__clipboard)).toEqual({ 'text/plain': markdown });
  await expect(page.locator('#markdown-editor')).toHaveValue('');
  await setEditorContent(page, markdown);
  await page.evaluate(() => { navigator.clipboard.readText = async () => 'replacement'; });
  menu = await openSurfaceMenu(page, '#markdown-editor');
  await menu.getByRole('menuitem', { name: 'Select All', exact: true }).click();
  menu = await openSurfaceMenu(page, '#markdown-editor');
  await menu.getByRole('menuitem', { name: 'Paste', exact: true }).click();
  await expect(page.locator('#markdown-editor')).toHaveValue('replacement');
});

test('a failed Cut leaves the document intact', async ({ page }) => {
  await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('Permission denied'); }; });
  const menu = await openSurfaceMenu(page, '#markdown-editor');
  await menu.getByRole('menuitem', { name: 'Select All', exact: true }).click();
  await openSurfaceMenu(page, '#markdown-editor');
  await menu.getByRole('menuitem', { name: 'Cut', exact: true }).click();
  await expect(page.getByText('Clipboard access failed: Permission denied')).toBeVisible();
  await expect(page.locator('#markdown-editor')).toHaveValue(markdown);
});

test('Select All and Copy are scoped to the secondary editor and preview', async ({ page }) => {
  const primaryId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
  await page.locator('#tab-new-btn').click();
  const secondaryMarkdown = '# Secondary document\n\n**শিক্ষা** and second document content.';
  await setEditorContent(page, secondaryMarkdown);
  const secondaryId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
  await page.locator(`#tab-list .tab-item[data-tab-id="${primaryId}"]`).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Open in split view' }).click();
  await page.locator('#document-split-destination').selectOption(secondaryId);
  await page.locator('#document-split-modal-confirm').click();
  await expect(page.locator('#document-split-editor')).toHaveValue(secondaryMarkdown);
  let menu = await openSurfaceMenu(page, '#document-split-editor');
  await menu.getByRole('menuitem', { name: 'Select All', exact: true }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.locator('#document-split-editor')).toBeFocused();
  await expect.poll(() => page.locator('#document-split-editor').evaluate(editor => [editor.selectionStart, editor.selectionEnd]))
    .toEqual([0, secondaryMarkdown.length]);
  menu = await openSurfaceMenu(page, '#document-split-editor');
  await menu.getByRole('menuitem', { name: 'Copy', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__clipboard)).toEqual({ 'text/plain': secondaryMarkdown });
  await expect(page.locator('#markdown-editor')).toHaveValue(markdown);
  await page.locator('.view-toolbar [data-view-mode="preview"]').click();
  await expect(page.locator('#document-split-preview h1')).toHaveText('Secondary document');
  menu = await openSurfaceMenu(page, '#document-split-preview');
  await menu.getByRole('menuitem', { name: 'Select All', exact: true }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.locator('#document-split-preview')).toBeFocused();
  expect(await page.evaluate(() => window.getSelection().toString())).not.toContain('Clipboard document');
  await page.locator('#document-split-preview').click({ position: { x: 50, y: 40 } });
  await page.keyboard.press('ControlOrMeta+A');
  menu = await openSurfaceMenu(page, '#document-split-preview');
  await menu.getByRole('menuitem', { name: 'Copy', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__clipboard?.['text/html'])).toContain('<strong>শিক্ষা</strong>');
  expect(await page.evaluate(() => window.__clipboard['text/plain'])).not.toContain('Clipboard document');
});

for (const mode of ['async clipboard', 'legacy clipboard', 'rejected async clipboard', 'native Copy shortcut']) {
  test(`formatted preview content reaches the real clipboard and pastes as rich text via ${mode}`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Clipboard read permissions are Chromium-specific.');
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.evaluate(async mode => {
      navigator.clipboard.write = window.__writeClipboard;
      navigator.clipboard.writeText = window.__writeClipboardText;
      await navigator.clipboard.writeText('Clipboard sentinel');
      if (mode === 'legacy clipboard') navigator.clipboard.write = undefined;
      if (mode === 'rejected async clipboard') navigator.clipboard.write = async () => { throw new Error('HTML write unavailable'); };
    }, mode);
    const menu = await openSurfaceMenu(page, '#markdown-preview');
    await menu.getByRole('menuitem', { name: 'Select All', exact: true }).click();
    await expect(menu).toHaveCount(0);
    if (mode === 'native Copy shortcut') {
      await page.keyboard.press('ControlOrMeta+C');
    } else {
      await openSurfaceMenu(page, '#markdown-preview');
      await menu.getByRole('menuitem', { name: 'Copy', exact: true }).click();
      await expect(menu).toHaveCount(0);
    }
    await expect.poll(() => page.evaluate(async () => (await navigator.clipboard.read())[0].types)).toContain('text/html');
    await page.evaluate(() => {
      const target = document.createElement('div');
      target.id = 'paste-target';
      target.contentEditable = 'true';
      target.style.cssText = 'position:fixed;inset:10px;background:white;z-index:99999;overflow:auto;';
      document.body.appendChild(target);
    });
    const target = page.locator('#paste-target');
    await target.focus();
    await page.keyboard.press('ControlOrMeta+V');
    await expect(target.locator('h1')).toHaveText('Clipboard document');
    await expect(target.locator('strong')).toHaveText('bold phrase');
    await expect(target.locator('em')).toHaveText('italic text');
    await expect(target.locator('a')).toHaveAttribute('href', /^https:\/\/example\.com\/?$/);
    await expect(target.locator('ul li')).toHaveText(['First item', 'Second item']);
    await expect(target.locator('table')).toContainText('Example');
    await expect(target.locator('pre')).toContainText('const answer = 42;');
    await expect(target.locator('button')).toHaveCount(0);
  });
}

test.describe('Android-sized touch layout', () => {
  test.use({ viewport: { width: 412, height: 915 }, hasTouch: true });

  test('Select All closes the menu and leaves a preview selection that can be copied', async ({ page }) => {
    const menu = await openSurfaceMenu(page, '#markdown-preview');
    await menu.getByRole('menuitem', { name: 'Select All', exact: true }).tap();
    await expect(menu).toHaveCount(0);
    await expect(page.locator('#markdown-preview')).toBeFocused();
    expect(await page.evaluate(() => window.getSelection().toString())).toContain('Clipboard document');
    await openSurfaceMenu(page, '#markdown-preview');
    const bounds = await menu.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(412);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(915);
    await menu.getByRole('menuitem', { name: 'Copy', exact: true }).tap();
    await expect(menu).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.__clipboard?.['text/html'])).toContain('<strong>bold phrase</strong>');
  });
});
