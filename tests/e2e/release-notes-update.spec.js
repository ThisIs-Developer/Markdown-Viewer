const { test, expect } = require('@playwright/test');
const { version } = require('../../package.json');
const { openApp } = require('../helpers/app');

async function showReleaseNotes(page) {
  await page.locator('#header-about-button').click();
  await page.getByRole('button', { name: 'Show Release Notes' }).click();
}

test('a mobile update requests versioned notes instead of the previous release URL', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('markdownViewerLastVersion', '3.10.5');
    localStorage.setItem('markdownViewerReleaseNotesSeenVersion', '3.10.5');
  });
  const requestedVersions = [];
  await page.route('**/RELEASE_NOTES*', route => {
    const requested = new URL(route.request().url()).searchParams.get('v');
    requestedVersions.push(requested);
    return route.fulfill({ contentType: 'text/plain', body: requested === version
      ? `# Welcome to Markdown Viewer ${version}\n\n## Highlights\n\nCurrent release details`
      : '# Welcome to Markdown Viewer 3.10.5\n\nOld release details' });
  });
  await openApp(page, '/', { showReleaseNotes: true, expectEditorVisible: false });
  await expect(page.locator('#tab-list .release-notes-tab.active')).toContainText(version);
  await expect(page.locator('#markdown-preview')).toContainText('Current release details');
  await expect(page.locator('#markdown-preview')).not.toContainText('Old release details');
  expect(requestedVersions).toEqual([version]);
});

for (const failure of ['wrong version', 'network error']) {
  test(`release notes can retry a ${failure} without marking the update as read`, async ({ page }) => {
    let available = false;
    await page.route('**/RELEASE_NOTES*', route => {
      if (!available && failure === 'network error') return route.abort();
      return route.fulfill({ contentType: 'text/plain', body: available
        ? `# Welcome to Markdown Viewer ${version}\n\n## Highlights\n\nRecovered release details`
        : '# Welcome to Markdown Viewer 3.10.5\n\nOutdated release details' });
    });
    await openApp(page);
    await page.evaluate(currentVersion => {
      localStorage.setItem('markdownViewerReleaseNotesSeenVersion', '3.10.5');
      localStorage.setItem('markdownViewerPendingReleaseNotesVersion', currentVersion);
    }, version);
    await showReleaseNotes(page);
    await expect(page.locator('#markdown-preview')).toContainText('The release notes could not be loaded');
    await expect(page.locator('#markdown-preview')).not.toContainText('Outdated release details');
    await page.locator('.release-notes-tab .tab-close-btn').click();
    expect(await page.evaluate(() => localStorage.getItem('markdownViewerReleaseNotesSeenVersion'))).toBe('3.10.5');
    expect(await page.evaluate(() => localStorage.getItem('markdownViewerPendingReleaseNotesVersion'))).toBe(version);
    available = true;
    await showReleaseNotes(page);
    await expect(page.locator('#markdown-preview')).toContainText('Recovered release details');
    await page.locator('.release-notes-tab .tab-close-btn').click();
    expect(await page.evaluate(() => localStorage.getItem('markdownViewerReleaseNotesSeenVersion'))).toBe(version);
    expect(await page.evaluate(() => localStorage.getItem('markdownViewerPendingReleaseNotesVersion'))).toBeNull();
  });
}

test('retrying an open unavailable release tab refreshes it in place', async ({ page }) => {
  let available = false;
  await page.route('**/RELEASE_NOTES*', route => route.fulfill({ contentType: 'text/plain', body: available
    ? `# Welcome to Markdown Viewer ${version}\n\n## Highlights\n\nRetried in place`
    : '# Welcome to Markdown Viewer 3.10.5\n\nOld details' }));
  await openApp(page);
  await showReleaseNotes(page);
  await expect(page.locator('#markdown-preview')).toContainText('could not be loaded');
  available = true;
  await showReleaseNotes(page);
  await expect(page.locator('#markdown-preview')).toContainText('Retried in place');
  await expect(page.locator('.release-notes-tab')).toHaveCount(1);
});

test.describe('installed service worker', () => {
  test.use({ serviceWorkers: 'allow' });

  test('refreshes stale notes and opens the matching release offline', async ({ page, context }) => {
    await openApp(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('sw.js');
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
      }
    });
    const notes = await page.evaluate(async currentVersion => {
      const cache = await caches.open('markdown-viewer-cache-v' + currentVersion);
      await cache.put('RELEASE_NOTES', new Response('# Welcome to Markdown Viewer 3.10.5\n\nPrevious release details'));
      return (await fetch('RELEASE_NOTES')).text();
    }, version);
    expect(notes).toContain('# Welcome to Markdown Viewer ' + version);
    expect(notes).not.toContain('Previous release details');

    await context.setOffline(true);
    await showReleaseNotes(page);
    await expect(page.locator('.release-notes-tab.active')).toContainText(version);
    await expect(page.locator('#markdown-preview h1')).toHaveText('Welcome to Markdown Viewer ' + version);
    await expect(page.locator('#markdown-preview')).not.toContainText('could not be loaded');
  });
});
