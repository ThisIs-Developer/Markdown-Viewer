const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent } = require('../helpers/app');

const fullscreenSelector = '[data-md-action="fullscreen"]';
test.use({ hasTouch: true });

async function removeFullscreenApi(page) {
  await page.evaluate(() => {
    Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: undefined });
    Object.defineProperty(document.documentElement, 'webkitRequestFullscreen', { configurable: true, value: undefined });
  });
}

test('mobile fallback can be exited by touch after opening release notes or closing every tab', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page, '/', { showReleaseNotes: true });
  await removeFullscreenApi(page);
  const toggle = page.locator(fullscreenSelector);
  await toggle.tap();
  await expect(page.locator('.app-header')).toBeHidden();
  await page.locator('#tab-list .release-notes-tab').click();
  await expect(toggle).toBeEnabled();
  await toggle.tap();
  await expect(page.locator('.app-header')).toBeVisible();

  await toggle.tap();
  while (await page.locator('#tab-list .tab-close-btn').count()) {
    await page.locator('#tab-list .tab-close-btn').first().click();
  }
  await expect(toggle).toBeEnabled();
  await toggle.tap();
  await expect(page.locator('.app-header')).toBeVisible();
});

test('mobile fallback preserves the document, fits rotation, and lets dialogs handle Escape first', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  await removeFullscreenApi(page);
  const markdown = '# Fullscreen investigation\n\nKeep this content when entering and exiting.';
  await setEditorContent(page, markdown);
  const toggle = page.locator(fullscreenSelector);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(toggle).toHaveAttribute('aria-label', 'Exit expanded view');
  await expect(page.locator('#app-toast-region')).toContainText('browser controls');
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await page.screenshot({ path: testInfo.outputPath('expanded-portrait.png') });

  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(async () => Math.round((await page.locator('.app-container').boundingBox()).height)).toBe(viewport.height);
    await expect(page.locator('.app-header')).toBeHidden();
    await expect(toggle).toBeEnabled();
  }
  await page.locator('[data-md-action="link"]').click();
  await expect(page.locator('#link-modal-url')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#link-modal')).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');

  await page.screenshot({ path: testInfo.outputPath('expanded-landscape.png') });
  await page.keyboard.press('Escape');
  await expect(page.locator('.app-header')).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#markdown-editor')).toHaveValue(markdown);
});

test('legacy Safari uses its asynchronous prefixed fullscreen API and tracks external exit', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    const root = document.documentElement;
    Object.defineProperty(root, 'requestFullscreen', { configurable: true, value: undefined });
    Object.defineProperty(document, 'webkitFullscreenEnabled', { configurable: true, value: true });
    let element = null;
    Object.defineProperty(document, 'webkitFullscreenElement', { configurable: true, get: () => element });
    window.__exitLegacyFullscreen = () => {
      element = null;
      document.dispatchEvent(new Event('webkitfullscreenchange'));
    };
    Object.defineProperty(root, 'webkitRequestFullscreen', { configurable: true, value() {
      if (this !== root) throw new Error('Invalid fullscreen receiver');
      setTimeout(() => {
        element = root;
        document.dispatchEvent(new Event('webkitfullscreenchange'));
      }, 50);
      // Older Safari returns void and reports completion only through events.
    } });
    Object.defineProperty(document, 'webkitExitFullscreen', { configurable: true, value() {
      if (this !== document) throw new Error('Invalid exit receiver');
      setTimeout(window.__exitLegacyFullscreen, 50);
    } });
  });
  const toggle = page.locator(fullscreenSelector);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-label', 'Exit fullscreen');
  await expect(page.locator('.app-header')).toBeVisible();
  await toggle.click();
  await expect.poll(() => page.evaluate(() => Boolean(document.webkitFullscreenElement))).toBe(false);
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => window.__exitLegacyFullscreen());
  await expect(toggle).toHaveAttribute('aria-label', 'Enter fullscreen');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
});

for (const failure of ['rejection', 'throw', 'disabled', 'webkitfullscreenerror']) {
  test(`fullscreen ${failure} offers an expanded view without an unhandled error`, async ({ page }) => {
    const errors = await openApp(page);
    await page.evaluate(failure => {
      const root = document.documentElement;
      window.__fullscreenCalls = 0;
      Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: failure !== 'disabled' });
      Object.defineProperty(root, 'requestFullscreen', { configurable: true, value: failure === 'webkitfullscreenerror' ? undefined : function() {
        window.__fullscreenCalls++;
        if (failure === 'throw') throw new TypeError('Fullscreen is unavailable');
        return Promise.reject(new TypeError('Fullscreen is not allowed'));
      } });
      Object.defineProperty(document, 'webkitFullscreenEnabled', { configurable: true, value: true });
      Object.defineProperty(document, 'webkitExitFullscreen', { configurable: true, value() {} });
      Object.defineProperty(root, 'webkitRequestFullscreen', { configurable: true, value() {
        setTimeout(() => document.dispatchEvent(new Event('webkitfullscreenerror')), 50);
      } });
    }, failure);
    const toggle = page.locator(fullscreenSelector);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-label', 'Exit expanded view');
    await expect(page.locator('.app-header')).toBeHidden();
    if (failure === 'disabled') expect(await page.evaluate(() => window.__fullscreenCalls)).toBe(0);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.app-header')).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('repeated clicks cannot leave fallback active after a native fullscreen transition', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    const root = document.documentElement;
    let element = null;
    window.__fullscreenCalls = 0;
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => element });
    Object.defineProperty(root, 'requestFullscreen', { configurable: true, value() {
      window.__fullscreenCalls++;
      return new Promise(resolve => {
        window.__finishFullscreen = () => {
          element = root;
          document.dispatchEvent(new Event('fullscreenchange'));
          resolve();
        };
      });
    } });
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value() {
      element = null;
      document.dispatchEvent(new Event('fullscreenchange'));
      return Promise.resolve();
    } });
  });
  const toggle = page.locator(fullscreenSelector);
  await toggle.click();
  await toggle.click();
  expect(await page.evaluate(() => window.__fullscreenCalls)).toBe(1);
  await page.evaluate(() => window.__finishFullscreen());
  await expect(toggle).toHaveAttribute('aria-label', 'Exit fullscreen');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.app-header')).toBeVisible();
});

test('printing from expanded view does not clip the page to the screen height', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  await removeFullscreenApi(page);
  await setEditorContent(page, '# Print\n\n' + 'A paragraph to fill several printed pages.\n\n'.repeat(120));
  await page.locator(fullscreenSelector).click();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('html')).toHaveCSS('overflow-y', 'visible');
  await expect(page.locator('body')).toHaveCSS('overflow-y', 'visible');
  expect((await page.locator('.app-container').boundingBox()).height).toBeGreaterThan(1000);
});

test('native fullscreen still enters and exits through the toolbar', async ({ page }) => {
  await openApp(page);
  test.skip(!await page.evaluate(() => document.fullscreenEnabled), 'The browser harness does not support native fullscreen.');
  const toggle = page.locator(fullscreenSelector);
  await toggle.click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === document.documentElement)).toBe(true);
  await expect(toggle).toHaveAttribute('aria-label', 'Exit fullscreen');
  await expect(page.locator('.app-header')).toBeVisible();
  await toggle.click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
});

test('expanded view follows visual viewport resizing and restores the page size on exit', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  await removeFullscreenApi(page);
  const initialHeight = (await page.locator('.app-container').boundingBox()).height;
  await page.locator(fullscreenSelector).click();
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 420 });
    window.visualViewport.dispatchEvent(new Event('resize'));
  });
  await expect.poll(async () => (await page.locator('.app-container').boundingBox()).height).toBe(420);
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'scale', { configurable: true, value: 2 });
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 210 });
    window.visualViewport.dispatchEvent(new Event('resize'));
  });
  await expect.poll(async () => (await page.locator('.app-container').boundingBox()).height).toBe(420);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await page.locator('.app-container').boundingBox()).height).toBe(initialHeight);
});

test('a failed native exit leaves an accurate button and can be retried', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => {
    const root = document.documentElement;
    let element = root;
    let attempts = 0;
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => element });
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value() {
      if (++attempts === 1) return Promise.reject(new TypeError('Cannot exit now'));
      element = null;
      document.dispatchEvent(new Event('fullscreenchange'));
      return Promise.resolve();
    } });
    document.dispatchEvent(new Event('fullscreenchange'));
  });
  const toggle = page.locator(fullscreenSelector);
  await toggle.click();
  await expect(page.locator('#app-toast-region')).toContainText('Could not exit fullscreen');
  await expect(toggle).toHaveAttribute('aria-label', 'Exit fullscreen');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-label', 'Enter fullscreen');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});
