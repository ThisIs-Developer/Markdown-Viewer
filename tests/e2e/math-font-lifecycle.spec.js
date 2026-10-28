const { test, expect } = require('@playwright/test');
const { openApp, waitForAppReady, setEditorContent } = require('../helpers/app.js');

async function openAppearance(page) {
  await page.locator('#workspaceSettingsDropdown').click();
  await page.locator('#menu-visual-settings-button').click();
}

async function expectFont(page, prefix) {
  await expect.poll(() => page.evaluate(() =>
    window.MathJax?.startup?.output?.font?.cssFontPrefix
  )).toBe(prefix);
}

async function expectEquation(page, title) {
  await expect(page.locator('#markdown-preview h1')).toHaveText(title);
  await expect(page.locator('#markdown-preview mjx-container')).toHaveCount(1);
  await expect(page.locator('#markdown-preview mjx-container')).toBeVisible();
}

async function holdFont(page, font) {
  let release;
  let requested;
  const gate = new Promise(resolve => { release = resolve; });
  const request = new Promise(resolve => { requested = resolve; });
  await page.route(`https://cdn.jsdelivr.net/npm/${font}-font/chtml.js`, async route => {
    requested();
    const outcome = await gate;
    if (outcome === 'fail') await route.abort('failed');
    else await route.fallback(); // The app helper serves the real, locked npm component.
  });
  return { request, release };
}

test('editing math during a saved-font download keeps the renderer alive', async ({ page }) => {
  await openApp(page, '/', { mockMathJax: false });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const font = await holdFont(page, 'mathjax-stix2');
  try {
    await page.evaluate(() => localStorage.setItem('mdv.visualSettings.v1', JSON.stringify({ mathFont: 'mathjax-stix2' })));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await font.request;
    await page.evaluate(() => { window.__mathRuntime = window.MathJax; });
    await setEditorContent(page, '# Edited while loading\n\n$$x^3 + \\alpha$$');
    // Modern remains usable even while the alternate download is pending.
    await expectEquation(page, 'Edited while loading');
    await expectFont(page, 'MM');
    expect(await page.evaluate(() => window.MathJax === window.__mathRuntime)).toBe(true);
    font.release();
    await expectFont(page, 'STX');
    await expectEquation(page, 'Edited while loading');
    await expect(page.locator('#markdown-preview mjx-container')).toContainText('3');
    expect(errors).toEqual([]);
  } finally {
    font.release();
  }
});

for (const order of ['older-first', 'newer-first', 'older-fails']) {
  test(`rapid selections keep Asana when downloads finish ${order}`, async ({ page }) => {
    await openApp(page, '/', { mockMathJax: false });
    await setEditorContent(page, '# Rapid selection\n\n$$x^2 + \\mathbb{R}$$');
    await expectEquation(page, 'Rapid selection');
    const stix = await holdFont(page, 'mathjax-stix2');
    const asana = await holdFont(page, 'mathjax-asana');
    try {
      await openAppearance(page);
      await page.locator('#visual-setting-math-font').selectOption('mathjax-stix2');
      await stix.request;
      await page.locator('#visual-setting-math-font').selectOption('mathjax-asana');
      await asana.request;
      if (order === 'older-first') {
        stix.release();
        await page.waitForFunction(() => !!window.MathJax?._?.output?.fonts?.['mathjax-stix2']);
        asana.release();
      } else {
        asana.release();
        await expectFont(page, 'ASNA');
        stix.release(order === 'older-fails' ? 'fail' : undefined);
      }
      await page.waitForLoadState('networkidle');
      await expectFont(page, 'ASNA');
      await expectEquation(page, 'Rapid selection');
      await expect(page.locator('#visual-setting-math-font')).toHaveValue('mathjax-asana');
      expect(await page.evaluate(() => ({
        saved: window.visualSettingsStore.getSettings().mathFont,
        active: window.visualSettingsAdapters.getCurrentMathFont()
      }))).toEqual({ saved: 'mathjax-asana', active: 'mathjax-asana' });
    } finally {
      stix.release();
      asana.release();
    }
  });
}

for (const outcome of ['pending', 'failed']) {
  test(`Reset restores usable math after a ${outcome} saved-font download`, async ({ page }) => {
    await openApp(page, '/', { mockMathJax: false });
    const font = await holdFont(page, 'mathjax-stix2');
    try {
      await page.evaluate(() => localStorage.setItem('mdv.visualSettings.v1', JSON.stringify({ mathFont: 'mathjax-stix2' })));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForAppReady(page);
      await font.request;
      if (outcome === 'failed') {
        font.release('fail');
        await expect.poll(() => page.evaluate(() => window.visualSettingsAdapters.getCurrentMathFont())).toBe('mathjax-modern');
      }
      await setEditorContent(page, '# Font fallback\n\n$$x^2$$');
      await expectEquation(page, 'Font fallback');
      await expectFont(page, 'MM');
      await openAppearance(page);
      await page.locator('#visual-settings-reset-btn').click();
      await expect(page.locator('#visual-setting-math-font')).toHaveValue('mathjax-modern');
      font.release();
      await page.waitForLoadState('networkidle');
      await page.locator('#visual-settings-close-btn').click();
      await setEditorContent(page, '# After reset\n\n$$x^3$$');
      await expectEquation(page, 'After reset');
      await expectFont(page, 'MM');

      if (outcome === 'failed') {
        // Retry the exact failed URL after connectivity returns.
        await page.unroute('https://cdn.jsdelivr.net/npm/mathjax-stix2-font/chtml.js');
        await openAppearance(page);
        await page.locator('#visual-setting-math-font').selectOption('mathjax-stix2');
        await expectFont(page, 'STX');
        await expectEquation(page, 'After reset');
      }
    } finally {
      font.release();
    }
  });
}
