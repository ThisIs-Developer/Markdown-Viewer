const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent } = require('../helpers/app');
test.describe.configure({ timeout: 180_000 });
let runtime, liveBase;
test.beforeAll(async () => {
  test.setTimeout(120000);
  runtime = await (await import('../helpers/encrypted-sharing-runtime.mjs')).sharingRuntime();
  liveBase = (await runtime.ready).origin + '/live-room';
});
test.afterAll(async () => { await runtime?.dispose(); });

async function localServices(context) {
  await context.addInitScript(base => { window.MARKDOWN_VIEWER_LIVE_ROOM_URL = base; }, liveBase);
  await context.route('https://markdownviewer.pages.dev/api/**', async route => {
    const request = route.request();
    const response = await runtime.dispatchFetch(request.url(), {
      method: request.method(), headers: { Origin: 'http://127.0.0.1:4173',
        'Content-Type': 'application/json' },
      ...(request.postData() ? { body: request.postData() } : {})
    });
    await route.fulfill({ status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()) });
  });
}

const sample = [
  '# Private rendering fixture',
  '',
  'Inline math: $x^2+y^2=z^2$.',
  '',
  '```mermaid', 'flowchart LR', '  Alice --> Bob', '```',
  '',
  '```plantuml', '@startuml', 'Alice -> Bob: Confidential', '@enduml', '```',
  '',
  '```d2', 'Alice -> Bob', '```',
  '',
  '```graphviz', 'digraph G { Alice -> Bob; }', '```',
  '',
  '```vega-lite',
  '{"data":{"values":[{"name":"Alice","qty":3}]},"mark":"bar","encoding":{"x":{"field":"name","type":"nominal"},"y":{"field":"qty","type":"quantitative"}}}',
  '```',
  '',
  '```wavedrom', '{"signal":[{"name":"clk","wave":"p.."}]}', '```',
  '',
  '```markmap', '# Root', '## Branch', '```',
  '',
  '```geojson',
  '{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[88.36,22.57]},"properties":{"name":"Private"}}]}',
  '```',
  '',
  '```topojson',
  '{"type":"Topology","objects":{"points":{"type":"GeometryCollection","geometries":[{"type":"Point","coordinates":[88.36,22.57]}]}},"arcs":[]}',
  '```',
  '',
  '```stl',
  'solid triangle', 'facet normal 0 0 1', 'outer loop',
  'vertex 0 0 0', 'vertex 1 0 0', 'vertex 0 1 0',
  'endloop', 'endfacet', 'endsolid triangle', '```',
  '',
  '```abc', 'X:1', 'K:C', 'CDEF|', '```'
].join('\n');

test('V2 snapshot recipient renders local diagrams and LaTeX from ciphertext', async ({ page, browser, baseURL }) => {
  test.setTimeout(180000);
  await localServices(page.context());
  await openApp(page);
  await setEditorContent(page, sample);
  await page.locator('#share-button').click();
  await page.locator('#share-generate-btn').click();
  await expect(page.locator('#share-url-input')).toHaveValue(/\/v2\/#s=/);
  const share = await page.locator('#share-url-input').inputValue();

  const guestContext = await browser.newContext();
  await localServices(guestContext);
  const guest = await guestContext.newPage();
  const external = [];
  const thirdParty = [];
  const errors = [];
  guest.on('request', req => {
    if (/kroki\.io|plantuml\.com|mermaid\.ink|quickchart\.io/i.test(req.url())) external.push(req.url());
    const requestUrl = new URL(req.url());
    // The test's mock storage endpoint intentionally uses the production
    // same-origin ciphertext API; it is not a third-party renderer request.
    const mockEncryptedStorage = requestUrl.origin === 'https://markdownviewer.pages.dev' &&
      /^\/api\/share\/s2_[A-Za-z0-9_-]+$/.test(requestUrl.pathname);
    if (/^https?:$/.test(requestUrl.protocol) &&
        requestUrl.origin !== new URL(baseURL).origin && !mockEncryptedStorage) {
      thirdParty.push(req.url());
    }
  });
  guest.on('pageerror', error => errors.push(String(error)));
  await openApp(guest, baseURL + new URL(share).pathname + new URL(share).hash, { expectEditorVisible: false });
  await expect(guest.locator('#markdown-editor')).toHaveValue(sample);

  const selectorGroups = [
    ['mermaid', '.mermaid svg'],
    ['plantuml', '.plantuml-diagram svg'],
    ['d2', '[data-diagram-engine="d2"] svg'],
    ['graphviz', '.graphviz-diagram svg'],
    ['vegalite', '[data-diagram-engine="vegalite"] svg'],
    ['wavedrom', '[data-diagram-engine="wavedrom"] svg'],
    ['markmap', '[data-diagram-engine="markmap"] svg'],
    ['math', '.mjx-container, mjx-container'],
    ['abc', '.abcjs-diagram svg, .abcjs-container svg'],
    ['geojson', '.geojson-map .leaflet-marker-icon'],
    ['topojson', '.topojson-map .leaflet-marker-icon'],
    ['stl', '.stl-viewer canvas, .stl-viewer svg']
  ];
  const found = [];
  for (const [name,selector] of selectorGroups) {
    const count = await guest.locator(selector).count();
    found.push({ name,selector,count });
  }
  console.log('PRIVATE_RECIPIENT_RENDER_BEFORE',JSON.stringify(found));
  for (const [name, selector] of selectorGroups) {
    await expect(guest.locator(selector).first(), name).toBeVisible({timeout:30000});
  }
  expect(thirdParty).toEqual([]);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
  await guestContext.close();
});

test('V2 Live Share recipient renders private diagrams, and rerenders host edits', async ({ page, browser, baseURL }) => {
  test.setTimeout(180000);
  await localServices(page.context());
  await openApp(page);
  await setEditorContent(page, sample);
  await page.locator('#live-share-button').click();
  await page.locator('input[name="live-share-access-mode"][value="edit"]').check();
  await page.locator('#live-share-start-btn').click();
  await expect(page.locator('#live-share-url-input')).toHaveValue(/\/v2\/#l=/);
  const invite = await page.locator('#live-share-url-input').inputValue();
  await page.locator('#live-share-modal-close-icon').click();
  const guestContext = await browser.newContext();
  await localServices(guestContext);
  const guest = await guestContext.newPage();
  const offsite = [];
  guest.on('request', r => { if (/kroki\.io|plantuml\.com|mermaid\.ink/.test(r.url())) offsite.push(r.url()); });
  await openApp(guest, baseURL + new URL(invite).pathname + new URL(invite).hash);
  await expect(guest.locator('#markdown-editor')).toHaveValue(sample);
  await expect(guest.locator('.mermaid svg').first()).toBeVisible({ timeout:30000 });
  await expect(guest.locator('.plantuml-diagram svg').first()).toBeVisible({ timeout:30000 });
  await expect(guest.locator('[data-diagram-engine="d2"] svg').first()).toBeVisible({ timeout:30000 });
  await expect(guest.locator('mjx-container').first()).toBeVisible({ timeout:30000 });
  await setEditorContent(page, sample.replace('Alice -> Bob', 'Charlie -> Delta'));
  await expect(guest.locator('#markdown-editor')).toHaveValue(/Charlie -> Delta/, { timeout:30000 });
  await expect(guest.locator('.plantuml-diagram svg').first()).toBeVisible({ timeout:30000 });
  expect(offsite).toEqual([]);
  await guestContext.close();
});
