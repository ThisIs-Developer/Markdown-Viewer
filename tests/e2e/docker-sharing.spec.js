const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent } = require('../helpers/app');
const { installSharingServices, serviceOrigin } = require('../helpers/sharing-services');

test.skip(process.env.MARKDOWN_VIEWER_TEST_CONTAINER !== '1',
  'Sharing acceptance must exercise the actual Docker response headers.');
const hosted = process.env.MARKDOWN_VIEWER_TEST_HOSTED_SHARING === '1';

function localLink(link, baseURL) {
  return baseURL + '/' + new URL(link).hash;
}

test('Docker security headers permit the hosted sharing API, relay and Yjs library', async ({ request }) => {
  const response = await request.get('/');
  const csp = response.headers()['content-security-policy'];
  const directives = Object.fromEntries(csp.split(';').map(part => {
    const [name, ...sources] = part.trim().split(/\s+/);
    return [name, sources];
  }));
  expect(directives['script-src']).toContain('https://esm.sh');
  expect(directives['connect-src']).toEqual(expect.arrayContaining([
    serviceOrigin, 'wss://markdownviewer.pages.dev', 'https://esm.sh'
  ]));
  expect(directives['connect-src']).not.toContain('*');
});

test('Docker opens an embedded snapshot without a storage API request', async ({ page, context, baseURL }) => {
  const services = hosted ? null : await installSharingServices(context);
  await openApp(page);
  const content = '# Docker embedded snapshot\n\nSynthetic acceptance content.';
  await setEditorContent(page, content);
  await page.locator('#share-button').click();
  await page.locator('#share-generate-btn').click();
  await expect(page.locator('#share-url-input')).toHaveValue(/#share=/);
  const link = await page.locator('#share-url-input').inputValue();
  const guest = await context.newPage();
  await openApp(guest, localLink(link, baseURL), { expectEditorVisible: false });
  await expect(guest.locator('#markdown-preview')).toContainText('Synthetic acceptance content.');
  await expect(guest.locator('#markdown-editor')).toHaveJSProperty('readOnly', true);
  if (services) expect(services.requests).toEqual([]);
});

for (const mode of ['view', 'edit']) {
  test(`Docker creates and opens a stored ${mode} snapshot through the sharing API`, async ({ page, context, baseURL }) => {
    test.setTimeout(hosted ? 120_000 : 60_000);
    const services = hosted ? null : await installSharingServices(context);
    await openApp(page);
    const content = '# Docker stored snapshot\n\n' + 'Synthetic Docker acceptance text. '.repeat(120);
    await setEditorContent(page, content);
    let record;
    page.on('response', async response => {
      if (response.url() === serviceOrigin + '/api/share' && response.request().method() === 'POST' && response.ok()) {
        record = await response.json();
      }
    });
    try {
      await page.locator('#share-button').click();
      await page.locator('#share-mode-' + mode).check();
      const created = page.waitForResponse(response => response.url() === serviceOrigin + '/api/share' &&
        response.request().method() === 'POST');
      await page.locator('#share-generate-btn').click();
      const response = await created;
      expect(response.status()).toBe(201);
      record = await response.json();
      await expect(page.locator('#share-url-input')).toHaveValue(/#id=/);
      const link = await page.locator('#share-url-input').inputValue();
      const guest = await context.newPage();
      const violations = [];
      guest.on('console', message => {
        if (/Content Security Policy|violates.*directive/i.test(message.text())) violations.push(message.text());
      });
      await openApp(guest, localLink(link, baseURL), { expectEditorVisible: mode === 'edit' });
      await expect(guest.locator('#markdown-editor')).toHaveValue(content);
      await expect(guest.locator('#markdown-editor')).toHaveJSProperty('readOnly', mode === 'view');
      await expect(guest.locator('#markdown-preview')).toContainText('Docker stored snapshot');
      expect(violations).toEqual([]);
      if (services) expect(services.requests.some(request => request.method === 'GET')).toBe(true);
    } finally {
      if (record?.id && record?.deleteToken) {
        const status = await page.evaluate(async ({ origin, record }) => {
          const response = await fetch(origin + '/api/share/' + record.id, {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deleteToken: record.deleteToken })
          });
          return response.status;
        }, { origin: serviceOrigin, record });
        expect(status, 'Delete only the synthetic snapshot created by this test').toBe(200);
      }
    }
  });
}

for (const mode of ['view', 'edit']) {
  test(`Docker Live Share synchronizes a real Yjs ${mode} guest and ends the session`, async ({ page, context, baseURL }) => {
    test.setTimeout(hosted ? 150_000 : 90_000);
    const services = hosted ? null : await installSharingServices(context);
    const violations = [];
    const runtimeErrors = [];
    function captureErrors(participant) {
      participant.on('pageerror', error => runtimeErrors.push(error.message));
      participant.on('console', message => {
        if (/Content Security Policy|violates.*directive/i.test(message.text())) violations.push(message.text());
        if (/Live Share .*failed:|Failed to (fully close live session|broadcast live session end):/i.test(message.text())) {
          runtimeErrors.push(message.text());
        }
      });
    }
    context.on('page', captureErrors);
    captureErrors(page);
    await openApp(page);
    const initial = '# Docker Live Share\n\nSynthetic host text.';
    await setEditorContent(page, initial);
    let guest;
    let endRequested = false;
    try {
      await page.locator('#live-share-button').click();
      await page.locator('input[name="live-share-access-mode"][value="' + mode + '"]').check();
      await page.locator('#live-share-display-name').fill('Docker test host');
      await page.locator('#live-share-start-btn').click();
      await expect(page.locator('#live-share-status-text')).toContainText(/Connected|Room active|waiting/i);
      await expect(page.locator('#live-share-url-input')).toHaveValue(/#live=/);
      const invite = new URL(await page.locator('#live-share-url-input').inputValue());
      // Remove the initial document seed: receiving host content must use the
      // actual WebSocket/Yjs synchronization, not merely decode the invite.
      const params = new URLSearchParams(invite.hash.slice(1));
      params.delete('seed');
      invite.hash = params.toString();
      await page.locator('#live-share-modal-close-icon').click();
      guest = await context.newPage();
      // Hosted acceptance also proves Docker-to-public-web interoperability.
      await openApp(guest, hosted && mode === 'view' ? invite.href : localLink(invite.href, baseURL));
      await expect(guest.locator('#markdown-editor')).toHaveValue(initial);
      await expect(guest.locator('#markdown-editor')).toHaveJSProperty('readOnly', mode === 'view');
      const updated = initial + '\n\nHost update after the guest joined.';
      await setEditorContent(page, updated);
      await expect(guest.locator('#markdown-editor')).toHaveValue(updated);
      if (mode === 'edit') {
        const reply = updated + '\n\nGuest edit returned to host.';
        await setEditorContent(guest, reply);
        await expect(page.locator('#markdown-editor')).toHaveValue(reply);
      }
      expect(violations).toEqual([]);
      if (services) {
        expect(services.connections).toHaveLength(2);
        expect(services.connections.map(url => url.searchParams.get('role')).sort()).toEqual([mode, 'host'].sort());
      }
      await page.locator('#live-share-button').click();
      await page.locator('#live-share-end-btn').click();
      endRequested = true;
      await expect(guest.locator('#live-share-button')).toHaveAttribute('aria-pressed', 'false');
      // The host allows its end message to drain before disconnecting.
      await expect(page.locator('#live-share-button')).toHaveAttribute('aria-pressed', 'false');
      expect(runtimeErrors).toEqual([]);
    } finally {
      if (!endRequested && await page.locator('#live-share-button').getAttribute('aria-pressed') === 'true') {
        if (!await page.locator('#live-share-end-btn').isVisible()) await page.locator('#live-share-button').click();
        await page.locator('#live-share-end-btn').click();
        await expect(page.locator('#live-share-button')).toHaveAttribute('aria-pressed', 'false');
      }
    }
  });
}

