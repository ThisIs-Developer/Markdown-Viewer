const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent, storedDocuments } = require('../helpers/app');

function markdown(label, count = 250) {
  return `# ${label}\n\n` + Array.from({ length: count }, (_, i) =>
    `## ${label} section ${i}\n\nA paragraph with enough text to exercise deferred Preview rendering and document scroll restoration.`
  ).join('\n\n');
}

async function settled(page, label) {
  await expect(page.locator('#markdown-preview')).toHaveAttribute('data-render-state', 'ready');
  await expect(page.locator('#markdown-preview h1')).toHaveText(label);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function createDocument(page, label, count, mode = 'preview') {
  await page.locator('#tab-new-btn').click();
  await setEditorContent(page, markdown(label, count));
  await page.locator(`.view-toolbar [data-view-mode="${mode}"]`).click();
  await settled(page, label);
  return page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
}

async function activate(page, id, label) {
  await page.locator(`#tab-list .tab-item[data-tab-id="${id}"]`).click();
  await settled(page, label);
}

async function scrollTo(page, top) {
  await page.locator('.preview-pane').evaluate((pane, value) => { pane.scrollTop = value; }, top);
  await expectPosition(page, top);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function expectPosition(page, top) {
  await expect.poll(() => page.locator('.preview-pane').evaluate(pane => pane.scrollTop)).toBeCloseTo(top, 0);
}

test.beforeEach(async ({ page }) => { await openApp(page); });

for (const sync of [true, false]) {
  test(`large Preview documents retain positions across loading placeholders (sync ${sync})`, async ({ page }) => {
    if (!sync) await page.locator('#toggle-sync').click();
    const a = await createDocument(page, 'Large A', 250);
    await scrollTo(page, 4200);
    const b = await createDocument(page, 'Large B', 350);
    await scrollTo(page, 7600);
    for (let i = 0; i < 3; i++) {
      await activate(page, a, 'Large A');
      await expectPosition(page, 4200);
      await activate(page, b, 'Large B');
      await expectPosition(page, 7600);
    }
  });
}

test('Preview positions survive visiting a document in Edit mode', async ({ page }) => {
  const a = await createDocument(page, 'Preview A', 60);
  await scrollTo(page, 2400);
  const b = await createDocument(page, 'Edit B', 80, 'editor');
  await activate(page, a, 'Preview A');
  await expectPosition(page, 2400);
  await activate(page, b, 'Edit B');
  await activate(page, a, 'Preview A');
  await expectPosition(page, 2400);
});

test('Edit and Preview keep independent positions when a pane is hidden during a tab switch', async ({ page }) => {
  const a = await createDocument(page, 'Both panes A', 70, 'editor');
  await page.locator('#markdown-editor').evaluate(editor => { editor.scrollTop = 1600; });
  await page.locator('.view-toolbar [data-view-mode="preview"]').click();
  await settled(page, 'Both panes A');
  await scrollTo(page, 3200);
  await createDocument(page, 'Both panes B', 80);
  await activate(page, a, 'Both panes A');
  await expectPosition(page, 3200);
  await page.locator('.view-toolbar [data-view-mode="editor"]').click();
  await expect.poll(() => page.locator('#markdown-editor').evaluate(editor => editor.scrollTop)).toBe(1600);
});

test('Split scrolling still synchronizes after document restoration', async ({ page }) => {
  const a = await createDocument(page, 'Sync A', 70);
  await createDocument(page, 'Sync B', 100);
  await activate(page, a, 'Sync A');
  await page.locator('.view-toolbar [data-view-mode="split"]').click();
  await page.locator('#markdown-editor').evaluate(editor => { editor.scrollTop = (editor.scrollHeight - editor.clientHeight) * 0.6; });
  await expect.poll(() => page.locator('.preview-pane').evaluate(pane => pane.scrollTop / (pane.scrollHeight - pane.clientHeight))).toBeCloseTo(0.6, 2);
  await page.locator('.preview-pane').hover();
  await page.mouse.wheel(0, -800);
  await expect.poll(() => page.evaluate(() => {
    const editor = document.querySelector('#markdown-editor');
    const preview = document.querySelector('.preview-pane');
    return Math.abs(editor.scrollTop / (editor.scrollHeight - editor.clientHeight) - preview.scrollTop / (preview.scrollHeight - preview.clientHeight));
  })).toBeLessThan(0.01);
});

test('a small document keeps its position when the other tab shows a loading placeholder', async ({ page }) => {
  const a = await createDocument(page, 'Small A', 50);
  const b = await createDocument(page, 'Large B', 250);
  await activate(page, a, 'Small A');
  await scrollTo(page, 1800);
  await activate(page, b, 'Large B');
  await scrollTo(page, 6200);
  await activate(page, a, 'Small A');
  await expectPosition(page, 1800);
  await activate(page, b, 'Large B');
  await expectPosition(page, 6200);
});

test('a forced loading placeholder preserves the current document position', async ({ page }) => {
  await createDocument(page, 'Forced refresh', 250);
  await scrollTo(page, 4200);
  await page.evaluate(() => window.renderMarkdown({ force: true, showSkeleton: true }));
  await settled(page, 'Forced refresh');
  await expectPosition(page, 4200);
});

test('switching away between DOM commit and scroll restoration cannot save another tab position', async ({ page }) => {
  const a = await createDocument(page, 'Frame A', 50);
  const b = await createDocument(page, 'Frame B', 70);
  await scrollTo(page, 3800);
  await activate(page, a, 'Frame A');
  await scrollTo(page, 1200);
  await page.evaluate(({ a, b }) => {
    const preview = document.querySelector('#markdown-preview');
    const observer = new MutationObserver(() => {
      if (preview.dataset.renderState !== 'ready' || preview.querySelector('h1')?.textContent !== 'Frame B') return;
      observer.disconnect();
      document.querySelector(`[data-tab-id="${a}"]`).click();
    });
    observer.observe(preview, { attributes: true, childList: true });
    document.querySelector(`[data-tab-id="${b}"]`).click();
  }, { a, b });
  await settled(page, 'Frame A');
  await expectPosition(page, 1200);
  await activate(page, b, 'Frame B');
  await expectPosition(page, 3800);
});

test('scroll positions survive hidden renders and workspace reload', async ({ page }) => {
  const a = await createDocument(page, 'Reload A', 250);
  const b = await createDocument(page, 'Reload B', 60);
  await scrollTo(page, 2600);
  await page.locator('.view-toolbar [data-view-mode="editor"]').click();
  await page.evaluate(() => window.renderMarkdown({ force: true }));
  await settled(page, 'Reload B');
  await page.locator('.view-toolbar [data-view-mode="preview"]').click();
  await expectPosition(page, 2600);
  await activate(page, a, 'Reload A');
  await scrollTo(page, 5600);
  await activate(page, b, 'Reload B');
  await expect.poll(async () => (await storedDocuments(page)).find(doc => doc.id === a)?.previewScrollPos).toBe(5600);
  await page.reload();
  await settled(page, 'Reload B');
  await expectPosition(page, 2600);
  await activate(page, a, 'Reload A');
  await expectPosition(page, 5600);
});

test('shortened content clamps its own position without changing another document', async ({ page }) => {
  const a = await createDocument(page, 'Shortened A', 100);
  const b = await createDocument(page, 'Unchanged B', 80);
  await scrollTo(page, 3400);
  await activate(page, a, 'Shortened A');
  await scrollTo(page, 4200);
  await setEditorContent(page, '# Shortened A\n\nNow a short document.');
  await settled(page, 'Shortened A');
  await expectPosition(page, 0);
  await activate(page, b, 'Unchanged B');
  await expectPosition(page, 3400);
});

for (const worker of [true, false]) {
  test(`large documents preserve positions with the worker ${worker ? 'enabled' : 'unavailable'}`, async ({ page }) => {
    if (worker) {
      // Worker importScripts requests do not use the page-scoped asset routes.
      for (const [url, file] of [
        ['https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js', 'marked/marked.min.js'],
        ['https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js', '@highlightjs/cdn-assets/highlight.min.js'],
        ['https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/powershell.min.js', '@highlightjs/cdn-assets/languages/powershell.min.js']
      ]) {
        await page.context().route(url, route => route.fulfill({ path: require.resolve(file), contentType: 'application/javascript' }));
      }
    } else {
      await page.evaluate(() => { window.Worker = undefined; });
    }
    const a = await createDocument(page, 'Worker A', 500);
    if (worker) await expect(page.locator('#markdown-preview .preview-render-block')).not.toHaveCount(0);
    const b = await createDocument(page, 'Worker B', 600);
    const positionB = await page.locator('.preview-pane').evaluate(async pane => {
      pane.scrollTop = 9600;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return pane.scrollTop;
    });
    await activate(page, a, 'Worker A');
    const positionA = await page.locator('.preview-pane').evaluate(async pane => {
      pane.scrollTop = 4400;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return pane.scrollTop;
    });
    await activate(page, b, 'Worker B');
    await expectPosition(page, positionB);
    await activate(page, a, 'Worker A');
    await expectPosition(page, positionA);
  });
}

for (const outcome of ['loaded', 'failed', 'user scroll', 'tab switch']) {
  test(`delayed image restoration respects ${outcome}`, async ({ page }) => {
    let imageRequest;
    let delayImage = false;
    await page.route('**/scroll-image.svg', async route => {
      if (delayImage) {
        await new Promise(resolve => { imageRequest = resolve; });
        if (outcome === 'failed') return route.abort();
      }
      await route.fulfill({ headers: { 'cache-control': 'no-store' }, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="6000"><rect width="600" height="6000" fill="blue"/></svg>' });
    });
    const a = await createDocument(page, 'Image A', 2);
    await setEditorContent(page, '# Image A\n\n![Tall image](/scroll-image.svg)\n\nEnd.');
    await expect.poll(() => page.locator('#markdown-preview img').evaluate(image => image.naturalHeight)).toBe(6000);
    await settled(page, 'Image A');
    await scrollTo(page, 4000);
    const b = await createDocument(page, 'Image B', 80);
    await scrollTo(page, 2200);
    await activate(page, a, 'Image A');
    delayImage = true;
    // The deferred image can block page load until imageRequest() below.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settled(page, 'Image A');
    await expect.poll(() => Boolean(imageRequest)).toBe(true);
    if (outcome === 'user scroll') {
      await page.locator('.preview-pane').hover();
      await page.mouse.wheel(0, -500);
    }
    if (outcome === 'tab switch') await activate(page, b, 'Image B');
    imageRequest();
    if (outcome === 'tab switch') {
      await expectPosition(page, 2200);
      return;
    }
    await expect.poll(() => page.locator('#markdown-preview img').evaluate(image => image.complete)).toBe(true);
    await expectPosition(page, outcome === 'loaded' ? 4000 : 0);
    await activate(page, b, 'Image B');
    await expectPosition(page, 2200);
  });
}
