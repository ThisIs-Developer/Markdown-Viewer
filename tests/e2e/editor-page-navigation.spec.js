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

async function recordPaging(editor, key) {
  const keys = Array.isArray(key) ? key : [key];
  await editor.evaluate((element, pagingKey) => {
    element.pagingResult = new Promise(resolve => {
      element.addEventListener('keydown', function start(event) {
        if (event.key !== pagingKey) return;
        element.removeEventListener('keydown', start);
        const frames = [];
        const initialTop = element.scrollTop;
        const started = performance.now();
        let previousTop = initialTop;
        let stableFrames = 0;
        function sample() {
          const top = element.scrollTop;
          frames.push({ top, appLeft: document.querySelector('.app-container').scrollLeft });
          stableFrames = top === previousTop ? stableFrames + 1 : 0;
          previousTop = top;
          if ((performance.now() - started > 100 && stableFrames >= 6) || performance.now() - started > 2500) {
            resolve({ frames, selectionStart: element.selectionStart, selectionEnd: element.selectionEnd });
          } else {
            requestAnimationFrame(sample);
          }
        }
        sample();
      });
    });
  }, keys[0].split('+').at(-1));
  for (const pressedKey of keys) await editor.press(pressedKey);
  return editor.evaluate(element => element.pagingResult);
}

function expectSmoothPaging(result, direction) {
  const positions = [...new Set(result.frames.map(frame => frame.top))];
  expect((positions.at(-1) - positions[0]) * direction).toBeGreaterThan(0);
  // Firefox can extend a selection with only a one-pixel viewport adjustment;
  // integer scrollTop readings cannot expose an intermediate position there.
  if (Math.abs(positions.at(-1) - positions[0]) > 1) {
    expect(positions.length, `paging should paint intermediate scroll positions: ${positions.join(', ')}`).toBeGreaterThan(2);
  }
  for (let i = 1; i < positions.length; i++) {
    expect((positions[i] - positions[i - 1]) * direction, `scroll sync must not reverse the animation: ${positions.join(', ')}`).toBeGreaterThanOrEqual(-1);
  }
  expect(result.frames.every(frame => frame.appLeft === 0)).toBe(true);
}

const longDocument = Array.from({ length: 120 }, (_, i) => `Paragraph ${i + 1}: keyboard navigation remains native.`).join('\n\n');

async function waitForScrollIdle(page) {
  await page.evaluate(() => new Promise(resolve => {
    let previous = '';
    let stableFrames = 0;
    function sample() {
      const positions = ['#markdown-editor', '.preview-pane', '#document-split-editor'].map(selector => document.querySelector(selector).scrollTop).join(',');
      stableFrames = positions === previous ? stableFrames + 1 : 0;
      previous = positions;
      if (stableFrames >= 6) resolve();
      else requestAnimationFrame(sample);
    }
    sample();
  }));
}

async function prepareLongDocument(page) {
  await setEditorContent(page, longDocument);
  await expect(page.locator('#markdown-preview')).toContainText('Paragraph 120');
  await waitForScrollIdle(page);
  const editor = page.locator('#markdown-editor');
  await editor.evaluate(element => {
    element.focus();
    element.setSelectionRange(0, 0);
    element.scrollTop = 0;
  });
  await waitForScrollIdle(page);
  return editor;
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
  await setEditorContent(page, longDocument);
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
  await recordPaging(editor, 'PageDown');
  await expect.poll(() => editor.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  const caret = await editor.evaluate(element => element.selectionStart);
  expect(caret).toBeGreaterThan(0);
  const scrollTop = await editor.evaluate(element => element.scrollTop);

  await recordPaging(editor, 'Shift+PageDown');
  await expect.poll(() => editor.evaluate(element => element.selectionEnd - element.selectionStart)).toBeGreaterThan(0);
  await expect.poll(() => workspacePosition(page)).toEqual(original);

  await recordPaging(editor, 'PageUp');
  await recordPaging(editor, 'PageUp');
  await expect.poll(() => editor.evaluate(element => element.scrollTop)).toBeLessThan(scrollTop);
  await expect.poll(() => workspacePosition(page)).toEqual(original);
});

test.describe('smooth Editor paging', () => {
  test.use({ reducedMotion: 'no-preference' });

  for (const sync of [true, false]) {
    test(`Page Up/Down and Shift selection animate with sync ${sync ? 'on' : 'off'}`, async ({ page }) => {
      await openApp(page);
      if (!sync) await page.locator('#toggle-sync').click();
      const editor = await prepareLongDocument(page);
      const originalPreviewTop = await page.locator('.preview-pane').evaluate(element => element.scrollTop);

      const down = await recordPaging(editor, 'PageDown');
      expectSmoothPaging(down, 1);
      expect(down.selectionStart).toBeGreaterThan(0);
      expect(down.selectionEnd).toBe(down.selectionStart);
      const selected = await recordPaging(editor, 'Shift+PageDown');
      expect(selected.selectionStart).toBe(down.selectionStart);
      expect(selected.selectionEnd).toBeGreaterThan(selected.selectionStart);
      // The first extension can fit in the visible page. Extend again to
      // exercise scrolling without changing the browser's selection behavior.
      const extended = await recordPaging(editor, 'Shift+PageDown');
      expectSmoothPaging(extended, 1);
      expect(extended.selectionEnd).toBeGreaterThan(selected.selectionEnd);
      const up = await recordPaging(editor, 'PageUp');
      expectSmoothPaging(up, -1);
      expect(up.selectionEnd).toBe(up.selectionStart);
      await expect(editor).toBeFocused();
      await expect(editor).toHaveValue(longDocument);

      const ratios = await page.evaluate(() => {
        const editor = document.querySelector('#markdown-editor');
        const preview = document.querySelector('.preview-pane');
        return {
          editor: editor.scrollTop / (editor.scrollHeight - editor.clientHeight),
          preview: preview.scrollTop / (preview.scrollHeight - preview.clientHeight)
        };
      });
      if (sync) expect(Math.abs(ratios.editor - ratios.preview)).toBeLessThan(0.005);
      else expect(await page.locator('.preview-pane').evaluate(element => element.scrollTop)).toBe(originalPreviewTop);
    });
  }

  test('repeated paging reaches the next page and preserves native cursor movement', async ({ page }) => {
    await openApp(page);
    const editor = await prepareLongDocument(page);
    const down = await recordPaging(editor, 'PageDown');
    const repeated = await recordPaging(editor, ['PageDown', 'PageDown']);
    expectSmoothPaging(repeated, 1);
    expect(repeated.selectionStart).toBeGreaterThan(down.selectionStart);
    expect(repeated.selectionEnd).toBe(repeated.selectionStart);
    await expect(editor).toHaveValue(longDocument);
  });

  test('the secondary document Editor also animates paging', async ({ page }) => {
    await openApp(page);
    await prepareLongDocument(page);
    const firstTab = page.locator('#tab-list .tab-item').first();
    await page.locator('#tab-new-btn').click();
    await prepareLongDocument(page);
    const secondId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
    await firstTab.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Open in split view' }).click();
    await page.locator('#document-split-destination').selectOption(secondId);
    await page.locator('#document-split-modal-confirm').click();

    const editor = page.locator('#document-split-editor');
    await expect(editor).toBeVisible();
    await editor.evaluate(element => {
      element.focus();
      element.setSelectionRange(0, 0);
      element.scrollTop = 0;
    });
    expectSmoothPaging(await recordPaging(editor, 'PageDown'), 1);
    expectSmoothPaging(await recordPaging(editor, 'PageUp'), -1);
    await expect(editor).toHaveValue(longDocument);
    await expect(page.locator('#markdown-editor')).toHaveValue(longDocument);
  });

  test('reduced motion leaves immediate native Page Up unchanged', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openApp(page);
    const editor = await prepareLongDocument(page);
    const down = await recordPaging(editor, 'PageDown');
    const up = await recordPaging(editor, 'PageUp');
    const positions = [...new Set(up.frames.map(frame => frame.top))];
    expect(positions.length).toBe(2);
    expect(positions[1]).toBeLessThan(positions[0]);
    expect(up.selectionStart).toBeLessThan(down.selectionStart);
    await expect(editor).toHaveValue(longDocument);
  });

  test('paging remains smooth at a mobile viewport width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openApp(page);
    const editor = await prepareLongDocument(page);
    expectSmoothPaging(await recordPaging(editor, 'PageDown'), 1);
    expectSmoothPaging(await recordPaging(editor, 'PageUp'), -1);
    await expect(editor).toHaveValue(longDocument);
  });
});
