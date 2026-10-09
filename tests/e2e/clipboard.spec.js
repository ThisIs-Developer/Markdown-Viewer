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

async function openSurfaceMenu(page, selector, pointerType = 'mouse') {
  await page.locator(selector).dispatchEvent('pointerdown', { pointerType, button: pointerType === 'touch' ? 0 : 2 });
  await page.locator(selector).dispatchEvent('contextmenu', { button: 2, clientX: 120, clientY: 220 });
  const menu = page.locator('.document-menu-context.open');
  await expect(menu).toBeVisible();
  return menu;
}

async function openSecondDocument(page, secondaryMarkdown) {
  const primaryId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
  await page.locator('#tab-new-btn').click();
  await setEditorContent(page, secondaryMarkdown);
  const secondaryId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
  await page.locator(`#tab-list .tab-item[data-tab-id="${primaryId}"]`).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Open in split view' }).click();
  await page.locator('#document-split-destination').selectOption(secondaryId);
  await page.locator('#document-split-modal-confirm').click();
  await expect(page.locator('#document-split-editor')).toHaveValue(secondaryMarkdown);
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
  const secondaryMarkdown = '# Secondary document\n\n**শিক্ষা** and second document content.';
  await openSecondDocument(page, secondaryMarkdown);
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

test('Copy Markdown and its shortcut always copy the complete source in every view', async ({ page }) => {
  await expect(page.locator('#copy-markdown-button')).toHaveAttribute('title', 'Copy entire document as Markdown (Ctrl/Cmd+Shift+C)');
  for (const mode of ['editor', 'preview', 'split']) {
    await page.locator(`.view-toolbar [data-view-mode="${mode}"]`).click();
    if (mode === 'preview') {
      await page.locator('#markdown-preview').focus();
      await selectPreview(page, '#markdown-preview strong', 5, 11);
    } else {
      await page.locator('#markdown-editor').evaluate(editor => {
        editor.focus();
        editor.setSelectionRange(2, 11);
      });
    }
    await page.evaluate(() => { window.__clipboard = null; });
    await page.keyboard.press('ControlOrMeta+Shift+C');
    await expect.poll(() => page.evaluate(() => window.__clipboard)).toEqual({ 'text/plain': markdown });
    await page.evaluate(() => { window.__clipboard = null; });
    await page.locator('#copy-markdown-button').click();
    await expect.poll(() => page.evaluate(() => window.__clipboard)).toEqual({ 'text/plain': markdown });
  }
  await expect(page.locator('#copy-markdown-button')).toHaveAttribute('title', 'Copy entire document as Markdown (Ctrl/Cmd+Shift+C)');
  await expect(page.locator('#copy-markdown-button i')).toHaveClass('lucide lucide-clipboard');
});

test('Copy Markdown remembers the last focused document across toolbar and view changes', async ({ page }) => {
  const secondaryMarkdown = '# Secondary document\n\n**Complete secondary source**';
  await openSecondDocument(page, secondaryMarkdown);
  const unsavedMarkdown = secondaryMarkdown + '\n\nA new edit.';
  await page.locator('#document-split-editor').fill(unsavedMarkdown);
  await page.locator('#document-split-editor').evaluate(editor => editor.setSelectionRange(2, 11));
  await page.keyboard.press('ControlOrMeta+Shift+C');
  await expect.poll(() => page.evaluate(() => window.__clipboard)).toEqual({ 'text/plain': unsavedMarkdown });
  await page.evaluate(() => { window.__clipboard = null; });
  await page.locator('#copy-markdown-button').click();
  await expect.poll(() => page.evaluate(() => window.__clipboard)).toEqual({ 'text/plain': unsavedMarkdown });
  await page.locator('.view-toolbar [data-view-mode="preview"]').click();
  await page.evaluate(() => { window.__clipboard = null; });
  await page.locator('#copy-markdown-button').click();
  await expect.poll(() => page.evaluate(() => window.__clipboard)).toEqual({ 'text/plain': unsavedMarkdown });
  await page.locator('#markdown-preview h1').click();
  await page.locator('#copy-markdown-button').click();
  await expect.poll(() => page.evaluate(() => window.__clipboard)).toEqual({ 'text/plain': markdown });
  await page.locator('#document-split-preview h1').click();
  await page.keyboard.press('ControlOrMeta+Shift+C');
  await expect.poll(() => page.evaluate(() => window.__clipboard)).toEqual({ 'text/plain': unsavedMarkdown });
  await page.locator('#tab-list .tab-item.active').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Exit split view', exact: true }).click();
  await page.locator('#copy-markdown-button').click();
  await expect.poll(() => page.evaluate(() => window.__clipboard)).toEqual({ 'text/plain': markdown });
  await page.locator('#tab-new-btn').click();
  await setEditorContent(page, '# New active document');
  await page.keyboard.press('ControlOrMeta+Shift+C');
  await expect.poll(() => page.evaluate(() => window.__clipboard)).toEqual({ 'text/plain': '# New active document' });
});

test('ordinary Copy with no selection leaves the real clipboard unchanged', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Clipboard read permissions are Chromium-specific.');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(async () => {
    navigator.clipboard.writeText = window.__writeClipboardText;
    await navigator.clipboard.writeText('Keep this clipboard content');
  });
  for (const selector of ['#markdown-editor', '#markdown-preview', '#copy-markdown-button']) {
    await page.locator(selector).focus();
    await page.evaluate(() => {
      window.getSelection().removeAllRanges();
      document.getElementById('markdown-editor').setSelectionRange(0, 0);
    });
    await page.keyboard.press('ControlOrMeta+C');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Keep this clipboard content');
  }
});

test('Copy Markdown shortcut does nothing after the last document is closed', async ({ page }) => {
  await page.locator('#tab-list .tab-item.active .tab-close-btn').click();
  await expect(page.locator('#no-open-document')).toBeVisible();
  await expect(page.locator('#copy-markdown-button')).toBeDisabled();
  await page.keyboard.press('ControlOrMeta+Shift+C');
  expect(await page.evaluate(() => window.__clipboard)).toBeNull();
});

test('native editor Copy is raw text and preview keyboard Paste cannot edit the document', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Clipboard read permissions are Chromium-specific.');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const editor = page.locator('#markdown-editor');
  await editor.focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('ControlOrMeta+C');
  // The native Windows clipboard uses CRLF; the textarea exposes LF.
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe(markdown);
  expect(await page.evaluate(async () => (await navigator.clipboard.read())[0].types)).toEqual(['text/plain']);
  await page.locator('#markdown-preview').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('ControlOrMeta+V');
  await page.keyboard.press('ControlOrMeta+X');
  await page.keyboard.type('Cannot change the preview');
  await expect(editor).toHaveValue(markdown);
  await expect(page.locator('#markdown-preview h1')).toHaveText('Clipboard document');
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

  for (const pane of ['editor', 'preview']) {
    test(`touch Select All keeps ${pane} Copy available until Copy is tapped`, async ({ page }) => {
      const selector = '#markdown-' + pane;
      const menu = await openSurfaceMenu(page, selector, 'touch');
      await expect(menu.getByRole('menuitem', { name: 'Copy', exact: true })).toBeDisabled();
      await menu.getByRole('menuitem', { name: 'Select All', exact: true }).tap();
      await expect(page.locator('#save-status')).toHaveAttribute('data-state', 'saved');
      await expect(menu).toBeVisible();
      await expect(page.locator(selector)).toBeFocused();
      if (pane === 'preview') {
        expect(await page.evaluate(() => window.getSelection().toString())).toContain('Clipboard document');
        await expect(menu.getByRole('menuitem', { name: 'Cut', exact: true })).toBeDisabled();
      } else {
        expect(await page.locator(selector).evaluate(editor => editor.value.slice(editor.selectionStart, editor.selectionEnd))).toBe(markdown);
        await expect(menu.getByRole('menuitem', { name: 'Cut', exact: true })).toBeEnabled();
      }
      const bounds = await menu.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(412);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(915);
      await menu.getByRole('menuitem', { name: 'Copy', exact: true }).tap();
      await expect(menu).toHaveCount(0);
      if (pane === 'preview') {
        await expect.poll(() => page.evaluate(() => window.__clipboard?.['text/html'])).toContain('<strong>bold phrase</strong>');
      } else {
        await expect.poll(() => page.evaluate(() => window.__clipboard)).toEqual({ 'text/plain': markdown });
      }
    });
  }

  test('mouse Select All still closes the menu on a device with touch support', async ({ page }) => {
    const menu = await openSurfaceMenu(page, '#markdown-preview');
    await menu.getByRole('menuitem', { name: 'Select All', exact: true }).click();
    await expect(menu).toHaveCount(0);
    await expect(page.locator('#markdown-preview')).toBeFocused();
  });

  for (const pane of ['editor', 'preview']) {
    test(`tapping the selected ${pane} text reopens Copy after dismissing the touch menu`, async ({ page }) => {
      const surface = page.locator('#markdown-' + pane);
      const menu = await openSurfaceMenu(page, '#markdown-' + pane, 'touch');
      await menu.getByRole('menuitem', { name: 'Select All', exact: true }).tap();
      await page.locator('.app-header').tap({ position: { x: 10, y: 5 } });
      await expect(menu).toHaveCount(0);
      if (pane === 'preview') {
        expect(await page.evaluate(() => window.getSelection().toString())).toContain('Clipboard document');
        await surface.locator('strong').tap();
      } else {
        await surface.tap({ position: { x: 80, y: 24 } });
      }
      await expect(menu).toBeVisible();
      await expect(menu.getByRole('menuitem', { name: 'Copy', exact: true })).toBeEnabled();
      await menu.getByRole('menuitem', { name: 'Copy', exact: true }).tap();
      await expect(menu).toHaveCount(0);
      if (pane === 'preview') {
        await expect.poll(() => page.evaluate(() => window.__clipboard?.['text/html'])).toContain('<strong>bold phrase</strong>');
        expect(await page.evaluate(() => window.__clipboard['text/plain'])).toContain('Clipboard document');
      } else {
        await expect.poll(() => page.evaluate(() => window.__clipboard)).toEqual({ 'text/plain': markdown });
      }
      await expect(page.locator('#markdown-editor')).toHaveValue(markdown);
      // Copy closes the menu without clearing the native selection. Another
      // tap must reopen it even while the selected pane still has focus.
      if (pane === 'preview') await surface.locator('strong').tap();
      else await surface.tap({ position: { x: 80, y: 24 } });
      await expect(menu).toBeVisible();
      await expect(menu.getByRole('menuitem', { name: 'Copy', exact: true })).toBeEnabled();
    });
  }

  test('touch selection cannot start a text drag while mouse dragging remains native', async ({ page }) => {
    const preview = page.locator('#markdown-preview');
    const menu = await openSurfaceMenu(page, '#markdown-preview', 'touch');
    await menu.getByRole('menuitem', { name: 'Select All', exact: true }).tap();
    await page.locator('.app-header').tap({ position: { x: 10, y: 5 } });
    for (const pointerType of ['touch', 'mouse']) {
      await preview.dispatchEvent('pointerdown', { pointerType, button: 0 });
      const prevented = await preview.locator('strong').evaluate(element => {
        const event = new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() });
        element.dispatchEvent(event);
        return event.defaultPrevented;
      });
      expect(prevented).toBe(pointerType === 'touch');
    }
    await expect(page.locator('#markdown-editor')).toHaveValue(markdown);
  });

  test('partial touch selections reopen without capturing taps on unselected text', async ({ page }) => {
    const editor = page.locator('#markdown-editor');
    await editor.evaluate(element => element.setSelectionRange(2, 11));
    const menu = await openSurfaceMenu(page, '#markdown-editor', 'touch');
    await page.locator('.app-header').tap({ position: { x: 10, y: 5 } });
    await editor.tap({ position: { x: 200, y: 24 } });
    await expect(menu).toHaveCount(0);
    expect(await editor.evaluate(element => element.selectionStart === element.selectionEnd && element.selectionStart > 11)).toBe(true);

    await selectPreview(page, '#markdown-preview strong', 5, 11);
    await openSurfaceMenu(page, '#markdown-preview', 'touch');
    await page.locator('.app-header').tap({ position: { x: 10, y: 5 } });
    const point = await page.evaluate(() => {
      const rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    await page.touchscreen.tap(point.x, point.y);
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Copy', exact: true }).tap();
    await expect.poll(() => page.evaluate(() => window.__clipboard?.['text/html'])).toContain('<strong>phrase</strong>');
    expect(await page.evaluate(() => window.__clipboard['text/plain'])).toBe('phrase');
    await page.locator('#markdown-preview h1').tap();
    await expect(menu).toHaveCount(0);
    expect(await page.evaluate(() => window.getSelection().toString())).toBe('');
    await page.locator('#markdown-preview strong').tap();
    await expect(menu).toHaveCount(0);
    await expect(editor).toHaveValue(markdown);
  });

  for (const pane of ['editor', 'preview']) {
    test(`touch Copy reopens for only the selected secondary ${pane}`, async ({ page }) => {
      const secondary = '# Secondary document\n\n**Secondary content**';
      await openSecondDocument(page, secondary);
      if (pane === 'preview') await page.keyboard.press('ControlOrMeta+E');
      const surface = page.locator('#document-split-' + pane);
      const menu = await openSurfaceMenu(page, '#document-split-' + pane, 'touch');
      await menu.getByRole('menuitem', { name: 'Select All', exact: true }).tap();
      await page.locator('.app-header').tap({ position: { x: 10, y: 5 } });
      if (pane === 'preview') await surface.locator('strong').tap();
      else await surface.tap({ position: { x: 80, y: 24 } });
      await expect(menu).toBeVisible();
      await menu.getByRole('menuitem', { name: 'Copy', exact: true }).tap();
      if (pane === 'preview') {
        await expect.poll(() => page.evaluate(() => window.__clipboard?.['text/html'])).toContain('<strong>Secondary content</strong>');
        expect(await page.evaluate(() => window.__clipboard['text/plain'])).not.toContain('Clipboard document');
      } else {
        await expect.poll(() => page.evaluate(() => window.__clipboard)).toEqual({ 'text/plain': secondary });
      }
      await expect(page.locator('#markdown-editor')).toHaveValue(markdown);
    });
  }

  test('swiping selected preview text scrolls without reopening the menu', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Native touch swipes use the Chromium input protocol.');
    const longMarkdown = '# Scrollable selection\n\n' + Array.from({ length: 70 }, (_, index) => `Paragraph ${index} for touch scrolling.`).join('\n\n');
    await setEditorContent(page, longMarkdown);
    await expect(page.locator('#markdown-preview p')).toHaveCount(70);
    const menu = await openSurfaceMenu(page, '#markdown-preview', 'touch');
    await menu.getByRole('menuitem', { name: 'Select All', exact: true }).tap();
    await page.locator('.app-header').tap({ position: { x: 10, y: 5 } });
    const scroller = page.locator('.preview-pane');
    await scroller.evaluate(element => { element.scrollTop = 0; });
    const bounds = await scroller.boundingBox();
    const point = { x: bounds.x + 80, y: bounds.y + Math.min(140, bounds.height - 30) };
    const session = await page.context().newCDPSession(page);
    try {
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      for (const distance of [20, 50, 90]) {
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y - distance }] });
        await page.waitForTimeout(50); // Model a moving finger, rather than an instantaneous tap.
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      await expect(menu).toHaveCount(0);
      await expect(page.locator('#markdown-editor')).toHaveValue(longMarkdown);
    } finally {
      await session.detach();
    }
  });

  test('touch menus remain available when contextmenu has no pointer metadata', async ({ page }) => {
    const preview = page.locator('#markdown-preview');
    await preview.dispatchEvent('touchstart');
    await preview.dispatchEvent('contextmenu', { button: 2, clientX: 120, clientY: 220 });
    const menu = page.locator('.document-menu-context.open');
    await menu.getByRole('menuitem', { name: 'Select All', exact: true }).tap();
    await expect(menu).toBeVisible();
    expect(await page.evaluate(() => window.getSelection().toString())).toContain('Clipboard document');
    await menu.getByRole('menuitem', { name: 'Copy', exact: true }).tap();
    await expect(menu).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.__clipboard?.['text/html'])).toContain('<strong>bold phrase</strong>');
  });

  test('mobile Copy Markdown copies the entire raw document from a preview selection', async ({ page }) => {
    await page.locator('#markdown-preview').focus();
    await selectPreview(page, '#markdown-preview strong', 5, 11);
    await page.locator('#mobile-menu-toggle').tap();
    await page.locator('#mobile-copy-markdown').tap();
    await expect.poll(() => page.evaluate(() => window.__clipboard)).toEqual({ 'text/plain': markdown });
  });
});
