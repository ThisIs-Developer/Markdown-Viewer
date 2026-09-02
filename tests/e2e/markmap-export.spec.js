const fs = require('node:fs/promises');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent, stubExportLibraries } = require('../helpers/app');

const rootDir = path.resolve(__dirname, '../..');
const markmapAssets = [
  ['https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js', 'd3.min.js'],
  ['https://cdn.jsdelivr.net/npm/markmap-lib@0.18.12/dist/browser/index.iife.js', 'markmap-lib.iife.js'],
  ['https://cdn.jsdelivr.net/npm/markmap-view@0.18.12/dist/browser/index.js', 'markmap-view.js']
];

test('real Markmap trees remain readable in vector PDF print layout', async ({ page }) => {
  await stubExportLibraries(page);
  for (const [url, filename] of markmapAssets) {
    await page.route(url, async route => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: await fs.readFile(path.join(rootDir, 'desktop-app', 'resources', 'libs', filename))
      });
    });
  }
  await openApp(page);
  await setEditorContent(page, `# Markmap Rendering Test Suite

## Basic Mind Map

\`\`\`markmap
# Product
## Research
### Users
### Market
## Build
### Web app
### API
## Release
### Documentation
### Monitoring
\`\`\`

## Deep Hierarchy

\`\`\`markmap
# Platform
## Frontend
### Components
#### Buttons
#### Dialogs
## Backend
### API
#### Authentication
#### Storage
\`\`\`

## Large Software Architecture

\`\`\`markmap
# Architecture
## Clients
### Web
### Mobile
## Services
### Gateway
### Accounts
### Documents
## Data
### Database
### Cache
### Object Storage
\`\`\``);
  await expect(page.locator('#markdown-preview .markmap-diagram svg').first()).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => {
    window.print = () => { window.__realMarkmapPrintPrepared = true; };
  });

  await page.locator('#export-pdf').dispatchEvent('click');
  await page.locator('#pdf-export-theme-card-dark').click();
  await page.locator('#pdf-export-confirm').click();
  await expect.poll(() => page.evaluate(() => window.__realMarkmapPrintPrepared), { timeout: 20_000 }).toBe(true);
  await page.emulateMedia({ media: 'print' });

  const layouts = await page.locator('.browser-print-export-snapshot .markmap-diagram svg').evaluateAll(svgs => {
    return svgs.map(svg => {
      const svgRect = svg.getBoundingClientRect();
      const contentRect = svg.querySelector('g')?.getBoundingClientRect();
      return {
        fitted: svg.dataset.exportFitted,
        width: svgRect.width,
        height: svgRect.height,
        contentWidthRatio: contentRect && svgRect.width ? contentRect.width / svgRect.width : 0,
        contentHeightRatio: contentRect && svgRect.height ? contentRect.height / svgRect.height : 0,
        viewBox: svg.getAttribute('viewBox')
      };
    });
  });

  expect(layouts).toHaveLength(3);
  layouts.forEach(layout => {
    expect(layout.fitted).toBe('true');
    expect(layout.width).toBeGreaterThan(300);
    expect(layout.height).toBeGreaterThanOrEqual(220);
    expect(layout.height).toBeLessThanOrEqual(620);
    expect(Math.max(layout.contentWidthRatio, layout.contentHeightRatio)).toBeGreaterThan(0.55);
    expect(layout.viewBox).toBeTruthy();
  });

  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.emulateMedia({ media: 'screen' });
});
