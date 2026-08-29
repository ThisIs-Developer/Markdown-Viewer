const { test, expect } = require('@playwright/test');

test.describe('localized search metadata', () => {
  test('renders a self-canonical Traditional Chinese page', async ({ page }) => {
    await page.goto('/?lang=tw');

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
  });

  test('keeps language navigation crawlable and updates canonical metadata', async ({ page }) => {
    await page.goto('/?lang=tw');
    await page.locator('html[data-app-ready="true"]').waitFor();

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
  });
});
