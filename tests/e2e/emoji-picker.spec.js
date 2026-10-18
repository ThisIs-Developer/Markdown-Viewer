const { test, expect } = require('@playwright/test');
const catalog = require('../../assets/emoji/catalog.json');
const { openApp, setEditorContent, stubClipboard, stubLazyRendererLibraries } = require('../helpers/app');

// Share a local image: these tests exercise the complete catalog and picker behavior.
const imageUrl = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="12" fill="#ffcc33"/></svg>');
const api = Object.fromEntries(catalog.flatMap(entry => entry.aliases.map(alias => [alias, imageUrl])));
api.octocat = imageUrl;

async function prepare(page) {
  await stubLazyRendererLibraries(page);
  await page.addInitScript(() => { window.joypixels = { shortnameToUnicode: text => text }; });
  await page.route('https://api.github.com/emojis', route => route.fulfill({ json: api }));
  await openApp(page);
  await setEditorContent(page, 'Hello world');
}

async function openPicker(page) {
  await page.getByRole('button', { name: 'Insert emoji shortcode', exact: true }).click();
  await expect(page.locator('#emoji-modal-grid')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('option').first()).toBeVisible();
}

function category(page, name) { return page.getByRole('toolbar', { name: 'Emoji categories' }).getByRole('button', { name, exact: true }); }
function emoji(page, shortcode) { return page.locator('#emoji-modal-grid').locator(`[data-shortcode="${shortcode}"]`); }

test('groups every standard emoji, collapses aliases, and preserves GitHub extras', async ({ page }) => {
  // This traverses all ten groups in the complete bundled catalog.
  test.slow();
  await prepare(page);
  await openPicker(page);
  const groups = [
    ['Smileys & emotion', 'smileys'], ['People & body', 'people'], ['Animals & nature', 'nature'],
    ['Food & drink', 'food'], ['Travel & places', 'travel'], ['Activities', 'activities'],
    ['Objects', 'objects'], ['Symbols', 'symbols'], ['Flags', 'flags']
  ];
  for (const [label, id] of groups) {
    await category(page, label).click();
    await expect(page.getByRole('option')).toHaveCount(catalog.filter(entry => entry.category === id).length);
    await expect(category(page, label)).toHaveAttribute('aria-pressed', 'true');
  }
  await category(page, 'GitHub').click();
  await expect(emoji(page, ':octocat:')).toBeVisible();
  await expect(page.getByRole('option')).toHaveCount(1);
  expect(await page.locator('.emoji-category .lucide').evaluateAll(icons => icons.every(icon => getComputedStyle(icon).maskImage !== 'none'))).toBe(true);
});

test('searches all categories by alias, keyword, or Unicode and clears empty results', async ({ page }) => {
  await prepare(page);
  await openPicker(page);
  await category(page, 'GitHub').click();
  await page.locator('#emoji-modal-search').fill(':thumbsup:');
  await expect(emoji(page, ':thumbsup:')).toBeVisible();
  await expect(page.getByRole('option')).toHaveCount(1);
  await page.locator('#emoji-modal-search').fill('happy');
  await expect(emoji(page, ':smile:')).toBeVisible();
  await page.locator('#emoji-modal-search').fill('🍕');
  await expect(emoji(page, ':pizza:')).toBeVisible();
  await page.locator('#emoji-modal-search').fill('zzzz-no-such-emoji');
  await expect(page.getByText('No emojis found.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(emoji(page, ':octocat:')).toBeVisible();
});

test('keeps selections across categories and searches, copies and inserts in selection order', async ({ page }) => {
  await prepare(page);
  await page.locator('#markdown-editor').evaluate(editor => { editor.focus(); editor.setSelectionRange(6, 11); });
  await stubClipboard(page);
  await openPicker(page);
  await emoji(page, ':smile:').click();
  await category(page, 'Food & drink').click();
  await emoji(page, ':pizza:').click();
  await page.locator('#emoji-modal-search').fill(':thumbsup:');
  await emoji(page, ':thumbsup:').click();
  await page.locator('#emoji-modal-search').fill('zzzz');
  await expect(page.locator('#emoji-modal-selection-count')).toHaveText('3 selected');
  await page.getByRole('button', { name: 'Remove :pizza:', exact: true }).click();
  await page.getByRole('button', { name: 'Copy selected emojis', exact: true }).click();
  expect(await page.evaluate(() => window.__copiedText)).toBe(':smile: :thumbsup:');
  await page.locator('#emoji-modal-insert').click();
  await expect(page.locator('#markdown-editor')).toHaveValue('Hello :smile: :thumbsup:');
  await expect(page.locator('#emoji-modal')).toBeHidden();
  await openPicker(page);
  await expect(page.locator('#emoji-modal-insert')).toBeDisabled();
  await expect(page.locator('#emoji-modal-selection')).toBeHidden();
});

test('supports arrow navigation, selection, focus trapping and Escape', async ({ page }) => {
  await prepare(page);
  await openPicker(page);
  await expect(page.locator('#emoji-modal-search')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(category(page, 'Smileys & emotion')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(category(page, 'People & body')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option').first()).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('option').nth(1)).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(page.getByRole('option').last()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#emoji-modal-selection-count')).toHaveText('2 selected');
  await page.locator('#emoji-modal-insert').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#emoji-modal .modal-close-btn')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#emoji-modal')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Insert emoji shortcode', exact: true })).toBeFocused();
});

test('retains typed search while loading, ignores closed requests, and retries failures', async ({ page }) => {
  await prepare(page);
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  let requests = 0;
  await page.route('**/assets/emoji/catalog.json', async route => {
    requests++;
    if (requests === 1) { await pending; return route.fulfill({ status: 503, body: 'Unavailable' }); }
    return route.fulfill({ json: catalog });
  });
  await page.getByRole('button', { name: 'Insert emoji shortcode', exact: true }).click();
  await page.locator('#emoji-modal-search').fill('pizza');
  await page.keyboard.press('Escape');
  await expect(page.locator('#emoji-modal')).toBeHidden();
  release();
  await openPicker(page);
  await expect(page.locator('#emoji-modal-category-title')).toHaveText('Smileys & emotion');
  await page.keyboard.press('Escape');
  // A fresh page is needed because successful data is cached for this page session.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true');
  let resolveApi;
  const apiPending = new Promise(resolve => { resolveApi = resolve; });
  let apiRequests = 0;
  await page.route('https://api.github.com/emojis', async route => {
    apiRequests++;
    if (apiRequests === 1) { await apiPending; return route.fulfill({ status: 503, body: 'Unavailable' }); }
    if (apiRequests === 2) return route.fulfill({ json: {} });
    return route.fulfill({ json: api });
  });
  await page.getByRole('button', { name: 'Insert emoji shortcode', exact: true }).click();
  await page.locator('#emoji-modal-search').fill('pizza');
  resolveApi();
  await expect(page.getByText('Unable to load emojis.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('option')).toHaveCount(1);
  await expect(emoji(page, ':pizza:')).toBeVisible();
});

test('fits narrow screens and keeps touch targets and footer visible in both themes', async ({ page }) => {
  await prepare(page);
  for (const [width, height, theme] of [[320, 568, 'light'], [320, 568, 'dark'], [667, 375, 'light']]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme);
    await openPicker(page);
    await category(page, 'Flags').click();
    await expect(category(page, 'Flags')).toBeInViewport();
    await page.getByRole('option').first().click();
    await expect(page.locator('#emoji-modal-insert')).toBeInViewport();
    const dimensions = await page.locator('#emoji-modal .app-modal-box').evaluate(box => ({
      width: box.getBoundingClientRect().width, scrollWidth: box.scrollWidth, clientWidth: box.clientWidth,
      top: box.getBoundingClientRect().top, bottom: box.getBoundingClientRect().bottom,
      targets: Array.from(box.querySelectorAll('.emoji-item, .emoji-selection-chip')).filter(el => el.getClientRects().length).map(el => el.getBoundingClientRect().height)
    }));
    expect(dimensions.width).toBeLessThanOrEqual(width - 24);
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    expect(dimensions.top).toBeGreaterThanOrEqual(0);
    expect(dimensions.bottom).toBeLessThanOrEqual(height);
    expect(Math.min(...dimensions.targets)).toBeGreaterThanOrEqual(44);
    await page.keyboard.press('Escape');
    await expect(page.locator('#emoji-modal')).toBeHidden();
  }
});
