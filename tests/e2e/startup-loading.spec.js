const { test, expect } = require('@playwright/test');
const {
  openApp,
  setEditorContent,
  storedDocuments,
  waitForAppReady
} = require('../helpers/app');

async function expectStartupSkeletons(page) {
  await expect(page.locator('#editor-skeleton')).toBeVisible();
  await expect(page.locator('#markdown-preview-skeleton')).toBeVisible();
  await expect(page.locator('#document-tree-skeleton')).toBeVisible();
  await expect(page.locator('#document-tree')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#welcome-preview')).toHaveCount(0);
  await expect(page.locator('#markdown-preview')).not.toHaveAttribute('data-render-state', 'ready');

  // Compare painted geometry, not just class names, so Markdown CSS cannot
  // silently change the preview's spacing or bar sizes.
  const panes = await page.evaluate(() => {
    return ['#editor-skeleton', '#markdown-preview-skeleton'].map(selector => {
      const skeleton = document.querySelector(selector);
      const pane = skeleton.closest('.editor-pane, .preview-pane');
      const bounds = pane.getBoundingClientRect();
      const style = getComputedStyle(skeleton);
      const contentWidth = skeleton.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      return {
        background: style.backgroundColor,
        bars: [...skeleton.children].map(bar => {
          const rect = bar.getBoundingClientRect();
          return {
            x: Math.round(rect.left - bounds.left),
            y: Math.round(rect.top - bounds.top),
            height: rect.height,
            widthRatio: Number((rect.width / contentWidth).toFixed(2)),
            background: getComputedStyle(bar).backgroundColor
          };
        })
      };
    });
  });
  expect(panes[1]).toEqual(panes[0]);
}

async function expectLoadedWorkspace(page) {
  await expect(page.locator('#editor-skeleton')).toBeHidden();
  await expect(page.locator('#markdown-preview-skeleton')).toHaveCount(0);
  await expect(page.locator('#document-tree-skeleton')).toHaveCount(0);
  await expect(page.locator('#document-tree')).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#document-tree [data-document-id]').first()).toBeVisible();
  await expect(page.locator('#markdown-preview')).toHaveAttribute('data-render-state', 'ready');
}

test('first paint shows matching document skeletons and Explorer file placeholders', async ({ page }) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let releaseScript;
  const scriptGate = new Promise(resolve => { releaseScript = resolve; });
  await page.route('**/script.js', async route => {
    await scriptGate;
    await route.continue();
  });

  const startup = openApp(page);
  try {
    await expectStartupSkeletons(page);
    expect(await page.locator('#markdown-preview-skeleton .skeleton-placeholder').first()
      .evaluate(bar => getComputedStyle(bar, '::after').animationName)).toBe('none');
  } finally {
    releaseScript();
    expect(await startup).toEqual([]);
  }
  await expectLoadedWorkspace(page);
  await expect(page.locator('#markdown-editor')).toHaveValue(/# Welcome to Markdown Viewer/);
});

test('skeletons remain during storage hydration and give way to the saved document', async ({ page }) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await openApp(page);
  const savedDocument = '# My saved document\n\nRestore this content after loading.';
  await setEditorContent(page, savedDocument);
  await expect.poll(async () => (await storedDocuments(page)).some(doc => doc.content === savedDocument)).toBe(true);

  await page.addInitScript(() => {
    let StorageClass;
    Object.defineProperty(window, 'MarkdownWorkspaceStorage', {
      configurable: true,
      get() { return StorageClass; },
      set(value) {
        StorageClass = value;
        const originalInit = value.prototype.init;
        let paused = false;
        value.prototype.init = async function(...args) {
          if (!paused) {
            paused = true;
            await new Promise(resolve => { window.__releaseWorkspaceLoad = resolve; });
          }
          return originalInit.apply(this, args);
        };
      }
    });
  });

  await page.reload();
  await page.waitForFunction(() => typeof window.__releaseWorkspaceLoad === 'function');
  await expectStartupSkeletons(page);
  await page.evaluate(() => window.__releaseWorkspaceLoad());
  await waitForAppReady(page);
  await expectLoadedWorkspace(page);
  await expect(page.locator('#markdown-editor')).toHaveValue(savedDocument);
  await expect(page.locator('#markdown-preview')).toContainText('My saved document');
});
