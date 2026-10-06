const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent } = require('../helpers/app');

async function workspacePosition(page) {
  return page.evaluate(() => {
    const app = document.querySelector('.app-container');
    const bounds = selector => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    };
    return {
      windowLeft: window.scrollX,
      appLeft: app.scrollLeft,
      header: bounds('.app-header'),
      workspace: bounds('#document-workspace-shell'),
      editor: bounds('#markdown-editor'),
      preview: bounds('.preview-pane')
    };
  });
}

for (const width of [1280, 1912]) {
  test.describe(`editor page navigation at ${width}px`, () => {
    test.use({ viewport: { width, height: 948 }, deviceScaleFactor: 1 });

    for (const key of ['PageDown', 'PageUp']) {
      test(`${key} keeps the Welcome split view horizontally aligned`, async ({ page }) => {
        await openApp(page);
        const editor = page.getByRole('textbox', { name: 'Markdown editor input with live preview' });
        await expect(page.locator('.content-container')).toHaveClass(/view-split/);
        const original = await workspacePosition(page);
        const content = await editor.inputValue();

        await editor.evaluate((element, startAtEnd) => {
          element.focus();
          const position = startAtEnd ? element.value.length : 0;
          element.setSelectionRange(position, position);
          element.scrollTop = startAtEnd ? element.scrollHeight : 0;
        }, key === 'PageUp');
        const before = await editor.evaluate(element => element.selectionStart);
        await editor.press(key);

        await expect.poll(() => editor.evaluate(element => element.selectionStart)).not.toBe(before);
        await expect.poll(() => workspacePosition(page)).toEqual(original);
        await expect(editor).toBeFocused();
        await expect(editor).toHaveValue(content);
      });
    }
  });
}

test('page navigation and selection still work after opening and closing Settings', async ({ page }) => {
  await openApp(page);
  await setEditorContent(page, Array.from({ length: 120 }, (_, i) => `Paragraph ${i + 1}: keyboard navigation remains native.`).join('\n\n'));
  const settings = page.locator('#workspaceSettingsDropdown');
  const menu = page.locator('[aria-labelledby="workspaceSettingsDropdown"]');
  await settings.click();
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  // Bootstrap removes Popper's placement when it closes the menu. It must not
  // leave a hidden menu extending the app's horizontal scroll area afterward.
  await expect.poll(() => page.locator('.app-container').evaluate(app => app.scrollWidth - app.clientWidth)).toBe(0);

  const editor = page.getByRole('textbox', { name: 'Markdown editor input with live preview' });
  const original = await workspacePosition(page);
  await editor.evaluate(element => {
    element.focus();
    element.setSelectionRange(0, 0);
    element.scrollTop = 0;
  });
  await editor.press('PageDown');
  await expect.poll(() => editor.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  const caret = await editor.evaluate(element => element.selectionStart);
  expect(caret).toBeGreaterThan(0);
  const scrollTop = await editor.evaluate(element => element.scrollTop);

  await editor.press('Shift+PageDown');
  await expect.poll(() => editor.evaluate(element => element.selectionEnd - element.selectionStart)).toBeGreaterThan(0);
  await expect.poll(() => workspacePosition(page)).toEqual(original);

  await editor.press('PageUp');
  await editor.press('PageUp');
  await expect.poll(() => editor.evaluate(element => element.scrollTop)).toBeLessThan(scrollTop);
  await expect.poll(() => workspacePosition(page)).toEqual(original);
});
