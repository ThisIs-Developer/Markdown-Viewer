const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent, waitForAppReady } = require('../helpers/app');

const markdown = `---
title: Welcome to Markdown Viewer
description: Keep document typography consistent across interface languages.
tags: [markdown, live-preview]
---

# Welcome to Markdown Viewer

Normal text with **bold**, *italic*, and a [link](https://example.com).

## Key Features

- Split-screen Markdown preview with consistent spacing.
- 日本語の文章と한국어 문장 remain readable alongside English.

### Details

| Feature | Description |
| --- | --- |
| Preview | The same document in every interface language. |
`;

async function previewTypography(page) {
  return page.locator('#markdown-preview').evaluate(preview => {
    const properties = [
      'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
      'wordBreak', 'overflowWrap', 'textAlign', 'marginTop', 'marginBottom'
    ];
    return [preview, ...preview.querySelectorAll('h1, h2, h3, p, li, th, td')].map(element => {
      const style = getComputedStyle(element);
      return Object.fromEntries(properties.map(property => [property, style[property]]));
    });
  });
}

async function selectLanguage(page, language) {
  await page.locator('.lang-select-item[data-lang="' + language + '"]').first()
    .evaluate(element => element.click());
  await expect(page).toHaveURL(language === 'en' ? '/' : '/?lang=' + language);
  await expect(page.locator('html')).toHaveAttribute('lang', language);
}

for (const surface of ['document', 'release notes']) {
  test(`${surface} typography stays consistent when Japanese and Korean are switched in either order`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openApp(page);

    if (surface === 'release notes') {
      await page.locator('#header-about-button').click();
      await page.getByRole('button', { name: 'Show Release Notes' }).click();
      await expect(page.locator('#markdown-preview .release-note-shell')).toBeVisible();
    } else {
      await setEditorContent(page, markdown);
      await expect(page.locator('#markdown-preview').getByRole('heading', { name: 'Details', exact: true })).toBeVisible();
      await expect(page.locator('#markdown-preview')).toContainText('日本語の文章と한국어 문장');
    }

    const baseline = await previewTypography(page);
    const text = await page.locator('#markdown-preview').textContent();

    for (const language of ['ja', 'ko', 'en', 'ko', 'ja', 'en']) {
      await selectLanguage(page, language);
      expect(await previewTypography(page), `Typography after switching to ${language}`).toEqual(baseline);
      await expect(page.locator('#markdown-preview')).toHaveText(text);

      if (surface === 'document') {
        await expect(page.locator('#markdown-editor')).toHaveValue(markdown);
        await page.reload();
        await waitForAppReady(page);
        await expect(page.locator('#markdown-preview').getByRole('heading', { name: 'Details', exact: true })).toBeVisible();
        expect(await previewTypography(page), `Typography after reloading ${language}`).toEqual(baseline);
        await expect(page.locator('#markdown-editor')).toHaveValue(markdown);
      }
    }
  });
}
