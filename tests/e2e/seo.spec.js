const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent } = require('../helpers/app');

test.describe('localized search metadata', () => {
  test('renders a self-canonical Traditional Chinese page', async ({ page }) => {
    await openApp(page, '/?lang=tw');

    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://markdownviewer.pages.dev/?lang=tw'
    );
    await expect(page).toHaveTitle(/Markdown 閱讀器/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /免登入/);

    const schema = JSON.parse(await page.locator('#application-schema').textContent());
    expect(schema.url).toBe('https://markdownviewer.pages.dev/?lang=tw');
    expect(schema.inLanguage).toBe('zh-Hant');
    await expect(page.locator('#markdown-preview')).toContainText('歡迎使用 Markdown Viewer');
    await expect(page.locator('#markdown-editor')).not.toHaveValue(/# Welcome to Markdown Viewer/);
  });

  test('keeps language navigation crawlable and updates canonical metadata', async ({ page }) => {
    await openApp(page, '/?lang=tw');
    const originalDocument = '# My document\n\nKeep my content unchanged.';
    await setEditorContent(page, originalDocument);

    const desktopLanguageLinks = page.locator('#languageDropdown + .settings-language-menu .lang-select-item');
    await expect(desktopLanguageLinks).toHaveCount(15);
    for (const link of await desktopLanguageLinks.all()) {
      await expect(link).not.toHaveAttribute('href', '#');
    }

    await page.locator('.lang-select-item[data-lang="en"]').first().evaluate(element => element.click());
    await expect(page).toHaveURL('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://markdownviewer.pages.dev/'
    );

    await page.locator('.lang-select-item[data-lang="bg"]').first().evaluate(element => element.click());
    await expect(page).toHaveURL('/?lang=bg');
    await expect(page.locator('html')).toHaveAttribute('lang', 'bg');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://markdownviewer.pages.dev/?lang=bg'
    );
    await expect(page).toHaveTitle(/Markdown преглед/);
    await expect(page.locator('#markdown-editor')).toHaveValue(originalDocument);
    await page.reload();
    await page.locator('html[data-app-ready="true"]').waitFor();
    await expect(page.locator('#markdown-editor')).toHaveValue(originalDocument);
  });

  test('serves distinct translated content before JavaScript for every canonical locale', async ({ request }) => {
    const { SEO_LOCALES, canonicalUrlForLocale, canonicalPathForLocale } = await import('../../seo/locales.mjs');
    const { getWelcomeCopy } = await import('../../seo/welcome-content.mjs');
    const intros = new Set();
    for (const locale of SEO_LOCALES) {
      const response = await request.get(canonicalPathForLocale(locale), { maxRedirects: 0 });
      expect(response.status()).toBe(200);
      expect(response.headers()['content-language']).toBe(locale.htmlLang);
      const html = await response.text();
      const copy = getWelcomeCopy(locale.code);
      expect(html).toContain(`href="${canonicalUrlForLocale(locale)}" data-seo-field="canonical"`);
      expect(html).toContain(`<p>${copy.intro}</p>`);
      expect(html).toContain(`<p>${copy.privacy}</p>`);
      expect(html).not.toContain('id="welcome-preview" hidden');
      intros.add(copy.intro);
      if (locale.code !== 'en') expect(html).not.toContain('# Welcome to Markdown Viewer');
    }
    expect(intros.size).toBe(15);
  });

  test('the translated welcome is readable with JavaScript disabled', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
    const page = await context.newPage();
    try {
      await page.goto('/?lang=fr');
      await expect(page.locator('#welcome-preview')).toBeVisible();
      await expect(page.locator('#welcome-preview h2')).toHaveText('Bienvenue dans Markdown Viewer');
      await expect(page.locator('#welcome-preview')).toContainText('Rédigez et prévisualisez');
      await expect(page.locator('#welcome-preview')).not.toContainText('Write and preview Markdown');
    } finally {
      await context.close();
    }
  });

  test('a static host also starts with the localized document', async ({ page }) => {
    const { readFile } = require('node:fs/promises');
    const html = await readFile('index.html', 'utf8');
    await page.route(/\/\?lang=ja$/, route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
    const errors = await openApp(page, '/?lang=ja');
    expect(errors).toEqual([]);
    await expect(page.locator('#markdown-preview')).toContainText('Markdown Viewer へようこそ');
    await expect(page.locator('#markdown-editor')).not.toHaveValue(/# Welcome to Markdown Viewer/);
    await expect(page).toHaveTitle(/Markdown ビューア/);
  });

  test('the root keeps English content and metadata despite saved or browser language', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, locale: 'fr-FR' });
    const page = await context.newPage();
    try {
      await page.addInitScript(() => localStorage.setItem('app-lang', 'fr'));
      await openApp(page);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page).toHaveTitle('Markdown Viewer - Online Markdown Editor with Live Preview');
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://markdownviewer.pages.dev/');
      await expect(page.locator('#markdown-preview')).toContainText('Welcome to Markdown Viewer');
    } finally {
      await context.close();
    }
  });

  test('canonical aliases redirect once and stay out of the sitemap', async ({ request }) => {
    for (const path of ['/?lang=en', '/tips', '/index.html']) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect([301, 308]).toContain(response.status());
      expect(new URL(response.headers().location, response.url()).pathname).toBe('/');
      expect(new URL(response.headers().location, response.url()).search).toBe('');
      expect((await request.get(response.headers().location)).status()).toBe(200);
    }
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap.match(/<loc>/g)).toHaveLength(15);
    expect(sitemap).not.toMatch(/\?lang=en|\/tips|\/index\.html/);
  });
});
