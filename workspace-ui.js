(function buildMarkdownWorkspace() {
  'use strict';

  const app = document.querySelector('.app-container');
  const header = document.querySelector('.app-header');
  const headerContainer = header && header.querySelector('.header-container');
  const tabBar = document.getElementById('tab-bar');
  const formatToolbar = document.getElementById('markdown-format-toolbar');
  const contentContainer = document.querySelector('.content-container');

  if (!app || !header || !headerContainer || !tabBar || !formatToolbar || !contentContainer) {
    return;
  }

  document.documentElement.classList.add('workspace-ui-ready');

  const create = function(tagName, className, attributes) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    Object.entries(attributes || {}).forEach(function(entry) {
      const key = entry[0];
      const value = entry[1];
      if (value !== undefined && value !== null) element.setAttribute(key, value);
    });
    return element;
  };

  const setButtonContent = function(button, iconClass, label) {
    if (!button) return;
    button.innerHTML = '<i class="bi ' + iconClass + '" aria-hidden="true"></i><span class="btn-text">' + label + '</span>';
  };

  const headerLeft = headerContainer.querySelector('.header-left');
  const headerRight = headerContainer.querySelector('.header-right');
  const mobileMenu = headerContainer.querySelector('.mobile-menu');
  const brandTitle = headerLeft.querySelector('h1');
  const statsContainer = document.getElementById('stats-container');

  const brandLogo = create('img', 'workspace-brand-logo', {
    src: 'assets/icon.jpg',
    alt: '',
    width: '40',
    height: '40'
  });
  const brandCopy = create('span', 'workspace-brand-copy');
  brandTitle.className = 'workspace-brand-title';
  const tagline = create('span', 'workspace-brand-tagline');
  tagline.textContent = 'Write. Preview. Share.';
  brandCopy.append(brandTitle, tagline);
  headerLeft.replaceChildren(brandLogo, brandCopy);

  const sidebarToggle = create('button', 'workspace-icon-button workspace-sidebar-toggle', {
    type: 'button',
    'aria-label': 'Open workspace navigation',
    'aria-controls': 'workspace-sidebar',
    'aria-expanded': 'false'
  });
  sidebarToggle.innerHTML = '<i class="bi bi-layout-sidebar-inset" aria-hidden="true"></i>';

  const search = create('div', 'workspace-search', { role: 'search' });
  search.innerHTML = [
    '<i class="bi bi-search" aria-hidden="true"></i>',
    '<label class="visually-hidden" for="workspace-search-input">Search files and content</label>',
    '<input id="workspace-search-input" type="search" autocomplete="off" spellcheck="false" placeholder="Search files, content, shortcuts...">',
    '<kbd aria-hidden="true">Ctrl K</kbd>'
  ].join('');

  const mobileSearchToggle = create('button', 'workspace-icon-button workspace-mobile-search-toggle', {
    type: 'button',
    'aria-label': 'Search files and content',
    'aria-expanded': 'false'
  });
  mobileSearchToggle.innerHTML = '<i class="bi bi-search" aria-hidden="true"></i>';

  const importDropdown = document.getElementById('importDropdown');
  const importWrapper = importDropdown && importDropdown.closest('.dropdown');
  const fileInput = document.getElementById('file-input');
  const shareButton = document.getElementById('share-button');
  const liveShareButton = document.getElementById('live-share-button');
  const liveParticipants = document.getElementById('live-share-toolbar-participants');
  const languageDropdown = document.getElementById('languageDropdown');
  const languageWrapper = languageDropdown && languageDropdown.closest('.dropdown');
  const themeToggle = document.getElementById('theme-toggle');
  const exportDropdown = document.getElementById('exportDropdown');
  const exportWrapper = exportDropdown && exportDropdown.closest('.dropdown');
  const toggleSync = document.getElementById('toggle-sync');
  const copyMarkdown = document.getElementById('copy-markdown-button');
  const reviewToggle = document.getElementById('review-toggle');
  const viewToolbar = headerRight.querySelector('.view-toolbar');

  setButtonContent(importDropdown, 'bi-plus-lg', 'New');
  importDropdown.title = 'New or import document';
  importDropdown.setAttribute('aria-label', 'New or import document');
  importDropdown.classList.add('workspace-header-button');

  const importMenu = importWrapper && importWrapper.querySelector('.dropdown-menu');
  if (importMenu) {
    const newItem = document.createElement('li');
    const newDocument = create('button', 'dropdown-item', { type: 'button', id: 'workspace-new-document' });
    newDocument.innerHTML = '<i class="bi bi-file-earmark-plus me-2" aria-hidden="true"></i>New document';
    newItem.appendChild(newDocument);
    const dividerItem = document.createElement('li');
    dividerItem.innerHTML = '<hr class="dropdown-divider">';
    importMenu.prepend(dividerItem);
    importMenu.prepend(newItem);
  }

  setButtonContent(shareButton, 'bi-people', 'Share');
  setButtonContent(liveShareButton, 'bi-broadcast-pin', 'Live Share');
  shareButton.classList.add('workspace-header-button');
  liveShareButton.classList.add('workspace-header-button', 'workspace-live-button');

  const bugLink = create('a', 'workspace-icon-button', {
    href: 'https://github.com/ThisIs-Developer/Markdown-Viewer/issues/new/choose',
    target: '_blank',
    rel: 'noopener noreferrer',
    title: 'Report a bug',
    'aria-label': 'Report a bug'
  });
  bugLink.innerHTML = '<i class="bi bi-bug" aria-hidden="true"></i>';

  const helpButton = create('button', 'workspace-icon-button', {
    type: 'button',
    title: 'Help and about',
    'aria-label': 'About Markdown'
  });
  helpButton.innerHTML = '<i class="bi bi-question-circle" aria-hidden="true"></i>';

  const settingsButton = create('button', 'workspace-icon-button', {
    type: 'button',
    title: 'Settings',
    'aria-label': 'Open workspace settings',
    popovertarget: 'workspace-settings'
  });
  settingsButton.innerHTML = '<i class="bi bi-gear" aria-hidden="true"></i>';

  const settingsPanel = create('div', 'workspace-settings-panel', {
    id: 'workspace-settings',
    popover: 'auto'
  });
  settingsPanel.innerHTML = [
    '<div class="workspace-popover-heading"><div><strong>Workspace settings</strong><span>Appearance and preferences</span></div></div>',
    '<div class="workspace-settings-slot" id="workspace-theme-slot"></div>',
    '<div class="workspace-settings-slot" id="workspace-language-slot"></div>',
    '<hr>',
    '<button type="button" class="workspace-settings-action" id="workspace-reset-action"><i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i><span>Reset workspace</span></button>'
  ].join('');
  settingsPanel.querySelector('#workspace-theme-slot').appendChild(themeToggle);
  settingsPanel.querySelector('#workspace-language-slot').appendChild(languageWrapper);
  themeToggle.classList.add('workspace-settings-action');
  themeToggle.insertAdjacentHTML('beforeend', '<span class="workspace-generated-label">Toggle appearance</span>');
  languageDropdown.classList.add('workspace-settings-action');

  headerRight.replaceChildren();
  [importWrapper, fileInput, shareButton, liveShareButton, liveParticipants, bugLink, helpButton, settingsButton].forEach(function(node) {
    if (node) headerRight.appendChild(node);
  });
  headerContainer.prepend(sidebarToggle);
  headerLeft.after(search);
  search.after(mobileSearchToggle);
  headerContainer.appendChild(settingsPanel);

  const actionButton = function(action) {
    return formatToolbar.querySelector('[data-md-action="' + action + '"]');
  };

  const createMarkdownButton = function(action, iconClass, label, textContent) {
    const button = create('button', 'markdown-tool-btn' + (textContent ? ' text-tool' : ''), {
      type: 'button',
      'data-md-action': action,
      title: label,
      'aria-label': label
    });
    button.innerHTML = textContent || '<i class="bi ' + iconClass + '" aria-hidden="true"></i>';
    return button;
  };

  const toolbarScroller = create('div', 'workspace-format-scroller');
  const toolbarActions = create('div', 'workspace-format-actions');
  const makeGroup = function(actions) {
    const group = create('div', 'markdown-toolbar-group');
    actions.filter(Boolean).forEach(function(button) { group.appendChild(button); });
    toolbarScroller.appendChild(group);
    return group;
  };

  makeGroup([actionButton('undo'), actionButton('redo')]);
  makeGroup([actionButton('bold'), actionButton('italic'), actionButton('strike')]);
  makeGroup([actionButton('link'), actionButton('image'), actionButton('table'), actionButton('code-block'), actionButton('quote')]);
  makeGroup([
    actionButton('unordered-list'),
    actionButton('ordered-list'),
    createMarkdownButton('task-list', 'bi-check2-square', 'Task list'),
    createMarkdownButton('math', '', 'Math formula', 'fx'),
    actionButton('diagram')
  ]);

  const moreTools = create('div', 'dropdown workspace-toolbar-dropdown');
  const moreToolsToggle = create('button', 'markdown-tool-btn', {
    type: 'button',
    'data-bs-toggle': 'dropdown',
    'aria-expanded': 'false',
    title: 'More formatting tools',
    'aria-label': 'More formatting tools'
  });
  moreToolsToggle.innerHTML = '<i class="bi bi-three-dots" aria-hidden="true"></i>';
  const moreToolsMenu = create('div', 'dropdown-menu workspace-tools-menu');
  const moreActionNames = [
    ['heading', 'bi-type-h1', 'Headings'],
    ['inline-code', 'bi-code', 'Inline code'],
    ['terminal-block', 'bi-terminal', 'Terminal block'],
    ['alert', 'bi-chat-square-text', 'Callout'],
    ['reference', 'bi-bookmark', 'Reference'],
    ['date-time', 'bi-clock', 'Date and time'],
    ['emoji', 'bi-emoji-smile', 'Emoji'],
    ['symbols', 'bi-command', 'Symbols'],
    ['horizontal-rule', 'bi-dash-lg', 'Horizontal rule'],
    ['clear-formatting', 'bi-eraser', 'Clear document']
  ];

  moreActionNames.forEach(function(item) {
    let button = actionButton(item[0]);
    if (!button) return;
    button.className = 'dropdown-item workspace-menu-item';
    button.innerHTML = '<i class="bi ' + item[1] + '" aria-hidden="true"></i><span>' + item[2] + '</span>';
    moreToolsMenu.appendChild(button);
    if (item[0] === 'heading') {
      Array.from(formatToolbar.querySelectorAll('[data-md-action="heading"]')).slice(1).forEach(function(headingButton) {
        headingButton.className = 'dropdown-item workspace-menu-item workspace-heading-item';
        headingButton.textContent = headingButton.getAttribute('aria-label') || headingButton.textContent;
        moreToolsMenu.appendChild(headingButton);
      });
    }
  });
  [
    createMarkdownButton('footnote', '', 'Footnote', '[1]'),
    createMarkdownButton('toc', 'bi-list-nested', 'Table of contents')
  ].forEach(function(button) {
    button.className = 'dropdown-item workspace-menu-item';
    button.innerHTML = button.getAttribute('data-md-action') === 'footnote'
      ? '<i class="bi bi-superscript" aria-hidden="true"></i><span>Footnote</span>'
      : '<i class="bi bi-list-nested" aria-hidden="true"></i><span>Table of contents</span>';
    moreToolsMenu.appendChild(button);
  });
  moreTools.append(moreToolsToggle, moreToolsMenu);
  toolbarScroller.appendChild(moreTools);

  setButtonContent(exportDropdown, 'bi-file-earmark-arrow-down', 'Export');
  exportDropdown.classList.add('workspace-export-button');

  const overflow = create('div', 'dropdown workspace-toolbar-dropdown');
  const overflowToggle = create('button', 'markdown-tool-btn', {
    type: 'button',
    'data-bs-toggle': 'dropdown',
    'aria-expanded': 'false',
    title: 'More workspace actions',
    'aria-label': 'More workspace actions'
  });
  overflowToggle.innerHTML = '<i class="bi bi-three-dots" aria-hidden="true"></i>';
  const overflowMenu = create('div', 'dropdown-menu dropdown-menu-end workspace-tools-menu workspace-overflow-menu');

  const findButton = actionButton('find');
  const fullscreenButton = actionButton('fullscreen');
  const toolbarHelpButton = actionButton('help');
  const infoButton = actionButton('info');
  const directionToggle = document.getElementById('direction-toggle');

  const prepareOverflowItem = function(button, iconClass, label) {
    if (!button) return;
    button.className = 'dropdown-item workspace-menu-item';
    button.innerHTML = '<i class="bi ' + iconClass + '" aria-hidden="true"></i><span>' + label + '</span>';
    overflowMenu.appendChild(button);
  };
  prepareOverflowItem(toggleSync, 'bi-link-45deg', 'Sync scrolling');
  prepareOverflowItem(copyMarkdown, 'bi-clipboard', 'Copy Markdown');
  prepareOverflowItem(findButton, 'bi-search', 'Find & replace');
  prepareOverflowItem(fullscreenButton, 'bi-arrows-fullscreen', 'Fullscreen');
  prepareOverflowItem(directionToggle, 'bi-text-left', 'Text direction');
  prepareOverflowItem(toolbarHelpButton, 'bi-question-circle', 'Help');
  prepareOverflowItem(infoButton, 'bi-info-circle', 'About Markdown Viewer');
  overflow.append(overflowToggle, overflowMenu);

  const editorView = viewToolbar && viewToolbar.querySelector('[data-view-mode="editor"]');
  const splitView = viewToolbar && viewToolbar.querySelector('[data-view-mode="split"]');
  const previewView = viewToolbar && viewToolbar.querySelector('[data-view-mode="preview"]');
  if (viewToolbar) viewToolbar.replaceChildren(editorView, previewView, splitView);

  if (reviewToggle) {
    reviewToggle.className = 'markdown-tool-btn workspace-review-button';
    const reviewLabel = reviewToggle.querySelector('.btn-text');
    if (reviewLabel) reviewLabel.remove();
    const reviewIcon = reviewToggle.querySelector('i');
    if (reviewIcon) reviewIcon.className = 'bi bi-chat-square-text';
  }

  const toolbarDivider = create('span', 'workspace-toolbar-divider', { 'aria-hidden': 'true' });
  [exportWrapper, reviewToggle, overflow, toolbarDivider, viewToolbar].filter(Boolean).forEach(function(node) {
    toolbarActions.appendChild(node);
  });
  formatToolbar.replaceChildren(toolbarScroller, toolbarActions);

  tabBar.classList.add('workspace-tab-bar');
  const newTabButton = document.getElementById('tab-new-btn');
  if (newTabButton) {
    newTabButton.innerHTML = '<i class="bi bi-plus-lg" aria-hidden="true"></i><span class="visually-hidden">New document</span>';
  }

  const sidebar = create('aside', 'workspace-sidebar', {
    id: 'workspace-sidebar',
    'aria-label': 'Workspace navigation'
  });
  sidebar.innerHTML = [
    '<div class="workspace-sidebar-scroll">',
      '<details class="workspace-sidebar-group workspace-root-group" open>',
        '<summary><span><i class="bi bi-house-door" aria-hidden="true"></i>Workspace</span><i class="bi bi-chevron-down workspace-summary-chevron" aria-hidden="true"></i></summary>',
        '<div class="workspace-sidebar-content">',
          '<div class="workspace-parent-row"><span><i class="bi bi-link-45deg" aria-hidden="true"></i>My Workspace</span><i class="bi bi-chevron-down" aria-hidden="true"></i></div>',
          '<nav class="workspace-nav" aria-label="Workspace views">',
            '<div class="workspace-nav-item is-active" aria-current="page"><i class="bi bi-clock-history" aria-hidden="true"></i><span>Recent</span></div>',
            '<div class="workspace-nav-item"><i class="bi bi-star" aria-hidden="true"></i><span>Favorites</span></div>',
            '<div class="workspace-nav-item"><i class="bi bi-people" aria-hidden="true"></i><span>Shared with me</span></div>',
            '<div class="workspace-nav-item"><i class="bi bi-file-earmark-text" aria-hidden="true"></i><span>Templates</span></div>',
          '</nav>',
        '</div>',
      '</details>',
      '<section class="workspace-sidebar-section" aria-labelledby="workspace-collections-heading">',
        '<div class="workspace-section-title"><h2 id="workspace-collections-heading">Collections</h2><span aria-hidden="true"><i class="bi bi-plus-lg"></i></span></div>',
        '<div class="workspace-static-list">',
          '<div><i class="bi bi-folder2" aria-hidden="true"></i><span>Project Docs</span></div>',
          '<div><i class="bi bi-folder2" aria-hidden="true"></i><span>Knowledge Base</span></div>',
          '<div><i class="bi bi-folder2" aria-hidden="true"></i><span>Design</span></div>',
          '<div><i class="bi bi-folder2" aria-hidden="true"></i><span>Meeting Notes</span></div>',
          '<div><i class="bi bi-folder2" aria-hidden="true"></i><span>Archive</span></div>',
        '</div>',
      '</section>',
      '<details class="workspace-sidebar-group workspace-sidebar-section" open>',
        '<summary class="workspace-section-title"><h2>Insert</h2><i class="bi bi-chevron-down workspace-summary-chevron" aria-hidden="true"></i></summary>',
        '<div class="workspace-action-list">',
          '<button type="button" data-proxy-action="table"><i class="bi bi-grid-3x3" aria-hidden="true"></i><span>Table</span></button>',
          '<button type="button" data-proxy-action="code-block"><i class="bi bi-code-slash" aria-hidden="true"></i><span>Code Block</span></button>',
          '<button type="button" data-proxy-action="diagram"><i class="bi bi-diagram-3" aria-hidden="true"></i><span>Diagram</span></button>',
          '<button type="button" data-proxy-action="math"><i class="bi bi-calculator" aria-hidden="true"></i><span>Math Formula</span></button>',
          '<button type="button" data-proxy-action="alert"><i class="bi bi-chat-square-text" aria-hidden="true"></i><span>Callout</span></button>',
          '<button type="button" data-proxy-action="horizontal-rule"><i class="bi bi-dash-lg" aria-hidden="true"></i><span>Horizontal Rule</span></button>',
          '<button type="button" data-proxy-action="footnote"><i class="bi bi-superscript" aria-hidden="true"></i><span>Footnote</span></button>',
          '<button type="button" data-proxy-action="toc"><i class="bi bi-list-nested" aria-hidden="true"></i><span>TOC</span></button>',
        '</div>',
      '</details>',
      '<details class="workspace-sidebar-group workspace-sidebar-section workspace-diagram-section" open>',
        '<summary class="workspace-section-title"><h2>Diagram Tools</h2><i class="bi bi-chevron-down workspace-summary-chevron" aria-hidden="true"></i></summary>',
        '<div class="workspace-diagram-grid">',
          '<button type="button" data-diagram-engine="Mermaid"><span class="workspace-engine-mark engine-mermaid">M</span><span>Mermaid</span></button>',
          '<button type="button" data-diagram-engine="PlantUML"><span class="workspace-engine-mark engine-plantuml">P</span><span>PlantUML</span></button>',
          '<button type="button" data-diagram-engine="Graphviz"><span class="workspace-engine-mark engine-graphviz">G</span><span>Graphviz</span></button>',
          '<button type="button" data-diagram-engine="D2"><span class="workspace-engine-mark engine-d2">D</span><span>D2</span></button>',
          '<button type="button" data-diagram-engine="Vega-Lite"><span class="workspace-engine-mark engine-vega">V</span><span>Vega-Lite</span></button>',
          '<button type="button" data-diagram-engine="WaveDrom"><span class="workspace-engine-mark engine-wave">W</span><span>WaveDrom</span></button>',
          '<button type="button" data-diagram-engine="Markmap"><span class="workspace-engine-mark engine-markmap">M</span><span>Markmap</span></button>',
          '<button type="button" data-diagram-engine="ABC"><span class="workspace-engine-mark engine-abc">A</span><span>ABC Notation</span></button>',
          '<button type="button" data-diagram-engine="STL" class="workspace-engine-wide"><span class="workspace-engine-mark engine-stl">3D</span><span>STL (3D)</span><span class="workspace-new-badge">New</span></button>',
        '</div>',
      '</details>',
    '</div>'
  ].join('');

  const sidebarBackdrop = create('button', 'workspace-sidebar-backdrop', {
    type: 'button',
    'aria-label': 'Close workspace navigation',
    tabindex: '-1'
  });
  const workspaceMain = create('section', 'workspace-main', {
    id: 'workspace-main',
    'aria-label': 'Markdown workspace'
  });
  const workspaceShell = create('div', 'workspace-shell');

  const statusBar = create('footer', 'workspace-status-bar', { 'aria-label': 'Document status' });
  statusBar.innerHTML = [
    '<div class="workspace-status-left">',
      '<span><i class="bi bi-git" aria-hidden="true"></i>main</span>',
      '<span><i class="bi bi-file-earmark-text" aria-hidden="true"></i><span id="workspace-status-document">README.md</span></span>',
      '<span>Markdown</span>',
    '</div>',
    '<div class="workspace-status-center"><div id="workspace-stats-slot"></div><span id="workspace-cursor-status">Ln 1, Col 1</span><span>Spaces: 2</span></div>',
    '<div class="workspace-status-right">',
      '<span id="workspace-save-status" class="workspace-save-status"><i class="bi bi-check2" aria-hidden="true"></i>All changes saved</span>',
      '<span><i class="bi bi-cloud-check" aria-hidden="true"></i>Synced</span>',
    '</div>',
    '<div class="workspace-mobile-view-switch" role="group" aria-label="Workspace view">',
      '<button type="button" class="mobile-view-mode-btn" data-mode="editor" aria-pressed="false"><i class="bi bi-file-text" aria-hidden="true"></i><span>Editor</span></button>',
      '<button type="button" class="mobile-view-mode-btn active" data-mode="split" aria-pressed="true"><i class="bi bi-layout-split" aria-hidden="true"></i><span>Split</span></button>',
      '<button type="button" class="mobile-view-mode-btn" data-mode="preview" aria-pressed="false"><i class="bi bi-eye" aria-hidden="true"></i><span>Preview</span></button>',
    '</div>'
  ].join('');
  statusBar.querySelector('#workspace-stats-slot').appendChild(statsContainer);

  workspaceMain.append(tabBar, formatToolbar, contentContainer, statusBar);
  workspaceShell.append(sidebarBackdrop, sidebar, workspaceMain);
  header.after(workspaceShell);

  const setSidebarOpen = function(open) {
    document.documentElement.classList.toggle('workspace-sidebar-open', open);
    sidebarToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  sidebarToggle.addEventListener('click', function() {
    setSidebarOpen(!document.documentElement.classList.contains('workspace-sidebar-open'));
  });
  sidebarBackdrop.addEventListener('click', function() { setSidebarOpen(false); });

  mobileSearchToggle.addEventListener('click', function() {
    const open = !document.documentElement.classList.contains('workspace-search-open');
    document.documentElement.classList.toggle('workspace-search-open', open);
    mobileSearchToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) search.querySelector('input').focus();
  });

  sidebar.addEventListener('click', function(event) {
    const proxy = event.target.closest('[data-proxy-action]');
    if (proxy) {
      const action = proxy.getAttribute('data-proxy-action');
      const target = formatToolbar.querySelector('[data-md-action="' + action + '"]');
      if (target) target.click();
      if (window.innerWidth < 1200) setSidebarOpen(false);
      return;
    }

    const diagram = event.target.closest('[data-diagram-engine]');
    if (!diagram) return;
    const diagramTrigger = formatToolbar.querySelector('[data-md-action="diagram"]');
    if (diagramTrigger) diagramTrigger.click();
    const engine = diagram.getAttribute('data-diagram-engine');
    window.setTimeout(function() {
      const diagramSearch = document.getElementById('diagram-modal-search');
      if (!diagramSearch) return;
      diagramSearch.value = engine;
      diagramSearch.dispatchEvent(new Event('input', { bubbles: true }));
    }, 30);
    if (window.innerWidth < 1200) setSidebarOpen(false);
  });

  helpButton.addEventListener('click', function() {
    const target = formatToolbar.querySelector('[data-md-action="info"]');
    if (target) target.click();
  });

  const resetAction = document.getElementById('workspace-reset-action');
  resetAction.addEventListener('click', function() {
    const resetButton = document.getElementById('tab-reset-btn');
    if (resetButton) resetButton.click();
    if (typeof settingsPanel.hidePopover === 'function') settingsPanel.hidePopover();
  });

  const workspaceNewDocument = document.getElementById('workspace-new-document');
  workspaceNewDocument.addEventListener('click', function() {
    const target = document.getElementById('tab-new-btn');
    if (target) target.click();
  });

  const workspaceSearchInput = search.querySelector('input');
  const performWorkspaceSearch = function() {
    const query = workspaceSearchInput.value.trim();
    if (!query) return;
    const matchingTab = Array.from(document.querySelectorAll('.tab-item')).find(function(tab) {
      return (tab.textContent || '').toLowerCase().includes(query.toLowerCase());
    });
    if (matchingTab) {
      matchingTab.click();
      workspaceSearchInput.blur();
      return;
    }
    const target = formatToolbar.querySelector('[data-md-action="find"]');
    if (target) target.click();
    window.setTimeout(function() {
      const findInput = document.getElementById('find-replace-input');
      if (!findInput) return;
      findInput.value = query;
      findInput.dispatchEvent(new Event('input', { bubbles: true }));
      findInput.focus();
      findInput.select();
    }, 30);
  };
  workspaceSearchInput.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      performWorkspaceSearch();
    } else if (event.key === 'Escape') {
      workspaceSearchInput.value = '';
      document.documentElement.classList.remove('workspace-search-open');
      workspaceSearchInput.blur();
    }
  });

  document.addEventListener('keydown', function(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      document.documentElement.classList.add('workspace-search-open');
      workspaceSearchInput.focus();
      workspaceSearchInput.select();
    } else if (event.key === 'Escape') {
      setSidebarOpen(false);
      document.documentElement.classList.remove('workspace-search-open');
    }
  });

  document.addEventListener('click', function(event) {
    if (event.target.closest('.lang-select-item')) {
      window.setTimeout(function() {
        setButtonContent(importDropdown, 'bi-plus-lg', 'New');
        setButtonContent(shareButton, 'bi-people', 'Share');
        setButtonContent(liveShareButton, 'bi-broadcast-pin', 'Live Share');
      }, 0);
    }
  });

  const editor = document.getElementById('markdown-editor');
  const cursorStatus = document.getElementById('workspace-cursor-status');
  const documentStatus = document.getElementById('workspace-status-document');
  const saveStatus = document.getElementById('workspace-save-status');
  let saveTimer = null;

  const updateStatus = function() {
    const cursor = editor.selectionStart || 0;
    const lines = (editor.value || '').slice(0, cursor).split('\n');
    cursorStatus.textContent = 'Ln ' + lines.length + ', Col ' + (lines[lines.length - 1].length + 1);
    const activeTitle = document.querySelector('.tab-item.active .tab-title');
    if (activeTitle) documentStatus.textContent = activeTitle.textContent || 'Untitled.md';
  };
  ['keyup', 'click', 'select', 'focus'].forEach(function(eventName) {
    editor.addEventListener(eventName, updateStatus);
  });
  editor.addEventListener('input', function() {
    updateStatus();
    saveStatus.classList.remove('is-saved');
    saveStatus.innerHTML = '<i class="bi bi-arrow-repeat" aria-hidden="true"></i>Saving...';
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(function() {
      saveStatus.classList.add('is-saved');
      saveStatus.innerHTML = '<i class="bi bi-check2" aria-hidden="true"></i>All changes saved';
    }, 650);
  });

  const tabList = document.getElementById('tab-list');
  if (tabList && typeof MutationObserver !== 'undefined') {
    new MutationObserver(updateStatus).observe(tabList, { childList: true, subtree: true, attributes: true });
  }

  window.addEventListener('load', function() {
    setButtonContent(importDropdown, 'bi-plus-lg', 'New');
    setButtonContent(shareButton, 'bi-people', 'Share');
    setButtonContent(liveShareButton, 'bi-broadcast-pin', 'Live Share');
    updateStatus();
  });
})();
