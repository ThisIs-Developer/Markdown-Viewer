const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent } = require('../helpers/app');
const C = require('../../sharing-crypto');
const pako = require('pako');

test.describe.configure({ timeout: 180_000 });
let runtime, kv, liveBase;
test.beforeAll(async () => {
  test.setTimeout(120_000);
  runtime = await (await import('../helpers/encrypted-sharing-runtime.mjs')).sharingRuntime();
  kv = await runtime.getKVNamespace('SHARE_KV');
  liveBase = (await runtime.ready).origin + '/live-room';
});
test.afterAll(async () => { await runtime?.dispose(); });

async function localServices(context, writes = []) {
  await context.addInitScript(base => { window.MARKDOWN_VIEWER_LIVE_ROOM_URL = base; }, liveBase);
  await context.route('https://markdownviewer.pages.dev/api/**', async route => {
    const request = route.request();
    if (request.method() === 'POST') writes.push({ url: request.url(), body: request.postDataJSON() });
    const response = await runtime.dispatchFetch(request.url(), { method: request.method(),
      headers: { Origin: 'http://127.0.0.1:4173', 'Content-Type': 'application/json' },
      ...(request.postData() ? { body: request.postData() } : {}) });
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
  });
}
const localLink = (link, base) => base + '/' + new URL(link).hash;

test('stored snapshots keep payloads opaque, require a key, and retain legacy reads', async ({ page, browser, baseURL }) => {
  const writes = [];
  await localServices(page.context(), writes);
  await openApp(page);
  const markdown = '# Opaque snapshot browser fixture\n\n' + 'Private Unicode content हिन्दी 😀. '.repeat(130);
  await setEditorContent(page, markdown);
  await page.locator('#share-button').click();
  await page.locator('#share-mode-edit').check();
  await page.locator('#share-generate-btn').click();
  await expect(page.locator('#share-url-input')).toHaveValue(/#id=s2_.*&key=/);
  const link = await page.locator('#share-url-input').inputValue();
  const params = new URLSearchParams(new URL(link).hash.slice(1));
  const stored = await kv.get('share-v2:' + params.get('id'));
  expect(stored).not.toContain('Opaque snapshot');
  expect(stored).not.toContain(params.get('key'));
  expect(writes[0].body).toEqual({ encrypted: expect.objectContaining({ v: 2, alg: 'A256GCM' }) });
  expect(JSON.stringify(writes)).not.toContain('Private Unicode');
  const recipient = await browser.newContext();
  await localServices(recipient);
  const guest = await recipient.newPage();
  await openApp(guest, localLink(link, baseURL));
  await expect(guest.locator('#markdown-editor')).toHaveValue(markdown);
  const invalid = await recipient.newPage();
  await invalid.addInitScript(() => {
    window.__messages = [];
    new MutationObserver(() => document.querySelectorAll('.app-toast-message').forEach(node => window.__messages.push(node.textContent)))
      .observe(document, { childList: true, subtree: true });
  });
  await openApp(invalid, baseURL + '/#id=' + params.get('id'), { expectEditorVisible: false });
  await expect.poll(() => invalid.evaluate(() => window.__messages.join(' '))).toContain('complete link');
  await expect(invalid.locator('#markdown-preview')).not.toContainText('Opaque snapshot');
  const legacyId = 'abcdefghjk';
  const legacy = JSON.stringify({ content: '# Existing snapshot', title: 'Existing', mode: 'edit', createdAt: Date.now() });
  await kv.put(legacyId, legacy, { expirationTtl: 600 });
  const legacyPage = await recipient.newPage();
  await openApp(legacyPage, baseURL + '/#id=' + legacyId);
  await expect(legacyPage.locator('#markdown-editor')).toHaveValue('# Existing snapshot');
  expect(await kv.get(legacyId)).toBe(legacy);
  const inline = Buffer.from(pako.deflate('# Existing inline')).toString('base64url');
  await legacyPage.goto('about:blank');
  await openApp(legacyPage, baseURL + '/#share=' + inline + '&edit=1');
  await expect(legacyPage.locator('#markdown-editor')).toHaveValue('# Existing inline');
  await expect(page.locator('#share-delete-btn')).toBeVisible();
  await page.locator('#share-delete-btn').click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect.poll(() => kv.get('share-v2:' + params.get('id'))).toBeNull();
  await recipient.close();
});

test('managed uploads decrypt in preview and export without sending the media key', async ({ page, browser, baseURL }) => {
  const writes = [];
  await localServices(page.context(), writes);
  await openApp(page);
  await setEditorContent(page, '');
  const editor = page.locator('#markdown-editor');
  await editor.pressSequentially('/image');
  await editor.press('Enter');
  await page.locator('#image-source-upload').check();
  const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  await page.locator('#image-modal-file').setInputFiles({ name: 'private.gif', mimeType: 'image/gif', buffer: gif });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(editor).toHaveValue(/e2_.*#key=/);
  await expect(page.locator('#markdown-preview img')).toHaveAttribute('src', /^blob:/);
  const markdown = await editor.inputValue();
  const key = markdown.match(/#key=([A-Za-z0-9_-]{43})/)[1];
  expect(JSON.stringify(writes)).not.toContain(key);
  expect(JSON.stringify(writes)).not.toContain(gif.toString('base64'));
  await page.locator('#share-button').click();
  await page.locator('#share-mode-edit').check();
  await page.locator('#share-generate-btn').click();
  await expect(page.locator('#share-url-input')).toHaveValue(/#share=v2/);
  const recipient = await browser.newContext();
  await localServices(recipient);
  const guest = await recipient.newPage();
  await openApp(guest, localLink(await page.locator('#share-url-input').inputValue(), baseURL));
  await expect(guest.locator('#markdown-preview img')).toHaveAttribute('src', /^blob:/);
  await guest.evaluate(() => { window.__exports = []; window.saveAs = async blob => window.__exports.push(await blob.text()); });
  await guest.locator('#export-html').dispatchEvent('click');
  await guest.locator('#html-export-confirm').click();
  await expect.poll(() => guest.evaluate(() => window.__exports.length)).toBe(1);
  const html = await guest.evaluate(() => window.__exports[0]);
  expect(html).toContain('data:image/gif;base64,');
  expect(html).not.toContain(key);
  expect(html).not.toContain('<script');
  expect(html).toContain('Content-Security-Policy');
  await recipient.close();
});

test('encrypted recipients do not automatically fetch external content or remote diagrams', async ({ page, baseURL }) => {
  const requests = [];
  await page.route(/private-resource\.invalid|kroki\.io|plantuml\.com|mermaid\.ink/, async route => { requests.push(route.request().url()); await route.abort(); });
  const key = C.random();
  const content = '# Private rendering\n\n![external](https://private-resource.invalid/pixel)\n\n```plantuml\n@startuml\nAlice -> Bob: private diagram\n@enduml\n```';
  const encrypted = await C.seal({ content, title: 'Private', mode: 'edit' }, key, 'snapshot');
  await openApp(page, baseURL + '/#share=v2.' + C.pack(encrypted) + '&key=' + key);
  await expect(page.locator('#markdown-preview')).toContainText('private diagram');
  await expect(page.locator('#markdown-preview img')).not.toHaveAttribute('src');
  expect(requests).toEqual([]);
});

test('real encrypted relay synchronizes host and editor with content-free wire frames', async ({ page, browser, baseURL }) => {
  const frames = [], urls = [];
  const capture = target => target.on('websocket', socket => {
    urls.push(socket.url()); socket.on('framesent', event => frames.push(String(event.payload)));
  });
  capture(page);
  await localServices(page.context());
  await openApp(page);
  await setEditorContent(page, '# Real encrypted live fixture\n\nHost text.');
  await page.locator('#live-share-button').click();
  await page.locator('input[name="live-share-access-mode"][value="edit"]').check();
  await page.locator('#live-share-display-name').fill('Confidential host name');
  await page.locator('#live-share-start-btn').click();
  await expect(page.locator('#live-share-url-input')).toHaveValue(/#live=room2_/);
  const invite = await page.locator('#live-share-url-input').inputValue();
  await page.locator('#live-share-modal-close-icon').click();
  const recipient = await browser.newContext();
  await localServices(recipient);
  const guest = await recipient.newPage(); capture(guest);
  await openApp(guest, localLink(invite, baseURL));
  await expect(guest.locator('#markdown-editor')).toHaveValue(/Host text/);
  await setEditorContent(guest, '# Real encrypted live fixture\n\nEditor update confidential.');
  await expect(page.locator('#markdown-editor')).toHaveValue(/Editor update confidential/);
  const params = new URLSearchParams(new URL(invite).hash.slice(1));
  expect(urls.every(url => /\?v=2$/.test(url))).toBe(true);
  const wire = frames.join('\n');
  for (const value of ['Host text', 'Confidential host name', 'Editor update confidential', params.get('key'), params.get('sig')]) expect(wire).not.toContain(value);
  expect(frames.some(frame => JSON.parse(frame).type === 'y-update' && JSON.parse(frame).ct)).toBe(true);
  await page.locator('#live-share-button').click();
  await page.locator('#live-share-end-btn').click();
  await expect(guest.locator('#live-share-button')).toHaveAttribute('aria-pressed', 'false');
  await recipient.close();
});
