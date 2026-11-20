const { test, expect } = require('@playwright/test');

test.skip(process.env.MARKDOWN_VIEWER_TEST_CONTAINER !== '1',
  'Docker integration tests require the real container and enabled service workers.');

async function waitForOfflineShell(page) {
  await page.waitForFunction(async () => {
    const names = await caches.keys();
    const name = names.find(item => item.startsWith('markdown-viewer-cache-'));
    if (!name) return false;
    const cache = await caches.open(name);
    const required = ['/', '/index.html', '/script.js', '/preview-worker.js', '/sample.md'];
    const results = await Promise.all(required.map(path => cache.match(new URL(path, location.origin))));
    return results.every(Boolean);
  }, null, { timeout: 25_000 });
}


test('the real Docker site automatically registers and activates its service worker', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#markdown-editor')).toBeVisible();
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.getRegistration('/');
    return Boolean(registration && registration.active && navigator.serviceWorker.controller);
  }, null, { timeout: 30_000 });
  // The helper asserts successful Cache.match() on all required URLs.
  // Do not reopen the cache by a non-atomic names lookup: activation may
  // rotate/decommission the cache between the two browser evaluations.
  await waitForOfflineShell(page);
});

test('the installed worker loads the editor offline after an online visit', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForFunction(async () => {
    const r = await navigator.serviceWorker.getRegistration('/');
    return Boolean(r && r.active && navigator.serviceWorker.controller);
  }, null, { timeout: 30_000 });
  await waitForOfflineShell(page);
  // Await completed activation with no pending replacement, not merely a
  // truthy controller reference while another install/activation is underway.
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.state === 'activated' &&
      !registration.installing && !registration.waiting &&
      navigator.serviceWorker.controller?.state === 'activated';
  }, null, { timeout: 30_000 });
  await context.setOffline(true);
  await page.waitForFunction(() => navigator.onLine === false);
  // Prove that the worker actually handles an offline network fetch before
  // navigating; otherwise a reload failure is harder to diagnose.
  const offlineFetch = await page.evaluate(async () => {
    try {
      const response = await fetch('/index.html');
      return { status: response.status, controlled: !!navigator.serviceWorker.controller };
    } catch (error) {
      return { error: String(error), controlled: !!navigator.serviceWorker.controller };
    }
  });
  expect(offlineFetch, JSON.stringify(offlineFetch)).toMatchObject({ status: 200, controlled: true });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#markdown-editor')).toBeVisible();
  await context.setOffline(false);
});

test('revalidation replaces a stale application cache entry without clearing documents', async ({ page }) => {
  const { openApp, setEditorContent, storedDocuments } = require('../helpers/app');
  await openApp(page);
  const content = '# Saved Docker document\n\nMust survive cache revalidation.';
  await setEditorContent(page, content);
  await expect.poll(async () => (await storedDocuments(page)).some(doc => doc.content === content)).toBe(true);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 30_000 });
  const result = await page.evaluate(async () => {
    const names = await caches.keys();
    const cache = await caches.open(names.find(name => name.startsWith('markdown-viewer-cache-')));
    await cache.put('/script.js', new Response('OLD-BUILD-APP-CODE', {
      headers: { 'content-type': 'application/javascript' }
    }));
    const response = await fetch('/script.js');
    const body = await response.text();
    return { response: response.status, stale: body === 'OLD-BUILD-APP-CODE' };
  });
  expect(result.response).toBe(200);
  expect(result.stale).toBe(false);
  await page.reload();
  await expect(page.locator('#markdown-editor')).toHaveValue(content);
  expect((await storedDocuments(page)).some(doc => doc.content === content)).toBe(true);
});

test('module MIME and negative asset paths are not HTML SPA fallbacks', async ({ request }) => {
  const module = await request.get('/assets/seo-metadata.mjs');
  expect(module.status()).toBe(200);
  expect(module.headers()['content-type']).toMatch(/javascript/);
  expect(module.headers()['x-content-type-options']).toBe('nosniff');
  expect(module.headers()['content-security-policy']).toBeTruthy();
  const worker = await request.get('/preview-worker.js');
  expect(worker.status()).toBe(200);
  expect(worker.headers()['content-type']).toMatch(/javascript/);
  const missing = await request.get('/not-a-real-file.mjs');
  expect(missing.status()).toBe(404);
});

test('normal editing renders Markdown as HTML in the Docker browser', async ({ page }) => {
  const { openApp, setEditorContent } = require('../helpers/app');
  const errors = await openApp(page);
  await setEditorContent(page, '# Docker Preview Check\n\n**bold text**');
  await expect(page.locator('#markdown-preview')).toContainText('Docker Preview Check');
  await expect(page.locator('#markdown-preview strong')).toContainText('bold text');
  expect(errors).toEqual([]);
});
