const { test, expect } = require('@playwright/test');
const { appVersion, openApp, stubClipboard } = require('../helpers/app');

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('header consolidates icon document actions in the requested order', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const header = page.locator('.header-right');
  await expect(page.locator('.app-header h1')).toBeVisible();
  expect(await page.locator('.app-header h1').evaluate(title => title.getBoundingClientRect().width)).toBeGreaterThan(115);
  expect(await page.locator('#document-sidebar').evaluate(sidebar => sidebar.getBoundingClientRect().width)).toBeGreaterThanOrEqual(220);
  for (const selector of ['#importDropdown', '#copy-markdown-button', '#toggle-sync', '#review-toggle', '#share-button', '#live-share-button', '#exportDropdown', '#header-about-button', '#workspaceSettingsDropdown']) {
    await expect(header.locator(selector)).toBeVisible();
  }
  await expect(header.locator('[aria-label="Report an issue"]')).toBeVisible();
  await expect(header.locator('.header-view-toolbar .view-toggle-btn')).toHaveCount(3);
  await expect(header.locator('#importDropdown .btn-text, #share-button .btn-text, #live-share-button .btn-text, #exportDropdown .btn-text')).toHaveCount(0);
  await expect(header.locator('#importDropdown i').first()).toHaveClass('lucide lucide-plus');
  await expect(header.locator('#copy-markdown-button i')).toHaveClass('lucide lucide-clipboard');
  expect(await header.locator('#copy-markdown-button i').evaluate(icon => getComputedStyle(icon).maskImage)).not.toBe('none');
  expect(await header.locator('#copy-markdown-button').evaluate(button => getComputedStyle(button).borderTopColor)).not.toBe('rgba(0, 0, 0, 0)');
  for (const selector of ['#importDropdown', '#exportDropdown']) {
    const trigger = header.locator(selector);
    await expect(trigger.locator('.header-dropdown-chevron')).toHaveClass(/lucide-chevron-down/);
    const iconSizes = await trigger.locator('i').evaluateAll(icons => icons.map(icon => Number.parseFloat(getComputedStyle(icon).fontSize)));
    expect(iconSizes[1]).toBeLessThan(iconSizes[0]);
    expect(await trigger.evaluate(button => button.getBoundingClientRect().width)).toBeGreaterThanOrEqual(38);
  }
  await expect(header.locator('#workspaceSettingsDropdown .header-dropdown-chevron')).toHaveCount(0);

  const headerOrder = await header.locator(':scope > button, :scope > a, :scope > .dropdown > button').evaluateAll(elements =>
    elements.map(element => element.id || element.getAttribute('aria-label'))
  );
  expect(headerOrder).toEqual([
    'toggle-sync',
    'importDropdown',
    'copy-markdown-button',
    'exportDropdown',
    'share-button',
    'live-share-button',
    'review-toggle',
    'Report an issue',
    'header-about-button',
    'workspaceSettingsDropdown'
  ]);

  const toolbar = page.locator('#markdown-format-toolbar');
  await expect(toolbar.locator('.workspace-format-actions [data-md-action="find"]')).toBeVisible();
  await expect(toolbar.locator('.workspace-format-actions [data-md-action="fullscreen"]')).toBeVisible();
  await expect(toolbar.locator('.workspace-format-actions [data-md-action="find"] i')).toHaveClass(/lucide-search/);
  await expect(toolbar.locator('.workspace-format-actions [data-md-action="fullscreen"] i')).toHaveClass(/lucide-maximize/);
  await expect(toolbar.locator('#review-toggle, #toggle-sync, #copy-markdown-button')).toHaveCount(0);
  await expect(toolbar.locator('#exportDropdown')).toHaveCount(0);
  await expect(toolbar.locator('.markdown-tool-select--insert, [data-toolbar-menu="insert"]')).toHaveCount(0);
  await expect(toolbar.locator('.markdown-toolbar-group--content > .markdown-tool-btn')).toHaveCount(4);
  await expect(toolbar.locator('.markdown-toolbar-group--technical > .markdown-tool-btn')).toHaveCount(3);
  await expect(toolbar.locator('.markdown-toolbar-group--advanced > .markdown-tool-btn')).toHaveCount(5);

  await toolbar.locator('.workspace-format-actions [data-md-action="find"]').click();
  await expect(page.locator('#find-replace-modal')).toBeVisible();
  await page.locator('#find-replace-close-icon').click();
  await expect(page.locator('#find-replace-modal')).toBeHidden();

  const fullscreen = toolbar.locator('.workspace-format-actions [data-md-action="fullscreen"]');
  await fullscreen.click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await expect(fullscreen).toHaveAttribute('aria-label', 'Exit fullscreen');
  await fullscreen.click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);

  await header.locator('#toggle-sync').click();
  await expect(header.locator('#toggle-sync')).toHaveAttribute('aria-pressed', 'false');
  await header.locator('#toggle-sync').click();
  await expect(header.locator('#toggle-sync')).toHaveAttribute('aria-pressed', 'true');
  await stubClipboard(page);
  await header.locator('#copy-markdown-button').click();
  await expect(header.locator('#copy-markdown-button')).toHaveAttribute('aria-label', 'Copied');
  await expect.poll(() => page.evaluate(() => window.__copiedText)).not.toBe('');

  await header.locator('#importDropdown').click();
  const newMenu = page.locator('[aria-labelledby="importDropdown"]');
  await expect(newMenu).toBeVisible();
  await expect(newMenu.locator('.app-menu-label')).toHaveText(['New document', 'From files', 'From GitHub']);
  const newWidth = await newMenu.evaluate(menu => menu.getBoundingClientRect().width);
  expect(newWidth).toBeGreaterThanOrEqual(167.5);
  expect(newWidth).toBeLessThanOrEqual(220);
  await page.keyboard.press('Escape');

  await header.locator('#exportDropdown').click();
  const exportMenu = page.locator('[aria-labelledby="exportDropdown"]');
  await expect(exportMenu).toBeVisible();
  await expect(exportMenu.locator('.app-menu-label')).toHaveText(['Markdown (.md)', 'HTML', 'PDF', 'Image (.png)']);
  await expect(exportMenu.locator('.settings-menu-header, .app-menu-description')).toHaveCount(0);
  const exportWidth = await exportMenu.evaluate(menu => menu.getBoundingClientRect().width);
  expect(exportWidth).toBeGreaterThanOrEqual(167.5);
  expect(exportWidth).toBeLessThanOrEqual(220);
});

test('bottom bar centers statistics and announces saving then saved', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('.app-status-bar')).toBeVisible();
  await expect(page.locator('#stats-container')).toBeVisible();
  await expect(page.locator('#save-status')).toHaveAttribute('data-state', 'saved');
  await expect(page.locator('#save-status-text')).toHaveText('All changes saved');
  await expect(page.locator('#save-status-icon')).toHaveClass(/lucide-check/);

  const alignment = await page.evaluate(() => {
    const viewportCenter = window.innerWidth / 2;
    const stats = document.querySelector('#stats-container').getBoundingClientRect();
    const save = document.querySelector('#save-status').getBoundingClientRect();
    return {
      statsCenter: stats.left + stats.width / 2,
      viewportCenter,
      saveRight: save.right,
      viewportRight: window.innerWidth
    };
  });
  expect(Math.abs(alignment.statsCenter - alignment.viewportCenter)).toBeLessThanOrEqual(1);
  expect(alignment.viewportRight - alignment.saveRight).toBeLessThanOrEqual(12);

  await page.locator('#markdown-editor').fill('# Saving status test');
  await expect(page.locator('#save-status')).toHaveAttribute('data-state', 'saving');
  await expect(page.locator('#save-status-text')).toHaveText('Saving...');
  await expect(page.locator('#save-status-icon')).toHaveClass(/lucide-refresh-cw/);
  await expect(page.locator('#save-status')).toHaveAttribute('data-state', 'saved', { timeout: 3000 });
  await expect(page.locator('#save-status-text')).toHaveText('All changes saved');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.locator('#markdown-editor').fill('# Reduced motion status test');
  await expect(page.locator('#save-status')).toHaveAttribute('data-state', 'saving');
  await expect(page.locator('#save-status-icon')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('#save-status')).toHaveAttribute('data-state', 'saved', { timeout: 3000 });

  const contrast = await page.locator('#save-status').evaluate(status => {
    const parse = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luminance = rgb => {
      const values = rgb.map(value => {
        const channel = value / 255;
        return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
      });
      return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
    };
    const foreground = luminance(parse(getComputedStyle(status).color));
    const background = luminance(parse(getComputedStyle(status.closest('.app-status-bar')).backgroundColor));
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
});

test('about presents compact production information and project links', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('#header-about-button').click();
  const about = page.locator('#about-modal');
  await expect(about).toBeVisible();
  await expect(about).toContainText('A browser-based Markdown editor, viewer, previewer, and reader.');
  await expect(page.locator('#about-version')).toHaveText(await appVersion());
  await expect(about).toContainText('Open source');
  await expect(about.getByRole('link', { name: 'GitHub Repository' })).toHaveAttribute('href', 'https://github.com/ThisIs-Developer/Markdown-Viewer');
  await expect(about.getByRole('link', { name: 'Apache License 2.0' })).toHaveAttribute('href', /LICENSE$/);
  await expect(about.getByRole('button', { name: 'Show Release Notes' })).toBeVisible();
  await expect(about.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', /\/wiki\/FAQ$/);
  await expect(about).not.toContainText('Technology stack');
  await expect(about).not.toContainText('Storage privacy');
  await expect(about).not.toContainText('Clear local data');
  await expect(about.locator('#private-mode-toggle')).toHaveCount(0);
});

for (const viewport of [
  { width: 320, height: 720 },
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1080, height: 720 },
  { width: 1440, height: 900 }
]) {
  test(`status and toolbar avoid horizontal overflow at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await expect(page.locator('.app-status-bar')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (viewport.width < 1080) {
      await expect(page.locator('#stats-container')).toBeHidden();
      await expect(page.locator('#save-status')).toBeVisible();
    } else {
      await expect(page.locator('#stats-container')).toBeVisible();
      await expect(page.locator('.header-right')).toBeVisible();
      const headerLayout = await page.evaluate(() => {
        const title = document.querySelector('.app-header h1').getBoundingClientRect();
        const toolbar = document.querySelector('.header-right').getBoundingClientRect();
        const visibleControls = Array.from(document.querySelectorAll('.header-right > *')).filter(element => {
          const style = getComputedStyle(element);
          return style.display !== 'none' && !element.hidden && element.getBoundingClientRect().width > 0;
        }).map(element => element.getBoundingClientRect());
        return {
          noOverlap: title.right <= toolbar.left,
          controlsInViewport: visibleControls.every(rect => rect.left >= 0 && rect.right <= window.innerWidth)
        };
      });
      expect(headerLayout.noOverlap).toBe(true);
      expect(headerLayout.controlsInViewport).toBe(true);
    }
  });
}
