const test = require('node:test');
const assert = require('node:assert/strict');
const PdfPrintEngine = require('../pdf-export.js');

test('print CSS uses paged media and semantic fragmentation', () => {
  const css = PdfPrintEngine.createPrintCss({ pageSize: 'letter', margin: '12mm' });
  assert.match(css, /@page \{ size: letter; margin: 12mm; \}/);
  assert.match(css, /thead \{ display: table-header-group; \}/);
  assert.match(css, /break-inside: avoid-page/);
  assert.doesNotMatch(css, /html2canvas|canvas\.toDataURL|jsPDF/i);
});

test('invalid print options fall back to safe defaults', () => {
  assert.equal(PdfPrintEngine.normalizePageSize('url(evil)'), 'A4');
  assert.equal(PdfPrintEngine.normalizeCssLength('calc(1px)', '15mm'), '15mm');
  assert.equal(PdfPrintEngine.normalizePageSize('legal'), 'legal');
  assert.equal(PdfPrintEngine.normalizeCssLength('0.5in', '15mm'), '0.5in');
});

test('print document escapes metadata but preserves sanitized content markup', () => {
  const html = PdfPrintEngine.buildPrintHtml({
    title: '<Report & Notes>',
    lang: 'en" onload="bad',
    theme: 'dark',
    baseUrl: 'https://example.test/docs/?a=1&b=2',
    styleMarkup: '<style>.markdown-body{color:black}</style>',
    contentHtml: '<h1>Safe rendered content</h1>',
    options: {}
  });
  assert.match(html, /<title>&lt;Report &amp; Notes&gt;<\/title>/);
  assert.match(html, /lang="en&quot; onload=&quot;bad"/);
  assert.match(html, /<base href="https:\/\/example\.test\/docs\/\?a=1&amp;b=2">/);
  assert.match(html, /<h1>Safe rendered content<\/h1>/);
  assert.match(html, /class="markdown-body pdf-print-document"/);
});

test('only blocks that fit on a page are marked atomic', () => {
  const short = { classList: { add(name) { this.value = name; } }, getBoundingClientRect: () => ({ height: 300 }) };
  const tall = { classList: { add(name) { this.value = name; } }, getBoundingClientRect: () => ({ height: 1200 }) };
  const container = { querySelectorAll: () => [short, tall] };
  PdfPrintEngine.markAtomicBlocks(container, 900);
  assert.equal(short.classList.value, 'pdf-keep-together');
  assert.equal(tall.classList.value, undefined);
});
