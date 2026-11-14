'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('@playwright/test');

async function main() {
  const origin = process.env.DOCKER_SMOKE_URL;
  if (!origin) throw new Error('Set DOCKER_SMOKE_URL to the HTTP or HTTPS test origin');
  const mode = origin.startsWith('https:') ? 'https' : 'http';
  const browser = await chromium.launch({ headless: true });
  const failedLocalAssets = [];

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      serviceWorkers: 'allow',
      // Local HTTPS uses a private CA not yet installed on the CI runner.
      ignoreHTTPSErrors: mode === 'https'
    });
    const page = await context.newPage();

    page.on('requestfailed', request => {
      const type = request.resourceType();
      if (['script', 'stylesheet', 'document', 'font', 'image'].includes(type) &&
          new URL(request.url()).origin === origin) {
        failedLocalAssets.push(`${request.url()}: ${request.failure()?.errorText}`);
      }
    });

    const response = await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 45000 });
    assert.equal(response.status(), 200, `${mode} navigation must return 200`);

    await page.locator('#markdown-editor').waitFor({ state: 'visible', timeout: 45000 });
    await page.locator('#markdown-preview').waitFor({ state: 'visible', timeout: 45000 });
    await page.waitForFunction(() =>
      !!getComputedStyle(document.documentElement).getPropertyValue('--bg-color').trim(),
      { timeout: 20000 }
    );

    await page.locator('#markdown-editor').fill('# Docker transport test\n\n**Live preview works**');
    await page.locator('#markdown-preview')
      .getByRole('heading', { name: 'Docker transport test' })
      .waitFor({ timeout: 30000 });
    await page.locator('#markdown-preview')
      .getByText('Live preview works')
      .waitFor({ timeout: 30000 });

    const swState = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) throw new Error('Service Worker API unavailable');
      await navigator.serviceWorker.register('/sw.js');
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Service Worker install timed out')), 25000))
      ]);
      const worker = registration.active;
      if (!worker) throw new Error('Service Worker not active');
      if (worker.state !== 'activated') {
        await Promise.race([
          new Promise(resolve => worker.addEventListener('statechange', () => {
            if (worker.state === 'activated') resolve();
          })),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Service Worker activation timed out')), 20000))
        ]);
      }
      return worker.state;
    });
    assert.equal(swState, 'activated', 'Offline precache must install successfully');
    assert.deepEqual(failedLocalAssets, [], 'No local CSS/JS/font/image resources may fail');

    await fs.mkdir('docker-artifacts', { recursive: true });
    await page.screenshot({ path: `docker-artifacts/docker-${mode}.png`, timeout: 15000 });
    console.log(`PASS: ${origin} — styled editor, live preview, local assets, Service Worker`);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
