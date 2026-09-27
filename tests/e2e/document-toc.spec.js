const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent, stubClipboard } = require('../helpers/app');

async function openOutline(page) {
  await page.locator('#document-outline-toggle').click();
  await expect(page.locator('#document-outline')).toBeVisible();
}

async function copiedText(page) {
  await page.locator('#document-outline-copy').click();
  return page.evaluate(() => window.__copiedText);
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await stubClipboard(page);
});

test('copies current headings with default depth, formatting and duplicate anchors, including collapsed groups', async ({ page }) => {
  await setEditorContent(page, '---\ntitle: Metadata\n---\n# Overview\n## Overview\n### **🚀 Getting Started**\n#### Привет 你好\n##### Hidden depth\n## Overview\n\n~~~md\n## Hidden code\n~~~');
  await openOutline(page);
  await expect(page.locator('#document-outline-list .document-outline-link')).toHaveCount(6);
  await page.locator('#document-outline-collapse-all').click();
  expect(await copiedText(page)).toBe('- [Overview](#overview-1)\n  - [🚀 Getting Started](#-getting-started)\n    - [Привет 你好](#привет-你好)\n- [Overview](#overview-2)');
  await expect(page.locator('#document-outline-copy i')).toHaveClass('lucide lucide-check');
  const ids = await page.locator('#markdown-preview h1, #markdown-preview h2, #markdown-preview h3, #markdown-preview h4').evaluateAll(nodes => nodes.map(node => node.id));
  expect(ids).toEqual(['overview', 'overview-1', '-getting-started', 'привет-你好', 'overview-2']);
});

test('settings expose range, formats, normalization and the details wrapper', async ({ page }) => {
  await setEditorContent(page, '# Title\n## Parent\n#### Child\n##### Deep\n###### Deeper\n## Next');
  await openOutline(page);
  await page.locator('#document-outline-settings-toggle').click();
  await expect(page.locator('#document-outline-min-level')).toBeFocused();
  await expect(page.locator('#document-outline-min-level')).toHaveValue('2');
  await expect(page.locator('#document-outline-max-level')).toHaveValue('4');
  expect(await copiedText(page)).toBe('- [Parent](#parent)\n    - [Child](#child)\n- [Next](#next)');
  await page.locator('#document-outline-normalize').check();
  await page.locator('#document-outline-format').selectOption('numbered');
  expect(await copiedText(page)).toBe('1. [Parent](#parent)  \n  1.1 [Child](#child)  \n2. [Next](#next)');
  await page.locator('#document-outline-collapsible').check();
  expect(await copiedText(page)).toBe('<details>\n<summary>Table of Contents</summary>\n\n1. [Parent](#parent)  \n  1.1 [Child](#child)  \n2. [Next](#next)\n\n</details>');
  await page.locator('#document-outline-format').selectOption('plain');
  await expect(page.locator('#document-outline-collapsible')).toBeDisabled();
  expect(await copiedText(page)).toBe('Parent\n  Child\nNext');
  await page.locator('#document-outline-min-level').selectOption('1');
  await page.locator('#document-outline-max-level').selectOption('6');
  expect(await copiedText(page)).toBe('Title\n  Parent\n    Child\n      Deep\n        Deeper\n  Next');
  await page.locator('#document-outline-copy').press('Escape');
  await expect(page.locator('#document-outline-settings')).toBeHidden();
  await expect(page.locator('#document-outline-settings-toggle')).toBeFocused();
  await expect(page.locator('#document-outline')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#document-outline')).toBeHidden();
});

test('empty ranges disable copy and range changes remain valid', async ({ page }) => {
  await setEditorContent(page, '# Title only');
  await openOutline(page);
  await expect(page.locator('#document-outline-copy')).toBeDisabled();
  await page.locator('#document-outline-settings-toggle').click();
  await expect(page.locator('#document-outline-copy-empty')).toBeVisible();
  await page.locator('#document-outline-min-level').selectOption('1');
  expect(await copiedText(page)).toBe('- [Title only](#title-only)');
  await page.locator('#document-outline-min-level').selectOption('6');
  await expect(page.locator('#document-outline-max-level')).toHaveValue('6');
  await expect(page.locator('#document-outline-copy')).toBeDisabled();
  await page.locator('#document-outline-max-level').selectOption('1');
  await expect(page.locator('#document-outline-min-level')).toHaveValue('1');
  await setEditorContent(page, 'No headings\n\n~~~md\n## Code\n~~~');
  await expect(page.locator('#document-outline-empty')).toBeVisible();
  await expect(page.locator('#document-outline-copy')).toBeDisabled();
});

test('copy uses the latest editor text even before its preview refreshes', async ({ page }) => {
  await setEditorContent(page, '## Old section');
  await openOutline(page);
  await expect(page.locator('#document-outline-copy')).toBeEnabled();
  await page.evaluate(() => {
    const editor = document.getElementById('markdown-editor');
    editor.value = '## New section\n## New section';
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('document-outline-copy').click();
  });
  await expect.poll(() => page.evaluate(() => window.__copiedText)).toBe('- [New section](#new-section)\n- [New section](#new-section-1)');
});

test('close and settings buttons do not retain a hover background on keyboard focus', async ({ page }) => {
  await setEditorContent(page, '## Section');
  await openOutline(page);
  await page.locator('#document-outline-title').hover();
  await expect(page.locator('#document-outline-close')).toBeFocused();
  await expect(page.locator('#document-outline-close')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await page.locator('#document-outline-settings-toggle').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(page.locator('#document-outline-settings-toggle')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('#document-outline-settings-toggle')).not.toHaveAttribute('aria-pressed');
});

test('large documents use matching IDs in worker segments and copied links', async ({ page }) => {
  const filler = Array.from({ length: 90 }, (_, index) => `Paragraph ${index} ${'worker filler '.repeat(70)}`).join('\n\n');
  await setEditorContent(page, '# Overview\n## 🚀 Getting Started\n## Overview\n\n' + filler + '\n\n## Overview\n## `*Code*` &amp; <b>More</b>');
  await openOutline(page);
  await expect(page.locator('#markdown-preview .preview-render-block')).not.toHaveCount(0);
  await expect(page.locator('#document-outline-list .document-outline-link')).toHaveCount(5);
  expect(await copiedText(page)).toBe('- [🚀 Getting Started](#-getting-started)\n- [Overview](#overview-1)\n- [Overview](#overview-2)\n- [\\*Code\\* \\& More](#code--more)');
  const ids = await page.locator('#markdown-preview h2').evaluateAll(nodes => nodes.map(node => node.id));
  expect(ids).toEqual(['-getting-started', 'overview-1', 'overview-2', 'code--more']);
});

test('translated settings fit a narrow panel and keep Markdown output in the document language', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.locator('.lang-select-item[data-lang="de"]').first().evaluate(button => button.click());
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await setEditorContent(page, '## Introduction\n### Background');
  await openOutline(page);
  await page.locator('#document-outline-settings-toggle').click();
  await expect(page.locator('#document-outline-copy')).toHaveAttribute('title', 'Inhaltsverzeichnis kopieren');
  expect(await copiedText(page)).toBe('- [Introduction](#introduction)\n  - [Background](#background)');
  for (const selector of ['.document-outline-header', '#document-outline-settings']) {
    expect(await page.locator(selector).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
});

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 320, height: 740 },
]) {
  test(`copy settings and H1–H6 outline remain usable in all modes on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const longHeading = 'Long heading '.repeat(30).trim();
    const markdown = '# Title\n## Two\n### Three\n#### Four\n##### Five\n###### ' + longHeading;
    for (const mode of ['editor', 'preview', 'split']) {
      await page.locator(`[data-view-mode="${mode}"]`).evaluate(button => button.click());
      await setEditorContent(page, markdown);
      await openOutline(page);
      await expect(page.locator('#document-outline-list .document-outline-link')).toHaveCount(6);
      if (await page.locator('#document-outline-settings').isHidden()) await page.locator('#document-outline-settings-toggle').click();
      await page.locator('#document-outline-min-level').selectOption('1');
      await page.locator('#document-outline-max-level').selectOption('6');
      const result = await copiedText(page);
      expect(result.split('\n')).toHaveLength(6);
      expect(result).toContain('          - [' + longHeading + ']');
      for (const selector of ['.document-outline-header', '.document-outline-body', '#document-outline-settings']) {
        expect(await page.locator(selector).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      }
      for (const id of ['copy', 'settings-toggle', 'collapse-all', 'close']) {
        await expect(page.locator('#document-outline-' + id)).toBeInViewport();
      }
      await page.locator('#document-outline-close').click();
      await expect(page.locator('.content-container')).toHaveClass(new RegExp('view-' + (mode === 'split' ? 'split' : mode + '-only')));
    }
  });
}
