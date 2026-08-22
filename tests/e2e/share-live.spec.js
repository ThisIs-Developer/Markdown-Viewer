const { test, expect } = require('@playwright/test');
const {
  fixture,
  openApp,
  setEditorContent,
  storedDocuments,
  stubLiveShareRuntime
} = require('../helpers/app');

function localizeAppLink(url, baseURL) {
  const parsed = new URL(url);
  return `${baseURL}/${parsed.hash}`;
}

async function selectLiveReviewText(page, selector, text) {
  await page.locator(selector).evaluate((element, selectedText) => {
    const node = Array.from(element.childNodes).find(child => (
      child.nodeType === Node.TEXT_NODE && child.nodeValue.includes(selectedText)
    ));
    if (!node) throw new Error('Review selection text not found');
    const start = node.nodeValue.indexOf(selectedText);
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, start + selectedText.length);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }, text);
}

test('Share Snapshot creates a view-only hash link that opens without permanent tab persistence', async ({ browser, page, baseURL }) => {
  await openApp(page);
  await setEditorContent(page, await fixture('share.md'));

  await page.locator('#share-button').click();
  await expect(page.locator('#share-modal')).toHaveClass(/is-visible/);
  await page.locator('#share-generate-btn').click();
  await expect(page.locator('#share-url-input')).toHaveValue(/#share=/);

  const generatedUrl = await page.locator('#share-url-input').inputValue();
  const sharedContext = await browser.newContext();
  const sharedPage = await sharedContext.newPage();
  await openApp(sharedPage, localizeAppLink(generatedUrl, baseURL), { expectEditorVisible: false });

  await expect(sharedPage.locator('.content-container')).toHaveClass(/view-preview-only/);
  await expect(sharedPage.locator('#markdown-editor')).toHaveJSProperty('readOnly', true);
  await expect(sharedPage.locator('#markdown-preview')).toContainText('This text should survive a snapshot round trip.');
  await expect(sharedPage.locator('#toggle-sync')).toBeDisabled();
  await expect(sharedPage.locator('#toggle-sync')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

  const formatMenuToggles = sharedPage.locator('#markdown-format-toolbar [data-toolbar-menu-toggle]');
  await expect(formatMenuToggles).toHaveCount(3);
  await expect(sharedPage.locator('#markdown-format-toolbar [data-toolbar-menu-toggle]:not(:disabled)')).toHaveCount(0);
  await expect(sharedPage.locator('[data-toolbar-menu-toggle="heading"]')).toHaveCSS('opacity', '0.4');
  await expect(sharedPage.locator('[data-toolbar-menu-toggle="case"]')).toHaveCSS('opacity', '0.4');

  const storedTabs = JSON.stringify(await storedDocuments(sharedPage));
  expect(storedTabs).not.toContain('This text should survive a snapshot round trip.');

  await sharedContext.close();
});

test('Share Snapshot edit links open with editable source', async ({ browser, page, baseURL }) => {
  await openApp(page);
  await setEditorContent(page, await fixture('share.md'));

  await page.locator('#share-button').click();
  await page.locator('#share-mode-edit').check();
  await page.locator('#share-generate-btn').click();
  await expect(page.locator('#share-url-input')).toHaveValue(/edit=1/);

  const generatedUrl = await page.locator('#share-url-input').inputValue();
  const sharedContext = await browser.newContext();
  const sharedPage = await sharedContext.newPage();
  await openApp(sharedPage, localizeAppLink(generatedUrl, baseURL));

  await expect(sharedPage.locator('.content-container')).toHaveClass(/view-split/);
  await expect(sharedPage.locator('#markdown-editor')).toHaveJSProperty('readOnly', false);
  await expect(sharedPage.locator('#markdown-editor')).toHaveValue(/Share Snapshot Fixture/);

  await sharedContext.close();
});

test('Live Share host and guest can use a local mocked view-only room', async ({ browser, page, baseURL }) => {
  await stubLiveShareRuntime(page);
  await openApp(page);
  await setEditorContent(page, '# Live Share Local Mock\n\nHost content.');

  await page.locator('#live-share-button').click();
  await page.locator('input[name="live-share-access-mode"][value="view"]').check();
  await page.locator('#live-share-display-name').fill('Host');
  await page.locator('#live-share-start-btn').click();

  await expect(page.locator('#live-share-status-text')).toContainText(/Connected|Room active|waiting/i);
  await expect(page.locator('#live-share-access-label')).toContainText('View only');
  await expect(page.locator('#live-share-url-input')).toHaveValue(/#live=/);
  const inviteUrl = await page.locator('#live-share-url-input').inputValue();
  expect(inviteUrl).toContain('access=view');
  expect(inviteUrl).toContain('role=view');

  const guestPage = await page.context().newPage();
  await stubLiveShareRuntime(guestPage);
  await openApp(guestPage, localizeAppLink(inviteUrl, baseURL));

  await expect(guestPage.locator('#live-share-button')).toHaveAttribute('aria-pressed', 'true');
  await expect(guestPage.locator('#live-share-status-text')).toContainText(/Connected|Room active|waiting/i);

  await page.locator('#live-share-end-btn').click();
  await expect(page.locator('#live-share-status-text')).toContainText(/No live room active|Ending/i);

  await guestPage.close();
});

test('Live Share synchronizes Review feedback with view-only participants', async ({ browser, page, baseURL }) => {
  const markdown = '# Live review sync\n\nParagraph for shared feedback.';
  await stubLiveShareRuntime(page);
  await openApp(page);
  await setEditorContent(page, markdown);

  await page.locator('#live-share-button').click();
  await page.locator('input[name="live-share-access-mode"][value="view"]').check();
  await page.locator('#live-share-display-name').fill('Host');
  await page.locator('#live-share-start-btn').click();
  await expect(page.locator('#live-share-url-input')).toHaveValue(/#live=/);
  const inviteUrl = await page.locator('#live-share-url-input').inputValue();
  await page.locator('#live-share-modal-close-icon').click();

  const guestPage = await page.context().newPage();
  await stubLiveShareRuntime(guestPage);
  await openApp(guestPage, localizeAppLink(inviteUrl, baseURL));
  await expect(guestPage.locator('#markdown-preview h1')).toHaveText('Live review sync');
  await expect(guestPage.locator('#markdown-editor')).toHaveJSProperty('readOnly', true);

  await guestPage.locator('#live-share-button').click();
  await guestPage.locator('#live-share-display-name').fill('Guest reviewer');
  await guestPage.locator('#live-share-modal-close-icon').click();
  await guestPage.locator('#review-toggle').click();
  await selectLiveReviewText(guestPage, '#markdown-preview h1', 'Live review sync');
  await guestPage.locator('#review-new-comment').click();
  await guestPage.locator('#review-feedback-input').fill('Participant comment for the host.');
  await guestPage.locator('#review-feedback-submit').click();

  await expect(page.locator('#review-toolbar-count')).toHaveText('1');
  await page.locator('#review-toggle').click();
  await expect(page.locator('.review-thread')).toContainText('Participant comment for the host.');
  await selectLiveReviewText(page, '#markdown-preview p', 'shared feedback');
  await page.locator('#review-new-comment').click();
  await page.locator('#review-feedback-input').fill('Host comment for the participant.');
  await page.locator('#review-feedback-submit').click();

  await expect(guestPage.locator('#review-toolbar-count')).toHaveText('2');
  await expect(page.locator('.review-thread')).toHaveCount(2);
  await expect(page.locator('.review-thread').filter({ hasText: 'Participant comment for the host.' })).toBeVisible();
  await expect(guestPage.locator('.review-thread').filter({ hasText: 'Host comment for the participant.' })).toBeVisible();

  const participantComment = page.locator('.review-thread').filter({ hasText: 'Participant comment for the host.' });
  await expect(participantComment.locator('.review-author-name').first()).toHaveText('Guest reviewer');
  await expect(guestPage.locator('.review-thread').filter({ hasText: 'Host comment for the participant.' }).locator('.review-author-name').first()).toHaveText('Host');

  await guestPage.locator('#live-share-button').click();
  await guestPage.locator('#live-share-display-name').fill('Guest reviewer renamed');
  await guestPage.locator('#live-share-modal-close-icon').click();
  await expect(participantComment.locator('.review-author-name').first()).toHaveText('Guest reviewer renamed');

  await participantComment.locator('[data-review-action="toggle-resolved"]').click();
  await expect(guestPage.locator('#review-toolbar-count')).toHaveText('1');
  await guestPage.locator('[data-review-filter="resolved"]').click();
  await expect(guestPage.locator('.review-thread')).toContainText('Participant comment for the host.');
  await guestPage.locator('.review-thread').click();
  await expect(guestPage.locator('.review-thread-dates')).toContainText('Closed:');
  await expect(guestPage.locator('.review-thread-dates')).not.toContainText('Closed: Not closed');

  await guestPage.locator('[data-review-filter="open"]').click();
  await guestPage.locator('.review-thread').filter({ hasText: 'Host comment for the participant.' }).locator('[data-review-action="delete"]').click();
  await guestPage.locator('#review-delete-confirm').click();
  await page.locator('[data-review-filter="all"]').click();
  await expect(page.locator('.review-thread')).toHaveCount(1);
  await expect(page.locator('.review-thread')).toContainText('Participant comment for the host.');
  await expect.poll(() => page.locator('#markdown-editor').inputValue()).toBe(markdown);

  await page.locator('#live-share-button').click();
  await page.locator('#live-share-end-btn').click();
  await guestPage.close();
});
