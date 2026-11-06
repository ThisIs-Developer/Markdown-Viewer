import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
const context = {};
vm.runInNewContext(source.slice(source.indexOf('  function mergePdfIntervals('), source.indexOf('  async function measureRasterPdfLayout(')), context);
const plan = (layout, height = 100) => JSON.parse(JSON.stringify(context.planRasterPdfPages({ blocks: [], tables: [], ...layout }, height)));

function verifyCoverage(pages, layout) {
  assert.equal(pages[0].start, 0);
  assert.equal(pages.at(-1).end, layout.height);
  for (let i = 0; i < pages.length; i++) {
    assert.ok(pages[i].end > pages[i].start);
    if (i) assert.equal(pages[i - 1].end, pages[i].start);
    for (const line of layout.lines) {
      assert.ok(!(line.top < pages[i].end && pages[i].end < line.bottom), 'page boundary cuts a line');
    }
  }
}

test('all boundaries in long text use actual line gaps, including fractional sizes', () => {
  for (const lineHeight of [7.5, 17, 21.333, 43, 99, 150]) {
    const lines = Array.from({ length: 120 }, (_, i) => ({ top: i * lineHeight, bottom: i * lineHeight + lineHeight * 0.8 }));
    const layout = { height: lines.at(-1).bottom, lines };
    verifyCoverage(plan(layout), layout);
  }
});

test('oversized atomic content is kept whole without a non-advancing page or lost tail', () => {
  const layout = { height: 550, lines: [{ top: 10, bottom: 500 }, { top: 530, bottom: 550 }] };
  const pages = plan(layout);
  verifyCoverage(pages, layout);
  assert.equal(pages.length, 2);
  assert.ok(pages.some(page => page.start <= 10 && page.end >= 500));
});

test('a final fractional line is not dropped by a blank-page tolerance', () => {
  const layout = { height: 100.1, lines: [{ top: 99, bottom: 100.1 }] };
  verifyCoverage(plan(layout), layout);
  assert.equal(plan({ height: 100, lines: [] }).length, 1);
  assert.equal(plan({ height: 0, lines: [] }).length, 1);
});

test('table headers reserve space on continuation pages and stop after the table', () => {
  const layout = { height: 400, lines: Array.from({ length: 20 }, (_, i) => ({ top: i * 20, bottom: i * 20 + 16 })),
    tables: [{ headerTop: 0, headerBottom: 20, bottom: 300, left: 0, width: 200 }] };
  const pages = plan(layout);
  verifyCoverage(pages, layout);
  assert.equal(pages[0].header, null);
  assert.ok(pages[1].header);
  assert.equal(pages.at(-1).header, null);
  for (const page of pages) assert.ok(page.end - page.start + (page.header ? 20 : 0) <= 100);
});

test('nested overlapping inline ranges cannot create a cut through a larger glyph', () => {
  const layout = { height: 310, lines: [{ top: 85, bottom: 112 }, { top: 92, bottom: 108 }, { top: 105, bottom: 130 }, { top: 190, bottom: 215 }] };
  verifyCoverage(plan(layout), layout);
});

test('invalid dimensions fail explicitly', () => {
  for (const height of [0, -1, NaN, Infinity]) assert.throws(() => plan({ height: 100, lines: [] }, height));
});
