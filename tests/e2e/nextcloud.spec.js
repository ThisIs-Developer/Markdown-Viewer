const {test,expect}=require('@playwright/test');
const {openApp,storedDocuments}=require('../helpers/app');
const {installDesktopFilesystem}=require('../helpers/desktop-filesystem');
const {setup,openConnections,cloudMenu,cloudAction,base,root}=require('../helpers/cloud-workspace');

test('Connect, edit, conditional Save and no persisted credentials', async ({ page }) => {
  await setup(page);
  await page.locator('#markdown-editor').fill('# Personal draft');
  await cloudAction(page, 'Save to cloud');
  await expect(page.locator('#nextcloud-status')).toHaveText('Saved to Nextcloud.');
  await expect(page.locator('#markdown-preview')).toContainText('Personal draft');
  await page.screenshot({ path: test.info().outputPath('nextcloud-ui.png') });
  expect(await page.evaluate(() => __cloud.content)).toBe('# Personal draft');
  expect(await page.evaluate(() => __cloud.requests.find(request => request.method === 'PUT').headers['If-Match'])).toBe('"v1"');
  const persisted = await page.evaluate(async () => {
    await MarkdownViewerFlushWorkspace();
    const storage = new MarkdownWorkspaceStorage();
    await storage.init();
    return JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, documents: await storage.listDocumentMetadata() });
  });
  expect(persisted).not.toContain('app-secret');
  expect(persisted).not.toContain('poll-secret');
  expect(persisted).toContain('remoteSource');
});

test('upload confirmation can cancel without any network write', async ({ page }) => {
  await setup(page);
  await page.locator('#markdown-editor').fill('# Confirm this draft');
  await cloudMenu(page);
  await page.locator('.document-menu-dropdown.open').getByRole('menuitem',{name:'Save to cloud',exact:true}).click();
  await expect(page.locator('#linked-confirm-modal')).toBeVisible();
  await expect(page.locator('#linked-confirm-modal-title')).toHaveText('Save to cloud?');
  await expect(page.locator('#linked-confirm-modal-cancel')).toBeFocused();
  expect(await page.evaluate(() => __cloud.requests.some(r => r.method === 'PUT'))).toBe(false);
  await page.screenshot({path:test.info().outputPath('cloud-upload-confirm.png')});
  await page.locator('#linked-confirm-modal-cancel').click();
  await expect(page.locator('#markdown-editor')).toHaveValue('# Confirm this draft');
  expect(await page.evaluate(() => __cloud.requests.some(r => r.method === 'PUT'))).toBe(false);
});

test('upload refuses edits made during confirmation', async ({ page }) => {
  await setup(page);
  await page.locator('#markdown-editor').fill('# First version');
  await cloudMenu(page);
  await page.locator('.document-menu-dropdown.open').getByRole('menuitem',{name:'Save to cloud',exact:true}).click();
  await expect(page.locator('#linked-confirm-modal-cancel')).toBeFocused();
  await page.locator('#markdown-editor').fill('# Newer version');
  await page.locator('#linked-confirm-modal-confirm').click();
  await expect(page.locator('#nextcloud-status')).toContainText('Nothing was uploaded');
  expect(await page.evaluate(() => __cloud.requests.some(r => r.method === 'PUT'))).toBe(false);
  await expect(page.locator('#markdown-editor')).toHaveValue('# Newer version');
});

test('cloud badges distinguish a local draft, a verified save and an offline source', async ({ page }) => {
  await setup(page);
  const badge = page.locator('#nextcloud-panel .cloud-file-badge');
  await expect(badge).toHaveText('Saved');
  await page.locator('#markdown-editor').fill('# Local changes');
  await expect(badge).toHaveText('Draft');
  await expect(badge).toHaveAttribute('title',/not been uploaded/);
  await expect(page.locator('.document-tree-load-more')).toHaveCount(0);
  await cloudAction(page,'Save to cloud');
  await expect(badge).toHaveText('Saved');
  await openConnections(page);
  await page.getByRole('button',{name:'Disconnect',exact:true}).click();
  await expect(badge).toHaveText('Offline');
  await expect(page.locator('#nextcloud-panel')).toBeVisible();
});

test('account disclosure and sidebar visibility persist without disconnecting or losing drafts', async ({ page }) => {
  await setup(page,{secure:true});
  await page.locator('#markdown-editor').fill('# Keep draft');
  await page.getByRole('button',{name:'Account options for alice',exact:true}).click();
  await expect(page.getByRole('menuitem',{name:'Reconnect',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Collapse personal-cloud.example',exact:true}).click();
  await expect(page.locator('.cloud-account-children')).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button',{name:'Expand personal-cloud.example',exact:true})).toBeVisible();
  await expect(page.locator('.cloud-account-children')).toBeHidden();
  await page.getByRole('button',{name:'Expand personal-cloud.example',exact:true}).click();
  await expect(page.locator('.cloud-account-children')).toBeVisible();
  await page.locator('.nextcloud-heading').dispatchEvent('contextmenu',{clientX:130,clientY:300});
  await page.getByRole('menuitem',{name:'Hide from Explorer',exact:true}).click();
  await expect(page.locator('#nextcloud-panel')).toBeHidden();
  await page.reload();
  await expect(page.locator('#nextcloud-panel')).toBeHidden();
  await openConnections(page);
  await expect(page.locator('#cloud-sidebar-visible')).not.toBeChecked();
  await expect(page.locator('#nextcloud-server')).toBeFocused();
  await page.screenshot({path:test.info().outputPath('cloud-connections.png')});
  await page.locator('#cloud-sidebar-visible').check();
  await page.getByRole('button',{name:'Close cloud connections',exact:true}).click();
  await expect(page.locator('#nextcloud-panel')).toBeVisible();
  await expect(page.locator('#markdown-editor')).toHaveValue('# Keep draft');
  expect(await page.evaluate(() => __cloud.requests.some(r => r.method === 'PUT'))).toBe(false);
});

test('cloud sort keeps folders first and changes file order without changing server files', async ({ page }) => {
  await setup(page,{secure:true});
  await page.evaluate(() => __cloud.listing = ['zeta.md','alpha.md','Folder/']);
  await page.getByRole('button',{name:'Refresh',exact:true}).click();
  const names = () => page.locator('.nextcloud-entries > [data-nextcloud-href]').allTextContents();
  await expect.poll(names).toEqual(['Folder','alpha.md','zeta.md']);
  await page.getByRole('button',{name:'Sort cloud files',exact:true}).click();
  await page.getByRole('menuitem',{name:'Name Z–A',exact:true}).click();
  await expect.poll(names).toEqual(['Folder','zeta.md','alpha.md']);
  expect(await page.evaluate(() => __cloud.requests.some(r => ['PUT','MOVE','DELETE'].includes(r.method)))).toBe(false);
});
test('competing server edit preserves draft and opens server copy separately', async ({ page }) => {
  await setup(page);
  await page.locator('#markdown-editor').fill('# My draft');
  await page.evaluate(() => { __cloud.content = '# Other device'; __cloud.etag = '"external"'; });
  await cloudAction(page, 'Save to cloud');
  await expect(page.locator('#nextcloud-status')).toContainText('server file changed');
  await expect(page.locator('.cloud-file-badge')).toHaveText('Conflict');
  await expect(page.locator('#markdown-editor')).toHaveValue('# My draft');
  expect(await page.evaluate(() => __cloud.content)).toBe('# Other device');
  await cloudAction(page, 'Check server version');
  await expect(page.locator('#markdown-editor')).toHaveValue('# Other device');
  await page.locator('#tab-list .tab-item').filter({ hasText: 'notes.md' }).filter({ hasNotText: 'cloud version' }).click();
  await expect(page.locator('#markdown-editor')).toHaveValue('# My draft');
  await cloudAction(page, 'Resolve using my draft');
  await page.locator('#linked-confirm-modal-confirm').click();
  await expect(page.locator('#nextcloud-status')).toContainText('Next Save will update');
  await cloudAction(page, 'Save to cloud');
  await expect(page.locator('#nextcloud-status')).toHaveText('Saved to Nextcloud.');
  expect(await page.evaluate(() => __cloud.content)).toBe('# My draft');
});
test('folder parser bounds entries and rejects foreign-account hrefs or XML entities', async ({ page }) => {
  await setup(page);
  const result = await page.evaluate(({ root }) => {
    const wrap = href => '<d:multistatus xmlns:d="DAV:"><d:response><d:href>' + href + '</d:href></d:response></d:multistatus>';
    const rejected = xml => { try { MarkdownNextcloud.parseListing(xml, root, root); return false; } catch (_) { return true; } };
    return [rejected(wrap('https://evil.example/a.md')), rejected('<!DOCTYPE x [<!ENTITY e "x">]>' + wrap(root + 'a.md')),
      rejected('<d:multistatus xmlns:d="DAV:">' + '<d:response/>'.repeat(1002) + '</d:multistatus>')];
  }, { root });
  expect(result).toEqual([true, true, true]);
});
test('lost response blocks blind retry; server check reconciles the completed upload', async ({ page }) => {
  await setup(page);
  await page.locator('#markdown-editor').fill('# Uploaded but reply lost');
  await page.evaluate(() => __cloud.mode = 'lost');
  await cloudAction(page, 'Save to cloud');
  await expect(page.locator('#nextcloud-status')).toContainText('unknown');
  await expect(page.locator('.cloud-file-badge')).toHaveText('Check save');
  await cloudAction(page, 'Save to cloud');
  await expect(page.locator('#nextcloud-status')).toContainText('before saving again');
  expect(await page.evaluate(() => __cloud.requests.filter(request => request.method === 'PUT').length)).toBe(1);
  await cloudAction(page, 'Check server version');
  await expect(page.locator('#nextcloud-status')).toContainText('Server version checked');
  await expect(page.locator('#markdown-editor')).toHaveValue('# Uploaded but reply lost');
});
test('disconnect and reload retain the draft without restoring session credentials', async ({ page }) => {
  await setup(page);
  await page.locator('#markdown-editor').fill('# Offline draft');
  await openConnections(page);
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await page.evaluate(() => MarkdownViewerFlushWorkspace());
  await page.reload();
  await expect(page.locator('#markdown-editor')).toHaveValue('# Offline draft');
  await cloudMenu(page);
  await expect(page.locator('.document-menu-dropdown.open').getByRole('menuitem', { name:'Save to cloud', exact:true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.locator('#save-status-text')).toContainText('disconnected');
  expect(await page.evaluate(() => __cloud.requests.length)).toBe(0);
});
for (const headerMode of ['weak', 'missing']) {
  test('uses verified DAV file version when GET ETag is ' + headerMode, async ({ page }) => {
    await setup(page, { headerMode });
    await page.locator('#markdown-editor').fill('# Saved with DAV version');
    await cloudAction(page, 'Save to cloud');
    await expect(page.locator('#nextcloud-status')).toHaveText('Saved to Nextcloud.');
    const requests = await page.evaluate(() => __cloud.requests);
    expect(requests.some(request => request.method === 'PROPFIND' && request.headers.Depth === '0')).toBe(true);
    expect(requests.find(request => request.method === 'PUT').headers['If-Match']).toBe('"v1"');
    expect(requests.some(request => request.method === 'GET' && request.headers['If-Match'] === '"v1"')).toBe(true);
  });
}
test('DAV fallback rejects a competing edit during conditional read', async ({ page }) => {
  await setup(page, { headerMode: 'weak' });
  const outcome = await page.evaluate(async ({ base, root }) => {
    __cloud.mode = 'read-race';
    const client = new MarkdownNextcloud.Client(base, MarkdownCloudPlatform.create().request, {}, 'alice');
    try { await client.read(root + 'notes.md'); return 'accepted'; }
    catch (error) { return error.code; }
  }, { base, root });
  expect(outcome).toBe('CONFLICT');
  expect(await page.evaluate(() => __cloud.requests.filter(request => request.method === 'PUT').length)).toBe(0);
});
test('repairs an older draft with missing ETag only when the original content still matches', async ({ page }) => {
  await setup(page, { headerMode: 'weak', legacySnapshot: true });
  await page.locator('#markdown-editor').fill('# Kept from old preview');
  await cloudAction(page, 'Save to cloud');
  await expect(page.locator('#nextcloud-status')).toHaveText('Saved to Nextcloud.');
  expect(await page.evaluate(() => __cloud.content)).toBe('# Kept from old preview');
});
test('does not adopt a new baseline for an older draft when server content changed', async ({ page }) => {
  await setup(page, { headerMode: 'weak', legacySnapshot: true });
  await page.locator('#markdown-editor').fill('# My older draft');
  await page.evaluate(() => { __cloud.content = '# Someone else'; __cloud.etag = '"external"'; });
  await cloudAction(page, 'Save to cloud');
  await expect(page.locator('#nextcloud-status')).toContainText('server file changed');
  await expect(page.locator('#markdown-editor')).toHaveValue('# My older draft');
  expect(await page.evaluate(() => __cloud.requests.filter(request => request.method === 'PUT').length)).toBe(0);
});
test('Nextcloud shares Explorer layout in dark mode and survives sidebar redraws', async ({ page }) => {
  await setup(page, { headerMode: 'weak' });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.locator('#markdown-editor').fill('# Dark mode draft');
  await page.evaluate(() => MarkdownViewerFlushWorkspace());
  await expect(page.locator('#document-tree > #nextcloud-panel')).toHaveCount(1);
  await expect(page.locator('.nextcloud-document')).toHaveCount(0);
  await expect(page.locator('#save-status-text')).toContainText('Ctrl+S uploads to cloud');
  const overflows = await page.locator('#nextcloud-panel').evaluate(panel => panel.scrollWidth > panel.clientWidth);
  expect(overflows).toBe(false);
  await expect(page.locator('#markdown-preview')).toContainText('Dark mode draft');
  await page.screenshot({ path: test.info().outputPath('nextcloud-dark.png') });
  await page.locator('#nextcloud-panel').screenshot({ path: test.info().outputPath('nextcloud-panel-dark.png') });
  await page.locator('#nextcloud-panel').getByRole('button', { name: 'Cloud Workspace', exact: true }).click();
  await expect(page.locator('#nextcloud-body')).toBeHidden();
});
test('desktop Ctrl+S routes to Nextcloud and concurrent typing stays a draft', async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await setup(page);
  await page.locator('#markdown-editor').fill('# Snapshot to upload');
  await page.evaluate(() => __cloud.mode = 'slow');
  await page.locator('#markdown-editor').dispatchEvent('keydown', { key: 'σ', code: 'KeyS', ctrlKey: true });
  await page.locator('#linked-confirm-modal-confirm').click();
  await expect.poll(() => page.evaluate(() => Boolean(__cloud.finishPut))).toBe(true);
  await expect(page.locator('.cloud-file-badge')).toHaveText('Saving');
  await page.locator('#markdown-editor').fill('# New typing during upload');
  await page.evaluate(() => __cloud.finishPut());
  await expect(page.locator('#nextcloud-status')).toContainText('newer edits remain in your draft');
  expect(await page.evaluate(() => __cloud.content)).toBe('# Snapshot to upload');
  await expect(page.locator('#markdown-editor')).toHaveValue('# New typing during upload');
  await expect(page.locator('#save-status-text')).toContainText('Ctrl+S uploads to cloud');
  await expect(page.locator('.cloud-file-badge')).toHaveText('Draft');
});
test('remembered account and selected folder restore automatically without another login', async ({ page }) => {
  await setup(page, { secure: true });
  await expect(page.locator('.cloud-account-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Add current folder to Cloud Workspace', exact: true }).click();
  await expect(page.locator('.cloud-folders').getByRole('button', { name: 'Files', exact: true })).toBeVisible();
  await page.locator('#markdown-editor').fill('# Remembered draft');
  await page.evaluate(() => MarkdownViewerFlushWorkspace());
  await page.reload();
  await expect(page.locator('#nextcloud-panel .nextcloud-entries')).toBeVisible();
  await expect(page.locator('#markdown-editor')).toHaveValue('# Remembered draft');
  await expect(page.locator('.cloud-folders').getByRole('button', { name: 'Files', exact: true })).toBeVisible();
  const requests = await page.evaluate(() => __cloud.requests);
  expect(requests.some(request => request.url.includes('/login/v2'))).toBe(false);
  expect(requests.every(request => Boolean(request.credentialId))).toBe(true);
  const persisted = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
  expect(persisted).not.toContain('app-secret');
  expect(persisted).not.toContain('poll-secret');
  await page.screenshot({ path: test.info().outputPath('cloud-workspace.png') });
});
test('forgetting a remembered account keeps drafts and stops automatic reconnection', async ({ page }) => {
  await setup(page, { secure: true });
  await page.locator('#markdown-editor').fill('# Keep this local draft');
  await openConnections(page);
  await page.getByRole('button', { name: 'Forget account', exact: true }).click();
  await page.locator('#linked-confirm-modal-confirm').click();
  await expect(page.locator('.cloud-account-row')).toHaveCount(0);
  await page.evaluate(() => MarkdownViewerFlushWorkspace());
  await page.reload();
  await expect(page.locator('#markdown-editor')).toHaveValue('# Keep this local draft');
  await openConnections(page);
  await expect(page.getByRole('button', { name: 'Connect to Nextcloud', exact: true })).toBeVisible();
  expect(await page.evaluate(() => __cloud.requests.length)).toBe(0);
});
test('removing a selected folder only changes Cloud Workspace shortcuts', async ({ page }) => {
  await setup(page, { secure: true });
  await page.getByRole('button', { name: 'Add current folder to Cloud Workspace', exact: true }).click();
  await page.getByRole('button', { name: 'Remove folder Files from workspace', exact: true }).click();
  await expect(page.locator('.cloud-folder-row')).toHaveCount(0);
  expect(await page.evaluate(() => __cloud.requests.some(request => ['DELETE', 'MOVE'].includes(request.method)))).toBe(false);
  await expect(page.locator('#markdown-editor')).toHaveValue('# Original');
});
test('Cloud Workspace keeps multiple accounts distinct and restores the last one', async ({ page }) => {
  await setup(page, { secure: true });
  await openConnections(page);
  await page.evaluate(() => __cloud.loginUser = 'bob');
  await page.locator('#nextcloud-server').fill(base);
  await page.getByRole('button', { name: 'Connect to Nextcloud', exact: true }).click();
  await expect(page.locator('.cloud-account-row')).toHaveCount(2);
  await expect(page.locator('.cloud-account-row.is-active')).toContainText('bob');
  await page.reload();
  await expect(page.locator('.cloud-account-row')).toHaveCount(2);
  await expect(page.locator('.cloud-account-row.is-active')).toContainText('bob');
  await page.locator('.cloud-account-row').filter({ hasText: 'Nextcloud · alice' }).click();
  await expect(page.locator('.cloud-account-row.is-active')).toContainText('alice');
  await expect(page.locator('#nextcloud-panel .nextcloud-entries')).toBeVisible();
  expect(await page.evaluate(() => __cloud.requests.some(request => request.url.includes('/login/v2')))).toBe(false);
});
test('cloud documents stay out of Vault and use their own physical recovery directory', async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await setup(page);
  await page.locator('#markdown-editor').fill('# Separate cloud draft');
  const records = await page.evaluate(async () => {
    await MarkdownViewerFlushWorkspace(); const storage = new MarkdownWorkspaceStorage(); await storage.init(); return storage.listDocumentMetadata();
  });
  const cloud = records.find(item => item.remoteSource);
  expect(cloud._vaultRelativePath).toMatch(/^Cloud Workspace\//);
  expect(await page.evaluate(path => __desktopFiles.get('C:/Documents/Markdown Viewer Vault/' + path),cloud._vaultRelativePath)).toBe('# Separate cloud draft');
  await expect(page.locator('#document-tree [data-tree-type="workspace"][data-tree-id="workspace_default"] .document-tree-meta')).toHaveText('1');
  await expect(page.locator('#nextcloud-panel [data-cloud-document]')).toHaveCount(1);
  await expect(page.locator('.nextcloud-document')).toHaveCount(0);
});
test('Create Vault copy makes an independent local document and keeps the cloud draft', async ({ page }) => {
  await setup(page); const sourceId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
  await page.locator('#markdown-editor').fill('# Copy this draft');
  await cloudAction(page,'Create Vault copy');
  await expect(page.locator('#tab-list .tab-item.active')).not.toHaveAttribute('data-tab-id',sourceId);
  await expect(page.locator('#markdown-editor')).toHaveValue('# Copy this draft');
  const records = await page.evaluate(async () => { await MarkdownViewerFlushWorkspace(); const s = new MarkdownWorkspaceStorage(); await s.init(); return s.listDocumentMetadata(); });
  const copies = records.filter(item => item.title === 'notes.md');
  expect(copies).toHaveLength(2); expect(copies.filter(item => item.remoteSource)).toHaveLength(1);
  expect(await page.evaluate(() => __cloud.content)).toBe('# Original');
});
test('cloud reload defaults to Keep draft and cancellation changes nothing', async ({ page }) => {
  await setup(page); await page.locator('#markdown-editor').fill('# Keep me');
  await cloudAction(page,'Reload from cloud');
  await expect(page.locator('#linked-confirm-modal-cancel')).toBeFocused();
  await page.locator('#linked-confirm-modal-cancel').click();
  await expect(page.locator('#markdown-editor')).toHaveValue('# Keep me');
});
test('cloud reload keeps a detached cloud recovery copy before replacing a draft', async ({ page }) => {
  await setup(page); await page.locator('#markdown-editor').fill('# Before reload');
  await page.evaluate(() => { __cloud.content = '# Server version'; __cloud.etag = '"external"'; });
  await cloudAction(page,'Reload from cloud'); await page.locator('#linked-confirm-modal-confirm').click();
  await expect(page.locator('#markdown-editor')).toHaveValue('# Server version');
  const saved = await page.evaluate(async () => { await MarkdownViewerFlushWorkspace(); const s = new MarkdownWorkspaceStorage(); await s.init(); const items = await s.listDocumentMetadata(); const backup = items.find(item => item.title.endsWith('(before reload)')); return { backup, content:backup && await s.loadDocumentContent(backup.id) }; });
  expect(saved.backup.kind).toBe('cloud-recovery'); expect(saved.backup.remoteSource).toBeUndefined(); expect(saved.content).toBe('# Before reload');
});
for (const race of ['draft','server']) test('cloud reload refuses a ' + race + ' change made while confirmation is open', async ({ page }) => {
  await setup(page); await page.locator('#markdown-editor').fill('# My draft'); await cloudAction(page,'Reload from cloud');
  await expect(page.locator('#linked-confirm-modal-confirm')).toBeVisible();
  await page.evaluate(race => {
    if (race === 'draft') { const editor = document.getElementById('markdown-editor'); editor.value = '# New typing'; editor.dispatchEvent(new Event('input',{bubbles:true})); }
    else { __cloud.content = '# New external version'; __cloud.etag = '"raced"'; }
  },race);
  await page.locator('#linked-confirm-modal-confirm').click();
  await expect(page.locator('#nextcloud-status')).toContainText('Nothing was replaced');
  await expect(page.locator('#markdown-editor')).toHaveValue(race === 'draft' ? '# New typing' : '# My draft');
});
test('removing a cloud draft requires approval and preserves its body in Trash', async ({ page }) => {
  await setup(page); const id = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
  await page.locator('#markdown-editor').fill('# Preserve in Trash'); await cloudAction(page,'Remove from Cloud Workspace');
  await expect(page.locator('#linked-confirm-modal-cancel')).toBeFocused(); await page.locator('#linked-confirm-modal-confirm').click();
  await expect(page.locator('#nextcloud-panel [data-cloud-document="' + id + '"]')).toHaveCount(0);
  const content = await page.evaluate(async id => { const s = new MarkdownWorkspaceStorage(); await s.init(); return (await s.listTrash()).find(item => item.documentId === id || item.metadata?.id === id)?.content; },id);
  expect(content).toBe('# Preserve in Trash');
  expect(await page.evaluate(() => __cloud.requests.some(request => request.method === 'DELETE'))).toBe(false);
});
test('a new edit during cloud removal confirmation cancels removal', async ({ page }) => {
  await setup(page); await page.locator('#markdown-editor').fill('# Initial draft'); await cloudAction(page,'Remove from Cloud Workspace');
  await page.evaluate(() => { const e = document.getElementById('markdown-editor'); e.value = '# Late edit'; e.dispatchEvent(new Event('input',{bubbles:true})); });
  await page.locator('#linked-confirm-modal-confirm').click();
  await expect(page.locator('.app-toast').filter({hasText:'Nothing was removed'})).toBeVisible();
  await expect(page.locator('#markdown-editor')).toHaveValue('# Late edit');
});
for (const mode of ['denied-read','missing-read']) test('cloud ' + mode + ' keeps the draft and indicates an unavailable source', async ({ page }) => {
  await setup(page); await page.locator('#markdown-editor').fill('# Keep offline'); await page.evaluate(mode => __cloud.mode = mode,mode);
  await cloudAction(page,'Check server version');
  await expect(page.locator('#save-status-text')).toContainText('source unavailable');
  await expect(page.locator('#markdown-editor')).toHaveValue('# Keep offline');
  expect(await page.evaluate(() => __cloud.requests.some(request => request.method === 'PUT'))).toBe(false);
});

test('unused cloud and opening cloud settings do not start the helper',async({page})=>{
  await setup(page,{secure:true,connect:false});
  expect(await page.evaluate(()=>__helperStarts)).toBe(0);
  expect(await page.evaluate(()=>__helperCalls)).toEqual([]);
  await openConnections(page);
  await expect(page.locator('#cloud-enabled')).not.toBeChecked();
  expect(await page.evaluate(()=>__helperStarts)).toBe(0);
});
test('disabling cloud stops the helper and preserves drafts and remembered access',async({page})=>{
  await setup(page,{secure:true});
  await page.locator('#markdown-editor').fill('# Disabled cloud draft');
  await page.evaluate(()=>window.MarkdownViewerFlushWorkspace());
  await openConnections(page);await page.locator('#cloud-enabled').uncheck();
  await expect.poll(()=>page.evaluate(()=>__helperStopped)).toBe(true);
  await expect(page.locator('#cloud-enabled')).not.toBeChecked();
  await page.reload();await openConnections(page);
  expect(await page.evaluate(()=>__helperStarts)).toBe(0);
  await page.getByRole('button',{name:'Load remembered accounts',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>__helperStarts)).toBe(1);
  await expect(page.locator('.cloud-settings-account')).toContainText('alice');
  await page.getByRole('button',{name:'Close cloud connections',exact:true}).click();
  await expect(page.locator('#markdown-editor')).toHaveValue('# Disabled cloud draft');
  expect(await page.evaluate(()=>__cloud.requests.some(item=>item.method==='PUT'))).toBe(false);
});
test('automatic reconnect can be disabled without forgetting the account',async({page})=>{
  await setup(page,{secure:true});await openConnections(page);await page.locator('#cloud-auto-connect').uncheck();
  await page.reload();await openConnections(page);
  expect(await page.evaluate(()=>__helperStarts)).toBe(0);
  await expect(page.locator('#cloud-auto-connect')).not.toBeChecked();
  await page.getByRole('button',{name:'Load remembered accounts',exact:true}).click();
  await expect(page.locator('.cloud-settings-account')).toContainText('alice');
});
test('seeing the old server content does not silently clear an unconfirmed upload',async({page})=>{
  await setup(page);await page.locator('#markdown-editor').fill('# Unconfirmed local draft');
  await page.evaluate(()=>__cloud.mode='lost-before-write');await cloudAction(page,'Save to cloud');
  await expect(page.locator('#nextcloud-status')).toContainText('unknown');
  await page.evaluate(()=>__cloud.mode='');await cloudAction(page,'Check server version');
  await expect(page.locator('#nextcloud-status')).toContainText('still unconfirmed');
  await page.locator('#tab-list .tab-item').filter({hasText:'notes.md'}).filter({hasNotText:'cloud version'}).click();
  const writes=await page.evaluate(()=>__cloud.requests.filter(item=>item.method==='PUT').length);
  await cloudAction(page,'Save to cloud');
  expect(await page.evaluate(()=>__cloud.requests.filter(item=>item.method==='PUT').length)).toBe(writes);
});

async function chooseCloudSave(page) {
  await cloudMenu(page);await page.locator('.document-menu-dropdown.open').getByRole('menuitem',{name:'Save to cloud',exact:true}).click();
}
async function createFromCurrentFolder(page,name) {
  await cloudAction(page,'New Markdown file');
  await expect(page.locator('#document-name-modal')).toBeVisible();
  await page.locator('#document-name-modal-input').fill(name);
  await page.locator('#document-name-modal-confirm').click();
}
test('context-only New Markdown file creates .md without replacing the existing draft',async({page})=>{
  await setup(page);await page.locator('#markdown-editor').fill('# Keep the original draft');
  await expect(page.locator('#nextcloud-panel .nextcloud-tools').getByRole('button',{name:'New Markdown file',exact:true})).toHaveCount(0);
  await createFromCurrentFolder(page,'New note');
  await expect(page.locator('#nextcloud-status')).toContainText('Created New note.md');
  await expect(page.locator('#markdown-editor')).toHaveValue('');
  expect(await page.evaluate(({root})=>__cloud.files[root+'New%20note.md'].content,{root})).toBe('');
  await page.evaluate(()=>window.MarkdownViewerFlushWorkspace());
  const records=await storedDocuments(page);
  expect(records.find(item=>item.title==='notes.md').content).toBe('# Keep the original draft');
  expect(records.find(item=>item.title==='New note.md').remoteSource.status).toBe('saved');
  expect(await page.evaluate(()=>__cloud.requests.find(item=>item.method==='PUT').headers)).toEqual({'If-None-Match':'*'});
});
test('new filename validation and cancellation do not create remote files',async({page})=>{
  await setup(page);await cloudAction(page,'New Markdown file');
  await page.locator('#document-name-modal-input').fill('../bad.md');await page.locator('#document-name-modal-confirm').click();
  await expect(page.locator('#document-name-modal-error')).toContainText('valid Markdown filename');
  await page.locator('#document-name-modal-input').fill('bad.txt');await page.locator('#document-name-modal-confirm').click();
  await expect(page.locator('#document-name-modal-error')).toContainText('Only .md');
  await page.locator('#document-name-modal-cancel').click();
  expect(await page.evaluate(()=>__cloud.requests.some(item=>item.method==='PUT'))).toBe(false);
});
test('occupied new filename never overwrites or changes the cached draft',async({page})=>{
  await setup(page);await page.locator('#markdown-editor').fill('# Keep this draft');
  await createFromCurrentFolder(page,'notes.md');
  await expect(page.locator('#nextcloud-status')).toContainText('A local document already exists');
  expect(await page.evaluate(()=>__cloud.requests.some(item=>item.method==='PUT'))).toBe(false);
  await expect(page.locator('#markdown-editor')).toHaveValue('# Keep this draft');
});
test('creation name race leaves a detached local recovery without overwriting server data',async({page})=>{
  await setup(page);await page.evaluate(()=>__cloud.mode='create-race');
  await createFromCurrentFolder(page,'race.md');
  await expect(page.locator('#nextcloud-status')).toContainText('A file already exists with this name');
  await page.evaluate(()=>window.MarkdownViewerFlushWorkspace());
  const recovered=(await storedDocuments(page)).find(item=>item.title==='race.md');
  expect(recovered.kind).toBe('cloud-recovery');expect(recovered.remoteSource).toBeUndefined();
  expect(await page.evaluate(()=>__cloud.content)).toBe('# Original');
});
test('delete always confirms, leaves a local recovery copy, and does not delete a folder',async({page})=>{
  await setup(page);await page.locator('#markdown-editor').fill('# Recovery survives delete');
  await cloudAction(page,'Delete from cloud');
  await expect(page.locator('#linked-confirm-modal-title')).toHaveText('Delete from cloud?');
  await expect(page.locator('#linked-confirm-modal-checkbox-label')).toBeHidden();
  await page.locator('#linked-confirm-modal-cancel').click();
  expect(await page.evaluate(()=>__cloud.requests.some(item=>item.method==='DELETE'))).toBe(false);
  await cloudAction(page,'Delete from cloud');await page.locator('#linked-confirm-modal-confirm').click();
  await expect(page.locator('#nextcloud-status')).toContainText('Your local recovery copy was kept');
  await expect(page.locator('#markdown-editor')).toHaveValue('# Recovery survives delete');
  await page.evaluate(()=>window.MarkdownViewerFlushWorkspace());
  const recovered=(await storedDocuments(page)).find(item=>item.title==='notes.md');
  expect(recovered.kind).toBe('cloud-recovery');expect(recovered.remoteSource).toBeUndefined();
  expect(await page.evaluate(()=>__cloud.notesDeleted)).toBe(true);
});
test('delete cancellation on concurrent local edits preserves both server and newest draft',async({page})=>{
  await setup(page);await cloudAction(page,'Delete from cloud');
  await page.locator('#markdown-editor').evaluate(editor=>{editor.value='# Changed during delete confirmation';editor.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#linked-confirm-modal-confirm').click();
  await expect(page.locator('#nextcloud-status')).toContainText('draft changed');
  expect(await page.evaluate(()=>__cloud.requests.some(item=>item.method==='DELETE'))).toBe(false);
  await expect(page.locator('#markdown-editor')).toHaveValue('# Changed during delete confirmation');
});
test('delete server conflict preserves the local draft and remote file',async({page})=>{
  await setup(page);await page.locator('#markdown-editor').fill('# Conflict draft');
  await cloudAction(page,'Delete from cloud');await page.evaluate(()=>__cloud.mode='delete-race');
  await page.locator('#linked-confirm-modal-confirm').click();
  await expect(page.locator('#nextcloud-status')).toContainText('server file changed');
  expect(await page.evaluate(()=>__cloud.notesDeleted)).toBe(false);
  await expect(page.locator('#markdown-editor')).toHaveValue('# Conflict draft');
});
test('lost delete reply requires a server check and never repeats deletion',async({page})=>{
  await setup(page);await page.locator('#markdown-editor').fill('# Pending deletion draft');
  await page.evaluate(()=>__cloud.mode='lost-delete');await cloudAction(page,'Delete from cloud');
  await page.locator('#linked-confirm-modal-confirm').click();
  await expect(page.locator('#nextcloud-status')).toContainText('Deletion is unconfirmed');
  await cloudAction(page,'Check server version');
  await expect(page.locator('#nextcloud-status')).toContainText('Server deletion confirmed');
  await expect(page.locator('#markdown-editor')).toHaveValue('# Pending deletion draft');
  expect(await page.evaluate(()=>__cloud.requests.filter(item=>item.method==='DELETE').length)).toBe(1);
});
test('collection named .md is refused before delete confirmation or DELETE',async({page})=>{
  await setup(page);await page.evaluate(()=>__cloud.mode='collection');await cloudAction(page,'Delete from cloud');
  await expect(page.locator('#nextcloud-status')).toContainText('Cannot determine the file version');
  await expect(page.locator('#linked-confirm-modal')).toBeHidden();
  expect(await page.evaluate(()=>__cloud.requests.some(item=>item.method==='DELETE'))).toBe(false);
});
test('save opt-out is accepted-only, persists per account, and never suppresses delete confirmation',async({page})=>{
  await setup(page,{secure:true});await page.locator('#markdown-editor').fill('# First save');
  await chooseCloudSave(page);await page.locator('#linked-confirm-modal-checkbox').check();await page.locator('#linked-confirm-modal-cancel').click();
  await chooseCloudSave(page);await expect(page.locator('#linked-confirm-modal')).toBeVisible();
  await page.locator('#linked-confirm-modal-checkbox').check();await page.locator('#linked-confirm-modal-confirm').click();
  await expect(page.locator('#nextcloud-status')).toHaveText('Saved to Nextcloud.');
  await page.locator('#markdown-editor').fill('# Second save');await chooseCloudSave(page);
  await expect(page.locator('#nextcloud-status')).toHaveText('Saved to Nextcloud.');await expect(page.locator('#linked-confirm-modal')).toBeHidden();
  await cloudAction(page,'Delete from cloud');await expect(page.locator('#linked-confirm-modal-title')).toHaveText('Delete from cloud?');
  await page.locator('#linked-confirm-modal-cancel').click();
  await page.reload();await page.evaluate(()=>{__cloud.content='# Second save';__cloud.etag='"v2"';});
  await page.locator('#markdown-editor').fill('# Third save');await chooseCloudSave(page);
  await expect(page.locator('#nextcloud-status')).toHaveText('Saved to Nextcloud.');await expect(page.locator('#linked-confirm-modal')).toBeHidden();
  await openConnections(page);await page.evaluate(()=>{__cloud.loginUser='bob';__cloud.content='# Bob baseline';});await page.locator('#nextcloud-server').fill(base);
  await page.getByRole('button',{name:'Connect to Nextcloud',exact:true}).click();
  await page.locator('#nextcloud-panel .nextcloud-entry[data-nextcloud-href]').filter({hasText:'notes.md'}).click();
  await expect(page.locator('#markdown-editor')).toHaveValue('# Bob baseline');
  await page.locator('#markdown-editor').fill('# Bob needs confirmation');await chooseCloudSave(page);
  await expect(page.locator('#linked-confirm-modal')).toBeVisible();await page.locator('#linked-confirm-modal-cancel').click();
});

test('a new Markdown file can be created inside a folder using only its context menu',async({page})=>{
  await setup(page);await page.evaluate(()=>__cloud.listing=['Subfolder/']);
  await page.locator('#nextcloud-panel').getByRole('button',{name:'Refresh',exact:true}).click();
  const folder=page.locator('#nextcloud-panel .nextcloud-entry.is-folder');
  await folder.dispatchEvent('contextmenu',{clientX:140,clientY:350});
  await page.locator('.document-menu-dropdown.open').getByRole('menuitem',{name:'New Markdown file',exact:true}).click();
  await page.locator('#document-name-modal-input').fill('Inside.md');await page.locator('#document-name-modal-confirm').click();
  await expect(page.locator('#nextcloud-status')).toContainText('Created Inside.md');
  expect(await page.evaluate(({root})=>Object.keys(__cloud.files),{root})).toContain(root+'Subfolder/Inside.md');
});
test('unconfirmed creation survives restart and a server check preserves newer local edits',async({page})=>{
  await setup(page,{secure:true});await page.evaluate(()=>__cloud.mode='lost-create');
  await createFromCurrentFolder(page,'Pending.md');await expect(page.locator('#nextcloud-status')).toContainText('creation is unconfirmed');
  await page.locator('#markdown-editor').fill('# Newer local content');await page.evaluate(()=>window.MarkdownViewerFlushWorkspace());
  await page.reload();await page.evaluate(({root})=>{__cloud.files[root+'Pending.md']={content:'',etag:'"created"'};},{root});
  await cloudAction(page,'Check server version');await expect(page.locator('#nextcloud-status')).toContainText('Server version checked');
  await expect(page.locator('#markdown-editor')).toHaveValue('# Newer local content');
  expect(await page.evaluate(()=>__cloud.requests.some(item=>item.method==='PUT'))).toBe(false);
});
test('unconfirmed deletion intent survives restart and resolves absence without repeating DELETE',async({page})=>{
  await setup(page,{secure:true});await page.locator('#markdown-editor').fill('# Durable deletion recovery');
  await page.evaluate(()=>__cloud.mode='lost-delete');await cloudAction(page,'Delete from cloud');await page.locator('#linked-confirm-modal-confirm').click();
  await expect(page.locator('#nextcloud-status')).toContainText('Deletion is unconfirmed');
  await page.reload();await page.evaluate(()=>__cloud.notesDeleted=true);
  await cloudAction(page,'Check server version');await expect(page.locator('#nextcloud-status')).toContainText('Server deletion confirmed');
  await expect(page.locator('#markdown-editor')).toHaveValue('# Durable deletion recovery');
  expect(await page.evaluate(()=>__cloud.requests.some(item=>item.method==='DELETE'))).toBe(false);
});

test('failed durable creation draft prevents any remote create and keeps existing edits',async({page})=>{
  await setup(page);await page.locator('#markdown-editor').fill('# Existing edits must survive');
  await page.evaluate(()=>{
    const prototype=window.MarkdownWorkspaceStorage.prototype;
    const original=prototype.saveDocuments;
    prototype.saveDocuments=async function(documents,...args){
      if(documents.some(item=>item.remoteSource?.creationPending))throw new Error('synthetic storage failure');
      return original.call(this,documents,...args);
    };
  });
  await createFromCurrentFolder(page,'CannotCommit.md');
  await expect(page.locator('#nextcloud-status')).toContainText('local recovery draft could not be saved');
  expect(await page.evaluate(()=>__cloud.requests.some(item=>item.method==='PUT'))).toBe(false);
  await expect(page.locator('#markdown-editor')).toHaveValue('# Existing edits must survive');
});

test('cloud connection setup offers Nextcloud and WebDAV with Nextcloud selected by default',async({page})=>{
 await setup(page,{connect:false});await openConnections(page);
 await expect(page.locator('#cloud-provider option')).toHaveCount(2);
 await expect(page.locator('#cloud-provider')).toHaveValue('nextcloud');
 await expect(page.locator('#cloud-provider')).toBeEnabled();
 await expect(page.getByRole('button',{name:'Connect to Nextcloud',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>__helperStarts)).toBe(0);
 await page.screenshot({path:test.info().outputPath('cloud-provider-settings.png'),animations:'disabled'});
});

test('shared workspace renders a test-only provider with opaque references and read-only capabilities',async({page})=>{
 await setup(page,{connect:false});
 await page.evaluate(()=>{
  const identity={label:'Synthetic cloud',userLabel:'Alice',detail:'Test only · Alice',key:'synthetic-key',id:'test-account'};
  const normalizeSource=value=>({...value,providerId:'synthetic',accountKey:identity.key});
  const source=(ref,version='',fields={})=>normalizeSource({fileRef:ref,version,...fields});
  const client={providerId:'synthetic',account:identity,root:'opaque-root',capabilities:{read:true,list:true},identify:async()=>{},accountId:()=>identity.id,disconnect(){},
   validateRef:ref=>ref,validateFile:ref=>ref,folderRef:ref=>ref,locationLabel:()=> 'Chosen folder',source,
   list:async()=>[{ref:'opaque-file-123',name:'Read only.md',directory:false}],read:async()=>({content:'# Opaque provider document',version:{revision:7}})
  };
  MarkdownCloudProviders.register({id:'synthetic',label:'Synthetic',connectionFields:[{id:'endpoint',label:'Test connection'}],connectionNote:'Test only.',
   normalizeSource,serializeSource:normalizeSource,describeSource:()=>identity.label,recoveryIdentity:()=>({accountName:identity.label,accountIdentity:identity.key,folders:[]}),connect:async()=>client,restore:async()=>client});
 });
 await openConnections(page);
 await page.locator('#cloud-provider').selectOption('synthetic');
 await page.locator('#cloud-endpoint').fill('test');
 await page.locator('#nextcloud-remember').uncheck();
 await page.getByRole('button',{name:'Connect to Synthetic',exact:true}).click();
 await expect(page.locator('.cloud-account-row.is-active')).toContainText('Synthetic cloud');
 await page.locator('[data-nextcloud-href="opaque-file-123"]').click();
 await expect(page.locator('#markdown-editor')).toHaveValue('# Opaque provider document');
 await cloudMenu(page);
 const menu=page.locator('.document-menu-dropdown.open');
 for(const name of ['Save to cloud','New Markdown file','Delete from cloud'])await expect(menu.getByRole('menuitem',{name,exact:true})).toBeDisabled();
 await expect(menu.getByRole('menuitem',{name:'Check server version',exact:true})).toBeEnabled();
 expect(await page.evaluate(()=>__cloud.requests.filter(item=>['PUT','DELETE'].includes(item.method)).length)).toBe(0);
});
