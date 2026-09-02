const { test, expect } = require('@playwright/test');
const {
  fixture,
  openApp,
  setEditorContent,
  stubRemoteDiagramServices,
  stubLazyRendererLibraries,
  stubExportLibraries
} = require('../helpers/app');

test.beforeEach(async ({ page }) => {
  await stubRemoteDiagramServices(page);
  await stubLazyRendererLibraries(page);
  await stubExportLibraries(page);
  await openApp(page);
  await setEditorContent(page, await fixture('export.md'));
  await page.evaluate(() => {
    window.__savedFiles = [];
    window.saveAs = (blob, name) => {
      window.__savedFiles.push({
        name,
        type: blob && blob.type ? blob.type : '',
        size: blob && typeof blob.size === 'number' ? blob.size : 0
      });
    };
  });
});

const allDiagramMarkdown = `# Exported diagrams

\`\`\`mermaid
flowchart LR
  A --> B
\`\`\`

\`\`\`abc
X:1
T:Export score
M:4/4
K:C
CDEF GABc|
\`\`\`

\`\`\`plantuml
@startuml
Alice -> Bob: Hello
@enduml
\`\`\`

\`\`\`d2
client -> server
\`\`\`

\`\`\`graphviz
digraph G { A -> B }
\`\`\`

\`\`\`vega-lite
{"mark":"bar","data":{"values":[{"x":"A","y":1}]},"encoding":{"x":{"field":"x"},"y":{"field":"y"}}}
\`\`\`

\`\`\`wavedrom
{"signal":[{"name":"clk","wave":"p..."}]}
\`\`\`

\`\`\`markmap
# Root
## Branch
\`\`\`

\`\`\`geojson
{"type":"FeatureCollection","features":[]}
\`\`\`

\`\`\`topojson
{"type":"Topology","objects":{"sample":{}},"arcs":[]}
\`\`\`

\`\`\`stl
solid triangle
facet normal 0 0 1
outer loop
vertex 0 0 0
vertex 1 0 0
vertex 0 1 0
endloop
endfacet
endsolid triangle
\`\`\``;

async function installMapStubs(page) {
  await page.evaluate(() => {
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
          invalidateSize() {},
          eachLayer() {},
          attributionControl: {
            addAttribution() {},
            removeAttribution() {}
          }
        };
      },
      tileLayer() { return { addTo() { return this; } }; },
      geoJSON() {
        return {
          addTo() { return this; },
          getBounds() { return { isValid() { return false; } }; }
        };
      }
    };
    window.topojson = {
      feature() { return { type: 'FeatureCollection', features: [] }; }
    };
  });
}

const renderedDiagramExpectation = {
  theme: 'dark',
  mermaid: true,
  abc: true,
  plantuml: true,
  d2: true,
  graphviz: true,
  vegalite: true,
  wavedrom: true,
  markmap: true,
  geojson: true,
  topojson: true,
  stl: true,
  loadingCount: 0
};

test('exports Markdown as a download', async ({ page }) => {
  await page.locator('#export-md').dispatchEvent('click');

  await expect.poll(() => page.evaluate(() => window.__savedFiles.at(-1))).toMatchObject({
    name: expect.stringMatching(/\.md$/),
    type: expect.stringContaining('text/markdown')
  });
});

test('exports rendered HTML as a download', async ({ page }) => {
  await page.locator('#export-html').dispatchEvent('click');
  await expect(page.locator('#html-export-modal')).toHaveClass(/is-visible/);
  await page.locator('#html-export-confirm').click();

  await expect.poll(() => page.evaluate(() => window.__savedFiles.at(-1))).toMatchObject({
    name: expect.stringMatching(/\.html$/),
    type: expect.stringContaining('text/html')
  });
});

test('browser PDF export opens options and triggers window.print for vector mode', async ({ page }) => {
  await page.locator('#export-pdf').dispatchEvent('click');
  await expect(page.locator('#pdf-export-modal')).toHaveClass(/is-visible/);
  await expect(page.locator('#pdf-export-mode-vector')).toBeChecked();

  await page.locator('#pdf-export-confirm').click();
  await expect.poll(() => page.evaluate(() => window.__printCalled)).toBeGreaterThan(0);
});

test('vector PDF renders every diagram off-screen without changing the app theme', async ({ page }) => {
  await installMapStubs(page);
  await setEditorContent(page, allDiagramMarkdown);
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    window.__vectorExportState = null;
    window.print = () => {
      const root = document.querySelector('.browser-print-export-snapshot');
      window.__vectorExportState = {
        appTheme: document.documentElement.getAttribute('data-theme'),
        exportTheme: document.documentElement.getAttribute('data-browser-print-export'),
        snapshot: {
          theme: root?.getAttribute('data-theme'),
          mermaid: Boolean(root?.querySelector('.mermaid svg')),
          abc: Boolean(root?.querySelector('.abc-notation svg')),
          plantuml: Boolean(root?.querySelector('.plantuml-diagram svg')),
          d2: Boolean(root?.querySelector('.d2-diagram svg')),
          graphviz: Boolean(root?.querySelector('.graphviz-diagram svg')),
          vegalite: Boolean(root?.querySelector('[data-diagram-engine="vegalite"] svg')),
          wavedrom: Boolean(root?.querySelector('[data-diagram-engine="wavedrom"] svg')),
          markmap: Boolean(root?.querySelector('.markmap-diagram svg')),
          geojson: Boolean(root?.querySelector('.geojson-map .leaflet-map-pane')),
          topojson: Boolean(root?.querySelector('.topojson-map .leaflet-map-pane')),
          stl: Boolean(root?.querySelector('.stl-viewer canvas')),
          loadingCount: root?.querySelectorAll('.is-loading, .diagram-status').length
        }
      };
      window.dispatchEvent(new Event('afterprint'));
    };
  });

  await page.locator('#export-pdf').dispatchEvent('click');
  await page.locator('#pdf-export-theme-card-dark').click();
  await page.locator('#pdf-export-confirm').click();

  await expect.poll(() => page.evaluate(() => window.__vectorExportState), { timeout: 20_000 }).toMatchObject({
    appTheme: 'light',
    exportTheme: 'dark',
    snapshot: renderedDiagramExpectation
  });
  await expect.poll(() => page.evaluate(() => ({
    appTheme: document.documentElement.getAttribute('data-theme'),
    exportTheme: document.documentElement.getAttribute('data-browser-print-export'),
    snapshots: document.querySelectorAll('.browser-print-export-snapshot').length
  }))).toEqual({ appTheme: 'light', exportTheme: null, snapshots: 0 });
});

test('dark vector PDF keeps tables and diagrams dark in print media', async ({ page }) => {
  await setEditorContent(page, `---
title: Dark PDF
description: Print colors should stay dark
tags:
  - export
  - diagrams
---

# Dark export

\`\`\`mermaid
flowchart LR
  A --> B
\`\`\`

\`\`\`plantuml
@startuml
Alice -> Bob: Hello
@enduml
\`\`\``);
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    window.print = () => { window.__darkPrintPrepared = true; };
  });

  await page.locator('#export-pdf').dispatchEvent('click');
  await page.locator('#pdf-export-theme-card-dark').click();
  await page.locator('#pdf-export-confirm').click();
  await expect.poll(() => page.evaluate(() => window.__darkPrintPrepared), { timeout: 20_000 }).toBe(true);
  await page.emulateMedia({ media: 'print' });

  const printStyles = await page.locator('.browser-print-export-snapshot').evaluate(root => {
    const style = element => getComputedStyle(element);
    const frontmatterCell = root.querySelector('.frontmatter-table td');
    const mermaidSvg = root.querySelector('.mermaid svg');
    const mermaidRect = root.querySelector('.mermaid svg rect');
    const mermaidText = root.querySelector('.mermaid svg text');
    const plantUmlSvg = root.querySelector('.plantuml-diagram svg');
    return {
      rootBackground: style(root).backgroundColor,
      cellBackground: style(frontmatterCell).backgroundColor,
      mermaidBackground: style(mermaidSvg).backgroundColor,
      mermaidNodeFill: style(mermaidRect).fill,
      mermaidTextFill: style(mermaidText).fill,
      plantUmlFilter: style(plantUmlSvg).filter,
      appDisplay: style(document.querySelector('.app-container')).display,
      appTheme: document.documentElement.getAttribute('data-theme')
    };
  });

  expect(printStyles).toEqual({
    rootBackground: 'rgb(13, 17, 23)',
    cellBackground: 'rgb(22, 27, 34)',
    mermaidBackground: 'rgba(0, 0, 0, 0)',
    mermaidNodeFill: 'rgb(31, 35, 40)',
    mermaidTextFill: 'rgb(201, 209, 217)',
    plantUmlFilter: 'invert(0.88) hue-rotate(180deg)',
    appDisplay: 'none',
    appTheme: 'light'
  });

  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.emulateMedia({ media: 'screen' });
  await expect(page.locator('.browser-print-export-snapshot')).toHaveCount(0);
});

test('PNG export produces an image download with a mocked local canvas renderer', async ({ page }) => {
  await page.locator('#export-png').dispatchEvent('click');
  await expect(page.locator('#png-export-modal')).toHaveClass(/is-visible/);
  await page.locator('#png-export-confirm').click();

  await expect.poll(() => page.evaluate(() => window.__savedFiles.at(-1)), { timeout: 20_000 }).toMatchObject({
    name: expect.stringMatching(/\.png$/),
    type: expect.stringContaining('image/png')
  });
});

test('PNG and raster PDF captures contain every rendered diagram', async ({ page }) => {
  await installMapStubs(page);
  await setEditorContent(page, allDiagramMarkdown);
  await page.evaluate(() => {
    window.__diagramCaptureStates = [];
    window.html2canvas = async root => {
      window.__diagramCaptureStates.push({
        theme: root.getAttribute('data-theme'),
        mermaid: Boolean(root.querySelector('.mermaid svg')),
        abc: Boolean(root.querySelector('.abc-notation svg')),
        plantuml: Boolean(root.querySelector('.plantuml-diagram svg')),
        d2: Boolean(root.querySelector('.d2-diagram svg')),
        graphviz: Boolean(root.querySelector('.graphviz-diagram svg')),
        vegalite: Boolean(root.querySelector('[data-diagram-engine="vegalite"] svg')),
        wavedrom: Boolean(root.querySelector('[data-diagram-engine="wavedrom"] svg')),
        markmap: Boolean(root.querySelector('.markmap-diagram svg')),
        geojson: Boolean(root.querySelector('.geojson-map .leaflet-map-pane')),
        topojson: Boolean(root.querySelector('.topojson-map .leaflet-map-pane')),
        stl: Boolean(root.querySelector('.stl-viewer canvas')),
        loadingCount: root.querySelectorAll('.is-loading, .diagram-status').length
      });
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 900;
      return canvas;
    };
  });

  await page.locator('#export-png').dispatchEvent('click');
  await page.locator('#png-export-theme-card-dark').click();
  await page.locator('#png-export-confirm').click();
  await expect.poll(() => page.evaluate(() => window.__savedFiles.some(file => file.name.endsWith('.png'))), { timeout: 20_000 }).toBe(true);

  await page.locator('#export-pdf').dispatchEvent('click');
  await page.locator('#pdf-export-card-raster').click();
  await page.locator('#pdf-export-theme-card-dark').click();
  await page.locator('#pdf-export-confirm').click();
  await expect.poll(() => page.evaluate(() => window.__savedFiles.some(file => file.name.endsWith('.pdf'))), { timeout: 20_000 }).toBe(true);

  await expect.poll(() => page.evaluate(() => window.__diagramCaptureStates), { timeout: 20_000 }).toEqual([
    renderedDiagramExpectation,
    renderedDiagramExpectation
  ]);
});

test('export modals use compact segmented theme toggles and restore previous selections', async ({ page }) => {
  // Test HTML Export Modal
  await page.locator('#export-html').dispatchEvent('click');
  await expect(page.locator('#html-export-modal')).toHaveClass(/is-visible/);
  await expect(page.locator('#html-export-modal .export-theme-toggle')).toBeVisible();
  await page.locator('#html-export-theme-card-dark').click();
  await expect(page.locator('#html-export-theme-dark')).toBeChecked();
  await page.locator('#html-export-cancel').click();
  await expect(page.locator('#html-export-modal')).not.toHaveClass(/is-visible/);

  // Reopen HTML Export and verify Dark theme is remembered
  await page.locator('#export-html').dispatchEvent('click');
  await expect(page.locator('#html-export-modal')).toHaveClass(/is-visible/);
  await expect(page.locator('#html-export-theme-dark')).toBeChecked();
  await page.locator('#html-export-cancel').click();

  // Test PDF Export Modal
  await page.locator('#export-pdf').dispatchEvent('click');
  await expect(page.locator('#pdf-export-modal')).toHaveClass(/is-visible/);
  await expect(page.locator('#pdf-export-modal .export-theme-toggle')).toBeVisible();
  const pdfAppearanceLayout = await page.evaluate(() => {
    const methodCards = document.querySelector('#pdf-export-modal .pdf-export-method-cards');
    const vectorCard = document.querySelector('#pdf-export-card-vector');
    const rasterCard = document.querySelector('#pdf-export-card-raster');
    const appearance = document.querySelector('#pdf-export-modal .export-appearance-setting');
    const toggle = document.querySelector('#pdf-export-modal .export-theme-toggle');
    const memory = document.querySelector('#pdf-export-modal .export-appearance-memory');
    const rasterRect = rasterCard.getBoundingClientRect();
    const appearanceRect = appearance.getBoundingClientRect();
    const toggleStyle = getComputedStyle(toggle);
    const memoryStyle = getComputedStyle(memory);
    const vectorTitle = vectorCard.querySelector('.pdf-export-method-title');
    const rasterTitle = rasterCard.querySelector('.pdf-export-method-title');
    const recommendedBadge = vectorCard.querySelector('.pdf-export-method-badge');
    const vectorDescription = vectorCard.querySelector('.pdf-export-method-description');
    const rasterDescription = rasterCard.querySelector('.pdf-export-method-description');
    const successColorProbe = document.createElement('span');
    successColorProbe.style.color = 'var(--success-color)';
    document.body.appendChild(successColorProbe);
    const successColor = getComputedStyle(successColorProbe).color;
    successColorProbe.remove();
    return {
      gap: Math.round(appearanceRect.top - rasterRect.bottom),
      methodColumns: getComputedStyle(methodCards).gridTemplateColumns.split(' ').length,
      vectorCardWidth: Math.round(vectorCard.getBoundingClientRect().width),
      rasterCardWidth: Math.round(rasterRect.width),
      vectorCardHeight: Math.round(vectorCard.getBoundingClientRect().height),
      rasterCardHeight: Math.round(rasterRect.height),
      vectorTitleFont: getComputedStyle(vectorTitle).fontSize,
      rasterTitleFont: getComputedStyle(rasterTitle).fontSize,
      vectorDescriptionFont: getComputedStyle(vectorDescription).fontSize,
      rasterDescriptionFont: getComputedStyle(rasterDescription).fontSize,
      vectorDescription: vectorDescription.textContent.trim(),
      rasterDescription: rasterDescription.textContent.trim(),
      badgeText: recommendedBadge.textContent.trim(),
      badgeFitsCard: recommendedBadge.getBoundingClientRect().right <= vectorCard.getBoundingClientRect().right - 8,
      toggleWidth: Math.round(toggle.getBoundingClientRect().width),
      toggleBorderColor: toggleStyle.borderColor,
      appBorderColor: getComputedStyle(rasterCard).borderColor,
      memoryText: memory.textContent.trim(),
      memoryColor: memoryStyle.color,
      memoryFontSize: memoryStyle.fontSize,
      memoryBackground: memoryStyle.backgroundColor,
      memoryBorderRadius: memoryStyle.borderRadius,
      successColor
    };
  });
  expect(pdfAppearanceLayout.gap).toBeLessThanOrEqual(12);
  expect(pdfAppearanceLayout.methodColumns).toBe(2);
  expect(pdfAppearanceLayout.vectorCardWidth).toBe(pdfAppearanceLayout.rasterCardWidth);
  expect(pdfAppearanceLayout.vectorCardHeight).toBe(pdfAppearanceLayout.rasterCardHeight);
  expect(pdfAppearanceLayout.vectorTitleFont).toBe(pdfAppearanceLayout.rasterTitleFont);
  expect(pdfAppearanceLayout.vectorDescriptionFont).toBe(pdfAppearanceLayout.rasterDescriptionFont);
  expect(pdfAppearanceLayout.vectorDescription).toBe('Fastest. Uses your browser print dialog.');
  expect(pdfAppearanceLayout.rasterDescription).toBe('Best for keeping tables, diagrams, and equations together.');
  expect(pdfAppearanceLayout.badgeText).toBe('Recommended');
  expect(pdfAppearanceLayout.badgeFitsCard).toBe(true);
  expect(pdfAppearanceLayout.toggleWidth).toBe(132);
  expect(pdfAppearanceLayout.toggleBorderColor).toBe(pdfAppearanceLayout.appBorderColor);
  expect(pdfAppearanceLayout.memoryText).toBe('Remembered');
  expect(pdfAppearanceLayout.memoryColor).toBe(pdfAppearanceLayout.successColor);
  expect(pdfAppearanceLayout.memoryFontSize).toBe('11px');
  expect(pdfAppearanceLayout.memoryBackground).not.toBe('rgba(0, 0, 0, 0)');
  expect(pdfAppearanceLayout.memoryBorderRadius).toBe('999px');
  await page.locator('#pdf-export-theme-card-dark').click();
  await expect(page.locator('#pdf-export-theme-dark')).toBeChecked();
  await page.locator('#pdf-export-cancel').click();
  await expect(page.locator('#pdf-export-modal')).not.toHaveClass(/is-visible/);

  // Reopen PDF Export and verify Dark theme is remembered
  await page.locator('#export-pdf').dispatchEvent('click');
  await expect(page.locator('#pdf-export-modal')).toHaveClass(/is-visible/);
  await expect(page.locator('#pdf-export-theme-dark')).toBeChecked();
  await page.locator('#pdf-export-cancel').click();

  // Test PNG Export Modal
  await page.locator('#export-png').dispatchEvent('click');
  await expect(page.locator('#png-export-modal')).toHaveClass(/is-visible/);
  await expect(page.locator('#png-export-modal .export-theme-toggle')).toBeVisible();
  await page.locator('#png-export-theme-card-dark').click();
  await expect(page.locator('#png-export-theme-dark')).toBeChecked();
  await page.locator('#png-export-cancel').click();
  await expect(page.locator('#png-export-modal')).not.toHaveClass(/is-visible/);

  // Reopen PNG Export and verify Dark theme is remembered
  await page.locator('#export-png').dispatchEvent('click');
  await expect(page.locator('#png-export-modal')).toHaveClass(/is-visible/);
  await expect(page.locator('#png-export-theme-dark')).toBeChecked();
  await page.locator('#png-export-cancel').click();
});
