const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

const gif = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
test.beforeEach(async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await page.addInitScript(() => {
    window.NL_OS = 'Windows';
    window.MARKDOWN_VIEWER_DESKTOP_RUNTIME_FEATURES = { nativeFileDrop: true };
  });
  await openApp(page);
});

async function seedMedia(page) {
  await page.evaluate(gif => {
    __desktopFiles.set('C:/native.gif', 'gif');
    window.__binaryReads = 0;
    Neutralino.filesystem.readBinaryFile = async (_, options) => {
      __binaryReads++;
      window.__binaryLimit = options.size;
      return Uint8Array.from(atob(gif), c => c.charCodeAt(0)).buffer;
    };
  }, gif);
}

test('cancelling a mixed drop links no folder and reads or uploads no media', async ({ page }) => {
  await seedMedia(page);
  await page.evaluate(async () => {
    await Neutralino.filesystem.createDirectory('C:/Mixed');
    __desktopFiles.set('C:/Mixed/nested.md', '# nested');
    __desktopFiles.set('C:/loose.md', '# loose');
    window.__drop = NL_HANDLE_NATIVE_DROP(['C:/Mixed', 'C:/loose.md', 'C:/native.gif']);
  });
  await expect(page.locator('#desktop-drop-other-items')).toBeVisible();
  await page.locator('#desktop-drop-modal-cancel').click();
  expect(await page.evaluate(async () => {
    const count = await __drop;
    await MarkdownViewerFlushWorkspace();
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    return { count, reads: __binaryReads, sources: (await storage.listDocumentMetadata()).filter(x => x.sourcePath).length };
  })).toEqual({ count: 0, reads: 0, sources: 0 });
});

test('native GIF uses the bounded reader and existing consent/upload flow', async ({ page }) => {
  let uploads = 0;
  await page.route('**/api/image', route => { uploads++; return route.fulfill({ json: { id: 'reviewNativeMedia00000001' } }); });
  await page.route('**/api/image/*', route => route.fulfill({ contentType: 'image/gif', body: Buffer.from(gif, 'base64') }));
  await seedMedia(page);
  await page.evaluate(() => { window.__drop = NL_HANDLE_NATIVE_DROP(['C:/native.gif']); });
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
  expect(uploads).toBe(0);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  expect(await page.evaluate(() => __drop)).toBe(1);
  expect(uploads).toBe(1);
  expect(await page.evaluate(() => __binaryLimit)).toBe(5 * 1024 * 1024 + 1);
  await expect(page.locator('#markdown-editor')).toHaveValue(/reviewNativeMedia00000001/);
});

test('oversized native GIF is rejected before any binary read', async ({ page }) => {
  await seedMedia(page);
  const count = await page.evaluate(async () => {
    const getStats = Neutralino.filesystem.getStats;
    Neutralino.filesystem.getStats = path => path === 'C:/native.gif'
      ? Promise.resolve({ isFile: true, size: 5 * 1024 * 1024 + 1 }) : getStats(path);
    return NL_HANDLE_NATIVE_DROP(['C:/native.gif']);
  });
  expect(count).toBe(0);
  expect(await page.evaluate(() => __binaryReads)).toBe(0);
  await expect(page.locator('#app-toast-region')).toContainText('Could not add dropped items: native.gif');
});

test('media reading cannot insert into a document edited in the meantime', async ({ page }) => {
  await seedMedia(page);
  await page.evaluate(() => {
    const read = Neutralino.filesystem.readBinaryFile;
    Neutralino.filesystem.readBinaryFile = async (...args) => {
      window.__readStarted = true;
      await new Promise(resolve => { window.__releaseRead = resolve; });
      return read(...args);
    };
    window.__drop = NL_HANDLE_NATIVE_DROP(['C:/native.gif']);
  });
  await expect.poll(() => page.evaluate(() => __readStarted)).toBe(true);
  await page.locator('#markdown-editor').fill('# Changed while reading');
  await page.evaluate(() => __releaseRead());
  expect(await page.evaluate(() => __drop)).toBe(0);
  await expect(page.locator('#markdown-editor')).toHaveValue('# Changed while reading');
});

test('rapid drops are queued and cancelling the first leaves the next usable', async ({ page }) => {
  await page.evaluate(() => {
    __desktopFiles.set('C:/first.md', '# first'); __desktopFiles.set('C:/second.md', '# second');
    window.__first = NL_HANDLE_NATIVE_DROP(['C:/first.md']);
    window.__second = NL_HANDLE_NATIVE_DROP(['C:/second.md', 'C:/second.md']);
  });
  await expect(page.locator('#desktop-drop-file-summary')).toContainText('first.md');
  await page.locator('#desktop-drop-modal-cancel').click();
  await expect(page.locator('#desktop-drop-file-summary')).toContainText('second.md');
  await page.locator('#desktop-drop-copy').click();
  expect(await page.evaluate(async () => [await __first, await __second])).toEqual([0, 1]);
  const tree = page.locator('#document-tree [data-tree-type="document"]');
  await expect(tree.filter({ hasText: 'first' })).toHaveCount(0);
  await expect(tree.filter({ hasText: 'second' })).toHaveCount(1);
});

test('a previous close animation cannot hide a reopened chooser while frames are delayed', async ({ page }) => {
  await page.evaluate(() => {
    __desktopFiles.set('C:/one.md', '# one'); __desktopFiles.set('C:/two.md', '# two');
    window.__first = NL_HANDLE_NATIVE_DROP(['C:/one.md']);
    window.__second = NL_HANDLE_NATIVE_DROP(['C:/two.md']);
  });
  await expect(page.locator('#desktop-drop-modal')).toBeVisible();
  await page.evaluate(() => {
    window.__originalRaf = requestAnimationFrame;
    window.__pendingFrames = [];
    window.requestAnimationFrame = callback => { __pendingFrames.push(callback); return 0; };
    document.getElementById('desktop-drop-modal-cancel').click();
  });
  await expect(page.locator('#desktop-drop-file-summary')).toContainText('two.md');
  // Background native windows can run timers before the next animation frame.
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.requestAnimationFrame = __originalRaf;
    __pendingFrames.splice(0).forEach(callback => __originalRaf(callback));
  });
  await expect(page.locator('#desktop-drop-modal')).toBeVisible();
  await page.locator('#desktop-drop-modal-cancel').click();
  expect(await page.evaluate(async () => [await __first, await __second])).toEqual([0, 0]);
});

test('replacing the chooser cancels it instead of blocking subsequent drops', async ({ page }) => {
  await page.evaluate(() => {
    __desktopFiles.set('C:/replace.md', '# replace');
    window.__drop = NL_HANDLE_NATIVE_DROP(['C:/replace.md']);
  });
  await expect(page.locator('#desktop-drop-modal')).toBeVisible();
  await page.evaluate(() => document.getElementById('storage-settings-button').click());
  expect(await page.evaluate(() => __drop)).toBe(0);
  await expect(page.locator('#storage-settings-modal')).toBeVisible();
  await page.locator('#storage-settings-close').click();
  await page.evaluate(() => { window.__drop = NL_HANDLE_NATIVE_DROP(['C:/replace.md']); });
  await page.locator('#desktop-drop-modal-cancel').click();
  expect(await page.evaluate(() => __drop)).toBe(0);
});

test('an unavailable chooser fails closed and a missing path does not discard valid siblings', async ({ page }) => {
  await page.evaluate(() => {
    __desktopFiles.set('C:/survivor.md', '# survivor');
    window.__drop = NL_HANDLE_NATIVE_DROP(['C:/missing.md', 'C:/survivor.md']);
  });
  await page.locator('#desktop-drop-copy').click();
  expect(await page.evaluate(() => __drop)).toBe(1);
  await expect(page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: 'survivor' })).toHaveCount(1);
  expect(await page.evaluate(async () => {
    document.getElementById('desktop-drop-modal').remove();
    __desktopFiles.set('C:/no-choice.md', '# must not import');
    return NL_HANDLE_NATIVE_DROP(['C:/no-choice.md']);
  })).toBe(0);
  await expect(page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: 'no-choice' })).toHaveCount(0);
});

test('a failed Vault write is never reported as a successful copy', async ({ page }) => {
  await page.evaluate(async () => {
    await MarkdownViewerFlushWorkspace();
    __desktopFiles.set('C:/unsaved-copy.md', '# unique unsaved copy');
    const write = Neutralino.filesystem.writeFile;
    Neutralino.filesystem.writeFile = async (path, content) => {
      if (String(content).includes('# unique unsaved copy')) throw new Error('Simulated full disk');
      return write(path, content);
    };
    window.__drop = NL_HANDLE_NATIVE_DROP(['C:/unsaved-copy.md']);
  });
  await page.locator('#desktop-drop-copy').click();
  expect(await page.evaluate(() => __drop)).toBe(0);
  await expect(page.locator('#app-toast-region')).toContainText('Could not add dropped items: unsaved-copy.md');
  expect(await page.evaluate(() => __desktopFiles.get('C:/unsaved-copy.md'))).toBe('# unique unsaved copy');
});

test('a pending native copy cannot reappear after workspace restore', async ({ page }) => {
  const JSZip = require('jszip');
  await page.route('**/libs/jszip.min.js', route => route.fulfill({ contentType: 'application/javascript', body: require('fs').readFileSync(require.resolve('jszip/dist/jszip.min.js')) }));
  await page.evaluate(() => {
    __desktopFiles.set('C:/stale-drop.md', '# stale drop');
    const read = Neutralino.filesystem.readFile;
    Neutralino.filesystem.readFile = async (path, options) => {
      if (path === 'C:/stale-drop.md') {
        window.__readStarted = true;
        await new Promise(resolve => { window.__releaseRead = resolve; });
      }
      return read(path, options);
    };
    MarkdownWorkspaceStorage.prototype.restoreBackupData = async () => { throw new Error('Simulated restore failed safely'); };
    window.__drop = NL_HANDLE_NATIVE_DROP(['C:/stale-drop.md']);
  });
  await page.locator('#desktop-drop-copy').click();
  await expect.poll(() => page.evaluate(() => __readStarted)).toBe(true);
  const zip = new JSZip();
  zip.file('Workspace/New.md', '# replacement');
  zip.file('.markdown-viewer/documents.json', JSON.stringify([{ metadata: { id: 'replacement', title: 'Replacement', workspaceId: 'workspace_default' }, path: 'Workspace/New.md' }]));
  zip.file('.markdown-viewer/organization.json', '{}'); zip.file('.markdown-viewer/preferences.json', '{}');
  zip.file('markdown-viewer-backup.json', JSON.stringify({ format: 'markdown-viewer-backup', version: 1, normalDocumentCount: 1, secureRecordCount: 0 }));
  await page.getByRole('button', { name: 'Open workspace settings' }).click();
  await page.locator('#storage-settings-button').click();
  await page.locator('#storage-backup-file-input').setInputFiles({ name: 'maintenance.zip', mimeType: 'application/zip', buffer: await zip.generateAsync({ type: 'nodebuffer' }) });
  await page.locator('#storage-import-confirm-confirm').click();
  await expect(page.locator('#import-progress-detail')).toContainText('Simulated restore failed safely');
  await expect.poll(() => page.evaluate(() => document.querySelector('.app-container').inert)).toBe(false);
  await page.evaluate(() => __releaseRead());
  expect(await page.evaluate(() => __drop)).toBe(0);
  await expect(page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: 'stale-drop' })).toHaveCount(0);
});

test('cancelling native media consent stops the whole media batch', async ({ page }) => {
  let uploads = 0;
  await page.route('**/api/image', route => { uploads++; return route.fulfill({ json: { id: 'unexpectedUpload' } }); });
  await seedMedia(page);
  await page.evaluate(() => {
    __desktopFiles.set('C:/second.gif', 'gif');
    window.__drop = NL_HANDLE_NATIVE_DROP(['C:/native.gif', 'C:/second.gif']);
  });
  const consent = page.getByRole('alertdialog');
  await expect(consent).toBeVisible();
  await consent.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => __drop)).toBe(0);
  expect(uploads).toBe(0);
  expect(await page.evaluate(() => __binaryReads)).toBe(1);
});
