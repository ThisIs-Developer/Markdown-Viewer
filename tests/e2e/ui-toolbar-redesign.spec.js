const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('Explorer labels and sidebar toggle describe the next action', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('#document-sidebar-title')).toHaveText('Explorer');
  await expect(page.locator('.document-sidebar-heading i')).toHaveCount(0);
  await expect(page.locator('.document-tree-row[data-tree-id="workspace_default"] .document-tree-label')).toHaveText('Workspace');

  const toggle = page.locator('#document-sidebar-open');
  await expect(toggle).not.toHaveClass(/is-active/);
  await expect(toggle).toHaveAttribute('aria-label', 'Close Explorer');
  await expect(toggle.locator('i')).toHaveClass(/lucide-panel-left-close$/);

  await toggle.click();
  await expect(page.locator('body')).toHaveClass(/document-sidebar-collapsed/);
  await expect(toggle).toHaveAttribute('aria-label', 'Open Explorer');
  await expect(toggle.locator('i')).toHaveClass(/lucide-panel-left-open/);
  await expect(toggle).not.toHaveClass(/is-active/);

  await toggle.click();
  await expect(page.locator('body')).not.toHaveClass(/document-sidebar-collapsed/);
  await expect(toggle).toHaveAttribute('aria-label', 'Close Explorer');
  await expect(toggle.locator('i')).toHaveClass(/lucide-panel-left-close$/);
});

test('application header keeps its height while showing the compact product identity', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('.app-brand-icon')).toHaveCount(0);
  await expect(page.locator('.app-brand-title-row h1')).toContainText('Markdown Viewer');
  await expect(page.locator('.app-brand-subtitle')).toHaveText('Write. Preview. Share.');

  const geometry = await page.evaluate(() => ({
    headerHeight: document.querySelector('.app-header').getBoundingClientRect().height
  }));
  expect(geometry.headerHeight).toBeGreaterThanOrEqual(40);
  expect(geometry.headerHeight).toBeLessThanOrEqual(45);
  await expect(page.locator('.app-brand .github-link i')).toHaveCSS('font-size', '20px');
  await expect(page.locator('#tab-new-btn')).toHaveCSS('width', '25px');
  await expect(page.locator('#tab-new-btn')).toHaveCSS('height', '25px');
});

test('shared application overlays use compact type, spacing, and surface styling', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('#share-button').click();
  const shareSurface = await page.locator('#share-modal .reset-modal-box').evaluate(element => {
    const style = getComputedStyle(element);
    return { radius: style.borderRadius, padding: style.padding, fontSize: style.fontSize };
  });
  expect(shareSurface).toEqual({ radius: '12px', padding: '0px', fontSize: '12px' });
  await page.locator('#share-modal-close-icon').click();

  await page.locator('#importDropdown').click();
  await page.locator('#import-from-github').click();
  await expect(page.locator('#github-import-modal')).toHaveClass(/is-visible/);
  await expect(page.locator('#github-import-modal .reset-modal-message')).toHaveCSS('font-size', '13px');
  await expect(page.locator('#github-import-modal .reset-modal-box')).toHaveCSS('max-width', '520px');
  await page.locator('#github-import-close').click();

  await page.locator('#header-about-button').click();
  await expect(page.locator('.about-description')).toHaveText('A browser-based Markdown editor, viewer, previewer, and reader.');
  await expect(page.locator('.about-actions')).toContainText('Apache License 2.0');
  await expect(page.locator('.about-actions')).toContainText('FAQ');
  await expect(page.locator('.about-support')).toContainText('Developed and maintained by ThisIs-Developer.');
  await page.locator('#about-modal-close').click();

  await page.locator('.markdown-toolbar-group--advanced [data-md-action="alert"]').click();
  await expect(page.locator('#alert-modal')).toHaveClass(/is-visible/);
  await expect(page.locator('#alert-modal .alert-option').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#alert-modal')).toBeHidden();

  await page.locator('[data-md-action="table"]').click();
  const tableSurface = await page.locator('#table-modal .reset-modal-box').evaluate(element => {
    const style = getComputedStyle(element);
    return { radius: style.borderRadius, padding: style.padding, fontSize: style.fontSize };
  });
  expect(tableSurface).toEqual(shareSurface);
  await page.locator('#table-modal [data-modal-cancel]').click();
  await expect(page.locator('#table-modal')).toBeHidden();

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.locator('#share-button').click();
  await expect(page.locator('#share-modal .reset-modal-box')).toHaveCSS('background-color', 'rgb(22, 27, 34)');
  await expect(page.locator('#share-modal .reset-modal-message')).toHaveCSS('color', 'rgb(201, 209, 217)');
  await page.locator('#share-modal-close-icon').click();
});

test('every application dialog uses the shared alert modal shell', async ({ page }) => {
  const dialogShells = await page.locator('.reset-modal-overlay[role="dialog"] .reset-modal-box').evaluateAll(elements =>
    elements.map(element => ({
      id: element.closest('[role="dialog"]')?.id,
      sharedShell: element.classList.contains('app-modal-box'),
      header: Boolean(element.querySelector(':scope > .modal-header')),
      close: Boolean(element.querySelector(':scope > .modal-header .modal-close-btn')),
      footer: Boolean(element.querySelector(':scope > .reset-modal-actions')),
      padding: getComputedStyle(element).padding
    }))
  );

  expect(dialogShells.length).toBeGreaterThanOrEqual(26);
  expect(dialogShells.filter(dialog => !dialog.sharedShell || !dialog.header || !dialog.close || !dialog.footer || dialog.padding !== '0px')).toEqual([]);
});

test('header orders document actions and formatting toolbar follows the recommended grouping', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const header = page.locator('.header-right');
  const toolbar = page.locator('#markdown-format-toolbar');
  const documentActionOrder = await header.locator(':scope > button, :scope > .dropdown > button').evaluateAll(elements =>
    elements.map(element => element.id)
  );
  expect(documentActionOrder.slice(0, 7)).toEqual([
    'toggle-sync',
    'importDropdown',
    'copy-markdown-button',
    'exportDropdown',
    'share-button',
    'live-share-button',
    'review-toggle'
  ]);

  const toolbarGroups = await toolbar.locator(':scope > .markdown-toolbar-group').evaluateAll(groups =>
    groups.map(group => ({
      label: group.getAttribute('aria-label'),
      actions: Array.from(group.children).map(child => {
        const control = child.matches('button') ? child : child.querySelector(':scope > button');
        return control?.getAttribute('data-md-action') || control?.getAttribute('data-toolbar-menu-toggle');
      }).filter(Boolean)
    }))
  );
  expect(toolbarGroups).toEqual([
    { label: 'History', actions: ['undo', 'redo'] },
    { label: 'Text formatting', actions: ['heading', 'bold', 'italic', 'strike', 'inline-code', 'case'] },
    { label: 'Paragraph formatting', actions: ['quote', 'unordered-list', 'ordered-list', 'alignment'] },
    { label: 'Content insertion', actions: ['link', 'image', 'table', 'reference'] },
    { label: 'Technical content', actions: ['code-block', 'terminal-block', 'diagram'] },
    { label: 'Additional insertion', actions: ['horizontal-rule', 'alert', 'date-time', 'symbols', 'emoji'] },
    { label: 'Workspace actions', actions: ['find', 'fullscreen'] }
  ]);
  await expect(toolbar.locator('.markdown-tool-select--insert, [data-toolbar-menu="insert"]')).toHaveCount(0);

  await toolbar.locator('[data-md-action="emoji"]').click();
  await expect(page.locator('#emoji-modal')).toBeVisible();
  await page.locator('#emoji-modal-search').press('Escape');
  await expect(page.locator('#emoji-modal')).toBeHidden();

  const diagramTrigger = toolbar.locator('[data-md-action="diagram"]');
  await diagramTrigger.click();
  await expect(page.locator('#diagram-modal')).toBeVisible();
  await expect(page.locator('#diagram-modal-search')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#diagram-modal')).toBeHidden();
  await expect(diagramTrigger).toBeFocused();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await diagramTrigger.click();
  await expect(page.locator('#diagram-modal-search')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(diagramTrigger).toBeFocused();
});

test('Lucide icons use the local 1.5-pixel system with the branded GitHub exception', async ({ page }) => {
  const liveShareIcon = page.locator('#live-share-button i');
  await expect(liveShareIcon).toHaveAttribute('data-lucide', 'radio');
  await expect(liveShareIcon).toHaveClass(/lucide-radio/);
  await expect(page.locator('.github-link i')).toHaveClass(/bi-github/);
  await expect(page.locator('.github-link i')).not.toHaveClass(/lucide/);
  const rendering = await liveShareIcon.evaluate(icon => ({
    size: getComputedStyle(icon).fontSize,
    mask: getComputedStyle(icon).maskImage,
    runtime: typeof window.lucide
  }));
  expect(rendering.size).toBe('14px');
  expect(rendering.mask).not.toBe('none');
  expect(rendering.runtime).toBe('undefined');
});

test('shared interface roles use the application type and icon scale', async ({ page }) => {
  const sizing = await page.evaluate(() => {
    const uniqueFontSizes = selector => Array.from(new Set(
      Array.from(document.querySelectorAll(selector), element => getComputedStyle(element).fontSize)
    ));
    const rootStyle = getComputedStyle(document.documentElement);
    return {
      tokens: Object.fromEntries([
        '--ui-font-xs', '--ui-font-sm', '--ui-font-md', '--ui-font-lg', '--ui-font-xl',
        '--ui-icon-size-xs', '--ui-icon-size-sm', '--ui-icon-size-md', '--ui-icon-size-lg',
        '--ui-icon-size-xl', '--ui-icon-size-brand'
      ].map(token => [token, rootStyle.getPropertyValue(token).trim()])),
      headerButtons: uniqueFontSizes('#importDropdown, #exportDropdown, .header-right > .tool-button'),
      menuLabels: uniqueFontSizes('.app-menu-label'),
      menuDescriptions: uniqueFontSizes('.app-menu-description'),
      menuIcons: uniqueFontSizes('.app-menu-item > i:first-child, .settings-menu-item > i'),
      modalTitles: uniqueFontSizes('.reset-modal-message'),
      modalText: uniqueFontSizes('.modal-subtext, .reset-modal-label, .reset-modal-btn'),
      modalIcons: uniqueFontSizes('.modal-close-btn .lucide'),
      explorerLabels: uniqueFontSizes('.document-tree-label'),
      explorerIcons: uniqueFontSizes('.document-tree-main > i'),
      mobileText: uniqueFontSizes('.mobile-menu-item'),
      mobileIcons: uniqueFontSizes('.mobile-menu-item > i, .mobile-menu-item-label > i')
    };
  });

  expect(sizing.tokens).toEqual({
    '--ui-font-xs': '10px',
    '--ui-font-sm': '11px',
    '--ui-font-md': '12px',
    '--ui-font-lg': '13px',
    '--ui-font-xl': '16px',
    '--ui-icon-size-xs': '9px',
    '--ui-icon-size-sm': '12px',
    '--ui-icon-size-md': '14px',
    '--ui-icon-size-lg': '16px',
    '--ui-icon-size-xl': '18px',
    '--ui-icon-size-brand': '20px'
  });
  expect(sizing.headerButtons).toEqual(['13px']);
  expect(sizing.menuLabels).toEqual(['12px']);
  expect(sizing.menuDescriptions).toEqual(['11px']);
  expect(sizing.menuIcons).toEqual(['14px']);
  expect(sizing.modalTitles).toEqual(['13px']);
  expect(sizing.modalText).toEqual(['12px']);
  expect(sizing.modalIcons).toEqual(['14px']);
  expect(sizing.explorerLabels).toEqual(['12px']);
  expect(sizing.explorerIcons).toEqual(['14px']);
  expect(sizing.mobileText).toEqual(['12px']);
  expect(sizing.mobileIcons).toEqual(['14px']);
});

test('New and Export menus share one visual system and keyboard dismissal', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  const activeSyncStyle = await page.locator('#toggle-sync').evaluate(button => {
    const style = getComputedStyle(button);
    return [style.backgroundColor, style.borderColor, style.color];
  });
  const expectActiveDropdownStyle = async locator => {
    await expect.poll(() => locator.evaluate(button => {
      const style = getComputedStyle(button);
      return [style.backgroundColor, style.borderColor, style.color];
    })).toEqual(activeSyncStyle);
  };

  await page.locator('#importDropdown').click();
  const newMenu = page.locator('[aria-labelledby="importDropdown"]');
  await expect(newMenu).toBeVisible();
  await expect(page.locator('#importDropdown')).toHaveAttribute('aria-expanded', 'true');
  await expectActiveDropdownStyle(page.locator('#importDropdown'));
  const newSurface = await newMenu.evaluate(menu => {
    const style = getComputedStyle(menu);
    return [style.backgroundColor, style.borderColor, style.borderRadius, style.boxShadow];
  });
  await page.keyboard.press('Escape');
  await expect(newMenu).toBeHidden();

  await page.locator('#exportDropdown').click();
  const exportMenu = page.locator('[aria-labelledby="exportDropdown"]');
  await expect(exportMenu).toBeVisible();
  await expect(page.locator('#exportDropdown')).toHaveAttribute('aria-expanded', 'true');
  await expectActiveDropdownStyle(page.locator('#exportDropdown'));
  const exportSurface = await exportMenu.evaluate(menu => {
    const style = getComputedStyle(menu);
    return [style.backgroundColor, style.borderColor, style.borderRadius, style.boxShadow];
  });
  expect(exportSurface).toEqual(newSurface);
  await page.keyboard.press('Escape');

  await page.locator('#workspaceSettingsDropdown').click();
  await expect(page.locator('#workspaceSettingsDropdown')).toHaveAttribute('aria-expanded', 'true');
  await expectActiveDropdownStyle(page.locator('#workspaceSettingsDropdown'));
  await page.keyboard.press('Escape');

  await expect(page.locator('.markdown-tool-select--insert, [data-toolbar-menu="insert"]')).toHaveCount(0);
});

test('toolbar uses theme surfaces and remains usable at desktop and phone widths', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const toolbar = page.locator('#markdown-format-toolbar');
  await expect(toolbar).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  const desktopSizing = await page.evaluate(() => {
    const toolbar = document.querySelector('#markdown-format-toolbar');
    const formatButton = toolbar.querySelector('.markdown-tool-btn');
    const utilityButton = document.querySelector('.header-right #copy-markdown-button');
    const viewButton = document.querySelector('.header-view-toolbar .view-toggle-btn');
    return {
      toolbarHeight: toolbar.getBoundingClientRect().height,
      formatButton: [formatButton.getBoundingClientRect().width, formatButton.getBoundingClientRect().height],
      utilityButton: [utilityButton.getBoundingClientRect().width, utilityButton.getBoundingClientRect().height],
      viewButton: [viewButton.getBoundingClientRect().width, viewButton.getBoundingClientRect().height]
    };
  });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await expect(toolbar).toHaveCSS('background-color', 'rgb(22, 27, 34)');

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await page.setViewportSize({ width: 375, height: 812 });
  const mobileSizing = await page.evaluate(() => {
    const toolbar = document.querySelector('#markdown-format-toolbar');
    const buttons = Array.from(toolbar.querySelectorAll('button')).filter(button => button.getBoundingClientRect().height > 0);
    return {
      documentOverflow: document.documentElement.scrollWidth > window.innerWidth,
      toolbarScrollable: toolbar.scrollWidth > toolbar.clientWidth,
      toolbarHeight: toolbar.getBoundingClientRect().height,
      formatButton: (() => {
        const button = toolbar.querySelector('.markdown-tool-btn');
        return [button.getBoundingClientRect().width, button.getBoundingClientRect().height];
      })(),
      minimumTarget: Math.min(...buttons.map(button => button.getBoundingClientRect().height))
    };
  });
  expect(mobileSizing.documentOverflow).toBe(false);
  expect(mobileSizing.toolbarScrollable).toBe(true);
  expect(mobileSizing.toolbarHeight).toBe(desktopSizing.toolbarHeight);
  expect(mobileSizing.formatButton).toEqual(desktopSizing.formatButton);
  expect(desktopSizing.utilityButton).toEqual([30, 30]);
  expect(desktopSizing.viewButton).toEqual([27, 26]);
  expect(mobileSizing.minimumTarget).toBeGreaterThanOrEqual(26);

  await page.evaluate(() => { document.documentElement.style.fontSize = '20px'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator('#document-sidebar-open')).toBeVisible();
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });

  await page.setViewportSize({ width: 812, height: 375 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await toolbar.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
});
