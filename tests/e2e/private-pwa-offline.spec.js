const { test, expect } = require('@playwright/test');

async function openControlledV2(browser, baseURL) {
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  await page.goto(baseURL + '/v2/', { waitUntil: 'load' });
  await expect.poll(async () => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration('/');
    return !!registration?.active;
  }), { timeout: 20000 }).toBe(true);
  await page.reload({ waitUntil: 'load' });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  return { context, page };
}

test('compact V2 entry registers the root PWA service worker', async ({ browser, baseURL }) => {
  const { context } = await openControlledV2(browser, baseURL);
  await context.close();
});

test('compact V2 entry and previously fetched renderer survive offline reload', async ({ browser, baseURL, browserName }) => {
  test.skip(browserName === 'webkit', 'Playwright WebKit offline reload fails on both / and /v2/ in this Linux environment; Safari device validation required.');
  const { context, page } = await openControlledV2(browser, baseURL);
  try {
    const rendererURL = baseURL + '/assets/secure-renderers/libs/tex-svg.js';
    expect(await page.evaluate(async url => (await fetch(url)).status, rendererURL)).toBe(200);
    await context.setOffline(true);
    const offlinePage = await page.reload({ waitUntil: 'domcontentloaded' });
    expect(offlinePage?.status()).toBe(200);
    await expect(page).toHaveTitle(/Markdown Viewer/);
    expect(await page.evaluate(async url => (await fetch(url)).status, rendererURL)).toBe(200);
  } finally {
    await context.close();
  }
});
