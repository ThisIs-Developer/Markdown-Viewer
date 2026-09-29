const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent, editorValue } = require('../helpers/app');

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
  const missingIcons = await page.locator('#slash-command-menu .slash-command-icon i').evaluateAll(nodes => nodes
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
