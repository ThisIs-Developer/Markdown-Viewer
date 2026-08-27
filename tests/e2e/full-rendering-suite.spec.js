const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const {
  openApp,
  setEditorContent,
  stubRemoteDiagramServices,
  stubLazyRendererLibraries
} = require('../helpers/app');

const fullRenderingSuite = fs.readFileSync(
  path.join(__dirname, '..', '..', 'FULL-RENDERING-TEST.md'),
  'utf8'
);

test.beforeEach(async ({ page }) => {
  await stubRemoteDiagramServices(page);
  await stubLazyRendererLibraries(page);
});

test('renders the complete manual suite without parser, safety, math, or layout regressions', async ({ page }) => {
  test.setTimeout(120_000);
  const criticalErrors = await openApp(page);
  await page.evaluate(() => {
    window.__mapInvalidationWidths = [];
    window.L = {
      map(node) {
        const pane = document.createElement('div');
        pane.className = 'leaflet-map-pane';
        pane.textContent = 'Rendered map';
        node.appendChild(pane);
        return {
          remove() { pane.remove(); },
          fitBounds() {},
          setView() {},
          eachLayer() {},
          invalidateSize() { window.__mapInvalidationWidths.push(node.clientWidth); },
          attributionControl: {
            addAttribution() {},
            removeAttribution() {}
          }
        };
      },
      tileLayer() {
        return { addTo() { return this; } };
      },
      geoJSON() {
        return {
          addTo() { return this; },
          getBounds() {
            return { isValid() { return false; } };
          }
        };
      }
    };
    window.topojson = {
      feature() {
        return { type: 'FeatureCollection', features: [] };
      }
    };
  });

  await setEditorContent(page, fullRenderingSuite);
  await expect(page.locator('#end-of-rendering-suite')).toBeVisible();
  await expect(page.locator('.diagram-viewer.is-loading, .geojson-container.is-loading, .topojson-container.is-loading, .stl-container.is-loading')).toHaveCount(0);

  const headingIds = await page.locator('#markdown-preview [id]').evaluateAll(nodes => nodes.map(node => node.id));
  expect(new Set(headingIds).size).toBe(headingIds.length);
  expect(headingIds).toEqual(expect.arrayContaining([
    'duplicate-anchor',
    'duplicate-anchor-1',
    'duplicate-anchor-2',
    '你好-世界',
    'café-déjà-vu',
    'привет-мир',
    'heading',
    'heading-1'
  ]));

  const escapedPunctuation = page.locator('#escaped-markdown-punctuation + p + p');
  await expect(escapedPunctuation).toContainText('[literal brackets]');
  await expect(escapedPunctuation.locator('mjx-container')).toHaveCount(0);

  const markerListCount = await page.locator('#marker-changes-create-separate-lists').evaluate(heading => {
    let count = 0;
    let node = heading.nextElementSibling;
    while (node && node.tagName !== 'H3' && node.tagName !== 'H2') {
      if (node.tagName === 'UL') count += 1;
      node = node.nextElementSibling;
    }
    return count;
  });
  expect(markerListCount).toBe(3);
  await expect(page.locator('#list-starting-at-five + ol')).toHaveAttribute('start', '5');
  const issueTwoListCount = await page.locator('#issue-2-mixed-bullet-markers').evaluate(heading => {
    let count = 0;
    let node = heading.nextElementSibling;
    while (node && node.tagName !== 'H3' && node.tagName !== 'H2') {
      if (node.tagName === 'UL') count += 1;
      node = node.nextElementSibling;
    }
    return count;
  });
  expect(issueTwoListCount).toBe(2);

  const codeBoundaryLeaks = await page.locator('[id="8-code-and-token-boundaries"]').evaluate(heading => {
    let math = 0;
    let footnotes = 0;
    let node = heading.nextElementSibling;
    while (node && node.tagName !== 'H2') {
      math += node.querySelectorAll('pre mjx-container, code mjx-container').length;
      footnotes += node.querySelectorAll('pre .footnote-ref, code .footnote-ref').length;
      node = node.nextElementSibling;
    }
    return { math, footnotes };
  });
  expect(codeBoundaryLeaks).toEqual({ math: 0, footnotes: 0 });
  const issueFiveFootnoteLeaks = await page.locator('#issue-5-footnotes-inside-code').evaluate(heading => {
    let count = 0;
    let node = heading.nextElementSibling;
    while (node && node.tagName !== 'H3' && node.tagName !== 'H2') {
      count += node.querySelectorAll('.footnote-ref').length;
      node = node.nextElementSibling;
    }
    return count;
  });
  expect(issueFiveFootnoteLeaks).toBe(0);
  await expect(page.locator('#markdown-preview code').filter({ hasText: '[^code-note]: not a footnote' })).toHaveCount(1);
  await expect(page.locator('#markdown-preview code').filter({ hasText: '\\$20' }).first()).toBeVisible();

  await expect(page.locator('.footnotes li')).toHaveCount(7);
  await expect(page.locator('a[href^="#fnref-repeat"]')).toHaveCount(3);
  await expect(page.locator('#fnref-caselabel')).toHaveCount(1);
  await expect(page.locator('#fnref-a')).toHaveCount(1);
  await expect(page.locator('#fnref-a-1')).toHaveCount(1);
  await expect(page.locator('#markdown-preview')).toContainText('[^missing]');

  const definitionLists = await page.locator('[id="10-definition-lists"]').evaluate(heading => {
    let count = 0;
    let node = heading.nextElementSibling;
    while (node && node.tagName !== 'H2') {
      if (node.tagName === 'DL') count += 1;
      node = node.nextElementSibling;
    }
    return count;
  });
  expect(definitionLists).toBe(4);
  await expect(page.locator('#issue-6-multiple-definition-terms + dl dt')).toHaveCount(2);
  await expect(page.locator('#gfmcommonmark-precedence-boundaries + p + ol')).toHaveCount(1);
  await expect(page.locator('#gfmcommonmark-precedence-boundaries ~ table').first()).toBeVisible();

  await expect(page.locator('#markdown-preview script, #markdown-preview iframe, #markdown-preview object, #markdown-preview embed')).toHaveCount(0);
  await expect(page.locator('#markdown-preview [onclick], #markdown-preview [onload], #markdown-preview [onerror], #markdown-preview a[href^="javascript:"]')).toHaveCount(0);
  await expect(page.locator('#markdown-preview')).not.toContainText('This hidden comment text must not render.');
  await expect(page.locator('#markdown-preview')).not.toContainText('worker-hidden-line-one');

  const currencyMathCounts = await page.locator('#currency-must-remain-text').evaluate(heading => {
    const counts = [];
    let node = heading.nextElementSibling;
    while (node && node.tagName !== 'H3' && node.tagName !== 'H2') {
      if (node.tagName === 'P') {
        const copy = node.cloneNode(true);
        copy.querySelectorAll('mjx-container[data-test-renderer]').forEach(rendered => rendered.remove());
        counts.push({ text: copy.textContent, math: node.querySelectorAll('.math-inline, .math-block').length });
      }
      node = node.nextElementSibling;
    }
    return counts;
  });
  expect(currencyMathCounts).toEqual([
    { text: 'Expected: no MathJax appears in these price sentences.', math: 0 },
    { text: 'Options ran $20, $45, and $99 for the three tiers.', math: 0 },
    { text: 'The cart contains $5, $10, $25, and $100 items.', math: 0 },
    { text: 'Escaped prices cost $20, $45, and $99.', math: 0 },
    { text: 'Reviewer follow-up without comma boundaries: We spent $20 which caused $45 of loss and $99.', math: 0 },
    { text: 'Mixed currency and math: $20 plus $x^2$.', math: 1 },
    { text: 'Digit adjacency after math remains literal where required: $x$5.', math: 0 }
  ]);
  await expect(page.locator('#markdown-preview mjx-merror')).toHaveCount(0);
  await expect(page.locator('#issue-10-color-scoping + p .math-inline')).toContainText(
    '${\\color{red}v^2} {\\color{blue}G}M\\left({\\color{green}\\frac{2}{r}} - {\\color{purple}\\frac{1}{a}}\\right)$'
  );
  const issueElevenFormulas = await page.locator('#issue-11-inline-and-display-parity').evaluate(heading => {
    const formulas = [];
    let node = heading.nextElementSibling;
    while (node && node.tagName !== 'H3' && node.tagName !== 'H2') {
      const mathNodes = [];
      if (node.matches('.math-inline, .math-block')) mathNodes.push(node);
      node.querySelectorAll('.math-inline, .math-block').forEach(math => mathNodes.push(math));
      mathNodes.forEach(math => {
        const copy = math.cloneNode(true);
        copy.querySelectorAll('mjx-container[data-test-renderer]').forEach(rendered => rendered.remove());
        formulas.push(copy.textContent.trim().replace(/^\$\$?/, '').replace(/\$\$?$/, '').trim());
      });
      node = node.nextElementSibling;
    }
    return formulas;
  });
  expect(issueElevenFormulas).toHaveLength(2);
  expect(issueElevenFormulas[0]).toBe(issueElevenFormulas[1]);

  await expect(page.locator('.mermaid-container')).toHaveCount(2);
  await expect(page.locator('.plantuml-container')).toHaveCount(1);
  await expect(page.locator('.d2-container')).toHaveCount(1);
  await expect(page.locator('.graphviz-container')).toHaveCount(1);
  await expect(page.locator('.kroki-container')).toHaveCount(2);
  await expect(page.locator('.markmap-container')).toHaveCount(1);
  await expect(page.locator('.geojson-container')).toHaveCount(1);
  await expect(page.locator('.topojson-container')).toHaveCount(1);
  await expect(page.locator('.stl-container canvas')).toHaveCount(1);
  await expect(page.locator('.abc-container svg')).toHaveCount(1);

  const map = page.locator('.geojson-map');
  const canvas = page.locator('.stl-container canvas');
  const splitMapWidth = await map.evaluate(node => node.clientWidth);
  const splitCanvasWidth = await canvas.evaluate(node => node.getBoundingClientRect().width);
  await page.getByRole('button', { name: 'Preview Markdown' }).click();
  await expect.poll(() => map.evaluate(node => node.clientWidth)).toBeGreaterThan(splitMapWidth);
  await expect.poll(() => canvas.evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(splitCanvasWidth);
  await expect.poll(() => page.evaluate(() => window.__mapInvalidationWidths.at(-1) || 0)).toBeGreaterThan(splitMapWidth);

  await page.getByRole('button', { name: 'Edit Markdown' }).click();
  await expect(page.locator('#markdown-editor')).toBeVisible();
  await expect(page.locator('.preview-pane')).toBeHidden();
  await page.getByRole('button', { name: 'Split editor and preview' }).click();
  await expect(page.locator('#markdown-editor')).toBeVisible();
  await expect(page.locator('.preview-pane')).toBeVisible();
  expect(criticalErrors).toEqual([
    'Failed to load resource: the server responded with a status of 404 (Not Found)'
  ]);
});
