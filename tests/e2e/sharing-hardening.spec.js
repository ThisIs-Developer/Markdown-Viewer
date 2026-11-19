const { test, expect } = require('@playwright/test');
const { readFile } = require('node:fs/promises');
const { openApp, setEditorContent, storedDocuments } = require('../helpers/app');
const C = require('../../sharing-crypto');
test.describe.configure({ timeout: 120000 });

test('private SVG blocks external paint, escaped URLs and CSS while keeping local gradients', async ({ page, baseURL }) => {
  const requested = [];
  const remoteLibraries = [];
  page.on('request', request => { if (/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/.test(request.url())) remoteLibraries.push(request.url()); });
  await page.route('https://private-resource.invalid/**', route => { requested.push(route.request().url()); return route.abort(); });
  const content = '# Private SVG\n\n<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><defs><linearGradient id="local"><stop offset="0" stop-color="red"/></linearGradient></defs><rect id="unsafe-fill" width="100" height="100" fill="url(https://private-resource.invalid/fill.svg#p)" stroke="url(//private-resource.invalid/stroke.svg#p)"/><rect id="local-fill" width="50" height="50" fill="url(#local)"/><rect id="escaped-fill" fill="u\\72l(https://private-resource.invalid/escaped.svg#p)"/><rect id="css-fill" style="fill:url(https://private-resource.invalid/style.svg#p)"/></svg>';
  const key = C.random(), encrypted = await C.seal({ content, title: 'SVG', mode: 'edit' }, key, 'snapshot');
  await openApp(page, baseURL + '/#share=v2.' + C.pack(encrypted) + '&key=' + key, { mockMathJax: false });
  const preview = page.locator('#markdown-preview');
  await expect(preview.locator('#unsafe-fill')).toBeAttached();
  await expect(preview.locator('#unsafe-fill')).not.toHaveAttribute('fill');
  await expect(preview.locator('#unsafe-fill')).not.toHaveAttribute('stroke');
  await expect(preview.locator('#escaped-fill')).not.toHaveAttribute('fill');
  await expect(preview.locator('#css-fill')).not.toHaveAttribute('style');
  await expect(preview.locator('#local-fill')).toHaveAttribute('fill', 'url(#local)');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(requested).toEqual([]);
  expect(remoteLibraries).toEqual([]);
});

test('recovery exports an opaque file and restores independently without network storage or overwrites', async ({ page, browser, baseURL }) => {
  const apiRequests = [];
  page.on('request', request => { if (request.url().includes('/api/')) apiRequests.push(request.url()); });
  await openApp(page);
  const content = '# Recover independently\n\nहिन्दी 😀\n\n![local](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=)';
  await setEditorContent(page, content);
  await page.locator('#exportDropdown').click(); await page.locator('#export-recovery').click();
  await expect(page.locator('#recovery-key')).toHaveValue(/^[A-Za-z0-9_-]{43}$/);
  const key = await page.locator('#recovery-key').inputValue();
  await expect(page.locator('#recovery-action')).toBeDisabled();
  await page.locator('#recovery-key-saved').check();
  const downloadPromise = page.waitForEvent('download'); await page.locator('#recovery-action').click();
  const file = await readFile(await (await downloadPromise).path());
  expect(file.toString()).not.toContain('Recover independently'); expect(file.toString()).not.toContain(key);
  const context = await browser.newContext(); const fresh = await context.newPage();
  fresh.on('request', request => { if (request.url().includes('/api/')) apiRequests.push(request.url()); });
  try {
    await openApp(fresh, baseURL);
    await setEditorContent(fresh, '# Preserve this original');
    await fresh.locator('#importDropdown').click(); await fresh.locator('#import-recovery').click();
    await fresh.locator('#recovery-file').setInputFiles({ name: 'document.mvrecovery', mimeType: 'application/json', buffer: file });
    await fresh.locator('#recovery-key').fill(C.random()); await fresh.locator('#recovery-action').click();
    await expect(fresh.locator('#recovery-status')).toContainText('Unable to restore');
    await expect(fresh.locator('#markdown-editor')).toHaveValue('# Preserve this original');
    await fresh.locator('#recovery-key').fill(key); await fresh.locator('#recovery-action').click();
    await expect(fresh.locator('#sharing-recovery-modal')).toHaveCount(0);
    await expect(fresh.locator('#markdown-editor')).toHaveValue(content);
    const saved = await storedDocuments(fresh);
    expect(saved.some(item => item.content === '# Preserve this original')).toBe(true);
    expect(saved.some(item => item.content === content && item.isOpen)).toBe(true);
    await fresh.reload(); await expect(fresh.locator('#markdown-editor')).toHaveValue(content);
    expect(apiRequests).toEqual([]);
  } finally { await context.close(); }
});

test('portable recovery embeds relative and HTML-decoded managed attachments', async ({ page }) => {
  await openApp(page);
  const key = C.random(), id = 'e2_' + C.random(18);
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=';
  const encrypted = await C.seal({ dataUrl: png }, key, 'media', C.MEDIA_LIMIT);
  let reads = 0;
  await page.route('https://markdownviewer.pages.dev/api/image/' + id, async route => {
    reads += 1; await route.fulfill({ json: { encrypted, expiresAt: Date.now() + 60000 } });
  });
  const content = '![](/api/image/' + id + '#key=' + key + ')\n<img src="//markdownviewer.pages.dev/api/image/' + id + '&#35;key=' + key + '">';
  const portable = await page.evaluate(async source => {
    const content = await MarkdownShareMedia.inlineMarkdown(source, 'https://markdownviewer.pages.dev', MarkdownShareCrypto.SNAPSHOT_LIMIT);
    const result = await MarkdownShareRecovery.create({ content, title: 'Portable', reviewThreads: [], createdAt: Date.now() });
    return (await MarkdownShareRecovery.restore(result.file, result.key)).content;
  }, content);
  expect(portable).toBe('![](' + png + ')\n<img src="' + png + '">');
  expect(reads).toBe(1);
});

test('browser Web Crypto backs up a maximum supported managed video without plaintext in recovery file', async ({ page }) => {
  await openApp(page);
  const result = await page.evaluate(async () => {
    const bytes = new Uint8Array(10 * 1024 * 1024);
    bytes.set([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]);
    bytes.fill(0x5a, 12);
    let raw = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      raw += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    const dataUrl = 'data:video/mp4;base64,' + btoa(raw);
    const media = MarkdownShareMedia.validateDataUrl(dataUrl);
    const value = { content: '# Private video\n<video controls src="' + dataUrl + '"></video>',
      title: 'Recovery video test', reviewThreads: [{ text: 'Private review' }], createdAt: Date.now() };
    const { file, key } = await MarkdownShareRecovery.create(value);
    const restored = await MarkdownShareRecovery.restore(file, key);
    return { mediaBytes: media.bytes.length, matches: restored.content === value.content &&
      restored.title === value.title && restored.reviewThreads[0].text === 'Private review',
      opaque: !file.includes('video/mp4') && !file.includes('Private review'),
      exceededSnapshotLimit: value.content.length > MarkdownShareCrypto.SNAPSHOT_LIMIT };
  });
  expect(result).toEqual({ mediaBytes: 10 * 1024 * 1024, matches: true, opaque: true, exceededSnapshotLimit: true });
});
