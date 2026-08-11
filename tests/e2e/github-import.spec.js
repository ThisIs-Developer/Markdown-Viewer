const { test, expect } = require('@playwright/test');
const { openApp, storedDocuments } = require('../helpers/app');

const TEST_COMMITS = {
  handbook: '1111111111111111111111111111111111111111',
  large: '2222222222222222222222222222222222222222',
  importable: '3333333333333333333333333333333333333333',
  mobile: '4444444444444444444444444444444444444444'
};

async function openGitHubImporter(page) {
  if (await page.locator('#importDropdown').isVisible()) {
    await page.locator('#importDropdown').click();
    await page.locator('#import-from-github').click();
  } else {
    await page.locator('#mobile-menu-toggle').click();
    await page.locator('[aria-controls="mobile-menu-new-panel"]').click();
    await page.locator('#mobile-import-github-button').click();
  }
  await expect(page.locator('#github-import-modal')).toHaveClass(/is-visible/);
}

async function fulfillGitHubUser(route) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ login: 'octocat' })
  });
}

test('shows every Markdown file returned by a large repository tree', async ({ page }) => {
  let releaseRepositoryRequest;
  const repositoryRequestGate = new Promise(resolve => { releaseRepositoryRequest = resolve; });
  let releaseTreeRequest;
  const treeRequestGate = new Promise(resolve => { releaseTreeRequest = resolve; });
  const markdownFiles = Array.from({ length: 2717 }, (_, index) => ({
    path: `docs/guide-${String(index + 1).padStart(4, '0')}.md`,
    type: 'blob',
    sha: `file-${index + 1}`
  }));

  await page.route('https://api.github.com/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/repos/acme/handbook') {
      await repositoryRequestGate;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ default_branch: 'main', private: false })
      });
      return;
    }
    if (decodeURIComponent(url.pathname) === '/repos/acme/handbook/commits/main') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sha: TEST_COMMITS.handbook })
      });
      return;
    }
    if (url.pathname === `/repos/acme/handbook/git/trees/${TEST_COMMITS.handbook}` && url.searchParams.get('recursive') === '1') {
      await treeRequestGate;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ truncated: false, tree: markdownFiles })
      });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await openApp(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openGitHubImporter(page);
  await expect(page.locator('#github-import-modal .reset-modal-box')).toHaveCSS('max-width', '520px');
  await page.locator('#github-import-url').fill('https://github.com/acme/handbook/tree/main');
  await page.locator('#github-import-submit').click();
  await expect(page.locator('#github-import-submit .github-import-button-spinner')).toBeVisible();
  await expect(page.locator('#github-import-submit')).toContainText('Loading');
  await expect(page.locator('#github-import-modal .reset-modal-box')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#github-import-modal')).not.toHaveClass(/is-selection-step/);
  releaseRepositoryRequest();

  await expect(page.locator('#github-import-modal')).toHaveClass(/is-selection-step/);
  await expect(page.locator('#github-import-modal')).toHaveClass(/is-selection-loading/);
  await expect(page.locator('#github-import-tree .github-import-tree-skeleton')).toBeVisible();
  await expect(page.locator('#github-import-repository-name')).toHaveText('acme/handbook');
  await expect(page.locator('#github-import-ref')).toHaveText('main');
  releaseTreeRequest();

  const fileButtons = page.locator('#github-import-tree .github-tree-file-btn');
  await expect(fileButtons).toHaveCount(2717);
  await expect(page.locator('#github-import-modal')).not.toHaveClass(/is-selection-loading/);
  await expect(page.locator('#github-import-submit .github-import-button-spinner')).toHaveCount(0);
  await expect(page.locator('#github-import-submit')).toHaveText('Import Selected');
  await expect(page.locator('#github-import-modal .reset-modal-box')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#github-import-error')).toBeHidden();
  await expect(fileButtons.filter({ hasText: 'guide-0001.md' })).toHaveCount(1);
  await expect(fileButtons.filter({ hasText: 'guide-2717.md' })).toHaveCount(1);
  await expect(page.locator('#github-import-total-count')).toHaveCount(0);
  await expect(page.locator('#github-import-selected-count')).toHaveText('1 selected');
  await expect(page.locator('.github-tree-folder-icon').first()).toHaveClass(/lucide-folder-open/);
  await expect(page.locator('.github-tree-file-icon').first()).toHaveClass(/lucide-file-text/);
  await expect(page.locator('.github-tree-folder-icon').first()).toHaveCSS('width', '14px');
  await expect(page.locator('.github-tree-folder-icon').first()).toHaveCSS('height', '14px');
  await expect(page.locator('.github-tree-file-icon').first()).toHaveCSS('width', '14px');
  await expect(page.locator('.github-tree-file-icon').first()).toHaveCSS('height', '14px');
  await expect(page.locator('#github-import-toggle-folders .lucide')).toHaveCSS('width', '14px');
  await expect(page.locator('#github-import-select-all .lucide')).toHaveCSS('width', '14px');
  await expect(page.locator('#github-import-repository-name')).toHaveText('acme/handbook');
  await expect(page.locator('#github-import-commit')).toHaveText(TEST_COMMITS.handbook.slice(0, 7));
  await expect(page.locator('#github-import-ref')).toHaveText('main');
  await expect(page.locator('#github-import-ref-item')).toBeVisible();
  await expect(page.locator('.github-import-tree-name').first()).toHaveCSS('font-size', '12px');

  const modalGeometry = await page.locator('#github-import-modal .reset-modal-box').evaluate(element => ({
    width: element.getBoundingClientRect().width
  }));
  expect(modalGeometry.width).toBeGreaterThan(520);
  expect(modalGeometry.width).toBeLessThanOrEqual(760);

  const folderToggleButton = page.locator('#github-import-toggle-folders');
  const folderLabels = page.locator('#github-import-tree .github-tree-folder-label');
  const firstFolderIcon = page.locator('.github-tree-folder-icon').first();
  await expect(folderToggleButton).toHaveClass(/tool-button/);
  const normalFolderToggleColor = await folderToggleButton.evaluate(button => getComputedStyle(button).color);
  const expandedFolderColor = await firstFolderIcon.evaluate(icon => getComputedStyle(icon).color);
  await folderToggleButton.click();
  await expect(folderToggleButton).toHaveAttribute('aria-label', 'Expand all folders');
  await expect(folderToggleButton).not.toHaveAttribute('aria-pressed');
  await expect(folderToggleButton.locator('i')).toHaveClass(/lucide-unfold-vertical/);
  await expect(folderToggleButton).toHaveCSS('color', normalFolderToggleColor);
  await expect(folderLabels.first()).toHaveAttribute('aria-expanded', 'false');
  await expect(firstFolderIcon).toHaveClass(/lucide-folder(?!-open)/);
  const collapsedFolderColor = await firstFolderIcon.evaluate(icon => getComputedStyle(icon).color);
  expect(collapsedFolderColor).not.toBe(expandedFolderColor);
  await folderToggleButton.click();
  await expect(folderToggleButton).toHaveAttribute('aria-label', 'Collapse all folders');
  await expect(folderLabels.first()).toHaveAttribute('aria-expanded', 'true');
  await expect(firstFolderIcon).toHaveClass(/lucide-folder-open/);
  await expect(firstFolderIcon).toHaveCSS('color', expandedFolderColor);

  const selectAllButton = page.locator('#github-import-select-all');
  await expect(selectAllButton).toHaveClass(/tool-button/);
  await selectAllButton.click();
  await expect(page.locator('#github-import-selected-count')).toHaveText('2,717 selected');
  await expect(selectAllButton).toHaveAttribute('aria-label', 'Deselect all files');
  await expect(selectAllButton.locator('i')).toHaveClass(/lucide-check-check/);
  await expect(selectAllButton).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await selectAllButton.click();
  await expect(page.locator('#github-import-selected-count')).toHaveText('0 selected');
  await expect(selectAllButton).toHaveAttribute('aria-label', 'Select all files');

  await page.locator('#github-import-search').fill('guide-2717');
  await expect(fileButtons).toHaveCount(1);
  await expect(fileButtons).toContainText('guide-2717.md');
  await page.locator('#github-import-search').press('Escape');
  await expect(fileButtons).toHaveCount(2717);
});

test('walks every subtree when GitHub marks the recursive tree response as truncated', async ({ page }) => {
  const requestedTrees = [];

  await page.route('https://api.github.com/**', async route => {
    const url = new URL(route.request().url());
    requestedTrees.push(url.pathname + url.search);

    if (url.pathname === '/repos/acme/large-repo') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ default_branch: 'main', private: false })
      });
      return;
    }
    if (decodeURIComponent(url.pathname) === '/repos/acme/large-repo/commits/main') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sha: TEST_COMMITS.large })
      });
      return;
    }
    if (url.pathname === `/repos/acme/large-repo/git/trees/${TEST_COMMITS.large}` && url.searchParams.get('recursive') === '1') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ truncated: true, tree: [] })
      });
      return;
    }
    if (url.pathname === `/repos/acme/large-repo/git/trees/${TEST_COMMITS.large}`) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          truncated: false,
          tree: [
            { path: 'README.md', type: 'blob', sha: 'readme' },
            { path: 'docs', type: 'tree', sha: 'docs-tree' },
            { path: 'src', type: 'tree', sha: 'src-tree' }
          ]
        })
      });
      return;
    }
    if (url.pathname === '/repos/acme/large-repo/git/trees/docs-tree') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          truncated: false,
          tree: [
            { path: 'getting-started.md', type: 'blob', sha: 'guide' },
            { path: 'reference.markdown', type: 'blob', sha: 'reference' },
            { path: 'logo.png', type: 'blob', sha: 'logo' }
          ]
        })
      });
      return;
    }
    if (url.pathname === '/repos/acme/large-repo/git/trees/src-tree') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          truncated: false,
          tree: [{ path: 'index.js', type: 'blob', sha: 'source' }]
        })
      });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await openApp(page);
  await openGitHubImporter(page);
  await page.locator('#github-import-url').fill('https://github.com/acme/large-repo');
  await page.locator('#github-import-submit').click();

  await expect(page.locator('#github-import-tree .github-tree-file-btn')).toHaveCount(3);
  await expect(page.locator('#github-import-error')).toBeHidden();
  await expect(page.locator('#github-import-ref-item')).toBeVisible();
  await expect(page.locator('#github-import-ref')).toHaveText('main');
  await expect(page.locator('#github-import-commit')).toHaveText(TEST_COMMITS.large.slice(0, 7));
  expect(requestedTrees).toContain(`/repos/acme/large-repo/git/trees/${TEST_COMMITS.large}?recursive=1`);
  expect(requestedTrees).toContain(`/repos/acme/large-repo/git/trees/${TEST_COMMITS.large}`);
  expect(requestedTrees).toContain('/repos/acme/large-repo/git/trees/docs-tree');
  expect(requestedTrees).toContain('/repos/acme/large-repo/git/trees/src-tree');
});

test('resolves slash-containing branches and shows the immutable commit beside the repository', async ({ page }) => {
  const commitSha = 'abcdef1234567890abcdef1234567890abcdef12';
  const branchName = 'release/2026/very-long-production-branch';
  const attemptedRefs = [];

  await page.route('https://api.github.com/**', async route => {
    const url = new URL(route.request().url());
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === '/repos/acme/branch-repo') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ default_branch: 'main', private: false })
      });
      return;
    }
    if (pathname.startsWith('/repos/acme/branch-repo/commits/')) {
      const ref = pathname.slice('/repos/acme/branch-repo/commits/'.length);
      attemptedRefs.push(ref);
      if (ref === branchName) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ sha: commitSha })
        });
      } else {
        await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
      }
      return;
    }
    if (pathname === `/repos/acme/branch-repo/git/trees/${commitSha}` && url.searchParams.get('recursive') === '1') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          truncated: false,
          tree: [
            { path: 'docs/one.md', type: 'blob', sha: 'one' },
            { path: 'docs/two.markdown', type: 'blob', sha: 'two' }
          ]
        })
      });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await openApp(page);
  await openGitHubImporter(page);
  const compactWidth = await page.locator('#github-import-modal .reset-modal-box').evaluate(element => element.getBoundingClientRect().width);
  expect(compactWidth).toBeLessThanOrEqual(520);

  await page.locator('#github-import-url').fill(`https://github.com/acme/branch-repo/tree/${branchName}/docs`);
  await page.locator('#github-import-submit').click();

  await expect(page.locator('#github-import-title')).toHaveText('Select Markdown files to import');
  await expect(page.locator('#github-import-modal')).toHaveClass(/is-selection-step/);
  await expect(page.locator('#github-import-repository-name')).toHaveText('acme/branch-repo');
  await expect(page.locator('#github-import-commit')).toHaveText('abcdef1');
  await expect(page.locator('#github-import-ref')).toHaveText(branchName);
  await expect(page.locator('#github-import-ref-item')).toBeVisible();
  await expect(page.locator('#github-import-ref-item')).toHaveAttribute('title', branchName);
  await expect(page.locator('#github-import-ref-item')).toHaveAttribute('aria-label', branchName);
  await expect(page.locator('#github-import-base-path')).toHaveText('/ docs');
  await expect(page.locator('#github-import-commit-link')).toHaveAttribute('href', `https://github.com/acme/branch-repo/tree/${commitSha}`);
  expect(attemptedRefs).toEqual([`${branchName}/docs`, branchName]);
  const truncatedRef = await page.locator('#github-import-ref').evaluate(element => element.scrollWidth > element.clientWidth);
  expect(truncatedRef).toBe(true);
  const refGeometry = await page.locator('#github-import-repository-context').evaluate(context => {
    const name = context.querySelector('#github-import-repository-name').getBoundingClientRect();
    const branch = context.querySelector('.github-import-ref').getBoundingClientRect();
    const commit = context.querySelector('.github-import-commit-link').getBoundingClientRect();
    return {
      nameCenter: name.top + (name.height / 2),
      branchCenter: branch.top + (branch.height / 2),
      commitCenter: commit.top + (commit.height / 2),
      branchWidth: branch.width,
      branchBesideName: name.right <= branch.left,
      branchBeforeCommit: branch.right <= commit.left
    };
  });
  expect(Math.abs(refGeometry.nameCenter - refGeometry.branchCenter)).toBeLessThanOrEqual(1);
  expect(Math.abs(refGeometry.branchCenter - refGeometry.commitCenter)).toBeLessThanOrEqual(1);
  expect(refGeometry.branchWidth).toBeGreaterThan(120);
  expect(refGeometry.branchBesideName).toBe(true);
  expect(refGeometry.branchBeforeCommit).toBe(true);
  const repositoryLine = await page.locator('#github-import-repository-context').evaluate(context => {
    const copy = context.querySelector('.github-import-repository-copy').getBoundingClientRect();
    const heading = context.querySelector('.github-import-repository-heading').getBoundingClientRect();
    const meta = context.querySelector('.github-import-repository-meta').getBoundingClientRect();
    const bounds = context.getBoundingClientRect();
    return {
      headingCenter: heading.top + (heading.height / 2),
      metaCenter: meta.top + (meta.height / 2),
      copyBeforeMeta: copy.right <= meta.left,
      staysInsideContext: meta.right <= bounds.right,
      height: bounds.height
    };
  });
  expect(Math.abs(repositoryLine.headingCenter - repositoryLine.metaCenter)).toBeLessThanOrEqual(1);
  expect(repositoryLine.copyBeforeMeta).toBe(true);
  expect(repositoryLine.staysInsideContext).toBe(true);
  expect(repositoryLine.height).toBeLessThanOrEqual(40);

  const selectionControls = await page.locator('#github-import-selection-toolbar').evaluate(toolbar => {
    const search = toolbar.querySelector('.github-import-search').getBoundingClientRect();
    const actions = toolbar.querySelector('.github-import-selection-actions').getBoundingClientRect();
    const count = toolbar.querySelector('#github-import-selected-count').getBoundingClientRect();
    const buttons = Array.from(toolbar.querySelectorAll('.github-import-toolbar-btn'));
    const buttonStyles = buttons.map(button => {
      const style = getComputedStyle(button);
      return {
        width: button.getBoundingClientRect().width,
        height: button.getBoundingClientRect().height,
        borderColor: style.borderTopColor,
        fontSize: style.fontSize
      };
    });
    return {
      countCenter: count.top + (count.height / 2),
      actionCenter: buttons[0].getBoundingClientRect().top + (buttons[0].getBoundingClientRect().height / 2),
      searchCenter: search.top + (search.height / 2),
      actionsCenter: actions.top + (actions.height / 2),
      countBackground: getComputedStyle(toolbar.querySelector('#github-import-selected-count')).backgroundColor,
      actionsRightOfSearch: search.right <= actions.left,
      buttonStyles
    };
  });
  expect(Math.abs(selectionControls.countCenter - selectionControls.actionCenter)).toBeLessThanOrEqual(1);
  expect(Math.abs(selectionControls.searchCenter - selectionControls.actionsCenter)).toBeLessThanOrEqual(1);
  expect(selectionControls.countBackground).toBe('rgba(0, 0, 0, 0)');
  expect(selectionControls.actionsRightOfSearch).toBe(true);
  expect(selectionControls.buttonStyles).toEqual([
    { width: 30, height: 30, borderColor: 'rgba(0, 0, 0, 0)', fontSize: '13px' },
    { width: 30, height: 30, borderColor: 'rgba(0, 0, 0, 0)', fontSize: '13px' }
  ]);

  const selectionWidth = await page.locator('#github-import-modal .reset-modal-box').evaluate(element => element.getBoundingClientRect().width);
  expect(selectionWidth).toBeGreaterThan(520);
  expect(selectionWidth).toBeLessThanOrEqual(760);
});

test('localizes the GitHub importer in every supported interface language', async ({ page }) => {
  test.setTimeout(180_000);
  const locales = ['en', 'de', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'tw', 'uk', 'zh'];
  const catalogs = Object.fromEntries(locales.map(locale => [
    locale,
    locale === 'en' ? null : require(`../../assets/i18n/${locale}.json`)
  ]));
  const commitSha = '6666666666666666666666666666666666666666';

  await page.route('https://api.github.com/**', async route => {
    const url = new URL(route.request().url());
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === '/repos/acme/i18n') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ default_branch: 'main', private: false })
      });
      return;
    }
    if (pathname === '/repos/acme/i18n/commits/main') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sha: commitSha })
      });
      return;
    }
    if (pathname === `/repos/acme/i18n/git/trees/${commitSha}` && url.searchParams.get('recursive') === '1') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          truncated: false,
          tree: [
            { path: 'docs/guide.md', type: 'blob', sha: 'guide' },
            { path: 'README.md', type: 'blob', sha: 'readme' }
          ]
        })
      });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  for (const locale of locales) {
    const translate = source => catalogs[locale]?.[source] || source;
    const languageTag = locale === 'zh' ? 'zh-Hans' : (locale === 'tw' ? 'zh-Hant' : locale);
    await openApp(page, `/?lang=${locale}`);
    await expect(page.locator('html')).toHaveAttribute('lang', languageTag);
    await openGitHubImporter(page);
    await expect(page.locator('#github-import-title')).toHaveText(translate('Import Markdown from GitHub'));
    await expect(page.locator('#github-import-subtitle')).toHaveText(translate('Paste a GitHub file or repository URL.'));
    await expect(page.locator('#github-import-url-label')).toHaveText(translate('GitHub URL'));
    await expect(page.locator('#github-import-access-title')).toHaveText(translate('Private repository access'));
    await expect(page.locator('#github-import-submit')).toHaveText(translate('Import'));

    await page.locator('#github-import-url').fill('https://github.com/acme/i18n');
    await page.locator('#github-import-submit').click();
    await expect(page.locator('#github-import-title')).toHaveText(translate('Select Markdown files to import'));
    await expect(page.locator('#github-import-subtitle')).toHaveText(
      translate('{{0}} Markdown files found. Choose what to save to Explorer.').replace('{{0}}', '2')
    );
    await expect(page.locator('#github-import-search')).toHaveAttribute('placeholder', translate('Search Markdown files'));
    await expect(page.locator('#github-import-selected-count-text')).toHaveText(
      translate('{{0}} selected').replace('{{0}}', '1')
    );
    await expect(page.locator('#github-import-select-all')).toHaveAttribute('aria-label', translate('Select all files'));
    await expect(page.locator('#github-import-toggle-folders')).toHaveAttribute('aria-label', translate('Collapse all folders'));
    await expect(page.locator('#github-import-submit')).toHaveText(translate('Import Selected'));
    await expect(page.locator('#github-import-ref')).toHaveText('main');
    await expect(page.locator('#github-import-ref-item')).toHaveAttribute('title', 'main');
  }
});

test('uses a compact add-then-select flow for multiple named access tokens', async ({ page }) => {
  await page.route('https://api.github.com/user', route => fulfillGitHubUser(route));
  await openApp(page);
  await page.setViewportSize({ width: 533, height: 535 });
  await openGitHubImporter(page);
  await page.locator('#github-import-access-toggle').click();

  await expect(page.locator('#github-import-pat-type')).toHaveCount(0);
  await expect(page.locator('#github-import-pat-retention')).toHaveCount(0);
  await expect(page.locator('#github-import-pat-passphrase')).toHaveCount(0);
  await expect(page.locator('#github-import-access-unlock')).toHaveCount(0);
  await expect(page.locator('#github-import-access-status')).toHaveCount(0);
  await expect(page.locator('#github-import-pat-expiry')).toHaveCount(0);
  await expect(page.getByText('Available for this session')).toHaveCount(0);
  await expect(page.locator('#github-import-access-panel a')).toHaveCount(0);
  const addFieldLayout = await page.locator('#github-import-access-form').evaluate(form => {
    const name = form.querySelector('#github-import-pat-name').getBoundingClientRect();
    const token = form.querySelector('#github-import-pat').getBoundingClientRect();
    return {
      stacked: name.bottom <= token.top,
      equalWidth: Math.abs(name.width - token.width)
    };
  });
  expect(addFieldLayout.stacked).toBe(true);
  expect(addFieldLayout.equalWidth).toBeLessThanOrEqual(2);

  const initialLayout = await page.locator('#github-import-modal').evaluate(modal => {
    const box = modal.querySelector('.reset-modal-box');
    const body = modal.querySelector('.github-import-modal-body');
    const footer = modal.querySelector('.reset-modal-actions');
    return {
      modalBottom: box.getBoundingClientRect().bottom,
      footerBottom: footer.getBoundingClientRect().bottom,
      viewportHeight: window.innerHeight,
      bodyClientHeight: body.clientHeight,
      bodyScrollHeight: body.scrollHeight
    };
  });
  expect(initialLayout.modalBottom).toBeLessThanOrEqual(initialLayout.viewportHeight);
  expect(initialLayout.footerBottom).toBeLessThanOrEqual(initialLayout.viewportHeight);
  expect(initialLayout.bodyScrollHeight).toBeGreaterThanOrEqual(initialLayout.bodyClientHeight);
  await page.locator('.github-import-modal-body').evaluate(body => {
    body.scrollTop = body.scrollHeight;
  });
  await expect(page.locator('#github-import-pat-save')).toBeInViewport();

  await page.locator('#github-import-pat-name').fill('My first access token');
  await page.locator('#github-import-pat').fill('short-token');
  await page.locator('#github-import-pat-save').click();
  const accessToast = page.locator('#app-toast-region .app-toast');
  await expect(accessToast).toBeVisible();
  await expect(accessToast).toHaveAttribute('data-tone', 'error');
  await expect(accessToast.locator('.app-toast-title')).toHaveText('GitHub access not added');
  await expect(accessToast.locator('.app-toast-message')).toContainText('Enter a valid personal access token');
  await expect(accessToast.locator('.app-toast-icon-shell .bi-github')).toBeVisible();
  await expect(page.locator('#github-import-access-form')).toBeVisible();

  await page.locator('#github-import-pat-name').fill('My first access token');
  await page.locator('#github-import-pat').fill('github_pat_first_mock_12345678901234567890');
  await page.locator('#github-import-pat-save').click();
  await expect(accessToast).toHaveAttribute('data-tone', 'success');
  await expect(accessToast.locator('.app-toast-title')).toHaveText('GitHub access added');
  await expect(accessToast.locator('.app-toast-message'))
    .toHaveText('"My first access token" was added. You can select or remove it anytime.');
  await expect(accessToast.locator('.app-toast-icon-shell .bi-github')).toBeVisible();
  await expect(page.locator('#github-import-access-form')).toBeHidden();
  await expect(page.locator('#github-import-access-manage')).toBeVisible();
  await expect(page.locator('#github-import-pat-select')).toHaveText('My first access token');
  await expect(page.locator('#github-import-access-summary')).toContainText('My first access token');
  await expect(page.locator('#github-import-token-expiry')).toHaveCount(0);
  await expect(page.locator('#github-import-access-selected-meta')).toHaveCount(0);
  await expect(page.locator('#github-import-pat-add-another')).toHaveClass(/tool-button/);
  await expect(page.locator('#github-import-pat-remove')).toHaveClass(/tool-button/);

  const actionLayout = await page.locator('#github-import-access-manage').evaluate(manage => {
    const add = manage.querySelector('#github-import-pat-add-another').getBoundingClientRect();
    const remove = manage.querySelector('#github-import-pat-remove').getBoundingClientRect();
    const select = manage.querySelector('#github-import-pat-select').getBoundingClientRect();
    return {
      sameRow: Math.abs(add.top - remove.top),
      actionsAboveSelect: Math.max(add.bottom, remove.bottom) <= select.top
    };
  });
  expect(actionLayout.sameRow).toBeLessThanOrEqual(2);
  expect(actionLayout.actionsAboveSelect).toBe(true);
  const accessButtonStyles = await page.locator('#github-import-access-manage .github-import-toolbar-btn').evaluateAll(buttons => (
    buttons.map(button => {
      const style = getComputedStyle(button);
      return {
        width: button.getBoundingClientRect().width,
        height: button.getBoundingClientRect().height,
        borderColor: style.borderTopColor,
        fontSize: style.fontSize
      };
    })
  ));
  expect(accessButtonStyles).toEqual([
    { width: 44, height: 44, borderColor: 'rgba(0, 0, 0, 0)', fontSize: '13px' },
    { width: 44, height: 44, borderColor: 'rgba(0, 0, 0, 0)', fontSize: '13px' }
  ]);

  await page.locator('#github-import-pat-add-another').click();
  await expect(page.locator('#github-import-access-form')).toBeVisible();
  await expect(page.locator('#github-import-pat-add-cancel')).toBeVisible();
  await page.locator('#github-import-pat-name').fill('Work classic token');
  await page.locator('#github-import-pat').fill('ghp_second_mock_123456789012345678901234');
  await page.locator('#github-import-pat-save').click();
  await expect(page.locator('#github-import-pat-select option')).toHaveCount(2);
  await expect(page.locator('#github-import-pat-select')).toHaveValue(/github_access_/);
  await expect(accessToast.locator('.app-toast-message')).toContainText('Work classic token');

  await page.locator('#github-import-pat-select').selectOption({ label: 'My first access token' });
  await page.locator('#github-import-pat-remove').click();
  await expect(accessToast.locator('.app-toast-title')).toHaveText('GitHub access removed');
  await expect(accessToast.locator('.app-toast-message')).toHaveText('"My first access token" was removed.');
  await expect(accessToast.locator('.app-toast-icon-shell .bi-github')).toBeVisible();
  await expect(page.locator('#github-import-pat-select option')).toHaveCount(1);
  await expect(page.locator('#github-import-pat-select')).toHaveText('Work classic token');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
});

test('uses a saved PAT only with api.github.com for private repositories', async ({ page }) => {
  const token = 'github_pat_private_test_12345678901234567890';
  const commitSha = '5555555555555555555555555555555555555555';
  const authenticatedApiPaths = [];
  let rawRequestCount = 0;

  await page.route('https://raw.githubusercontent.com/**', async route => {
    rawRequestCount++;
    await route.fulfill({ status: 500, body: 'private content must not use the raw host' });
  });
  await page.route('https://api.github.com/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = decodeURIComponent(url.pathname);
    const authorization = request.headers().authorization || '';
    if (authorization) authenticatedApiPaths.push(pathname);

    if (pathname === '/user' && authorization === `Bearer ${token}`) {
      await fulfillGitHubUser(route);
      return;
    }
    if (pathname === '/repos/acme/private-notes' && !authorization) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
      return;
    }
    if (pathname === '/repos/acme/private-notes' && authorization === `Bearer ${token}`) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ default_branch: 'main', private: true })
      });
      return;
    }
    if (pathname === '/repos/acme/private-notes/commits/main' && authorization === `Bearer ${token}`) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sha: commitSha })
      });
      return;
    }
    if (pathname === `/repos/acme/private-notes/git/trees/${commitSha}` && authorization === `Bearer ${token}`) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          truncated: false,
          tree: [
            { path: 'README.md', type: 'blob', sha: 'readme' },
            { path: 'docs/private.md', type: 'blob', sha: 'private' }
          ]
        })
      });
      return;
    }
    if (pathname.startsWith('/repos/acme/private-notes/contents/') && authorization === `Bearer ${token}`) {
      expect(request.headers().accept).toBe('application/vnd.github.raw+json');
      expect(url.searchParams.get('ref')).toBe(commitSha);
      await route.fulfill({ status: 200, contentType: 'text/markdown', body: '# Private import' });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await openApp(page);
  await openGitHubImporter(page);
  await page.locator('#github-import-access-toggle').click();
  await page.locator('#github-import-pat-name').fill('Private notes');
  await page.locator('#github-import-pat').fill(token);
  await page.locator('#github-import-pat-save').click();
  const accessToast = page.locator('#app-toast-region .app-toast');
  await expect(accessToast.locator('.app-toast-title')).toHaveText('GitHub access added');
  await expect(accessToast.locator('.app-toast-message'))
    .toHaveText('"Private notes" was added. You can select or remove it anytime.');
  await expect(accessToast.locator('.app-toast-icon-shell .bi-github')).toBeVisible();
  await expect(page.locator('#github-import-token-expiry')).toHaveCount(0);
  await expect(page.locator('#github-import-pat')).toHaveValue('');

  const persistedText = await page.evaluate(async () => {
    const local = JSON.stringify(localStorage);
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('markdownViewerWorkspace');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const records = await new Promise((resolve, reject) => {
      const request = database.transaction('metadata', 'readonly').objectStore('metadata').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return local + JSON.stringify(records);
  });
  expect(persistedText).not.toContain(token);

  await page.locator('#github-import-url').fill('https://github.com/acme/private-notes/tree/main');
  await page.locator('#github-import-submit').click();
  await page.locator('#github-import-select-all').click();
  await page.locator('#github-import-submit').click();

  await expect.poll(async () => {
    const documents = await storedDocuments(page);
    return documents.filter(document => ['README', 'private'].includes(document.title)).length;
  }).toBe(2);
  expect(rawRequestCount).toBe(0);
  expect(authenticatedApiPaths).toContain('/repos/acme/private-notes');
  expect(authenticatedApiPaths).toContain('/repos/acme/private-notes/commits/main');
  expect(authenticatedApiPaths).toContain(`/repos/acme/private-notes/git/trees/${commitSha}`);
});

test('persists encrypted PATs across refresh and removes retired saved access records', async ({ page }) => {
  await page.route('https://api.github.com/user', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ login: 'octocat' })
  }));
  await openApp(page);
  await page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('markdownViewerWorkspace');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('metadata', 'readwrite');
      const store = transaction.objectStore('metadata');
      store.put({ key: 'githubAccessVaultV2', value: { version: 2, entries: [{ ciphertext: 'retired' }] } });
      store.put({ key: 'githubAccessRecordV1', value: { ciphertext: 'retired' } });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });

  await page.reload();
  await expect(page.locator('#markdown-editor')).toBeVisible();
  await openGitHubImporter(page);
  await expect(page.locator('#github-import-access-summary')).toHaveText('No access token added');
  await page.locator('#github-import-access-toggle').click();
  await expect(page.locator('#github-import-pat-type')).toHaveCount(0);
  await expect(page.locator('#github-import-pat-passphrase')).toHaveCount(0);
  await expect(page.locator('#github-import-access-unlock')).toHaveCount(0);

  const retiredRecords = await page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('markdownViewerWorkspace');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const values = await Promise.all(['githubAccessVaultV2', 'githubAccessRecordV1'].map(key => new Promise((resolve, reject) => {
      const request = database.transaction('metadata', 'readonly').objectStore('metadata').get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    })));
    database.close();
    return values;
  });
  expect(retiredRecords).toEqual([undefined, undefined]);

  const token = 'ghp_session_mock_123456789012345678901234';
  await page.locator('#github-import-pat-name').fill('Session token');
  await page.locator('#github-import-pat').fill(token);
  await page.locator('#github-import-pat-save').click();
  await expect(page.locator('#github-import-access-summary')).toContainText('Session token');
  await expect(page.locator('#github-import-token-expiry')).toHaveCount(0);

  const encryptedVault = await page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('markdownViewerWorkspace');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const record = await new Promise((resolve, reject) => {
      const request = database.transaction('metadata', 'readonly').objectStore('metadata').get('githubAccessVaultV3');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return record && record.value;
  });
  expect(encryptedVault.version).toBe(3);
  expect(encryptedVault.entries).toHaveLength(1);
  expect(encryptedVault.entries[0].ciphertext).toBeTruthy();
  expect(encryptedVault.entries[0].token).toBeUndefined();
  expect(JSON.stringify(encryptedVault)).not.toContain(token);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(token);

  await page.reload();
  await expect(page.locator('#markdown-editor')).toBeVisible();
  await openGitHubImporter(page);
  await expect(page.locator('#github-import-access-summary')).toHaveText('Session token · Ready');
  await page.locator('#github-import-access-toggle').click();
  await expect(page.locator('#github-import-pat-select')).toHaveText('Session token');
  await page.locator('#github-import-pat-remove').click();
  await expect(page.locator('#github-import-access-summary')).toHaveText('No access token added');

  await page.reload();
  await expect(page.locator('#markdown-editor')).toBeVisible();
  await openGitHubImporter(page);
  await expect(page.locator('#github-import-access-summary')).toHaveText('No access token added');
});

test('saves selected GitHub files to Explorer without opening tabs', async ({ page }) => {
  await page.route('https://api.github.com/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/repos/acme/importable') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ default_branch: 'main', private: false })
      });
      return;
    }
    if (decodeURIComponent(url.pathname) === '/repos/acme/importable/commits/main') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sha: TEST_COMMITS.importable })
      });
      return;
    }
    if (url.pathname === `/repos/acme/importable/git/trees/${TEST_COMMITS.importable}` && url.searchParams.get('recursive') === '1') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          truncated: false,
          tree: [
            { path: 'README.md', type: 'blob', sha: 'readme' },
            { path: 'docs/guide.md', type: 'blob', sha: 'guide' }
          ]
        })
      });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
  await page.route('https://raw.githubusercontent.com/**', route => {
    route.fulfill({ status: 200, contentType: 'text/markdown', body: '# Imported from GitHub' });
  });

  await openApp(page);
  await openGitHubImporter(page);
  await page.locator('#github-import-url').fill('https://github.com/acme/importable/tree/main');
  await page.locator('#github-import-submit').click();
  await page.locator('#github-import-select-all').click();
  await page.locator('#github-import-submit').click();

  await expect(page.locator('#github-import-modal')).not.toHaveClass(/is-visible/);
  await expect.poll(async () => {
    const documents = await storedDocuments(page);
    return documents.filter(document => ['README', 'guide'].includes(document.title) && document.isOpen === false).length;
  }).toBe(2);
  await expect(page.locator('#tab-list .tab-title').filter({ hasText: /README|guide/ })).toHaveCount(0);
});

test('keeps the searchable picker usable on a small phone', async ({ page }) => {
  await page.route('https://api.github.com/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/repos/acme/mobile') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ default_branch: 'main', private: false })
      });
      return;
    }
    if (decodeURIComponent(url.pathname) === '/repos/acme/mobile/commits/main') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sha: TEST_COMMITS.mobile })
      });
      return;
    }
    if (url.pathname === `/repos/acme/mobile/git/trees/${TEST_COMMITS.mobile}` && url.searchParams.get('recursive') === '1') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          truncated: false,
          tree: [
            { path: 'README.md', type: 'blob', sha: 'readme' },
            { path: 'docs/guide.md', type: 'blob', sha: 'guide' }
          ]
        })
      });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await openApp(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await openGitHubImporter(page);
  await page.locator('#github-import-url').fill('https://github.com/acme/mobile/tree/main');
  await page.locator('#github-import-submit').click();
  await expect(page.locator('#github-import-title')).toHaveText('Select Markdown files to import');

  for (const viewport of [{ width: 375, height: 812 }, { width: 812, height: 375 }]) {
    await page.setViewportSize(viewport);
    const layout = await page.locator('#github-import-modal .reset-modal-box').evaluate(modal => ({
      width: modal.getBoundingClientRect().width,
      height: modal.getBoundingClientRect().height,
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: document.documentElement.clientHeight,
      pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      searchHeight: document.querySelector('#github-import-search').getBoundingClientRect().height,
      selectAllHeight: document.querySelector('#github-import-select-all').getBoundingClientRect().height,
      folderToggleHeight: document.querySelector('#github-import-toggle-folders').getBoundingClientRect().height
    }));
    expect(layout.width).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.height).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.pageOverflow).toBe(false);
    expect(layout.searchHeight).toBeGreaterThanOrEqual(44);
    expect(layout.selectAllHeight).toBeGreaterThanOrEqual(44);
    expect(layout.folderToggleHeight).toBeGreaterThanOrEqual(44);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('#github-import-select-all')).toHaveCSS('transition-duration', '0s');
});
