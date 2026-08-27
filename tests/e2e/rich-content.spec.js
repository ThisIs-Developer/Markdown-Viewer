const { test, expect } = require('@playwright/test');
const {
  fixture,
  openApp,
  setEditorContent,
  stubRemoteDiagramServices,
  stubLazyRendererLibraries
} = require('../helpers/app');

test.beforeEach(async ({ page }) => {
  await stubRemoteDiagramServices(page);
  await stubLazyRendererLibraries(page);
  await openApp(page);
});

test('renders Mermaid diagrams', async ({ page }) => {
  await setEditorContent(page, await fixture('mermaid.md'));

  await expect(page.locator('.mermaid-container svg').first()).toBeVisible();
  await expect(page.locator('.mermaid-container').first()).toContainText(/Mermaid test diagram|Write Markdown/);
});

test('renders Mermaid diagrams in the secondary document split preview', async ({ page }) => {
  const markdown = await fixture('mermaid.md');
  const primaryTab = page.locator('#tab-list .tab-item').first();
  await page.locator('#tab-new-btn').click();
  await setEditorContent(page, markdown);
  const secondaryTabId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');

  await primaryTab.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Open in split view' }).click();
  await page.locator('#document-split-destination').selectOption(secondaryTabId);
  await page.locator('#document-split-modal-confirm').click();
  await page.locator('.view-toolbar [data-view-mode="preview"]').click();

  await expect(page.locator('#document-split-preview')).toBeVisible();
  await expect(page.locator('#document-split-preview .mermaid-container svg')).toBeVisible();
  await expect(page.locator('#document-split-preview .mermaid-container')).not.toHaveClass(/is-loading/);
});

test('renders WaveDrom diagrams in the secondary document split preview', async ({ page }) => {
  const markdown = await fixture('wavedrom.md');
  const primaryTab = page.locator('#tab-list .tab-item').first();
  await page.locator('#tab-new-btn').click();
  await setEditorContent(page, markdown);
  const secondaryTabId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');

  await primaryTab.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Open in split view' }).click();
  await page.locator('#document-split-destination').selectOption(secondaryTabId);
  await page.locator('#document-split-modal-confirm').click();
  await page.locator('.view-toolbar [data-view-mode="preview"]').click();

  await expect(page.locator('#document-split-preview')).toBeVisible();
  await expect(page.locator('#document-split-preview .kroki-container svg')).toBeVisible();
  await expect(page.locator('#document-split-preview .kroki-container')).not.toHaveClass(/is-loading/);
});

test('renders LaTeX and ABC notation in the secondary document split preview', async ({ page }) => {
  const markdown = '# Math and music\n\nInline math: $x^2 + y^2 = z^2$.\n\n```abc\nX:1\nT:Split score\nM:4/4\nK:C\nCDEF GABc|\n```';
  const primaryTab = page.locator('#tab-list .tab-item').first();
  await page.locator('#tab-new-btn').click();
  await setEditorContent(page, markdown);
  const secondaryTabId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');

  await primaryTab.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Open in split view' }).click();
  await page.locator('#document-split-destination').selectOption(secondaryTabId);
  await page.locator('#document-split-modal-confirm').click();
  await page.locator('.view-toolbar [data-view-mode="preview"]').click();

  await expect(page.locator('#document-split-preview mjx-container')).toBeVisible();
  await expect(page.locator('#document-split-preview .abc-container svg')).toBeVisible();
  await expect(page.locator('#document-split-preview .abc-container')).not.toHaveClass(/is-loading/);
});

test('renders GeoJSON maps and STL models in the secondary document split preview', async ({ page }) => {
  await page.evaluate(() => {
    window.L = {
      map(node) {
        const pane = document.createElement('div');
        pane.className = 'leaflet-map-pane';
        pane.textContent = 'Rendered GeoJSON map';
        node.appendChild(pane);
        return {
          remove() { pane.remove(); },
          fitBounds() {},
          setView() {},
          eachLayer() {},
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
  const markdown = '# Map and model\n\n```geojson\n{"type":"FeatureCollection","features":[]}\n```\n\n'
    + '```topojson\n{"type":"Topology","objects":{"sample":{}},"arcs":[]}\n```\n\n'
    + await fixture('stl.md');
  const primaryTab = page.locator('#tab-list .tab-item').first();
  await page.locator('#tab-new-btn').click();
  await setEditorContent(page, markdown);
  const secondaryTabId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');

  await primaryTab.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Open in split view' }).click();
  await page.locator('#document-split-destination').selectOption(secondaryTabId);
  await page.locator('#document-split-modal-confirm').click();
  await page.locator('.view-toolbar [data-view-mode="preview"]').click();

  const mapPanes = page.locator('#document-split-preview .leaflet-map-pane');
  await expect(mapPanes).toHaveCount(2);
  await expect(mapPanes.first()).toBeVisible();
  await expect(mapPanes.last()).toBeVisible();
  await expect(page.locator('#document-split-preview .geojson-container')).not.toHaveClass(/is-loading/);
  await expect(page.locator('#document-split-preview .topojson-container')).not.toHaveClass(/is-loading/);
  await expect(page.locator('#document-split-preview .stl-container canvas')).toBeVisible();
  await expect(page.locator('#document-split-preview .stl-toolbar')).toBeVisible();
  await expect(page.locator('#document-split-preview .stl-container')).not.toHaveClass(/is-loading/);
});

const remoteDiagramCases = [
  { name: 'PlantUML', fixtureName: 'plantuml.md', selector: '.plantuml-container svg', text: 'PlantUML test diagram' },
  { name: 'Graphviz DOT', fixtureName: 'graphviz.md', selector: '.graphviz-container svg', text: 'Graphviz test diagram' },
  { name: 'D2', fixtureName: 'd2.md', selector: '.d2-container svg', text: 'D2 test diagram' },
  { name: 'Vega-Lite', fixtureName: 'vega-lite.md', roleName: 'Vega-Lite diagram' },
  { name: 'WaveDrom', fixtureName: 'wavedrom.md', roleName: 'WaveDrom diagram' }
];

for (const diagram of remoteDiagramCases) {
  test(`renders ${diagram.name} through the diagram adapter`, async ({ page }) => {
    await setEditorContent(page, await fixture(diagram.fixtureName));

    if (diagram.roleName) {
      const image = page.getByRole('img', { name: diagram.roleName }).first();
      await expect(image).toBeVisible();
      await expect(image).toContainText(diagram.name === 'Vega-Lite' ? 'Vega-Lite test chart' : 'WaveDrom test diagram');
    } else {
      await expect(page.locator(diagram.selector).first()).toBeVisible();
      await expect(page.locator(diagram.selector).first()).toContainText(diagram.text);
    }
  });
}

test('renders Markmap mind maps', async ({ page }) => {
  await setEditorContent(page, await fixture('markmap.md'));

  await expect(page.locator('.markmap-container svg').first()).toBeVisible();
  await expect(page.locator('.markmap-container svg').first()).toContainText('Markmap test mind map');
});

test('renders ABC notation as visible sheet music', async ({ page }) => {
  await setEditorContent(page, await fixture('abc.md'));

  await expect(page.locator('.abc-container svg').first()).toBeVisible();
  await expect(page.locator('.abc-container').first()).toContainText('ABC notation test score');
});

test('renders STL content into a 3D preview surface', async ({ page }) => {
  await setEditorContent(page, await fixture('stl.md'));

  await expect(page.locator('.stl-container canvas').first()).toBeVisible();
  await expect(page.locator('.stl-toolbar').first()).toBeVisible();
});

test('resizes maps and STL previews when the preview pane changes width', async ({ page }) => {
  await page.evaluate(() => {
    window.__mapInvalidationWidths = [];
    window.L = {
      map(node) {
        const pane = document.createElement('div');
        pane.className = 'leaflet-map-pane';
        pane.textContent = 'Resizable map';
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
  });

  const markdown = '# Responsive rich content\n\n```geojson\n{"type":"FeatureCollection","features":[]}\n```\n\n'
    + await fixture('stl.md');
  await setEditorContent(page, markdown);

  const map = page.locator('.geojson-map').first();
  const canvas = page.locator('.stl-container canvas').first();
  await expect(map).toBeVisible();
  await expect(canvas).toBeVisible();
  const splitMapWidth = await map.evaluate(node => node.clientWidth);
  const splitCanvasWidth = await canvas.evaluate(node => node.getBoundingClientRect().width);

  await page.getByRole('button', { name: 'Preview Markdown' }).click();

  await expect.poll(() => map.evaluate(node => node.clientWidth)).toBeGreaterThan(splitMapWidth);
  await expect.poll(() => canvas.evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(splitCanvasWidth);
  await expect.poll(() => page.evaluate(() => window.__mapInvalidationWidths.at(-1) || 0)).toBeGreaterThan(splitMapWidth);
});
