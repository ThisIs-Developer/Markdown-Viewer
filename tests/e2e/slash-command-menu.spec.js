const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent, editorValue } = require('../helpers/app');

async function slashMenuPlacement(page) {
  return page.evaluate(() => {
    const editor = document.getElementById('markdown-editor');
    const style = getComputedStyle(editor);
    const lineIndex = editor.value.slice(0, editor.selectionStart).split('\n').length - 1;
    const lineTop = editor.getBoundingClientRect().top + parseFloat(style.borderTopWidth) +
      parseFloat(style.paddingTop) + lineIndex * parseFloat(style.lineHeight) - editor.scrollTop;
    const lineBottom = lineTop + parseFloat(style.lineHeight);
    const menu = document.getElementById('slash-command-menu').getBoundingClientRect();
    const list = document.getElementById('slash-command-list');
    return {
      belowLine: menu.top >= lineBottom,
      aboveLine: menu.bottom <= lineTop,
      withinViewport: menu.top >= 8 && menu.bottom <= window.innerHeight - 8 &&
        menu.left >= 8 && menu.right <= window.innerWidth - 8,
      scrollable: list.scrollHeight > list.clientHeight,
      height: menu.height
    };
  });
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Edit Markdown' }).click();
});

test('opens at a line slash and filters commands while typing', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.stack || error.message));
  await setEditorContent(page, '');
  const editor = page.locator('#markdown-editor');
  await editor.pressSequentially('/hea');

  const menu = page.locator('#slash-command-menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('option')).toHaveCount(6);
  await expect(menu.getByRole('option').first()).toContainText('Heading 1');
  await expect(menu.locator('.slash-command-text-icon')).toHaveCount(6);
  await expect(editor).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => pageErrors.filter(error => error.includes('positionSlashCommandMenu'))).toEqual([]);
});

test('opens the full alert chooser from the slash menu', async ({ page }) => {
  await setEditorContent(page, '');
  const editor = page.locator('#markdown-editor');
  await editor.pressSequentially('/alert');
  await editor.press('Enter');

  await expect(page.locator('#alert-modal')).toBeVisible();
  await expect(page.locator('#alert-modal .alert-option')).toHaveCount(5);
  await expect(page.locator('#alert-modal .alert-option[data-alert-type="caution"]')).toBeVisible();
  await expect.poll(() => editorValue(page)).toBe('');
});

test('uses available icons for every slash command', async ({ page }) => {
  await setEditorContent(page, '/');
  const icons = page.locator('#slash-command-menu .slash-command-icon.lucide');
  await expect(icons).toHaveCount(15);
  const missingIcons = await icons.evaluateAll(nodes => nodes
    .filter(node => getComputedStyle(node).maskImage === 'none' && getComputedStyle(node).webkitMaskImage === 'none')
    .map(node => node.className));
  expect(missingIcons).toEqual([]);
});

test('opens table, diagram, and media choosers from slash commands', async ({ page }) => {
  const editor = page.locator('#markdown-editor');
  await setEditorContent(page, '/table');
  await editor.press('Enter');
  await expect(page.locator('#table-modal')).toBeVisible();
  await page.locator('#table-modal-cancel').click();

  await setEditorContent(page, '/diagram');
  await editor.press('Enter');
  await expect(page.locator('#diagram-modal')).toBeVisible();
  await page.locator('#diagram-modal-cancel').click();

  await setEditorContent(page, '/image');
  await editor.press('Enter');
  await expect(page.locator('#image-modal')).toBeVisible();
});

test('inserts the selected command with the keyboard', async ({ page }) => {
  await setEditorContent(page, 'Intro\n');
  const editor = page.locator('#markdown-editor');
  await editor.pressSequentially('/task');
  await expect(page.locator('#slash-command-menu')).toBeVisible();
  await editor.press('Enter');

  await expect.poll(() => editorValue(page)).toBe('Intro\n- [ ] ');
  await expect(page.locator('#slash-command-menu')).toBeHidden();
  await expect(editor).toHaveAttribute('aria-expanded', 'false');
});

test('supports arrow navigation and escape without changing text', async ({ page }) => {
  await setEditorContent(page, '');
  const editor = page.locator('#markdown-editor');
  await editor.pressSequentially('/');
  await editor.press('ArrowDown');
  await editor.press('Enter');

  await expect.poll(() => editorValue(page)).toBe('# ');

  await setEditorContent(page, '/quo');
  await expect(page.locator('#slash-command-menu')).toBeVisible();
  await editor.press('Escape');
  await expect(page.locator('#slash-command-menu')).toBeHidden();
  await expect.poll(() => editorValue(page)).toBe('/quo');
});

test('does not open for slashes inside normal text or URLs', async ({ page }) => {
  await setEditorContent(page, 'Visit https://example.com/');
  await expect(page.locator('#slash-command-menu')).toBeHidden();

  const editor = page.locator('#markdown-editor');
  await editor.pressSequentially('docs');
  await expect(page.locator('#slash-command-menu')).toBeHidden();
});

test('does not open after text or indentation on the current line', async ({ page }) => {
  await setEditorContent(page, 'Insert ');
  const editor = page.locator('#markdown-editor');
  await editor.pressSequentially('/hea');
  await expect(page.locator('#slash-command-menu')).toBeHidden();

  await setEditorContent(page, '  /hea');
  await expect(page.locator('#slash-command-menu')).toBeHidden();
});

test('closes when a keyboard shortcut creates another document', async ({ page }) => {
  await setEditorContent(page, '/');
  const editor = page.locator('#markdown-editor');
  await expect(page.locator('#slash-command-menu')).toBeVisible();

  await editor.press('Alt+Shift+t');
  await expect(page.locator('#tab-list .tab-item')).toHaveCount(2);
  await expect(page.locator('#slash-command-menu')).toBeHidden();
  await expect(editor).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => editorValue(page)).toBe('');
});

test('does not execute commands during IME composition', async ({ page }) => {
  await setEditorContent(page, '/');
  const editor = page.locator('#markdown-editor');
  await expect(page.locator('#slash-command-menu')).toBeVisible();

  await editor.evaluate(node => {
    node.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', isComposing: true, bubbles: true, cancelable: true
    }));
  });
  await expect.poll(() => editorValue(page)).toBe('/');
  await expect(page.locator('#slash-command-menu')).toBeVisible();

  await editor.dispatchEvent('compositionstart');
  await expect(page.locator('#slash-command-menu')).toBeHidden();
  await editor.dispatchEvent('compositionend');
  await expect(page.locator('#slash-command-menu')).toBeVisible();
});

test('closes when Find takes focus from the editor', async ({ page }) => {
  await setEditorContent(page, '/');
  const editor = page.locator('#markdown-editor');
  await expect(page.locator('#slash-command-menu')).toBeVisible();

  await editor.press('Control+f');
  await expect(page.locator('#find-replace-input')).toBeFocused();
  await expect(page.locator('#slash-command-menu')).toBeHidden();
  await expect(editor).toHaveAttribute('aria-expanded', 'false');
});

test('exposes the listbox to assistive technology and anchors it inside an RTL editor', async ({ page }) => {
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
  await setEditorContent(page, '/');
  const editor = page.locator('#markdown-editor');
  const menu = page.locator('#slash-command-menu');
  await expect(menu).toBeVisible();
  await expect(editor).toHaveAttribute('aria-controls', 'slash-command-list');
  await expect(page.locator('#slash-command-list')).toHaveAttribute('role', 'listbox');
  const activeId = await editor.getAttribute('aria-activedescendant');
  expect(activeId).toBeTruthy();
  await expect(page.locator('#slash-command-list').locator('#' + activeId)).toHaveAttribute('role', 'option');
  await expect(menu.getByRole('option').first()).toHaveAttribute('tabindex', '-1');

  const position = await page.evaluate(() => {
    const editorRect = document.getElementById('markdown-editor').getBoundingClientRect();
    const menuRect = document.getElementById('slash-command-menu').getBoundingClientRect();
    return { editorRight: editorRect.right, menuRight: menuRect.right, menuLeft: menuRect.left };
  });
  expect(position.menuRight).toBeLessThanOrEqual(position.editorRight + 8);
  expect(position.menuLeft).toBeGreaterThanOrEqual(8);
});

test('still inserts a command selected with the mouse', async ({ page }) => {
  await setEditorContent(page, '/heading');
  await page.locator('#slash-command-menu').getByRole('option', { name: /Heading 2/ }).click();
  await expect.poll(() => editorValue(page)).toBe('## ');
});

for (const width of [900, 375]) {
  test(`keeps the full and filtered menu below the typing line at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 500 });
    await setEditorContent(page, 'text\n\n');
    const editor = page.locator('#markdown-editor');
    const menu = page.locator('#slash-command-menu');
    await editor.pressSequentially('/');
    await expect(menu.getByRole('option')).toHaveCount(21);
    await expect.poll(() => slashMenuPlacement(page)).toMatchObject({
      belowLine: true, withinViewport: true, scrollable: true
    });

    await editor.pressSequentially('pa');
    await expect(menu.getByRole('option')).toHaveCount(2);
    await expect.poll(() => slashMenuPlacement(page)).toMatchObject({
      belowLine: true, withinViewport: true, scrollable: false
    });

    await editor.press('Backspace');
    await editor.press('Backspace');
    await expect(menu.getByRole('option')).toHaveCount(21);
    await expect.poll(() => slashMenuPlacement(page)).toMatchObject({
      belowLine: true, withinViewport: true, scrollable: true
    });
    await editor.press('ArrowUp');
    await expect(menu.getByRole('option').last()).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => menu.getByRole('option').last().evaluate(option => {
      const list = option.parentElement.getBoundingClientRect();
      const rect = option.getBoundingClientRect();
      return rect.top >= list.top && rect.bottom <= list.bottom + 1;
    })).toBe(true);
    await expect(editor).toBeFocused();
    await expect.poll(() => editorValue(page)).toBe('text\n\n/');
  });
}

test('constrains the menu above a typing line near the bottom of the screen', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 500 });
  await setEditorContent(page, 'text\n'.repeat(10));
  await page.locator('#markdown-editor').pressSequentially('/');
  await expect.poll(() => slashMenuPlacement(page)).toMatchObject({
    aboveLine: true, withinViewport: true, scrollable: true
  });
});

test('recalculates the available menu height when the viewport changes', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await setEditorContent(page, 'text\n\n/');
  await expect.poll(() => slashMenuPlacement(page)).toMatchObject({ belowLine: true, height: 420 });

  await page.setViewportSize({ width: 900, height: 500 });
  await expect.poll(() => slashMenuPlacement(page)).toMatchObject({
    belowLine: true, withinViewport: true, scrollable: true
  });
  expect((await slashMenuPlacement(page)).height).toBeLessThan(420);

  await page.setViewportSize({ width: 900, height: 800 });
  await expect.poll(() => slashMenuPlacement(page)).toMatchObject({
    belowLine: true, withinViewport: true, height: 420
  });
});
