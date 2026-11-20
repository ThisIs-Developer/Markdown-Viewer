const { test, expect } = require('@playwright/test');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { openApp, setEditorContent } = require('../helpers/app');
const C = require('../../sharing-crypto');
test.describe.configure({ timeout: 240000 });
// Playwright's SW-blocking init script accesses navigator.serviceWorker inside
// opaque frames. Allow SWs here so the harness does not cause sandbox errors.
test.use({ serviceWorkers: 'allow' });
const engines = ['mermaid','plantuml','graphviz','d2','markmap','vegalite','wavedrom','stl','geojson','abc','topojson'];
const fixture = () => readFile(path.join(__dirname, '../fixtures/encrypted-rich-content.md'), 'utf8');

async function withoutSecurityHeaders(route) {
  const response = await route.fetch();
  const headers = { ...response.headers() };
  for (const name of ['access-control-allow-origin', 'content-security-policy', 'cross-origin-resource-policy']) delete headers[name];
  await route.fulfill({ response, headers });
}

async function assertRendered(page) {
  for (const engine of engines) {
    await page.waitForFunction(name => document.querySelector('#markdown-preview img[data-private-diagram="' + name + '"]') || document.querySelector('#markdown-preview .render-error-msg'), engine, { timeout: 120000 });
    expect(await page.locator('#markdown-preview .render-error-msg').allTextContents()).toEqual([]);
    const image = page.locator('#markdown-preview img[data-private-diagram="' + engine + '"]');
    await expect(image, engine + ' must render with the real local engine').toHaveCount(1, { timeout: 120000 });
    await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  }
  await expect(page.locator('#markdown-preview img[data-private-diagram="math"]')).toHaveCount(2);
  await expect(page.locator('#markdown-preview .render-error-msg')).toHaveCount(0);
}

for (const headerless of [false, true]) test('encrypted snapshots render the complete rich-content fixture without remote rendering' + (headerless ? ' on a plain static host' : ''), async ({ page, baseURL }) => {
  const content = await fixture(), key = C.random();
  const encrypted = await C.seal({ content, title: 'Rich encrypted fixture', mode: 'edit' }, key, 'snapshot');
  const unexpected = [];
  await page.context().route(/^https?:\/\//, async route => {
    if (new URL(route.request().url()).origin === new URL(baseURL).origin) {
      if (headerless && new URL(route.request().url()).pathname.startsWith('/assets/private-renderers/')) return withoutSecurityHeaders(route);
      return route.continue();
    }
    unexpected.push(route.request().url()); return route.abort();
  });
  const errors = await openApp(page, baseURL + '/#share=v2.' + C.pack(encrypted) + '&key=' + key, { mockMathJax: false });
  await assertRendered(page);
  expect(unexpected).toEqual([]);
  expect(errors.filter(error => !/favicon/.test(error))).toEqual([]);
  const frame = page.locator('iframe[sandbox="allow-scripts"]');
  await expect(frame).toHaveCount(1);
  expect(await frame.evaluate(element => { try { return element.contentWindow.document !== undefined; } catch (_) { return false; } })).toBe(false);
  await page.locator('#exportDropdown').click();
  await page.locator('#export-html').click();
  const download = page.waitForEvent('download');
  await page.locator('#html-export-confirm').click();
  const html = await readFile(await (await download).path(), 'utf8');
  expect(html).toContain("default-src 'none'");
  const exported = await page.context().newPage();
  await exported.setContent(html);
  await expect(exported.locator('img[data-private-diagram]')).toHaveCount(13);
  await expect.poll(() => exported.locator('img[data-private-diagram]').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
  await exported.close();
});

for (const headerless of [false, true]) test('renderer input cannot fetch external data or images' + (headerless ? ' on a plain static host' : ''), async ({ page, baseURL }) => {
  const requests = [];
  if (headerless) await page.context().route('**/assets/private-renderers/**', withoutSecurityHeaders);
  await page.context().route('https://private-resource.invalid/**', route => { requests.push(route.request().url()); return route.abort(); });
  const content = '```markmap\n# Private\n## ![pixel](https://private-resource.invalid/map)\n```\n' +
    '```vega-lite\n{"data":{"url":"https://private-resource.invalid/chart"},"mark":"bar","encoding":{"x":{"field":"a"}}}\n```\n' +
    '```d2\na: {icon: https://private-resource.invalid/icon.svg}\n```\n';
  const key = C.random(), encrypted = await C.seal({ content, title: 'Blocked resources', mode: 'edit' }, key, 'snapshot');
  await openApp(page, baseURL + '/#share=v2.' + C.pack(encrypted) + '&key=' + key, { mockMathJax: false });
  await expect(page.locator('#markdown-preview .is-loading')).toHaveCount(0, { timeout: 120000 });
  await expect(page.locator('#markdown-preview')).toContainText('Use inline chart data');
  expect(requests).toEqual([]);
});

for (const access of ['edit', 'view']) test('real encrypted live ' + access + ' participants render diagrams and receive subsequent changes', async ({ page, browser, baseURL }) => {
  const runtime = await (await import('../helpers/encrypted-sharing-runtime.mjs')).sharingRuntime();
  const liveBase = (await runtime.ready).origin + '/live-room';
  const guestContext = await browser.newContext();
  try {
    await page.context().addInitScript(base => window.MARKDOWN_VIEWER_LIVE_ROOM_URL = base, liveBase);
    await guestContext.addInitScript(base => window.MARKDOWN_VIEWER_LIVE_ROOM_URL = base, liveBase);
    await openApp(page, baseURL, { mockMathJax: false });
    // Start first so the private preview path owns every render of this fixture.
    await setEditorContent(page, '# Local live render fixture');
    await page.locator('#live-share-button').click();
    await page.locator('input[name="live-share-access-mode"][value="' + access + '"]').check();
    await page.locator('#live-share-start-btn').click();
    await expect(page.locator('#live-share-url-input')).toHaveValue(/#l=/);
    const invite = await page.locator('#live-share-url-input').inputValue();
    await page.locator('#live-share-modal-close-icon').click();
    const guest = await guestContext.newPage();
    await openApp(guest, baseURL + '/' + new URL(invite).hash, { mockMathJax: false });
    // App readiness precedes the asynchronous invitation lookup/handshake.
    // Establish the guest first before starting CPU-heavy renderer work.
    await expect(guest.locator('#markdown-editor')).toHaveValue('# Local live render fixture', { timeout: 30000 });
    const content = await fixture();
    await page.bringToFront();
    await setEditorContent(page, content);
    await expect(guest.locator('#markdown-editor')).toHaveValue(content);
    await page.bringToFront();
    await assertRendered(page);
    await guest.bringToFront();
    await assertRendered(guest);
    await setEditorContent(page, content.replace('Start --> End', 'Start --> Updated'));
    await expect(guest.locator('#markdown-editor')).toHaveValue(/Start --> Updated/);
    await expect.poll(async () => {
      const url = await guest.locator('img[data-private-diagram="mermaid"]').getAttribute('src');
      return decodeURIComponent(url || '');
    }).toContain('Updated');
    await page.locator('#live-share-button').click();
    await page.locator('#live-share-end-btn').click();
    await expect(guest.locator('#live-share-button')).toHaveAttribute('aria-pressed', 'false');
  } finally { await guestContext.close(); await runtime.dispose(); }
});

test('private math loads TeX extensions and font chunks from the trimmed local bundle', async ({ page, baseURL }) => {
  const key = C.random();
  const content = String.raw`$$\require{cancel}\cancel{x} + \mathbb{R}$$`;
  const encrypted = await C.seal({ content, title: 'Local math extensions', mode: 'edit' }, key, 'snapshot');
  const missing = [];
  page.on('response', response => { if (response.url().includes('/assets/private-renderers/') && response.status() >= 400) missing.push(response.status()); });
  await openApp(page, baseURL + '/' + C.compactSnapshot(encrypted, key), { mockMathJax: false });
  const image = page.locator('#markdown-preview img[data-private-diagram="math"]');
  await expect(image).toHaveCount(1, { timeout: 45000 });
  await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(missing).toEqual([]);
  await expect(page.locator('#markdown-preview .render-error-msg')).toHaveCount(0);
});
