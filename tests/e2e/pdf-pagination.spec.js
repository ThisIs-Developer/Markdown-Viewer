const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const { openApp, setEditorContent, stubExportLibraries } = require('../helpers/app');

test.beforeEach(async ({ page }) => {
  await stubExportLibraries(page);
  await openApp(page);
});

async function readPdf(data) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return getDocument({ data: new Uint8Array(data), useSystemFonts: true }).promise;
}

async function exportRaster(page, markdown, theme = 'light') {
  await setEditorContent(page, markdown);
  await page.route('**/test-html2canvas.js', route => route.fulfill({ path: require.resolve('html2canvas/dist/html2canvas.min.js'), contentType: 'text/javascript' }));
  await page.route('**/test-jspdf.js', route => route.fulfill({ path: require.resolve('jspdf/dist/jspdf.umd.min.js'), contentType: 'text/javascript' }));
  await page.addScriptTag({ url: '/test-html2canvas.js' });
  await page.addScriptTag({ url: '/test-jspdf.js' });
  await page.evaluate(() => {
    const capture = window.html2canvas;
    window.__captures = [];
    window.__slices = [];
    window.__placements = [];
    window.__pdfBytes = null;
    window.__pdfError = null;
    window.alert = message => { window.__pdfError = message; };
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (...args) {
      const source = args[0].__pdfSource;
      if (source && args.length === 9) window.__slices.push({
        y: source.y + args[2] / source.scale, height: args[4] / source.scale,
        width: args[3] / source.scale, rootWidth: source.rootWidth, rects: source.rects
      });
      return drawImage.apply(this, args);
    };
    window.html2canvas = async (root, options) => {
      const origin = root.getBoundingClientRect();
      const rects = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (!node.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) if (rect.width && rect.height) rects.push({ top: rect.top - origin.top, bottom: rect.bottom - origin.top });
      }
      const canvas = await capture(root, options);
      canvas.__pdfSource = { y: options.y, scale: options.scale, rootWidth: origin.width, rects };
      window.__captures.push({ y: options.y, height: options.height, width: options.width, rootWidth: origin.width,
        canvasWidth: canvas.width, canvasHeight: canvas.height, rects,
        clipped: Array.from(root.querySelectorAll('[style]')).filter(node => node.style.transform && node.style.overflow === 'hidden').length });
      return canvas;
    };
    const Pdf = window.jspdf.jsPDF;
    window.jspdf.jsPDF = function (...args) {
      const pdf = new Pdf(...args);
      const addImage = pdf.addImage;
      pdf.addImage = function (...args) {
        window.__placements.push({ x: args[2], y: args[3], width: args[4], height: args[5] });
        return addImage.apply(this, args);
      };
      pdf.save = () => { window.__pdfBytes = pdf.output('datauristring').split(',')[1]; };
      return pdf;
    };
  });
  await page.locator('#export-pdf').dispatchEvent('click');
  await page.locator('#pdf-export-card-raster').click();
  await page.locator(`#pdf-export-theme-card-${theme}`).click();
  await page.locator('#pdf-export-confirm').click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__pdfBytes || window.__pdfError)), { timeout: 60_000 }).toBe(true);
  expect(await page.evaluate(() => window.__pdfError)).toBe(null);
  const result = await page.evaluate(() => ({ base64: window.__pdfBytes, captures: window.__captures, slices: window.__slices, placements: window.__placements }));
  return { ...result, bytes: Buffer.from(result.base64, 'base64') };
}

for (const kind of ['paragraph', 'code', 'quote', 'table', 'tall-table-row']) {
  test(`raster PDF keeps every line of a multi-page ${kind} intact`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const lines = Array.from({ length: 180 }, (_, i) => `LINE${String(i).padStart(3, '0')} The quick brown fox jumps over the lazy dog.`);
    const markdown = kind === 'paragraph' ? lines.join('<br>\n') : kind === 'code' ? '```text\n' + lines.join('\n') + '\n```'
      : kind === 'quote' ? lines.map(line => '> ' + line + '<br>').join('\n')
        : kind === 'table' ? '| Key | Value |\n|---|---|\n' + lines.map(line => '| ' + line + ' | cell |').join('\n')
          : '<table><thead><tr><th>Long cell</th></tr></thead><tbody><tr><td>' + lines.join('<br>') + '</td></tr></tbody></table>';
    const result = await exportRaster(page, markdown);
    const pages = result.slices.filter(capture => Math.abs(capture.width - capture.rootWidth) < 0.1 && capture.height > 100);
    expect(pages.length).toBeGreaterThan(2);
    expect(result.captures.every(capture => capture.clipped === 0)).toBe(true);
    expect(result.captures.every(capture => capture.canvasWidth * capture.canvasHeight <= 16_000_000)).toBe(true);
    for (const item of result.placements) {
      expect(item.x).toBeGreaterThanOrEqual(14.99);
      expect(item.y).toBeGreaterThanOrEqual(14.99);
      expect(item.x + item.width).toBeLessThanOrEqual(195.01);
      expect(item.y + item.height).toBeLessThanOrEqual(282.01);
    }
    for (let i = 0; i < pages.length; i++) {
      if (i) expect(pages[i].y).toBeCloseTo(pages[i - 1].y + pages[i - 1].height, 5);
      const end = pages[i].y + pages[i].height;
      expect(pages[i].rects.filter(rect => rect.top < end - 0.01 && rect.bottom > end + 0.01)).toEqual([]);
    }
    const last = pages.at(-1);
    expect(last.y + last.height).toBeGreaterThanOrEqual(Math.max(...last.rects.map(rect => rect.bottom)));
    if (kind.includes('table')) expect(result.slices.some(capture => capture.height < 100)).toBe(true);
    const pdf = await readPdf(result.bytes);
    expect(pdf.numPages).toBe(pages.length);
    expect((await (await pdf.getPage(1)).getTextContent()).items).toHaveLength(0);
    await pdf.destroy();
    await fs.writeFile(testInfo.outputPath(`${kind}.pdf`), Buffer.from(result.bytes));
    await expect(page.locator('.export-render-root, .pdf-progress-overlay')).toHaveCount(0);
  });
}

for (const theme of ['light', 'dark']) {
  test(`Browser Print produces selectable complete text in ${theme} PDF pages`, async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium', 'Playwright PDF generation is Chromium-only.');
    const lines = Array.from({ length: 180 }, (_, i) => `MARKER${String(i).padStart(3, '0')} Selectable café Ελληνικά **bold** text.<br>`);
    await setEditorContent(page, '# Selectable PDF\n\n' + lines.join('\n'));
    await page.evaluate(() => { window.print = () => { window.__printReady = true; }; });
    await page.locator('#export-pdf').dispatchEvent('click');
    await expect(page.locator('#pdf-export-mode-vector')).toBeChecked();
    await page.locator(`#pdf-export-theme-card-${theme}`).click();
    await page.locator('#pdf-export-confirm').click();
    await expect.poll(() => page.evaluate(() => window.__printReady)).toBe(true);
    const bytes = await page.pdf({ format: 'A4', printBackground: true, path: testInfo.outputPath(`${theme}.pdf`) });
    const pdf = await readPdf(bytes);
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const content = await (await pdf.getPage(i)).getTextContent();
      text += content.items.map(item => item.str || '').join(' ') + '\n';
    }
    const markers = text.match(/MARKER\d{3}/g);
    expect(markers).toEqual(Array.from({ length: 180 }, (_, i) => `MARKER${String(i).padStart(3, '0')}`));
    expect(text).toContain('café');
    expect(text).toContain('Ελληνικά');
    await pdf.destroy();
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await expect(page.locator('.browser-print-export-snapshot')).toHaveCount(0);
  });
}

test('dark raster export preserves mixed line heights, nested lists and an oversized image', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 40; canvas.height = 320;
    const context = canvas.getContext('2d');
    context.fillStyle = '#b20000'; context.fillRect(0, 0, 40, 160);
    context.fillStyle = '#00b200'; context.fillRect(0, 160, 40, 160);
    return canvas.toDataURL();
  });
  const paragraphs = Array.from({ length: 65 }, (_, i) => `Line ${i} <strong style="font-size:26px">large</strong> <small>small</small> and <sup>superscript</sup>.<br>`).join('\n');
  const result = await exportRaster(page, `<img src="${image}" style="width:400px;height:3200px" alt="Tall image">\n\n` +
    '<div style="font-size:17px;line-height:1.7">' + paragraphs + '</div>\n\n1. Outer\n   1. Nested **bold**\n   2. Nested end\n\nFinal content.', 'dark');
  const pages = result.slices.filter(item => Math.abs(item.width - item.rootWidth) < 0.1);
  for (const item of pages) {
    const end = item.y + item.height;
    expect(item.rects.filter(rect => rect.top < end - 0.01 && rect.bottom > end + 0.01)).toEqual([]);
  }
  expect(result.placements.some(item => item.width < 180 && item.height > 260)).toBe(true);
  const pdf = await readPdf(result.bytes);
  expect(pdf.numPages).toBeGreaterThan(2);
  await pdf.destroy();
  await fs.writeFile(testInfo.outputPath('mixed-dark.pdf'), result.bytes);
});

test('Browser Print preparation can be cancelled and retried without duplicate snapshots', async ({ page }) => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/slow-export.png', async route => { await pending; await route.abort(); });
  await setEditorContent(page, '# Pending image\n\n![Wait](/slow-export.png)');
  await page.locator('#markdown-editor').focus();
  await page.locator('#export-pdf').dispatchEvent('click');
  await page.locator('#pdf-export-confirm').click();
  await expect(page.locator('.pdf-progress-overlay')).toBeVisible();
  await page.locator('#pdf-export-confirm').dispatchEvent('click');
  await expect(page.locator('.export-render-root')).toHaveCount(1);
  await page.locator('.pdf-progress-cancel').click();
  await expect(page.locator('.export-render-root, .pdf-progress-overlay')).toHaveCount(0);
  await expect(page.locator('#markdown-editor')).toBeFocused();
  expect(await page.evaluate(() => window.__printCalled)).toBe(0);
  release();
  await setEditorContent(page, '# Retry succeeds');
  await page.locator('#export-pdf').dispatchEvent('click');
  await page.locator('#pdf-export-confirm').click();
  await expect.poll(() => page.evaluate(() => window.__printCalled)).toBe(1);
  await expect(page.locator('.export-render-root, .pdf-progress-overlay')).toHaveCount(0);
  await expect(page.locator('#export-pdf')).toBeEnabled();
});

test('failed browser printing restores the document and allows another export', async ({ page }) => {
  await setEditorContent(page, '# Print failure');
  const title = await page.title();
  await page.evaluate(() => {
    window.print = () => { throw new Error('Printer unavailable'); };
    window.alert = value => { window.__pdfError = value; };
  });
  await page.locator('#export-pdf').dispatchEvent('click');
  await page.locator('#pdf-export-confirm').click();
  await expect.poll(() => page.evaluate(() => window.__pdfError)).toContain('Printer unavailable');
  await expect(page.locator('.export-render-root, .pdf-progress-overlay')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveAttribute('data-browser-print-export');
  await expect(page).toHaveTitle(title);
  await expect(page.locator('#export-pdf')).toBeEnabled();
});

test('cancelling a raster capture never saves a partial PDF and a late canvas is released', async ({ page }) => {
  await setEditorContent(page, '# Cancel raster');
  await page.evaluate(() => {
    window.__savedFiles = [];
    window.html2canvas = () => new Promise(resolve => {
      window.__finishCapture = () => {
        const canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 200;
        window.__lateCanvas = canvas; resolve(canvas);
      };
    });
  });
  await page.locator('#export-pdf').dispatchEvent('click');
  await page.locator('#pdf-export-card-raster').click();
  await page.locator('#pdf-export-confirm').click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__finishCapture))).toBe(true);
  await page.locator('.pdf-progress-cancel').click();
  await page.evaluate(() => window.__finishCapture());
  await expect.poll(() => page.evaluate(() => window.__lateCanvas.width)).toBe(0);
  expect(await page.evaluate(() => window.__savedFiles)).toEqual([]);
  await expect(page.locator('.export-render-root, .pdf-progress-overlay')).toHaveCount(0);
  await expect(page.locator('#export-pdf')).toBeEnabled();
});

for (const theme of ['light', 'dark']) {
  test(`Browser Print preserves long code, quotes and tables in ${theme} pages`, async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium', 'Playwright PDF generation is Chromium-only.');
    const markers = Array.from({ length: 360 }, (_, i) => `FLOW${String(i).padStart(3, '0')}`);
    const code = markers.slice(0, 90).map(marker => `${marker} ${'long_code_value_'.repeat(10)}`).join('\n');
    const quotes = markers.slice(90, 180).map(marker => `> ${marker} Quoted text continues across pages.<br>`).join('\n');
    const table = '| Repeated header | Details |\n|---|---|\n' + markers.slice(180, 270).map(marker => `| ${marker} | Table cell |`).join('\n');
    const tallRow = '<table><thead><tr><th>Tall row header</th></tr></thead><tbody><tr><td>' + markers.slice(270).map(marker => marker + ' Long cell content.<br>').join('') + '</td></tr></tbody></table>';
    await setEditorContent(page, '# Long print content\n\n```text\n' + code + '\n```\n\n' + quotes + '\n\n' + table + '\n\n' + tallRow);
    await page.evaluate(() => { window.print = () => { window.__printReady = true; }; });
    await page.locator('#export-pdf').dispatchEvent('click');
    await page.locator(`#pdf-export-theme-card-${theme}`).click();
    await page.locator('#pdf-export-confirm').click();
    await expect.poll(() => page.evaluate(() => window.__printReady)).toBe(true);
    const pdf = await readPdf(await page.pdf({ format: 'A4', printBackground: true, path: testInfo.outputPath(`long-content-${theme}.pdf`) }));
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const content = await (await pdf.getPage(i)).getTextContent();
      pages.push(content.items.map(item => item.str || '').join(' '));
    }
    expect(pages.join('\n').match(/FLOW\d{3}/g)).toEqual(markers);
    const tablePages = pages.filter(text => /FLOW(?:1[89]\d|2[0-6]\d)/.test(text));
    expect(tablePages.length).toBeGreaterThan(1);
    for (const text of tablePages) expect(text).toContain('Repeated header');
    await pdf.destroy();
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await expect(page.locator('.export-render-root, .pdf-progress-overlay')).toHaveCount(0);
  });
}
