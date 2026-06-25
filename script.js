document.addEventListener("DOMContentLoaded", async function () {
  async function syncStorageFromNeutralino() {
    if (typeof Neutralino === 'undefined') return;
    const keys = [
      'markdownViewerGlobalState',
      'markdownViewerTabs',
      'markdownViewerActiveTab',
      'markdownViewerUntitledCounter',
      'find-replace-docked',
      'app-lang'
    ];
    for (const key of keys) {
      try {
        const value = await Neutralino.storage.getData(key);
        if (value !== undefined && value !== null) {
          localStorage.setItem(key, value);
        }
      } catch (err) {
        // Key does not exist yet
      }
    }
  }

  function saveStorageItem(key, value) {
    localStorage.setItem(key, value);
    if (typeof Neutralino !== 'undefined') {
      Neutralino.storage.setData(key, value).catch(err => {
        console.warn('Failed to save to Neutralino storage:', err);
      });
    }
  }

  if (typeof Neutralino !== 'undefined') {
    try {
      await syncStorageFromNeutralino();
    } catch (e) {
      console.warn('Neutralino storage sync failed:', e);
    }
  }

  // PERF-002: Lazy script loader for optional heavy libraries
  const _loadedScripts = new Set();
  const _loadingScripts = new Map();
  function loadScript(url) {
    if (_loadedScripts.has(url)) return Promise.resolve();
    if (_loadingScripts.has(url)) return _loadingScripts.get(url);
    const loadPromise = new Promise(function(resolve, reject) {
      const script = document.createElement('script');
      script.src = url;
      script.onload = function() {
        _loadedScripts.add(url);
        _loadingScripts.delete(url);
        resolve();
      };
      script.onerror = function() {
        _loadingScripts.delete(url);
        reject(new Error('Failed to load: ' + url));
      };
      document.head.appendChild(script);
    });
    _loadingScripts.set(url, loadPromise);
    return loadPromise;
  }

  const _loadedStyles = new Set();
  const _loadingStyles = new Map();
  function loadStyle(url) {
    if (_loadedStyles.has(url)) return Promise.resolve();
    if (_loadingStyles.has(url)) return _loadingStyles.get(url);
    const loadPromise = new Promise(function(resolve, reject) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.onload = function() {
        _loadedStyles.add(url);
        _loadingStyles.delete(url);
        resolve();
      };
      link.onerror = function() {
        _loadingStyles.delete(url);
        reject(new Error('Failed to load style: ' + url));
      };
      document.head.appendChild(link);
    });
    _loadingStyles.set(url, loadPromise);
    return loadPromise;
  }

  // CDN URLs for lazy-loaded libraries
  const CDN = {
    mermaid: 'https://cdn.jsdelivr.net/npm/mermaid@11.15.0/dist/mermaid.min.js',
    mathjax: 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-mml-chtml.min.js',
    jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    html2canvas: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    pako: 'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js',
    joypixels: 'https://cdn.jsdelivr.net/npm/emoji-toolkit@9.0.1/lib/js/joypixels.min.js',
    joypixels_css: 'https://cdn.jsdelivr.net/npm/emoji-toolkit@9.0.1/extras/css/joypixels.min.css',
    abcjs: 'https://cdnjs.cloudflare.com/ajax/libs/abcjs/6.5.2/abcjs-basic-min.js',
    leaflet_css: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css',
    leaflet_js: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',
    topojson: 'https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js',
    three: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
    stlLoader: 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/STLLoader.js',
    orbitControls: 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'
  };

  // Resolve local paths for desktop (Neutralinojs) offline support
  if (typeof Neutralino !== 'undefined') {
    CDN.mermaid = '/libs/mermaid.min.js';
    CDN.mathjax = '/libs/tex-mml-chtml.min.js';
    CDN.jspdf = '/libs/jspdf.umd.min.js';
    CDN.html2canvas = '/libs/html2canvas.min.js';
    CDN.pako = '/libs/pako.min.js';
    CDN.joypixels = '/libs/joypixels.min.js';
    CDN.joypixels_css = '/libs/joypixels.min.css';
    CDN.abcjs = '/libs/abcjs-basic-min.js';
    CDN.leaflet_css = '/libs/leaflet.css';
    CDN.leaflet_js = '/libs/leaflet.js';
    CDN.topojson = '/libs/topojson.min.js';
    CDN.three = '/libs/three.min.js';
    CDN.stlLoader = '/libs/STLLoader.js';
    CDN.orbitControls = '/libs/OrbitControls.js';
  }

  // Active WebGL / Three.js 3D STL renderers Map for memory cleanup
  const activeStlViews = new Map();
  let activeModalStlView = null;

  // Active ABC synthesis playback variables
  let activeAbcSynth = null;
  let activeAbcTimingCallbacks = null;
  let activeAbcBtn = null;

  function stopActiveAbcPlayback() {
    if (activeAbcSynth) {
      try {
        activeAbcSynth.stop();
      } catch (e) {
        console.warn("Error stopping ABC playback:", e);
      }
      activeAbcSynth = null;
    }
    if (activeAbcTimingCallbacks) {
      try {
        activeAbcTimingCallbacks.stop();
      } catch (e) {
        console.warn("Error stopping ABC timing callbacks:", e);
      }
      activeAbcTimingCallbacks = null;
    }
    
    // Clean up all active cursors and highlights globally in the document
    document.querySelectorAll('.abc-notation svg .abcjs-cursor').forEach(el => el.remove());
    document.querySelectorAll('.abc-notation svg .abcjs-highlight').forEach(el => el.classList.remove('abcjs-highlight'));

    if (activeAbcBtn) {
      activeAbcBtn.innerHTML = '<i class="bi bi-play-fill"></i> Listen';
      activeAbcBtn.setAttribute('aria-label', 'Listen to score');
      activeAbcBtn = null;
    }
  }

  let markdownRenderTimeout = null;
  let pendingPreviewRenderCancel = null;
  let previewRenderGeneration = 0;
  let previewHasCommittedRender = false;
  let previewLastRenderedTabId = null;
  // PERF-003: Track last rendered content to skip redundant renders
  let _lastRenderedContent = null;
  const LARGE_DOCUMENT_THRESHOLD = 15000;
  const HUGE_DOCUMENT_THRESHOLD = 100000;
  const PREVIEW_ENGINE_V2_ENABLED = true;
  const PREVIEW_WORKER_THRESHOLD = 50000;
  const PREVIEW_WORKER_TIMEOUT = 12000;
  const PREVIEW_SEGMENT_MIN_BLOCKS = 8;
  const PREVIEW_BLOCK_REUSE_LIMIT = 12000;
  const PREVIEW_SANITIZE_OPTIONS = {
    ADD_TAGS: ['mjx-container', 'input'],
    ADD_ATTR: ['id', 'class', 'style', 'align', 'type', 'checked', 'disabled', 'data-original-code', 'role', 'aria-labelledby', 'aria-describedby'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
  };
  const RENDER_DELAY = 100;
  const LARGE_RENDER_DELAY = 160;
  const HUGE_RENDER_DELAY = 240;
  let syncScrollingEnabled = true;
  let isEditorScrolling = false;
  let isPreviewScrolling = false;
  let isProgrammaticScrolling = false;
  let scrollSyncTimeout = null;
  const SCROLL_SYNC_DELAY = 10;

  // View Mode State - Story 1.1
  let currentViewMode = 'split'; // 'editor', 'split', or 'preview'
  const APP_VERSION = '3.8.0';
  let activeModal = null;
  let lastFocusedElement = null;
  let isFindModalOpen = false;
  let findMatches = [];
  let activeFindIndex = -1;
  let lastFindQuery = '';

  // Custom Editor History State Manager variables
  const tabHistories = {};
  let currentHistoryTabId = null;
  let lastPushedValue = '';
  let typingTimeout = null;
  let lastInputType = null; // 'insert', 'delete', 'programmatic', or null
  let lastCursorStart = 0;
  let lastCursorEnd = 0;
  let pendingState = null;
  let previewWorker = null;
  let previewWorkerUnavailable = false;
  let previewWorkerRequestCounter = 0;
  let previewWorkerFailureCount = 0;
  const previewWorkerRequests = new Map();
  const previewSegmentHtmlCache = new Map();
  let previewSegmentCacheTabId = null;
  let mathJaxLoadPromise = null;
  let mathJaxTypesetPromise = Promise.resolve();
  let mathJaxTypesetRunId = 0;

  const markdownEditor = document.getElementById("markdown-editor");
  const markdownPreview = document.getElementById("markdown-preview");
  const markdownFormatToolbar = document.getElementById("markdown-format-toolbar");
  const themeToggle = document.getElementById("theme-toggle");
  const directionToggle = document.getElementById("direction-toggle");
  const importFromFileButton = document.getElementById("import-from-file");
  const importFromGithubButton = document.getElementById("import-from-github");
  const fileInput = document.getElementById("file-input");
  const exportMd = document.getElementById("export-md");
  const exportHtml = document.getElementById("export-html");
  const exportPdf = document.getElementById("export-pdf");
  const exportPng = document.getElementById("export-png");
  const copyMarkdownButton = document.getElementById("copy-markdown-button");
  const dragOverlay = document.getElementById("drag-overlay");
  const toggleSyncButton = document.getElementById("toggle-sync");
  const editorPane = document.getElementById("markdown-editor");
  const previewPane = document.querySelector(".preview-pane");
  const readingTimeElement = document.getElementById("reading-time");
  const wordCountElement = document.getElementById("word-count");
  const charCountElement = document.getElementById("char-count");

  // View Mode Elements - Story 1.1
  const contentContainer = document.querySelector(".content-container");
  const viewModeButtons = document.querySelectorAll(".view-toggle-btn");

  // Mobile View Mode Elements - Story 1.4
  const mobileViewModeButtons = document.querySelectorAll(".mobile-view-mode-btn");

  // Resize Divider Elements - Story 1.3
  const resizeDivider = document.querySelector(".resize-divider");
  const editorPaneElement = document.querySelector(".editor-pane");
  const previewPaneElement = document.querySelector(".preview-pane");
  let isResizing = false;
  let editorWidthPercent = 50; // Default 50%
  const MIN_PANE_PERCENT = 20; // Minimum 20% width

  const mobileMenuToggle    = document.getElementById("mobile-menu-toggle");
  const mobileMenuPanel     = document.getElementById("mobile-menu-panel");
  const mobileMenuOverlay   = document.getElementById("mobile-menu-overlay");
  const mobileCloseMenu     = document.getElementById("close-mobile-menu");
  const mobileReadingTime   = document.getElementById("mobile-reading-time");
  const mobileWordCount     = document.getElementById("mobile-word-count");
  const mobileCharCount     = document.getElementById("mobile-char-count");
  const mobileToggleSync    = document.getElementById("mobile-toggle-sync");
  const mobileImportBtn     = document.getElementById("mobile-import-button");
  const mobileImportGithubBtn = document.getElementById("mobile-import-github-button");
  const mobileExportMd      = document.getElementById("mobile-export-md");
  const mobileExportHtml    = document.getElementById("mobile-export-html");
  const mobileExportPdf     = document.getElementById("mobile-export-pdf");
  const mobileExportPng     = document.getElementById("mobile-export-png");
  const mobileCopyMarkdown  = document.getElementById("mobile-copy-markdown");
  const mobileThemeToggle   = document.getElementById("mobile-theme-toggle");
  const shareButton         = document.getElementById("share-button");
  const mobileShareButton   = document.getElementById("mobile-share-button");
  const githubImportModal = document.getElementById("github-import-modal");
  const githubImportTitle = document.getElementById("github-import-title");
  const githubImportUrlInput = document.getElementById("github-import-url");
  const githubImportFileSelect = document.getElementById("github-import-file-select");
  const githubImportSelectionToolbar = document.getElementById("github-import-selection-toolbar");
  const githubImportSelectedCount = document.getElementById("github-import-selected-count");
  const githubImportSelectAllBtn = document.getElementById("github-import-select-all");
  const githubImportTree = document.getElementById("github-import-tree");
  const githubImportError = document.getElementById("github-import-error");
  const githubImportCancelBtn = document.getElementById("github-import-cancel");
  const githubImportSubmitBtn = document.getElementById("github-import-submit");
  const editorHighlightLayer = document.getElementById("editor-highlight-layer");
  const lineNumbers = document.getElementById("line-numbers");
  const clearFormattingModal = document.getElementById("clear-formatting-modal");
  const clearFormattingConfirm = document.getElementById("clear-formatting-confirm");
  const clearFormattingCancel = document.getElementById("clear-formatting-cancel");
  const clearFormattingClose = document.getElementById("clear-formatting-close");
  const findReplaceModal = document.getElementById("find-replace-modal");
  const findReplaceInput = document.getElementById("find-replace-input");
  const findReplaceWith = document.getElementById("find-replace-with");
  const findReplaceCount = document.getElementById("find-replace-count");
  const findReplacePrev = document.getElementById("find-prev");
  const findReplaceNext = document.getElementById("find-next");
  const findReplaceCurrent = document.getElementById("find-replace-current");
  const findReplaceAll = document.getElementById("find-replace-all");
  const findReplaceClose = document.getElementById("find-replace-close");
  const findReplaceCloseIcon = document.getElementById("find-replace-close-icon");
  const helpModal = document.getElementById("help-modal");
  const helpModalClose = document.getElementById("help-modal-close");
  const helpModalCloseIcon = document.getElementById("help-modal-close-icon");
  const aboutModal = document.getElementById("about-modal");
  const aboutModalClose = document.getElementById("about-modal-close");
  const aboutModalCloseIcon = document.getElementById("about-modal-close-icon");
  const aboutVersion = document.getElementById("about-version");
  if (aboutVersion) {
    aboutVersion.textContent = APP_VERSION;
  }

  // ========================================
  // GLOBAL STATE (persisted across reloads)
  // ========================================
  const GLOBAL_STATE_KEY = 'markdownViewerGlobalState';
  let referenceCounter = 1;
  const imageObjectUrls = new Set();
  const EMOJI_API_URL = 'https://api.github.com/emojis';
  let emojiLoadPromise = null;
  let emojiEntries = [];
  let emojiUrlMap = new Map();
  let emojiLookupLoaded = false;
  let emojiRenderScheduled = false;
  let emojiItems = [];
  const emojiSelection = new Set();
  let symbolItems = [];
  const symbolSelection = new Set();
  const SYMBOL_SECTIONS = [
    {
      title: 'Common symbols',
      items: [
        { symbol: '©', entity: '&copy;', name: 'copyright' },
        { symbol: '®', entity: '&reg;', name: 'registered' },
        { symbol: '™', entity: '&trade;', name: 'trademark' },
        { symbol: '✓', entity: '&check;', name: 'check' },
        { symbol: '★', entity: '&star;', name: 'star' },
        { symbol: '•', entity: '&bull;', name: 'bullet' },
        { symbol: '…', entity: '&hellip;', name: 'ellipsis' },
        { symbol: '—', entity: '&mdash;', name: 'em dash' },
        { symbol: '–', entity: '&ndash;', name: 'en dash' },
        { symbol: '→', entity: '&rarr;', name: 'right arrow' },
        { symbol: '←', entity: '&larr;', name: 'left arrow' },
        { symbol: '↑', entity: '&uarr;', name: 'up arrow' },
        { symbol: '↓', entity: '&darr;', name: 'down arrow' },
      ],
    },
    {
      title: 'HTML entities',
      items: [
        { symbol: '€', entity: '&euro;', name: 'euro' },
        { symbol: '£', entity: '&pound;', name: 'pound' },
        { symbol: '¥', entity: '&yen;', name: 'yen' },
        { symbol: '§', entity: '&sect;', name: 'section' },
        { symbol: '°', entity: '&deg;', name: 'degree' },
        { symbol: '±', entity: '&plusmn;', name: 'plus minus' },
        { symbol: '×', entity: '&times;', name: 'times' },
        { symbol: '÷', entity: '&divide;', name: 'divide' },
        { symbol: '≠', entity: '&ne;', name: 'not equal' },
        { symbol: '≤', entity: '&le;', name: 'less equal' },
        { symbol: '≥', entity: '&ge;', name: 'greater equal' },
        { symbol: '∞', entity: '&infin;', name: 'infinity' },
        { symbol: 'µ', entity: '&micro;', name: 'micro' },
        { symbol: '¼', entity: '&frac14;', name: 'quarter' },
        { symbol: '½', entity: '&frac12;', name: 'half' },
        { symbol: '¾', entity: '&frac34;', name: 'three quarters' },
        { symbol: '«', entity: '&laquo;', name: 'left quote' },
        { symbol: '»', entity: '&raquo;', name: 'right quote' },
      ],
    },
    {
      title: 'Markdown-safe characters',
      items: [
        { symbol: '&', entity: '&amp;', name: 'ampersand' },
        { symbol: '<', entity: '&lt;', name: 'less than' },
        { symbol: '>', entity: '&gt;', name: 'greater than' },
        { symbol: '"', entity: '&quot;', name: 'double quote' },
        { symbol: "'", entity: '&#39;', name: 'apostrophe' },
        { symbol: '|', entity: '&#124;', name: 'pipe' },
        { symbol: '\\', entity: '&#92;', name: 'backslash' },
        { symbol: '`', entity: '&#96;', name: 'backtick' },
        { symbol: '*', entity: '&#42;', name: 'asterisk' },
        { symbol: '_', entity: '&#95;', name: 'underscore' },
        { symbol: '{', entity: '&#123;', name: 'left brace' },
        { symbol: '}', entity: '&#125;', name: 'right brace' },
        { symbol: '[', entity: '&#91;', name: 'left bracket' },
        { symbol: ']', entity: '&#93;', name: 'right bracket' },
        { symbol: '(', entity: '&#40;', name: 'left parenthesis' },
        { symbol: ')', entity: '&#41;', name: 'right parenthesis' },
      ],
    },
  ];

  // In-memory cache for global state to avoid repeated JSON parse/stringify round-trips (PERF-008/024)
  let _globalStateCache = null;
  function loadGlobalState() {
    if (_globalStateCache) return _globalStateCache;
    try { _globalStateCache = JSON.parse(localStorage.getItem(GLOBAL_STATE_KEY)) || {}; }
    catch { _globalStateCache = {}; }
    return _globalStateCache;
  }

  function saveGlobalState(patch) {
    _globalStateCache = { ...loadGlobalState(), ...patch };
    saveStorageItem(GLOBAL_STATE_KEY, JSON.stringify(_globalStateCache));
  }

  // Check dark mode preference first for proper initialization
  const prefersDarkMode =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const savedTheme = loadGlobalState().theme;
  const initialTheme = savedTheme ?? (prefersDarkMode ? "dark" : "light");

  document.documentElement.setAttribute("data-theme", initialTheme);

  themeToggle.innerHTML = initialTheme === "dark"
    ? '<i class="bi bi-sun"></i>'
    : '<i class="bi bi-moon"></i>';

  function updateDirectionToggleUI(direction) {
    const isRtl = direction === "rtl";
    const toggleLabel = isRtl ? "Switch to LTR" : "Switch to RTL";
    if (directionToggle) {
      directionToggle.textContent = isRtl ? "R" : "L";
      directionToggle.setAttribute("title", toggleLabel);
      directionToggle.setAttribute("aria-label", toggleLabel);
      directionToggle.setAttribute("aria-pressed", isRtl.toString());
    }
  }

  const savedDirection = loadGlobalState().direction;
  const initialDirection = savedDirection === "rtl" ? "rtl" : "ltr";
  function applyDirectionToContent(direction) {
    if (markdownEditor) markdownEditor.setAttribute("dir", direction);
    if (markdownPreview) markdownPreview.setAttribute("dir", direction);
  }
  applyDirectionToContent(initialDirection);
  updateDirectionToggleUI(initialDirection);

  // Track last Mermaid theme to avoid redundant re-initialization (PERF-005)
  let _lastMermaidTheme = null;
  let _mermaidThemeReinitTimeout = null;
  let _themeTransitionTimeout = null;
  const initMermaid = (forceReinit) => {
    if (typeof mermaid === 'undefined') return; // PERF-002: Not loaded yet
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const mermaidTheme = currentTheme === "dark" ? "dark" : "default";
    
    // Skip re-initialization if theme hasn't changed (PERF-005)
    if (!forceReinit && _lastMermaidTheme === mermaidTheme) return;
    _lastMermaidTheme = mermaidTheme;
    
    mermaid.initialize({
      startOnLoad: false,
      theme: mermaidTheme,
      securityLevel: 'strict',
      flowchart: { useMaxWidth: true, htmlLabels: true },
      fontSize: 16,
      gantt: { useWidth: 1200 }
    });
  };

  // PERF-002: Removed eager initMermaid() — mermaid is now lazy-loaded on first use

  const markedOptions = {
    gfm: true,
    breaks: true,
    pedantic: false,
    sanitize: false,
    smartypants: false,
    xhtml: false,
    headerIds: true,
    mangle: false,
  };
  const LINE_NUMBER_GUTTER_MIN_CH = 3;
  const LINE_NUMBER_GUTTER_PADDING_CH = 1;
  const LINE_NUMBER_EMPTY_PLACEHOLDER = '\u200b';
  const LINE_CACHE_MAX_ENTRIES = 5000;
  const LARGE_EDITOR_WORK_DELAY = 180;
  const HUGE_EDITOR_WORK_DELAY = 320;
  const FIND_REFRESH_DELAY = 120;
  const LARGE_FIND_REFRESH_DELAY = 320;
  let lineNumberMeasure = null;
  let lineNumberUpdateFrame = null;
  let lineNumberUpdateTimeout = null;
  let editorOverlayScrollFrame = null;
  let findRefreshTimeout = null;

  const renderer = new marked.Renderer();
  const BLOCK_MATH_MARKER_PATTERN = /^\$\$/m;
  const BLOCK_MATH_PATTERN = /^\$\$[ \t]*\n?([\s\S]*?)\n?\$\$[ \t]*(?:\n|$)/;
  const RAW_MATH_TEXT_PATTERN = /\$\$|\$[^$]|\\\(|\\\[/;
  const MATHJAX_TEXT_TARGET_SELECTOR = 'p, li, td, th, dd, dt, blockquote, figcaption, h1, h2, h3, h4, h5, h6, .math-block';
  const DEFINITION_LIST_ITEM_PATTERN = /^:[ \t]+(.*)$/;
  const SUPERSCRIPT_PATTERN = /^\^(?!\s)([^^\n]*?\S)\^(?!\^)/;
  const SUBSCRIPT_PATTERN = /^~(?!~)(?!\s)([^~\n]*?\S)~(?!~)/;
  const HIGHLIGHT_PATTERN = /^==(?=\S)([\s\S]*?\S)==/;
  const MARKDOWN_LIST_MARKER_PATTERN = /^(\s*)(?:[-*+]\s+|\d+\.\s+|>\s+)/;
  const EMPTY_LINE_PATTERN = /^\s*$/;
  const footnoteDefinitions = new Map();
  const footnoteOrder = [];
  const footnoteRefCounts = new Map();
  const footnoteFirstRefId = new Map();
  let anonymousFootnoteCounter = 0;
  let suppressFootnotePreprocess = false;

  function resetExtendedMarkdownState() {
    footnoteDefinitions.clear();
    footnoteOrder.length = 0;
    footnoteRefCounts.clear();
    footnoteFirstRefId.clear();
    anonymousFootnoteCounter = 0;
  }

  function normalizeFootnoteId(id) {
    const normalized = String(id || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (normalized) {
      return normalized;
    }

    anonymousFootnoteCounter += 1;
    return `footnote-${anonymousFootnoteCounter}`;
  }

  function escapeHtmlAttribute(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function sanitizePreviewHtml(html) {
    if (typeof DOMPurify === "undefined") {
      throw new ReferenceError("DOMPurify is not defined. Secure rendering aborted.");
    }
    return DOMPurify.sanitize(html, PREVIEW_SANITIZE_OPTIONS);
  }

  function getLoadedScriptUrl(needle, fallbackUrl) {
    const scripts = document.getElementsByTagName("script");
    for (let i = 0; i < scripts.length; i += 1) {
      const src = scripts[i].getAttribute("src") || "";
      if (src.includes(needle)) {
        try {
          return new URL(src, window.location.href).toString();
        } catch (e) {
          return src;
        }
      }
    }
    return fallbackUrl;
  }

  function getPreviewWorkerUrl() {
    const scripts = document.getElementsByTagName("script");
    let scriptUrl = "";
    for (let i = scripts.length - 1; i >= 0; i -= 1) {
      const src = scripts[i].getAttribute("src") || "";
      if (src.includes("script.js")) {
        scriptUrl = src;
        break;
      }
    }

    try {
      return new URL("preview-worker.js", scriptUrl ? new URL(scriptUrl, window.location.href) : window.location.href).toString();
    } catch (e) {
      return "preview-worker.js";
    }
  }

  function getPreviewWorkerLibraryUrls() {
    return {
      marked: getLoadedScriptUrl("marked", "https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js"),
      highlight: getLoadedScriptUrl("highlight", "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"),
      powershell: getLoadedScriptUrl("powershell.min.js", "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/powershell.min.js"),
    };
  }

  function isSegmentedPreviewSafe(markdown) {
    if (!markdown || markdown.length < PREVIEW_WORKER_THRESHOLD) return false;
    if (/^\s*---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.test(markdown)) return false;
    if (/^\[[^\]\n]+\]:\s+\S+/m.test(markdown)) return false;
    if (/\[\^[^\]\n]+\]/.test(markdown)) return false;
    if (/\n:[ \t]+/.test(markdown)) return false;
    if (/^\s{0,3}<\/?[a-zA-Z][\w:-]*(?:\s|>|\/>)/m.test(markdown)) return false;
    return true;
  }

  function shouldUsePreviewWorker(rawVal, context) {
    if (!PREVIEW_ENGINE_V2_ENABLED || previewWorkerUnavailable || context.disableWorker) return false;
    if (typeof Worker === "undefined" || typeof URL === "undefined") return false;
    return isSegmentedPreviewSafe(rawVal);
  }

  function resetPreviewSegmentCache(previewDocumentId) {
    if (previewSegmentCacheTabId !== previewDocumentId) {
      previewSegmentHtmlCache.clear();
      previewSegmentCacheTabId = previewDocumentId;
    }
  }

  function trimPreviewSegmentCache() {
    while (previewSegmentHtmlCache.size > PREVIEW_BLOCK_REUSE_LIMIT) {
      const firstKey = previewSegmentHtmlCache.keys().next().value;
      previewSegmentHtmlCache.delete(firstKey);
    }
  }

  function buildSegmentedPreviewHtml(blocks, previewDocumentId) {
    resetPreviewSegmentCache(previewDocumentId);
    const htmlParts = [];

    blocks.forEach(function(block, index) {
      const hash = String(block.hash || "");
      const cacheKey = `${hash}:${block.sourceLength || 0}:${block.htmlLength || (block.html ? block.html.length : 0)}`;
      let sanitizedBlock = previewSegmentHtmlCache.get(cacheKey);
      if (sanitizedBlock === undefined) {
        sanitizedBlock = sanitizePreviewHtml(block.html || "");
        previewSegmentHtmlCache.set(cacheKey, sanitizedBlock);
      }
      const blockId = block.id || `preview-block-${index}`;
      htmlParts.push(
        `<section class="preview-render-block" style="content-visibility: auto; contain-intrinsic-size: auto 220px;" data-preview-block-id="${escapeHtmlAttribute(blockId)}" data-preview-block-hash="${escapeHtmlAttribute(cacheKey)}">${sanitizedBlock}</section>`
      );
    });

    trimPreviewSegmentCache();
    return htmlParts.join("");
  }

  function markPreviewWorkerFailure(error) {
    previewWorkerFailureCount += 1;
    if (previewWorkerFailureCount >= 2) {
      previewWorkerUnavailable = true;
    }
    if (previewWorker) {
      try {
        previewWorker.terminate();
      } catch (e) {
        // Ignore worker shutdown failures; fallback rendering will continue on main.
      }
      previewWorker = null;
    }
    previewWorkerRequests.forEach(function(pending) {
      clearTimeout(pending.timeoutId);
      pending.reject(error || new Error("Preview worker unavailable."));
    });
    previewWorkerRequests.clear();
  }

  function recordPreviewWorkerRenderFailure() {
    previewWorkerFailureCount += 1;
    if (previewWorkerFailureCount < 2) return;
    previewWorkerUnavailable = true;
    if (previewWorker) {
      try {
        previewWorker.terminate();
      } catch (e) {
        // Ignore worker shutdown failures; fallback rendering will continue on main.
      }
      previewWorker = null;
    }
  }

  function getPreviewWorker() {
    if (previewWorkerUnavailable) return null;
    if (previewWorker) return previewWorker;
    try {
      previewWorker = new Worker(getPreviewWorkerUrl());
      previewWorker.onmessage = function(event) {
        const data = event.data || {};
        const pending = previewWorkerRequests.get(data.requestId);
        if (!pending) return;
        clearTimeout(pending.timeoutId);
        previewWorkerRequests.delete(data.requestId);
        if (data.type === "render-result") {
          previewWorkerFailureCount = 0;
          pending.resolve(data.result);
        } else {
          recordPreviewWorkerRenderFailure();
          pending.reject(new Error(data.error || "Preview worker render failed."));
        }
      };
      previewWorker.onerror = function(event) {
        markPreviewWorkerFailure(event && event.message ? new Error(event.message) : new Error("Preview worker failed."));
      };
    } catch (e) {
      markPreviewWorkerFailure(e);
      return null;
    }
    return previewWorker;
  }

  function requestPreviewWorkerRender(rawVal, context) {
    const worker = getPreviewWorker();
    if (!worker) {
      return Promise.reject(new Error("Preview worker unavailable."));
    }

    const requestId = ++previewWorkerRequestCounter;
    return new Promise(function(resolve, reject) {
      const timeoutId = setTimeout(function() {
        previewWorkerRequests.delete(requestId);
        recordPreviewWorkerRenderFailure();
        reject(new Error("Preview worker timed out."));
      }, PREVIEW_WORKER_TIMEOUT);

      previewWorkerRequests.set(requestId, { resolve, reject, timeoutId });
      worker.postMessage({
        type: "render",
        requestId,
        markdown: rawVal,
        options: {
          minimumBlocks: PREVIEW_SEGMENT_MIN_BLOCKS,
          libraryUrls: getPreviewWorkerLibraryUrls(),
          renderId: context.renderId,
        },
      });
    });
  }

  function parseInlineWithoutFootnotes(text) {
    suppressFootnotePreprocess = true;
    try {
      return marked.parseInline(text);
    } finally {
      suppressFootnotePreprocess = false;
    }
  }

  function renderDefinitionContent(content, options = {}) {
    const { appendHtml = "" } = options;
    const paragraphs = String(content || "")
      .split(/\n(?:[ \t]*\n)+/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    if (appendHtml) {
      if (paragraphs.length === 0) {
        paragraphs.push(appendHtml);
      } else {
        paragraphs[paragraphs.length - 1] = `${paragraphs[paragraphs.length - 1]} ${appendHtml}`;
      }
    }

    return paragraphs
      .map((paragraph) => {
        const renderedParagraph = parseInlineWithoutFootnotes(paragraph);
        if (typeof DOMPurify === "undefined") {
          throw new ReferenceError("DOMPurify is not defined. Secure rendering aborted.");
        }
        const safeParagraph = DOMPurify.sanitize(renderedParagraph);
        return `<p>${safeParagraph}</p>`;
      })
      .join("");
  }

  function extractFootnoteDefinitions(markdown) {
    const lines = markdown.split("\n");
    const preservedLines = [];
    let index = 0;

    while (index < lines.length) {
      const match = /^([ \t]{0,3})\[\^([^\]\n]+)\]:[ \t]*(.*)$/.exec(lines[index]);
      if (!match) {
        preservedLines.push(lines[index]);
        index += 1;
        continue;
      }

      const baseIndent = match[1] || "";
      const id = match[2].trim();
      const definitionLines = [match[3] || ""];
      index += 1;

      while (index < lines.length) {
        const line = lines[index];
        if (!line.startsWith(baseIndent)) {
          break;
        }

        const lineAfterBase = line.slice(baseIndent.length);
        const indentedMatch = /^(?: {2,}|\t)(.*)$/.exec(lineAfterBase);
        if (indentedMatch) {
          definitionLines.push(indentedMatch[1]);
          index += 1;
          continue;
        }

        if (lineAfterBase.trim() === "") {
          const nextLine = lines[index + 1] || "";
          const nextAfterBase = nextLine.startsWith(baseIndent)
            ? nextLine.slice(baseIndent.length)
            : "";
          if (/^(?: {2,}|\t)/.test(nextAfterBase)) {
            definitionLines.push("");
            index += 1;
            continue;
          }
        }

        break;
      }

      footnoteDefinitions.set(id, definitionLines.join("\n").trim());
    }

    return preservedLines.join("\n");
  }

  function applyFootnotes(markdown) {
    const markdownWithReferences = markdown.replace(/\[\^([^\]\n]+)\]/g, function(match, idText) {
      const id = idText.trim();
      if (!id) {
        return match;
      }

      if (!footnoteOrder.includes(id)) {
        footnoteOrder.push(id);
      }

      const refCount = (footnoteRefCounts.get(id) || 0) + 1;
      footnoteRefCounts.set(id, refCount);

      const normalizedId = normalizeFootnoteId(id);
      const refId = `fnref-${normalizedId}${refCount > 1 ? `-${refCount}` : ""}`;
      if (!footnoteFirstRefId.has(id)) {
        footnoteFirstRefId.set(id, refId);
      }

      const noteNumber = footnoteOrder.indexOf(id) + 1;
      const safeRefId = escapeHtmlAttribute(refId);
      const safeNormalizedId = escapeHtmlAttribute(normalizedId);
      return `<sup id="${safeRefId}" class="footnote-ref"><a href="#fn-${safeNormalizedId}" aria-label="Footnote ${noteNumber}">[${noteNumber}]</a></sup>`;
    });

    const footnotesHtml = footnoteOrder
      .filter((id) => footnoteDefinitions.has(id))
      .map((id) => {
        const normalizedId = normalizeFootnoteId(id);
        const backRefId = footnoteFirstRefId.get(id) || `fnref-${normalizedId}`;
        const safeNormalizedId = escapeHtmlAttribute(normalizedId);
        const safeBackRefId = escapeHtmlAttribute(backRefId);
        const backRefHtml = `<a href="#${safeBackRefId}" class="footnote-backref" aria-label="Back to content">←</a>`;
        const noteHtml = renderDefinitionContent(
          footnoteDefinitions.get(id) || "",
          { appendHtml: backRefHtml }
        );
        return `<li id="fn-${safeNormalizedId}">${noteHtml}</li>`;
      })
      .join("");

    if (!footnotesHtml) {
      return markdownWithReferences;
    }

    return `${markdownWithReferences}\n\n<section class="footnotes"><hr><ol>${footnotesHtml}</ol></section>`;
  }

  const blockMathExtension = {
    name: 'blockMath',
    level: 'block',
    start(src) {
      const match = src.match(BLOCK_MATH_MARKER_PATTERN);
      if (!match) {
        return undefined;
      }
      return match.index;
    },
    tokenizer(src) {
      const match = BLOCK_MATH_PATTERN.exec(src);
      if (!match) {
        return undefined;
      }
      return {
        type: 'blockMath',
        raw: match[0],
        text: match[1],
      };
    },
    renderer(token) {
      return `<div class="math-block">$$\n${token.text}\n$$</div>\n`;
    }
  };
  const definitionListExtension = {
    name: "definitionList",
    level: "block",
    start(src) {
      const match = src.match(/\n:[ \t]+/);
      if (!match) {
        return undefined;
      }
      return match.index + 1;
    },
    tokenizer(src) {
      const lines = src.split("\n");
      if (lines.length < 2) {
        return undefined;
      }

      const term = lines[0];
      if (EMPTY_LINE_PATTERN.test(term) || MARKDOWN_LIST_MARKER_PATTERN.test(term)) {
        return undefined;
      }

      if (!DEFINITION_LIST_ITEM_PATTERN.test(lines[1])) {
        return undefined;
      }

      const definitions = [];
      const rawLines = [term];
      let index = 1;
      while (index < lines.length) {
        const itemMatch = DEFINITION_LIST_ITEM_PATTERN.exec(lines[index]);
        if (!itemMatch) {
          break;
        }

        rawLines.push(lines[index]);
        const definitionLines = [itemMatch[1]];
        index += 1;

        while (index < lines.length) {
          const line = lines[index];
          if (DEFINITION_LIST_ITEM_PATTERN.test(line)) {
            break;
          }
          if (EMPTY_LINE_PATTERN.test(line)) {
            const nextLine = lines[index + 1] || "";
            if (/^(?: {2,}|\t)/.test(nextLine)) {
              rawLines.push(line);
              definitionLines.push("");
              index += 1;
              continue;
            }
            break;
          }
          const continuationMatch = /^(?: {2,}|\t)(.*)$/.exec(line);
          if (!continuationMatch) {
            break;
          }

          rawLines.push(line);
          definitionLines.push(continuationMatch[1]);
          index += 1;
        }

        definitions.push(definitionLines.join("\n").trim());
      }

      if (definitions.length === 0) {
        return undefined;
      }

      let raw = rawLines.join("\n");
      if (src.startsWith(raw + "\n")) {
        raw += "\n";
      }

      return {
        type: "definitionList",
        raw: raw,
        term: term.trim(),
        definitions: definitions,
      };
    },
    renderer(token) {
      const termHtml = parseInlineWithoutFootnotes(token.term);
      const definitionHtml = token.definitions
        .map((definition) => `<dd>${renderDefinitionContent(definition)}</dd>`)
        .join("");
      return `<dl><dt>${termHtml}</dt>${definitionHtml}</dl>\n`;
    },
  };
  const superscriptExtension = {
    name: "superscript",
    level: "inline",
    start(src) {
      const index = src.indexOf("^");
      return index >= 0 ? index : undefined;
    },
    tokenizer(src) {
      const match = SUPERSCRIPT_PATTERN.exec(src);
      if (!match) {
        return undefined;
      }
      return {
        type: "superscript",
        raw: match[0],
        text: match[1],
      };
    },
    renderer(token) {
      return `<sup>${marked.parseInline(token.text)}</sup>`;
    },
  };
  const subscriptExtension = {
    name: "subscript",
    level: "inline",
    start(src) {
      const index = src.indexOf("~");
      return index >= 0 ? index : undefined;
    },
    tokenizer(src) {
      const match = SUBSCRIPT_PATTERN.exec(src);
      if (!match) {
        return undefined;
      }
      return {
        type: "subscript",
        raw: match[0],
        text: match[1],
      };
    },
    renderer(token) {
      return `<sub>${marked.parseInline(token.text)}</sub>`;
    },
  };
  const highlightExtension = {
    name: "highlight",
    level: "inline",
    start(src) {
      const index = src.indexOf("==");
      return index >= 0 ? index : undefined;
    },
    tokenizer(src) {
      const match = HIGHLIGHT_PATTERN.exec(src);
      if (!match) {
        return undefined;
      }
      return {
        type: "highlight",
        raw: match[0],
        text: match[1],
      };
    },
    renderer(token) {
      return `<mark>${marked.parseInline(token.text)}</mark>`;
    },
  };

  function renderDiagramShell(engine, containerClass, surfaceClass, uniqueId, code) {
    const escapedCode = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const label = REMOTE_DIAGRAM_ENGINES[engine]?.label ||
      (engine === 'mermaid' ? 'Mermaid' : engine === 'abc' ? 'ABC notation' : 'Diagram');
    return `<div class="diagram-viewer ${containerClass} is-loading" data-diagram-engine="${engine}">` +
      `<div class="diagram-status" role="status"><span class="diagram-status-spinner" aria-hidden="true"></span>` +
      `<span>Rendering ${label}…</span></div>` +
      `<div class="diagram-surface ${surfaceClass}" id="${uniqueId}" data-original-code="${encodeURIComponent(code)}">${escapedCode}</div>` +
      `</div>`;
  }

  renderer.code = function (code, language) {
    if (language === 'mermaid') {
      const uniqueId = 'mermaid-diagram-' + Math.random().toString(36).substr(2, 9);
      return renderDiagramShell('mermaid', 'mermaid-container', 'mermaid', uniqueId, code);
    }

    if (language === 'abc') {
      const uniqueId = 'abc-notation-' + Math.random().toString(36).substr(2, 9);
      return renderDiagramShell('abc', 'abc-container', 'abc-notation', uniqueId, code);
    }

    if (language === 'geojson') {
      const uniqueId = 'geojson-map-' + Math.random().toString(36).substr(2, 9);
      const escapedCode = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<div class="geojson-container is-loading"><div class="geojson-map" id="${uniqueId}" data-original-code="${encodeURIComponent(code)}">${escapedCode}</div></div>`;
    }

    if (language === 'topojson') {
      const uniqueId = 'topojson-map-' + Math.random().toString(36).substr(2, 9);
      const escapedCode = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<div class="topojson-container is-loading"><div class="topojson-map" id="${uniqueId}" data-original-code="${encodeURIComponent(code)}">${escapedCode}</div></div>`;
    }

    if (language === 'stl') {
      const uniqueId = 'stl-viewer-' + Math.random().toString(36).substr(2, 9);
      const escapedCode = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<div class="stl-container is-loading"><div class="stl-viewer" id="${uniqueId}" data-original-code="${encodeURIComponent(code)}">${escapedCode}</div></div>`;
    }

    if (language === 'plantuml') {
      const uniqueId = 'plantuml-diagram-' + Math.random().toString(36).substr(2, 9);
      return renderDiagramShell('plantuml', 'plantuml-container', 'plantuml-diagram', uniqueId, code);
    }

    if (language === 'd2') {
      const uniqueId = 'd2-diagram-' + Math.random().toString(36).substr(2, 9);
      return renderDiagramShell('d2', 'd2-container', 'd2-diagram', uniqueId, code);
    }

    if (language === 'graphviz' || language === 'dot') {
      const uniqueId = 'graphviz-diagram-' + Math.random().toString(36).substr(2, 9);
      return renderDiagramShell('graphviz', 'graphviz-container', 'graphviz-diagram', uniqueId, code);
    }

    const krokiLanguages = {
      'vega-lite': 'vegalite',
      vegalite: 'vegalite',
      wavedrom: 'wavedrom',
      markmap: 'markmap'
    };
    if (krokiLanguages[language]) {
      const engine = krokiLanguages[language];
      const uniqueId = `${engine}-diagram-` + Math.random().toString(36).substr(2, 9);
      return renderDiagramShell(engine, 'kroki-container', 'kroki-diagram', uniqueId, code);
    }

    if (language === 'math') {
      return `<div class="math-block">$$\n${code}\n$$</div>\n`;
    }
    
    const validLanguage = hljs.getLanguage(language) ? language : "plaintext";
    const highlightedCode = hljs.highlight(code, {
      language: validLanguage,
    }).value;
    return `<pre><code class="hljs ${validLanguage}">${highlightedCode}</code></pre>`;
  };

  renderer.heading = function (text, level, raw) {
    let id = raw
      .toLowerCase()
      .trim()
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '')
      .replace(/-+/g, '-');
    if (!id) {
      id = 'heading-' + Math.random().toString(36).substr(2, 9);
    }
    return `<h${level} id="${id}">${text}</h${level}>`;
  };

  marked.use({
    extensions: [
      blockMathExtension,
      definitionListExtension,
      superscriptExtension,
      subscriptExtension,
      highlightExtension,
    ],
    hooks: {
      preprocess(markdown) {
        if (suppressFootnotePreprocess) {
          return markdown;
        }
        resetExtendedMarkdownState();
        // ✅ Replace escaped dollar signs before marked.js strips the backslash.
        // This prevents MathJax from treating lone $ as a math delimiter.
        const protectedMarkdown = markdown.replace(/\\\$/g, '&#36;');
        return applyFootnotes(extractFootnoteDefinitions(protectedMarkdown));
      },
    },
  });

  marked.setOptions({
    ...markedOptions,
    renderer: renderer,
  });

  const GITHUB_ALERT_META = {
    note: {
      label: "Note",
      viewBox: "0 0 512 512",
      path: "M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336l24 0 0-64-24 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l48 0c13.3 0 24 10.7 24 24l0 88 8 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-80 0c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z",
    },
    tip: {
      label: "Tip",
      viewBox: "0 0 384 512",
      path: "M297.2 248.9C311.6 228.3 320 203.2 320 176c0-70.7-57.3-128-128-128S64 105.3 64 176c0 27.2 8.4 52.3 22.8 72.9c3.7 5.3 8.1 11.3 12.8 17.7c0 0 0 0 0 0c12.9 17.7 28.3 38.9 39.8 59.8c10.4 19 15.7 38.8 18.3 57.5L109 384c-2.2-12-5.9-23.7-11.8-34.5c-9.9-18-22.2-34.9-34.5-51.8c0 0 0 0 0 0s0 0 0 0c-5.2-7.1-10.4-14.2-15.4-21.4C27.6 247.9 16 213.3 16 176C16 78.8 94.8 0 192 0s176 78.8 176 176c0 37.3-11.6 71.9-31.4 100.3c-5 7.2-10.2 14.3-15.4 21.4c0 0 0 0 0 0s0 0 0 0c-12.3 16.8-24.6 33.7-34.5 51.8c-5.9 10.8-9.6 22.5-11.8 34.5l-48.6 0c2.6-18.7 7.9-38.6 18.3-57.5c11.5-20.9 26.9-42.1 39.8-59.8c0 0 0 0 0 0s0 0 0 0s0 0 0 0c4.7-6.4 9-12.4 12.7-17.7zM192 128c-26.5 0-48 21.5-48 48c0 8.8-7.2 16-16 16s-16-7.2-16-16c0-44.2 35.8-80 80-80c8.8 0 16 7.2 16 16s-7.2 16-16 16zm0 384c-44.2 0-80-35.8-80-80l0-16 160 0 0 16c0 44.2-35.8 80-80 80z",
    },
    important: {
      label: "Important",
      viewBox: "0 0 512 512",
      path: "M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24l0 112c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-112c0-13.3 10.7-24 24-24zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z",
    },
    warning: {
      label: "Warning",
      viewBox: "0 0 512 512",
      path: "M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S486.3 480 472 480L40 480c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8 .2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24l0 112c0 13.3 10.7 24 24 24s24-10.7 24-24l0-112c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z",
    },
    caution: {
      label: "Caution",
      viewBox: "0 0 512 512",
      path: "M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM175 175c9.4-9.4 24.6-9.4 33.9 0l47 47 47-47c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-47 47 47 47c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-47-47-47 47c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l47-47-47-47c-9.4-9.4-9.4-24.6 0-33.9z",
    },
  };
  const GITHUB_ALERT_MARKER_REGEX = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:(?:\s|&nbsp;|<br\s*\/?>)+|$)/i;

  function enhanceGitHubAlerts(container) {
    if (!container) return;

    const blockquotes = container.querySelectorAll("blockquote");
    blockquotes.forEach((blockquote) => {
      let firstParagraph = null;
      for (const child of blockquote.children) {
        if (child.tagName === "P") {
          firstParagraph = child;
          break;
        }
      }
      if (!firstParagraph) return;

    const firstParagraphHtml = firstParagraph.innerHTML.trim();
    const markerMatch = firstParagraphHtml.match(GITHUB_ALERT_MARKER_REGEX);
      if (!markerMatch) return;

      const alertType = markerMatch[1].toLowerCase();
      blockquote.classList.add("markdown-alert", `markdown-alert-${alertType}`);

      const title = document.createElement("p");
      title.className = "markdown-alert-title";
      const alertMeta = GITHUB_ALERT_META[alertType] || { label: markerMatch[1], path: "" };
      const icon = document.createElement("span");
      icon.className = "markdown-alert-icon";
      icon.setAttribute("aria-hidden", "true");

      if (alertMeta.path) {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", alertMeta.viewBox || "0 0 512 512");
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", alertMeta.path);
        svg.appendChild(path);
        icon.appendChild(svg);
      }

      const label = document.createElement("span");
      label.textContent = alertMeta.label;
      title.appendChild(icon);
      title.appendChild(label);

      blockquote.insertBefore(title, blockquote.firstChild);

    const remainingHtml = firstParagraphHtml
      .replace(GITHUB_ALERT_MARKER_REGEX, "")
      .trim();
      if (remainingHtml) {
        firstParagraph.innerHTML = remainingHtml;
      } else {
        firstParagraph.remove();
      }
    });
  }

  function parseFrontmatter(markdown) {
    const match = markdown.match(/^\s*---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
    if (!match) return { frontmatter: null, body: markdown };
    try {
      const data = jsyaml.load(match[1]) || {};
      return { frontmatter: data, body: markdown.slice(match[0].length) };
    } catch (e) {
      console.warn('Frontmatter YAML parse error:', e);
      return { frontmatter: null, body: markdown };
    }
  }

  function renderFrontmatterValue(value) {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) {
      const y = value.getUTCFullYear();
      const m = String(value.getUTCMonth() + 1).padStart(2, '0');
      const d = String(value.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    if (Array.isArray(value)) {
      const allPrimitive = value.every(v => v === null || typeof v !== 'object');
      if (allPrimitive) {
        return value
          .map(v => `<span class="fm-tag">${escapeHtml(String(v ?? ''))}</span>`)
          .join('');
      }
      return `<pre class="fm-complex">${escapeHtml(jsyaml.dump(value).trimEnd())}</pre>`;
    }
    if (typeof value === 'object') {
      return `<pre class="fm-complex">${escapeHtml(jsyaml.dump(value).trimEnd())}</pre>`;
    }
    return escapeHtml(String(value));
  }

  function renderFrontmatterTable(data) {
    const rows = Object.entries(data).map(([key, value]) =>
      `<tr><th>${escapeHtml(key)}</th><td>${renderFrontmatterValue(value)}</td></tr>`
    );
    return `<table class="frontmatter-table"><tbody>${rows.join('')}</tbody></table>`;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function encode6bit(b) {
    if (b < 10) return String.fromCharCode(48 + b); // '0'-'9'
    b -= 10;
    if (b < 26) return String.fromCharCode(65 + b); // 'A'-'Z'
    b -= 26;
    if (b < 26) return String.fromCharCode(97 + b); // 'a'-'z'
    b -= 26;
    if (b === 0) return '-';
    if (b === 1) return '_';
    return '?';
  }

  function append3bytes(b1, b2, b3) {
    const c1 = b1 >> 2;
    const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
    const c3 = ((b2 & 0xF) << 2) | (b3 >> 6);
    const c4 = b3 & 0x3F;
    let r = "";
    r += encode6bit(c1 & 0x3F);
    r += encode6bit(c2 & 0x3F);
    r += encode6bit(c3 & 0x3F);
    r += encode6bit(c4 & 0x3F);
    return r;
  }

  function encodePlantUML(text) {
    if (typeof pako === 'undefined') {
      throw new Error('pako is not loaded');
    }
    const utf8 = new TextEncoder().encode(text);
    const compressed = pako.deflate(utf8, { level: 9, raw: true });
    let result = "";
    for (let i = 0; i < compressed.length; i += 3) {
      const b1 = compressed[i];
      const b2 = i + 1 < compressed.length ? compressed[i + 1] : 0;
      const b3 = i + 2 < compressed.length ? compressed[i + 2] : 0;
      result += append3bytes(b1, b2, b3);
    }
    return result;
  }

  function encodeKrokiD2(text) {
    if (typeof pako === 'undefined') {
      throw new Error('pako is not loaded');
    }
    const utf8 = new TextEncoder().encode(text);
    const compressed = pako.deflate(utf8, { level: 9 });
    let binary = '';
    const len = compressed.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(compressed[i]);
    }
    const base64 = btoa(binary);
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  const REMOTE_DIAGRAM_ENGINES = Object.freeze({
    mermaid: { label: 'Mermaid', krokiType: 'mermaid' },
    plantuml: { label: 'PlantUML', krokiType: 'plantuml', local: true },
    d2: { label: 'D2', krokiType: 'd2', local: true },
    graphviz: { label: 'Graphviz', krokiType: 'graphviz' },
    vegalite: { label: 'Vega-Lite', krokiType: 'vegalite' },
    wavedrom: { label: 'WaveDrom', krokiType: 'wavedrom' },
    markmap: { label: 'Markmap', krokiType: 'markmap' }
  });
  const DIAGRAM_REQUEST_TIMEOUT = 15000;
  const DIAGRAM_REQUEST_RETRIES = 2;

  function loadDiagramLibrary(url) {
    return Promise.race([
      loadScript(url),
      new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error(`Timed out loading diagram library: ${url}`)), DIAGRAM_REQUEST_TIMEOUT);
      })
    ]);
  }

  function delayDiagramRetry(attempt) {
    return new Promise(resolve => setTimeout(resolve, 300 * attempt));
  }

  async function fetchDiagramSvgRequest(url, options, engine, attempts = DIAGRAM_REQUEST_RETRIES) {
    let lastError = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DIAGRAM_REQUEST_TIMEOUT);
      try {
        const response = await fetch(url, Object.assign({}, options, {
          signal: controller.signal,
          headers: Object.assign({ Accept: 'image/svg+xml' }, options && options.headers)
        }));
        const body = await response.text();
        if (!response.ok) {
          const error = new Error(`${engine} renderer returned HTTP ${response.status}`);
          error.status = response.status;
          error.responseBody = body.slice(0, 300);
          throw error;
        }
        if (!/<svg[\s>]/i.test(body)) {
          throw new Error(`${engine} renderer returned a non-SVG response`);
        }
        return body;
      } catch (error) {
        lastError = error;
        const transient = !error.status || error.status === 408 || error.status === 429 || error.status >= 500;
        console.warn('Diagram renderer request failed', {
          engine,
          attempt,
          status: error.status || null,
          message: error.message,
          url
        });
        if (!transient || attempt === attempts) break;
        await delayDiagramRetry(attempt);
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError || new Error(`${engine} renderer request failed`);
  }

  async function fetchKrokiDiagramSvg(engine, source) {
    const adapter = REMOTE_DIAGRAM_ENGINES[engine];
    if (!adapter) throw new Error(`Unsupported diagram engine: ${engine}`);

    let getError = null;
    if (typeof pako !== 'undefined') {
      const encoded = encodeKrokiD2(source);
      const getUrl = `https://kroki.io/${adapter.krokiType}/svg/${encoded}`;
      try {
        return await fetchDiagramSvgRequest(getUrl, { method: 'GET' }, adapter.label);
      } catch (error) {
        getError = error;
      }
    }

    try {
      return await fetchDiagramSvgRequest('https://kroki.io/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagram_source: source,
          diagram_type: adapter.krokiType,
          output_format: 'svg'
        })
      }, adapter.label);
    } catch (postError) {
      if (getError && getError.status && !postError.status) throw getError;
      if (getError && !postError.status) postError.cause = getError;
      throw postError;
    }
  }

  function normalizeDiagramSourceForRenderer(engine, source) {
    let normalized = String(source || '');
    const changes = [];

    if (engine === 'plantuml') {
      if (/@startuml[\s\S]*?\bnwdiag\s*\{/i.test(normalized)) {
        normalized = normalized
          .replace(/@startuml/i, '')
          .replace(/\bnwdiag\s*\{/i, '@startnwdiag')
          .replace(/\n\s*\}\s*\n\s*@enduml\s*$/i, '\n@endnwdiag');
        changes.push('legacy-nwdiag-wrapper');
      }
      
      const hasDefaultFont = /skinparam\s+defaultFontName\b/i.test(normalized);
      if (!hasDefaultFont) {
        const startRegex = /^(\s*@start[a-z]+)/mi;
        if (startRegex.test(normalized)) {
          normalized = normalized.replace(startRegex, '$1\nskinparam defaultFontName sans-serif');
        } else {
          normalized = 'skinparam defaultFontName sans-serif\n' + normalized;
        }
        changes.push('plantuml-default-font-fallback');
      }
    }

    if (engine === 'd2') {
      normalized = normalized.replace(/^([ \t]*[\w.-]+:\s*\{\s*\n)([\s\S]*?)(^[ \t]*\})/gm, (block, opening, body, closing) => {
        if (/\bconstraint\s*:/i.test(body) && !/^\s*shape\s*:\s*sql_table\s*$/im.test(body)) {
          changes.push('sql-table-shape');
          return `${opening}  shape: sql_table\n${body}${closing}`;
        }
        return block;
      });
      if (/^\s*style\.layout\s*:\s*grid\s*$/im.test(normalized)) {
        normalized = normalized.replace(/^([ \t]*)style\.layout\s*:\s*grid\s*$/gim, '$1grid-columns: 2');
        changes.push('grid-layout-property');
      }
      if (/^\s*shape\s*:\s*(?:mindmap|venn)\s*$/im.test(normalized)) {
        normalized = normalized.replace(/^([ \t]*)shape\s*:\s*(?:mindmap|venn)\s*$/gim, '$1direction: right');
        changes.push('unsupported-composite-shape');
      }
    }

    if (changes.length > 0) {
      console.info('Applied diagram source compatibility normalization', { engine, changes });
    }
    return normalized;
  }

  async function renderDiagramThroughAdapter(engine, source) {
    const adapter = REMOTE_DIAGRAM_ENGINES[engine];
    if (!adapter) throw new Error(`Unsupported diagram engine: ${engine}`);

    if (engine === 'markmap') {
      return renderMarkmapSvg(source);
    }

    const rendererSource = normalizeDiagramSourceForRenderer(engine, source);

    if (adapter.local && typeof Neutralino !== 'undefined') {
      try {
        const localSvg = await compileDiagramLocally(engine, rendererSource);
        if (localSvg) return localSvg;
      } catch (error) {
        console.warn('Local diagram renderer failed; using remote fallback', {
          engine,
          message: error.message
        });
      }
    }

    if (engine === 'plantuml') {
      try {
        const encoded = encodePlantUML(rendererSource);
        return await fetchDiagramSvgRequest(
          `https://www.plantuml.com/plantuml/svg/${encoded}`,
          { method: 'GET' },
          adapter.label
        );
      } catch (plantUmlError) {
        console.warn('Primary PlantUML renderer failed; using Kroki fallback', {
          status: plantUmlError.status || null,
          message: plantUmlError.message
        });
      }
    }

    return fetchKrokiDiagramSvg(engine, rendererSource);
  }

  function escapeDiagramXml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderMarkmapSvg(source) {
    const nodes = [];
    String(source || '').split(/\r?\n/).forEach(line => {
      const heading = /^(#{1,6})\s+(.+)$/.exec(line);
      const list = /^(\s*)[-*+]\s+(.+)$/.exec(line);
      if (!heading && !list) return;
      const level = heading ? heading[1].length : Math.floor(list[1].replace(/\t/g, '  ').length / 2) + 2;
      const label = (heading ? heading[2] : list[2]).replace(/[`*_~]/g, '').trim();
      if (!label) return;
      let parent = -1;
      for (let index = nodes.length - 1; index >= 0; index -= 1) {
        if (nodes[index].level < level) {
          parent = index;
          break;
        }
      }
      nodes.push({ level, label, parent });
    });

    if (!nodes.length) nodes.push({ level: 1, label: 'Mind map', parent: -1 });
    const minLevel = Math.min(...nodes.map(node => node.level));
    const horizontalGap = 190;
    const verticalGap = 64;
    const padding = 32;
    nodes.forEach((node, index) => {
      node.x = padding + (node.level - minLevel) * horizontalGap;
      node.y = padding + index * verticalGap;
      node.width = Math.min(Math.max(node.label.length * 7.2 + 28, 96), 176);
      node.height = 36;
    });
    const width = Math.max(...nodes.map(node => node.x + node.width)) + padding;
    const height = nodes[nodes.length - 1].y + nodes[nodes.length - 1].height + padding;
    const edges = nodes.filter(node => node.parent >= 0).map(node => {
      const parent = nodes[node.parent];
      return `<path d="M ${parent.x + parent.width} ${parent.y + parent.height / 2} C ${parent.x + parent.width + 48} ${parent.y + parent.height / 2}, ${node.x - 48} ${node.y + node.height / 2}, ${node.x} ${node.y + node.height / 2}" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.55"/>`;
    }).join('');
    const boxes = nodes.map((node, index) => `<g><rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="8" fill="${index === 0 ? '#dbeafe' : '#f3f4f6'}" stroke="${index === 0 ? '#2563eb' : '#64748b'}"/><text x="${node.x + 14}" y="${node.y + 23}" font-family="system-ui, sans-serif" font-size="13" fill="#172033">${escapeDiagramXml(node.label)}</text></g>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${edges}${boxes}</svg>`;
  }

  function importDiagramSvg(node, svgText, engine, source) {
    const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const svg = parsed.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== 'svg' || parsed.querySelector('parsererror')) {
      throw new Error(`${REMOTE_DIAGRAM_ENGINES[engine].label} returned invalid SVG`);
    }
    svg.querySelectorAll('script').forEach(script => script.remove());
    svg.querySelectorAll('*').forEach(element => {
      Array.from(element.attributes).forEach(attribute => {
        if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name);
      });
    });
    node.replaceChildren(document.importNode(svg, true));
    prepareDiagramSvg(node.querySelector('svg'), engine);
    normalizeDiagramSvg(node, engine, source);
  }

  function isLightCanvasFill(fill) {
    return /^(?:#fff(?:fff)?|white|rgb\(255\s*,\s*255\s*,\s*255\))$/i.test(String(fill || '').trim());
  }

  function prepareDiagramSvg(svg, engine) {
    if (!svg) return;
    svg.style.background = 'transparent';

    if (engine === 'graphviz') {
      const background = svg.querySelector('g.graph > polygon');
      if (background && isLightCanvasFill(background.getAttribute('fill'))) {
        background.remove();
      }
      return;
    }

    if (engine !== 'd2') return;
    const canvas = svg.matches('svg.d2-svg') ? svg : svg.querySelector('svg.d2-svg');
    if (!canvas) return;

    const canvasWidth = parseFloat(canvas.getAttribute('width')) || 0;
    const canvasHeight = parseFloat(canvas.getAttribute('height')) || 0;
    canvas.querySelectorAll('rect').forEach(rect => {
      // D2 uses full-size white rectangles inside masks to reveal connector
      // paths. Those are rendering primitives, not canvas backgrounds.
      if (rect.closest('defs, mask, clipPath, clippath')) return;
      const width = parseFloat(rect.getAttribute('width')) || 0;
      const height = parseFloat(rect.getAttribute('height')) || 0;
      if (isLightCanvasFill(rect.getAttribute('fill')) && width >= canvasWidth * 0.9 && height >= canvasHeight * 0.9) {
        rect.remove();
      }
    });

    try {
      const bounds = canvas.getBBox();
      if (!(bounds.width > 0 && bounds.height > 0)) return;
      const padding = 12;
      const x = bounds.x - padding;
      const y = bounds.y - padding;
      const width = bounds.width + padding * 2;
      const height = bounds.height + padding * 2;
      canvas.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
      if (canvas !== svg) {
        canvas.setAttribute('width', width);
        canvas.setAttribute('height', height);
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
      }
      svg.dataset.trimmedViewBox = `${x} ${y} ${width} ${height}`;
    } catch (error) {
      console.warn('Unable to trim D2 SVG bounds', { message: error.message });
    }
  }

  function normalizeDiagramSvg(node, engine, source) {
    const svg = node ? node.querySelector('svg') : null;
    if (!svg) return null;

    let intrinsicWidth = 0;
    let intrinsicHeight = 0;
    const viewBox = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    if (viewBox.length === 4 && viewBox.every(Number.isFinite)) {
      intrinsicWidth = Math.abs(viewBox[2]);
      intrinsicHeight = Math.abs(viewBox[3]);
    }

    if (!svg.getAttribute('viewBox')) {
      const width = parseFloat(svg.getAttribute('width'));
      const height = parseFloat(svg.getAttribute('height'));
      if (width > 0 && height > 0) {
        intrinsicWidth = width;
        intrinsicHeight = height;
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      }
    }

    const hasExplicitBackground = typeof source === 'string' && /backgroundcolor/i.test(source);
    if (engine === 'plantuml' && !hasExplicitBackground) svg.style.background = 'transparent';
    if (engine === 'd2' && /theme-id\s*:\s*[23]\d{2}\b/i.test(source || '')) {
      svg.dataset.diagramNativeDark = 'true';
    }
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${REMOTE_DIAGRAM_ENGINES[engine]?.label || 'Diagram'} preview`);
    if (intrinsicWidth > 0 && intrinsicHeight > 0) {
      const naturalWidth = `${intrinsicWidth}px`;
      svg.style.setProperty('--diagram-natural-width', naturalWidth);
      node.style.setProperty('--diagram-natural-width', naturalWidth);
      const viewer = node.closest('.diagram-viewer');
      if (viewer) viewer.style.setProperty('--diagram-natural-width', naturalWidth);
      svg.style.width = `min(100%, ${intrinsicWidth}px)`;
    } else {
      svg.style.width = 'auto';
    }
    svg.style.height = 'auto';
    svg.style.maxWidth = '100%';
    svg.style.maxHeight = 'min(70vh, 720px)';
    return svg;
  }

  function getDiagramFailureMessage(engine, error) {
    const label = REMOTE_DIAGRAM_ENGINES[engine]?.label || 'Diagram';
    if (error && (error.status === 400 || error.status === 422)) {
      return `${label} source was rejected by the renderer. Check the diagram syntax and retry.`;
    }
    if (error && error.name === 'AbortError') {
      return `${label} rendering timed out. Retry when the renderer is available.`;
    }
    return `${label} renderer is unavailable. Check your connection and retry.`;
  }

  async function renderRemoteDiagramNode(node, engine, context) {
    const container = node.closest('[data-diagram-engine], .plantuml-container, .d2-container, .graphviz-container, .kroki-container');
    const originalCode = node.getAttribute('data-original-code');
    if (!container || !originalCode) return;
    const source = decodeURIComponent(originalCode);

    setDiagramRenderState(container, 'loading', `Rendering ${REMOTE_DIAGRAM_ENGINES[engine].label}…`);
    try {
      const svgText = await renderDiagramThroughAdapter(engine, source);
      if (context.renderId !== previewRenderGeneration || !document.body.contains(node)) return;
      importDiagramSvg(node, svgText, engine, source);
      setDiagramRenderState(container, 'ready');
      mountDiagramViewer(container, engine);
    } catch (error) {
      if (context.renderId !== previewRenderGeneration || !document.body.contains(node)) return;
      console.error('Diagram rendering failed', {
        engine,
        status: error.status || null,
        message: error.message,
        response: error.responseBody || null
      });
      setDiagramRenderState(container, 'error', getDiagramFailureMessage(engine, error), () => {
        renderRemoteDiagramNode(node, engine, context);
      });
    }
  }

  function typesetMathJaxTargets(mathTargets, context) {
    const runId = ++mathJaxTypesetRunId;
    const mathJaxReady = MathJax.startup && MathJax.startup.promise
      ? MathJax.startup.promise
      : Promise.resolve();

    mathJaxTypesetPromise = mathJaxTypesetPromise.catch(function() {
      // Continue with the newest render after a previous MathJax run fails.
    }).then(function() {
      return mathJaxReady;
    }).then(function() {
      if (runId !== mathJaxTypesetRunId) return null;
      if (context.renderId !== previewRenderGeneration) return;
      if (typeof MathJax.typesetPromise !== 'function') {
        throw new Error('MathJax typesetPromise API is unavailable.');
      }
      const connectedTargets = mathTargets.filter(function(target) {
        return target && target.isConnected;
      });
      if (connectedTargets.length === 0) return null;
      return MathJax.typesetPromise(connectedTargets);
    }).then(function() {
      if (runId !== mathJaxTypesetRunId) return;
      if (context.renderId !== previewRenderGeneration) return;
      queryPreviewRoots(mathTargets, 'mjx-container[tabindex="0"]').forEach(function(mjx) {
        mjx.removeAttribute('tabindex');
      });
    }).catch(function(err) {
      console.warn('MathJax typesetting failed:', err);
    });

    return mathJaxTypesetPromise;
  }

  function configureMathJax() {
    if (window.MathJax && typeof MathJax.typesetPromise === 'function') return;
    if (window.MathJax && MathJax.loader && MathJax.tex) return;
    window.MathJax = {
      loader: { load: ['[tex]/boldsymbol'] },
      startup: {
        typeset: false
      },
      options: {
        a11y: { inTabOrder: false }
      },
      tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']],
        processEscapes: true,
        packages: { '[+]': ['ams', 'boldsymbol'] }
      }
    };
  }

  function ensureMathJaxReady() {
    if (window.MathJax && typeof MathJax.typesetPromise === 'function') {
      return MathJax.startup && MathJax.startup.promise
        ? MathJax.startup.promise
        : Promise.resolve();
    }

    configureMathJax();
    if (!mathJaxLoadPromise) {
      mathJaxLoadPromise = loadScript(CDN.mathjax)
        .then(function() {
          return MathJax.startup && MathJax.startup.promise
            ? MathJax.startup.promise
            : Promise.resolve();
        })
        .catch(function(error) {
          mathJaxLoadPromise = null;
          throw error;
        });
    }
    return mathJaxLoadPromise;
  }

  function clearMathJaxPreviewState(container) {
    if (!window.MathJax || typeof MathJax.typesetClear !== 'function' || !container) return;
    try {
      MathJax.typesetClear([container]);
    } catch (error) {
      console.warn('MathJax cleanup failed:', error);
    }
  }

  // PERF-012: Inlined default template to eliminate network request, FOUC, and layout shifts
  const defaultMarkdownTemplate = document.getElementById('default-markdown');
  let templateText = '';
  if (defaultMarkdownTemplate) {
    if (defaultMarkdownTemplate.content && typeof defaultMarkdownTemplate.content.textContent === 'string') {
      templateText = defaultMarkdownTemplate.content.textContent.trim();
    } else {
      templateText = defaultMarkdownTemplate.textContent ? defaultMarkdownTemplate.textContent.trim() : '';
    }
  }
  const sampleMarkdown = templateText || '# Welcome to Markdown Viewer\n\nStart typing your markdown here...';

  if (!markdownEditor.value) {
    markdownEditor.value = sampleMarkdown;
  }

  // ========================================
  // DOCUMENT TABS & SESSION MANAGEMENT
  // ========================================

  const STORAGE_KEY = 'markdownViewerTabs';
  const ACTIVE_TAB_KEY = 'markdownViewerActiveTab';
  const UNTITLED_COUNTER_KEY = 'markdownViewerUntitledCounter';
  let tabs = [];
  let activeTabId = null;
  let draggedTabId = null;
  let saveTabStateTimeout = null;
  let untitledCounter = 0;

  function getExportFilename(extension, fallback) {
    const activeTab = tabs.find(function(t) { return t.id === activeTabId; });
    let title = activeTab ? activeTab.title : "";
    if (title) {
      title = title.replace(/\.(md|markdown|html|pdf|png)$/i, '');
      title = title.replace(/[\\/:*?"<>|]/g, "_").trim();
    }
    return title ? `${title}.${extension}` : fallback;
  }

  function loadTabsFromStorage() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveTabsToStorage(tabsArr) {
    // PERF-008: Debounce tab saves to reduce main thread blocking from JSON.stringify
    // on large document arrays. Immediate flush happens on visibilitychange/beforeunload.
    clearTimeout(saveTabStateTimeout);
    saveTabStateTimeout = setTimeout(function() {
      _flushTabsToStorage(tabsArr);
    }, 500);
  }

  function _flushTabsToStorage(tabsArr) {
    clearTimeout(saveTabStateTimeout);
    try {
      saveStorageItem(STORAGE_KEY, JSON.stringify(tabsArr || tabs));
    } catch (e) {
      console.warn('Failed to save tabs to localStorage:', e);
    }
  }

  // Ensure tabs are persisted before page close (PERF-008)
  window.addEventListener('beforeunload', function() { _flushTabsToStorage(tabs); });
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') _flushTabsToStorage(tabs);
  });

  function loadActiveTabId() {
    return localStorage.getItem(ACTIVE_TAB_KEY);
  }

  function saveActiveTabId(id) {
    saveStorageItem(ACTIVE_TAB_KEY, id);
  }

  function loadUntitledCounter() {
    return parseInt(localStorage.getItem(UNTITLED_COUNTER_KEY) || '0', 10);
  }

  function saveUntitledCounter(val) {
    saveStorageItem(UNTITLED_COUNTER_KEY, String(val));
  }

  function nextUntitledTitle() {
    untitledCounter += 1;
    saveUntitledCounter(untitledCounter);
    return 'Untitled ' + untitledCounter;
  }

  function createTab(content, title, viewMode) {
    if (content === undefined) content = '';
    if (title === undefined) title = null;
    if (viewMode === undefined) viewMode = 'split';
    return {
      id: 'tab_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      title: title || 'Untitled',
      content: content,
      scrollPos: 0,
      viewMode: viewMode,
      createdAt: Date.now()
    };
  }

  function closeTabMenus() {
    document.querySelectorAll('.tab-menu-btn.open').forEach(function(btn) {
      btn.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });
    document.querySelectorAll('.tab-menu-dropdown.open').forEach(function(dropdown) {
      dropdown.classList.remove('open');
    });
  }

  function removeTabMenuDropdowns() {
    document.querySelectorAll('.tab-menu-dropdown[data-tab-menu-dropdown="true"]').forEach(function(dropdown) {
      dropdown.remove();
    });
  }

  function positionTabMenu(menuBtn, dropdown) {
    const rect = menuBtn.getBoundingClientRect();
    const margin = 8;
    const dropdownWidth = dropdown.offsetWidth || 130;
    const dropdownHeight = dropdown.offsetHeight || 110;
    let left = rect.right - dropdownWidth;
    let top = rect.bottom + 4;

    left = Math.max(margin, Math.min(left, window.innerWidth - dropdownWidth - margin));
    if (top + dropdownHeight > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - dropdownHeight - 4);
    }

    dropdown.style.top = top + 'px';
    dropdown.style.left = left + 'px';
    dropdown.style.right = 'auto';
  }

  function runTabMenuAction(tabId, action, isMobileMenu) {
    if (action === 'rename') {
      if (isMobileMenu) closeMobileMenu();
      renameTab(tabId);
    } else if (action === 'duplicate') {
      duplicateTab(tabId);
      if (isMobileMenu) closeMobileMenu();
    } else if (action === 'delete') {
      deleteTab(tabId);
    }
  }

  function createTabActionMenu(tab, options) {
    const isMobileMenu = options && options.isMobileMenu;
    const menuIdPrefix = options && options.menuIdPrefix ? options.menuIdPrefix : 'tab-menu';
    const menuId = menuIdPrefix + '-' + tab.id;

    const menuBtn = document.createElement('button');
    menuBtn.type = 'button';
    menuBtn.className = 'tab-menu-btn';
    menuBtn.setAttribute('aria-label', 'File options for ' + (tab.title || 'Untitled'));
    menuBtn.setAttribute('aria-haspopup', 'menu');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.setAttribute('aria-controls', menuId);
    menuBtn.setAttribute('draggable', 'false');
    menuBtn.title = 'File options';
    // PERF-007: Replace HTML entity with plain unicode character set via textContent
    menuBtn.textContent = '⋯';

    const dropdown = document.createElement('div');
    dropdown.id = menuId;
    dropdown.className = 'tab-menu-dropdown';
    dropdown.setAttribute('data-tab-menu-dropdown', 'true');
    dropdown.setAttribute('role', 'menu');
    dropdown.innerHTML =
      '<button type="button" class="tab-menu-item" role="menuitem" data-action="rename"><i class="bi bi-pencil"></i> Rename</button>' +
      '<button type="button" class="tab-menu-item" role="menuitem" data-action="duplicate"><i class="bi bi-files"></i> Duplicate</button>' +
      '<button type="button" class="tab-menu-item tab-menu-item-danger" role="menuitem" data-action="delete"><i class="bi bi-trash"></i> Delete</button>';

    menuBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const shouldOpen = !menuBtn.classList.contains('open');
      closeTabMenus();
      if (shouldOpen) {
        menuBtn.classList.add('open');
        menuBtn.setAttribute('aria-expanded', 'true');
        dropdown.classList.add('open');
        positionTabMenu(menuBtn, dropdown);
      }
    });

    menuBtn.addEventListener('mousedown', function(e) {
      e.stopPropagation();
    });

    menuBtn.addEventListener('dragstart', function(e) {
      e.preventDefault();
      e.stopPropagation();
    });

    dropdown.addEventListener('click', function(e) {
      e.stopPropagation();
    });

    dropdown.querySelectorAll('.tab-menu-item').forEach(function(actionBtn) {
      actionBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const action = actionBtn.getAttribute('data-action');
        closeTabMenus();
        runTabMenuAction(tab.id, action, isMobileMenu);
      });
    });

    document.body.appendChild(dropdown);

    return { button: menuBtn, dropdown: dropdown };
  }

  function renderTabBar(tabsArr, currentActiveTabId) {
    const tabList = document.getElementById('tab-list');
    if (!tabList) return;
    closeTabMenus();
    removeTabMenuDropdowns();
    // PERF-007: Use textContent instead of innerHTML to clear elements faster
    tabList.textContent = '';
    tabsArr.forEach(function(tab) {
      const item = document.createElement('div');
      item.className = 'tab-item' + (tab.id === currentActiveTabId ? ' active' : '');
      item.setAttribute('data-tab-id', tab.id);
      item.setAttribute('role', 'tab');
      item.setAttribute('aria-selected', tab.id === currentActiveTabId ? 'true' : 'false');
      item.setAttribute('draggable', 'true');
      item.setAttribute('tabindex', tab.id === currentActiveTabId ? '0' : '-1');

      const titleSpan = document.createElement('span');
      titleSpan.className = 'tab-title';
      titleSpan.textContent = tab.title || 'Untitled';
      titleSpan.title = tab.title || 'Untitled';

      const tabMenu = createTabActionMenu(tab, { menuIdPrefix: 'desktop-tab-menu' });

      item.appendChild(titleSpan);
      item.appendChild(tabMenu.button);

      item.addEventListener('dragstart', function() {
        draggedTabId = tab.id;
        setTimeout(function() { item.classList.add('dragging'); }, 0);
      });

      item.addEventListener('dragend', function() {
        item.classList.remove('dragging');
        draggedTabId = null;
      });

      item.addEventListener('dragover', function(e) {
        e.preventDefault();
        item.classList.add('drag-over');
      });

      item.addEventListener('dragleave', function() {
        item.classList.remove('drag-over');
      });

      item.addEventListener('drop', function(e) {
        e.preventDefault();
        item.classList.remove('drag-over');
        if (!draggedTabId || draggedTabId === tab.id) return;
        const fromIdx = tabs.findIndex(function(t) { return t.id === draggedTabId; });
        const toIdx = tabs.findIndex(function(t) { return t.id === tab.id; });
        if (fromIdx === -1 || toIdx === -1) return;
        const moved = tabs.splice(fromIdx, 1)[0];
        tabs.splice(toIdx, 0, moved);
        saveTabsToStorage(tabs);
        renderTabBar(tabs, activeTabId);
      });

      tabList.appendChild(item);
    });

    // PERF-006: Event delegation — single click handler for all tabs
    tabList.onclick = function(e) {
      const tabItem = e.target.closest('.tab-item');
      if (!tabItem) return;
      // Don't switch tab if clicking the menu button
      if (e.target.closest('.tab-menu-btn')) return;
      const tabId = tabItem.getAttribute('data-tab-id');
      if (tabId) switchTab(tabId);
    };


    // Auto-scroll active tab into view (paint-aligned to prevent forced reflows)
    const activeItem = tabList.querySelector('.tab-item.active');
    if (activeItem) {
      requestAnimationFrame(function() {
        activeItem.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    }

    // Arrow-key keyboard navigation inside tabList (WAI-ARIA compliance with manual selection)
    tabList.onkeydown = function(e) {
      const items = Array.from(tabList.querySelectorAll('.tab-item'));
      if (items.length === 0) return;
      
      const focusedItem = document.activeElement.closest('.tab-item');
      if (!focusedItem) return;
      
      const activeIdx = items.indexOf(focusedItem);
      if (activeIdx === -1) return;
      
      let targetIdx = -1;
      if (e.key === 'ArrowRight') {
        targetIdx = (activeIdx + 1) % items.length;
      } else if (e.key === 'ArrowLeft') {
        targetIdx = (activeIdx - 1 + items.length) % items.length;
      } else if (e.key === 'Home') {
        targetIdx = 0;
      } else if (e.key === 'End') {
        targetIdx = items.length - 1;
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const tabId = focusedItem.getAttribute('data-tab-id');
        switchTab(tabId);
        // After switch tab, focus the active item in the newly rendered tab bar
        requestAnimationFrame(function() {
          const newActive = tabList.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
          if (newActive) newActive.focus();
        });
        return;
      }
      
      if (targetIdx !== -1) {
        e.preventDefault();
        // Update roving tabindex focus without triggering heavy re-renders
        items.forEach(function(item, idx) {
          if (idx === targetIdx) {
            item.setAttribute('tabindex', '0');
            item.focus();
          } else {
            item.setAttribute('tabindex', '-1');
          }
        });
      }
    };

    renderMobileTabList(tabsArr, currentActiveTabId);
    if (typeof tabList.dispatchEvent === 'function') {
      tabList.dispatchEvent(new Event('scroll'));
    }
  }

  // ========================================
  // TAB OVERFLOW — Scroll Buttons, Wheel, Indicators
  // ========================================

  var _tabOverflowInitialized = false;

  function setupTabOverflow() {
    if (_tabOverflowInitialized) return;
    _tabOverflowInitialized = true;

    var tabBar = document.getElementById('tab-bar');
    var tabList = document.getElementById('tab-list');
    if (!tabBar || !tabList) return;

    // --- Create scroll arrow buttons ---
    var scrollLeftBtn = document.createElement('button');
    scrollLeftBtn.className = 'tab-scroll-btn tab-scroll-left';
    scrollLeftBtn.setAttribute('aria-label', 'Scroll tabs left');
    scrollLeftBtn.title = 'Scroll left';
    scrollLeftBtn.innerHTML = '<i class="bi bi-chevron-left"></i>';
    scrollLeftBtn.addEventListener('click', function() {
      tabList.scrollBy({ left: -200, behavior: 'smooth' });
    });

    var scrollRightBtn = document.createElement('button');
    scrollRightBtn.className = 'tab-scroll-btn tab-scroll-right';
    scrollRightBtn.setAttribute('aria-label', 'Scroll tabs right');
    scrollRightBtn.title = 'Scroll right';
    scrollRightBtn.innerHTML = '<i class="bi bi-chevron-right"></i>';
    scrollRightBtn.addEventListener('click', function() {
      tabList.scrollBy({ left: 200, behavior: 'smooth' });
    });

    // Insert scroll buttons flanking the tab-list
    tabBar.insertBefore(scrollLeftBtn, tabList);
    var newBtn = document.getElementById('tab-new-btn');
    if (newBtn) {
      tabBar.insertBefore(scrollRightBtn, newBtn);
    } else {
      var resetBtn = document.getElementById('tab-reset-btn');
      if (resetBtn) {
        tabBar.insertBefore(scrollRightBtn, resetBtn);
      } else {
        tabBar.appendChild(scrollRightBtn);
      }
    }

    // --- Overflow detection ---
    var _overflowRafId = null;
    function updateOverflowState() {
      if (_overflowRafId) return;
      _overflowRafId = requestAnimationFrame(function() {
        _overflowRafId = null;
        var hasLeft = tabList.scrollLeft > 1;
        var hasRight = tabList.scrollLeft < (tabList.scrollWidth - tabList.clientWidth - 1);
        tabBar.classList.toggle('has-overflow-left', hasLeft);
        tabBar.classList.toggle('has-overflow-right', hasRight);
      });
    }

    tabList.addEventListener('scroll', updateOverflowState);

    // Use ResizeObserver to detect when overflow state changes due to window resize
    if (typeof ResizeObserver !== 'undefined') {
      var resizeObs = new ResizeObserver(updateOverflowState);
      resizeObs.observe(tabList);
    }

    // Initial check
    updateOverflowState();

    // --- Mouse wheel scroll: vertical wheel → horizontal scroll ---
    tabList.addEventListener('wheel', function(e) {
      // Only intercept vertical wheel (don't fight native horizontal wheel/trackpad)
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        tabList.scrollLeft += e.deltaY;
        updateOverflowState();
      }
    }, { passive: false });
  }

  function renderMobileTabList(tabsArr, currentActiveTabId) {
    const mobileTabList = document.getElementById('mobile-tab-list');
    if (!mobileTabList) return;
    // PERF-007: Clear element content using textContent instead of innerHTML
    mobileTabList.textContent = '';
    tabsArr.forEach(function(tab) {
      const item = document.createElement('div');
      item.className = 'mobile-tab-item' + (tab.id === currentActiveTabId ? ' active' : '');
      item.setAttribute('role', 'tab');
      item.setAttribute('aria-selected', tab.id === currentActiveTabId ? 'true' : 'false');
      item.setAttribute('data-tab-id', tab.id);

      const titleSpan = document.createElement('span');
      titleSpan.className = 'mobile-tab-title';
      titleSpan.textContent = tab.title || 'Untitled';
      titleSpan.title = tab.title || 'Untitled';

      const tabMenu = createTabActionMenu(tab, {
        isMobileMenu: true,
        menuIdPrefix: 'mobile-tab-menu'
      });

      item.appendChild(titleSpan);
      item.appendChild(tabMenu.button);

      item.addEventListener('click', function() {
        switchTab(tab.id);
        closeMobileMenu();
      });

      mobileTabList.appendChild(item);
    });
  }

  // Close any open tab dropdown when clicking elsewhere in the document
  document.addEventListener('click', function() {
    closeTabMenus();
  });

  function saveCurrentTabState() {
    const tab = tabs.find(function(t) { return t.id === activeTabId; });
    if (!tab) return;
    tab.content = markdownEditor.value;
    tab.scrollPos = markdownEditor.scrollTop;
    tab.viewMode = currentViewMode || 'split';
    saveTabsToStorage(tabs);
  }

  function restoreViewMode(mode) {
    currentViewMode = null;
    setViewMode(mode || 'split');
  }

  function switchTab(tabId) {
    if (tabId === activeTabId) return;
    saveCurrentTabState();
    
    // Clear typing timeout and reset tracking for the new tab
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      typingTimeout = null;
    }
    lastInputType = null;
    pendingState = null;
    
    activeTabId = tabId;
    saveActiveTabId(activeTabId);
    const tab = tabs.find(function(t) { return t.id === tabId; });
    if (!tab) return;
    markdownEditor.value = tab.content;
    
    initTabHistory(tabId, tab.content);
    lastPushedValue = tab.content;
    currentHistoryTabId = tabId;
    updateUndoRedoButtons();
    
    restoreViewMode(tab.viewMode);
    renderMarkdown();
    requestAnimationFrame(function() {
      markdownEditor.scrollTop = tab.scrollPos || 0;
    });
    renderTabBar(tabs, activeTabId);
  }

  function newTab(content, title) {
    if (content === undefined) content = '';
    if (tabs.length >= 20) {
      alert('Maximum of 20 tabs reached. Please close an existing tab to open a new one.');
      return;
    }
    if (!title) title = nextUntitledTitle();
    const tab = createTab(content, title);
    tabs.push(tab);
    switchTab(tab.id);
    markdownEditor.focus();
  }

  function closeTab(tabId) {
    const idx = tabs.findIndex(function(t) { return t.id === tabId; });
    if (idx === -1) return;
    
    // Clean up history of the closed tab
    if (tabHistories[tabId]) {
      delete tabHistories[tabId];
    }
    
    tabs.splice(idx, 1);
    if (tabs.length === 0) {
      // Auto-create new "Untitled" when last tab is deleted
      const newT = createTab('', nextUntitledTitle());
      tabs.push(newT);
      activeTabId = newT.id;
      saveActiveTabId(activeTabId);
      markdownEditor.value = '';
      restoreViewMode('split');
      renderMarkdown();
    } else if (activeTabId === tabId) {
      const newIdx = Math.max(0, idx - 1);
      activeTabId = tabs[newIdx].id;
      saveActiveTabId(activeTabId);
      const newActiveTab = tabs[newIdx];
      markdownEditor.value = newActiveTab.content;
      restoreViewMode(newActiveTab.viewMode);
      renderMarkdown();
      requestAnimationFrame(function() {
        markdownEditor.scrollTop = newActiveTab.scrollPos || 0;
      });
    }
    saveTabsToStorage(tabs);
    renderTabBar(tabs, activeTabId);
  }

  function deleteTab(tabId) {
    closeTab(tabId);
  }

  function renameTab(tabId) {
    const tab = tabs.find(function(t) { return t.id === tabId; });
    if (!tab) return;
    const modal = document.getElementById('rename-modal');
    const input = document.getElementById('rename-modal-input');
    const confirmBtn = document.getElementById('rename-modal-confirm');
    const cancelBtn = document.getElementById('rename-modal-cancel');
    if (!modal || !input) return;
    input.value = tab.title;

    function doRename() {
      const newName = input.value.trim();
      if (newName) {
        tab.title = newName;
        saveTabsToStorage(tabs);
        renderTabBar(tabs, activeTabId);
      }
      closeAppModal(modal);
      cleanup();
    }

    function doCancel() {
      closeAppModal(modal);
      cleanup();
    }

    function onKey(e) {
      if (e.key === 'Enter') doRename();
    }

    function cleanup() {
      confirmBtn.removeEventListener('click', doRename);
      cancelBtn.removeEventListener('click', doCancel);
      input.removeEventListener('keydown', onKey);
    }

    confirmBtn.addEventListener('click', doRename);
    cancelBtn.addEventListener('click', doCancel);
    input.addEventListener('keydown', onKey);

    openAppModal(modal, {
      focusTarget: input,
      onClose: doCancel
    });
    input.select();
  }

  function duplicateTab(tabId) {
    const tab = tabs.find(function(t) { return t.id === tabId; });
    if (!tab) return;
    if (tabs.length >= 20) {
      alert('Maximum of 20 tabs reached. Please close an existing tab to open a new one.');
      return;
    }
    const shouldSwitchToDuplicate = tabId === activeTabId;
    saveCurrentTabState();
    const dupTitle = tab.title + ' (copy)';
    const dup = createTab(tab.content, dupTitle, tab.viewMode);
    const idx = tabs.findIndex(function(t) { return t.id === tabId; });
    tabs.splice(idx + 1, 0, dup);
    if (shouldSwitchToDuplicate) {
      switchTab(dup.id);
    } else {
      saveTabsToStorage(tabs);
      renderTabBar(tabs, activeTabId);
    }
  }

  function resetAllTabs() {
    const modal = document.getElementById('reset-confirm-modal');
    const confirmBtn = document.getElementById('reset-modal-confirm');
    const cancelBtn = document.getElementById('reset-modal-cancel');
    if (!modal) return;

    function doReset() {
      closeAppModal(modal);
      cleanup();
      tabs = [];
      untitledCounter = 0;
      saveUntitledCounter(0);
      const welcome = createTab(sampleMarkdown, 'Welcome to Markdown');
      tabs.push(welcome);
      activeTabId = welcome.id;
      saveActiveTabId(activeTabId);
      saveTabsToStorage(tabs);
      markdownEditor.value = sampleMarkdown;
      restoreViewMode('split');
      renderMarkdown();
      renderTabBar(tabs, activeTabId);
    }

    function doCancel() {
      closeAppModal(modal);
      cleanup();
    }

    function cleanup() {
      confirmBtn.removeEventListener('click', doReset);
      cancelBtn.removeEventListener('click', doCancel);
    }

    confirmBtn.addEventListener('click', doReset);
    cancelBtn.addEventListener('click', doCancel);

    openAppModal(modal, {
      focusTarget: confirmBtn,
      onClose: doCancel
    });
  }

  function initTabs() {
    untitledCounter = loadUntitledCounter();
    tabs = loadTabsFromStorage();
    activeTabId = loadActiveTabId();

    // Check if Neutralino passed an initial file via command line (early load)
    if (window.NL_INITIAL_FILE_CONTENT) {
      const initialFile = window.NL_INITIAL_FILE_CONTENT;
      const tab = createTab(initialFile.content, initialFile.name);
      tabs.push(tab);
      activeTabId = tab.id;
      saveTabsToStorage(tabs);
      saveActiveTabId(activeTabId);
      delete window.NL_INITIAL_FILE_CONTENT;
    } else if (tabs.length === 0) {
      const tab = createTab(sampleMarkdown, 'Welcome to Markdown');
      tabs.push(tab);
      activeTabId = tab.id;
      saveTabsToStorage(tabs);
      saveActiveTabId(activeTabId);
    } else if (!tabs.find(function(t) { return t.id === activeTabId; })) {
      activeTabId = tabs[0].id;
      saveActiveTabId(activeTabId);
    }
    const activeTab = tabs.find(function(t) { return t.id === activeTabId; });
    markdownEditor.value = activeTab.content;
    initTabHistory(activeTabId, activeTab.content);
    updateUndoRedoButtons();
    restoreViewMode(activeTab.viewMode);
    renderMarkdown();
    const editorPane = document.querySelector('.editor-pane');
    if (editorPane) {
      editorPane.classList.remove('is-loading');
    }
    requestAnimationFrame(function() {
      markdownEditor.scrollTop = activeTab.scrollPos || 0;
    });
    renderTabBar(tabs, activeTabId);
    setupTabOverflow();

    const staticNewBtn = document.getElementById('tab-new-btn');
    if (staticNewBtn) {
      staticNewBtn.onclick = function() {
        newTab();
      };
    }
  }

  // Late-load callback hook for Neutralino command-line files
  window.NL_IMPORT_EXTERNAL_FILE = function(content, name) {
    if (typeof tabs === 'undefined') return;
    const existing = tabs.find(function(t) { return t.title === name && t.content === content; });
    if (existing) {
      switchTab(existing.id);
      return;
    }
    newTab(content, name);
  };

  function showPreviewSkeleton() {
    if (markdownPreview && !markdownPreview.querySelector('#markdown-preview-skeleton')) {
      markdownPreview.setAttribute('aria-busy', 'true');
      markdownPreview.dataset.renderState = 'loading';
      markdownPreview.innerHTML = `
        <div class="skeleton-preview-container" id="markdown-preview-skeleton" aria-hidden="true">
            <div class="skeleton-placeholder skeleton-title"></div>
            <div class="skeleton-placeholder skeleton-line skeleton-w90"></div>
            <div class="skeleton-placeholder skeleton-line skeleton-w85"></div>
            <div class="skeleton-placeholder skeleton-line skeleton-w60"></div>
            
            <div class="skeleton-placeholder skeleton-subtitle"></div>
            <div class="skeleton-placeholder skeleton-line skeleton-w88"></div>
            <div class="skeleton-placeholder skeleton-line skeleton-w92"></div>
            <div class="skeleton-placeholder skeleton-line skeleton-w45"></div>
        </div>
      `;
    }
  }

  function previewContainsSkeleton() {
    return Boolean(markdownPreview && markdownPreview.querySelector('#markdown-preview-skeleton'));
  }

  function getActivePreviewDocumentId() {
    return activeTabId || '__single-document__';
  }

  function clearPendingPreviewWork() {
    if (pendingPreviewRenderCancel) {
      pendingPreviewRenderCancel();
      pendingPreviewRenderCancel = null;
    }
  }

  function getPreviewRenderDelay(markdown) {
    const length = markdown.length;
    if (length >= HUGE_DOCUMENT_THRESHOLD) return HUGE_RENDER_DELAY;
    if (length >= LARGE_DOCUMENT_THRESHOLD) return LARGE_RENDER_DELAY;
    return RENDER_DELAY;
  }

  function getEditorWorkDelay(markdown) {
    const length = markdown.length;
    if (length >= HUGE_DOCUMENT_THRESHOLD) return HUGE_EDITOR_WORK_DELAY;
    if (length >= LARGE_DOCUMENT_THRESHOLD) return LARGE_EDITOR_WORK_DELAY;
    return 0;
  }

  function isEditorVisible() {
    return currentViewMode === 'editor' || currentViewMode === 'split';
  }

  function deferPreviewWork(callback, rawLength) {
    let cancelled = false;
    let rafId = null;
    let idleId = null;
    let timeoutId = null;

    rafId = requestAnimationFrame(function() {
      rafId = null;
      if (cancelled) return;

      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(function() {
          idleId = null;
          if (!cancelled) callback();
        }, { timeout: rawLength >= HUGE_DOCUMENT_THRESHOLD ? 700 : 350 });
      } else {
        timeoutId = setTimeout(function() {
          timeoutId = null;
          if (!cancelled) callback();
        }, 0);
      }
    });

    return function cancelDeferredPreviewWork() {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (idleId !== null && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId);
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }

  function capturePreviewScroll() {
    if (!previewPane) return null;
    return {
      top: previewPane.scrollTop,
      left: previewPane.scrollLeft,
    };
  }

  function restorePreviewScroll(snapshot) {
    if (!snapshot || !previewPane) return;
    requestAnimationFrame(function() {
      const maxTop = Math.max(0, previewPane.scrollHeight - previewPane.clientHeight);
      previewPane.scrollTop = Math.min(maxTop, snapshot.top);
      previewPane.scrollLeft = snapshot.left;
    });
  }

  function canReusePreviewNode(currentNode, nextNode, options) {
    if (!currentNode || !nextNode || currentNode.nodeType !== nextNode.nodeType) return false;

    if (currentNode.nodeType === Node.TEXT_NODE) {
      if (currentNode.nodeValue !== nextNode.nodeValue) {
        currentNode.nodeValue = nextNode.nodeValue;
      }
      return true;
    }

    if (currentNode.nodeType !== Node.ELEMENT_NODE) {
      return currentNode.nodeValue === nextNode.nodeValue;
    }

    if (currentNode.nodeName !== nextNode.nodeName) return false;

    const currentEl = currentNode;
    const nextEl = nextNode;
    if ((currentEl.id || nextEl.id) && currentEl.id !== nextEl.id) return false;

    if (
      options &&
      options.reusePreviewBlocks &&
      currentEl.dataset &&
      nextEl.dataset &&
      currentEl.dataset.previewBlockHash &&
      currentEl.dataset.previewBlockHash === nextEl.dataset.previewBlockHash
    ) {
      return true;
    }

    if (currentEl.outerHTML === nextEl.outerHTML) return true;

    if (currentEl.tagName === 'DETAILS' && nextEl.tagName === 'DETAILS' && currentEl.hasAttribute('open')) {
      nextEl.setAttribute('open', '');
    }

    return false;
  }

  function patchPreviewDom(container, html, options) {
    const result = {
      fullReplace: false,
      updatedNodes: [],
    };

    if (!previewHasCommittedRender || previewContainsSkeleton()) {
      container.innerHTML = html;
      result.fullReplace = true;
      result.updatedNodes = [container];
      return result;
    }

    const template = document.createElement('template');
    template.innerHTML = html;
    const nextNodes = Array.from(template.content.childNodes);
    const currentNodeCount = container.childNodes.length;

    if (nextNodes.length > 6000 || currentNodeCount > 6000) {
      container.replaceChildren(...nextNodes);
      result.fullReplace = true;
      result.updatedNodes = [container];
      return result;
    }

    let index = 0;
    while (index < nextNodes.length || index < container.childNodes.length) {
      const currentNode = container.childNodes[index];
      const nextNode = nextNodes[index];

      if (!nextNode) {
        currentNode.remove();
        continue;
      }

      if (!currentNode) {
        container.appendChild(nextNode);
        result.updatedNodes.push(nextNode);
        index += 1;
        continue;
      }

      if (canReusePreviewNode(currentNode, nextNode, options)) {
        index += 1;
        continue;
      }

      result.updatedNodes.push(nextNode);
      currentNode.replaceWith(nextNode);
      index += 1;
    }

    return result;
  }

  function commitPreviewHtml(sanitizedHtml, referenceData, rawVal, context) {
    const shouldRestoreScroll = previewHasCommittedRender && !previewContainsSkeleton();
    const scrollSnapshot = shouldRestoreScroll ? capturePreviewScroll() : null;

    mathJaxTypesetRunId += 1;
    clearMathJaxPreviewState(markdownPreview);
    const patchResult = patchPreviewDom(markdownPreview, sanitizedHtml, {
      reusePreviewBlocks: context.previewEngineMode === 'segmented' && !context.force,
    });
    applyReferencePreviewLinks(markdownPreview, referenceData.definitions);
    enhanceGitHubAlerts(markdownPreview);

    _lastRenderedContent = rawVal;
    previewHasCommittedRender = true;
    previewLastRenderedTabId = context.previewDocumentId;
    markdownPreview.removeAttribute('aria-busy');
    markdownPreview.dataset.renderState = 'ready';

    restorePreviewScroll(scrollSnapshot);
    return patchResult;
  }

  function getPreviewPostProcessRoots(patchResult) {
    if (!patchResult || patchResult.fullReplace || !patchResult.updatedNodes || patchResult.updatedNodes.length === 0) {
      return [markdownPreview];
    }

    const roots = [];
    const seen = new Set();
    patchResult.updatedNodes.forEach(function(node) {
      const root = node && node.nodeType === Node.ELEMENT_NODE ? node : (node && node.parentElement);
      if (root && !seen.has(root)) {
        seen.add(root);
        roots.push(root);
      }
    });

    return roots.length ? roots : [markdownPreview];
  }

  function queryPreviewRoots(roots, selector) {
    const matches = [];
    const seen = new Set();
    roots.forEach(function(root) {
      if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
      if (root.matches && root.matches(selector) && !seen.has(root)) {
        seen.add(root);
        matches.push(root);
      }
      root.querySelectorAll(selector).forEach(function(node) {
        if (!seen.has(node)) {
          seen.add(node);
          matches.push(node);
        }
      });
    });
    return matches;
  }

  function hasRawMathText(node) {
    return Boolean(node && RAW_MATH_TEXT_PATTERN.test(node.textContent || ''));
  }

  function addMathJaxTarget(targets, candidate) {
    if (!candidate || !hasRawMathText(candidate)) return;
    if (targets.some(function(target) { return target.contains(candidate); })) return;
    for (let index = targets.length - 1; index >= 0; index -= 1) {
      if (candidate.contains(targets[index])) {
        targets.splice(index, 1);
      }
    }
    targets.push(candidate);
  }

  function getMathJaxTypesetTargets(roots) {
    const targets = [];
    roots.forEach(function(root) {
      if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
      if (root.matches && root.matches(MATHJAX_TEXT_TARGET_SELECTOR)) {
        addMathJaxTarget(targets, root);
      }
      root.querySelectorAll(MATHJAX_TEXT_TARGET_SELECTOR).forEach(function(candidate) {
        addMathJaxTarget(targets, candidate);
      });
      if (targets.length === 0 && hasRawMathText(root)) {
        addMathJaxTarget(targets, root);
      }
    });
    return targets;
  }

  function markPreviewRootsReady(roots) {
    queryPreviewRoots(roots, '.mermaid-container.is-loading').forEach(function(container) {
      setDiagramRenderState(container, 'ready');
    });
    queryPreviewRoots(roots, '.abc-container.is-loading').forEach(function(container) {
      setDiagramRenderState(container, 'ready');
    });
  }

  function parseAbcHeaders(abcString) {
    const titleMatch = /^T:\s*(.*)$/m.exec(abcString);
    const composerMatch = /^C:\s*(.*)$/m.exec(abcString);
    const keyMatch = /^K:\s*(.*)$/m.exec(abcString);
    const meterMatch = /^M:\s*(.*)$/m.exec(abcString);
    
    return {
      title: titleMatch ? titleMatch[1].trim() : "Music notation block",
      composer: composerMatch ? composerMatch[1].trim() : "Traditional",
      key: keyMatch ? keyMatch[1].trim() : "C",
      meter: meterMatch ? meterMatch[1].trim() : "4/4"
    };
  }

  function disposeStlView(viewId) {
    const view = activeStlViews.get(viewId);
    if (!view) return;
    
    if (view.animationFrameId) {
      cancelAnimationFrame(view.animationFrameId);
    }
    if (view.controls) {
      view.controls.dispose();
    }
    if (view.scene) {
      view.scene.traverse(node => {
        if (node.geometry) {
          node.geometry.dispose();
        }
        if (node.material) {
          if (Array.isArray(node.material)) {
            node.material.forEach(mat => mat.dispose());
          } else {
            node.material.dispose();
          }
        }
      });
    }
    if (view.renderer) {
      view.renderer.dispose();
      if (view.renderer.domElement && view.renderer.domElement.parentElement) {
        view.renderer.domElement.parentElement.removeChild(view.renderer.domElement);
      }
    }
    activeStlViews.delete(viewId);
  }

  function renderMapNode(node, isTopo, context) {
    const originalCode = node.getAttribute('data-original-code');
    if (!originalCode) return;
    const decodedCode = decodeURIComponent(originalCode);
    const container = node.closest('.geojson-container') || node.closest('.topojson-container');
    
    try {
      let geojsonData;
      if (isTopo) {
        const topology = JSON.parse(decodedCode);
        if (topology && topology.objects) {
          const features = [];
          for (const key in topology.objects) {
            if (Object.prototype.hasOwnProperty.call(topology.objects, key)) {
              const feature = topojson.feature(topology, topology.objects[key]);
              if (feature.type === 'FeatureCollection') {
                features.push(...feature.features);
              } else {
                features.push(feature);
              }
            }
          }
          geojsonData = {
            type: 'FeatureCollection',
            features: features
          };
        }
      } else {
        geojsonData = JSON.parse(decodedCode);
      }
      
      if (!geojsonData) return;
      
      node.innerHTML = '';
      const map = L.map(node);
      node._leafletMap = map;
      
      const currentTheme = document.documentElement.getAttribute("data-theme") || 'light';
      let tileUrl;
      let tileAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
      
      if (currentTheme === 'dark') {
        tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
        tileAttribution += ' &copy; <a href="https://carto.com/attributions">CARTO</a>';
      } else {
        tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
        tileAttribution += ' &copy; <a href="https://carto.com/attributions">CARTO</a>';
      }
      
      L.tileLayer(tileUrl, {
        attribution: tileAttribution,
        maxZoom: 19
      }).addTo(map);
      
      const geojsonLayer = L.geoJSON(geojsonData, {
        onEachFeature: function(feature, layer) {
          if (feature.properties) {
            let popupContent = '<div class="map-popup-container"><table class="map-popup-table">';
            let hasProps = false;
            for (const key in feature.properties) {
              if (Object.prototype.hasOwnProperty.call(feature.properties, key)) {
                const val = feature.properties[key];
                const escapedKey = escapeHtml(String(key));
                const escapedVal = escapeHtml(String(typeof val === 'object' ? JSON.stringify(val) : val));
                popupContent += `<tr><td class="prop-key">${escapedKey}</td><td class="prop-val">${escapedVal}</td></tr>`;
                hasProps = true;
              }
            }
            popupContent += '</table></div>';
            if (hasProps) {
              layer.bindPopup(popupContent);
            }
          }
        }
      }).addTo(map);
      
      const bounds = geojsonLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds);
      } else {
        map.setView([0, 0], 2);
      }
      
      if (container) container.classList.remove('is-loading');
    } catch (err) {
      console.error("Map rendering failed:", err);
      node.innerHTML = `<div class="render-error-msg" style="padding: 2em; color: var(--text-color); text-align: center;">Error rendering map: ${escapeHtml(err.message)}</div>`;
      if (container) container.classList.remove('is-loading');
    }
  }

  function renderStlInContainer(container, code, viewId) {
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;
    
    const scene = new THREE.Scene();
    
    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    
    // WebGLRenderer with preserveDrawingBuffer enabled for image export capability
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    
    // OrbitControls
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    
    // Premium studio lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 1.2);
    scene.add(ambientLight);
    
    // Key light
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(1, 1, 1).normalize();
    scene.add(keyLight);
    
    // Fill light (subtle blue-gray tint)
    const fillLight = new THREE.DirectionalLight(0xddddff, 0.4);
    fillLight.position.set(-1, 0.5, -1).normalize();
    scene.add(fillLight);
    
    // Rim light from below back
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
    rimLight.position.set(-0.5, -1, 0.5).normalize();
    scene.add(rimLight);
    
    // Parse geometry
    const loader = new THREE.STLLoader();
    const geometry = loader.parse(new TextEncoder().encode(code).buffer);
    
    // Rotate geometry from Z-up (CAD/STL standard) to Y-up (Three.js standard)
    geometry.rotateX(-Math.PI / 2);
    
    geometry.computeBoundingBox();
    geometry.computeVertexNormals();
    
    const boundingBox = geometry.boundingBox;
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);
    
    const size = new THREE.Vector3();
    boundingBox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // Add grid helper (underneath the model, matching the theme)
    const currentTheme = document.documentElement.getAttribute("data-theme") || 'light';
    const gridColorCenter = currentTheme === 'dark' ? 0x888888 : 0xaaaaaa;
    const gridColor = currentTheme === 'dark' ? 0x333742 : 0xcccccc;
    
    const gridHelper = new THREE.GridHelper(maxDim * 15, 30, gridColorCenter, gridColor);
    gridHelper.position.y = -size.y / 2; // Position directly under model
    scene.add(gridHelper);
    
    // Create modes materials
    const matColor = currentTheme === 'dark' ? 0x90caf9 : 0x1976d2;
    const solidMaterial = new THREE.MeshStandardMaterial({
      color: matColor,
      roughness: 0.4,
      metalness: 0.6
    });
    
    const normalMaterial = new THREE.MeshNormalMaterial();
    
    const mesh = new THREE.Mesh(geometry, solidMaterial);
    mesh.position.sub(center); // Center the mesh
    scene.add(mesh);
    
    // Camera fitting
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 1.4;
    
    // Set initial camera position symmetrically (X = 0) with a slight top-down angle
    camera.position.set(0, maxDim * 0.9, cameraZ * 1.4);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    
    camera.far = maxDim * 50;
    camera.updateProjectionMatrix();

    const initialPosition = camera.position.clone();
    const initialTarget = controls.target.clone();
    
    let animationFrameId;
    const animate = function() {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
      
      const activeView = activeStlViews.get(viewId);
      if (activeView) {
        activeView.animationFrameId = animationFrameId;
      }
    };
    
    const view = {
      container,
      renderer,
      scene,
      camera,
      controls,
      solidMaterial,
      normalMaterial,
      mesh,
      gridHelper,
      initialPosition,
      initialTarget,
      animationFrameId: null
    };
    
    activeStlViews.set(viewId, view);
    animate();
    
    return view;
  }

  function exportStlImage(view, isDownload, button, originalText) {
    if (!view || !view.renderer || !view.scene || !view.camera) return;
    button.innerHTML = '<i class="bi bi-hourglass-split"></i>';
    
    // Force a render pass to ensure the canvas buffer is loaded with the current frame
    view.renderer.render(view.scene, view.camera);
    
    const webglCanvas = view.renderer.domElement;
    
    // Create temporary 2D canvas of the same dimensions
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = webglCanvas.width;
    tempCanvas.height = webglCanvas.height;
    
    const ctx = tempCanvas.getContext('2d');
    // Draw solid white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    // Overlay the WebGL canvas content
    ctx.drawImage(webglCanvas, 0, 0);
    
    if (isDownload) {
      const dataUrl = tempCanvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `model-${Date.now()}.png`;
      a.click();
      button.innerHTML = '<i class="bi bi-check-lg"></i>';
      setTimeout(() => { button.innerHTML = originalText; }, 1500);
    } else {
      // Copy to clipboard
      tempCanvas.toBlob(async blob => {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          button.innerHTML = '<i class="bi bi-check-lg"></i> Copied!';
        } catch (err) {
          console.error(err);
          button.innerHTML = '<i class="bi bi-x-lg"></i>';
        }
        setTimeout(() => { button.innerHTML = originalText; }, 1500);
      }, 'image/png');
    }
  }

  function addStlToolbar(container, node, code, view) {
    if (!container) return;
    
    const oldToolbar = container.querySelector('.stl-toolbar');
    if (oldToolbar) oldToolbar.remove();
    
    const toolbar = document.createElement('div');
    toolbar.className = 'stl-toolbar';
    toolbar.setAttribute('aria-label', 'Model actions');
    
    const btnSolid = document.createElement('button');
    btnSolid.type = 'button';
    btnSolid.className = 'stl-toolbar-btn active';
    btnSolid.setAttribute('data-mode', 'solid');
    btnSolid.innerHTML = '<i class="bi bi-circle-fill"></i> Solid';
    
    const btnAngle = document.createElement('button');
    btnAngle.type = 'button';
    btnAngle.className = 'stl-toolbar-btn';
    btnAngle.setAttribute('data-mode', 'angle');
    btnAngle.innerHTML = '<i class="bi bi-circle-half"></i> Surface Angle';
    
    const btnWireframe = document.createElement('button');
    btnWireframe.type = 'button';
    btnWireframe.className = 'stl-toolbar-btn';
    btnWireframe.setAttribute('data-mode', 'wireframe');
    btnWireframe.innerHTML = '<i class="bi bi-grid-3x3"></i> Wireframe';
    
    const btnZoom = document.createElement('button');
    btnZoom.type = 'button';
    btnZoom.className = 'stl-toolbar-btn btn-zoom';
    btnZoom.title = 'Zoom model';
    btnZoom.setAttribute('aria-label', 'Zoom model');
    btnZoom.innerHTML = '<i class="bi bi-arrows-fullscreen"></i>';
    
    const btnCopy = document.createElement('button');
    btnCopy.type = 'button';
    btnCopy.className = 'stl-toolbar-btn btn-copy';
    btnCopy.title = 'Copy image to clipboard';
    btnCopy.setAttribute('aria-label', 'Copy image to clipboard');
    btnCopy.innerHTML = '<i class="bi bi-clipboard-image"></i> Copy';
    
    const btnPng = document.createElement('button');
    btnPng.type = 'button';
    btnPng.className = 'stl-toolbar-btn btn-png';
    btnPng.title = 'Download PNG';
    btnPng.setAttribute('aria-label', 'Download PNG');
    btnPng.innerHTML = '<i class="bi bi-file-image"></i> PNG';
    
    toolbar.appendChild(btnSolid);
    toolbar.appendChild(btnAngle);
    toolbar.appendChild(btnWireframe);
    toolbar.appendChild(btnZoom);
    toolbar.appendChild(btnCopy);
    toolbar.appendChild(btnPng);
    
    container.appendChild(toolbar);
    
    const setActiveClass = (activeBtn) => {
      [btnSolid, btnAngle, btnWireframe].forEach(btn => btn.classList.remove('active'));
      activeBtn.classList.add('active');
    };
    
    btnSolid.addEventListener('click', () => {
      view.solidMaterial.wireframe = false;
      view.mesh.material = view.solidMaterial;
      setActiveClass(btnSolid);
    });
    
    btnAngle.addEventListener('click', () => {
      view.mesh.material = view.normalMaterial;
      setActiveClass(btnAngle);
    });
    
    btnWireframe.addEventListener('click', () => {
      view.solidMaterial.wireframe = true;
      view.mesh.material = view.solidMaterial;
      setActiveClass(btnWireframe);
    });
    
    btnZoom.addEventListener('click', () => {
      openStlZoomModal(code);
    });
    
    btnCopy.addEventListener('click', () => {
      exportStlImage(view, false, btnCopy, btnCopy.innerHTML);
    });
    
    btnPng.addEventListener('click', () => {
      exportStlImage(view, true, btnPng, btnPng.innerHTML);
    });
  }

  function openStlZoomModal(code) {
    const modal = document.getElementById('stl-zoom-modal');
    const viewerContainer = document.getElementById('stl-modal-viewer');
    viewerContainer.innerHTML = '';
    
    modal.classList.add('active');
    
    activeModalStlView = renderStlInContainer(viewerContainer, code, 'stl-modal-instance');
    
    const btnSolid = document.getElementById('stl-modal-btn-solid');
    const btnAngle = document.getElementById('stl-modal-btn-angle');
    const btnWireframe = document.getElementById('stl-modal-btn-wireframe');
    
    [btnSolid, btnAngle, btnWireframe].forEach(btn => btn.classList.remove('active'));
    btnSolid.classList.add('active');
  }

  function closeStlZoomModal() {
    const modal = document.getElementById('stl-zoom-modal');
    modal.classList.remove('active');
    
    disposeStlView('stl-modal-instance');
    activeModalStlView = null;
    document.getElementById('stl-modal-viewer').innerHTML = '';
  }

  function renderStlNode(node, context) {
    const originalCode = node.getAttribute('data-original-code');
    if (!originalCode) return;
    const decodedCode = decodeURIComponent(originalCode);
    const container = node.closest('.stl-container');
    const nodeId = node.id;
    
    if (activeStlViews.has(nodeId)) {
      disposeStlView(nodeId);
    }
    
    try {
      node.innerHTML = '';
      const view = renderStlInContainer(node, decodedCode, nodeId);
      
      if (container) container.classList.remove('is-loading');
      
      addStlToolbar(container, node, decodedCode, view);
    } catch (err) {
      console.error("STL rendering failed:", err);
      node.innerHTML = `<div class="render-error-msg" style="padding: 2em; color: var(--text-color); text-align: center;">Error rendering 3D model: ${escapeHtml(err.message)}</div>`;
      if (container) container.classList.remove('is-loading');
    }
  }

  function updateMapThemes() {
    if (typeof L === 'undefined') return;
    const mapNodes = markdownPreview.querySelectorAll('.geojson-map, .topojson-map');
    mapNodes.forEach(node => {
      const map = node._leafletMap;
      if (map) {
        map.eachLayer(layer => {
          if (layer instanceof L.TileLayer) {
            const currentTheme = document.documentElement.getAttribute("data-theme") || 'light';
            let tileUrl;
            let tileAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
            if (currentTheme === 'dark') {
              tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
              tileAttribution += ' &copy; <a href="https://carto.com/attributions">CARTO</a>';
            } else {
              tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
              tileAttribution += ' &copy; <a href="https://carto.com/attributions">CARTO</a>';
            }
            layer.setUrl(tileUrl);
            layer.setAttribution(tileAttribution);
          }
        });
      }
    });
  }

  function updateStlThemes() {
    if (typeof THREE === 'undefined') return;
    const stlNodes = markdownPreview.querySelectorAll('.stl-viewer');
    stlNodes.forEach(node => {
      const view = activeStlViews.get(node.id);
      if (view && view.scene) {
        const currentTheme = document.documentElement.getAttribute("data-theme") || 'light';
        const matColor = currentTheme === 'dark' ? 0x90caf9 : 0x1976d2;
        
        view.scene.traverse(child => {
          if (child instanceof THREE.Mesh && child.material && !(child.material instanceof THREE.MeshNormalMaterial)) {
            child.material.color.setHex(matColor);
            child.material.needsUpdate = true;
          }
        });
        
        if (view.gridHelper) {
          view.scene.remove(view.gridHelper);
          view.gridHelper.geometry.dispose();
          if (Array.isArray(view.gridHelper.material)) {
            view.gridHelper.material.forEach(m => m.dispose());
          } else {
            view.gridHelper.material.dispose();
          }
          
          const mesh = view.mesh;
          if (mesh && mesh.geometry) {
            const boundingBox = mesh.geometry.boundingBox;
            if (boundingBox) {
              const size = new THREE.Vector3();
              boundingBox.getSize(size);
              const maxDim = Math.max(size.x, size.y, size.z);
              
              const gridColorCenter = currentTheme === 'dark' ? 0x555555 : 0xbbbbbb;
              const gridColor = currentTheme === 'dark' ? 0x2d3139 : 0xe5e5e5;
              
              const newGrid = new THREE.GridHelper(maxDim * 3, 20, gridColorCenter, gridColor);
              newGrid.position.y = -size.y / 2;
              view.scene.add(newGrid);
              view.gridHelper = newGrid;
            }
          }
        }
      }
    });
  }

  function postProcessPreview(rawVal, context, patchResult) {
    const roots = getPreviewPostProcessRoots(patchResult);

    // Clean up orphaned STL views that are no longer present in the document
    activeStlViews.forEach((view, id) => {
      if (!document.body.contains(view.container)) {
        disposeStlView(id);
      }
    });

    roots.forEach(function(root) {
      processEmojis(root);
    });

    queryPreviewRoots(roots, 'input[type="checkbox"]').forEach(function(input) {
      if (!input.hasAttribute('aria-label')) {
        const parentText = input.parentElement ? input.parentElement.textContent.trim() : '';
        input.setAttribute('aria-label', parentText || 'Task item');
      }
    });

    try {
      const mermaidNodes = queryPreviewRoots(roots, '.mermaid');
      if (mermaidNodes.length > 0) {
        const renderMermaidFallback = function() {
          mermaidNodes.forEach(node => renderRemoteDiagramNode(node, 'mermaid', context));
        };
        const renderMermaidNodes = function() {
          if (context.renderId !== previewRenderGeneration) return;
          initMermaid(false);
          Promise.resolve(mermaid.init(undefined, mermaidNodes))
            .then(() => {
              if (context.renderId !== previewRenderGeneration) return;
              markPreviewRootsReady(roots);
              addMermaidToolbars();
            })
            .catch((e) => {
              if (context.renderId !== previewRenderGeneration) return;
              console.warn("Mermaid rendering failed:", e);
              renderMermaidFallback();
            });
        };
        if (typeof mermaid === 'undefined') {
          loadDiagramLibrary(CDN.mermaid).then(function() {
            if (context.renderId !== previewRenderGeneration) return;
            initMermaid(true);
            renderMermaidNodes();
          }).catch(function(e) {
            console.warn('Failed to load mermaid:', e);
            renderMermaidFallback();
          });
        } else {
          renderMermaidNodes();
        }
      }
    } catch (e) {
      console.warn("Mermaid rendering failed:", e);
    }

    try {
      const abcNodes = queryPreviewRoots(roots, '.abc-notation');
      if (abcNodes.length > 0) {
        const renderAbcNodes = function() {
          if (context.renderId !== previewRenderGeneration) return;
          
          const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                const node = entry.target;
                obs.unobserve(node);
                
                setTimeout(() => {
                  if (context.renderId !== previewRenderGeneration) return;
                  const originalCode = node.getAttribute('data-original-code');
                  if (!originalCode) return;
                  const decodedCode = decodeURIComponent(originalCode);
                  
                  const container = node.closest('.abc-container');
                  try {
                    node.innerHTML = '';
                    const visualObj = ABCJS.renderAbc(node.id, decodedCode, {
                      responsive: "resize",
                      add_classes: true
                    });
                    
                    node.innerHTML = DOMPurify.sanitize(node.innerHTML, PREVIEW_SANITIZE_OPTIONS);
                    
                    const headers = parseAbcHeaders(decodedCode);
                    const svgElement = node.querySelector('svg');
                    if (svgElement) {
                      svgElement.setAttribute('role', 'img');
                      const titleId = 'abc-title-' + node.id;
                      const descId = 'abc-desc-' + node.id;
                      svgElement.setAttribute('aria-labelledby', titleId + ' ' + descId);
                      svgElement.setAttribute('aria-describedby', 'abc-source-' + node.id);
                      
                      const svgTitle = document.createElementNS('http://www.w3.org/2000/svg', 'title');
                      svgTitle.id = titleId;
                      svgTitle.textContent = `Sheet music for: ${headers.title}`;
                      
                      const svgDesc = document.createElementNS('http://www.w3.org/2000/svg', 'desc');
                      svgDesc.id = descId;
                      svgDesc.textContent = `Score in ${headers.key}, ${headers.meter} meter, composed by ${headers.composer}.`;
                      
                      svgElement.insertBefore(svgDesc, svgElement.firstChild);
                      svgElement.insertBefore(svgTitle, svgElement.firstChild);
                    }
                    
                    if (container) {
                      setDiagramRenderState(container, 'ready');

                      const oldRaw = container.querySelector('.abc-raw-code');
                      if (oldRaw) oldRaw.remove();
                      const oldSrOnly = container.querySelector('.abc-sr-only');
                      if (oldSrOnly) oldSrOnly.remove();

                      mountDiagramViewer(container, 'abc', [{
                        title: 'Listen to score',
                        ariaLabel: 'Listen to score',
                        html: '<i class="bi bi-play-fill"></i> Listen',
                        onClick: (btn) => toggleAbcPlay(visualObj, btn, container)
                      }]);

                      const srOnlyDiv = document.createElement('div');
                      srOnlyDiv.className = 'abc-sr-only';
                      srOnlyDiv.id = 'abc-source-' + node.id;
                      srOnlyDiv.textContent = decodedCode;

                      container.appendChild(srOnlyDiv);
                    }
                  } catch (err) {
                    console.error("ABCJS rendering failed:", err);
                    if (container) {
                      setDiagramRenderState(container, 'error', 'ABC notation could not be rendered. Check the score syntax and retry.');
                    }
                  }
                }, 0);
              }
            });
          }, { rootMargin: '150px 0px' });
          
          abcNodes.forEach(node => observer.observe(node));
        };
        
        const loadAndRenderAbc = function() {
          loadDiagramLibrary(CDN.abcjs).then(function() {
            if (context.renderId !== previewRenderGeneration) return;
            renderAbcNodes();
          }).catch(function(e) {
            console.warn('Failed to load abcjs:', e);
            abcNodes.forEach(function(node) {
              const container = node.closest('.abc-container');
              if (container) {
                setDiagramRenderState(container, 'error', 'ABC notation renderer is unavailable. Check your connection and retry.', loadAndRenderAbc);
              }
            });
          });
        };
        if (typeof ABCJS === 'undefined') {
          loadAndRenderAbc();
        } else {
          renderAbcNodes();
        }
      }
    } catch (e) {
      console.warn("ABC notation processing failed:", e);
    }

    try {
      const geojsonNodes = queryPreviewRoots(roots, '.geojson-map');
      const topojsonNodes = queryPreviewRoots(roots, '.topojson-map');
      
      if (geojsonNodes.length > 0 || topojsonNodes.length > 0) {
        const renderAllMaps = function() {
          if (context.renderId !== previewRenderGeneration) return;
          geojsonNodes.forEach(node => renderMapNode(node, false, context));
          topojsonNodes.forEach(node => renderMapNode(node, true, context));
        };
        
        const promises = [];
        if (typeof L === 'undefined') {
          promises.push(loadStyle(CDN.leaflet_css));
          promises.push(loadScript(CDN.leaflet_js));
        }
        if (topojsonNodes.length > 0 && typeof topojson === 'undefined') {
          promises.push(loadScript(CDN.topojson));
        }
        
        if (promises.length > 0) {
          Promise.all(promises).then(function() {
            renderAllMaps();
          }).catch(function(e) {
            console.warn('Failed to load map libraries:', e);
            geojsonNodes.concat(topojsonNodes).forEach(node => {
              const container = node.closest('.geojson-container') || node.closest('.topojson-container');
              if (container) container.classList.remove('is-loading');
            });
          });
        } else {
          renderAllMaps();
        }
      }
    } catch (e) {
      console.warn("GeoJSON/TopoJSON processing failed:", e);
    }

    try {
      const stlNodes = queryPreviewRoots(roots, '.stl-viewer');
      if (stlNodes.length > 0) {
        const renderAllStls = function() {
          if (context.renderId !== previewRenderGeneration) return;
          stlNodes.forEach(node => renderStlNode(node, context));
        };
        
        const promises = [];
        if (typeof THREE === 'undefined') {
          promises.push(loadScript(CDN.three));
        }
        
        const loadLoaderAndControls = function() {
          const subPromises = [];
          if (typeof THREE.STLLoader === 'undefined') {
            subPromises.push(loadScript(CDN.stlLoader));
          }
          if (typeof THREE.OrbitControls === 'undefined') {
            subPromises.push(loadScript(CDN.orbitControls));
          }
          if (subPromises.length > 0) {
            return Promise.all(subPromises);
          }
          return Promise.resolve();
        };
        
        if (typeof THREE === 'undefined') {
          loadScript(CDN.three).then(function() {
            return loadLoaderAndControls();
          }).then(function() {
            renderAllStls();
          }).catch(function(e) {
            console.warn('Failed to load Three.js libraries:', e);
            stlNodes.forEach(node => {
              const container = node.closest('.stl-container');
              if (container) container.classList.remove('is-loading');
            });
          });
        } else {
          loadLoaderAndControls().then(function() {
            renderAllStls();
          }).catch(function(e) {
            console.warn('Failed to load Three.js addons:', e);
            stlNodes.forEach(node => {
              const container = node.closest('.stl-container');
              if (container) container.classList.remove('is-loading');
            });
          });
        }
      }
    } catch (e) {
      console.warn("STL processing failed:", e);
    }

    try {
      const adapterTargets = [
        ['.plantuml-diagram', 'plantuml'],
        ['.d2-diagram', 'd2'],
        ['.graphviz-diagram', 'graphviz'],
        ['.kroki-diagram', null]
      ];
      const renderAdapterTargets = function() {
        if (context.renderId !== previewRenderGeneration) return;
        adapterTargets.forEach(([selector, fixedEngine]) => {
          queryPreviewRoots(roots, selector).forEach(node => {
            const engine = fixedEngine || node.closest('[data-diagram-engine]')?.dataset.diagramEngine;
            if (engine && REMOTE_DIAGRAM_ENGINES[engine]) {
              renderRemoteDiagramNode(node, engine, context);
            }
          });
        });
      };

      if (typeof pako === 'undefined') {
        loadDiagramLibrary(CDN.pako).then(renderAdapterTargets).catch(error => {
          console.warn('Failed to load diagram encoder; POST fallbacks remain available', error);
          renderAdapterTargets();
        });
      } else {
        renderAdapterTargets();
      }
    } catch (error) {
      console.error('Diagram adapter processing failed', error);
    }

    const hasMath = /\$\$|\$[^$]|\\\(|\\\[/.test(rawVal || '') || /```math\b/.test(rawVal || '');
    if (hasMath) {
      const mathTargets = getMathJaxTypesetTargets(roots);
      if (mathTargets.length === 0) return;
      ensureMathJaxReady().then(function() {
        if (context.renderId !== previewRenderGeneration) return;
        typesetMathJaxTargets(mathTargets, context);
      }).catch(function(e) {
        console.warn('Failed to load MathJax:', e);
      });
    }

    updateDocumentStats();
    updateFindHighlights();
    cleanupImageObjectUrls();
    scheduleLineNumberUpdate();
  }

  function executeMainThreadRender(rawVal, context) {
    const { frontmatter, body } = parseFrontmatter(rawVal);
    const tableHtml = frontmatter ? renderFrontmatterTable(frontmatter) : '';
    const referenceData = extractReferenceDefinitions(body);
    const html = tableHtml + marked.parse(referenceData.cleanedMarkdown);
    const sanitizedHtml = sanitizePreviewHtml(html);

    if (context.renderId !== previewRenderGeneration || markdownEditor.value !== rawVal) return;

    previewSegmentHtmlCache.clear();
    const patchResult = commitPreviewHtml(sanitizedHtml, referenceData, rawVal, context);
    postProcessPreview(rawVal, context, patchResult);
  }

  function executeWorkerRender(rawVal, context) {
    requestPreviewWorkerRender(rawVal, context)
      .then(function(result) {
        if (context.renderId !== previewRenderGeneration || markdownEditor.value !== rawVal) return;
        if (!result || result.mode !== 'segmented' || !Array.isArray(result.blocks) || result.blocks.length < PREVIEW_SEGMENT_MIN_BLOCKS) {
          executeMainThreadRender(rawVal, Object.assign({}, context, { disableWorker: true }));
          return;
        }

        const segmentedHtml = buildSegmentedPreviewHtml(result.blocks, context.previewDocumentId);
        if (context.renderId !== previewRenderGeneration || markdownEditor.value !== rawVal) return;

        const patchResult = commitPreviewHtml(segmentedHtml, { definitions: new Map() }, rawVal, Object.assign({}, context, {
          previewEngineMode: 'segmented',
        }));
        postProcessPreview(rawVal, context, patchResult);
      })
      .catch(function(error) {
        if (context.renderId !== previewRenderGeneration || markdownEditor.value !== rawVal) return;
        console.warn('Preview worker unavailable; falling back to main-thread renderer:', error);
        executeMainThreadRender(rawVal, Object.assign({}, context, { disableWorker: true }));
      });
  }

  function renderMarkdown(options) {
    stopActiveAbcPlayback();
    options = options || {};
    const rawVal = markdownEditor.value;
    const force = options.force === true;
    const previewDocumentId = getActivePreviewDocumentId();
    const hasCurrentPreview =
      previewHasCommittedRender &&
      previewLastRenderedTabId === previewDocumentId &&
      _lastRenderedContent === rawVal &&
      !previewContainsSkeleton();

    if (hasCurrentPreview && !force) return;

    clearPendingPreviewWork();
    const renderId = ++previewRenderGeneration;
    const isLargeDocument = rawVal.length >= LARGE_DOCUMENT_THRESHOLD;
    const isDocumentSwap = previewHasCommittedRender && previewLastRenderedTabId !== previewDocumentId;
    const needsInitialPreview = !previewHasCommittedRender || previewContainsSkeleton();
    const shouldShowSkeleton =
      isLargeDocument &&
      (options.showSkeleton === true || needsInitialPreview || isDocumentSwap);

    if (shouldShowSkeleton) {
      showPreviewSkeleton();
    } else if (markdownPreview) {
      markdownPreview.setAttribute('aria-busy', 'true');
      markdownPreview.dataset.renderState = 'refreshing';
    }

    const runRender = function() {
      pendingPreviewRenderCancel = null;
      if (renderId !== previewRenderGeneration || markdownEditor.value !== rawVal) return;
      executeRender(rawVal, {
        force,
        renderId,
        previewDocumentId,
        reason: options.reason || 'direct',
      });
    };

    if (isLargeDocument) {
      pendingPreviewRenderCancel = deferPreviewWork(runRender, rawVal.length);
    } else {
      runRender();
    }
  }

  function executeRender(rawVal, context) {
    context = context || {};
    // PERF-003: Skip render if content hasn't changed
    if (
      !context.force &&
      rawVal === _lastRenderedContent &&
      previewLastRenderedTabId === context.previewDocumentId &&
      previewHasCommittedRender &&
      !previewContainsSkeleton()
    ) {
      markdownPreview.removeAttribute('aria-busy');
      markdownPreview.dataset.renderState = 'ready';
      return;
    }

    try {
      if (shouldUsePreviewWorker(rawVal, context)) {
        executeWorkerRender(rawVal, context);
      } else {
        executeMainThreadRender(rawVal, context);
      }
    } catch (e) {
      console.error("Markdown rendering failed:", e);
      const safeMessage = escapeHtml(e && e.message ? e.message : 'Unknown error');
      const safeMarkdown = escapeHtml(rawVal);
      markdownPreview.removeAttribute('aria-busy');
      markdownPreview.dataset.renderState = 'error';
      if (!previewHasCommittedRender || previewContainsSkeleton()) {
        markdownPreview.innerHTML = `<div class="alert alert-danger">
              <strong>Error rendering markdown:</strong> ${safeMessage}
          </div>
          <pre>${safeMarkdown}</pre>`;
      }
    }
  }

  function importMarkdownFile(file) {
    if (file.size > 10 * 1024 * 1024) {
      alert('File is too large (maximum 10MB supported).');
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      const text = e.target.result || '';
      
      // Simple binary check: look for null bytes in the first 8KB
      const checkLength = Math.min(text.length, 8000);
      for (let i = 0; i < checkLength; i++) {
        if (text.charCodeAt(i) === 0) {
          alert('Cannot import: The selected file appears to be a binary file.');
          return;
        }
      }

      newTab(text, file.name.replace(/\.md$/i, ''));
    };
    reader.onerror = function() {
      alert('Failed to read the file. Please check permissions and try again.');
    };
    reader.readAsText(file);
  }

  function isMarkdownPath(path) {
    return /\.(md|markdown)$/i.test(path || "");
  }
  const MAX_GITHUB_FILES_SHOWN = 30;
  const GITHUB_IMPORT_MIN_REQUEST_INTERVAL_MS = 800;
  let lastGitHubImportRequestAt = 0;
  const selectedGitHubImportPaths = new Set();
  let availableGitHubImportPaths = [];

  function getFileName(path) {
    return (path || "").split("/").pop() || "document.md";
  }

  function buildRawGitHubUrl(owner, repo, ref, filePath) {
    const encodedPath = filePath
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
    return `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(ref)}/${encodedPath}`;
  }

  async function fetchGitHubJson(url) {
    const now = Date.now();
    const waitTime = GITHUB_IMPORT_MIN_REQUEST_INTERVAL_MS - (now - lastGitHubImportRequestAt);
    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    lastGitHubImportRequestAt = Date.now();
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json"
      }
    });
    if (!response.ok) {
      throw new Error(`GitHub API request failed (${response.status})`);
    }
    return response.json();
  }

  async function fetchTextContent(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch file (${response.status})`);
    }
    return response.text();
  }

  function parseGitHubImportUrl(input) {
    let parsedUrl;
    try {
      parsedUrl = new URL((input || "").trim());
    } catch (_) {
      return null;
    }

    const host = parsedUrl.hostname.replace(/^www\./, "");
    const segments = parsedUrl.pathname.split("/").filter(Boolean);

    if (host === "raw.githubusercontent.com") {
      if (segments.length < 4) return null;
      const [owner, repo, ref, ...rest] = segments;
      const filePath = rest.join("/");
      return { owner, repo, ref, type: "file", filePath };
    }

    if (host !== "github.com" || segments.length < 2) return null;

    const owner = segments[0];
    const repo = segments[1].replace(/\.git$/i, "");
    if (segments.length === 2) {
      return { owner, repo, type: "repo" };
    }

    const mode = segments[2];
    if (mode === "blob" && segments.length >= 5) {
      return {
        owner,
        repo,
        type: "file",
        ref: segments[3],
        filePath: segments.slice(4).join("/")
      };
    }

    if (mode === "tree" && segments.length >= 4) {
      return {
        owner,
        repo,
        type: "tree",
        ref: segments[3],
        basePath: segments.slice(4).join("/")
      };
    }

    return { owner, repo, type: "repo" };
  }

  async function getDefaultBranch(owner, repo) {
    const repoInfo = await fetchGitHubJson(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
    return repoInfo.default_branch;
  }

  async function listMarkdownFiles(owner, repo, ref, basePath) {
    const treeResponse = await fetchGitHubJson(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(ref)}?recursive=1`);
    const normalizedBasePath = (basePath || "").replace(/^\/+|\/+$/g, "");

    return (treeResponse.tree || [])
      .filter((entry) => entry.type === "blob" && isMarkdownPath(entry.path))
      .filter((entry) => !normalizedBasePath || entry.path === normalizedBasePath || entry.path.startsWith(normalizedBasePath + "/"))
      .map((entry) => entry.path)
      .sort((a, b) => a.localeCompare(b));
  }

  function buildMarkdownFileTree(paths) {
    const root = { folders: {}, files: [] };
    (paths || []).forEach((path) => {
      const segments = (path || "").split("/").filter(Boolean);
      if (!segments.length) return;
      const fileName = segments.pop();
      let node = root;
      segments.forEach((segment) => {
        if (!node.folders[segment]) {
          node.folders[segment] = { folders: {}, files: [] };
        }
        node = node.folders[segment];
      });
      node.files.push({ name: fileName, path });
    });
    return root;
  }

  function updateGitHubImportSelectedCount() {
    if (!githubImportSelectedCount) return;
    const count = selectedGitHubImportPaths.size;
    githubImportSelectedCount.textContent = `${count} selected`;
  }

  function updateGitHubSelectAllButtonLabel() {
    if (!githubImportSelectAllBtn) return;
    const total = availableGitHubImportPaths.length;
    const allSelected = total > 0 && selectedGitHubImportPaths.size === total;
    githubImportSelectAllBtn.textContent = allSelected ? "Clear All" : "Select All";
  }

  function syncGitHubSelectionToButtons() {
    if (!githubImportTree) return;
    Array.from(githubImportTree.querySelectorAll(".github-tree-file-btn")).forEach((btn) => {
      const isSelected = selectedGitHubImportPaths.has(btn.dataset.path);
      btn.classList.toggle("is-selected", isSelected);
      btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
  }

  function setGitHubSelectedPaths(paths) {
    selectedGitHubImportPaths.clear();
    (paths || []).forEach((path) => selectedGitHubImportPaths.add(path));
    updateGitHubImportSelectedCount();
    syncGitHubSelectionToButtons();
    updateGitHubSelectAllButtonLabel();
  }

  function toggleGitHubSelectedPath(path) {
    if (!path) return;
    if (selectedGitHubImportPaths.has(path)) {
      selectedGitHubImportPaths.delete(path);
    } else {
      selectedGitHubImportPaths.add(path);
    }
    updateGitHubImportSelectedCount();
    syncGitHubSelectionToButtons();
    updateGitHubSelectAllButtonLabel();
  }

  function renderGitHubImportTree(paths) {
    if (!githubImportTree || !githubImportFileSelect) return;
    githubImportTree.innerHTML = "";
    const tree = buildMarkdownFileTree(paths);

    const createTreeBranch = function(node, parentPath) {
      const list = document.createElement("ul");
      const folderNames = Object.keys(node.folders).sort((a, b) => a.localeCompare(b));
      folderNames.forEach((folderName) => {
        const folderPath = parentPath ? `${parentPath}/${folderName}` : folderName;
        const item = document.createElement("li");
        const folderLabel = document.createElement("span");
        folderLabel.className = "github-tree-folder-label";
        folderLabel.textContent = `📁 ${folderName}`;
        item.appendChild(folderLabel);
        item.appendChild(createTreeBranch(node.folders[folderName], folderPath));
        list.appendChild(item);
      });

      node.files
        .sort((a, b) => a.path.localeCompare(b.path))
        .forEach((file) => {
          const fileItem = document.createElement("li");
          const fileButton = document.createElement("button");
          fileButton.type = "button";
          fileButton.className = "github-tree-file-btn";
          fileButton.dataset.path = file.path;
          fileButton.setAttribute("aria-pressed", "false");
          fileButton.textContent = `📄 ${file.name}`;
          fileButton.addEventListener("click", function() {
            toggleGitHubSelectedPath(file.path);
          });
          fileItem.appendChild(fileButton);
          list.appendChild(fileItem);
        });

      return list;
    };

    githubImportTree.appendChild(createTreeBranch(tree, ""));
    syncGitHubSelectionToButtons();
  }

  function setGitHubImportLoading(isLoading) {
    if (!githubImportSubmitBtn) return;
    if (isLoading) {
      githubImportSubmitBtn.dataset.loadingText = githubImportSubmitBtn.textContent;
      githubImportSubmitBtn.textContent = "Importing...";
    } else if (githubImportSubmitBtn.dataset.loadingText) {
      githubImportSubmitBtn.textContent = githubImportSubmitBtn.dataset.loadingText;
      delete githubImportSubmitBtn.dataset.loadingText;
    }
  }

  function setGitHubImportMessage(message, options = {}) {
    if (!githubImportError) return;
    const { isError = true } = options;
    githubImportError.classList.toggle("is-info", !isError);
    if (!message) {
      githubImportError.textContent = "";
      githubImportError.style.display = "none";
      return;
    }
    githubImportError.textContent = message;
    githubImportError.style.display = "block";
  }

  function resetGitHubImportModal() {
    if (!githubImportUrlInput || !githubImportFileSelect || !githubImportSubmitBtn) return;
    if (githubImportTitle) {
      githubImportTitle.textContent = "Import Markdown from GitHub";
    }
    githubImportUrlInput.value = "";
    githubImportUrlInput.style.display = "block";
    githubImportUrlInput.disabled = false;
    githubImportFileSelect.innerHTML = "";
    githubImportFileSelect.style.display = "none";
    githubImportFileSelect.disabled = false;
    if (githubImportSelectionToolbar) {
      githubImportSelectionToolbar.style.display = "none";
    }
    availableGitHubImportPaths = [];
    setGitHubSelectedPaths([]);
    if (githubImportTree) {
      githubImportTree.innerHTML = "";
      githubImportTree.style.display = "none";
    }
    githubImportSubmitBtn.dataset.step = "url";
    delete githubImportSubmitBtn.dataset.owner;
    delete githubImportSubmitBtn.dataset.repo;
    delete githubImportSubmitBtn.dataset.ref;
    githubImportSubmitBtn.textContent = "Import";
    setGitHubImportMessage("");
  }

  function openGitHubImportModal() {
    if (!githubImportModal || !githubImportUrlInput || !githubImportSubmitBtn) return;
    resetGitHubImportModal();
    openAppModal(githubImportModal, {
      focusTarget: githubImportUrlInput,
      onClose: closeGitHubImportModal
    });
  }

  function closeGitHubImportModal() {
    if (!githubImportModal) return;
    closeAppModal(githubImportModal);
    resetGitHubImportModal();
  }

  async function handleGitHubImportSubmit() {
    if (!githubImportSubmitBtn || !githubImportUrlInput || !githubImportFileSelect) return;
    const setGitHubImportDialogDisabled = (disabled) => {
      githubImportSubmitBtn.disabled = disabled;
      if (githubImportCancelBtn) {
        githubImportCancelBtn.disabled = disabled;
      }
      if (githubImportSelectAllBtn) {
        githubImportSelectAllBtn.disabled = disabled;
      }
    };
    const step = githubImportSubmitBtn.dataset.step || "url";
    if (step === "select") {
      const selectedPaths = Array.from(selectedGitHubImportPaths);
      const owner = githubImportSubmitBtn.dataset.owner;
      const repo = githubImportSubmitBtn.dataset.repo;
      const ref = githubImportSubmitBtn.dataset.ref;
      if (!owner || !repo || !ref || !selectedPaths.length) {
        setGitHubImportMessage("Please select at least one file to import.");
        return;
      }
      setGitHubImportLoading(true);
      setGitHubImportDialogDisabled(true);
      announceToScreenReader("Importing selected files from GitHub...");
      try {
        for (const selectedPath of selectedPaths) {
          const markdown = await fetchTextContent(buildRawGitHubUrl(owner, repo, ref, selectedPath));
          newTab(markdown, getFileName(selectedPath).replace(/\.(md|markdown)$/i, ""));
        }
        closeGitHubImportModal();
        announceToScreenReader("Files imported successfully.");
      } catch (error) {
        console.error("GitHub import failed:", error);
        setGitHubImportMessage("GitHub import failed: " + error.message);
        announceToScreenReader("GitHub import failed.");
      } finally {
        setGitHubImportDialogDisabled(false);
        setGitHubImportLoading(false);
      }
      return;
    }

    const urlInput = githubImportUrlInput.value.trim();
    if (!urlInput) {
      setGitHubImportMessage("Please enter a GitHub URL.");
      return;
    }

    const parsed = parseGitHubImportUrl(urlInput);
    if (!parsed || !parsed.owner || !parsed.repo) {
      setGitHubImportMessage("Please enter a valid GitHub URL.");
      return;
    }

    setGitHubImportMessage("");
    setGitHubImportLoading(true);
    setGitHubImportDialogDisabled(true);
    try {
      if (parsed.type === "file") {
        if (!isMarkdownPath(parsed.filePath)) {
          throw new Error("The provided URL does not point to a Markdown file.");
        }
        announceToScreenReader("Fetching file from GitHub...");
        const markdown = await fetchTextContent(buildRawGitHubUrl(parsed.owner, parsed.repo, parsed.ref, parsed.filePath));
        newTab(markdown, getFileName(parsed.filePath).replace(/\.(md|markdown)$/i, ""));
        closeGitHubImportModal();
        announceToScreenReader("File imported successfully.");
        return;
      }

      // Accessibility dynamic live announcer
      const fetchingText = I18N_DICTS[activeLang].loadingFiles || "Fetching file tree...";
      announceToScreenReader(fetchingText);

      // Render hierarchical visual skeleton tree while the list is loading
      if (githubImportTree) {
        renderGitHubImportTreeSkeleton();
        githubImportTree.style.display = "block";
      }

      const ref = parsed.ref || await getDefaultBranch(parsed.owner, parsed.repo);
      const files = await listMarkdownFiles(parsed.owner, parsed.repo, ref, parsed.basePath || "");

      if (!files.length) {
        if (githubImportTree) {
          githubImportTree.innerHTML = "";
          githubImportTree.style.display = "none";
        }
        setGitHubImportMessage("No Markdown files were found at that GitHub location.");
        announceToScreenReader("Failed to locate Markdown files.");
        return;
      }

      const shownFiles = files.slice(0, MAX_GITHUB_FILES_SHOWN);
      if (files.length === 1) {
        const targetPath = files[0];
        announceToScreenReader("Fetching file content...");
        const markdown = await fetchTextContent(buildRawGitHubUrl(parsed.owner, parsed.repo, ref, targetPath));
        newTab(markdown, getFileName(targetPath).replace(/\.(md|markdown)$/i, ""));
        closeGitHubImportModal();
        announceToScreenReader("File imported successfully.");
        return;
      }

      githubImportFileSelect.innerHTML = "";
      githubImportUrlInput.style.display = "none";
      githubImportFileSelect.style.display = "none";
      if (githubImportSelectionToolbar) {
        githubImportSelectionToolbar.style.display = "flex";
      }
      if (githubImportTree) {
        githubImportTree.style.display = "block";
      }
      shownFiles.forEach((filePath) => {
        const option = document.createElement("option");
        option.value = filePath;
        option.textContent = filePath;
        githubImportFileSelect.appendChild(option);
      });
      availableGitHubImportPaths = shownFiles.slice();
      setGitHubSelectedPaths(shownFiles[0] ? [shownFiles[0]] : []);
      renderGitHubImportTree(shownFiles);

      // Announce load complete
      announceToScreenReader("GitHub files loaded. " + files.length + " files available in the tree.");

      if (files.length > MAX_GITHUB_FILES_SHOWN) {
        setGitHubImportMessage(`Showing first ${MAX_GITHUB_FILES_SHOWN} of ${files.length} Markdown files.`, { isError: false });
      } else {
        setGitHubImportMessage("");
      }
      if (githubImportTitle) {
        githubImportTitle.textContent = "Select Markdown file(s) to import";
      }
      githubImportSubmitBtn.dataset.step = "select";
      githubImportSubmitBtn.dataset.owner = parsed.owner;
      githubImportSubmitBtn.dataset.repo = parsed.repo;
      githubImportSubmitBtn.dataset.ref = ref;
      githubImportSubmitBtn.textContent = "Import Selected";
    } catch (error) {
      console.error("GitHub import failed:", error);
      setGitHubImportMessage("GitHub import failed: " + error.message);
      announceToScreenReader("GitHub import failed.");
      if (githubImportTree) {
        githubImportTree.innerHTML = "";
        githubImportTree.style.display = "none";
      }
    } finally {
      setGitHubImportDialogDisabled(false);
      setGitHubImportLoading(false);
    }
  }

  function scheduleEmojiLookupRefresh() {
    if (emojiLookupLoaded || emojiRenderScheduled) return;
    emojiRenderScheduled = true;
    loadEmojiEntries()
      .then(() => {
        if (emojiUrlMap.size) {
          renderMarkdown({ force: true, reason: 'emoji-refresh' });
        }
      })
      .finally(() => {
        emojiRenderScheduled = false;
      });
  }

  function processEmojis(element) {
    // Early exit if the raw text content has no colon characters (PERF-013)
    // This avoids the expensive TreeWalker DOM walk for documents without emoji shortcodes
    if (!element.textContent || !element.textContent.includes(':')) return;

    // PERF-002: Lazy-load JoyPixels on first use
    if (typeof joypixels === 'undefined') {
      Promise.all([
        loadScript(CDN.joypixels),
        loadStyle(CDN.joypixels_css)
      ]).then(function() { processEmojis(element); });
      return;
    }
    
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      let parent = node.parentNode;
      let isInCode = false;
      while (parent && parent !== element) {
        if (parent.tagName === 'PRE' || parent.tagName === 'CODE') {
          isInCode = true;
          break;
        }
        parent = parent.parentNode;
      }
      
      if (!isInCode && node.nodeValue.includes(':')) {
        textNodes.push(node);
      }
    }
    
    let needsEmojiLookup = false;
    textNodes.forEach(textNode => {
      const text = textNode.nodeValue;
      const emojiRegex = /:([\w+-]+):/g;
      
      let match;
      let lastIndex = 0;
      let hasEmoji = false;
      const fragment = document.createDocumentFragment();
      
      while ((match = emojiRegex.exec(text)) !== null) {
        const shortcode = match[1];
        const emoji = joypixels.shortnameToUnicode(`:${shortcode}:`);
        
        if (emoji !== `:${shortcode}:`) { // If conversion was successful
          hasEmoji = true;
          if (match.index > lastIndex) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
          }
          fragment.appendChild(document.createTextNode(emoji));
          lastIndex = emojiRegex.lastIndex;
        } else {
          const emojiUrl = emojiUrlMap.get(shortcode);
          if (emojiUrl) {
            hasEmoji = true;
            if (match.index > lastIndex) {
              fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
            }
            const image = document.createElement('img');
            image.className = 'emoji-inline';
            image.src = emojiUrl;
            image.alt = `:${shortcode}:`;
            image.loading = 'lazy';
            image.setAttribute('aria-label', `:${shortcode}:`);
            fragment.appendChild(image);
            lastIndex = emojiRegex.lastIndex;
          } else if (!emojiLookupLoaded) {
            needsEmojiLookup = true;
          }
        }
      }
      
      if (hasEmoji) {
        if (lastIndex < text.length) {
          fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
        }
        textNode.parentNode.replaceChild(fragment, textNode);
      }
    });

    if (needsEmojiLookup) {
      scheduleEmojiLookupRefresh();
    }
  }

  function debouncedRender() {
    clearTimeout(markdownRenderTimeout);
    const delay = getPreviewRenderDelay(markdownEditor.value);
    markdownRenderTimeout = setTimeout(function() {
      renderMarkdown({ reason: 'edit' });
    }, delay);
  }

  function countWordsFast(text) {
    let count = 0;
    let inWord = false;
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      if (
        code === 32 ||
        code === 9 ||
        code === 10 ||
        code === 13 ||
        code === 12 ||
        code === 11 ||
        code === 160
      ) {
        inWord = false;
      } else if (!inWord) {
        count += 1;
        inWord = true;
      }
    }
    return count;
  }

  function updateDocumentStats() {
    const text = markdownEditor.value;

    const charCount = text.length;
    charCountElement.textContent = charCount.toLocaleString();

    const wordCount = countWordsFast(text);
    wordCountElement.textContent = wordCount.toLocaleString();

    const readingTimeMinutes = Math.ceil(wordCount / 200);
    readingTimeElement.textContent = readingTimeMinutes;
  }

  function syncEditorToPreview() {
    if (!syncScrollingEnabled || isPreviewScrolling || isProgrammaticScrolling) return;
    isEditorScrolling = true;

    if (scrollSyncTimeout) cancelAnimationFrame(scrollSyncTimeout);
    scrollSyncTimeout = requestAnimationFrame(function() {
      const editorScrollRange = markdownEditor.scrollHeight - markdownEditor.clientHeight;
      const editorScrollRatio =
        editorScrollRange > 0 ? markdownEditor.scrollTop / editorScrollRange : 0;
      const previewScrollPosition =
        (previewPane.scrollHeight - previewPane.clientHeight) *
        editorScrollRatio;

      if (!isNaN(previewScrollPosition) && isFinite(previewScrollPosition)) {
        previewPane.scrollTop = previewScrollPosition;
      }

      setTimeout(function() {
        isEditorScrolling = false;
      }, 50);
    });
  }

  function syncPreviewToEditor() {
    if (!syncScrollingEnabled || isEditorScrolling || isProgrammaticScrolling) return;
    isPreviewScrolling = true;

    if (scrollSyncTimeout) cancelAnimationFrame(scrollSyncTimeout);
    scrollSyncTimeout = requestAnimationFrame(function() {
      const previewScrollRange = previewPane.scrollHeight - previewPane.clientHeight;
      const previewScrollRatio =
        previewScrollRange > 0 ? previewPane.scrollTop / previewScrollRange : 0;
      const editorScrollPosition =
        (markdownEditor.scrollHeight - markdownEditor.clientHeight) *
        previewScrollRatio;

      if (!isNaN(editorScrollPosition) && isFinite(editorScrollPosition)) {
        markdownEditor.scrollTop = editorScrollPosition;
        syncEditorScrollOverlays();
      }

      setTimeout(function() {
        isPreviewScrolling = false;
      }, 50);
    });
  }

  function toggleSyncScrolling() {
    syncScrollingEnabled = !syncScrollingEnabled;
    if (syncScrollingEnabled) {
      toggleSyncButton.innerHTML = '<i class="bi bi-link-45deg"></i> <span class="btn-text">Sync Off</span>';
      toggleSyncButton.classList.add("sync-disabled");
      toggleSyncButton.classList.remove("sync-enabled");
      toggleSyncButton.classList.add("sync-active");
    } else {
      toggleSyncButton.innerHTML = '<i class="bi bi-link"></i> <span class="btn-text">Sync On</span>';
      toggleSyncButton.classList.add("sync-enabled");
      toggleSyncButton.classList.remove("sync-disabled");
      toggleSyncButton.classList.remove("sync-active");
    }
    saveGlobalState({ syncScrollingEnabled });
  }

  // View Mode Functions - Story 1.1 & 1.2
  function setViewMode(mode) {
    if (mode === currentViewMode) return;

    const previousMode = currentViewMode;
    currentViewMode = mode;

    // Update content container class
    contentContainer.classList.remove('view-editor-only', 'view-preview-only', 'view-split');
    contentContainer.classList.add('view-' + (mode === 'editor' ? 'editor-only' : mode === 'preview' ? 'preview-only' : 'split'));

    // Update button active states (desktop)
    viewModeButtons.forEach(btn => {
      const btnMode = btn.getAttribute('data-view-mode');
      if (btnMode === mode) {
        btn.classList.add('is-active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('is-active');
        btn.setAttribute('aria-pressed', 'false');
      }
    });

    // Story 1.4: Update mobile button active states
    mobileViewModeButtons.forEach(btn => {
      const btnMode = btn.getAttribute('data-mode');
      if (btnMode === mode) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      }
    });

    // Story 1.2: Show/hide sync toggle based on view mode
    updateSyncToggleVisibility(mode);

    // Story 1.3: Handle pane widths when switching modes
    if (mode === 'split') {
      // Restore preserved pane widths when entering split mode
      applyPaneWidths();
    } else {
      // Reset inline pane widths when not in split mode
      resetPaneWidths();
    }

    // Re-render markdown when switching to a view that includes preview
    if (mode === 'split' || mode === 'preview') {
      renderMarkdown({ reason: 'view-switch' });
    }

    if (mode === 'split' || mode === 'editor') {
      refreshEditorWidth();
      scheduleLineNumberUpdate({ force: true });
      updateFindHighlights();
      scheduleEditorOverlayScrollSync();
    }
  }

  function resolveViewToggleMode(mode) {
    if ((mode === 'editor' || mode === 'preview') && currentViewMode === mode) {
      return 'split';
    }
    return mode;
  }

  // Story 1.2: Update sync toggle visibility
  function updateSyncToggleVisibility(mode) {
    const isSplitView = mode === 'split';

    // Desktop sync toggle
    if (toggleSyncButton) {
      toggleSyncButton.style.display = '';
      toggleSyncButton.disabled = !isSplitView;
      toggleSyncButton.setAttribute('aria-disabled', String(!isSplitView));
      toggleSyncButton.removeAttribute('aria-hidden');
    }

    // Mobile sync toggle
    if (mobileToggleSync) {
      mobileToggleSync.style.display = '';
      mobileToggleSync.disabled = !isSplitView;
      mobileToggleSync.setAttribute('aria-disabled', String(!isSplitView));
      mobileToggleSync.removeAttribute('aria-hidden');
    }
  }

  function replaceEditorRange(start, end, replacement, selectStart, selectEnd) {
    pushProgrammaticHistoryState();
    markdownEditor.focus();
    markdownEditor.setRangeText(replacement, start, end, 'end');
    const nextStart = typeof selectStart === 'number' ? selectStart : start + replacement.length;
    const nextEnd = typeof selectEnd === 'number' ? selectEnd : nextStart;
    markdownEditor.setSelectionRange(nextStart, nextEnd);
    markdownEditor.dispatchEvent(new Event('input', { bubbles: true }));
    lastPushedValue = markdownEditor.value;
    lastInputType = 'programmatic';
  }

  function wrapEditorSelection(prefix, suffix, placeholder) {
    const start = markdownEditor.selectionStart;
    const end = markdownEditor.selectionEnd;
    const selected = markdownEditor.value.slice(start, end) || placeholder;
    const replacement = prefix + selected + suffix;
    const selectionStart = start + prefix.length;
    const selectionEnd = selectionStart + selected.length;
    replaceEditorRange(start, end, replacement, selectionStart, selectionEnd);
  }

  function getCurrentLineRange() {
    const value = markdownEditor.value;
    const start = markdownEditor.selectionStart;
    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    let lineEnd = value.indexOf('\n', start);
    if (lineEnd === -1) lineEnd = value.length;
    return { start: lineStart, end: lineEnd, text: value.slice(lineStart, lineEnd) };
  }

  function getSelectedLineRange() {
    const value = markdownEditor.value;
    const start = markdownEditor.selectionStart;
    const end = markdownEditor.selectionEnd;
    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    let lineEnd = value.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = value.length;
    return { start: lineStart, end: lineEnd, text: value.slice(lineStart, lineEnd) };
  }

  function transformEditorLines(transformer) {
    const range = getSelectedLineRange();
    const replacement = range.text.split('\n').map(transformer).join('\n');
    replaceEditorRange(range.start, range.end, replacement, range.start, range.start + replacement.length);
  }

  function getListLineRange() {
    const value = markdownEditor.value;
    const start = markdownEditor.selectionStart;
    const end = markdownEditor.selectionEnd;
    const effectiveEnd = end > start && value[end - 1] === '\n' ? end - 1 : end;
    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    let lineEnd = value.indexOf('\n', effectiveEnd);
    if (lineEnd === -1) lineEnd = value.length;
    return { start: lineStart, end: lineEnd, text: value.slice(lineStart, lineEnd) };
  }

  function parseMarkdownListItem(line) {
    const match = line.match(/^(\s*)((\d+)\.|[-*+])(?:\s+|$)(.*)$/);
    if (!match) return null;
    const isOrdered = typeof match[3] !== 'undefined';
    return {
      type: isOrdered ? 'ordered' : 'unordered',
      indent: match[1],
      marker: match[2],
      number: isOrdered ? parseInt(match[3], 10) : null,
      bullet: isOrdered ? null : match[2],
      body: match[4] || '',
      prefix: match[1] + match[2] + ' '
    };
  }

  function stripListMarkerForApply(line) {
    const parsed = parseMarkdownListItem(line);
    if (parsed) {
      return { indent: parsed.indent, body: parsed.body };
    }
    const match = line.match(/^(\s*)(.*)$/);
    return { indent: match ? match[1] : '', body: match ? match[2] : line };
  }

  function getPreviousLineInfo(lineStart) {
    if (lineStart <= 0) return null;
    const value = markdownEditor.value;
    const previousEnd = lineStart - 1;
    const previousStart = previousEnd > 0 ? value.lastIndexOf('\n', previousEnd - 1) + 1 : 0;
    return { start: previousStart, text: value.slice(previousStart, previousEnd) };
  }

  function getOrderedListStartNumber(lineStart) {
    const previousLine = getPreviousLineInfo(lineStart);
    if (!previousLine || !previousLine.text.trim()) return 1;
    const parsed = parseMarkdownListItem(previousLine.text);
    return parsed && parsed.type === 'ordered' ? parsed.number + 1 : 1;
  }

  function applyMarkdownList(type) {
    const range = getListLineRange();
    const hadSelection = markdownEditor.selectionStart !== markdownEditor.selectionEnd;
    const lines = range.text.split('\n');
    let nextNumber = type === 'ordered' ? getOrderedListStartNumber(range.start) : 1;
    let firstPrefixLength = null;

    const replacement = lines.map(function(line) {
      const stripped = stripListMarkerForApply(line);
      const prefix = type === 'ordered'
        ? stripped.indent + (nextNumber++) + '. '
        : stripped.indent + '- ';
      if (firstPrefixLength === null) firstPrefixLength = prefix.length;
      return prefix + stripped.body;
    }).join('\n');

    const isSingleLine = lines.length === 1;
    const caret = (!hadSelection || isSingleLine)
      ? range.start + (firstPrefixLength || 0)
      : range.start + replacement.length;

    replaceEditorRange(range.start, range.end, replacement, caret, caret);
  }

  function renumberOrderedListAfterPosition(position, nextNumber) {
    let value = markdownEditor.value;
    let lineStart = value.indexOf('\n', position);
    if (lineStart === -1) return;
    lineStart += 1;

    let changed = false;
    while (lineStart < value.length) {
      let lineEnd = value.indexOf('\n', lineStart);
      const hasNewline = lineEnd !== -1;
      if (!hasNewline) lineEnd = value.length;

      const line = value.slice(lineStart, lineEnd);
      if (!line.trim()) break;

      const parsed = parseMarkdownListItem(line);
      if (!parsed || parsed.type !== 'ordered') break;

      const replacement = parsed.indent + nextNumber + '. ' + parsed.body;
      if (replacement !== line) {
        value = value.slice(0, lineStart) + replacement + value.slice(lineEnd);
        changed = true;
      }

      lineStart += replacement.length + (hasNewline ? 1 : 0);
      nextNumber += 1;
    }

    if (changed) {
      const selectionStart = markdownEditor.selectionStart;
      const selectionEnd = markdownEditor.selectionEnd;
      markdownEditor.value = value;
      markdownEditor.setSelectionRange(selectionStart, selectionEnd);
      markdownEditor.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function handleListEnter(e) {
    if (e.key !== 'Enter' || e.shiftKey || markdownEditor.selectionStart !== markdownEditor.selectionEnd) {
      return false;
    }

    const range = getCurrentLineRange();
    const parsed = parseMarkdownListItem(range.text);
    if (!parsed) return false;

    e.preventDefault();
    if (!parsed.body.trim()) {
      const caret = range.start + parsed.indent.length;
      replaceEditorRange(range.start, range.end, parsed.indent, caret, caret);
      return true;
    }

    const nextPrefix = parsed.type === 'ordered'
      ? parsed.indent + (parsed.number + 1) + '. '
      : parsed.indent + parsed.bullet + ' ';
    const insertAt = markdownEditor.selectionStart;
    const caret = insertAt + 1 + nextPrefix.length;
    replaceEditorRange(insertAt, insertAt, '\n' + nextPrefix, caret, caret);

    if (parsed.type === 'ordered') {
      renumberOrderedListAfterPosition(caret, parsed.number + 2);
    }

    return true;
  }

  function transformSelectionOrCurrentLine(transformer) {
    let start = markdownEditor.selectionStart;
    let end = markdownEditor.selectionEnd;
    if (start === end) {
      const range = getCurrentLineRange();
      start = range.start;
      end = range.end;
    }
    const replacement = transformer(markdownEditor.value.slice(start, end));
    replaceEditorRange(start, end, replacement, start, start + replacement.length);
  }

  function stripBasicMarkdown(text) {
    return text
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^>\s?/gm, '')
      .replace(/^(\s*)([-*+]|\d+\.)\s+/gm, '$1')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/~~(.*?)~~/g, '$1')
      .replace(/`([^`]+)`/g, '$1');
  }

  function getOrCreateTabHistory(tabId) {
    if (!tabId) return { undoStack: [], redoStack: [] };
    if (!tabHistories[tabId]) {
      tabHistories[tabId] = {
        undoStack: [],
        redoStack: []
      };
    }
    return tabHistories[tabId];
  }

  function initTabHistory(tabId, initialValue) {
    const hist = getOrCreateTabHistory(tabId);
    if (hist.undoStack.length === 0) {
      hist.undoStack.push({
        value: initialValue || '',
        selectionStart: 0,
        selectionEnd: 0
      });
      lastPushedValue = initialValue || '';
      currentHistoryTabId = tabId;
      pendingState = null;
    }
  }

  function pushProgrammaticHistoryState() {
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      typingTimeout = null;
    }
    
    const tabId = activeTabId;
    const hist = getOrCreateTabHistory(tabId);
    const currentValue = markdownEditor.value;
    
    if (pendingState) {
      hist.undoStack.push(pendingState);
      if (hist.undoStack.length > 200) {
        hist.undoStack.shift();
      }
      hist.redoStack.length = 0;
      pendingState = null;
      lastPushedValue = currentValue;
    } else if (currentValue !== lastPushedValue) {
      hist.undoStack.push({
        value: currentValue,
        selectionStart: markdownEditor.selectionStart,
        selectionEnd: markdownEditor.selectionEnd
      });
      if (hist.undoStack.length > 200) {
        hist.undoStack.shift();
      }
      hist.redoStack.length = 0;
      lastPushedValue = currentValue;
    }
    updateUndoRedoButtons();
  }

  function commitPendingState() {
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      typingTimeout = null;
    }
    if (!pendingState) return;
    
    const tabId = activeTabId;
    const hist = getOrCreateTabHistory(tabId);
    
    hist.undoStack.push(pendingState);
    if (hist.undoStack.length > 200) {
      hist.undoStack.shift();
    }
    
    hist.redoStack.length = 0;
    lastPushedValue = markdownEditor.value;
    pendingState = null;
    updateUndoRedoButtons();
  }

  function handleKeystrokeHistory(e) {
    const currentValue = markdownEditor.value;
    if (currentValue === lastPushedValue) return;
    
    const inputType = e && typeof e.inputType === 'string' ? e.inputType : '';
    
    if (!pendingState) {
      pendingState = {
        value: lastPushedValue,
        selectionStart: lastCursorStart,
        selectionEnd: lastCursorEnd
      };
    }
    
    let shouldCommit = false;
    
    if (inputType === 'insertLineBreak' || inputType === 'insertParagraph' || inputType === 'insertFromPaste' || lastInputType === 'programmatic') {
      shouldCommit = true;
    } else if (e && e.data === ' ') {
      shouldCommit = true;
    } else {
      const isDelete = inputType.startsWith('delete');
      const wasDelete = lastInputType === 'delete';
      const isInsert = inputType.startsWith('insert');
      const wasInsert = lastInputType === 'insert';
      
      if ((isDelete && wasInsert) || (isInsert && wasDelete)) {
        shouldCommit = true;
      }
    }
    
    if (shouldCommit) {
      commitPendingState();
    }
    
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    typingTimeout = setTimeout(function() {
      commitPendingState();
    }, 1000);
    
    if (inputType.startsWith('delete')) {
      lastInputType = 'delete';
    } else if (inputType.startsWith('insert')) {
      lastInputType = 'insert';
    } else {
      lastInputType = 'other';
    }
  }

  function updateLastCursor() {
    if (markdownEditor) {
      lastCursorStart = markdownEditor.selectionStart;
      lastCursorEnd = markdownEditor.selectionEnd;
    }
  }

  function updateUndoRedoButtons() {
    const undoBtn = document.querySelector('[data-md-action="undo"]');
    const redoBtn = document.querySelector('[data-md-action="redo"]');
    if (!undoBtn || !redoBtn) return;
    
    const tabId = activeTabId;
    const hist = getOrCreateTabHistory(tabId);
    
    const canUndo = hist.undoStack.length > 0 || pendingState !== null;
    const canRedo = hist.redoStack.length > 0;
    
    undoBtn.disabled = !canUndo;
    undoBtn.classList.toggle('disabled', !canUndo);
    
    redoBtn.disabled = !canRedo;
    redoBtn.classList.toggle('disabled', !canRedo);
  }

  function executeUndo() {
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      typingTimeout = null;
    }
    
    const tabId = activeTabId;
    const hist = getOrCreateTabHistory(tabId);
    const currentValue = markdownEditor.value;
    
    let stateToRestore = null;
    
    if (pendingState) {
      stateToRestore = pendingState;
      pendingState = null;
      
      hist.redoStack.push({
        value: currentValue,
        selectionStart: markdownEditor.selectionStart,
        selectionEnd: markdownEditor.selectionEnd
      });
      if (hist.redoStack.length > 200) {
        hist.redoStack.shift();
      }
    } else if (hist.undoStack.length > 0) {
      const topState = hist.undoStack.pop();
      if (topState) {
        stateToRestore = topState;
        
        hist.redoStack.push({
          value: currentValue,
          selectionStart: markdownEditor.selectionStart,
          selectionEnd: markdownEditor.selectionEnd
        });
        if (hist.redoStack.length > 200) {
          hist.redoStack.shift();
        }
      }
    }
    
    if (stateToRestore) {
      markdownEditor.value = stateToRestore.value;
      markdownEditor.setSelectionRange(stateToRestore.selectionStart, stateToRestore.selectionEnd);
      lastPushedValue = stateToRestore.value;
      lastInputType = null;
      
      markdownEditor.dispatchEvent(new Event('input', { bubbles: true }));
      saveCurrentTabState();
    }
    
    updateUndoRedoButtons();
  }

  function executeRedo() {
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      typingTimeout = null;
    }
    
    const tabId = activeTabId;
    const hist = getOrCreateTabHistory(tabId);
    const currentValue = markdownEditor.value;
    
    if (hist.redoStack.length > 0) {
      const stateToRestore = hist.redoStack.pop();
      
      hist.undoStack.push({
        value: currentValue,
        selectionStart: markdownEditor.selectionStart,
        selectionEnd: markdownEditor.selectionEnd
      });
      if (hist.undoStack.length > 200) {
        hist.undoStack.shift();
      }
      
      markdownEditor.value = stateToRestore.value;
      markdownEditor.setSelectionRange(stateToRestore.selectionStart, stateToRestore.selectionEnd);
      lastPushedValue = stateToRestore.value;
      lastInputType = null;
      pendingState = null;
      
      markdownEditor.dispatchEvent(new Event('input', { bubbles: true }));
      saveCurrentTabState();
    }
    
    updateUndoRedoButtons();
  }

  function stripMarkdownFormatting(text) {
    if (!text) return '';
    return text
      // Remove fenced code block syntax
      .replace(/^```[a-zA-Z0-9-]*\r?\n?/gm, '')
      .replace(/```\r?$/gm, '')
      // Remove reference link definitions (e.g., [id]: url "title")
      .replace(/^\[[^\]]+\]:\s*\S+(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*$/gm, '')
      // Strip basic markdown constructs (headers, blockquotes, lists, bold, italic, strikethrough, code)
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^>\s?/gm, '')
      .replace(/^(\s*)([-*+]|\d+\.)\s+/gm, '$1')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      // HTML alignment tags or custom tags (strip the tags, keep inner text)
      .replace(/<[^>]+>/g, '')
      // Bold, Italic, Strikethrough, Inline code
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/~~(.*?)~~/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      // Remove horizontal rules
      .replace(/^\s*[-*_]{3,}\s*$/gm, '');
  }

  function applyClearFormatting() {
    const fullText = markdownEditor.value;
    pushProgrammaticHistoryState();
    replaceEditorRange(0, fullText.length, '', 0, 0);
    
    // Force immediate visual rendering and gutter update
    renderMarkdown();
    updateLineNumbers();
    updateFindHighlights();
    saveCurrentTabState();
  }

  function toTitleCase(text) {
    return text.toLowerCase().replace(/\b\w/g, function(letter) {
      return letter.toUpperCase();
    });
  }

  function toSlug(text) {
    const slug = text.toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    return slug || 'section';
  }

  function getUsedReferenceNumbers(text) {
    const used = new Set();
    const regex = /^\[(\d+)\]:/gm;
    let match = regex.exec(text);
    while (match) {
      const num = parseInt(match[1], 10);
      if (!Number.isNaN(num)) used.add(num);
      match = regex.exec(text);
    }
    return used;
  }

  function extractReferenceDefinitions(markdown) {
    const definitions = new Map();
    // Matches reference definitions: [1]: <url> "title", [1]: url 'title', or [1]: url (title)
    const definitionRegex = /^\[(\d+)\]:\s*(?:<([^>\s]+)>|(\S+))(?:\s+(?:"([^"]*)"|'([^']*)'|\(([^)]+)\)))?\s*$/gm;
    const cleanedMarkdown = markdown.replace(
      definitionRegex,
      function(match, numberText, angleUrl, plainUrl, titleDouble, titleSingle, titleParen) {
        const number = parseInt(numberText, 10);
        if (Number.isNaN(number)) return match;
        const url = (angleUrl || plainUrl || '').trim();
        if (!url) return match;
        const title = titleDouble || titleSingle || titleParen || '';
        definitions.set(number, { url: url, title: title });
        return '';
      }
    );
    return { definitions, cleanedMarkdown };
  }

  function getNextAvailableReferenceNumber(used, startNumber) {
    let next = Math.max(1, startNumber || 1);
    while (used.has(next)) next += 1;
    return next;
  }

  function sanitizeMarkdownTitle(title) {
    return title
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');
  }

  function isSafeReferenceUrl(url) {
    if (!url) return false;
    try {
      const parsed = new URL(url, window.location.href);
      return ['http:', 'https:', 'mailto:', 'tel:', 'blob:'].includes(parsed.protocol);
    } catch (e) {
      return false;
    }
  }

  function applyReferencePreviewLinks(container, referenceDefinitions) {
    if (!container || !referenceDefinitions || referenceDefinitions.size === 0) return;

    function applyReferenceStyle(link, number) {
      const definition = referenceDefinitions.get(number);
      if (definition && definition.url && isSafeReferenceUrl(definition.url)) {
        link.setAttribute('href', definition.url);
        if (definition.title) {
          link.setAttribute('title', definition.title);
        } else {
          link.removeAttribute('title');
        }
      } else {
        link.removeAttribute('href');
      }
      link.textContent = '[' + number + ']';
      link.classList.add('reference-link');
    }

    const links = container.querySelectorAll('a');
    links.forEach(function(link) {
      const text = link.textContent.trim();
      let number = null;
      if (/^\d+$/.test(text)) {
        number = parseInt(text, 10);
      } else {
        const match = text.match(/^\[(\d+)\]$/);
        if (match) number = parseInt(match[1], 10);
      }
      if (number && referenceDefinitions.has(number)) {
        applyReferenceStyle(link, number);
      }
    });

    const referenceRegex = /\[(\d+)\](?!\s*:)/g;
    const nodesToProcess = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (!parent || !node.nodeValue) continue;
      if (parent.closest('a, code, pre, script, style, mjx-container')) continue;
      referenceRegex.lastIndex = 0;
      if (referenceRegex.test(node.nodeValue)) {
        nodesToProcess.push(node);
      }
    }
    nodesToProcess.forEach(function(node) {
      const text = node.nodeValue;
      referenceRegex.lastIndex = 0;
      let match;
      let lastIndex = 0;
      const fragment = document.createDocumentFragment();
      while ((match = referenceRegex.exec(text)) !== null) {
        const before = text.slice(lastIndex, match.index);
        if (before) fragment.appendChild(document.createTextNode(before));
        const number = parseInt(match[1], 10);
        const definition = referenceDefinitions.get(number);
        if (definition && definition.url && isSafeReferenceUrl(definition.url)) {
          const link = document.createElement('a');
          link.href = definition.url;
          if (definition.title) link.title = definition.title;
          link.textContent = '[' + number + ']';
          link.classList.add('reference-link');
          fragment.appendChild(link);
        } else {
          fragment.appendChild(document.createTextNode(match[0]));
        }
        lastIndex = match.index + match[0].length;
      }
      const after = text.slice(lastIndex);
      if (after) fragment.appendChild(document.createTextNode(after));
      node.parentNode.replaceChild(fragment, node);
    });
  }

  function cleanupImageObjectUrls() {
    if (imageObjectUrls.size === 0) return;
    const contents = [markdownEditor.value];
    if (Array.isArray(tabs)) {
      tabs.forEach(function(tab) {
        if (tab && typeof tab.content === 'string' && tab.content) {
          contents.push(tab.content);
        }
      });
    }
    const snapshot = contents.join('\n');
    Array.from(imageObjectUrls).forEach(function(url) {
      if (!snapshot.includes(url)) {
        URL.revokeObjectURL(url);
        imageObjectUrls.delete(url);
      }
    });
  }

  function insertAlignmentBlock(align) {
    const allowedAlignments = new Set(['left', 'center', 'right']);
    const isAllowed = allowedAlignments.has(align);
    if (!isAllowed) {
      console.warn('Unsupported alignment:', align);
      return;
    }
    const safeAlign = align;
    const value = markdownEditor.value;
    const start = markdownEditor.selectionStart;
    const end = markdownEditor.selectionEnd;
    const selected = value.slice(start, end);
    const hasSelection = start !== end;
    const blockStart = `<div align="${safeAlign}">\n`;
    const blockEnd = `\n</div>`;
    const block = `${blockStart}${hasSelection ? selected : ''}${blockEnd}`;
    const needsLeadingBreak = start > 0 && value[start - 1] !== '\n';
    const needsTrailingBreak = end < value.length && value[end] !== '\n';
    const replacement = (needsLeadingBreak ? '\n' : '') + block + (needsTrailingBreak ? '\n' : '');
    const contentStart = start + (needsLeadingBreak ? 1 : 0) + blockStart.length;
    const contentEnd = contentStart + (hasSelection ? selected.length : 0);
    replaceEditorRange(start, end, replacement, contentStart, hasSelection ? contentEnd : contentStart);
  }

  function insertMarkdownBlock(block, startOverride, endOverride) {
    const value = markdownEditor.value;
    const start = typeof startOverride === 'number' ? startOverride : markdownEditor.selectionStart;
    const end = typeof endOverride === 'number' ? endOverride : markdownEditor.selectionEnd;
    const needsLeadingBreak = start > 0 && value[start - 1] !== '\n';
    const needsTrailingBreak = end < value.length && value[end] !== '\n';
    const replacement = (needsLeadingBreak ? '\n' : '') + block + (needsTrailingBreak ? '\n' : '');
    const caret = start + replacement.length;
    replaceEditorRange(start, end, replacement, caret, caret);
  }

  function clampNumber(value, min, max, fallback) {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
  }

  function buildMarkdownTable(columns, rows) {
    const header = Array.from({ length: columns }, (_, index) => `Column ${index + 1}`).join(' | ');
    const divider = Array.from({ length: columns }, () => '---').join(' | ');
    const bodyRows = Array.from({ length: rows }, () => `| ${Array.from({ length: columns }, () => 'Value').join(' | ')} |`);
    return `| ${header} |\n| ${divider} |\n${bodyRows.join('\n')}\n`;
  }

  function loadEmojiEntries() {
    if (emojiLoadPromise) return emojiLoadPromise;
    emojiLoadPromise = fetch(EMOJI_API_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`Emoji request failed (${response.status})`);
        return response.json();
      })
      .then((data) => {
        emojiEntries = Object.keys(data)
          .sort((a, b) => a.localeCompare(b))
          .map((name) => ({
            name,
            url: data[name],
            shortcode: `:${name}:`,
            search: `${name} :${name}:`.toLowerCase(),
          }));
        emojiUrlMap = new Map(emojiEntries.map((entry) => [entry.name, entry.url]));
        emojiLookupLoaded = true;
        return emojiEntries;
      })
      .catch((error) => {
        console.error('Failed to load GitHub emojis:', error);
        emojiEntries = [];
        emojiUrlMap = new Map();
        emojiLookupLoaded = true;
        return emojiEntries;
      });
    return emojiLoadPromise;
  }

  function createAlertPreview(type, meta) {
    const wrapper = document.createElement('div');
    wrapper.className = `markdown-alert markdown-alert-${type}`;
    const title = document.createElement('p');
    title.className = 'markdown-alert-title';
    const icon = document.createElement('span');
    icon.className = 'markdown-alert-icon';
    icon.setAttribute('aria-hidden', 'true');
    if (meta.path) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', meta.viewBox || '0 0 512 512');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', meta.path);
      svg.appendChild(path);
      icon.appendChild(svg);
    }
    const label = document.createElement('span');
    label.textContent = meta.label;
    title.appendChild(icon);
    title.appendChild(label);
    const body = document.createElement('p');
    body.textContent = `${meta.label} details go here.`;
    wrapper.appendChild(title);
    wrapper.appendChild(body);
    return wrapper;
  }

  function flashCopyButton(button) {
    const icon = button.querySelector('i');
    if (!icon) return;
    icon.className = 'bi bi-check-lg';
    button.classList.add('is-copied');
    clearTimeout(button.copyTimeout);
    button.copyTimeout = setTimeout(() => {
      icon.className = 'bi bi-clipboard';
      button.classList.remove('is-copied');
    }, 1200);
  }

  function openTableModal() {
    const modal = document.getElementById('table-modal');
    const columnInput = document.getElementById('table-modal-columns');
    const rowInput = document.getElementById('table-modal-rows');
    const confirmBtn = document.getElementById('table-modal-insert');
    const cancelBtn = document.getElementById('table-modal-cancel');
    if (!modal || !columnInput || !rowInput || !confirmBtn || !cancelBtn) return;
    const start = markdownEditor.selectionStart;
    const end = markdownEditor.selectionEnd;
    columnInput.value = '3';
    rowInput.value = '1';
    modal.style.display = 'flex';

    function insertTable() {
      const columns = clampNumber(columnInput.value, 1, 20, 3);
      const rows = clampNumber(rowInput.value, 1, 20, 1);
      const table = buildMarkdownTable(columns, rows);
      modal.style.display = 'none';
      cleanup();
      insertMarkdownBlock(table, start, end);
    }

    function closeModal() {
      modal.style.display = 'none';
      cleanup();
    }

    function onKey(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        insertTable();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    }

    function cleanup() {
      confirmBtn.removeEventListener('click', insertTable);
      cancelBtn.removeEventListener('click', closeModal);
      columnInput.removeEventListener('keydown', onKey);
      rowInput.removeEventListener('keydown', onKey);
    }

    confirmBtn.addEventListener('click', insertTable);
    cancelBtn.addEventListener('click', closeModal);
    columnInput.addEventListener('keydown', onKey);
    rowInput.addEventListener('keydown', onKey);

    requestAnimationFrame(() => {
      columnInput.focus();
      columnInput.select();
    });
  }

  function openEmojiModal() {
    const modal = document.getElementById('emoji-modal');
    const grid = document.getElementById('emoji-modal-grid');
    const emptyMessage = document.getElementById('emoji-modal-empty');
    const searchInput = document.getElementById('emoji-modal-search');
    const confirmBtn = document.getElementById('emoji-modal-insert');
    const cancelBtn = document.getElementById('emoji-modal-cancel');
    if (!modal || !grid || !emptyMessage || !searchInput || !confirmBtn || !cancelBtn) return;
    const start = markdownEditor.selectionStart;
    const end = markdownEditor.selectionEnd;
    modal.style.display = 'flex';
    confirmBtn.disabled = true;

    // Localized and accessible announcements for loading
    const loadingText = I18N_DICTS[activeLang].loadingEmojis || "Loading emojis...";
    emptyMessage.textContent = loadingText;
    emptyMessage.style.display = 'block';
    announceToScreenReader(loadingText);

    searchInput.value = '';
    emojiSelection.clear();
    // PERF-007: Clear elements using textContent
    grid.textContent = '';
    grid.scrollTop = 0;
    emojiItems = [];

    // Render visual placeholders during active requests
    if (!emojiLookupLoaded) {
      renderEmojiSkeletons();
    }

    let currentFilteredEntries = [];
    let renderedCount = 0;
    const CHUNK_SIZE = 120;

    function updateInsertState() {
      confirmBtn.disabled = emojiSelection.size === 0;
    }

    function toggleSelection(shortcode, element) {
      if (emojiSelection.has(shortcode)) {
        emojiSelection.delete(shortcode);
        element.classList.remove('is-selected');
      } else {
        emojiSelection.add(shortcode);
        element.classList.add('is-selected');
      }
      element.setAttribute('aria-pressed', emojiSelection.has(shortcode).toString());
      updateInsertState();
    }

    function renderEmojiChunk(clear = false) {
      if (clear) {
        // PERF-007: Clear elements using textContent
        grid.textContent = '';
        emojiItems = [];
        renderedCount = 0;
      }

      const nextBatch = currentFilteredEntries.slice(renderedCount, renderedCount + CHUNK_SIZE);
      if (nextBatch.length === 0) {
        emptyMessage.style.display = emojiItems.length ? 'none' : 'block';
        return;
      }

      const fragment = document.createDocumentFragment();
      const newItems = nextBatch.map((entry) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'emoji-item';

        const isSelected = emojiSelection.has(entry.shortcode);
        if (isSelected) {
          item.classList.add('is-selected');
        }
        item.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        item.dataset.search = entry.search;
        item.dataset.shortcode = entry.shortcode;

        const preview = document.createElement('span');
        preview.className = 'emoji-preview';
        const image = document.createElement('img');
        image.src = entry.url;
        image.alt = entry.shortcode;
        image.loading = 'lazy';
        preview.appendChild(image);

        const shortcodeRow = document.createElement('div');
        shortcodeRow.className = 'emoji-shortcode';
        const code = document.createElement('span');
        code.textContent = entry.shortcode;
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'emoji-copy-btn';
        copyBtn.setAttribute('aria-label', `Copy ${entry.shortcode}`);
        copyBtn.innerHTML = '<i class="bi bi-clipboard"></i>';
        copyBtn.addEventListener('click', (event) => {
          event.stopPropagation();
          copyTextToClipboard(entry.shortcode)
            .then(() => flashCopyButton(copyBtn))
            .catch((error) => console.error('Copy failed:', error));
        });
        shortcodeRow.appendChild(code);
        shortcodeRow.appendChild(copyBtn);

        item.appendChild(preview);
        item.appendChild(shortcodeRow);
        item.addEventListener('click', () => toggleSelection(entry.shortcode, item));
        fragment.appendChild(item);
        return { element: item, search: entry.search, shortcode: entry.shortcode };
      });

      emojiItems = emojiItems.concat(newItems);
      grid.appendChild(fragment);
      renderedCount += nextBatch.length;
      emptyMessage.style.display = emojiItems.length ? 'none' : 'block';
    }

    function applyFilter() {
      const query = searchInput.value.trim().toLowerCase();
      currentFilteredEntries = emojiEntries.filter(entry => !query || entry.search.includes(query));
      renderEmojiChunk(true);
    }

    function handleScroll() {
      if (grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 60) {
        renderEmojiChunk(false);
      }
    }

    function insertEmojis() {
      if (!emojiSelection.size) return;
      // Retain the modal's visual/definition order of emojis, consistent with the Symbols modal
      const ordered = emojiItems
        .filter(item => emojiSelection.has(item.shortcode))
        .map(item => item.shortcode);
      const insertion = ordered.join(' ');
      modal.style.display = 'none';
      cleanup();
      replaceEditorRange(start, end, insertion, start + insertion.length, start + insertion.length);
    }

    function closeModal() {
      modal.style.display = 'none';
      cleanup();
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    }

    function cleanup() {
      confirmBtn.removeEventListener('click', insertEmojis);
      cancelBtn.removeEventListener('click', closeModal);
      searchInput.removeEventListener('input', applyFilter);
      searchInput.removeEventListener('keydown', onKey);
      grid.removeEventListener('scroll', handleScroll);
    }

    loadEmojiEntries().then((entries) => {
      if (!entries.length) {
        emptyMessage.textContent = 'Unable to load emojis.';
        emptyMessage.style.display = 'block';
        // PERF-007: Clear elements using textContent
        grid.textContent = '';
        emojiItems = [];
        announceToScreenReader("Failed to load emojis.");
        return;
      }
      currentFilteredEntries = entries;
      renderEmojiChunk(true);
      emptyMessage.textContent = 'No emojis found.';
      announceToScreenReader("Emojis loaded. " + entries.length + " items available.");
      updateInsertState();
    });

    confirmBtn.addEventListener('click', insertEmojis);
    cancelBtn.addEventListener('click', closeModal);
    searchInput.addEventListener('input', applyFilter);
    searchInput.addEventListener('keydown', onKey);
    grid.addEventListener('scroll', handleScroll);

    requestAnimationFrame(() => searchInput.focus());
  }

  function openSymbolsModal() {
    const modal = document.getElementById('symbols-modal');
    const grid = document.getElementById('symbols-modal-grid');
    const emptyMessage = document.getElementById('symbols-modal-empty');
    const searchInput = document.getElementById('symbols-modal-search');
    const confirmBtn = document.getElementById('symbols-modal-insert');
    const cancelBtn = document.getElementById('symbols-modal-cancel');
    if (!modal || !grid || !emptyMessage || !searchInput || !confirmBtn || !cancelBtn) return;
    const start = markdownEditor.selectionStart;
    const end = markdownEditor.selectionEnd;
    modal.style.display = 'flex';
    confirmBtn.disabled = true;
    searchInput.value = '';
    symbolSelection.clear();
    // PERF-007: Clear elements using textContent
    grid.textContent = '';

    const sectionEntries = [];
    SYMBOL_SECTIONS.forEach((section) => {
      const sectionWrapper = document.createElement('div');
      sectionWrapper.className = 'symbol-section';
      const title = document.createElement('p');
      title.className = 'symbol-section-title';
      title.textContent = section.title;
      const sectionGrid = document.createElement('div');
      sectionGrid.className = 'symbol-section-grid';
      const sectionItems = section.items.map((entry) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'symbol-item';
        item.setAttribute('aria-pressed', 'false');
        const preview = document.createElement('span');
        preview.className = 'symbol-preview';
        preview.textContent = entry.symbol;
        const codeRow = document.createElement('div');
        codeRow.className = 'symbol-code';
        const code = document.createElement('span');
        code.textContent = entry.entity;
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'symbol-copy-btn';
        copyBtn.setAttribute('aria-label', `Copy ${entry.entity}`);
        copyBtn.innerHTML = '<i class="bi bi-clipboard"></i>';
        copyBtn.addEventListener('click', (event) => {
          event.stopPropagation();
          copyTextToClipboard(entry.entity)
            .then(() => flashCopyButton(copyBtn))
            .catch((error) => console.error('Copy failed:', error));
        });
        codeRow.appendChild(code);
        codeRow.appendChild(copyBtn);
        item.appendChild(preview);
        item.appendChild(codeRow);

        item.dataset.search = `${entry.symbol} ${entry.entity} ${entry.name}`.toLowerCase();
        item.dataset.entity = entry.entity;
        item.addEventListener('click', () => {
          if (symbolSelection.has(entry.entity)) {
            symbolSelection.delete(entry.entity);
            item.classList.remove('is-selected');
          } else {
            symbolSelection.add(entry.entity);
            item.classList.add('is-selected');
          }
          item.setAttribute('aria-pressed', symbolSelection.has(entry.entity).toString());
          confirmBtn.disabled = symbolSelection.size === 0;
        });

        sectionGrid.appendChild(item);
        return { element: item, search: item.dataset.search, entity: entry.entity };
      });
      sectionWrapper.appendChild(title);
      sectionWrapper.appendChild(sectionGrid);
      grid.appendChild(sectionWrapper);
      sectionEntries.push({ wrapper: sectionWrapper, items: sectionItems });
    });

    symbolItems = sectionEntries.flatMap((section) => section.items);

    function applyFilter() {
      const query = searchInput.value.trim().toLowerCase();
      let visibleCount = 0;
      sectionEntries.forEach((section) => {
        let sectionVisible = 0;
        section.items.forEach((item) => {
          const match = !query || item.search.includes(query);
          item.element.style.display = match ? '' : 'none';
          if (match) {
            visibleCount += 1;
            sectionVisible += 1;
          }
        });
        section.wrapper.style.display = sectionVisible ? '' : 'none';
      });
      emptyMessage.style.display = visibleCount ? 'none' : 'block';
    }

    function insertSymbols() {
      if (!symbolSelection.size) return;
      const ordered = symbolItems
        .filter((item) => symbolSelection.has(item.entity))
        .map((item) => item.entity);
      const insertion = ordered.join(' ');
      modal.style.display = 'none';
      cleanup();
      replaceEditorRange(start, end, insertion, start + insertion.length, start + insertion.length);
    }

    function closeModal() {
      modal.style.display = 'none';
      cleanup();
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    }

    function cleanup() {
      confirmBtn.removeEventListener('click', insertSymbols);
      cancelBtn.removeEventListener('click', closeModal);
      searchInput.removeEventListener('input', applyFilter);
      searchInput.removeEventListener('keydown', onKey);
    }

    emptyMessage.textContent = 'No symbols found.';
    applyFilter();
    confirmBtn.addEventListener('click', insertSymbols);
    cancelBtn.addEventListener('click', closeModal);
    searchInput.addEventListener('input', applyFilter);
    searchInput.addEventListener('keydown', onKey);
    requestAnimationFrame(() => searchInput.focus());
  }

  function openAlertModal() {
    const modal = document.getElementById('alert-modal');
    const grid = document.getElementById('alert-modal-grid');
    const confirmBtn = document.getElementById('alert-modal-insert');
    const cancelBtn = document.getElementById('alert-modal-cancel');
    if (!modal || !grid || !confirmBtn || !cancelBtn) return;
    const start = markdownEditor.selectionStart;
    const end = markdownEditor.selectionEnd;
    modal.style.display = 'flex';
    // PERF-007: Clear elements using textContent
    grid.textContent = '';

    const alertTypes = ['note', 'tip', 'important', 'warning', 'caution'];
    let selectedType = alertTypes[0];
    const options = [];
    alertTypes.forEach((type) => {
      const meta = GITHUB_ALERT_META[type] || { label: type };
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'alert-option';
      option.dataset.alertType = type;
      option.setAttribute('aria-pressed', (type === selectedType).toString());
      const preview = document.createElement('div');
      preview.className = 'alert-preview';
      preview.appendChild(createAlertPreview(type, meta));
      option.appendChild(preview);
      if (type === selectedType) option.classList.add('is-selected');
      option.addEventListener('click', () => {
        selectedType = type;
        options.forEach((item) => {
          const isSelected = item === option;
          item.classList.toggle('is-selected', isSelected);
          item.setAttribute('aria-pressed', isSelected.toString());
        });
      });
      options.push(option);
      grid.appendChild(option);
    });

    function insertAlert() {
      const type = selectedType.toUpperCase();
      const meta = GITHUB_ALERT_META[selectedType] || { label: selectedType };
      const body = `${meta.label} details go here.`;
      const block = `> [!${type}]\n> ${body}\n`;
      modal.style.display = 'none';
      cleanup();
      insertMarkdownBlock(block, start, end);
    }

    function closeModal() {
      modal.style.display = 'none';
      cleanup();
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    }

    function cleanup() {
      confirmBtn.removeEventListener('click', insertAlert);
      cancelBtn.removeEventListener('click', closeModal);
      modal.removeEventListener('keydown', onKey);
    }

    confirmBtn.addEventListener('click', insertAlert);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('keydown', onKey);
  }

  function getCleanCode(templateCode) {
    if (!templateCode) return '';
    let clean = templateCode.trim();
    if (clean.startsWith('```')) {
      const firstNewLine = clean.indexOf('\n');
      if (firstNewLine !== -1) {
        clean = clean.substring(firstNewLine + 1);
      }
    }
    if (clean.endsWith('```')) {
      clean = clean.substring(0, clean.length - 3).trim();
    }
    return clean;
  }

  function normalizePlantUmlSvg(container, sourceCode, constrainHeight = false) {
    const svg = normalizeDiagramSvg(container, 'plantuml', sourceCode);
    if (!svg) return null;
    if (constrainHeight) {
      svg.style.maxHeight = '100%';
    }
    return svg;
  }

  function getDiagramEngineForCategory(category) {
    const engines = {
      PlantUML: 'plantuml',
      D2: 'd2',
      Graphviz: 'graphviz',
      'Vega-Lite': 'vegalite',
      WaveDrom: 'wavedrom',
      Markmap: 'markmap',
      Mermaid: 'mermaid',
      'ABC Notation': 'abc'
    };
    return engines[category] || null;
  }

  function normalizeDiagramPreviewSvg(container, template) {
    const engine = getDiagramEngineForCategory(template.category);
    const svg = normalizeDiagramSvg(container, engine, getCleanCode(template.code));
    if (svg) svg.style.maxHeight = '100%';
    return svg;
  }

  function getDiagramApiUrl(template, theme) {
    if (typeof pako === 'undefined') {
      return null;
    }
    try {
      const cleanCode = getCleanCode(template.code);
      if (template.category === 'Mermaid') {
        const obj = {
          code: cleanCode,
          mermaid: {
            theme: theme === 'dark' ? 'dark' : 'default'
          }
        };
        const json = JSON.stringify(obj);
        const encoded = encodeKrokiD2(json);
        return `https://mermaid.ink/svg/pako:${encoded}`;
      } else if (template.category === 'PlantUML') {
        const encoded = encodePlantUML(cleanCode);
        return `https://www.plantuml.com/plantuml/svg/${encoded}`;
      } else if (template.category === 'D2') {
        const encoded = encodeKrokiD2(cleanCode);
        const themeParam = theme === 'dark' ? '?theme=200' : '';
        return `https://kroki.io/d2/svg/${encoded}${themeParam}`;
      } else {
        let engine = '';
        switch (template.category) {
          case 'Graphviz': engine = 'graphviz'; break;
          case 'Vega-Lite': engine = 'vegalite'; break;
          case 'ABC Notation': engine = 'abc'; break;
          case 'WaveDrom': engine = 'wavedrom'; break;
          case 'Markmap': engine = 'markmap'; break;
          default: engine = template.category.toLowerCase().replace(/\s+/g, '');
        }
        const encoded = encodeKrokiD2(cleanCode);
        return `https://kroki.io/${engine}/svg/${encoded}`;
      }
    } catch (e) {
      console.warn('Failed to encode diagram for URL:', e);
      return null;
    }
  }

  async function compileDiagramLocally(engine, code) {
    if (typeof Neutralino === 'undefined') return null;
    try {
      if (engine === 'd2') {
        const result = await Neutralino.os.execCommand('d2 - -', { stdIn: code });
        if (result && result.exitCode === 0 && result.stdOut) {
          return result.stdOut;
        }
      } else if (engine === 'plantuml') {
        try {
          const result = await Neutralino.os.execCommand('plantuml -pipe -tsvg', { stdIn: code });
          if (result && result.exitCode === 0 && result.stdOut) {
            return result.stdOut;
          }
        } catch (e) {
          const result = await Neutralino.os.execCommand('java -jar plantuml.jar -pipe -tsvg', { stdIn: code });
          if (result && result.exitCode === 0 && result.stdOut) {
            return result.stdOut;
          }
        }
      }
    } catch (e) {
      console.warn(`Local execution for ${engine} failed:`, e);
    }
    return null;
  }

  async function fetchDiagramPreview(apiUrl) {
    if (typeof caches === 'undefined') {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error('Failed to fetch');
      return await response.text();
    }
    const cache = await caches.open('diagram-previews');
    const cachedResponse = await cache.match(apiUrl);
    if (cachedResponse) {
      return await cachedResponse.text();
    }
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error('Failed to fetch');
    await cache.put(apiUrl, response.clone());
    return await response.text();
  }

  async function getOrRenderDiagramPreview(template, theme, callback) {
    const cleanCode = getCleanCode(template.code);
    const engine = getDiagramEngineForCategory(template.category);
    try {
      if (REMOTE_DIAGRAM_ENGINES[engine]) {
        callback(await renderDiagramThroughAdapter(engine, cleanCode));
        return;
      }

      const apiUrl = getDiagramApiUrl(template, theme);
      if (apiUrl) {
        callback(await fetchDiagramPreview(apiUrl));
        return;
      }
      callback(null);
    } catch (e) {
      console.warn('Diagram modal preview failed', {
        engine: engine || template.category,
        status: e.status || null,
        message: e.message
      });
      callback(null);
    }
  }

  async function openDiagramModal() {
    const modal = document.getElementById('diagram-modal');
    const sidebar = modal.querySelector('.diagram-modal-sidebar');
    const grid = document.getElementById('diagram-modal-grid');
    const emptyMessage = document.getElementById('diagram-modal-empty');
    const searchInput = document.getElementById('diagram-modal-search');
    const previewContainer = document.getElementById('diagram-modal-preview');
    const previewCode = document.getElementById('diagram-modal-preview-code');
    const confirmBtn = document.getElementById('diagram-modal-insert');
    const cancelBtn = document.getElementById('diagram-modal-cancel');
    const closeBtn = document.getElementById('diagram-modal-close');
    
    if (!modal || !sidebar || !grid || !emptyMessage || !searchInput || !previewContainer || !previewCode || !confirmBtn || !cancelBtn || !closeBtn) return;
    
    if (typeof pako === 'undefined') {
      try {
        await loadDiagramLibrary(CDN.pako);
      } catch (e) {
        console.warn('Failed to load pako library for diagram previews:', e);
      }
    }
    
    const start = markdownEditor.selectionStart;
    const end = markdownEditor.selectionEnd;
    modal.style.display = 'flex';
    
    // Clear and reset state
    searchInput.value = '';
    sidebar.textContent = '';
    grid.textContent = '';
    previewContainer.textContent = '';
    if (previewCode) previewCode.value = '';
    confirmBtn.disabled = true;
    
    const categories = [
      'Mermaid',
      'PlantUML',
      'Graphviz',
      'D2',
      'Vega-Lite',
      'ABC Notation',
      'WaveDrom',
      'Markmap'
    ];
    
    const svgFlowchart = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="45" y="15" width="70" height="26" fill="#f4f5f7" stroke="#673ab7" stroke-width="1.5" rx="3"/><text x="80" y="31" font-size="9" text-anchor="middle" font-family="sans-serif" fill="#333" font-weight="bold">Start</text><path d="M 80 41 L 80 75" stroke="#333" stroke-width="1.2" marker-end="url(#arrow-f)"/><rect x="45" y="75" width="70" height="26" fill="#f4f5f7" stroke="#673ab7" stroke-width="1.5" rx="3"/><text x="80" y="91" font-size="9" text-anchor="middle" font-family="sans-serif" fill="#333" font-weight="bold">End</text><defs><marker id="arrow-f" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#333"/></marker></defs></svg>`;
    const svgMermaidFlowchartLR = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="10" y="47" width="40" height="26" fill="#e8f5e9" stroke="#2e7d32" stroke-width="1.5" rx="3"/><text x="30" y="63" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#1b5e20" font-weight="bold">Left</text><path d="M 50 60 L 110 60" stroke="#2e7d32" stroke-width="1.2" marker-end="url(#arrow-flr)"/><rect x="110" y="47" width="40" height="26" fill="#e8f5e9" stroke="#2e7d32" stroke-width="1.5" rx="3"/><text x="130" y="63" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#1b5e20" font-weight="bold">Right</text><defs><marker id="arrow-flr" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#2e7d32"/></marker></defs></svg>`;
    const svgSequence = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="15" y="10" width="40" height="20" fill="#f4f5f7" stroke="#009688" stroke-width="1.5" rx="3"/><text x="35" y="22" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#333" font-weight="bold">Alice</text><line x1="35" y1="30" x2="35" y2="90" stroke="#009688" stroke-width="1" stroke-dasharray="3"/><rect x="15" y="90" width="40" height="20" fill="#f4f5f7" stroke="#009688" stroke-width="1.5" rx="3"/><text x="35" y="102" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#333" font-weight="bold">Alice</text><rect x="105" y="10" width="40" height="20" fill="#f4f5f7" stroke="#009688" stroke-width="1.5" rx="3"/><text x="125" y="22" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#333" font-weight="bold">Bob</text><line x1="125" y1="30" x2="125" y2="90" stroke="#009688" stroke-width="1" stroke-dasharray="3"/><rect x="105" y="90" width="40" height="20" fill="#f4f5f7" stroke="#009688" stroke-width="1.5" rx="3"/><text x="125" y="102" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#333" font-weight="bold">Bob</text><path d="M 35 48 L 125 48" stroke="#333" stroke-width="1.2" marker-end="url(#arrow-f)"/><text x="80" y="43" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#333">Hello</text><path d="M 125 72 L 35 72" stroke="#333" stroke-width="1" stroke-dasharray="3" marker-end="url(#arrow-f)"/><text x="80" y="67" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#333">Reply</text></svg>`;
    const svgEr = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="10" y="30" width="50" height="40" fill="#f4f5f7" stroke="#ff9800" stroke-width="1.5" rx="3"/><line x1="10" y1="46" x2="60" y2="46" stroke="#ff9800" stroke-width="1"/><text x="35" y="41" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#333" font-weight="bold">CUSTOMER</text><text x="14" y="56" font-size="7" font-family="sans-serif" fill="#666">id</text><text x="14" y="65" font-size="7" font-family="sans-serif" fill="#666">name</text><rect x="100" y="30" width="50" height="40" fill="#f4f5f7" stroke="#ff9800" stroke-width="1.5" rx="3"/><line x1="100" y1="46" x2="150" y2="46" stroke="#ff9800" stroke-width="1"/><text x="125" y="41" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#333" font-weight="bold">ORDER</text><text x="104" y="56" font-size="7" font-family="sans-serif" fill="#666">id</text><text x="104" y="65" font-size="7" font-family="sans-serif" fill="#666">price</text><path d="M 60 50 L 100 50" stroke="#333" stroke-width="1.5"/></svg>`;
    const svgClass = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="30" y="20" width="100" height="65" fill="#f4f5f7" stroke="#673ab7" stroke-width="1.5" rx="3"/><line x1="30" y1="40" x2="130" y2="40" stroke="#673ab7" stroke-width="1"/><line x1="30" y1="60" x2="130" y2="60" stroke="#673ab7" stroke-width="1"/><text x="80" y="33" font-size="9" text-anchor="middle" font-family="sans-serif" fill="#333" font-weight="bold">Animal</text><text x="36" y="50" font-size="7" font-family="sans-serif" fill="#333">+name: String</text><text x="36" y="57" font-size="7" font-family="sans-serif" fill="#333">+age: int</text><text x="36" y="70" font-size="7" font-family="sans-serif" fill="#333">+makeSound()</text></svg>`;
    const svgState = `<svg viewBox="0 0 160 120" width="100%" height="100%"><circle cx="20" cy="50" r="7" fill="#3f51b5"/><path d="M 27 50 L 60 50" stroke="#3f51b5" stroke-width="1.5" marker-end="url(#arrow-s)"/><rect x="60" y="35" width="50" height="30" rx="6" fill="#f4f5f7" stroke="#3f51b5" stroke-width="1.5"/><text x="85" y="53" font-size="9" text-anchor="middle" font-family="sans-serif" fill="#333" font-weight="bold">Active</text><path d="M 110 50 L 133 50" stroke="#3f51b5" stroke-width="1.5" marker-end="url(#arrow-s)"/><circle cx="140" cy="50" r="7" fill="none" stroke="#3f51b5" stroke-width="1.5"/><circle cx="140" cy="50" r="4" fill="#3f51b5"/><defs><marker id="arrow-s" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#3f51b5"/></marker></defs></svg>`;
    const svgGantt = `<svg viewBox="0 0 160 120" width="100%" height="100%"><line x1="20" y1="20" x2="20" y2="100" stroke="#e0e0e0" stroke-width="1"/><line x1="60" y1="20" x2="60" y2="100" stroke="#e0e0e0" stroke-width="1"/><line x1="100" y1="20" x2="100" y2="100" stroke="#e0e0e0" stroke-width="1"/><line x1="140" y1="20" x2="140" y2="100" stroke="#e0e0e0" stroke-width="1"/><rect x="25" y="30" width="55" height="15" rx="3" fill="#e0f2f1" stroke="#009688" stroke-width="1.2"/><text x="30" y="40" font-size="7" font-family="sans-serif" fill="#004d40" font-weight="bold">Design</text><rect x="80" y="60" width="55" height="15" rx="3" fill="#e0f2f1" stroke="#009688" stroke-width="1.2"/><text x="85" y="70" font-size="7" font-family="sans-serif" fill="#004d40" font-weight="bold">Code</text></svg>`;
    const svgPie = `<svg viewBox="0 0 160 120" width="100%" height="100%"><circle cx="80" cy="55" r="35" fill="#f44336" stroke="#fff" stroke-width="1.5"/><path d="M 80 55 L 80 20 A 35 35 0 0 1 115 55 Z" fill="#4caf50" stroke="#fff" stroke-width="1"/><path d="M 80 55 L 115 55 A 35 35 0 0 1 80 90 Z" fill="#ffeb3b" stroke="#fff" stroke-width="1"/></svg>`;
    const svgGitGraph = `<svg viewBox="0 0 160 120" width="100%" height="100%"><line x1="10" y1="40" x2="150" y2="40" stroke="#9c27b0" stroke-width="2"/><line x1="40" y1="40" x2="80" y2="80" stroke="#00bcd4" stroke-width="2"/><line x1="80" y1="80" x2="150" y2="80" stroke="#00bcd4" stroke-width="2"/><circle cx="30" cy="40" r="5" fill="#9c27b0" stroke="#fff" stroke-width="1"/><circle cx="70" cy="40" r="5" fill="#9c27b0" stroke="#fff" stroke-width="1"/><circle cx="80" cy="80" r="5" fill="#00bcd4" stroke="#fff" stroke-width="1"/><circle cx="120" cy="80" r="5" fill="#00bcd4" stroke="#fff" stroke-width="1"/><circle cx="130" cy="40" r="5" fill="#9c27b0" stroke="#fff" stroke-width="1"/></svg>`;
    const svgJourney = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="10" y="20" width="65" height="80" fill="#fff9c4" stroke="#fbc02d" stroke-width="1.5" rx="3"/><text x="42" y="35" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#f57f17" font-weight="bold">Stage 1</text><rect x="15" y="45" width="55" height="15" fill="#fff" rx="2"/><text x="20" y="55" font-size="6" font-family="sans-serif">Task A ⭐⭐⭐</text><rect x="85" y="20" width="65" height="80" fill="#fff9c4" stroke="#fbc02d" stroke-width="1.5" rx="3"/><text x="117" y="35" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#f57f17" font-weight="bold">Stage 2</text><rect x="90" y="45" width="55" height="15" fill="#fff" rx="2"/><text x="95" y="55" font-size="6" font-family="sans-serif">Task B ⭐⭐⭐⭐</text></svg>`;
    const svgMermaidMindmap = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="55" y="48" width="50" height="24" rx="12" fill="#ede7f6" stroke="#5e35b1" stroke-width="1.5"/><text x="80" y="63" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#5e35b1" font-weight="bold">Goal</text><path d="M 55 60 C 35 60, 30 35, 15 35" fill="none" stroke="#e91e63" stroke-width="1.5"/><path d="M 55 60 C 35 60, 30 85, 15 85" fill="none" stroke="#00bcd4" stroke-width="1.5"/><path d="M 105 60 C 125 60, 130 35, 145 35" fill="none" stroke="#4caf50" stroke-width="1.5"/><path d="M 105 60 C 125 60, 130 85, 145 85" fill="none" stroke="#ff9800" stroke-width="1.5"/><circle cx="15" cy="35" r="3.5" fill="#e91e63"/><circle cx="15" cy="85" r="3.5" fill="#00bcd4"/><circle cx="145" cy="35" r="3.5" fill="#4caf50"/><circle cx="145" cy="85" r="3.5" fill="#ff9800"/></svg>`;
    const svgMermaidQuadrant = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="15" y="15" width="60" height="40" fill="#ffe0b2" opacity="0.6"/><rect x="85" y="15" width="60" height="40" fill="#c8e6c9" opacity="0.6"/><rect x="15" y="65" width="60" height="40" fill="#ffcdd2" opacity="0.6"/><rect x="85" y="65" width="60" height="40" fill="#b3e5fc" opacity="0.6"/><line x1="80" y1="10" x2="80" y2="110" stroke="#333" stroke-width="1.5"/><line x1="10" y1="60" x2="150" y2="60" stroke="#333" stroke-width="1.5"/><circle cx="50" cy="35" r="3.5" fill="#e65100"/><circle cx="110" cy="85" r="3.5" fill="#01579b"/></svg>`;
    const svgMermaidXy = `<svg viewBox="0 0 160 120" width="100%" height="100%"><line x1="20" y1="15" x2="20" y2="105" stroke="#333" stroke-width="1.5"/><line x1="20" y1="105" x2="150" y2="105" stroke="#333" stroke-width="1.5"/><path d="M 30 90 L 60 70 L 90 40 L 120 50 L 140 20" fill="none" stroke="#2196f3" stroke-width="2"/><rect x="35" y="70" width="12" height="35" fill="#4caf50" opacity="0.7"/><rect x="65" y="55" width="12" height="50" fill="#4caf50" opacity="0.7"/><rect x="95" y="45" width="12" height="60" fill="#4caf50" opacity="0.7"/><rect x="125" y="65" width="12" height="40" fill="#4caf50" opacity="0.7"/></svg>`;
    const svgMermaidRequirement = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="15" y="15" width="55" height="35" fill="#eceff1" stroke="#37474f" stroke-width="1.5" rx="2"/><text x="42" y="27" font-size="6" text-anchor="middle" font-family="sans-serif" font-weight="bold">«requirement»</text><text x="42" y="36" font-size="7" text-anchor="middle" font-family="sans-serif">Req 1</text><rect x="90" y="15" width="55" height="35" fill="#eceff1" stroke="#37474f" stroke-width="1.5" rx="2"/><text x="117" y="27" font-size="6" text-anchor="middle" font-family="sans-serif" font-weight="bold">«element»</text><text x="117" y="36" font-size="7" text-anchor="middle" font-family="sans-serif">Test Case</text><path d="M 70 32 L 90 32" stroke="#37474f" stroke-width="1" stroke-dasharray="3" marker-end="url(#arrow-req)"/><defs><marker id="arrow-req" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#37474f"/></marker></defs></svg>`;
    const svgMermaidC4 = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="10" y="10" width="140" height="100" fill="none" stroke="#0288d1" stroke-width="1.5" stroke-dasharray="4" rx="4"/><text x="80" y="22" font-size="7" text-anchor="middle" font-family="sans-serif" fill="#0288d1" font-weight="bold">System Boundary</text><rect x="25" y="40" width="45" height="40" fill="#1565c0" stroke="#0d47a1" stroke-width="1" rx="3"/><text x="47" y="55" font-size="7" text-anchor="middle" fill="#fff" font-weight="bold">Web App</text><text x="47" y="65" font-size="5" text-anchor="middle" fill="#bbdefb">Container: JS</text><rect x="90" y="40" width="45" height="40" fill="#1565c0" stroke="#0d47a1" stroke-width="1" rx="3"/><text x="112" y="55" font-size="7" text-anchor="middle" fill="#fff" font-weight="bold">API App</text><text x="112" y="65" font-size="5" text-anchor="middle" fill="#bbdefb">Container: Go</text><path d="M 70 60 L 90 60" stroke="#333" stroke-width="1" marker-end="url(#arrow-c4)"/><defs><marker id="arrow-c4" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#333"/></marker></defs></svg>`;
    const svgMermaidSankey = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="15" y="15" width="15" height="40" fill="#29b6f6" rx="1"/><rect x="15" y="65" width="15" height="40" fill="#ab47bc" rx="1"/><rect x="130" y="25" width="15" height="70" fill="#26a69a" rx="1"/><path d="M 30 25 C 60 25, 80 40, 130 40" fill="none" stroke="#29b6f6" stroke-width="12" opacity="0.4"/><path d="M 30 75 C 60 75, 80 65, 130 65" fill="none" stroke="#ab47bc" stroke-width="16" opacity="0.4"/></svg>`;
    const svgMermaidTimeline = `<svg viewBox="0 0 160 120" width="100%" height="100%"><line x1="15" y1="60" x2="145" y2="60" stroke="#009688" stroke-width="3"/><rect x="25" y="20" width="30" height="24" fill="#e0f2f1" stroke="#009688" stroke-width="1" rx="2"/><text x="40" y="35" font-size="7" text-anchor="middle" font-family="sans-serif">2024</text><line x1="40" y1="44" x2="40" y2="60" stroke="#009688" stroke-width="1"/><rect x="105" y="75" width="30" height="24" fill="#e0f2f1" stroke="#009688" stroke-width="1" rx="2"/><text x="120" y="90" font-size="7" text-anchor="middle" font-family="sans-serif">2026</text><line x1="120" y1="60" x2="120" y2="75" stroke="#009688" stroke-width="1"/></svg>`;
    
    // PlantUML distinct styling (Yellowish actor/notes backgrounds, red outlines, retro styling)
    const svgPlantUmlSequence = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="15" y="10" width="40" height="20" fill="#fff9c4" stroke="#b71c1c" stroke-width="1.5" rx="2"/><text x="35" y="22" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#000" font-weight="bold">User</text><line x1="35" y1="30" x2="35" y2="90" stroke="#b71c1c" stroke-width="1.2"/><rect x="105" y="10" width="40" height="20" fill="#fff9c4" stroke="#b71c1c" stroke-width="1.5" rx="2"/><text x="125" y="22" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#000" font-weight="bold">Server</text><line x1="125" y1="30" x2="125" y2="90" stroke="#b71c1c" stroke-width="1.2"/><path d="M 35 50 L 125 50" stroke="#000" stroke-width="1.2" marker-end="url(#arrow-red)"/><path d="M 125 75 L 35 75" stroke="#000" stroke-width="1" stroke-dasharray="4" marker-end="url(#arrow-red)"/><defs><marker id="arrow-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#b71c1c"/></marker></defs></svg>`;
    const svgPlantUmlUseCase = `<svg viewBox="0 0 160 120" width="100%" height="100%"><circle cx="30" cy="40" r="6" fill="#fff" stroke="#0d47a1" stroke-width="1.5"/><line x1="30" y1="46" x2="30" y2="66" stroke="#0d47a1" stroke-width="1.5"/><line x1="20" y1="52" x2="40" y2="52" stroke="#0d47a1" stroke-width="1.5"/><line x1="30" y1="66" x2="20" y2="82" stroke="#0d47a1" stroke-width="1.5"/><line x1="30" y1="66" x2="40" y2="82" stroke="#0d47a1" stroke-width="1.5"/><ellipse cx="110" cy="50" rx="35" ry="18" fill="#e3f2fd" stroke="#0d47a1" stroke-width="1.5"/><text x="110" y="53" font-size="7" text-anchor="middle" font-family="sans-serif" fill="#0d47a1" font-weight="bold">Checkout</text><line x1="45" y1="52" x2="75" y2="50" stroke="#0d47a1" stroke-width="1.2" marker-end="url(#arrow-blue)"/><defs><marker id="arrow-blue" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#0d47a1"/></marker></defs></svg>`;
    const svgPlantUmlActivity = `<svg viewBox="0 0 160 120" width="100%" height="100%"><circle cx="80" cy="15" r="7" fill="#000"/><path d="M 80 22 L 80 40" stroke="#000" stroke-width="1.2" marker-end="url(#arrow-p)"/><rect x="40" y="40" width="80" height="25" rx="12" fill="#fff9c4" stroke="#f57f17" stroke-width="1.5"/><text x="80" y="55" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#000">Initialization</text><path d="M 80 65 L 80 85" stroke="#000" stroke-width="1.2" marker-end="url(#arrow-p)"/><circle cx="80" cy="95" r="10" fill="none" stroke="#000" stroke-width="1.5"/><circle cx="80" cy="95" r="6" fill="#000"/><defs><marker id="arrow-p" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#000"/></marker></defs></svg>`;
    const svgPlantUmlClass = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="25" y="15" width="110" height="85" fill="#fff9c4" stroke="#a20000" stroke-width="1.5" rx="2"/><line x1="25" y1="40" x2="135" y2="40" stroke="#a20000" stroke-width="1"/><line x1="25" y1="65" x2="135" y2="65" stroke="#a20000" stroke-width="1"/><circle cx="38" cy="27" r="7" fill="#b3e5fc" stroke="#01579b" stroke-width="1"/><text x="38" y="31" font-size="9" text-anchor="middle" font-family="monospace" fill="#01579b" font-weight="bold">C</text><text x="50" y="31" font-size="9" font-family="sans-serif" fill="#000" font-weight="bold">UserClass</text><text x="32" y="52" font-size="7" font-family="monospace" fill="#000">- id: Long</text><text x="32" y="60" font-size="7" font-family="monospace" fill="#000">- email: String</text><text x="32" y="78" font-size="7" font-family="monospace" fill="#000">+ login(): Boolean</text><text x="32" y="87" font-size="7" font-family="monospace" fill="#000">+ getRoles(): List</text></svg>`;
    const svgPlantUmlState = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="15" y="40" width="50" height="30" rx="8" fill="#fff9c4" stroke="#b71c1c" stroke-width="1.5"/><text x="40" y="58" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#000" font-weight="bold">StateA</text><path d="M 65 55 L 95 55" stroke="#b71c1c" stroke-width="1.2" marker-end="url(#arrow-puml-st)"/><rect x="95" y="40" width="50" height="30" rx="8" fill="#fff9c4" stroke="#b71c1c" stroke-width="1.5"/><text x="120" y="58" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#000" font-weight="bold">StateB</text><defs><marker id="arrow-puml-st" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#b71c1c"/></marker></defs></svg>`;
    const svgPlantUmlComponent = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="15" y="15" width="130" height="90" fill="#f5f5f5" stroke="#333" stroke-width="1.5" rx="3"/><text x="80" y="28" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#333" font-weight="bold">[System Node]</text><rect x="35" y="45" width="90" height="45" fill="#fff9c4" stroke="#b71c1c" stroke-width="1.5" rx="2"/><rect x="27" y="52" width="16" height="8" fill="#fff9c4" stroke="#b71c1c" stroke-width="1.5"/><rect x="27" y="70" width="16" height="8" fill="#fff9c4" stroke="#b71c1c" stroke-width="1.5"/><text x="80" y="72" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#000" font-weight="bold">Web GUI</text></svg>`;
    const svgPlantUmlObject = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="25" y="20" width="110" height="75" fill="#fff9c4" stroke="#a20000" stroke-width="1.5" rx="2"/><line x1="25" y1="42" x2="135" y2="42" stroke="#a20000" stroke-width="1"/><text x="80" y="34" font-size="9" text-anchor="middle" font-family="sans-serif" fill="#000" font-weight="bold"><u>myUser : User</u></text><text x="32" y="58" font-size="8" font-family="monospace" fill="#000">name = "Alice"</text><text x="32" y="72" font-size="8" font-family="monospace" fill="#000">role = "Admin"</text></svg>`;
    const svgPlantUmlDeployment = `<svg viewBox="0 0 160 120" width="100%" height="100%"><path d="M 25 35 L 65 35 L 80 20 L 40 20 Z" fill="#fff9c4" stroke="#a20000" stroke-width="1.2"/><path d="M 65 35 L 80 20 L 80 75 L 65 90 Z" fill="#fff9c4" stroke="#a20000" stroke-width="1.2"/><rect x="25" y="35" width="40" height="55" fill="#fff9c4" stroke="#a20000" stroke-width="1.2"/><text x="45" y="65" font-size="8" text-anchor="middle" font-family="sans-serif" font-weight="bold">Node</text></svg>`;
    const svgPlantUmlTiming = `<svg viewBox="0 0 160 120" width="100%" height="100%"><text x="15" y="35" font-size="8" font-family="monospace">WebState</text><path d="M 60 35 L 90 35 L 90 55 L 120 55 L 120 35 L 150 35" fill="none" stroke="#b71c1c" stroke-width="1.5"/><line x1="60" y1="20" x2="60" y2="70" stroke="#ccc" stroke-dasharray="2"/><line x1="90" y1="20" x2="90" y2="70" stroke="#ccc" stroke-dasharray="2"/><line x1="120" y1="20" x2="120" y2="70" stroke="#ccc" stroke-dasharray="2"/></svg>`;
    const svgPlantUmlNetwork = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="20" y="25" width="40" height="24" rx="2" fill="#fff9c4" stroke="#b71c1c" stroke-width="1.2"/><text x="40" y="39" font-size="7" text-anchor="middle" font-family="sans-serif">Server</text><rect x="100" y="25" width="40" height="24" rx="2" fill="#fff9c4" stroke="#b71c1c" stroke-width="1.2"/><text x="120" y="39" font-size="7" text-anchor="middle" font-family="sans-serif">Database</text><line x1="40" y1="80" x2="120" y2="80" stroke="#333" stroke-width="2"/><line x1="40" y1="49" x2="40" y2="80" stroke="#b71c1c" stroke-width="1.2"/><line x1="120" y1="49" x2="120" y2="80" stroke="#b71c1c" stroke-width="1.2"/><text x="80" y="93" font-size="7" text-anchor="middle" font-family="monospace">192.168.1.0</text></svg>`;
    const svgPlantUmlMindmap = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="60" y="48" width="40" height="24" fill="#fff9c4" stroke="#b71c1c" stroke-width="1.5" rx="3"/><text x="80" y="63" font-size="8" text-anchor="middle" font-family="sans-serif" font-weight="bold">Idea</text><path d="M 60 60 L 25 40" stroke="#b71c1c" stroke-width="1.2"/><path d="M 60 60 L 25 80" stroke="#b71c1c" stroke-width="1.2"/><rect x="5" y="28" width="20" height="15" fill="#fff9c4" stroke="#b71c1c" stroke-width="1.2"/><rect x="5" y="70" width="20" height="15" fill="#fff9c4" stroke="#b71c1c" stroke-width="1.2"/></svg>`;
    const svgPlantUmlWbs = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="50" y="15" width="60" height="22" fill="#fff9c4" stroke="#b71c1c" stroke-width="1.2" rx="2"/><text x="80" y="28" font-size="8" text-anchor="middle" font-family="sans-serif">Project</text><line x1="80" y1="37" x2="80" y2="70" stroke="#b71c1c" stroke-width="1.2"/><line x1="80" y1="70" x2="40" y2="70" stroke="#b71c1c" stroke-width="1.2"/><line x1="80" y1="90" x2="120" y2="90" stroke="#b71c1c" stroke-width="1.2"/><line x1="80" y1="70" x2="80" y2="90" stroke="#b71c1c" stroke-width="1.2"/><rect x="10" y="60" width="30" height="18" fill="#fff9c4" stroke="#b71c1c" stroke-width="1.2"/><rect x="120" y="81" width="30" height="18" fill="#fff9c4" stroke="#b71c1c" stroke-width="1.2"/></svg>`;
    const svgPlantUmlJson = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="20" y="20" width="120" height="80" fill="#fff9c4" stroke="#b71c1c" stroke-width="1.5" rx="3"/><text x="30" y="38" font-size="8" font-family="monospace" fill="#000">"name": "Widget"</text><text x="30" y="55" font-size="8" font-family="monospace" fill="#000">"count": 42</text><text x="30" y="72" font-size="8" font-family="monospace" fill="#000">"active": true</text></svg>`;

    // Graphviz (Aesthetic: beige/brown, thin strokes, distinct classic nodes)
    const svgGraphvizDigraph = `<svg viewBox="0 0 160 120" width="100%" height="100%"><circle cx="35" cy="35" r="12" fill="#efebe9" stroke="#795548" stroke-width="2"/><text x="35" y="39" font-size="10" text-anchor="middle" font-family="sans-serif" fill="#3e2723" font-weight="bold">A</text><circle cx="125" cy="35" r="12" fill="#efebe9" stroke="#795548" stroke-width="2"/><text x="125" y="39" font-size="10" text-anchor="middle" font-family="sans-serif" fill="#3e2723" font-weight="bold">B</text><path d="M 47 35 L 113 35" stroke="#795548" stroke-width="1.5" marker-end="url(#arrow-br)"/><defs><marker id="arrow-br" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#795548"/></marker></defs></svg>`;
    const svgGraphvizTree = `<svg viewBox="0 0 160 120" width="100%" height="100%"><circle cx="80" cy="25" r="10" fill="#e0f2f1" stroke="#004d40" stroke-width="1.5"/><text x="80" y="28" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#004d40" font-weight="bold">Root</text><line x1="80" y1="35" x2="45" y2="70" stroke="#004d40" stroke-width="1.2"/><line x1="80" y1="35" x2="115" y2="70" stroke="#004d40" stroke-width="1.2"/><circle cx="45" cy="80" r="10" fill="#e0f2f1" stroke="#004d40" stroke-width="1.5"/><text x="45" y="83" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#004d40" font-weight="bold">L</text><circle cx="115" cy="80" r="10" fill="#e0f2f1" stroke="#004d40" stroke-width="1.5"/><text x="115" y="83" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#004d40" font-weight="bold">R</text></svg>`;
    const svgGraphvizStruct = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="20" y="35" width="120" height="40" fill="#f5f5f5" stroke="#212121" stroke-width="1.5"/><line x1="60" y1="35" x2="60" y2="75" stroke="#212121" stroke-width="1.5"/><line x1="100" y1="35" x2="100" y2="75" stroke="#212121" stroke-width="1.5"/><text x="40" y="58" font-size="8" text-anchor="middle" font-family="monospace" fill="#000">node0</text><text x="80" y="58" font-size="8" text-anchor="middle" font-family="monospace" fill="#000">node1</text><text x="120" y="58" font-size="8" text-anchor="middle" font-family="monospace" fill="#000">node2</text></svg>`;
    const svgGraphvizFsm = `<svg viewBox="0 0 160 120" width="100%" height="100%"><circle cx="35" cy="55" r="14" fill="#fafafa" stroke="#333" stroke-width="1.5"/><text x="35" y="59" font-size="9" text-anchor="middle" font-family="sans-serif" fill="#333">S1</text><path d="M 49 55 L 105 55" stroke="#333" stroke-width="1.2" marker-end="url(#arrow-g-fsm)"/><circle cx="120" cy="55" r="14" fill="#fafafa" stroke="#333" stroke-width="1.5"/><circle cx="120" cy="55" r="10" fill="none" stroke="#333" stroke-width="1.2"/><text x="120" y="59" font-size="9" text-anchor="middle" font-family="sans-serif" fill="#333">S2</text><defs><marker id="arrow-g-fsm" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#333"/></marker></defs></svg>`;
    const svgGraphvizNetwork = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="15" y="45" width="35" height="25" rx="3" fill="#efebe9" stroke="#5d4037" stroke-width="1.5"/><text x="32" y="60" font-size="8" text-anchor="middle" fill="#5d4037" font-weight="bold">Router</text><ellipse cx="125" cy="57" rx="20" ry="15" fill="#e8f5e9" stroke="#2e7d32" stroke-width="1.5"/><text x="125" y="60" font-size="8" text-anchor="middle" fill="#2e7d32" font-weight="bold">LAN</text><line x1="50" y1="57" x2="105" y2="57" stroke="#333" stroke-width="1.2"/></svg>`;
    const svgGraphvizSubgraph = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="15" y="15" width="85" height="90" fill="#f5f5f5" stroke="#4e342e" stroke-width="1.5" stroke-dasharray="3" rx="4"/><text x="57" y="27" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#4e342e" font-weight="bold">cluster_0</text><circle cx="57" cy="50" r="10" fill="#efebe9" stroke="#795548" stroke-width="1.5"/><circle cx="57" cy="85" r="10" fill="#efebe9" stroke="#795548" stroke-width="1.5"/><circle cx="130" cy="65" r="10" fill="#efebe9" stroke="#795548" stroke-width="1.5"/><path d="M 67 50 L 120 65" stroke="#795548" stroke-width="1.2" marker-end="url(#arrow-g-sub)"/><defs><marker id="arrow-g-sub" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#795548"/></marker></defs></svg>`;
    const svgGraphvizEr = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="10" y="47" width="40" height="26" fill="#efebe9" stroke="#795548" stroke-width="1.5"/><text x="30" y="63" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#000" font-weight="bold">Entity</text><polygon points="90,47 110,60 90,73 70,60" fill="#efebe9" stroke="#795548" stroke-width="1.5"/><text x="90" y="63" font-size="7" text-anchor="middle" font-family="sans-serif" fill="#000">Rel</text><line x1="50" y1="60" x2="70" y2="60" stroke="#333" stroke-width="1.2"/></svg>`;

    // D2 (Aesthetic: monospace font, bold slate outlines, soft purple/blue/green boxes)
    const svgD2Flow = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="15" y="45" width="40" height="30" fill="#eceff1" stroke="#333" stroke-width="2"/><text x="35" y="63" font-size="9" text-anchor="middle" font-family="monospace" fill="#333">x</text><path d="M 55 60 L 105 60" stroke="#333" stroke-width="2" marker-end="url(#arrow-d2)"/><rect x="105" y="45" width="40" height="30" fill="#eceff1" stroke="#333" stroke-width="2"/><text x="125" y="63" font-size="9" text-anchor="middle" font-family="monospace" fill="#333">y</text><defs><marker id="arrow-d2" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#333"/></marker></defs></svg>`;
    const svgD2Arch = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="10" y="15" width="140" height="90" fill="#f5f5f5" stroke="#3f51b5" stroke-width="1.5" stroke-dasharray="3" rx="4"/><text x="80" y="27" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#3f51b5" font-weight="bold">Cloud Platform</text><rect x="25" y="45" width="45" height="40" fill="#e8eaf6" stroke="#3f51b5" stroke-width="1.5" rx="3"/><text x="47" y="68" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#3f51b5">App</text><rect x="90" y="45" width="45" height="40" fill="#e8eaf6" stroke="#3f51b5" stroke-width="1.5" rx="3"/><text x="112" y="68" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#3f51b5">DB</text></svg>`;
    const svgD2Sequence = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="15" y="15" width="40" height="24" fill="#ede7f6" stroke="#5e35b1" stroke-width="2"/><text x="35" y="30" font-size="8" text-anchor="middle" font-family="monospace" fill="#333" font-weight="bold">client</text><line x1="35" y1="39" x2="35" y2="105" stroke="#5e35b1" stroke-width="1.5"/><rect x="105" y="15" width="40" height="24" fill="#ede7f6" stroke="#5e35b1" stroke-width="2"/><text x="125" y="30" font-size="8" text-anchor="middle" font-family="monospace" fill="#333" font-weight="bold">server</text><line x1="125" y1="39" x2="125" y2="105" stroke="#5e35b1" stroke-width="1.5"/><path d="M 35 60 L 125 60" stroke="#333" stroke-width="1.8" marker-end="url(#arrow-d2)"/><path d="M 125 85 L 35 85" stroke="#333" stroke-width="1.5" stroke-dasharray="3" marker-end="url(#arrow-d2)"/></svg>`;
    const svgD2Erd = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="15" y="25" width="50" height="50" fill="#f1f8e9" stroke="#558b2f" stroke-width="2" rx="2"/><rect x="15" y="25" width="50" height="15" fill="#c5e1a5" stroke="#558b2f" stroke-width="2" rx="2"/><text x="40" y="36" font-size="7" text-anchor="middle" font-family="monospace" fill="#33691e" font-weight="bold">users</text><text x="20" y="52" font-size="6" font-family="monospace" fill="#333">id (PK)</text><text x="20" y="65" font-size="6" font-family="monospace" fill="#333">name</text><rect x="95" y="25" width="50" height="50" fill="#f1f8e9" stroke="#558b2f" stroke-width="2" rx="2"/><rect x="95" y="25" width="50" height="15" fill="#c5e1a5" stroke="#558b2f" stroke-width="2" rx="2"/><text x="120" y="36" font-size="7" text-anchor="middle" font-family="monospace" fill="#33691e" font-weight="bold">posts</text><text x="100" y="52" font-size="6" font-family="monospace" fill="#333">id (PK)</text><text x="100" y="65" font-size="6" font-family="monospace" fill="#333">user_id</text><path d="M 65 50 L 95 50" stroke="#333" stroke-width="1.5"/></svg>`;
    const svgD2Grid = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="15" y="15" width="60" height="40" fill="#e0f7fa" stroke="#00838f" stroke-width="2" rx="2"/><text x="45" y="38" font-size="8" text-anchor="middle" font-family="monospace" fill="#006064" font-weight="bold">Box 1</text><rect x="85" y="15" width="60" height="40" fill="#e0f7fa" stroke="#00838f" stroke-width="2" rx="2"/><text x="115" y="38" font-size="8" text-anchor="middle" font-family="monospace" fill="#006064" font-weight="bold">Box 2</text><rect x="15" y="65" width="130" height="40" fill="#fce4ec" stroke="#c2185b" stroke-width="2" rx="2"/><text x="80" y="88" font-size="8" text-anchor="middle" font-family="monospace" fill="#880e4f" font-weight="bold">Main Footer Box</text></svg>`;

    // Vega-Lite (Aesthetic: statistical charts)
    const svgVegaBar = `<svg viewBox="0 0 160 120" width="100%" height="100%"><line x1="25" y1="20" x2="25" y2="90" stroke="#333" stroke-width="1.5"/><line x1="25" y1="90" x2="145" y2="90" stroke="#333" stroke-width="1.5"/><rect x="35" y="55" width="22" height="35" fill="#2196f3"/><rect x="70" y="35" width="22" height="55" fill="#2196f3"/><rect x="105" y="45" width="22" height="45" fill="#2196f3"/></svg>`;
    const svgVegaLine = `<svg viewBox="0 0 160 120" width="100%" height="100%"><line x1="25" y1="20" x2="25" y2="90" stroke="#333" stroke-width="1.5"/><line x1="25" y1="90" x2="145" y2="90" stroke="#333" stroke-width="1.5"/><path d="M 35 65 L 70 35 L 105 60 L 135 25" fill="none" stroke="#e91e63" stroke-width="2"/><circle cx="35" cy="65" r="2.5" fill="#e91e63"/><circle cx="70" cy="35" r="2.5" fill="#e91e63"/><circle cx="105" cy="60" r="2.5" fill="#e91e63"/><circle cx="135" cy="25" r="2.5" fill="#e91e63"/></svg>`;
    const svgVegaScatter = `<svg viewBox="0 0 160 120" width="100%" height="100%"><line x1="25" y1="20" x2="25" y2="90" stroke="#333" stroke-width="1.5"/><line x1="25" y1="90" x2="145" y2="90" stroke="#333" stroke-width="1.5"/><circle cx="45" cy="65" r="4.5" fill="#4caf50"/><circle cx="65" cy="45" r="4.5" fill="#4caf50"/><circle cx="95" cy="75" r="4.5" fill="#4caf50"/><circle cx="115" cy="30" r="4.5" fill="#4caf50"/><circle cx="130" cy="55" r="4.5" fill="#4caf50"/></svg>`;
    const svgVegaArea = `<svg viewBox="0 0 160 120" width="100%" height="100%"><line x1="25" y1="20" x2="25" y2="90" stroke="#333" stroke-width="1.5"/><line x1="25" y1="90" x2="145" y2="90" stroke="#333" stroke-width="1.5"/><path d="M 35 75 L 65 40 L 95 65 L 135 30 L 135 90 L 35 90 Z" fill="#9575cd" opacity="0.6" stroke="#5e35b1" stroke-width="1.5"/></svg>`;
    const svgVegaStackedBar = `<svg viewBox="0 0 160 120" width="100%" height="100%"><line x1="25" y1="20" x2="25" y2="90" stroke="#333" stroke-width="1.5"/><line x1="25" y1="90" x2="145" y2="90" stroke="#333" stroke-width="1.5"/><rect x="40" y="60" width="20" height="30" fill="#2196f3"/><rect x="40" y="40" width="20" height="20" fill="#ff9800"/><rect x="80" y="50" width="20" height="40" fill="#2196f3"/><rect x="80" y="20" width="20" height="30" fill="#ff9800"/><rect x="120" y="70" width="20" height="20" fill="#2196f3"/><rect x="120" y="55" width="20" height="15" fill="#ff9800"/></svg>`;

    // ABC Notation (Aesthetic: musical notation stave and notes)
    const svgAbcMelody = `<svg viewBox="0 0 160 120" width="100%" height="100%"><line x1="10" y1="30" x2="150" y2="30" stroke="#000" stroke-width="1"/><line x1="10" y1="40" x2="150" y2="40" stroke="#000" stroke-width="1"/><line x1="10" y1="50" x2="150" y2="50" stroke="#000" stroke-width="1"/><line x1="10" y1="60" x2="150" y2="60" stroke="#000" stroke-width="1"/><line x1="10" y1="70" x2="150" y2="70" stroke="#000" stroke-width="1"/><path d="M 30 25 L 30 65 A 8 8 0 1 1 20 58" fill="#000" stroke="#000" stroke-width="1"/><path d="M 70 35 L 70 75 A 8 8 0 1 1 60 68" fill="#000" stroke="#000" stroke-width="1"/><path d="M 110 30 L 110 70 A 8 8 0 1 1 100 63" fill="#000" stroke="#000" stroke-width="1"/></svg>`;
    const svgAbcDuet = `<svg viewBox="0 0 160 120" width="100%" height="100%"><line x1="10" y1="15" x2="150" y2="15" stroke="#000" stroke-width="1"/><line x1="10" y1="25" x2="150" y2="25" stroke="#000" stroke-width="1"/><line x1="10" y1="35" x2="150" y2="35" stroke="#000" stroke-width="1"/><line x1="10" y1="45" x2="150" y2="45" stroke="#000" stroke-width="1"/><line x1="10" y1="55" x2="150" y2="55" stroke="#000" stroke-width="1"/><path d="M 30 10 L 30 50 A 8 8 0 1 1 20 43" fill="#000"/><line x1="10" y1="70" x2="150" y2="70" stroke="#000" stroke-width="1"/><line x1="10" y1="80" x2="150" y2="80" stroke="#000" stroke-width="1"/><line x1="10" y1="90" x2="150" y2="90" stroke="#000" stroke-width="1"/><line x1="10" y1="100" x2="150" y2="100" stroke="#000" stroke-width="1"/><line x1="10" y1="110" x2="150" y2="110" stroke="#000" stroke-width="1"/><path d="M 60 65 L 60 105 A 8 8 0 1 1 50 98" fill="#000"/></svg>`;
    const svgAbcLyric = `<svg viewBox="0 0 160 120" width="100%" height="100%"><line x1="10" y1="30" x2="150" y2="30" stroke="#000" stroke-width="1"/><line x1="10" y1="40" x2="150" y2="40" stroke="#000" stroke-width="1"/><line x1="10" y1="50" x2="150" y2="50" stroke="#000" stroke-width="1"/><line x1="10" y1="60" x2="150" y2="60" stroke="#000" stroke-width="1"/><line x1="10" y1="70" x2="150" y2="70" stroke="#000" stroke-width="1"/><path d="M 30 25 L 30 65 A 8 8 0 1 1 20 58" fill="#000"/><path d="M 70 35 L 70 75 A 8 8 0 1 1 60 68" fill="#000"/><path d="M 110 30 L 110 70 A 8 8 0 1 1 100 63" fill="#000"/><text x="20" y="90" font-size="8" font-family="sans-serif">Do</text><text x="60" y="90" font-size="8" font-family="sans-serif">Re</text><text x="100" y="90" font-size="8" font-family="sans-serif">Mi</text></svg>`;
    const svgAbcChords = `<svg viewBox="0 0 160 120" width="100%" height="100%"><text x="20" y="20" font-size="8" font-family="sans-serif" font-weight="bold" fill="blue">C</text><text x="80" y="20" font-size="8" font-family="sans-serif" font-weight="bold" fill="blue">G7</text><line x1="10" y1="35" x2="150" y2="35" stroke="#000" stroke-width="1"/><line x1="10" y1="45" x2="150" y2="45" stroke="#000" stroke-width="1"/><line x1="10" y1="55" x2="150" y2="55" stroke="#000" stroke-width="1"/><line x1="10" y1="65" x2="150" y2="65" stroke="#000" stroke-width="1"/><line x1="10" y1="75" x2="150" y2="75" stroke="#000" stroke-width="1"/><path d="M 30 30 L 30 70 A 8 8 0 1 1 20 63" fill="#000"/><path d="M 90 40 L 90 80 A 8 8 0 1 1 80 73" fill="#000"/></svg>`;

    // WaveDrom (Aesthetic: digital waveform timing lines)
    const svgWaveTiming = `<svg viewBox="0 0 160 120" width="100%" height="100%"><path d="M 20 60 L 40 60 L 40 40 L 60 40 L 60 60 L 80 60 L 80 40 L 100 40 L 100 60 L 140 60" fill="none" stroke="#ff5722" stroke-width="2"/><text x="15" y="35" font-size="8" font-family="sans-serif" fill="#ff5722" font-weight="bold">CLK</text></svg>`;
    const svgWaveCounter = `<svg viewBox="0 0 160 120" width="100%" height="100%"><path d="M 20 40 L 40 40 L 40 25 L 60 25 L 60 40 L 80 40 L 80 25 L 100 25 L 100 40 L 140 40" fill="none" stroke="#009688" stroke-width="1.8"/><text x="15" y="20" font-size="7" fill="#009688" font-weight="bold">CLK0</text><path d="M 20 90 L 60 90 L 60 75 L 100 75 L 100 90 L 140 90" fill="none" stroke="#ff9800" stroke-width="1.8"/><text x="15" y="70" font-size="7" fill="#ff9800" font-weight="bold">CLK1</text></svg>`;
    const svgWaveBus = `<svg viewBox="0 0 160 120" width="100%" height="100%"><path d="M 20 50 L 40 50 L 48 40 L 80 40 L 88 50 L 120 50 L 128 40 L 140 40 M 20 50 L 40 50 L 48 60 L 80 60 L 88 50 L 120 50 L 128 60 L 140 60" fill="none" stroke="#00c853" stroke-width="1.8"/><text x="64" y="53" font-size="7" font-family="monospace" text-anchor="middle" fill="#00796b">DATA</text><text x="15" y="30" font-size="7" fill="#333" font-weight="bold">BUS</text></svg>`;
    const svgWaveReset = `<svg viewBox="0 0 160 120" width="100%" height="100%"><path d="M 20 30 L 70 30 L 70 50 L 140 50" fill="none" stroke="#d50000" stroke-width="1.8"/><text x="15" y="22" font-size="7" fill="#d50000" font-weight="bold">RESET</text><path d="M 20 90 L 90 90 L 90 70 L 140 70" fill="none" stroke="#2962ff" stroke-width="1.8"/><text x="15" y="82" font-size="7" fill="#2962ff" font-weight="bold">ENABLE</text></svg>`;

    // Markmap (Aesthetic: colorful mindmaps, curved connection paths)
    const svgMarkmapMindmap = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="60" y="47" width="40" height="16" rx="3" fill="#f4f5f7" stroke="#607d8b" stroke-width="1.5"/><text x="80" y="58" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#333" font-weight="bold">Root</text><path d="M 60 55 L 30 35" stroke="#607d8b" stroke-width="1.2"/><path d="M 60 55 L 30 75" stroke="#607d8b" stroke-width="1.2"/><path d="M 100 55 L 130 55" stroke="#607d8b" stroke-width="1.2"/><circle cx="30" cy="35" r="3.5" fill="#607d8b"/><circle cx="30" cy="75" r="3.5" fill="#607d8b"/><circle cx="130" cy="55" r="3.5" fill="#607d8b"/></svg>`;
    const svgMarkmapRoadmap = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="10" y="50" width="35" height="18" rx="2" fill="#e8f5e9" stroke="#2e7d32" stroke-width="1.5"/><text x="27" y="61" font-size="7" text-anchor="middle" font-family="sans-serif" fill="#2e7d32" font-weight="bold">Roadmap</text><path d="M 45 59 C 65 59, 75 30, 95 30" fill="none" stroke="#2e7d32" stroke-width="1.5"/><path d="M 45 59 C 65 59, 75 90, 95 90" fill="none" stroke="#2e7d32" stroke-width="1.5"/><circle cx="95" cy="30" r="3" fill="#2e7d32"/><circle cx="95" cy="90" r="3" fill="#2e7d32"/><text x="102" y="33" font-size="7" font-family="sans-serif">Q1 Plan</text><text x="102" y="93" font-size="7" font-family="sans-serif">Q2 Build</text></svg>`;
    const svgMarkmapStudy = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="10" y="50" width="35" height="18" rx="2" fill="#fff3e0" stroke="#ef6c00" stroke-width="1.5"/><text x="27" y="61" font-size="7" text-anchor="middle" font-family="sans-serif" fill="#ef6c00" font-weight="bold">Course</text><path d="M 45 59 C 65 59, 70 30, 90 30" fill="none" stroke="#ef6c00" stroke-width="1.5"/><path d="M 45 59 C 65 59, 70 90, 90 90" fill="none" stroke="#ef6c00" stroke-width="1.5"/><circle cx="90" cy="30" r="3" fill="#ef6c00"/><circle cx="90" cy="90" r="3" fill="#ef6c00"/><text x="96" y="33" font-size="7" font-family="sans-serif">Math</text><text x="96" y="93" font-size="7" font-family="sans-serif">Science</text></svg>`;
    const svgMarkmapStack = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="10" y="50" width="30" height="18" rx="2" fill="#e1f5fe" stroke="#0288d1" stroke-width="1.5"/><text x="25" y="61" font-size="7" text-anchor="middle" font-family="sans-serif" fill="#0288d1" font-weight="bold">Stack</text><path d="M 40 59 C 60 59, 70 30, 90 30" fill="none" stroke="#0288d1" stroke-width="1.5"/><path d="M 40 59 C 60 59, 70 90, 90 90" fill="none" stroke="#0288d1" stroke-width="1.5"/><circle cx="90" cy="30" r="3" fill="#0288d1"/><circle cx="90" cy="90" r="3" fill="#0288d1"/><text x="96" y="33" font-size="7" font-family="sans-serif">Web</text><text x="96" y="93" font-size="7" font-family="sans-serif">Mobile</text></svg>`;

    // D2 additional (Aesthetic: monospace font, bold slate outlines, soft purple/blue/green boxes)
    const svgD2Mindmap = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="50" y="45" width="60" height="30" fill="#eceff1" stroke="#333" stroke-width="2"/><text x="80" y="63" font-size="9" text-anchor="middle" font-family="monospace" fill="#333" font-weight="bold">Root</text><path d="M 50 60 L 25 35" stroke="#333" stroke-width="1.5"/><path d="M 50 60 L 25 85" stroke="#333" stroke-width="1.5"/><path d="M 110 60 L 135 60" stroke="#333" stroke-width="1.5"/><rect x="5" y="20" width="20" height="20" fill="#eceff1" stroke="#333" stroke-width="1.5"/><rect x="5" y="75" width="20" height="20" fill="#eceff1" stroke="#333" stroke-width="1.5"/><rect x="135" y="50" width="20" height="20" fill="#eceff1" stroke="#333" stroke-width="1.5"/></svg>`;
    const svgD2Class = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="25" y="20" width="110" height="80" fill="#f5f5f5" stroke="#455a64" stroke-width="2" rx="2"/><line x1="25" y1="45" x2="135" y2="45" stroke="#455a64" stroke-width="1.5"/><line x1="25" y1="70" x2="135" y2="70" stroke="#455a64" stroke-width="1.5"/><text x="80" y="36" font-size="9" text-anchor="middle" font-family="monospace" fill="#000" font-weight="bold">Product</text><text x="32" y="58" font-size="7" font-family="monospace" fill="#333">sku: string</text><text x="32" y="85" font-size="7" font-family="monospace" fill="#333">price: float</text></svg>`;
    const svgD2Venn = `<svg viewBox="0 0 160 120" width="100%" height="100%"><circle cx="65" cy="60" r="30" fill="#2196f3" opacity="0.5" stroke="#1976d2" stroke-width="1.5"/><circle cx="95" cy="60" r="30" fill="#ff9800" opacity="0.5" stroke="#f57c00" stroke-width="1.5"/><text x="50" y="63" font-size="8" text-anchor="middle" font-family="monospace" fill="#000" font-weight="bold">A</text><text x="110" y="63" font-size="8" text-anchor="middle" font-family="monospace" fill="#000" font-weight="bold">B</text></svg>`;

    // Vega-Lite additional (Aesthetic: statistical charts)
    const svgVegaPie = `<svg viewBox="0 0 160 120" width="100%" height="100%"><circle cx="80" cy="60" r="35" fill="#e91e63" stroke="#fff" stroke-width="1"/><path d="M 80 60 L 80 25 A 35 35 0 0 1 115 60 Z" fill="#9c27b0" stroke="#fff" stroke-width="1"/><path d="M 80 60 L 115 60 A 35 35 0 0 1 80 95 Z" fill="#00bcd4" stroke="#fff" stroke-width="1"/></svg>`;
    const svgVegaHeatmap = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="30" y="20" width="30" height="25" fill="#e0f2f1"/><rect x="65" y="20" width="30" height="25" fill="#80cbc4"/><rect x="100" y="20" width="30" height="25" fill="#004d40"/><rect x="30" y="50" width="30" height="25" fill="#b2dfdb"/><rect x="65" y="50" width="30" height="25" fill="#26a69a"/><rect x="100" y="50" width="30" height="25" fill="#00796b"/><rect x="30" y="80" width="30" height="25" fill="#e0f2f1"/><rect x="65" y="80" width="30" height="25" fill="#80cbc4"/><rect x="100" y="80" width="30" height="25" fill="#004d40"/></svg>`;
    const svgVegaBubble = `<svg viewBox="0 0 160 120" width="100%" height="100%"><line x1="25" y1="20" x2="25" y2="95" stroke="#333" stroke-width="1.5"/><line x1="25" y1="95" x2="145" y2="95" stroke="#333" stroke-width="1.5"/><circle cx="45" cy="75" r="5" fill="#ff5722" opacity="0.7"/><circle cx="65" cy="45" r="12" fill="#ff5722" opacity="0.7"/><circle cx="95" cy="80" r="8" fill="#ff5722" opacity="0.7"/><circle cx="120" cy="35" r="16" fill="#ff5722" opacity="0.7"/></svg>`;

    // ABC Notation additional (Aesthetic: musical notation stave and notes)
    const svgAbcPolyphony = `<svg viewBox="0 0 160 120" width="100%" height="100%"><line x1="10" y1="30" x2="150" y2="30" stroke="#000" stroke-width="1"/><line x1="10" y1="40" x2="150" y2="40" stroke="#000" stroke-width="1"/><line x1="10" y1="50" x2="150" y2="50" stroke="#000" stroke-width="1"/><line x1="10" y1="60" x2="150" y2="60" stroke="#000" stroke-width="1"/><line x1="10" y1="70" x2="150" y2="70" stroke="#000" stroke-width="1"/><path d="M 45 40 L 45 15 A 8 8 0 1 1 35 25" fill="#000"/><path d="M 45 50 L 45 75 A 8 8 0 1 1 35 68" fill="#000"/><path d="M 95 30 L 95 10 A 8 8 0 1 1 85 18" fill="#000"/><path d="M 95 60 L 95 85 A 8 8 0 1 1 85 78" fill="#000"/></svg>`;
    const svgAbcKeySignature = `<svg viewBox="0 0 160 120" width="100%" height="100%"><line x1="10" y1="30" x2="150" y2="30" stroke="#000" stroke-width="1"/><line x1="10" y1="40" x2="150" y2="40" stroke="#000" stroke-width="1"/><line x1="10" y1="50" x2="150" y2="50" stroke="#000" stroke-width="1"/><line x1="10" y1="60" x2="150" y2="60" stroke="#000" stroke-width="1"/><line x1="10" y1="70" x2="150" y2="70" stroke="#000" stroke-width="1"/><text x="15" y="60" font-size="28" font-family="serif" font-weight="bold" fill="#000">𝄞</text><text x="38" y="38" font-size="12" font-family="serif" font-weight="bold" fill="#000">♯</text><text x="48" y="52" font-size="12" font-family="serif" font-weight="bold" fill="#000">♯</text><path d="M 80 30 L 80 70 A 8 8 0 1 1 70 63" fill="#000"/><path d="M 120 40 L 120 80 A 8 8 0 1 1 110 73" fill="#000"/></svg>`;

    // WaveDrom additional (Aesthetic: digital waveform timing lines)
    const svgWaveGlitches = `<svg viewBox="0 0 160 120" width="100%" height="100%"><path d="M 20 50 L 50 50 L 52 35 L 54 65 L 56 35 L 58 65 L 60 50 L 100 50 L 102 35 L 104 65 L 106 35 L 108 65 L 110 50 L 140 50" fill="none" stroke="#e91e63" stroke-width="2"/><text x="15" y="25" font-size="8" font-family="sans-serif" fill="#e91e63" font-weight="bold">GLITCH</text></svg>`;
    const svgWaveComplexBus = `<svg viewBox="0 0 160 120" width="100%" height="100%"><path d="M 20 40 L 40 40 L 45 30 L 75 30 L 80 40 L 110 40 L 115 50 L 140 50 M 20 40 L 40 40 L 45 50 L 75 50 L 80 40 L 110 40 L 115 30 L 140 30" fill="none" stroke="#2196f3" stroke-width="1.8"/><path d="M 20 80 L 50 80 L 55 70 L 95 70 L 100 80 L 140 80 M 20 80 L 50 80 L 55 90 L 95 90 L 100 80 L 140 80" fill="none" stroke="#4caf50" stroke-width="1.8"/><text x="60" y="43" font-size="6" font-family="monospace" text-anchor="middle" fill="#000">ADDR</text><text x="75" y="83" font-size="6" font-family="monospace" text-anchor="middle" fill="#000">DATA</text></svg>`;

    // Markmap additional (Aesthetic: colorful mindmaps, checklist notation)
    const svgMarkmapChecklist = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="10" y="50" width="35" height="18" rx="2" fill="#ede7f6" stroke="#5e35b1" stroke-width="1.5"/><text x="27" y="61" font-size="7" text-anchor="middle" font-family="sans-serif" fill="#5e35b1" font-weight="bold">Tasks</text><path d="M 45 59 C 65 59, 70 30, 90 30" fill="none" stroke="#5e35b1" stroke-width="1.5"/><path d="M 45 59 C 65 59, 70 90, 90 90" fill="none" stroke="#5e35b1" stroke-width="1.5"/><circle cx="90" cy="30" r="3" fill="#5e35b1"/><circle cx="90" cy="90" r="3" fill="#5e35b1"/><text x="96" y="33" font-size="7" font-family="sans-serif">☒ Todo A</text><text x="96" y="93" font-size="7" font-family="sans-serif">☑ Todo B</text></svg>`;
    const svgMarkmapCode = `<svg viewBox="0 0 160 120" width="100%" height="100%"><rect x="10" y="50" width="35" height="18" rx="2" fill="#eceff1" stroke="#455a64" stroke-width="1.5"/><text x="27" y="61" font-size="7" text-anchor="middle" font-family="sans-serif" fill="#455a64" font-weight="bold">Project</text><path d="M 45 59 C 65 59, 70 30, 90 30" fill="none" stroke="#455a64" stroke-width="1.5"/><path d="M 45 59 C 65 59, 70 90, 90 90" fill="none" stroke="#455a64" stroke-width="1.5"/><circle cx="90" cy="30" r="3" fill="#455a64"/><circle cx="90" cy="90" r="3" fill="#455a64"/><text x="96" y="33" font-size="7" font-family="monospace">code()</text><text x="96" y="93" font-size="7" font-family="monospace">test()</text></svg>`;

    const templates = [
      // Mermaid
      {
        id: 'mermaid-flowchart-td',
        category: 'Mermaid',
        title: 'Flowchart (TD)',
        label: 'Flowchart (Top-Down)',
        svg: svgFlowchart,
        code: '```mermaid\ngraph TD\n    Start --> End\n```\n'
      },
      {
        id: 'mermaid-flowchart-lr',
        category: 'Mermaid',
        title: 'Flowchart (LR)',
        label: 'Flowchart (Left-Right)',
        svg: svgMermaidFlowchartLR,
        code: '```mermaid\ngraph LR\n    Left --> Right\n```\n'
      },
      {
        id: 'mermaid-sequence',
        category: 'Mermaid',
        title: 'Sequence preview',
        label: 'Sequence Diagram',
        svg: svgSequence,
        code: '```mermaid\nsequenceDiagram\n    Alice->>Bob: Hello Bob, how are you?\n    Bob-->>Alice: Jolly good!\n```\n'
      },
      {
        id: 'mermaid-er',
        category: 'Mermaid',
        title: 'ER preview',
        label: 'ER Diagram',
        svg: svgEr,
        code: '```mermaid\nerDiagram\n    CUSTOMER ||--o{ ORDER : places\n```\n'
      },
      {
        id: 'mermaid-class',
        category: 'Mermaid',
        title: 'Class Diagram',
        label: 'Class Diagram',
        svg: svgClass,
        code: '```mermaid\nclassDiagram\n    Animal <|-- Duck\n    class Animal {\n        +String name\n        +makeSound()\n    }\n```\n'
      },
      {
        id: 'mermaid-state',
        category: 'Mermaid',
        title: 'State Diagram',
        label: 'State Diagram',
        svg: svgState,
        code: '```mermaid\nstateDiagram-v2\n    [*] --> Active\n    Active --> [*]\n```\n'
      },
      {
        id: 'mermaid-gantt',
        category: 'Mermaid',
        title: 'Gantt Chart',
        label: 'Gantt Chart',
        svg: svgGantt,
        code: '```mermaid\ngantt\n    title A Gantt Diagram\n    section Section\n    A task :a1, 2026-06-23, 30d\n```\n'
      },
      {
        id: 'mermaid-pie',
        category: 'Mermaid',
        title: 'Pie Chart',
        label: 'Pie Chart',
        svg: svgPie,
        code: '```mermaid\npie title Pets owned by staff\n    "Dogs" : 386\n    "Cats" : 85\n```\n'
      },
      {
        id: 'mermaid-git',
        category: 'Mermaid',
        title: 'Git Graph',
        label: 'Git Graph',
        svg: svgGitGraph,
        code: '```mermaid\ngitGraph\n    commit\n    branch hotfix\n    checkout hotfix\n    commit\n    checkout main\n    merge hotfix\n```\n'
      },
      {
        id: 'mermaid-journey',
        category: 'Mermaid',
        title: 'User Journey',
        label: 'User Journey',
        svg: svgJourney,
        code: '```mermaid\njourney\n    title My working day\n    section Go to work\n      Make tea: 5: Me\n      Go upstairs: 3: Me\n```\n'
      },
      {
        id: 'mermaid-mindmap',
        category: 'Mermaid',
        title: 'Mindmap',
        label: 'Mindmap Diagram',
        svg: svgMermaidMindmap,
        code: '```mermaid\nmindmap\n  root((Goal))\n    Topic 1\n      Subtopic 1\n    Topic 2\n```\n'
      },
      {
        id: 'mermaid-quadrant',
        category: 'Mermaid',
        title: 'Quadrant Chart',
        label: 'Quadrant Chart',
        svg: svgMermaidQuadrant,
        code: '```mermaid\nquadrantChart\n    title Reach and Engagement\n    x-axis Low Reach --> High Reach\n    y-axis Low Engagement --> High Engagement\n    quadrant-1 We should expand\n    quadrant-2 Need to promote\n    quadrant-3 Re-evaluate\n    quadrant-4 Keep improving\n    Campaign A: [0.3, 0.6]\n    Campaign B: [0.45, 0.23]\n```\n'
      },
      {
        id: 'mermaid-xy',
        category: 'Mermaid',
        title: 'XY Chart',
        label: 'XY Chart',
        svg: svgMermaidXy,
        code: '```mermaid\nxychart-beta\n    title "Sales Revenue"\n    x-axis [jan, feb, mar, apr, may]\n    y-axis "Revenue ($)" 0 --> 1000\n    bar [500, 600, 700, 800, 900]\n    line [480, 580, 710, 820, 910]\n```\n'
      },
      {
        id: 'mermaid-requirement',
        category: 'Mermaid',
        title: 'Requirements',
        label: 'Requirements Diagram',
        svg: svgMermaidRequirement,
        code: '```mermaid\nrequirementDiagram\n    requirement test_req {\n    id: 1\n    text: "Verify system response time."\n    risk: medium\n    verifymethod: test\n    }\n    element test_case {\n    type: "simulation"\n    }\n    test_case - satisfies -> test_req\n```\n'
      },
      {
        id: 'mermaid-c4',
        category: 'Mermaid',
        title: 'C4 Container',
        label: 'C4 Container Diagram',
        svg: svgMermaidC4,
        code: '```mermaid\nC4Context\n    title System Context for Internet Banking\n    Enterprise_Boundary(b1, "Banking") {\n        System(banking_sys, "Banking System", "Stores accounts")\n    }\n```\n'
      },
      {
        id: 'mermaid-sankey',
        category: 'Mermaid',
        title: 'Sankey Chart',
        label: 'Sankey Flow Chart',
        svg: svgMermaidSankey,
        code: '```mermaid\nsankey-beta\n    source,target,value\n    Electricity,Grid,120\n    Gas,Grid,80\n```\n'
      },
      {
        id: 'mermaid-timeline',
        category: 'Mermaid',
        title: 'Timeline',
        label: 'Timeline Diagram',
        svg: svgMermaidTimeline,
        code: '```mermaid\ntimeline\n    title History of Web\n    2000 : HTML4\n    2014 : HTML5\n```\n'
      },
      
      // PlantUML
      {
        id: 'plantuml-sequence',
        category: 'PlantUML',
        title: 'Sequence Diagram',
        label: 'Sequence Diagram',
        svg: svgPlantUmlSequence,
        code: '```plantuml\n@startuml\nAlice -> Bob: Authentication Request\nBob --> Alice: Authentication Response\n@enduml\n```\n'
      },
      {
        id: 'plantuml-usecase',
        category: 'PlantUML',
        title: 'Use Case Diagram',
        label: 'Use Case Diagram',
        svg: svgPlantUmlUseCase,
        code: '```plantuml\n@startuml\nleft to right direction\nactor Guest\nrectangle Hotel {\n  usecase "Book Room" as UC1\n}\nGuest --> UC1\n@enduml\n```\n'
      },
      {
        id: 'plantuml-activity',
        category: 'PlantUML',
        title: 'Activity Diagram',
        label: 'Activity Diagram',
        svg: svgPlantUmlActivity,
        code: '```plantuml\n@startuml\n:Start;\n:Hello World;\n:End;\n@enduml\n```\n'
      },
      {
        id: 'plantuml-class',
        category: 'PlantUML',
        title: 'Class Diagram',
        label: 'Class Diagram',
        svg: svgPlantUmlClass,
        code: '```plantuml\n@startuml\nclass Dummy {\n  -field1\n  #field2\n  ~method1()\n  +method2()\n}\n@enduml\n```\n'
      },
      {
        id: 'plantuml-state',
        category: 'PlantUML',
        title: 'State Diagram',
        label: 'State Diagram',
        svg: svgPlantUmlState,
        code: '```plantuml\n@startuml\n[*] --> State1\nState1 --> State2 : Transition\n@enduml\n```\n'
      },
      {
        id: 'plantuml-component',
        category: 'PlantUML',
        title: 'Component Diagram',
        label: 'Component Diagram',
        svg: svgPlantUmlComponent,
        code: '```plantuml\n@startuml\n[Web GUI] --> [App Service] : JSON HTTP\n@enduml\n```\n'
      },
      {
        id: 'plantuml-object',
        category: 'PlantUML',
        title: 'Object Diagram',
        label: 'Object Instances',
        svg: svgPlantUmlObject,
        code: '```plantuml\n@startuml\nobject user1 {\n  name = "Alice"\n  role = "Admin"\n}\n@enduml\n```\n'
      },
      {
        id: 'plantuml-deployment',
        category: 'PlantUML',
        title: 'Deployment',
        label: 'Deployment Nodes',
        svg: svgPlantUmlDeployment,
        code: '```plantuml\n@startuml\nnode "Application Server" {\n  component [Web Application]\n}\n@enduml\n```\n'
      },
      {
        id: 'plantuml-timing',
        category: 'PlantUML',
        title: 'Timing Diagram',
        label: 'Timing Signal Wave',
        svg: svgPlantUmlTiming,
        code: '```plantuml\n@startuml\nrobust "WebState" as WS\n@0\nWS is Idle\n@100\nWS is Busy\n@enduml\n```\n'
      },
      {
        id: 'plantuml-network',
        category: 'PlantUML',
        title: 'Network (nwdiag)',
        label: 'Network Map',
        svg: svgPlantUmlNetwork,
        code: '```plantuml\n@startnwdiag\nnetwork dmz {\n  address = "192.168.1.0/24"\n  web [address = "192.168.1.1"];\n  db  [address = "192.168.1.2"];\n}\n@endnwdiag\n```\n'
      },
      {
        id: 'plantuml-mindmap',
        category: 'PlantUML',
        title: 'Mindmap',
        label: 'Mindmap Outline',
        svg: svgPlantUmlMindmap,
        code: '```plantuml\n@startmindmap\n* Idea\n** Topic A\n** Topic B\n@endmindmap\n```\n'
      },
      {
        id: 'plantuml-wbs',
        category: 'PlantUML',
        title: 'WBS Hierarchy',
        label: 'Work Breakdown',
        svg: svgPlantUmlWbs,
        code: '```plantuml\n@startwbs\n* Project\n** Phase 1\n** Phase 2\n@endwbs\n```\n'
      },
      {
        id: 'plantuml-json',
        category: 'PlantUML',
        title: 'JSON Viewer',
        label: 'JSON Document',
        svg: svgPlantUmlJson,
        code: '```plantuml\n@startjson\n{\n  "name": "Widget",\n  "count": 42,\n  "active": true\n}\n@endjson\n```\n'
      },
      
      // Graphviz
      {
        id: 'graphviz-digraph',
        category: 'Graphviz',
        title: 'Directed Graph',
        label: 'Directed Graph',
        svg: svgGraphvizDigraph,
        code: '```graphviz\ndigraph G {\n  Hello -> World\n}\n```\n'
      },
      {
        id: 'graphviz-tree',
        category: 'Graphviz',
        title: 'Hierarchy Tree',
        label: 'Hierarchy Tree',
        svg: svgGraphvizTree,
        code: '```graphviz\ndigraph Tree {\n  node [shape=circle];\n  Parent -> Left;\n  Parent -> Right;\n}\n```\n'
      },
      {
        id: 'graphviz-struct',
        category: 'Graphviz',
        title: 'Record Struct',
        label: 'Record Structure',
        svg: svgGraphvizStruct,
        code: '```graphviz\ndigraph G {\n  node [shape=record];\n  struct1 [label="<f0> left|<f1> mid|<f2> right"];\n}\n```\n'
      },
      {
        id: 'graphviz-fsm',
        category: 'Graphviz',
        title: 'FSM Diagram',
        label: 'Finite State Machine',
        svg: svgGraphvizFsm,
        code: '```graphviz\ndigraph FSM {\n  rankdir=LR;\n  S1 -> S2 [label="Input"];\n}\n```\n'
      },
      {
        id: 'graphviz-network',
        category: 'Graphviz',
        title: 'Network Topology',
        label: 'Network Topology',
        svg: svgGraphvizNetwork,
        code: '```graphviz\ngraph Net {\n  Router -- Switch;\n  Switch -- Client1;\n  Switch -- Client2;\n}\n```\n'
      },
      {
        id: 'graphviz-subgraph',
        category: 'Graphviz',
        title: 'Cluster Subgraph',
        label: 'Grouped Nodes',
        svg: svgGraphvizSubgraph,
        code: '```graphviz\ndigraph G {\n  subgraph cluster_0 {\n    label="Group A";\n    A -> B;\n  }\n  B -> C;\n}\n```\n'
      },
      {
        id: 'graphviz-er',
        category: 'Graphviz',
        title: 'ER Diagram',
        label: 'ER (Graphviz style)',
        svg: svgGraphvizEr,
        code: '```graphviz\ndigraph ER {\n  node [shape=box]; Entity;\n  node [shape=diamond]; Rel;\n  Entity -> Rel;\n}\n```\n'
      },
      
      // D2
      {
        id: 'd2-flow',
        category: 'D2',
        title: 'Simple Flow',
        label: 'Simple Flow',
        svg: svgD2Flow,
        code: '```d2\nx -> y: hello world\n```\n'
      },
      {
        id: 'd2-arch',
        category: 'D2',
        title: 'Architecture Diagram',
        label: 'Architecture Diagram',
        svg: svgD2Arch,
        code: '```d2\ncloud platform {\n  app: Application Server\n  db: PostgreSQL Database\n  app -> db\n}\n```\n'
      },
      {
        id: 'd2-sequence',
        category: 'D2',
        title: 'Sequence Diagram',
        label: 'Sequence Diagram',
        svg: svgD2Sequence,
        code: '```d2\nclient -> server: Get User Profile\nserver -> client: Profile Data\n```\n'
      },
      {
        id: 'd2-erd',
        category: 'D2',
        title: 'ERD Table',
        label: 'Entity Relationship',
        svg: svgD2Erd,
        code: '```d2\nusers: {\n  shape: sql_table\n  id: int {constraint: primary_key}\n  name: string\n}\nposts: {\n  shape: sql_table\n  id: int {constraint: primary_key}\n  user_id: int\n}\nusers.id -> posts.user_id\n```\n'
      },
      {
        id: 'd2-grid',
        category: 'D2',
        title: 'Grid Layout',
        label: 'Grid Layout',
        svg: svgD2Grid,
        code: '```d2\ngrid-demo: {\n  grid-columns: 2\n  box-1: Box 1\n  box-2: Box 2\n}\n```\n'
      },
      {
        id: 'd2-mindmap',
        category: 'D2',
        title: 'Mindmap',
        label: 'Mindmap Outline',
        svg: svgD2Mindmap,
        code: '```d2\nroot: Root\nroot -> topic-a: Topic A\nroot -> topic-b: Topic B\n```\n'
      },
      {
        id: 'd2-class',
        category: 'D2',
        title: 'Class Diagram',
        label: 'Object Types',
        svg: svgD2Class,
        code: '```d2\nProduct: {\n  sku: string\n  price: float\n}\n```\n'
      },
      {
        id: 'd2-venn',
        category: 'D2',
        title: 'Venn Diagram',
        label: 'Overlap Set',
        svg: svgD2Venn,
        code: '```d2\nset-a: Set A {\n  shape: circle\n}\nset-b: Set B {\n  shape: circle\n}\nset-a -> set-b: overlap\n```\n'
      },
      
      // Vega-Lite
      {
        id: 'vega-bar',
        category: 'Vega-Lite',
        title: 'Bar Chart',
        label: 'Bar Chart',
        svg: svgVegaBar,
        code: '```vega-lite\n{\n  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",\n  "data": {\n    "values": [\n      {"a": "A", "b": 28}, {"a": "B", "b": 55}, {"a": "C", "b": 43}\n    ]\n  },\n  "mark": "bar",\n  "encoding": {\n    "x": {"field": "a", "type": "nominal"},\n    "y": {"field": "b", "type": "quantitative"}\n  }\n}\n```\n'
      },
      {
        id: 'vega-line',
        category: 'Vega-Lite',
        title: 'Line Chart',
        label: 'Line Chart',
        svg: svgVegaLine,
        code: '```vega-lite\n{\n  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",\n  "data": {\n    "values": [\n      {"x": 1, "y": 10}, {"x": 2, "y": 15}, {"x": 3, "y": 13}\n    ]\n  },\n  "mark": "line",\n  "encoding": {\n    "x": {"field": "x", "type": "quantitative"},\n    "y": {"field": "y", "type": "quantitative"}\n  }\n}\n```\n'
      },
      {
        id: 'vega-scatter',
        category: 'Vega-Lite',
        title: 'Scatter Plot',
        label: 'Scatter Plot',
        svg: svgVegaScatter,
        code: '```vega-lite\n{\n  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",\n  "data": {\n    "values": [\n      {"x": 1, "y": 1.5}, {"x": 2, "y": 2.5}, {"x": 3, "y": 1.0}\n    ]\n  },\n  "mark": "point",\n  "encoding": {\n    "x": {"field": "x", "type": "quantitative"},\n    "y": {"field": "y", "type": "quantitative"}\n  }\n}\n```\n'
      },
      {
        id: 'vega-area',
        category: 'Vega-Lite',
        title: 'Area Chart',
        label: 'Area Chart',
        svg: svgVegaArea,
        code: '```vega-lite\n{\n  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",\n  "data": {\n    "values": [\n      {"x": 1, "y": 10}, {"x": 2, "y": 15}, {"x": 3, "y": 13}\n    ]\n  },\n  "mark": "area",\n  "encoding": {\n    "x": {"field": "x", "type": "quantitative"},\n    "y": {"field": "y", "type": "quantitative"}\n  }\n}\n```\n'
      },
      {
        id: 'vega-stacked-bar',
        category: 'Vega-Lite',
        title: 'Stacked Bar',
        label: 'Stacked Bar Chart',
        svg: svgVegaStackedBar,
        code: '```vega-lite\n{\n  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",\n  "data": {\n    "values": [\n      {"x": "A", "y": 10, "group": "one"},\n      {"x": "A", "y": 15, "group": "two"},\n      {"x": "B", "y": 20, "group": "one"},\n      {"x": "B", "y": 5, "group": "two"}\n    ]\n  },\n  "mark": "bar",\n  "encoding": {\n    "x": {"field": "x", "type": "nominal"},\n    "y": {"field": "y", "type": "quantitative"},\n    "color": {"field": "group", "type": "nominal"}\n  }\n}\n```\n'
      },
      {
        id: 'vega-pie',
        category: 'Vega-Lite',
        title: 'Pie Chart',
        label: 'Pie Chart',
        svg: svgVegaPie,
        code: '```vega-lite\n{\n  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",\n  "description": "A simple pie chart.",\n  "data": {\n    "values": [\n      {"category": 1, "value": 4},\n      {"category": 2, "value": 6},\n      {"category": 3, "value": 10}\n    ]\n  },\n  "mark": "arc",\n  "encoding": {\n    "theta": {"field": "value", "type": "quantitative"},\n    "color": {"field": "category", "type": "nominal"}\n  }\n}\n```\n'
      },
      {
        id: 'vega-heatmap',
        category: 'Vega-Lite',
        title: 'Heatmap',
        label: 'Heatmap Matrix',
        svg: svgVegaHeatmap,
        code: '```vega-lite\n{\n  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",\n  "data": {\n    "values": [\n      {"x": 1, "y": 1, "z": 10},\n      {"x": 1, "y": 2, "z": 20},\n      {"x": 2, "y": 1, "z": 30},\n      {"x": 2, "y": 2, "z": 40}\n    ]\n  },\n  "mark": "rect",\n  "encoding": {\n    "x": {"field": "x", "type": "ordinal"},\n    "y": {"field": "y", "type": "ordinal"},\n    "color": {"field": "z", "type": "quantitative"}\n  }\n}\n```\n'
      },
      {
        id: 'vega-bubble',
        category: 'Vega-Lite',
        title: 'Bubble Plot',
        label: 'Bubble Plot',
        svg: svgVegaBubble,
        code: '```vega-lite\n{\n  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",\n  "data": {\n    "values": [\n      {"x": 1, "y": 10, "size": 100},\n      {"x": 2, "y": 20, "size": 400},\n      {"x": 3, "y": 15, "size": 200}\n    ]\n  },\n  "mark": "point",\n  "encoding": {\n    "x": {"field": "x", "type": "quantitative"},\n    "y": {"field": "y", "type": "quantitative"},\n    "size": {"field": "size", "type": "quantitative"}\n  }\n}\n```\n'
      },
      
      // ABC Notation
      {
        id: 'abc-melody',
        category: 'ABC Notation',
        title: 'Simple Tune',
        label: 'Simple Tune',
        svg: svgAbcMelody,
        code: '```abc\nX: 1\nT: Simple Scale\nM: 4/4\nK: C\nC D E F | G A B c |\n```\n'
      },
      {
        id: 'abc-duet',
        category: 'ABC Notation',
        title: 'Duet Accord',
        label: 'Duet Accord',
        svg: svgAbcDuet,
        code: '```abc\nX: 2\nT: Simple Duet\nM: 4/4\nK: C\nV:1\nC D E F | G A B c |\nV:2\nE F G A | B c d e |\n```\n'
      },
      {
        id: 'abc-lyric',
        category: 'ABC Notation',
        title: 'Folk & Lyrics',
        label: 'Lyrics Song',
        svg: svgAbcLyric,
        code: '```abc\nX: 3\nT: Folk Song\nM: 4/4\nK: C\nC D E C | E G G2 |\nw: Do Re Mi Do | Mi Sol Sol\n```\n'
      },
      {
        id: 'abc-chords',
        category: 'ABC Notation',
        title: 'Chords Strum',
        label: 'Guitar Chords',
        svg: svgAbcChords,
        code: '```abc\nX: 4\nT: Chords Strum\nM: 4/4\nK: C\n"C"C D E F | "G"G A B c |\n```\n'
      },
      {
        id: 'abc-polyphony',
        category: 'ABC Notation',
        title: 'Polyphony Voices',
        label: 'Multi-Voice Harmony',
        svg: svgAbcPolyphony,
        code: '```abc\nX: 5\nT: Polyphonic Harmony\nM: 4/4\nK: C\n%%score V1 V2\nV:1 clef=treble\nC2 E2 G2 c2 | e4 z4 |\nV:2 clef=bass\nC,,4 E,,4 | G,,4 C,,4 |\n```\n'
      },
      {
        id: 'abc-keysig',
        category: 'ABC Notation',
        title: 'Key Signature & Tempo',
        label: 'Signature and Speed',
        svg: svgAbcKeySignature,
        code: '```abc\nX: 6\nT: Major Tune\nM: 3/4\nL: 1/8\nQ: 1/4=120\nK: G\n|: G2 B2 d2 | g4 fg | a2 A2 B2 | c4 z2 :|\n```\n'
      },
      
      // WaveDrom
      {
        id: 'wavedrom-timing',
        category: 'WaveDrom',
        title: 'Timing Diagram',
        label: 'Timing Diagram',
        svg: svgWaveTiming,
        code: '```wavedrom\n{ signal: [\n  { name: "clk", wave: "p......" },\n  { name: "bus", wave: "x.==.x.", data: ["head", "body"] }\n]}\n```\n'
      },
      {
        id: 'wavedrom-counter',
        category: 'WaveDrom',
        title: 'Binary Counter',
        label: 'Binary Counter',
        svg: svgWaveCounter,
        code: '```wavedrom\n{ signal: [\n  { name: "clk", wave: "p......" },\n  { name: "q",   wave: "01.01.0" }\n]}\n```\n'
      },
      {
        id: 'wavedrom-bus',
        category: 'WaveDrom',
        title: 'Data Bus States',
        label: 'Data Bus States',
        svg: svgWaveBus,
        code: '```wavedrom\n{ signal: [\n  { name: "bus", wave: "x.=.=.x", data: ["read", "write"] }\n]}\n```\n'
      },
      {
        id: 'wavedrom-reset',
        category: 'WaveDrom',
        title: 'Reset Sequence',
        label: 'Reset & Enable',
        svg: svgWaveReset,
        code: '```wavedrom\n{ signal: [\n  { name: "reset",  wave: "1.0.1" },\n  { name: "enable", wave: "0.1.0" }\n]}\n```\n'
      },
      {
        id: 'wavedrom-glitches',
        category: 'WaveDrom',
        title: 'Signal Glitches',
        label: 'Glitchy Waveform',
        svg: svgWaveGlitches,
        code: '```wavedrom\n{ signal: [\n  { name: "clk",    wave: "p......" },\n  { name: "signal", wave: "0.h.l.h.0" }\n]}\n```\n'
      },
      {
        id: 'wavedrom-complex-bus',
        category: 'WaveDrom',
        title: 'Complex Transaction',
        label: 'Address & Data Buses',
        svg: svgWaveComplexBus,
        code: '```wavedrom\n{ signal: [\n  { name: "clk",  wave: "p......" },\n  { name: "addr", wave: "x.=.x.=", data: ["A0", "A1"] },\n  { name: "data", wave: "x...=.x", data: ["D0"] }\n]}\n```\n'
      },
      
      // Markmap
      {
        id: 'markmap-mindmap',
        category: 'Markmap',
        title: 'Mindmap',
        label: 'Mindmap',
        svg: svgMarkmapMindmap,
        code: '```markmap\n# markmap\n## Features\n- Links\n- Formatting\n```\n'
      },
      {
        id: 'markmap-roadmap',
        category: 'Markmap',
        title: 'Roadmap',
        label: 'Project Roadmap',
        svg: svgMarkmapRoadmap,
        code: '```markmap\n# Roadmap\n## Q1\n### Plan\n### Design\n## Q2\n### Build\n```\n'
      },
      {
        id: 'markmap-study',
        category: 'Markmap',
        title: 'Study Plan',
        label: 'Study Topics',
        svg: svgMarkmapStudy,
        code: '```markmap\n# Course\n## Math\n### Algebra\n### Calculus\n## Science\n### Physics\n```\n'
      },
      {
        id: 'markmap-stack',
        category: 'Markmap',
        title: 'Tech Stack',
        label: 'Tech Stack',
        svg: svgMarkmapStack,
        code: '```markmap\n# stack\n## frontend\n### HTML/JS\n## backend\n### Node.js\n```\n'
      },
      {
        id: 'markmap-checklist',
        category: 'Markmap',
        title: 'Checklist Map',
        label: 'Checkbox Map',
        svg: svgMarkmapChecklist,
        code: '```markmap\n# Project Tasks\n## Done\n- [x] Initial design\n- [x] Codebase setup\n## Pending\n- [ ] Write tests\n- [ ] Deploy release\n```\n'
      },
      {
        id: 'markmap-code',
        category: 'Markmap',
        title: 'Code Mindmap',
        label: 'Inline Code Blocks',
        svg: svgMarkmapCode,
        code: '```markmap\n# Development\n## Languages\n- `JavaScript`\n- `Python`\n## Functions\n- `main()`\n- `helper_func()`\n```\n'
      }
    ];
    
    let activeCategory = 'Mermaid';
    let selectedTemplate = null;
    
    function renderSidebar() {
      sidebar.textContent = '';
      categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'diagram-sidebar-btn';
        if (cat === activeCategory) btn.classList.add('is-active');
        btn.textContent = cat;
        btn.addEventListener('click', () => {
          activeCategory = cat;
          renderSidebar();
          renderGrid();
        });
        sidebar.appendChild(btn);
      });
    }
    
    function renderGrid() {
      grid.textContent = '';
      const query = searchInput.value.toLowerCase().trim();
      
      const filtered = templates.filter(t => {
        const matchesCategory = activeCategory === t.category;
        const matchesSearch = !query || 
          t.title.toLowerCase().includes(query) || 
          t.label.toLowerCase().includes(query) ||
          t.category.toLowerCase().includes(query);
        return matchesCategory && matchesSearch;
      });
      
      if (filtered.length === 0) {
        emptyMessage.style.display = 'block';
      } else {
        emptyMessage.style.display = 'none';
      }
      
      filtered.forEach(t => {
        const card = document.createElement('div');
        card.className = 'diagram-card';
        if (selectedTemplate && selectedTemplate.id === t.id) {
          card.classList.add('is-selected');
        }
        
        const previewDiv = document.createElement('div');
        previewDiv.className = 'diagram-card-preview';
        
        const isMermaidSpecial = (t.id === 'mermaid-sequence' || t.id === 'mermaid-er');
        const titleColor = isMermaidSpecial ? '#ff4081' : 'var(--text-color)';
        const titleWeight = isMermaidSpecial ? 'bold' : 'normal';
        const catClass = t.category.toLowerCase().replace(/\s+/g, '');

        previewDiv.innerHTML = `
          <div style="display:flex; flex-direction:column; align-items:center; width:100%; height:100%;">
            <div style="font-size:10px; font-weight:${titleWeight}; color:${titleColor}; margin-bottom:4px;">${t.title}</div>
            <div class="diagram-svg-container diagram-svg-${catClass}" style="flex:1; width:100%; display:flex; align-items:center; justify-content:center; overflow:hidden;">
              ${t.svg}
            </div>
          </div>
        `;
        
        const theme = document.documentElement.getAttribute("data-theme") || "light";
        
        getOrRenderDiagramPreview(t, theme, svgText => {
          if (svgText) {
            const svgContainer = previewDiv.querySelector('.diagram-svg-container');
            if (svgContainer) {
              svgContainer.innerHTML = svgText;
              normalizeDiagramPreviewSvg(svgContainer, t);
            }
          }
        });
        
        const labelDiv = document.createElement('div');
        labelDiv.className = 'diagram-card-label';
        labelDiv.textContent = t.label;
        
        card.appendChild(previewDiv);
        card.appendChild(labelDiv);
        
        card.addEventListener('click', () => {
          selectedTemplate = t;
          const cards = grid.querySelectorAll('.diagram-card');
          cards.forEach(c => c.classList.remove('is-selected'));
          card.classList.add('is-selected');
          
          if (previewCode) previewCode.value = t.code.trim();
          confirmBtn.disabled = false;

          const catClass = t.category.toLowerCase().replace(/\s+/g, '');
          // Render bottom preview container with API image & fallback
          previewContainer.innerHTML = `
            <div class="diagram-svg-container diagram-svg-${catClass}" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; overflow:hidden;">
              ${t.svg}
            </div>
          `;
          
          const clickedTheme = document.documentElement.getAttribute("data-theme") || "light";
          
          getOrRenderDiagramPreview(t, clickedTheme, svgText => {
            if (svgText) {
              const svgContainer = previewContainer.querySelector('.diagram-svg-container');
              if (svgContainer) {
                svgContainer.innerHTML = svgText;
                normalizeDiagramPreviewSvg(svgContainer, t);
              }
            }
          });
        });
        
        grid.appendChild(card);
      });
    }


    
    renderSidebar();
    renderGrid();
    
    searchInput.addEventListener('input', renderGrid);
    
    function insertTemplate() {
      if (!selectedTemplate) return;
      modal.style.display = 'none';
      cleanup();
      insertMarkdownBlock(selectedTemplate.code, start, end);
    }
    
    function closeModal() {
      modal.style.display = 'none';
      cleanup();
    }
    
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    }
    
    function cleanup() {
      confirmBtn.removeEventListener('click', insertTemplate);
      cancelBtn.removeEventListener('click', closeModal);
      closeBtn.removeEventListener('click', closeModal);
      modal.removeEventListener('keydown', onKey);
      searchInput.removeEventListener('input', renderGrid);
    }
    
    confirmBtn.addEventListener('click', insertTemplate);
    cancelBtn.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('keydown', onKey);
  }

  function insertMarkdownLink() {
    const modal = document.getElementById('link-modal');
    const urlInput = document.getElementById('link-modal-url');
    const textInput = document.getElementById('link-modal-text');
    const confirmBtn = document.getElementById('link-modal-apply');
    const cancelBtn = document.getElementById('link-modal-cancel');
    if (!modal || !urlInput || !textInput || !confirmBtn || !cancelBtn) return;
    const start = markdownEditor.selectionStart;
    const end = markdownEditor.selectionEnd;
    const selected = markdownEditor.value.slice(start, end);
    urlInput.value = 'https://';
    textInput.value = selected || '';
    modal.style.display = 'flex';

    function applyLink() {
      const url = urlInput.value.trim() || 'https://';
      const linkText = textInput.value.trim() || selected || 'link text';
      const replacement = '[' + linkText + '](' + url + ')';
      modal.style.display = 'none';
      cleanup();
      replaceEditorRange(start, end, replacement, start + replacement.length, start + replacement.length);
    }

    function closeModal() {
      modal.style.display = 'none';
      cleanup();
    }

    function onKey(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyLink();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    }

    function cleanup() {
      confirmBtn.removeEventListener('click', applyLink);
      cancelBtn.removeEventListener('click', closeModal);
      urlInput.removeEventListener('keydown', onKey);
      textInput.removeEventListener('keydown', onKey);
    }

    confirmBtn.addEventListener('click', applyLink);
    cancelBtn.addEventListener('click', closeModal);
    urlInput.addEventListener('keydown', onKey);
    textInput.addEventListener('keydown', onKey);

    requestAnimationFrame(function() {
      urlInput.focus();
      urlInput.select();
    });
  }

  function insertMarkdownImage() {
    const modal = document.getElementById('image-modal');
    const uploadOption = document.getElementById('image-source-upload');
    const urlOption = document.getElementById('image-source-url');
    const uploadFields = document.getElementById('image-upload-fields');
    const urlFields = document.getElementById('image-url-fields');
    const fileInput = document.getElementById('image-modal-file');
    const urlInput = document.getElementById('image-modal-url');
    const altInput = document.getElementById('image-modal-alt');
    const confirmBtn = document.getElementById('image-modal-insert');
    const cancelBtn = document.getElementById('image-modal-cancel');
    if (!modal || !uploadOption || !urlOption || !uploadFields || !urlFields || !fileInput || !urlInput || !altInput || !confirmBtn || !cancelBtn) return;
    const start = markdownEditor.selectionStart;
    const end = markdownEditor.selectionEnd;
    const selected = markdownEditor.value.slice(start, end);
    urlInput.value = 'https://';
    altInput.value = selected || '';
    fileInput.value = '';
    urlOption.checked = true;
    uploadOption.checked = false;
    modal.style.display = 'flex';

    function buildImageMarkdown(url) {
      const titleText = altInput.value.trim();
      const altText = titleText || 'alt text';
      const safeTitle = sanitizeMarkdownTitle(titleText);
      const titlePart = safeTitle ? ' "' + safeTitle + '"' : '';
      return '![' + altText + '](' + url + titlePart + ')';
    }

    function insertImage(url) {
      const safeUrl = url.trim() || 'https://';
      const replacement = buildImageMarkdown(safeUrl);
      modal.style.display = 'none';
      cleanup();
      replaceEditorRange(start, end, replacement, start + replacement.length, start + replacement.length);
    }

    function insertFromFile(file) {
      const objectUrl = URL.createObjectURL(file);
      imageObjectUrls.add(objectUrl);
      insertImage(objectUrl);
    }

    function updateMode(shouldFocus) {
      const isUpload = uploadOption.checked;
      uploadFields.style.display = isUpload ? 'flex' : 'none';
      urlFields.style.display = isUpload ? 'none' : 'flex';
      if (shouldFocus) {
        requestAnimationFrame(function() {
          if (isUpload) {
            fileInput.focus();
          } else {
            urlInput.focus();
            urlInput.select();
          }
        });
      }
    }

    function onModeChange() {
      updateMode(true);
    }

    function onFileChange() {
      const file = fileInput.files && fileInput.files[0];
      if (file) {
        insertFromFile(file);
      }
    }

    function onKey(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (uploadOption.checked) {
          const file = fileInput.files && fileInput.files[0];
          if (file) insertFromFile(file);
          else fileInput.click();
        } else {
          insertImage(urlInput.value);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    }

    function closeModal() {
      modal.style.display = 'none';
      cleanup();
    }

    function cleanup() {
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', closeModal);
      uploadOption.removeEventListener('change', onModeChange);
      urlOption.removeEventListener('change', onModeChange);
      fileInput.removeEventListener('change', onFileChange);
      fileInput.removeEventListener('keydown', onKey);
      urlInput.removeEventListener('keydown', onKey);
      altInput.removeEventListener('keydown', onKey);
    }

    function onConfirm() {
      if (uploadOption.checked) {
        const file = fileInput.files && fileInput.files[0];
        if (file) insertFromFile(file);
        else fileInput.click();
      } else {
        insertImage(urlInput.value);
      }
    }

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', closeModal);
    uploadOption.addEventListener('change', onModeChange);
    urlOption.addEventListener('change', onModeChange);
    fileInput.addEventListener('change', onFileChange);
    fileInput.addEventListener('keydown', onKey);
    urlInput.addEventListener('keydown', onKey);
    altInput.addEventListener('keydown', onKey);
    updateMode(true);
  }

  function insertMarkdownReference() {
    const modal = document.getElementById('reference-modal');
    const numberInput = document.getElementById('reference-modal-number');
    const urlInput = document.getElementById('reference-modal-url');
    const titleInput = document.getElementById('reference-modal-title-input');
    const confirmBtn = document.getElementById('reference-modal-apply');
    const cancelBtn = document.getElementById('reference-modal-cancel');
    if (!modal || !numberInput || !urlInput || !titleInput || !confirmBtn || !cancelBtn) return;
    const start = markdownEditor.selectionStart;
    const end = markdownEditor.selectionEnd;
    const currentValue = markdownEditor.value;
    const used = getUsedReferenceNumbers(currentValue);
    const maxUsed = used.size ? Math.max(...used) : 0;
    referenceCounter = Math.max(1, maxUsed + 1);
    const suggestedNumber = getNextAvailableReferenceNumber(used, referenceCounter);
    numberInput.value = '[' + suggestedNumber + ']';
    urlInput.value = 'https://';
    titleInput.value = '';
    modal.style.display = 'flex';

    function insertReference() {
      const latestValue = markdownEditor.value;
      const usedNumbers = getUsedReferenceNumbers(latestValue);
      const parsed = parseInt(numberInput.value.replace(/[^\d]/g, ''), 10);
      const baseNumber = Number.isNaN(parsed) ? suggestedNumber : parsed;
      const finalNumber = getNextAvailableReferenceNumber(usedNumbers, baseNumber);
      const url = urlInput.value.trim() || 'https://';
      const title = titleInput.value.trim();
      const safeTitle = sanitizeMarkdownTitle(title);
      const definition = '[' + finalNumber + ']: ' + url + (safeTitle ? ' "' + safeTitle + '"' : '');
      const selected = latestValue.slice(start, end);
      const inlineReference = selected + '[' + finalNumber + ']';
      const baseValue = latestValue.slice(0, start) + inlineReference + latestValue.slice(end);
      let separator = '';
      if (baseValue.length && !baseValue.endsWith('\n')) {
        separator = '\n';
      }
      const updatedValue = baseValue + separator + definition;
      markdownEditor.value = updatedValue;
      markdownEditor.focus();
      const caret = start + inlineReference.length;
      markdownEditor.setSelectionRange(caret, caret);
      markdownEditor.dispatchEvent(new Event('input', { bubbles: true }));
      referenceCounter = Math.max(referenceCounter, finalNumber + 1);
      modal.style.display = 'none';
      cleanup();
    }

    function closeModal() {
      modal.style.display = 'none';
      cleanup();
    }

    function onKey(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        insertReference();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    }

    function cleanup() {
      confirmBtn.removeEventListener('click', insertReference);
      cancelBtn.removeEventListener('click', closeModal);
      numberInput.removeEventListener('keydown', onKey);
      urlInput.removeEventListener('keydown', onKey);
      titleInput.removeEventListener('keydown', onKey);
    }

    confirmBtn.addEventListener('click', insertReference);
    cancelBtn.addEventListener('click', closeModal);
    numberInput.addEventListener('keydown', onKey);
    urlInput.addEventListener('keydown', onKey);
    titleInput.addEventListener('keydown', onKey);

    requestAnimationFrame(function() {
      numberInput.focus();
      numberInput.select();
    });
  }

  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function getFocusableElements(container) {
    return Array.from(container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter(element => !element.disabled && element.offsetParent !== null);
  }

  function trapFocusInModal(modal, event) {
    const focusable = getFocusableElements(modal);
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function openAppModal(modal, options = {}) {
    if (!modal) return;
    if (activeModal && activeModal !== modal) {
      closeAppModal(activeModal);
    }
    lastFocusedElement = document.activeElement;
    modal.style.display = 'flex';
    requestAnimationFrame(function() {
      modal.classList.add('is-visible');
    });
    modal.setAttribute('aria-hidden', 'false');
    activeModal = modal;
    const focusTarget = options.focusTarget || getFocusableElements(modal)[0];
    if (focusTarget) {
      focusTarget.focus();
    }
    const handleKeydown = function(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (options.onClose) {
          options.onClose();
        } else {
          closeAppModal(modal);
        }
      } else if (event.key === 'Tab') {
        trapFocusInModal(modal, event);
      }
    };
    const handlePointerDown = function(event) {
      if (event.target === modal) {
        if (options.onClose) {
          options.onClose();
        } else {
          closeAppModal(modal);
        }
      }
    };
    modal.addEventListener('keydown', handleKeydown);
    modal.addEventListener('mousedown', handlePointerDown);
    modal._modalHandlers = { handleKeydown, handlePointerDown };
  }

  function closeAppModal(modal) {
    if (!modal) return;
    modal.classList.remove('is-visible');
    modal.setAttribute('aria-hidden', 'true');
    const handlers = modal._modalHandlers || {};
    if (handlers.handleKeydown) modal.removeEventListener('keydown', handlers.handleKeydown);
    if (handlers.handlePointerDown) modal.removeEventListener('mousedown', handlers.handlePointerDown);
    if (activeModal === modal) activeModal = null;
    window.setTimeout(function() {
      if (!modal.classList.contains('is-visible')) {
        modal.style.display = 'none';
      }
    }, 200);
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }

  function updateFindHighlights() {
    updatePreviewFindHighlights();

    if (!editorHighlightLayer) return;
    if (!isEditorVisible()) return;
    if (!isFindModalOpen || !findReplaceInput || !findReplaceInput.value || !findMatches.length) {
      if (editorHighlightLayer.textContent !== '') {
        editorHighlightLayer.textContent = '';
      }
      return;
    }
    const text = markdownEditor.value || '';
    const scrollTop = cachedScrollTop;
    const scrollLeft = cachedScrollLeft;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    findMatches.forEach(function(match, index) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.start)));
      const mark = document.createElement('mark');
      mark.className = 'find-highlight' + (index === activeFindIndex ? ' active' : '');
      mark.textContent = text.slice(match.start, match.end);
      fragment.appendChild(mark);
      lastIndex = match.end;
    });
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    editorHighlightLayer.textContent = '';
    editorHighlightLayer.appendChild(fragment);
    editorHighlightLayer.scrollTop = scrollTop;
    editorHighlightLayer.scrollLeft = scrollLeft;
  }

  let previewHighlights = [];
  let activePreviewHighlightIndex = -1;

  function isPreviewVisible() {
    return currentViewMode === 'preview' || currentViewMode === 'split';
  }

  function clearPreviewFindHighlights() {
    if (!markdownPreview) return;
    const highlights = markdownPreview.querySelectorAll('.preview-find-highlight');
    highlights.forEach(function(el) {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent), el);
      }
    });
    markdownPreview.normalize();
  }

  function highlightPreviewText(node, regex) {
    if (!node) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const val = node.nodeValue;
      if (!val) return;
      
      regex.lastIndex = 0;
      let match;
      const matches = [];
      while ((match = regex.exec(val)) !== null) {
        if (match[0].length === 0) {
          regex.lastIndex++;
          continue;
        }
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0]
        });
      }
      
      if (matches.length > 0) {
        const parent = node.parentNode;
        if (!parent) return;
        
        const fragment = document.createDocumentFragment();
        let lastIdx = 0;
        
        matches.forEach(function(m) {
          if (m.start > lastIdx) {
            fragment.appendChild(document.createTextNode(val.slice(lastIdx, m.start)));
          }
          const mark = document.createElement('mark');
          mark.className = 'preview-find-highlight';
          mark.textContent = m.text;
          fragment.appendChild(mark);
          lastIdx = m.end;
        });
        
        if (lastIdx < val.length) {
          fragment.appendChild(document.createTextNode(val.slice(lastIdx)));
        }
        
        parent.replaceChild(fragment, node);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      if (tagName === 'script' || tagName === 'style' || tagName === 'textarea' || tagName === 'noscript' || tagName === 'svg') {
        return;
      }
      if (node.classList.contains('mermaid') || node.classList.contains('mjx-container') || node.closest('.mermaid') || node.closest('.mjx-container')) {
        return;
      }
      
      const children = Array.from(node.childNodes);
      children.forEach(function(child) {
        highlightPreviewText(child, regex);
      });
    }
  }

  function updatePreviewFindHighlights() {
    clearPreviewFindHighlights();
    previewHighlights = [];
    
    if (!isFindModalOpen || !findReplaceInput || !findReplaceInput.value || !isPreviewVisible()) {
      return;
    }
    
    const query = findReplaceInput.value;
    const isRegex = document.getElementById('find-regex').classList.contains('active');
    const isCaseSensitive = document.getElementById('find-case').classList.contains('active');
    const isWholeWord = document.getElementById('find-word').classList.contains('active');
    
    let regex;
    try {
      let pattern = isRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (isWholeWord) {
        pattern = `\\b${pattern}\\b`;
      }
      const flags = isCaseSensitive ? 'g' : 'gi';
      regex = new RegExp(pattern, flags);
    } catch (e) {
      return;
    }
    
    highlightPreviewText(markdownPreview, regex);
    previewHighlights = Array.from(markdownPreview.querySelectorAll('.preview-find-highlight'));
    updateActivePreviewHighlight();
  }

  function updateActivePreviewHighlight() {
    previewHighlights.forEach(function(el) {
      el.classList.remove('active');
    });
    
    if (!previewHighlights.length) {
      activePreviewHighlightIndex = -1;
      return;
    }
    
    if (findMatches.length > 0 && activeFindIndex >= 0) {
      const ratio = activeFindIndex / findMatches.length;
      activePreviewHighlightIndex = Math.min(
        previewHighlights.length - 1,
        Math.floor(ratio * previewHighlights.length)
      );
    } else {
      activePreviewHighlightIndex = 0;
    }
    
    if (activePreviewHighlightIndex >= 0 && activePreviewHighlightIndex < previewHighlights.length) {
      const activeEl = previewHighlights[activePreviewHighlightIndex];
      activeEl.classList.add('active');
      scrollPreviewHighlightIntoView(activeEl);
    }
  }

  function scrollPreviewHighlightIntoView(element) {
    if (!element || !previewPane) return;
    const paneRect = previewPane.getBoundingClientRect();
    const elemRect = element.getBoundingClientRect();
    const isVisible = (
      elemRect.top >= paneRect.top + 40 &&
      elemRect.bottom <= paneRect.bottom - 40
    );
    if (!isVisible) {
      const scrollTop = previewPane.scrollTop + (elemRect.top - paneRect.top) - (paneRect.height / 2) + (elemRect.height / 2);
      previewPane.scrollTop = scrollTop;
    }
  }

  function syncHighlightScroll() {
    if (!editorHighlightLayer) return;
    editorHighlightLayer.scrollTop = cachedScrollTop;
    editorHighlightLayer.scrollLeft = cachedScrollLeft;
  }

  function scheduleEditorOverlayScrollSync() {
    if (editorOverlayScrollFrame) return;
    editorOverlayScrollFrame = requestAnimationFrame(function() {
      editorOverlayScrollFrame = null;
      syncHighlightScroll();
      syncLineNumberScroll();
    });
  }

  function updateLineNumberGutter(lineCount) {
    if (!editorPaneElement) return;
    const digits = String(Math.max(1, lineCount)).length;
    const gutterSize = `${Math.max(LINE_NUMBER_GUTTER_MIN_CH, digits + LINE_NUMBER_GUTTER_PADDING_CH)}ch`;
    editorPaneElement.style.setProperty('--line-number-gutter', gutterSize);
  }

  function getLineHeight(styles) {
    const computed = parseFloat(styles.lineHeight);
    if (!Number.isNaN(computed)) return computed;
    const fontSize = parseFloat(styles.fontSize) || 14;
    return fontSize * 1.5;
  }

  function getWrappedLineCountMonospace(lineText, maxCharsPerLine) {
    if (!lineText) return 1;
    const words = lineText.replace(/\t/g, '    ').split(' ');
    let linesCount = 1;
    let currentLineLength = 0;
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordLength = word.length;
      
      if (wordLength === 0) {
        if (currentLineLength + 1 > maxCharsPerLine) {
          linesCount++;
          currentLineLength = 1;
        } else {
          currentLineLength++;
        }
        continue;
      }
      
      if (wordLength > maxCharsPerLine) {
        const remainingSpace = maxCharsPerLine - currentLineLength;
        if (remainingSpace > 0 && currentLineLength > 0) {
          const firstPart = wordLength - remainingSpace;
          linesCount += 1 + Math.floor(firstPart / maxCharsPerLine);
          currentLineLength = firstPart % maxCharsPerLine;
        } else {
          linesCount += Math.floor(wordLength / maxCharsPerLine);
          currentLineLength = wordLength % maxCharsPerLine;
        }
        continue;
      }
      
      const spaceRequired = currentLineLength === 0 ? 0 : 1;
      if (currentLineLength + spaceRequired + wordLength > maxCharsPerLine) {
        linesCount++;
        currentLineLength = wordLength;
      } else {
        currentLineLength += spaceRequired + wordLength;
      }
    }
    
    return Math.max(1, linesCount);
  }

  const lineCache = new Map();
  let cachedPaddingLeft = 10;
  let cachedPaddingRight = 10;
  let cachedCharWidth = 0;
  let cachedLineHeight = 21;
  let cachedEditorWidth = 0;
  let cachedMaxCharsPerLine = 80;
  let cachedScrollTop = 0;
  let cachedScrollLeft = 0;
  let isGeometryInitialized = false;
  let lastLineNumberLineCount = 0;
  let lastLineNumberDocumentLength = 0;

  function countLinesFast(text) {
    if (!text) return 1;
    let count = 1;
    for (let i = 0; i < text.length; i += 1) {
      if (text.charCodeAt(i) === 10) count += 1;
    }
    return count;
  }

  function countLinesBeforeIndex(text, endIndex) {
    let count = 0;
    const max = Math.max(0, Math.min(text.length, endIndex));
    for (let i = 0; i < max; i += 1) {
      if (text.charCodeAt(i) === 10) count += 1;
    }
    return count;
  }

  function initEditorGeometry() {
    if (!markdownEditor) return;
    const styles = window.getComputedStyle(markdownEditor);
    cachedPaddingLeft = parseFloat(styles.paddingLeft) || 10;
    cachedPaddingRight = parseFloat(styles.paddingRight) || 10;
    
    // Measure character width
    const testSpan = document.createElement('span');
    testSpan.style.fontFamily = styles.fontFamily;
    testSpan.style.fontSize = styles.fontSize;
    testSpan.style.visibility = 'hidden';
    testSpan.style.position = 'absolute';
    testSpan.style.whiteSpace = 'pre';
    testSpan.textContent = 'a'.repeat(100);
    document.body.appendChild(testSpan);
    cachedCharWidth = testSpan.getBoundingClientRect().width / 100;
    document.body.removeChild(testSpan);
    
    // Calculate line height
    const computed = parseFloat(styles.lineHeight);
    if (!Number.isNaN(computed)) {
      cachedLineHeight = computed;
    } else {
      const fontSize = parseFloat(styles.fontSize) || 14;
      cachedLineHeight = fontSize * 1.5;
    }
    
    isGeometryInitialized = true;
    lineCache.clear();
  }

  function refreshEditorWidth() {
    if (!markdownEditor) return;
    if (!isGeometryInitialized) {
      initEditorGeometry();
    }
    cachedEditorWidth = markdownEditor.clientWidth;
    const availableWidth = cachedEditorWidth - cachedPaddingLeft - cachedPaddingRight;
    const nextMaxCharsPerLine = Math.max(1, Math.floor(availableWidth / cachedCharWidth));
    if (nextMaxCharsPerLine !== cachedMaxCharsPerLine) {
      cachedMaxCharsPerLine = nextMaxCharsPerLine;
      lineCache.clear();
    }
    
    cachedScrollTop = markdownEditor.scrollTop;
    cachedScrollLeft = markdownEditor.scrollLeft;
  }

  function updateLineNumberItem(item, index, lineText, lineHeight) {
    if (!item) return;
    let wrapHeight = lineCache.get(lineText);
    if (wrapHeight === undefined) {
      const wrapCount = getWrappedLineCountMonospace(lineText, cachedMaxCharsPerLine);
      wrapHeight = wrapCount * lineHeight;
      if (lineCache.size >= LINE_CACHE_MAX_ENTRIES) {
        lineCache.clear();
      }
      lineCache.set(lineText, wrapHeight);
    }

    const targetText = String(index + 1);
    if (item.textContent !== targetText) {
      item.textContent = targetText;
    }
    const targetHeight = `${wrapHeight}px`;
    if (item.style.height !== targetHeight) {
      item.style.height = targetHeight;
    }
  }

  function updateActiveLineNumberHeight(text, lineCount, lineHeight) {
    const caret = markdownEditor.selectionStart || 0;
    const lineIndex = Math.min(lineCount - 1, countLinesBeforeIndex(text, caret));
    const lineStart = text.lastIndexOf('\n', Math.max(0, caret - 1)) + 1;
    const lineEndIndex = text.indexOf('\n', caret);
    const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex;
    updateLineNumberItem(lineNumbers.children[lineIndex], lineIndex, text.slice(lineStart, lineEnd), lineHeight);
  }

  function updateLineNumbers(options) {
    const opts = options || {};
    if (!lineNumbers || !markdownEditor) return;
    if (!isEditorVisible()) return;
    const text = markdownEditor.value || '';
    const lineCount = countLinesFast(text);

    if (cachedEditorWidth === 0) {
      refreshEditorWidth();
    }

    updateLineNumberGutter(lineCount);
    const lineHeight = cachedLineHeight;

    const existingItems = lineNumbers.children;
    const existingCount = existingItems.length;
    const isLargeEditorDocument = text.length >= LARGE_DOCUMENT_THRESHOLD;
    const canUseActiveLineFastPath =
      isLargeEditorDocument &&
      !opts.force &&
      lineCount === lastLineNumberLineCount &&
      existingCount === lineCount;

    if (canUseActiveLineFastPath) {
      updateActiveLineNumberHeight(text, lineCount, lineHeight);
      lastLineNumberDocumentLength = text.length;
      syncLineNumberScroll();
      return;
    }

    const lines = text.split('\n');

    // Adjust the number of DOM elements in-place to avoid complete tear-down
    if (existingCount < lineCount) {
      const fragment = document.createDocumentFragment();
      for (let i = existingCount; i < lineCount; i += 1) {
        const lineNumber = document.createElement('div');
        lineNumber.className = 'line-number';
        fragment.appendChild(lineNumber);
      }
      lineNumbers.appendChild(fragment);
    } else if (existingCount > lineCount) {
      while (lineNumbers.children.length > lineCount) {
        lineNumbers.removeChild(lineNumbers.lastChild);
      }
    }

    // Update only the heights and numbers that changed, using monospace simulator to avoid forced reflows
    for (let i = 0; i < lineCount; i += 1) {
      updateLineNumberItem(existingItems[i], i, lines[i], lineHeight);
    }

    lastLineNumberLineCount = lineCount;
    lastLineNumberDocumentLength = text.length;
    syncLineNumberScroll();
  }

  function scheduleLineNumberUpdate(options) {
    const opts = options || {};
    if (!lineNumbers) return;
    if (!isEditorVisible()) return;

    if (opts.force) {
      if (lineNumberUpdateTimeout) {
        clearTimeout(lineNumberUpdateTimeout);
        lineNumberUpdateTimeout = null;
      }
      if (lineNumberUpdateFrame) {
        cancelAnimationFrame(lineNumberUpdateFrame);
        lineNumberUpdateFrame = null;
      }
    } else if (lineNumberUpdateFrame || lineNumberUpdateTimeout) {
      return;
    }

    const text = markdownEditor ? markdownEditor.value || '' : '';
    const delay = opts.delay !== undefined
      ? opts.delay
      : (opts.inputType === 'insertFromPaste' || text.length >= LARGE_DOCUMENT_THRESHOLD ? getEditorWorkDelay(text) : 0);

    const runUpdate = function() {
      lineNumberUpdateFrame = window.requestAnimationFrame(function() {
        lineNumberUpdateFrame = null;
        updateLineNumbers(opts);
      });
    };

    if (delay > 0) {
      lineNumberUpdateTimeout = setTimeout(function() {
        lineNumberUpdateTimeout = null;
        runUpdate();
      }, delay);
    } else {
      runUpdate();
    }
  }

  function syncLineNumberScroll() {
    if (!lineNumbers) return;
    lineNumbers.scrollTop = cachedScrollTop;
  }

  function syncEditorScrollOverlays() {
    cachedScrollTop = markdownEditor.scrollTop;
    cachedScrollLeft = markdownEditor.scrollLeft;
    syncHighlightScroll();
    syncLineNumberScroll();
  }

  function clampEditorScrollTop(scrollTop) {
    const maxScrollTop = Math.max(0, markdownEditor.scrollHeight - markdownEditor.clientHeight);
    return Math.min(maxScrollTop, Math.max(0, scrollTop));
  }

  function estimateEditorOffsetForIndex(index) {
    if (!isGeometryInitialized || cachedEditorWidth !== markdownEditor.clientWidth) {
      refreshEditorWidth();
    }

    const styles = window.getComputedStyle(markdownEditor);
    const paddingTop = parseFloat(styles.paddingTop) || 10;
    const textBefore = (markdownEditor.value || '').slice(0, Math.max(0, index));
    const lines = textBefore.split('\n');
    let visualRows = 0;

    for (let i = 0; i < lines.length - 1; i += 1) {
      visualRows += getWrappedLineCountMonospace(lines[i], cachedMaxCharsPerLine);
    }

    const currentLinePrefix = lines[lines.length - 1] || '';
    visualRows += Math.max(0, getWrappedLineCountMonospace(currentLinePrefix, cachedMaxCharsPerLine) - 1);
    return paddingTop + (visualRows * cachedLineHeight);
  }

  function getActiveFindHighlight() {
    if (!editorHighlightLayer) return null;
    return editorHighlightLayer.querySelector('.find-highlight.active');
  }

  function scrollActiveMatchIntoView(match) {
    let matchTop = null;
    let matchHeight = cachedLineHeight;
    let activeHighlight = getActiveFindHighlight();

    if (!activeHighlight) {
      updateFindHighlights();
      activeHighlight = getActiveFindHighlight();
    }

    if (activeHighlight) {
      matchTop = activeHighlight.offsetTop;
      matchHeight = activeHighlight.offsetHeight || matchHeight;
    } else {
      matchTop = estimateEditorOffsetForIndex(match.start);
    }

    const targetScrollTop = clampEditorScrollTop(
      matchTop - (markdownEditor.clientHeight / 2) + (matchHeight / 2)
    );

    markdownEditor.scrollTop = targetScrollTop;
    syncEditorScrollOverlays();
  }

  // Class encapsulating Search & Replace Engine
  class FindReplaceEngine {
    constructor(editor) {
      this.editor = editor;
      this.history = { find: [], replace: [] };
      this.activeMatches = [];
      this.currentMatchIndex = -1;
      this._cachedScopeText = null;
      this._cachedScopeMap = null;
    }

    buildASTScopeMap(text) {
      // PERF-026: Cache scope map to avoid re-lexing on every search keystroke
      if (text === this._cachedScopeText && this._cachedScopeMap) {
        return this._cachedScopeMap;
      }
      if (typeof marked === 'undefined' || !marked.lexer) return [];
      try {
        const tokens = marked.lexer(text);
        const scopeMap = [];
        let currentIndex = 0;

        const traverse = (tokenList) => {
          for (const token of tokenList) {
            const start = text.indexOf(token.raw, currentIndex);
            if (start === -1) continue;
            const end = start + token.raw.length;
            currentIndex = end;

            let scope = 'plain';
            if (token.type === 'heading') scope = 'heading';
            else if (token.type === 'code') {
              if (token.lang === 'mermaid') scope = 'mermaid';
              else scope = 'code';
            } else if (token.type === 'paragraph' && token.raw.startsWith('$$') && token.raw.endsWith('$$')) {
              scope = 'latex';
            }

            scopeMap.push({ start, end, scope, type: token.type });
            if (token.tokens) traverse(token.tokens);
          }
        };

        traverse(tokens);
        this._cachedScopeText = text;
        this._cachedScopeMap = scopeMap;
        return scopeMap;
      } catch (e) {
        console.warn("AST scope parsing failed:", e);
        return [];
      }
    }

    compileRegExp(query, isRegex, isCaseSensitive, isWholeWord) {
      if (!query) return null;
      let pattern = isRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (isWholeWord) {
        pattern = `\\b${pattern}\\b`;
      }
      const flags = isCaseSensitive ? 'gd' : 'gid';
      return new RegExp(pattern, flags);
    }

    executeSearch(options) {
      const { query, isRegex, isCaseSensitive, isWholeWord, scopeFilter, findInSelection } = options;
      const fullText = this.editor.value || '';
      
      let searchRange = { start: 0, end: fullText.length };
      if (findInSelection) {
        searchRange.start = this.editor.selectionStart;
        searchRange.end = this.editor.selectionEnd;
      }

      let regex;
      try {
        regex = this.compileRegExp(query, isRegex, isCaseSensitive, isWholeWord);
      } catch (err) {
        throw new Error(err.message);
      }

      if (!regex) {
        this.activeMatches = [];
        this.currentMatchIndex = -1;
        return this.activeMatches;
      }

      const rawMatches = [];
      let match;
      
      while ((match = regex.exec(fullText)) !== null) {
        if (match.index >= searchRange.end) break;
        if (match.index >= searchRange.start) {
          rawMatches.push({
            start: match.index,
            end: match.index + match[0].length,
            value: match[0],
            groups: match.groups || null,
            matchArray: match
          });
        }
        if (regex.lastIndex === match.index) {
          regex.lastIndex++;
        }
      }

      if (scopeFilter && scopeFilter !== 'entire') {
        const scopeMap = this.buildASTScopeMap(fullText);
        this.activeMatches = rawMatches.filter(m => {
          const matchingScope = scopeMap.find(s => m.start >= s.start && m.end <= s.end);
          return matchingScope && matchingScope.scope === scopeFilter;
        });
      } else {
        this.activeMatches = rawMatches;
      }

      this.currentMatchIndex = this.activeMatches.length > 0 ? 0 : -1;
      this.addHistory('find', query);
      return this.activeMatches;
    }

    preserveCase(source, replacement) {
      if (source === source.toUpperCase()) {
        return replacement.toUpperCase();
      }
      if (source === source.toLowerCase()) {
        return replacement.toLowerCase();
      }
      if (source[0] === source[0].toUpperCase() && source.slice(1) === source.slice(1).toLowerCase()) {
        return replacement[0].toUpperCase() + replacement.slice(1).toLowerCase();
      }
      return replacement;
    }

    applyCaptureGroups(match, replacementTemplate) {
      if (!match.matchArray) return replacementTemplate;
      let result = replacementTemplate;
      
      result = result.replace(/\$(\d+)/g, (m, number) => {
        const idx = parseInt(number, 10);
        return match.matchArray[idx] !== undefined ? match.matchArray[idx] : m;
      });

      if (match.groups) {
        result = result.replace(/\$<([^>]+)>/g, (m, name) => {
          return match.groups[name] !== undefined ? match.groups[name] : m;
        });
      }

      return result;
    }

    executeReplace(match, replacementTemplate, options) {
      const { preserveCase, isRegex } = options;
      const text = this.editor.value;

      let finalReplacement = replacementTemplate;
      if (isRegex) {
        finalReplacement = this.applyCaptureGroups(match, finalReplacement);
      }
      if (preserveCase) {
        finalReplacement = this.preserveCase(match.value, finalReplacement);
      }

      const before = text.slice(0, match.start);
      const after = text.slice(match.end);
      this.editor.value = before + finalReplacement + after;
      this.editor.dispatchEvent(new Event('input', { bubbles: true }));

      this.addHistory('replace', replacementTemplate);
      return finalReplacement.length - match.value.length;
    }

    addHistory(type, query) {
      if (!query) return;
      const list = this.history[type];
      const index = list.indexOf(query);
      if (index !== -1) {
        list.splice(index, 1);
      }
      list.unshift(query);
      if (list.length > 10) {
        list.pop();
      }
    }
  }

  // Verification helper for rich text blocks
  function validateBlockSyntax(originalBlockText, newBlockText, scope) {
    if (scope === 'latex') {
      const origDisplay = (originalBlockText.match(/\$\$/g) || []).length;
      const newDisplay = (newBlockText.match(/\$\$/g) || []).length;
      const origInline = (originalBlockText.match(/[^\$]\$[^\$]/g) || []).length;
      const newInline = (newBlockText.match(/[^\$]\$[^\$]/g) || []).length;

      if (origDisplay !== newDisplay || origInline !== newInline) {
        return { valid: false, reason: "LaTeX math block delimiters are unbalanced." };
      }
    }

    if (scope === 'mermaid') {
      const diagramTypePattern = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram-v2|erDiagram|gantt|pie|quadrantChart|c4Context|mindmap|timeline|zenuml)/i;
      if (!diagramTypePattern.test(newBlockText.trim())) {
        return { valid: false, reason: "Missing diagram type definition (e.g. flowchart TD)." };
      }
    }
    return { valid: true };
  }

  // Global Engine Instance
  let frEngine = null;
  let isFrDocked = false;
  let dragOffset = { x: 0, y: 0 };
  let isPanelDragging = false;
  let lastFloatingLeft = null;
  let lastFloatingTop = null;
  let lastFloatingRight = null;

  function initFindReplacePanelDrag() {
    const handle = document.getElementById('find-replace-drag-handle');
    const panel = document.getElementById('find-replace-modal');
    if (!handle || !panel) return;

    const startDrag = (clientX, clientY) => {
      isPanelDragging = true;
      dragOffset.x = clientX - panel.offsetLeft;
      dragOffset.y = clientY - panel.offsetTop;
      document.body.classList.add('resizing');
    };

    const moveDrag = (clientX, clientY) => {
      const x = clientX - dragOffset.x;
      const y = clientY - dragOffset.y;
      
      // Keep panel inside viewport boundaries
      const maxX = window.innerWidth - panel.offsetWidth;
      const maxY = window.innerHeight - panel.offsetHeight;
      const newLeft = `${Math.max(0, Math.min(maxX, x))}px`;
      const newTop = `${Math.max(0, Math.min(maxY, y))}px`;
      panel.style.left = newLeft;
      panel.style.top = newTop;
      panel.style.right = 'auto';

      lastFloatingLeft = newLeft;
      lastFloatingTop = newTop;
      lastFloatingRight = 'auto';
    };

    const stopDrag = () => {
      if (isPanelDragging) {
        isPanelDragging = false;
        document.body.classList.remove('resizing');
      }
    };

    // Mouse events
    handle.addEventListener('mousedown', (e) => {
      if (isFrDocked) return;
      if (window.innerWidth < 768) return; // Do NOT allow dragging on mobile layouts
      if (e.target.closest('.find-replace-header-actions')) return;
      startDrag(e.clientX, e.clientY);
    });

    document.addEventListener('mousemove', (e) => {
      if (!isPanelDragging || isFrDocked) return;
      moveDrag(e.clientX, e.clientY);
    });

    document.addEventListener('mouseup', stopDrag);

    // Touch events for tablets
    handle.addEventListener('touchstart', (e) => {
      if (isFrDocked) return;
      if (window.innerWidth < 768) return; // Do NOT allow dragging on mobile layouts
      if (e.target.closest('.find-replace-header-actions')) return;
      if (e.touches && e.touches[0]) {
        startDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!isPanelDragging || isFrDocked) return;
      if (e.touches && e.touches[0]) {
        moveDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    document.addEventListener('touchend', stopDrag);
  }

  let frPreferredDocked = false;

  function toggleFrDockMode(forceFloat = false) {
    // If forceFloat is an Event (e.g. from click listener directly), treat as false
    if (forceFloat instanceof Event || (forceFloat && typeof forceFloat === 'object')) {
      forceFloat = false;
    }

    const panel = document.getElementById('find-replace-modal');
    const dockBtn = document.getElementById('find-replace-dock');
    const contentCont = document.querySelector('.content-container');
    if (!panel || !dockBtn || !contentCont) return;

    // Save active element focus and selection before DOM movement
    const activeEl = document.activeElement;
    const activeId = activeEl ? activeEl.id : null;
    const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA');
    let selStart = 0;
    let selEnd = 0;
    if (isInput && typeof activeEl.selectionStart === 'number') {
      selStart = activeEl.selectionStart;
      selEnd = activeEl.selectionEnd;
    }

    if (window.innerWidth < 1080 || forceFloat) {
      isFrDocked = false;
      panel.classList.remove('docked');
      if (panel.parentElement !== document.body) {
        document.body.appendChild(panel);
      }
      contentCont.classList.remove('fr-docked');
      contentCont.style.setProperty('--dock-width', '0px');

      panel.style.left = lastFloatingLeft !== null ? lastFloatingLeft : '';
      panel.style.top = lastFloatingTop !== null ? lastFloatingTop : '';
      panel.style.right = lastFloatingRight !== null ? lastFloatingRight : '';
      
      dockBtn.innerHTML = '<i class="bi bi-layout-sidebar-reverse"></i>';
      dockBtn.title = "Toggle Dock Mode";
      
      panel.style.display = 'flex';
      applyPaneWidths();
      
      // Restore focus and selection
      if (activeId) {
        const el = document.getElementById(activeId);
        if (el) {
          el.focus();
          if (isInput && typeof el.selectionStart === 'number') {
            el.setSelectionRange(selStart, selEnd);
          }
        }
      }
      return;
    }

    isFrDocked = !isFrDocked;
    
    // Save preference to localStorage
    frPreferredDocked = isFrDocked;
    saveStorageItem('find-replace-docked', frPreferredDocked ? 'true' : 'false');

    if (isFrDocked) {
      panel.classList.add('docked');
      panel.style.left = 'auto';
      panel.style.top = 'auto';
      panel.style.right = 'auto';
      
      // Append panel to dock container (.content-container)
      contentCont.appendChild(panel);
      contentCont.classList.add('fr-docked');
      contentCont.style.setProperty('--dock-width', '340px');

      dockBtn.innerHTML = '<i class="bi bi-window"></i>';
      dockBtn.title = "Toggle Floating Mode";
    } else {
      panel.classList.remove('docked');
      
      // Reset position and float on body
      document.body.appendChild(panel);
      contentCont.classList.remove('fr-docked');
      contentCont.style.setProperty('--dock-width', '0px');

      panel.style.left = lastFloatingLeft !== null ? lastFloatingLeft : '';
      panel.style.top = lastFloatingTop !== null ? lastFloatingTop : '';
      panel.style.right = lastFloatingRight !== null ? lastFloatingRight : '';
      
      dockBtn.innerHTML = '<i class="bi bi-layout-sidebar-reverse"></i>';
      dockBtn.title = "Toggle Dock Mode";
    }
    
    // Ensure display is flex and recalculate split panes
    panel.style.display = 'flex';
    applyPaneWidths();

    // Restore focus and selection after layout change
    if (activeId) {
      const el = document.getElementById(activeId);
      if (el) {
        el.focus();
        if (isInput && typeof el.selectionStart === 'number') {
          el.setSelectionRange(selStart, selEnd);
        }
      }
    }
  }

  function updateFindControls() {
    const total = findMatches.length;
    const current = total && activeFindIndex >= 0 ? activeFindIndex + 1 : 0;
    
    const countSpan = document.getElementById('find-replace-count');
    if (countSpan) {
      countSpan.textContent = `${current} of ${total} matches`;
    }

    const prevBtn = document.getElementById('find-prev');
    const nextBtn = document.getElementById('find-next');
    const replaceCurrentBtn = document.getElementById('find-replace-current');
    const replaceAllBtn = document.getElementById('find-replace-all');

    const hasMatches = total > 0;
    const hasQuery = !!(findReplaceInput && findReplaceInput.value);

    if (prevBtn) prevBtn.disabled = !hasMatches;
    if (nextBtn) nextBtn.disabled = !hasMatches;
    if (replaceCurrentBtn) replaceCurrentBtn.disabled = !hasMatches;
    if (replaceAllBtn) replaceAllBtn.disabled = !hasQuery || !hasMatches;
  }

  function refreshFindMatches(options) {
    clearTimeout(findRefreshTimeout);
    findRefreshTimeout = null;
    const opts = options || {};
    const query = findReplaceInput ? findReplaceInput.value : '';
    const errorBox = document.getElementById('find-replace-error');
    const errorMsg = document.getElementById('regex-error-msg');

    if (errorBox) errorBox.style.display = 'none';

    if (!isFindModalOpen || !query) {
      findMatches = [];
      activeFindIndex = -1;
      updateFindControls();
      updateFindHighlights();
      return;
    }

    const isRegex = document.getElementById('find-regex').classList.contains('active');
    const isCaseSensitive = document.getElementById('find-case').classList.contains('active');
    const isWholeWord = document.getElementById('find-word').classList.contains('active');
    const scopeFilter = document.getElementById('find-replace-scope').value;
    const findInSelection = document.getElementById('find-sel').classList.contains('active');

    try {
      findMatches = frEngine.executeSearch({
        query,
        isRegex,
        isCaseSensitive,
        isWholeWord,
        scopeFilter,
        findInSelection
      });
    } catch (err) {
      findMatches = [];
      activeFindIndex = -1;
      if (errorBox && errorMsg) {
        errorMsg.textContent = err.message;
        errorBox.style.display = 'block';
      }
    }

    const shouldResetActiveIndex = opts.resetIndex || query !== lastFindQuery;
    if (shouldResetActiveIndex) {
      activeFindIndex = findMatches.length ? 0 : -1;
    } else if (activeFindIndex >= findMatches.length) {
      activeFindIndex = findMatches.length - 1;
    }
    lastFindQuery = query;
    updateFindControls();
    updateFindHighlights();
    if (shouldResetActiveIndex && findMatches.length && activeFindIndex >= 0) {
      scrollActiveMatchIntoView(findMatches[activeFindIndex]);
    }
    updateHistoryDropdowns();
  }

  function scheduleFindRefresh(options) {
    clearTimeout(findRefreshTimeout);
    const text = markdownEditor ? markdownEditor.value || '' : '';
    const delay = text.length >= LARGE_DOCUMENT_THRESHOLD ? LARGE_FIND_REFRESH_DELAY : FIND_REFRESH_DELAY;
    findRefreshTimeout = setTimeout(function() {
      findRefreshTimeout = null;
      refreshFindMatches(options);
    }, delay);
  }

  function selectActiveMatch() {
    if (!findMatches.length || activeFindIndex < 0) return;
    const match = findMatches[activeFindIndex];
    markdownEditor.focus();
    markdownEditor.setSelectionRange(match.start, match.end);

    try {
      scrollActiveMatchIntoView(match);
    } catch (e) {
      console.warn("Viewport centering scroll failed:", e);
    }
  }

  function cycleFindMatch(direction) {
    const totalMatches = findMatches.length;
    if (!totalMatches) return;
    activeFindIndex = (activeFindIndex + direction + totalMatches) % totalMatches;
    updateFindControls();
    updateFindHighlights();
    selectActiveMatch();
  }

  function openFindReplaceModal() {
    if (!findReplaceModal || !findReplaceInput) return;
    
    if (!frEngine) {
      frEngine = new FindReplaceEngine(markdownEditor);
    }

    isFindModalOpen = true;
    const selected = markdownEditor.value.slice(markdownEditor.selectionStart, markdownEditor.selectionEnd);
    if (selected && selected.length < 100) {
      findReplaceInput.value = selected;
    }

    // Restore docked/floating mode preference
    let wasDockedPref = localStorage.getItem('find-replace-docked') === 'true';
    
    // Force floating-only mode on mobile/tablet viewports
    if (window.innerWidth < 1080) {
      wasDockedPref = false;
    }
    
    if (wasDockedPref) {
      isFrDocked = false; // Set false so toggleFrDockMode() turns it to true
      toggleFrDockMode();
    } else {
      isFrDocked = true; // Set true so toggleFrDockMode() turns it to false
      toggleFrDockMode();
    }

    findReplaceModal.style.display = 'flex';
    
    requestAnimationFrame(function() {
      findReplaceInput.focus();
      findReplaceInput.select();
    });
    
    refreshFindMatches({ resetIndex: true });
    if (findMatches.length) {
      selectActiveMatch();
    }
  }

  function closeFindReplaceModal() {
    isFindModalOpen = false;
    const panel = document.getElementById('find-replace-modal');
    const contentCont = document.querySelector('.content-container');
    if (panel) {
      panel.style.display = 'none';
      if (isFrDocked) {
        // Reset split layout styles when closed
        if (contentCont) {
          contentCont.classList.remove('fr-docked');
          contentCont.style.setProperty('--dock-width', '0px');
          applyPaneWidths();
        }
      }
    }
    findMatches = [];
    activeFindIndex = -1;
    updateFindControls();
    updateFindHighlights();
  }

  function replaceCurrentMatch() {
    if (!findMatches.length || activeFindIndex < 0) return;
    const replacement = findReplaceWith ? findReplaceWith.value : '';
    const match = findMatches[activeFindIndex];

    const preserveCase = document.getElementById('replace-preserve-case').classList.contains('active');
    const isRegex = document.getElementById('find-regex').classList.contains('active');

    // Syntax validation
    const scopeFilter = document.getElementById('find-replace-scope').value;
    if (scopeFilter === 'latex' || scopeFilter === 'mermaid') {
      const check = validateBlockSyntax(match.value, replacement, scopeFilter);
      if (!check.valid) {
        alert(`Blocked replacement: ${check.reason}`);
        return;
      }
    }

    frEngine.executeReplace(match, replacement, { preserveCase, isRegex });
    
    refreshFindMatches();
    if (findMatches.length) {
      activeFindIndex = Math.min(activeFindIndex, findMatches.length - 1);
      selectActiveMatch();
    }
  }

  function replaceAllMatches() {
    if (!findMatches.length) return;
    
    const query = findReplaceInput ? findReplaceInput.value : '';
    const replacement = findReplaceWith ? findReplaceWith.value : '';
    const showDiff = document.getElementById('find-replace-diff-toggle').checked;

    if (showDiff) {
      renderDiffPreview();
      return;
    }

    executeBulkReplace();
  }

  function executeBulkReplace() {
    const replacement = findReplaceWith ? findReplaceWith.value : '';
    const preserveCase = document.getElementById('replace-preserve-case').classList.contains('active');
    const isRegex = document.getElementById('find-regex').classList.contains('active');
    
    // Reverse sorting to replace from bottom up
    const matchesCopy = [...findMatches];
    matchesCopy.sort((a, b) => b.start - a.start);

    for (const match of matchesCopy) {
      frEngine.executeReplace(match, replacement, { preserveCase, isRegex });
    }

    refreshFindMatches({ resetIndex: true });
    if (findMatches.length) {
      selectActiveMatch();
    }
  }

  function renderDiffPreview() {
    const container = document.getElementById('find-replace-diff-container');
    const modal = document.getElementById('find-replace-diff-modal');
    if (!container || !modal) return;

    const replacement = findReplaceWith ? findReplaceWith.value : '';
    const preserveCase = document.getElementById('replace-preserve-case').classList.contains('active');
    const isRegex = document.getElementById('find-regex').classList.contains('active');

    const lines = markdownEditor.value.split('\n');
    const matchesCopy = [...findMatches];
    matchesCopy.sort((a, b) => b.start - a.start);

    // Draft the replaced value in memory
    let draftValue = markdownEditor.value;
    for (const match of matchesCopy) {
      let finalRepl = replacement;
      if (isRegex) {
        finalRepl = frEngine.applyCaptureGroups(match, finalRepl);
      }
      if (preserveCase) {
        finalRepl = frEngine.preserveCase(match.value, finalRepl);
      }
      draftValue = draftValue.slice(0, match.start) + finalRepl + draftValue.slice(match.end);
    }

    const draftLines = draftValue.split('\n');

    // PERF-007: Clear elements using textContent
    container.textContent = '';
    const fragment = document.createDocumentFragment();

    const maxLines = Math.max(lines.length, draftLines.length);
    for (let i = 0; i < maxLines; i++) {
      const origLine = lines[i] !== undefined ? lines[i] : null;
      const newLine = draftLines[i] !== undefined ? draftLines[i] : null;

      if (origLine !== newLine) {
        if (origLine !== null) {
          const delLine = document.createElement('div');
          delLine.className = 'diff-line deletion';
          delLine.innerHTML = `<span class="diff-line-num">${i + 1}</span><span class="diff-line-content">- ${escapeHtml(origLine)}</span>`;
          fragment.appendChild(delLine);
        }
        if (newLine !== null) {
          const addLine = document.createElement('div');
          addLine.className = 'diff-line addition';
          addLine.innerHTML = `<span class="diff-line-num">${i + 1}</span><span class="diff-line-content">+ ${escapeHtml(newLine)}</span>`;
          fragment.appendChild(addLine);
        }
      } else if (origLine !== null) {
        // Show context for matching lines to prevent giant blank diff spaces
        // Show context only if it surrounds a modified line
        const hasDiffNearby = Array.from({length: 5}, (_, idx) => i - 2 + idx)
          .some(lineIdx => lines[lineIdx] !== undefined && draftLines[lineIdx] !== undefined && lines[lineIdx] !== draftLines[lineIdx]);
        
        if (hasDiffNearby) {
          const ctxLine = document.createElement('div');
          ctxLine.className = 'diff-line context';
          ctxLine.innerHTML = `<span class="diff-line-num">${i + 1}</span><span class="diff-line-content">  ${escapeHtml(origLine)}</span>`;
          fragment.appendChild(ctxLine);
        }
      }
    }

    container.appendChild(fragment);
    openAppModal(modal, {
      focusTarget: document.getElementById('find-replace-diff-confirm'),
      onClose: () => closeAppModal(modal)
    });
  }

  function updateHistoryDropdowns() {
    const select = document.getElementById('find-replace-history');
    if (!select || !frEngine) return;

    // Preserve the first option
    select.innerHTML = '<option value="">Recent queries...</option>';
    
    frEngine.history.find.forEach(q => {
      const opt = document.createElement('option');
      opt.value = q;
      opt.textContent = q;
      select.appendChild(opt);
    });
  }

  function initFindReplaceModal() {
    const modal = document.getElementById('find-replace-modal');
    if (!modal) return;

    initFindReplacePanelDrag();

    // Toggle options
    const toggleButtons = ['find-case', 'find-word', 'find-regex', 'find-sel', 'replace-preserve-case', 'find-wrap'];
    toggleButtons.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', () => {
          const isActive = btn.classList.contains('active');
          if (isActive) {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
          } else {
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');
          }
          refreshFindMatches({ resetIndex: true });
        });
      }
    });

    // History select handler
    const historySelect = document.getElementById('find-replace-history');
    if (historySelect) {
      historySelect.addEventListener('change', () => {
        if (historySelect.value) {
          findReplaceInput.value = historySelect.value;
          refreshFindMatches({ resetIndex: true });
        }
      });
    }

    // Scope select handler
    const scopeSelect = document.getElementById('find-replace-scope');
    if (scopeSelect) {
      scopeSelect.addEventListener('change', () => {
        refreshFindMatches({ resetIndex: true });
      });
    }

    // Reset position handler
    const resetBtn = document.getElementById('find-replace-reset');
    const resetFooterBtn = document.getElementById('find-replace-reset-footer');
    const doResetPosition = () => {
      lastFloatingLeft = null;
      lastFloatingTop = null;
      lastFloatingRight = null;
      modal.style.left = '';
      modal.style.top = '';
      modal.style.right = '';
    };

    if (resetBtn) {
      resetBtn.addEventListener('click', doResetPosition);
    }
    if (resetFooterBtn) {
      resetFooterBtn.addEventListener('click', doResetPosition);
    }

    // Dock toggle handler
    const dockBtn = document.getElementById('find-replace-dock');
    if (dockBtn) {
      dockBtn.addEventListener('click', () => toggleFrDockMode(false));
    }

    // Advanced Drawer Toggle
    const drawerToggle = document.getElementById('fr-drawer-toggle');
    const drawerContent = document.getElementById('fr-drawer-content');
    if (drawerToggle && drawerContent) {
      drawerToggle.addEventListener('click', () => {
        const isOpen = drawerContent.style.display === 'flex';
        if (isOpen) {
          drawerContent.style.display = 'none';
          drawerToggle.setAttribute('aria-expanded', 'false');
          drawerToggle.innerHTML = '<i class="bi bi-chevron-right me-1"></i> Advanced Options';
        } else {
          drawerContent.style.display = 'flex';
          drawerToggle.setAttribute('aria-expanded', 'true');
          drawerToggle.innerHTML = '<i class="bi bi-chevron-down me-1"></i> Advanced Options';
        }
      });
    }

    // Inputs
    if (findReplaceInput) {
      findReplaceInput.addEventListener('input', function() {
        refreshFindMatches({ resetIndex: true });
      });
      findReplaceInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          cycleFindMatch(event.shiftKey ? -1 : 1);
        }
      });
    }

    if (findReplaceWith) {
      findReplaceWith.addEventListener('input', updateFindControls);
    }

    // Navigation buttons
    const prevBtn = document.getElementById('find-prev');
    const nextBtn = document.getElementById('find-next');
    if (prevBtn) prevBtn.addEventListener('click', () => cycleFindMatch(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => cycleFindMatch(1));

    // Action buttons
    const currentBtn = document.getElementById('find-replace-current');
    const allBtn = document.getElementById('find-replace-all');
    if (currentBtn) currentBtn.addEventListener('click', replaceCurrentMatch);
    if (allBtn) allBtn.addEventListener('click', replaceAllMatches);

    // Close buttons
    const closeBtn = document.getElementById('find-replace-close');
    const closeIcon = document.getElementById('find-replace-close-icon');
    if (closeBtn) closeBtn.addEventListener('click', closeFindReplaceModal);
    if (closeIcon) closeIcon.addEventListener('click', closeFindReplaceModal);

    // Diff modal confirmation triggers
    const diffConfirmBtn = document.getElementById('find-replace-diff-confirm');
    const diffCancelBtn = document.getElementById('find-replace-diff-cancel');
    const diffCloseIcon = document.getElementById('find-replace-diff-close-icon');
    const diffModal = document.getElementById('find-replace-diff-modal');

    if (diffConfirmBtn) {
      diffConfirmBtn.addEventListener('click', () => {
        executeBulkReplace();
        closeAppModal(diffModal);
      });
    }
    if (diffCancelBtn) diffCancelBtn.addEventListener('click', () => closeAppModal(diffModal));
    if (diffCloseIcon) diffCloseIcon.addEventListener('click', () => closeAppModal(diffModal));
  }

  function initAppModals() {
    if (clearFormattingConfirm) {
      clearFormattingConfirm.addEventListener('click', function() {
        applyClearFormatting();
        closeAppModal(clearFormattingModal);
      });
    }
    if (clearFormattingCancel) {
      clearFormattingCancel.addEventListener('click', function() { closeAppModal(clearFormattingModal); });
    }
    if (clearFormattingClose) {
      clearFormattingClose.addEventListener('click', function() { closeAppModal(clearFormattingModal); });
    }
    if (helpModalClose) {
      helpModalClose.addEventListener('click', function() { closeAppModal(helpModal); });
    }
    if (helpModalCloseIcon) {
      helpModalCloseIcon.addEventListener('click', function() { closeAppModal(helpModal); });
    }
    if (aboutModalClose) {
      aboutModalClose.addEventListener('click', function() { closeAppModal(aboutModal); });
    }
    if (aboutModalCloseIcon) {
      aboutModalCloseIcon.addEventListener('click', function() { closeAppModal(aboutModal); });
    }
  }

  function openHelpModal() {
    if (helpModal) {
      openAppModal(helpModal);
    }
  }

  function openAboutModal() {
    if (aboutModal) {
      const aboutVersion = document.getElementById("about-version");
      if (aboutVersion) {
        aboutVersion.textContent = APP_VERSION;
      }
      openAppModal(aboutModal);
    }
  }

  function openClearFormattingModal() {
    if (clearFormattingModal) {
      openAppModal(clearFormattingModal);
    }
  }

  function runMarkdownTool(action, button) {
    if (action === 'undo') {
      executeUndo();
      return;
    }
    if (action === 'redo') {
      executeRedo();
      return;
    }

    if (action === 'bold') wrapEditorSelection('**', '**', 'bold text');
    else if (action === 'strike') wrapEditorSelection('~~', '~~', 'struck text');
    else if (action === 'italic') wrapEditorSelection('*', '*', 'italic text');
    else if (action === 'quote') transformEditorLines(function(line) { return line ? '> ' + line.replace(/^>\s?/, '') : '>'; });
    else if (action === 'align-left') insertAlignmentBlock('left');
    else if (action === 'align-center') insertAlignmentBlock('center');
    else if (action === 'align-right') insertAlignmentBlock('right');
    else if (action === 'title-case') transformSelectionOrCurrentLine(toTitleCase);
    else if (action === 'uppercase') transformSelectionOrCurrentLine(function(text) { return text.toUpperCase(); });
    else if (action === 'lowercase') transformSelectionOrCurrentLine(function(text) { return text.toLowerCase(); });
    else if (action === 'heading') {
      const level = parseInt(button.getAttribute('data-md-level') || '1', 10);
      const marker = '#'.repeat(Math.max(1, Math.min(6, level))) + ' ';
      transformEditorLines(function(line) { return marker + line.replace(/^#{1,6}\s+/, ''); });
    } else if (action === 'unordered-list') {
      applyMarkdownList('unordered');
    } else if (action === 'ordered-list') {
      applyMarkdownList('ordered');
    } else if (action === 'horizontal-rule') insertMarkdownBlock('---\n');
    else if (action === 'link') insertMarkdownLink();
    else if (action === 'reference') insertMarkdownReference();
    else if (action === 'image') insertMarkdownImage();
    else if (action === 'inline-code') wrapEditorSelection('`', '`', 'code');
    else if (action === 'code-block') insertMarkdownBlock('```js\n' + (markdownEditor.value.slice(markdownEditor.selectionStart, markdownEditor.selectionEnd) || 'console.log("Hello, Markdown!");') + '\n```\n');
    else if (action === 'table') openTableModal();
    else if (action === 'date-time') {
      const now = new Date();
      const datePart = now.toLocaleDateString('en-CA');
      const timePart = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
      const timestamp = `${datePart} ${timePart} ${dayName}`;
      replaceEditorRange(markdownEditor.selectionStart, markdownEditor.selectionEnd, timestamp, markdownEditor.selectionStart + timestamp.length, markdownEditor.selectionStart + timestamp.length);
    } else if (action === 'emoji') {
      openEmojiModal();
    }
    else if (action === 'symbols') openSymbolsModal();
    else if (action === 'alert') openAlertModal();
    else if (action === 'diagram') openDiagramModal();
    else if (action === 'terminal-block') insertMarkdownBlock('```bash\nnpm run dev\n```\n');
    else if (action === 'fullscreen') {
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    } else if (action === 'clear-formatting') openClearFormattingModal();
    else if (action === 'find') openFindReplaceModal();
    else if (action === 'help') openHelpModal();
    else if (action === 'info') openAboutModal();
  }

  function initMarkdownFormatToolbar() {
    if (!markdownFormatToolbar) return;
    markdownFormatToolbar.addEventListener('mousedown', function(e) {
      if (e.target.closest('[data-md-action]')) e.preventDefault();
    });
    markdownFormatToolbar.addEventListener('click', function(e) {
      const button = e.target.closest('[data-md-action]');
      if (!button) return;
      e.preventDefault();
      runMarkdownTool(button.getAttribute('data-md-action'), button);
    });
  }

  // Story 1.3: Resize Divider Functions
  function initResizer() {
    if (!resizeDivider) return;

    // Set up WAI-ARIA accessibility tags
    resizeDivider.setAttribute('role', 'separator');
    resizeDivider.setAttribute('aria-orientation', 'vertical');
    resizeDivider.setAttribute('tabindex', '0');
    resizeDivider.setAttribute('aria-valuemin', MIN_PANE_PERCENT.toString());
    resizeDivider.setAttribute('aria-valuemax', (100 - MIN_PANE_PERCENT).toString());
    updateResizerAria();

    resizeDivider.addEventListener('mousedown', startResize);
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);

    // Touch support for tablets (though disabled via CSS, keeping for future)
    resizeDivider.addEventListener('touchstart', startResizeTouch);
    document.addEventListener('touchmove', handleResizeTouch);
    document.addEventListener('touchend', stopResize);

    resizeDivider.addEventListener('keydown', handleResizerKeydown);

    function handleResizerKeydown(e) {
      if (currentViewMode !== 'split') return;
      
      let delta = 0;
      if (e.key === 'ArrowLeft') {
        delta = -5; // Shift left by 5%
      } else if (e.key === 'ArrowRight') {
        delta = 5; // Shift right by 5%
      } else {
        return;
      }
      
      e.preventDefault();
      editorWidthPercent = Math.max(MIN_PANE_PERCENT, Math.min(100 - MIN_PANE_PERCENT, editorWidthPercent + delta));
      applyPaneWidths();
      updateResizerAria();
    }

    function updateResizerAria() {
      resizeDivider.setAttribute('aria-valuenow', Math.round(editorWidthPercent));
    }
  }

  function startResize(e) {
    if (window.innerWidth < 1080) return;
    if (currentViewMode !== 'split') return;
    e.preventDefault();
    isResizing = true;
    resizeDivider.classList.add('dragging');
    document.body.classList.add('resizing');
  }

  function startResizeTouch(e) {
    if (window.innerWidth < 1080) return;
    if (currentViewMode !== 'split') return;
    e.preventDefault();
    isResizing = true;
    resizeDivider.classList.add('dragging');
    document.body.classList.add('resizing');
  }

  function handleResize(e) {
    if (!isResizing) return;

    const containerRect = contentContainer.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const mouseX = e.clientX - containerRect.left;

    // Calculate percentage
    let newEditorPercent = (mouseX / containerWidth) * 100;

    // Enforce minimum pane widths
    newEditorPercent = Math.max(MIN_PANE_PERCENT, Math.min(100 - MIN_PANE_PERCENT, newEditorPercent));

    editorWidthPercent = newEditorPercent;
    applyPaneWidths();
  }

  function handleResizeTouch(e) {
    if (!isResizing || !e.touches[0]) return;

    const containerRect = contentContainer.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const touchX = e.touches[0].clientX - containerRect.left;

    let newEditorPercent = (touchX / containerWidth) * 100;
    newEditorPercent = Math.max(MIN_PANE_PERCENT, Math.min(100 - MIN_PANE_PERCENT, newEditorPercent));

    editorWidthPercent = newEditorPercent;
    applyPaneWidths();
  }

  function stopResize() {
    if (!isResizing) return;
    isResizing = false;
    resizeDivider.classList.remove('dragging');
    document.body.classList.remove('resizing');
  }

  function applyPaneWidths() {
    if (window.innerWidth < 1080) {
      resetPaneWidths();
      return;
    }
    if (currentViewMode !== 'split') return;

    const previewPercent = 100 - editorWidthPercent;
    editorPaneElement.style.flex = `0 0 calc((100% - var(--dock-width, 0px)) * ${editorWidthPercent / 100} - 4px)`;
    previewPaneElement.style.flex = `0 0 calc((100% - var(--dock-width, 0px)) * ${previewPercent / 100} - 4px)`;
    refreshEditorWidth();
    scheduleLineNumberUpdate();
  }

  function resetPaneWidths() {
    editorPaneElement.style.flex = '';
    previewPaneElement.style.flex = '';
    refreshEditorWidth();
  }

  function openMobileMenu() {
    mobileMenuPanel.classList.add("active");
    mobileMenuOverlay.classList.add("active");
  }
  function closeMobileMenu() {
    mobileMenuPanel.classList.remove("active");
    mobileMenuOverlay.classList.remove("active");
  }
  mobileMenuToggle.addEventListener("click", openMobileMenu);
  mobileCloseMenu.addEventListener("click", closeMobileMenu);
  mobileMenuOverlay.addEventListener("click", closeMobileMenu);

  function updateMobileStats() {
    mobileCharCount.textContent   = charCountElement.textContent;
    mobileWordCount.textContent   = wordCountElement.textContent;
    mobileReadingTime.textContent = readingTimeElement.textContent;
  }

  const origUpdateStats = updateDocumentStats;
  updateDocumentStats = function() {
    origUpdateStats();
    updateMobileStats();
  };

  mobileToggleSync.addEventListener("click", () => {
    toggleSyncScrolling();
    if (syncScrollingEnabled) {
      mobileToggleSync.innerHTML = '<i class="bi bi-link-45deg me-2"></i> Sync Off';
      mobileToggleSync.classList.add("sync-disabled");
      mobileToggleSync.classList.remove("sync-enabled");
      mobileToggleSync.classList.add("sync-active");
    } else {
      mobileToggleSync.innerHTML = '<i class="bi bi-link me-2"></i> Sync On';
      mobileToggleSync.classList.add("sync-enabled");
      mobileToggleSync.classList.remove("sync-disabled");
      mobileToggleSync.classList.remove("sync-active");
    }
  });
  mobileImportBtn.addEventListener("click", () => {
    if (typeof Neutralino !== 'undefined') {
      nativeImportMarkdown();
    } else {
      fileInput.click();
    }
  });
  mobileImportGithubBtn.addEventListener("click", () => {
    closeMobileMenu();
    openGitHubImportModal();
  });
  mobileExportMd.addEventListener("click", () => exportMd.click());
  mobileExportHtml.addEventListener("click", () => exportHtml.click());
  mobileExportPdf.addEventListener("click", () => exportPdf.click());
  mobileExportPng.addEventListener("click", () => exportPng.click());
  mobileCopyMarkdown.addEventListener("click", () => copyMarkdownButton.click());
  mobileThemeToggle.addEventListener("click", () => {
    themeToggle.click();
    mobileThemeToggle.innerHTML = themeToggle.innerHTML + " Toggle Dark Mode";
  });

  const mobileNewTabBtn = document.getElementById("mobile-new-tab-btn");
  if (mobileNewTabBtn) {
    mobileNewTabBtn.addEventListener("click", function() {
      newTab();
      closeMobileMenu();
    });
  }

  const mobileTabResetBtn = document.getElementById("mobile-tab-reset-btn");
  if (mobileTabResetBtn) {
    mobileTabResetBtn.addEventListener("click", function() {
      closeMobileMenu();
      resetAllTabs();
    });
  }
  
  initTabs();
  if (loadGlobalState().syncScrollingEnabled === false) toggleSyncScrolling();
  updateMobileStats();
  updateFindHighlights();
  syncHighlightScroll();

  // Defer DOM geometry measurement until after FCP/LCP critical paint path
  setTimeout(function() {
    initEditorGeometry();
    refreshEditorWidth();
    scheduleLineNumberUpdate();
  }, 100);

  // Initialize resizer - Story 1.3
  initResizer();
  function constrainFloatingPanelPosition() {
    const panel = document.getElementById('find-replace-modal');
    if (!panel || isFrDocked || panel.style.display === 'none') return;
    if (window.innerWidth < 768) return; // Mobile layout forces fixed responsive positioning via CSS
    
    // Only adjust if the inline style has custom dragged coordinates
    if (!panel.style.left || panel.style.left === 'auto') return;

    const leftVal = parseFloat(panel.style.left) || 0;
    const topVal = parseFloat(panel.style.top) || 0;
    
    const maxX = window.innerWidth - panel.offsetWidth;
    const maxY = window.innerHeight - panel.offsetHeight;
    
    const constrainedLeft = `${Math.max(0, Math.min(maxX, leftVal))}px`;
    const constrainedTop = `${Math.max(0, Math.min(maxY, topVal))}px`;
    
    panel.style.left = constrainedLeft;
    panel.style.top = constrainedTop;
    
    lastFloatingLeft = constrainedLeft;
    lastFloatingTop = constrainedTop;
  }

  let resizeLayoutTimeout = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeLayoutTimeout);
    resizeLayoutTimeout = setTimeout(function() {
      initEditorGeometry();
      refreshEditorWidth();
      scheduleLineNumberUpdate();
      if (window.innerWidth < 1080 && isFrDocked && isFindModalOpen) {
        toggleFrDockMode(true);
      }
      constrainFloatingPanelPosition();
    }, 100);
  });

  // View Mode Button Event Listeners - Story 1.1
  viewModeButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      const mode = this.getAttribute('data-view-mode');
      setViewMode(resolveViewToggleMode(mode));
      saveCurrentTabState();
    });
  });

  // Story 1.4: Mobile View Mode Button Event Listeners
  mobileViewModeButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      const mode = this.getAttribute('data-mode');
      setViewMode(mode);
      saveCurrentTabState();
      closeMobileMenu();
    });
  });

  markdownEditor.addEventListener("input", function(e) {
    handleKeystrokeHistory(e);
    debouncedRender();
    clearTimeout(saveTabStateTimeout);
    saveTabStateTimeout = setTimeout(saveCurrentTabState, 500);
    if (isFindModalOpen) {
      scheduleFindRefresh();
    } else {
      updateFindHighlights();
    }
    scheduleLineNumberUpdate({
      inputType: e && typeof e.inputType === 'string' ? e.inputType : '',
    });
  });

  markdownEditor.addEventListener('keydown', updateLastCursor);
  markdownEditor.addEventListener('keyup', updateLastCursor);
  markdownEditor.addEventListener('mousedown', updateLastCursor);
  markdownEditor.addEventListener('mouseup', updateLastCursor);
  markdownEditor.addEventListener('focus', updateLastCursor);

  initMarkdownFormatToolbar();
  initFindReplaceModal();
  initAppModals();
  
  // Editor key handlers for list continuation and indentation
  markdownEditor.addEventListener("keydown", function(e) {
    if (handleListEnter(e)) {
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      
      const start = this.selectionStart;
      const end = this.selectionEnd;
      const value = this.value;
      
      // Insert 2 spaces
      const indent = '  '; // 2 spaces
      
      // Update textarea value
      this.value = value.substring(0, start) + indent + value.substring(end);
      
      // Update cursor position
      this.selectionStart = this.selectionEnd = start + indent.length;
      
      // Trigger input event to update preview
      this.dispatchEvent(new Event('input'));
    }
  });
  
  markdownEditor.addEventListener("scroll", function() {
    cachedScrollTop = this.scrollTop;
    cachedScrollLeft = this.scrollLeft;
    syncEditorToPreview();
    scheduleEditorOverlayScrollSync();
  });
  previewPane.addEventListener("scroll", syncPreviewToEditor);
  toggleSyncButton.addEventListener("click", toggleSyncScrolling);
  if (directionToggle) {
    directionToggle.addEventListener("click", function () {
      const currentDir = markdownEditor ? markdownEditor.getAttribute("dir") : "ltr";
      const direction = currentDir === "rtl" ? "ltr" : "rtl";
      applyDirectionToContent(direction);
      saveGlobalState({ direction });
      updateDirectionToggleUI(direction);
    });
  }
  themeToggle.addEventListener("click", function () {
    _lastRenderedContent = null;
    const theme =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "light"
        : "dark";
    document.documentElement.setAttribute("data-theme", theme);
    saveGlobalState({ theme });

    if (theme === "dark") {
      themeToggle.innerHTML = '<i class="bi bi-sun"></i>';
    } else {
      themeToggle.innerHTML = '<i class="bi bi-moon"></i>';
    }
    
    // PERF-004: Only re-render Mermaid diagrams on theme change instead of full renderMarkdown()
    // CSS custom properties handle all other theme transitions automatically.
    // PERF-002: Guard mermaid re-render — skip if not loaded yet
    if (typeof mermaid !== 'undefined') {
      initMermaid(true); // Force re-init with new theme
      try {
        const mermaidNodes = markdownPreview.querySelectorAll('.mermaid');
        if (mermaidNodes.length > 0) {
          // Clear existing rendered Mermaid SVGs and re-render with new theme
          mermaidNodes.forEach(function(node) {
            // Restore original diagram code to prevent parsing already-rendered SVG as source
            const originalCode = node.getAttribute('data-original-code');
            if (originalCode) {
              const decodedCode = decodeURIComponent(originalCode);
              const escapedCode = decodedCode
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
              node.innerHTML = escapedCode;
            }
            node.removeAttribute('data-processed');
            const container = node.closest('.mermaid-container');
            if (container) {
              container.classList.add('is-loading');
              const oldToolbar = container.querySelector('.mermaid-toolbar');
              if (oldToolbar) oldToolbar.remove();
            }
          });
          Promise.resolve(mermaid.init(undefined, mermaidNodes))
            .then(function() {
              markdownPreview.querySelectorAll('.mermaid-container.is-loading').forEach(function(c) {
                c.classList.remove('is-loading');
              });
              addMermaidToolbars();
            })
            .catch(function(e) {
              console.warn('Mermaid theme re-render failed:', e);
              markdownPreview.querySelectorAll('.mermaid-container.is-loading').forEach(function(c) {
                c.classList.remove('is-loading');
              });
            });
        }
      } catch (e) {
        console.warn('Mermaid theme re-render failed:', e);
      }
    }

    updateMapThemes();
    updateStlThemes();
  });

  async function nativeSaveMarkdown() {
    try {
      const content = markdownEditor.value;
      const result = await Neutralino.os.showSaveDialog("Save Markdown File", {
        filters: [
          { name: "Markdown files (*.md)", extensions: ["md", "markdown"] },
          { name: "All files (*.*)", extensions: ["*"] }
        ]
      });
      if (result) {
        await Neutralino.filesystem.writeFile(result, content);
        const fileName = result.split(/[/\\]/).pop().replace(/\.(md|markdown)$/i, "");
        const activeTab = tabs.find(function(t) { return t.id === activeTabId; });
        if (activeTab) {
          activeTab.title = fileName;
          activeTab.content = content;
          saveTabsToStorage(tabs);
          renderTabBar(tabs, activeTabId);
        }
      }
    } catch (e) {
      console.error("Native save failed:", e);
      alert("Native save failed: " + e.message);
    }
  }

  async function nativeSaveHtml(htmlContent) {
    try {
      const result = await Neutralino.os.showSaveDialog("Save HTML document", {
        filters: [
          { name: "HTML documents (*.html)", extensions: ["html", "htm"] }
        ]
      });
      if (result) {
        await Neutralino.filesystem.writeFile(result, htmlContent);
      }
    } catch (e) {
      console.error("Native HTML save failed:", e);
      alert("Native HTML save failed: " + e.message);
    }
  }

  async function nativeImportMarkdown() {
    try {
      const result = await Neutralino.os.showOpenDialog("Open Markdown file", {
        filters: [
          { name: "Markdown files (*.md)", extensions: ["md", "markdown"] },
          { name: "All files (*.*)", extensions: ["*"] }
        ],
        multiSelections: true
      });
      if (result && result.length > 0) {
        for (const filePath of result) {
          const content = await Neutralino.filesystem.readFile(filePath);
          const fileName = filePath.split(/[/\\]/).pop().replace(/\.(md|markdown)$/i, "");
          newTab(content, fileName);
        }
      }
    } catch (e) {
      console.error("Native import failed:", e);
      alert("Native import failed: " + e.message);
    }
  }

  if (importFromFileButton) {
    importFromFileButton.addEventListener("click", function (e) {
      e.preventDefault();
      if (typeof Neutralino !== 'undefined') {
        nativeImportMarkdown();
      } else {
        fileInput.click();
      }
    });
  }

  if (importFromGithubButton) {
    importFromGithubButton.addEventListener("click", function (e) {
      e.preventDefault();
      openGitHubImportModal();
    });
  }

  if (githubImportSubmitBtn) {
    githubImportSubmitBtn.addEventListener("click", handleGitHubImportSubmit);
  }
  if (githubImportCancelBtn) {
    githubImportCancelBtn.addEventListener("click", closeGitHubImportModal);
  }
  const handleGitHubImportInputKeydown = function(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleGitHubImportSubmit();
    } else if (e.key === "Escape") {
      closeGitHubImportModal();
    }
  };
  if (githubImportUrlInput) {
    githubImportUrlInput.addEventListener("keydown", handleGitHubImportInputKeydown);
  }
  if (githubImportFileSelect) {
    githubImportFileSelect.addEventListener("keydown", handleGitHubImportInputKeydown);
  }
  if (githubImportSelectAllBtn) {
    githubImportSelectAllBtn.addEventListener("click", function() {
      const allPaths = availableGitHubImportPaths.slice();
      const shouldSelectAll = selectedGitHubImportPaths.size !== allPaths.length;
      setGitHubSelectedPaths(shouldSelectAll ? allPaths : []);
    });
  }

  fileInput.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (file) {
      importMarkdownFile(file);
    }
    this.value = "";
  });

  exportMd.addEventListener("click", function () {
    if (typeof Neutralino !== 'undefined') {
      nativeSaveMarkdown();
      return;
    }
    try {
      const blob = new Blob([markdownEditor.value], {
        type: "text/markdown;charset=utf-8",
      });
      saveAs(blob, getExportFilename("md", "document.md"));
    } catch (e) {
      console.error("Export failed:", e);
      alert("Export failed: " + e.message);
    }
  });

  exportHtml.addEventListener("click", function () {
    try {
      const { frontmatter, body } = parseFrontmatter(markdownEditor.value);
      const tableHtml = frontmatter ? renderFrontmatterTable(frontmatter) : '';
      const referenceData = extractReferenceDefinitions(body);
      const html = tableHtml + marked.parse(referenceData.cleanedMarkdown);
      const sanitizedHtml = DOMPurify.sanitize(html, {
        ADD_TAGS: ['mjx-container', 'input'], 
        ADD_ATTR: ['id', 'class', 'style', 'align', 'type', 'checked', 'disabled', 'data-original-code'],
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
      });
      const tempContainer = document.createElement("div");
      tempContainer.innerHTML = sanitizedHtml;
      applyReferencePreviewLinks(tempContainer, referenceData.definitions);
      enhanceGitHubAlerts(tempContainer);
      const enhancedHtml = tempContainer.innerHTML;
      const isDarkTheme =
        document.documentElement.getAttribute("data-theme") === "dark";
      const cssTheme = isDarkTheme
        ? "https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.3.0/github-markdown-dark.min.css"
        : "https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.3.0/github-markdown.min.css";
      const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Markdown Export</title>
  <link rel="stylesheet" href="${cssTheme}">
  <script>
      window.MathJax = {
          loader: { load: ['[tex]/ams', '[tex]/boldsymbol'] },
          tex: {
              inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
              displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
              processEscapes: true,
              packages: { '[+]': ['ams', 'boldsymbol'] }
          }
      };
  </script>
  <script defer src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-mml-chtml.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11.6.0/dist/mermaid.min.js"></script>
  <script defer src="https://cdnjs.cloudflare.com/ajax/libs/abcjs/6.5.2/abcjs-basic-min.js"></script>
  <style>
      html {
          background-color: ${isDarkTheme ? "#0d1117" : "#ffffff"};
      }
      body {
          margin: 0;
          background-color: ${isDarkTheme ? "#0d1117" : "#ffffff"};
          color: ${isDarkTheme ? "#c9d1d9" : "#24292e"};
      }
      .markdown-body {
          box-sizing: border-box;
          min-width: 200px;
          max-width: 100%;
          width: fit-content;
          margin: 0 auto;
          padding: 45px;
          background-color: ${isDarkTheme ? "#0d1117" : "#ffffff"};
          color: ${isDarkTheme ? "#c9d1d9" : "#24292e"};
      }
      .markdown-body > p,
      .markdown-body > ul,
      .markdown-body > ol,
      .markdown-body > blockquote,
      .markdown-body > h1,
      .markdown-body > h2,
      .markdown-body > h3,
      .markdown-body > h4,
      .markdown-body > h5,
      .markdown-body > h6,
      .markdown-body > pre,
      .markdown-body > table,
      .markdown-body > details,
      .markdown-body > dl,
      .markdown-body > hr {
          max-width: 980px;
          margin-left: auto !important;
          margin-right: auto !important;
      }


      /* Syntax Highlighting */
      .hljs-doctag, .hljs-keyword, .hljs-template-tag, .hljs-template-variable, .hljs-type, .hljs-variable.language_ { color: ${isDarkTheme ? "#ff7b72" : "#d73a49"}; }
      .hljs-title, .hljs-title.class_, .hljs-title.class_.inherited__, .hljs-title.function_ { color: ${isDarkTheme ? "#d2a8ff" : "#6f42c1"}; }
      .hljs-attr, .hljs-attribute, .hljs-literal, .hljs-meta, .hljs-number, .hljs-operator, .hljs-variable, .hljs-selector-attr, .hljs-selector-class, .hljs-selector-id { color: ${isDarkTheme ? "#79c0ff" : "#005cc5"}; }
      .hljs-regexp, .hljs-string, .hljs-meta .hljs-string { color: ${isDarkTheme ? "#a5d6ff" : "#032f62"}; }
      .hljs-built_in, .hljs-symbol { color: ${isDarkTheme ? "#ffa657" : "#e36209"}; }
      .hljs-comment, .hljs-code, .hljs-formula { color: ${isDarkTheme ? "#8b949e" : "#6a737d"}; }
      .hljs-name, .hljs-quote, .hljs-selector-tag, .hljs-selector-pseudo { color: ${isDarkTheme ? "#7ee787" : "#22863a"}; }
      .hljs-subst { color: ${isDarkTheme ? "#c9d1d9" : "#24292e"}; }
      .hljs-section { color: ${isDarkTheme ? "#1f6feb" : "#005cc5"}; font-weight: bold; }
      .hljs-bullet { color: ${isDarkTheme ? "#79c0ff" : "#005cc5"}; }
      .hljs-emphasis { font-style: italic; }
      .hljs-strong { font-weight: bold; }
      .hljs-addition { color: ${isDarkTheme ? "#aff5b4" : "#22863a"}; background-color: ${isDarkTheme ? "#033a16" : "#f0fff4"}; }
      .hljs-deletion { color: ${isDarkTheme ? "#ffdcd7" : "#b31d28"}; background-color: ${isDarkTheme ? "#67060c" : "#ffeef0"}; }

      .markdown-alert {
          padding: 0.5rem 1rem;
          margin-bottom: 16px;
          border-left: 0.25em solid;
          border-radius: 0.375rem;
      }
      .markdown-alert > :last-child {
          margin-bottom: 0;
      }
      .markdown-alert-title {
          margin: 0 0 8px;
          font-weight: 600;
          line-height: 1.25;
          display: flex;
          align-items: center;
          gap: 8px;
      }
      .markdown-alert-icon {
          display: inline-flex;
          width: 16px;
          height: 16px;
      }
      .markdown-alert-icon svg {
          width: 16px;
          height: 16px;
          fill: currentColor;
      }
      .markdown-alert-note { color: ${isDarkTheme ? "#4493f8" : "#0969da"}; border-left-color: ${isDarkTheme ? "#4493f8" : "#0969da"}; background-color: ${isDarkTheme ? "rgba(31, 111, 235, 0.15)" : "#ddf4ff"}; }
      .markdown-alert-tip { color: ${isDarkTheme ? "#3fb950" : "#1a7f37"}; border-left-color: ${isDarkTheme ? "#3fb950" : "#1a7f37"}; background-color: ${isDarkTheme ? "rgba(35, 134, 54, 0.15)" : "#dafbe1"}; }
      .markdown-alert-important { color: ${isDarkTheme ? "#ab7df8" : "#8250df"}; border-left-color: ${isDarkTheme ? "#ab7df8" : "#8250df"}; background-color: ${isDarkTheme ? "rgba(137, 87, 229, 0.15)" : "#fbefff"}; }
      .markdown-alert-warning { color: ${isDarkTheme ? "#d29922" : "#9a6700"}; border-left-color: ${isDarkTheme ? "#d29922" : "#9a6700"}; background-color: ${isDarkTheme ? "rgba(210, 153, 34, 0.18)" : "#fff8c5"}; }
      .markdown-alert-caution { color: ${isDarkTheme ? "#f85149" : "#cf222e"}; border-left-color: ${isDarkTheme ? "#f85149" : "#cf222e"}; background-color: ${isDarkTheme ? "rgba(248, 81, 73, 0.18)" : "#ffebe9"}; }
      .markdown-alert > *:not(.markdown-alert-title) { color: ${isDarkTheme ? "#c9d1d9" : "#24292e"}; }

      .frontmatter-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
          font-size: 14px;
      }
      .frontmatter-table th,
      .frontmatter-table td {
          border: 1px solid ${isDarkTheme ? "#30363d" : "#e1e4e8"};
          padding: 8px 12px;
          text-align: left;
      }
      .frontmatter-table th {
          font-weight: 600;
          background-color: ${isDarkTheme ? "#161b22" : "#f6f8fa"};
          width: 150px;
      }

      /* Footnote styles */
      .footnotes {
          margin-top: 1.5rem;
          font-size: 0.9em;
          border-top: 1px solid ${isDarkTheme ? "#30363d" : "#eaecef"};
          padding-top: 8px;
      }
      .footnotes ol {
          padding-left: 1.5em;
      }
      .footnotes ol > li::marker {
          content: "[" counter(list-item) "] ";
          font-weight: 600;
      }
      .footnotes li > p {
          margin: 0.2em 0;
      }
      .footnote-ref a,
      .footnote-backref {
          text-decoration: none;
      }
      .footnote-backref {
          margin-left: 0.4em;
      }
      a.reference-link {
          font-size: 0.75em;
          letter-spacing: -0.02em;
          line-height: 1;
          vertical-align: super;
          position: relative;
          top: 0.08em;
      }

      /* Mermaid and Math styles */
      .mermaid-container {
          position: relative;
          margin-bottom: 16px;
      }
      .math-block {
          margin: 1em 0;
          overflow-x: auto;
          text-align: center;
      }
      .abc-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin: 1.5em 0;
          padding: 1.25em;
          background-color: ${isDarkTheme ? "#161b22" : "#f6f8fa"};
          border: 1px solid ${isDarkTheme ? "#30363d" : "#e1e4e8"};
          border-radius: 6px;
          overflow-x: auto;
      }
      .abc-notation {
          width: 100%;
      }
      .abc-notation svg {
          background: transparent !important;
          color: ${isDarkTheme ? "#c9d1d9" : "#24292e"} !important;
          display: block;
          margin: 0 auto;
      }
      .abc-notation svg path {
          fill: currentColor;
      }
      .abc-notation svg text {
          fill: currentColor !important;
          stroke: none !important;
      }
      .abc-notation svg .abcjs-staff,
      .abc-notation svg .abcjs-staff-extra,
      .abc-notation svg .abcjs-bar,
      .abc-notation svg .abcjs-ledger,
      .abc-notation svg .abcjs-stem,
      .abc-notation svg .abcjs-beam,
      .abc-notation svg .abcjs-slur,
      .abc-notation svg .abcjs-tie {
          stroke: currentColor !important;
      }
      .abc-notation svg .abcjs-staff,
      .abc-notation svg .abcjs-staff-extra,
      .abc-notation svg .abcjs-ledger,
      .abc-notation svg .abcjs-slur,
      .abc-notation svg .abcjs-tie,
      .abc-notation svg .abcjs-stem {
          fill: none !important;
      }
      .abc-sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
      }

      @media (max-width: 767px) {
          .markdown-body {
              padding: 15px;
          }
      }
  </style>
</head>
<body>
  <article class="markdown-body">
      ${enhancedHtml}
  </article>
      <script>
      function fitMarkdownExportToContent() {
          var article = document.querySelector('.markdown-body');
          if (!article) return;

          article.style.width = '';
          article.style.maxWidth = '980px';

          var overflow = article.scrollWidth - article.clientWidth;
          if (overflow <= 1) return;

          var styles = window.getComputedStyle(article);
          var paddingLeft = parseFloat(styles.paddingLeft) || 0;
          var paddingRight = parseFloat(styles.paddingRight) || 0;
          var borderRight = parseFloat(styles.borderRightWidth) || 0;
          var borderLeft = parseFloat(styles.borderLeftWidth) || 0;
          var boxSizing = styles.boxSizing;

          var requiredWidth = boxSizing === 'border-box'
              ? Math.ceil(article.scrollWidth + borderLeft + borderRight)
              : Math.ceil(article.scrollWidth - paddingLeft - paddingRight);

          article.style.width = requiredWidth + 'px';
          article.style.maxWidth = 'none';
      }

      function queueMarkdownExportFit() {
          window.requestAnimationFrame(function () {
              window.requestAnimationFrame(fitMarkdownExportToContent);
          });
      }

      window.addEventListener('load', function () {
          var mathReady = Promise.resolve();
          var article = document.querySelector('.markdown-body');
          if (article && window.MutationObserver) {
              new MutationObserver(queueMarkdownExportFit).observe(article, {
                  childList: true,
                  subtree: true
              });
          }
          if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
              mathReady = window.MathJax.typesetPromise().catch(function (err) {
                  console.warn('MathJax typeset failed:', err);
              });
          }
          if (window.mermaid) {
              try {
                  window.mermaid.initialize({ startOnLoad: true, theme: '${isDarkTheme ? "dark" : "default"}', gantt: { useWidth: 1200 } });
              } catch (e) {
                  console.warn('Mermaid initialization failed:', e);
              }
          }
          if (window.ABCJS) {
              try {
                  var abcNodes = document.querySelectorAll('.abc-notation');
                  abcNodes.forEach(function(node) {
                      var code = decodeURIComponent(node.getAttribute('data-original-code') || '');
                      if (code) {
                          ABCJS.renderAbc(node.id, code, { responsive: 'resize' });
                      }
                      var container = node.closest('.abc-container');
                      if (container) container.classList.remove('is-loading');
                  });
              } catch (e) {
                  console.warn('ABCJS rendering failed:', e);
              }
          }
          mathReady.finally(queueMarkdownExportFit);
          queueMarkdownExportFit();
      });
      window.addEventListener('resize', queueMarkdownExportFit);
  </script>
</body>
</html>`;
      const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
      if (typeof Neutralino !== 'undefined') {
        nativeSaveHtml(fullHtml);
      } else {
        saveAs(blob, getExportFilename("html", "document.html"));
      }
    } catch (e) {
      console.error("HTML export failed:", e);
      alert("HTML export failed: " + e.message);
    }
  });

  // ============================================
  // Page-Break Detection Functions (Story 1.1)
  // ============================================

  // Page configuration constants for A4 PDF export
  const PAGE_CONFIG = {
    a4Width: 210,           // mm
    a4Height: 297,          // mm
    margin: 15,             // mm each side
    contentWidth: 180,      // 210 - 30 (margins)
    contentHeight: 267,     // 297 - 30 (margins)
    windowWidth: 1000,      // html2canvas config
    scale: 2                // html2canvas scale factor
  };

  const PDF_EXPORT_DEBUG = true;
  let activePdfExport = null;

  class PdfExportCancelledError extends Error {
    constructor() {
      super("PDF generation cancelled.");
      this.name = "PdfExportCancelledError";
    }
  }

  function logPdfExportDebug(...args) {
    if (PDF_EXPORT_DEBUG) console.log(...args);
  }

  function throwIfPdfExportAborted(signal) {
    if (signal && signal.aborted) {
      throw new PdfExportCancelledError();
    }
  }

  function runPdfAbortable(state, promise) {
    throwIfPdfExportAborted(state.signal);

    return new Promise((resolve, reject) => {
      const handleAbort = () => reject(new PdfExportCancelledError());
      state.signal.addEventListener("abort", handleAbort, { once: true });

      Promise.resolve(promise)
        .then(resolve, reject)
        .finally(() => {
          state.signal.removeEventListener("abort", handleAbort);
        });
    });
  }

  function formatPdfExportEta(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return "Calculating...";
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
  }

  function createPdfProgressState(exportType = "pdf") {
    const abortController = new AbortController();
    const overlay = document.createElement("div");
    overlay.className = "pdf-progress-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "pdf-progress-title");

    const isPng = exportType === "png";
    const titleText = isPng ? "Generating Image" : "Generating PDF";
    const cancelLabelText = isPng ? "Cancel Image generation" : "Cancel PDF generation";
    const progressLabelText = isPng ? "Image generation progress" : "PDF generation progress";

    overlay.innerHTML = `
      <div class="pdf-progress-modal">
        <div class="pdf-progress-header">
          <p class="pdf-progress-title" id="pdf-progress-title">${titleText}</p>
          <button type="button" class="modal-close-btn pdf-progress-cancel-icon" aria-label="${cancelLabelText}" title="${cancelLabelText}">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <div class="pdf-progress-percent">0%</div>
        <div class="pdf-progress-track"
             role="progressbar"
             aria-label="${progressLabelText}"
             aria-valuemin="0"
             aria-valuemax="100"
             aria-valuenow="0">
          <div class="pdf-progress-fill"></div>
        </div>
        <div class="pdf-progress-details">
          <div class="pdf-progress-detail">
            <span>Current Step</span>
            <strong class="pdf-progress-step">Preparing</strong>
          </div>
          <div class="pdf-progress-detail">
            <span>Estimated remaining</span>
            <strong class="pdf-progress-eta">Calculating...</strong>
          </div>
        </div>
        <div class="pdf-progress-actions">
          <button type="button" class="reset-modal-btn reset-modal-cancel pdf-progress-cancel">Cancel</button>
        </div>
      </div>`;

    const state = {
      exportType,
      abortController,
      signal: abortController.signal,
      startedAt: performance.now(),
      overlay,
      fill: overlay.querySelector(".pdf-progress-fill"),
      percentText: overlay.querySelector(".pdf-progress-percent"),
      progressBar: overlay.querySelector(".pdf-progress-track"),
      stepText: overlay.querySelector(".pdf-progress-step"),
      etaText: overlay.querySelector(".pdf-progress-eta"),
      cancelButtons: overlay.querySelectorAll(".pdf-progress-cancel, .pdf-progress-cancel-icon"),
      triggerHtml: new Map(),
      tempElement: null,
      cleanedUp: false
    };

    state.cancelButtons.forEach(button => {
      button.addEventListener("click", () => cancelPdfExport(state));
    });

    return state;
  }

  function updatePdfProgress(state, percent, step) {
    if (!state || state.cleanedUp) return;
    const nextPercent = Math.max(0, Math.min(100, Math.round(percent)));
    state.fill.style.width = `${nextPercent}%`;
    state.percentText.textContent = `${nextPercent}%`;
    state.progressBar.setAttribute("aria-valuenow", String(nextPercent));
    state.stepText.textContent = step;

    const elapsed = performance.now() - state.startedAt;
    const eta = nextPercent > 5 && nextPercent < 100
      ? (elapsed / nextPercent) * (100 - nextPercent)
      : 0;
    state.etaText.textContent = nextPercent >= 100 ? "Complete" : formatPdfExportEta(eta);
  }

  function setPdfExportTriggersBusy(state, busy) {
    const isPng = state.exportType === "png";
    const triggers = isPng
      ? [exportPng, mobileExportPng].filter(Boolean)
      : [exportPdf, mobileExportPdf].filter(Boolean);
    triggers.forEach((trigger, index) => {
      if (busy) {
        state.triggerHtml.set(trigger, trigger.innerHTML);
        const generatingLabel = isPng ? "Generating Image..." : "Generating PDF...";
        trigger.innerHTML = index === 0
          ? '<i class="bi bi-hourglass-split"></i> Generating...'
          : `<i class="bi bi-hourglass-split me-2"></i> ${generatingLabel}`;
        trigger.classList.add("pdf-export-loading");
        trigger.setAttribute("aria-disabled", "true");
        trigger.disabled = true;
      } else {
        if (state.triggerHtml.has(trigger)) {
          trigger.innerHTML = state.triggerHtml.get(trigger);
        }
        trigger.classList.remove("pdf-export-loading");
        trigger.removeAttribute("aria-disabled");
        trigger.disabled = false;
      }
    });
  }

  function cleanupPdfExport(state) {
    if (!state || state.cleanedUp) return;
    state.cleanedUp = true;

    if (state.tempElement && state.tempElement.parentNode) {
      if (window.keepTempElementForAudit) {
        window.auditedTempElement = state.tempElement;
        console.log("Skipped tempElement removal for audit");
      } else {
        state.tempElement.parentNode.removeChild(state.tempElement);
      }
    }
    if (state.overlay && state.overlay.parentNode) {
      state.overlay.parentNode.removeChild(state.overlay);
    }

    setPdfExportTriggersBusy(state, false);
    if (activePdfExport === state) {
      activePdfExport = null;
    }
  }

  function cancelPdfExport(state) {
    if (!state || state.signal.aborted) return;
    state.abortController.abort();
    cleanupPdfExport(state);
  }

  async function waitForPdfFrame(state) {
    throwIfPdfExportAborted(state.signal);
    await new Promise(resolve => requestAnimationFrame(resolve));
    throwIfPdfExportAborted(state.signal);
  }

  function markdownLikelyContainsMath(markdown) {
    return /(^|[^\\])\$\$|\\\[|\\\(|(^|[^\\])\$[^$\n]+\$/.test(markdown) || /```math\b/.test(markdown);
  }

  function choosePdfCanvasScale(element) {
    const pixelArea = element.offsetWidth * element.scrollHeight;
    if (pixelArea > 14000000) return 1.25;
    if (pixelArea > 8000000) return 1.5;
    return PAGE_CONFIG.scale;
  }

  function readPixelStyle(element, propertyName) {
    const value = window.getComputedStyle(element).getPropertyValue(propertyName);
    return parseFloat(value) || 0;
  }

  function fitExportElementToContent(element) {
    if (!element) return false;

    const overflow = element.scrollWidth - element.clientWidth;
    if (overflow <= 1) return false;

    const paddingLeft = readPixelStyle(element, 'padding-left');
    const paddingRight = readPixelStyle(element, 'padding-right');
    const borderLeft = readPixelStyle(element, 'border-left-width');
    const borderRight = readPixelStyle(element, 'border-right-width');
    const boxSizing = window.getComputedStyle(element).boxSizing;

    const requiredWidth = boxSizing === 'border-box'
      ? Math.ceil(element.scrollWidth + borderLeft + borderRight)
      : Math.ceil(element.scrollWidth - paddingLeft - paddingRight);

    element.style.width = `${requiredWidth}px`;
    return true;
  }

  /**
   * Task 1: Identifies all graphic elements that may need page-break handling
   * @param {HTMLElement} container - The container element to search within
   * @returns {Array} Array of {element, type} objects
   */
  function identifyGraphicElements(container) {
    const graphics = [];

    // Query all targeting elements in precise DOM layout flow order
    container.querySelectorAll('img, svg, pre, table, p, li, h1, h2, h3, h4, h5, h6, blockquote, hr, .math-block, mjx-container[display="true"]').forEach(el => {
      const tag = el.tagName.toLowerCase();
      
      // Skip any elements nested inside blockquotes to treat blockquotes as atomic containers
      if (el.parentElement && el.parentElement.closest('blockquote')) {
        return;
      }

      // Skip any elements nested inside list items that contain block children (treat list items as atomic)
      if (el.parentElement) {
        const liAncestor = el.parentElement.closest('li');
        if (liAncestor) {
          const hasBlockChildren = liAncestor.querySelector('p, blockquote, pre, table, ul, ol') !== null;
          if (hasBlockChildren) {
            return;
          }
        }
      }

      let type = '';
      
      if (tag === 'img') type = 'img';
      else if (tag === 'svg') {
        if (!el.closest('mjx-container, .math-block')) {
          type = 'svg';
        }
      }
      else if (tag === 'pre') type = 'pre';
      else if (tag === 'table') type = 'table';
      else if (tag === 'hr') type = 'hr';
      else if (tag === 'blockquote') {
        type = 'blockquote';
      }
      else if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
        type = 'text';
      } else if (tag === 'li') {
        // Treat list items with block children as atomic containers, otherwise treat as text
        const hasBlockChildren = el.querySelector('p, blockquote, pre, table, ul, ol') !== null;
        if (hasBlockChildren) {
          type = 'li';
        } else {
          type = 'text';
        }
      } else if (el.classList.contains('math-block') || tag === 'mjx-container') {
        type = 'math';
      }
      
      if (type) {
        graphics.push({ element: el, type: type });
      }
    });

    return graphics;
  }

  /**
   * Calculates the computed line-height of a text element, defaulting based on tag if "normal"
   * @param {HTMLElement} element 
   * @returns {number} The line-height in pixels
   */
  function getElementLineHeight(element) {
    const style = window.getComputedStyle(element);
    const fontSize = parseFloat(style.fontSize) || 14;
    let lineHeight = parseFloat(style.lineHeight);
    
    if (isNaN(lineHeight)) {
      const tag = element.tagName.toLowerCase();
      if (tag.startsWith('h')) {
        lineHeight = fontSize * 1.25;
      } else {
        lineHeight = fontSize * 1.5;
      }
    } else if (lineHeight < 10) {
      // Handle unitless line-height (e.g. "1.5")
      lineHeight = lineHeight * fontSize;
    }
    return lineHeight;
  }

  /**
   * Calculates the shift needed to align a split text element's lines with the page boundary
   * @param {Object} item - The split element item
   * @param {Array} pageBoundaries - Page break positions
   * @returns {number} The shift in pixels
   */
  function calculateTextElementShift(item, pageBoundaries) {
    const boundaryY = pageBoundaries[item.splitPageIndex];
    if (boundaryY === undefined) return 0;

    const element = item.element;
    const style = window.getComputedStyle(element);
    
    const tag = element.tagName.toLowerCase();
    const isHeading = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag);
    
    // Safety buffer (in pixels) to ensure text rendering, glyph ascenders,
    // and sub-pixel anti-aliasing are pushed cleanly past the slicing boundary.
    const SAFETY_BUFFER = 4;

    // Headings should never be split. Push the entire heading to the next page.
    if (isHeading) {
      return (boundaryY - item.top) + SAFETY_BUFFER;
    }

    const paddingTop = parseFloat(style.paddingTop) || 0;
    const borderTop = parseFloat(style.borderTopWidth) || 0;
    const paddingBottom = parseFloat(style.paddingBottom) || 0;
    const borderBottom = parseFloat(style.borderBottomWidth) || 0;

    const lh = getElementLineHeight(element);
    const contentTop = item.top + paddingTop + borderTop;
    const contentHeight = item.height - paddingTop - paddingBottom - borderTop - borderBottom;
    if (contentHeight <= 0) return 0;

    const numLines = Math.max(1, Math.round(contentHeight / lh));

    for (let i = 0; i < numLines; i++) {
      const lineTop = contentTop + i * lh;
      const lineBottom = contentTop + (i + 1) * lh;

      // Check if this line is split by boundaryY (using a small tolerance to prevent float vibrations)
      if (lineTop < boundaryY - 0.5 && lineBottom > boundaryY + 0.5) {
        // Calculate shift to align the line's top with boundaryY, plus a safety buffer
        return (boundaryY - lineTop) + SAFETY_BUFFER;
      }
    }

    // Fallback: If a short paragraph/list item is split across pages but no single line is cut
    // (e.g. boundary falls exactly in padding/margin), push the whole element.
    if (item.height <= lh * 3) {
      return (boundaryY - item.top) + SAFETY_BUFFER;
    }

    return 0;
  }

  /**
   * Task 2: Calculates element positions relative to the container
   * @param {Array} elements - Array of {element, type} objects
   * @param {HTMLElement} container - The container element
   * @returns {Array} Array with position data added
   */
  function calculateElementPositions(elements, container) {
    const containerRect = container.getBoundingClientRect();

    return elements.map(item => {
      const rect = item.element.getBoundingClientRect();
      const top = rect.top - containerRect.top;
      const height = rect.height;
      const bottom = top + height;

      return {
        element: item.element,
        type: item.type,
        top: top,
        height: height,
        bottom: bottom
      };
    });
  }

  /**
   * Task 3: Calculates page boundary positions
   * @param {number} totalHeight - Total height of content in pixels
   * @param {number} elementWidth - Actual width of the rendered element in pixels
   * @param {Object} pageConfig - Page configuration object
   * @returns {Array} Array of y-coordinates where pages end
   */
  function calculatePageBoundaries(totalHeight, elementWidth, pageConfig) {
    const aspectRatio = pageConfig.contentHeight / pageConfig.contentWidth;
    const pageHeightPx = elementWidth * aspectRatio;

    const boundaries = [];
    let y = pageHeightPx;

    while (y < totalHeight) {
      boundaries.push(y);
      y += pageHeightPx;
    }

    return { boundaries, pageHeightPx };
  }

  /**
   * Task 4: Detects which elements would be split across page boundaries
   * @param {Array} elements - Array of elements with position data
   * @param {Array} pageBoundaries - Array of page break y-coordinates
   * @returns {Array} Array of split elements with additional split info
   */
  function detectSplitElements(elements, pageBoundaries) {
    if (!elements || elements.length === 0) return [];
    if (!pageBoundaries || pageBoundaries.length === 0) return [];

    const splitElements = [];

    for (const item of elements) {
      let startPage = 0;
      for (let i = 0; i < pageBoundaries.length; i++) {
        if (item.top >= pageBoundaries[i]) {
          startPage = i + 1;
        } else {
          break;
        }
      }

      let endPage = 0;
      for (let i = 0; i < pageBoundaries.length; i++) {
        if (item.bottom > pageBoundaries[i]) {
          endPage = i + 1;
        } else {
          break;
        }
      }

      if (endPage > startPage) {
        const boundaryY = pageBoundaries[startPage] || pageBoundaries[0];
        const overflowAmount = item.bottom - boundaryY;

        splitElements.push({
          element: item.element,
          type: item.type,
          top: item.top,
          height: item.height,
          splitPageIndex: startPage,
          overflowAmount: overflowAmount
        });
      }
    }

    return splitElements;
  }

  /**
   * Task 5: Main entry point for analyzing graphics for page breaks
   * @param {HTMLElement} tempElement - The rendered content container
   * @returns {Object} Analysis result with totalElements, splitElements, pageCount
   */
  function analyzeGraphicsForPageBreaks(tempElement, signal) {
    try {
      throwIfPdfExportAborted(signal);

      const graphics = identifyGraphicElements(tempElement);
      const elementsWithPositions = calculateElementPositions(graphics, tempElement);

      throwIfPdfExportAborted(signal);

      const totalHeight = Math.ceil(tempElement.getBoundingClientRect().height);
      const elementWidth = tempElement.offsetWidth;
      const { boundaries: pageBoundaries, pageHeightPx } = calculatePageBoundaries(
        totalHeight,
        elementWidth,
        PAGE_CONFIG
      );

      const splitElements = detectSplitElements(elementsWithPositions, pageBoundaries);
      const pageCount = pageBoundaries.length + 1;

      return {
        totalElements: graphics.length,
        splitElements: splitElements,
        pageCount: pageCount,
        pageBoundaries: pageBoundaries,
        pageHeightPx: pageHeightPx
      };
    } catch (error) {
      if (error instanceof PdfExportCancelledError) throw error;
      console.error('Page-break analysis failed:', error);
      return {
        totalElements: 0,
        splitElements: [],
        pageCount: 1,
        pageBoundaries: [],
        pageHeightPx: 0
      };
    }
  }

  // ============================================
  // End Page-Break Detection Functions
  // ============================================

  // ============================================
  // Page-Break Insertion Functions (Story 1.2)
  // ============================================



  /**
   * Resets temporary styles applied to graphics elements back to their original state.
   * This is called at the start of each layout iteration in the cascade loop.
   * @param {HTMLElement} container - The container element to process
   */
  function resetGraphicsStyles(container) {
    // Remove all dynamically inserted page-break spacers
    container.querySelectorAll('.pdf-page-break-spacer').forEach(el => el.remove());

    container.querySelectorAll('[data-pdf-original-margin-top]').forEach(el => {
      el.style.marginTop = el.dataset.pdfOriginalMarginTop;
      el.removeAttribute('data-pdf-original-margin-top');
    });
    container.querySelectorAll('[data-pdf-original-margin-bottom]').forEach(el => {
      el.style.marginBottom = el.dataset.pdfOriginalMarginBottom;
      el.removeAttribute('data-pdf-original-margin-bottom');
    });
    container.querySelectorAll('[data-pdf-original-transform]').forEach(el => {
      el.style.transform = el.dataset.pdfOriginalTransform;
      el.style.transformOrigin = '';
      el.removeAttribute('data-pdf-original-transform');
    });
    container.querySelectorAll('[data-pdf-original-width]').forEach(el => {
      el.style.width = el.dataset.pdfOriginalWidth;
      el.removeAttribute('data-pdf-original-width');
    });
    container.querySelectorAll('[data-pdf-original-height]').forEach(el => {
      el.style.height = el.dataset.pdfOriginalHeight;
      el.removeAttribute('data-pdf-original-height');
    });
    container.querySelectorAll('[data-pdf-original-max-width]').forEach(el => {
      el.style.maxWidth = el.dataset.pdfOriginalMaxWidth;
      el.removeAttribute('data-pdf-original-max-width');
    });
    container.querySelectorAll('[data-pdf-original-font-size]').forEach(el => {
      el.style.fontSize = el.dataset.pdfOriginalFontSize;
      el.removeAttribute('data-pdf-original-font-size');
    });
    container.querySelectorAll('[data-pdf-original-overflow]').forEach(el => {
      el.style.overflow = el.dataset.pdfOriginalOverflow;
      el.removeAttribute('data-pdf-original-overflow');
    });
  }

  function mergeSplitTables(container) {
    const groupIds = new Set();
    container.querySelectorAll('table[data-split-group-id]').forEach(t => {
      if (t.dataset.splitGroupId) {
        groupIds.add(t.dataset.splitGroupId);
      }
    });

    for (const groupId of groupIds) {
      const originalTable = container.querySelector(`table[data-split-group-id="${groupId}"]:not([data-split-part="true"])`);
      if (!originalTable) continue;

      const parts = Array.from(container.querySelectorAll(`table[data-split-group-id="${groupId}"][data-split-part="true"]`));
      const tbody = originalTable.tBodies[0] || originalTable.querySelector('tbody') || originalTable;

      for (const part of parts) {
        const partTbody = part.tBodies[0] || part.querySelector('tbody') || part;
        const rows = Array.from(partTbody.children).filter(child => child.tagName.toLowerCase() === 'tr');
        for (const row of rows) {
          tbody.appendChild(row);
        }
        part.remove();
      }

      const spacers = Array.from(container.querySelectorAll(`div[data-split-group-id="${groupId}"][data-split-spacer="true"]`));
      for (const spacer of spacers) {
        spacer.remove();
      }

      originalTable.removeAttribute('data-split-group-id');
    }
  }

  function splitTables(container, pageHeightPx) {
    mergeSplitTables(container);

    const tables = Array.from(container.querySelectorAll('table'));
    let groupCounter = 0;

    for (const table of tables) {
      if (table.dataset.splitPart === "true") continue;
      const tableRect = table.getBoundingClientRect();
      if (tableRect.height <= pageHeightPx) continue;

      const tbody = table.tBodies[0] || table.querySelector('tbody');
      if (!tbody) continue;

      const rows = Array.from(tbody.children).filter(child => child.tagName.toLowerCase() === 'tr');
      if (rows.length === 0) continue;

      const groupId = `table-group-${groupCounter++}`;
      table.dataset.splitGroupId = groupId;
      const containerRect = container.getBoundingClientRect();

      const rowPositions = rows.map(row => {
        const rect = row.getBoundingClientRect();
        return {
          row: row,
          top: rect.top - containerRect.top,
          bottom: rect.bottom - containerRect.top,
          height: rect.height
        };
      });

      let currentTable = table;
      let currentTbody = tbody;
      let accumulatedShift = 0;

      for (let i = 0; i < rowPositions.length; i++) {
        const pos = rowPositions[i];
        const shiftedTop = pos.top + accumulatedShift;
        const shiftedBottom = pos.bottom + accumulatedShift;
        const currentPageIndex = Math.floor(shiftedTop / pageHeightPx);
        const nextPageBoundary = (currentPageIndex + 1) * pageHeightPx;

        if (shiftedBottom > nextPageBoundary) {
          const spacerHeight = nextPageBoundary - shiftedTop;
          const originalThead = table.querySelector('thead');
          const theadHeight = originalThead ? originalThead.getBoundingClientRect().height : 0;
          accumulatedShift += spacerHeight + theadHeight;

          const nextTable = table.cloneNode(false);
          nextTable.removeAttribute('id');
          nextTable.dataset.splitGroupId = groupId;
          nextTable.dataset.splitPart = "true";

          if (originalThead) nextTable.appendChild(originalThead.cloneNode(true));
          const nextTbody = document.createElement('tbody');
          nextTable.appendChild(nextTbody);

          const spacer = document.createElement('div');
          spacer.className = 'table-page-break-spacer';
          spacer.dataset.splitGroupId = groupId;
          spacer.dataset.splitSpacer = "true";
          spacer.style.height = `${spacerHeight}px`;
          spacer.style.margin = '0';
          spacer.style.padding = '0';
          spacer.style.border = 'none';

          currentTable.parentNode.insertBefore(spacer, currentTable.nextSibling);
          spacer.parentNode.insertBefore(nextTable, spacer.nextSibling);
          currentTable = nextTable;
          currentTbody = nextTbody;
        }

        if (currentTable !== table) currentTbody.appendChild(pos.row);
      }
    }
  }

  function applyPageBreaksWithCascade(tempElement, pageConfig, maxIterations = 10, signal) {
    let iteration = 0;
    let analysis;

    const elementWidth = tempElement.offsetWidth;
    const aspectRatio = pageConfig.contentHeight / pageConfig.contentWidth;
    const pageHeightPx = elementWidth * aspectRatio;

    const lastAdjustments = new Map(); // Store {margin, scale} for each element

    do {
      throwIfPdfExportAborted(signal);

      // Reset graphics element styles applied in previous iterations
      resetGraphicsStyles(tempElement);

      // Split tables at page breaks dynamically using calculated pageHeightPx
      splitTables(tempElement, pageHeightPx);

      // We must get ALL target elements in document order
      const graphics = identifyGraphicElements(tempElement);
      const elementsWithPositions = calculateElementPositions(graphics, tempElement);

      // Get page boundaries based on current height
      const totalHeight = Math.ceil(tempElement.getBoundingClientRect().height);
      const { boundaries: pageBoundaries, pageHeightPx: pageHeightPxFromAnalysis } = calculatePageBoundaries(
        totalHeight,
        elementWidth,
        pageConfig
      );

      let adjustmentsMade = false;
      let accumulatedShift = 0;
      const currentIterationAdjustments = new Map();

      for (const item of elementsWithPositions) {
        throwIfPdfExportAborted(signal);

        const currentTop = item.top + accumulatedShift;
        const currentBottom = currentTop + item.height;

        let targetMargin = 0;
        let targetScale = 1.0;

        // 1. Heading Keep-With-Next Rule (must run for all headings regardless of split)
        const tag = item.element.tagName.toLowerCase();
        const isHeading = item.type === 'text' && ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag);
        
        if (isHeading) {
          let nextBoundaryY = null;
          for (const boundary of pageBoundaries) {
            if (currentTop < boundary) {
              nextBoundaryY = boundary;
              break;
            }
          }
          if (nextBoundaryY !== null) {
            const distanceToBoundary = nextBoundaryY - currentTop;
            if (distanceToBoundary < 70) {
              targetMargin = distanceToBoundary + 4; // Push heading entirely to next page
            }
          }
        }

        // 2. If not already pushed by Keep-With-Next, perform standard page-split calculations
        if (targetMargin === 0) {
          // Check if this element crosses any page boundary or starts extremely close to it (sub-pixel safety)
          let splitPageIndex = -1;
          for (let i = 0; i < pageBoundaries.length; i++) {
            if (currentTop < pageBoundaries[i] + 12 && currentBottom > pageBoundaries[i]) {
              splitPageIndex = i;
              break;
            }
          }

          if (splitPageIndex !== -1) {
            const boundaryY = pageBoundaries[splitPageIndex];
            const remainingSpace = boundaryY - currentTop;

            if (item.type === 'text') {
              const shiftedItem = { ...item, top: currentTop, splitPageIndex: splitPageIndex };
              const shift = calculateTextElementShift(shiftedItem, pageBoundaries);
              if (shift > 0.5) {
                targetMargin = shift;
              }
            } else {
              // Graphic element splitting (with larger buffer to ensure complete clearance)
              const buffer = 15;
              const scaleNeeded = (remainingSpace - buffer) / item.height;
              const remainingSpacePercent = remainingSpace / pageHeightPxFromAnalysis;

              const isTextContainer = ['blockquote', 'li', 'table', 'pre', 'math'].includes(item.type);

              // Fit on current page by scaling if it's an image/svg and space/scale are acceptable.
              // Otherwise, always push text/block containers to next page to prevent transform-scaling bugs.
              if (!isTextContainer && remainingSpacePercent >= 0.20 && scaleNeeded >= 0.6) {
                targetScale = Math.min(1.0, scaleNeeded);
              } else {
                // Push to next page
                const marginNeeded = boundaryY - currentTop + buffer;
                targetMargin = marginNeeded;

                // Check if it fits the next page height after being pushed (Rule 3 Case C)
                const newTop = currentTop + marginNeeded;
                const newBottom = newTop + item.height;
                const nextBoundaryY = pageBoundaries[splitPageIndex + 1] || (boundaryY + pageHeightPxFromAnalysis);
                if (newBottom > nextBoundaryY) {
                  const scaleToFitPage = (pageHeightPxFromAnalysis - 20) / item.height;
                  targetScale = Math.max(0.5, Math.min(1.0, scaleToFitPage));
                }
              }
            }
          } else {
            // Element is not split. But graphic elements taller than a page must still scale to fit!
            if (item.type !== 'text' && item.height > pageHeightPxFromAnalysis) {
              const scaleToFitPage = (pageHeightPxFromAnalysis - 20) / item.height;
              targetScale = Math.max(0.5, Math.min(1.0, scaleToFitPage));
            }
          }
        }

        // Check if this calculated adjustment is different from the previous iteration
        const prevAdjustment = lastAdjustments.get(item.element) || { margin: 0, scale: 1.0 };
        if (Math.abs(targetMargin - prevAdjustment.margin) > 0.1 || Math.abs(targetScale - prevAdjustment.scale) > 0.001) {
          adjustmentsMade = true;
        }

        currentIterationAdjustments.set(item.element, { margin: targetMargin, scale: targetScale });

        // Apply style adjustments to the DOM
        if (targetMargin > 0) {
          let targetElement = item.element;

          // Redirect inline image or svg margins to their parent block element if nested
          if (item.type === 'svg' && item.element.parentElement) {
            const parent = item.element.parentElement;
            if (['p', 'li', 'blockquote'].includes(parent.tagName.toLowerCase())) {
              targetElement = parent;
            } else {
              targetElement = parent;
            }
          } else if (item.type === 'img' && item.element.parentElement) {
            const parent = item.element.parentElement;
            if (item.element.classList.contains('mermaid-img')) {
              if (parent.parentElement && parent.parentElement.classList.contains('mermaid-container')) {
                targetElement = parent.parentElement;
              } else {
                targetElement = parent;
              }
            } else if (['p', 'li', 'blockquote'].includes(parent.tagName.toLowerCase())) {
              targetElement = parent;
            }
          }

          // If target is a list item, apply marginTop directly to avoid invalid HTML / collapsed spacers
          if (targetElement.tagName.toLowerCase() === 'li') {
            if (!targetElement.dataset.hasOwnProperty('pdfOriginalMarginTop')) {
              targetElement.dataset.pdfOriginalMarginTop = targetElement.style.marginTop || '';
            }
            targetElement.style.marginTop = `${targetMargin}px`;
          } else {
            // Create a physical spacer element to avoid margin collapse issues entirely
            const spacer = document.createElement('div');
            spacer.className = 'pdf-page-break-spacer';
            spacer.style.height = `${targetMargin}px`;
            spacer.style.margin = '0';
            spacer.style.padding = '0';
            spacer.style.border = 'none';
            spacer.style.display = 'block';

            targetElement.parentNode.insertBefore(spacer, targetElement);
          }
          accumulatedShift += targetMargin;
        }

        if (targetScale < 1.0) {
          applyGraphicScaling(item.element, targetScale, item.type);
          const heightSaved = item.height * (1.0 - targetScale);
          accumulatedShift -= heightSaved;
        }
      }

      // Copy current adjustments to lastAdjustments
      lastAdjustments.clear();
      for (const [el, adj] of currentIterationAdjustments) {
        lastAdjustments.set(el, adj);
      }

      if (!adjustmentsMade) {
        break;
      }

      iteration++;
    } while (iteration < maxIterations);

    if (iteration >= maxIterations) {
      console.warn('Page-break stabilization reached max iterations:', maxIterations);
    }

    // Return the final page boundaries and height analysis for the export flow
    analysis = analyzeGraphicsForPageBreaks(tempElement, signal);
    
    logPdfExportDebug('Page-break cascade complete:', {
      iterations: iteration,
      finalSplitCount: analysis.splitElements.length
    });

    return analysis;
  }

  // ============================================
  // End Page-Break Insertion Functions
  // ============================================

  // ============================================
  // Oversized Graphics Scaling Functions (Story 1.3)
  // ============================================

  const MIN_SCALE_FACTOR = 0.5;

  function calculateScaleFactor(elementHeight, availableHeight, buffer = 5) {
    const targetHeight = availableHeight - buffer;
    let scaleFactor = targetHeight / elementHeight;
    let wasClampedToMin = false;

    if (scaleFactor < MIN_SCALE_FACTOR) {
      console.warn(
        `Warning: Large graphic requires ${(scaleFactor * 100).toFixed(0)}% scaling. ` +
        `Clamping to minimum ${MIN_SCALE_FACTOR * 100}%. Content may be cut off.`
      );
      scaleFactor = MIN_SCALE_FACTOR;
      wasClampedToMin = true;
    }

    return { scaleFactor, wasClampedToMin };
  }

  function applyGraphicScaling(element, scaleFactor, elementType) {
    if (!element.dataset.hasOwnProperty('pdfOriginalTransform')) {
      element.dataset.pdfOriginalTransform = element.style.transform || '';
    }
    if (!element.dataset.hasOwnProperty('pdfOriginalMarginBottom')) {
      element.dataset.pdfOriginalMarginBottom = element.style.marginBottom || '';
    }

    if (elementType === 'svg' || elementType === 'img') {
      if (!element.dataset.hasOwnProperty('pdfOriginalWidth')) {
        element.dataset.pdfOriginalWidth = element.style.width || '';
      }
      if (!element.dataset.hasOwnProperty('pdfOriginalHeight')) {
        element.dataset.pdfOriginalHeight = element.style.height || '';
      }
      if (!element.dataset.hasOwnProperty('pdfOriginalMaxWidth')) {
        element.dataset.pdfOriginalMaxWidth = element.style.maxWidth || '';
      }

      let origWidth = parseFloat(element.dataset.pdfOriginalClientWidth);
      let origHeight = parseFloat(element.dataset.pdfOriginalClientHeight);

      if (isNaN(origWidth) || isNaN(origHeight)) {
        origWidth = element.clientWidth || element.getBoundingClientRect().width;
        origHeight = element.clientHeight || element.getBoundingClientRect().height;
        element.dataset.pdfOriginalClientWidth = String(origWidth);
        element.dataset.pdfOriginalClientHeight = String(origHeight);
      }

      // Apply physical scale
      element.style.width = `${origWidth * scaleFactor}px`;
      element.style.height = `${origHeight * scaleFactor}px`;
      if (elementType === 'svg') {
        element.style.maxWidth = 'none';
      }
    } else {
      // For pre, table, blockquote, math, li, etc.
      // Use transform: scale combined with physical height and overflow hidden to guarantee no native splits
      if (!element.dataset.hasOwnProperty('pdfOriginalHeight')) {
        element.dataset.pdfOriginalHeight = element.style.height || '';
      }
      if (!element.dataset.hasOwnProperty('pdfOriginalOverflow')) {
        element.dataset.pdfOriginalOverflow = element.style.overflow || '';
      }

      element.style.transform = `scale(${scaleFactor})`;
      element.style.transformOrigin = 'top left';

      let origHeight = parseFloat(element.dataset.pdfOriginalClientHeight);
      if (isNaN(origHeight)) {
        origHeight = element.offsetHeight || element.getBoundingClientRect().height;
        element.dataset.pdfOriginalClientHeight = String(origHeight);
      }

      const scaledHeight = origHeight * scaleFactor;
      element.style.height = `${scaledHeight}px`;
      element.style.overflow = 'hidden';
    }
  }



  function waitForAllImages(container) {
    const imgs = Array.from(container.querySelectorAll('img'));
    const promises = imgs.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    });
    return Promise.all(promises);
  }

  // ============================================
  // End Oversized Graphics Scaling Functions
  // ============================================

  exportPdf.addEventListener("click", async function (event) {
    event.preventDefault();
    logPdfExportDebug("PDF export button clicked!");
    if (activePdfExport) {
      logPdfExportDebug("PDF export already active, ignoring click");
      return;
    }

    const progressState = createPdfProgressState();
    activePdfExport = progressState;
    setPdfExportTriggersBusy(progressState, true);
    document.body.appendChild(progressState.overlay);
    updatePdfProgress(progressState, 3, "Starting");
    progressState.overlay.querySelector(".pdf-progress-cancel")?.focus();

    try {
      logPdfExportDebug("PDF export try block entered. typeof jspdf:", typeof jspdf, "typeof html2canvas:", typeof html2canvas);
      // PERF-002: Lazy-load PDF libraries on first export
      if (typeof jspdf === 'undefined' || typeof html2canvas === 'undefined') {
        logPdfExportDebug("Lazy loading PDF libraries started...");
        updatePdfProgress(progressState, 8, "Loading PDF libraries");
        await runPdfAbortable(progressState, Promise.all([
          loadScript(CDN.jspdf).then(() => logPdfExportDebug("jspdf load callback fired")),
          loadScript(CDN.html2canvas).then(() => logPdfExportDebug("html2canvas load callback fired"))
        ]));
        logPdfExportDebug("Lazy loading PDF libraries resolved.");
        throwIfPdfExportAborted(progressState.signal);
      }
      logPdfExportDebug("Parsing markdown...");
      updatePdfProgress(progressState, 15, "Parsing markdown");
      await waitForPdfFrame(progressState);
      const markdown = markdownEditor.value;
      const html = marked.parse(markdown);
      const sanitizedHtml = DOMPurify.sanitize(html, {
        ADD_TAGS: ['mjx-container', 'svg', 'path', 'g', 'marker', 'defs', 'pattern', 'clipPath', 'input'],
        ADD_ATTR: ['id', 'class', 'style', 'align', 'viewBox', 'd', 'fill', 'stroke', 'transform', 'marker-end', 'marker-start', 'type', 'checked', 'disabled', 'data-original-code'],
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
      });
      throwIfPdfExportAborted(progressState.signal);

      updatePdfProgress(progressState, 24, "Preparing document");
      await waitForPdfFrame(progressState);
      const tempElement = document.createElement("div");
      progressState.tempElement = tempElement;
      tempElement.className = "markdown-body pdf-export";
      tempElement.innerHTML = sanitizedHtml;
      enhanceGitHubAlerts(tempElement);
      tempElement.style.padding = "0px";
      tempElement.style.width = "210mm";
      tempElement.style.margin = "0 auto";
      tempElement.style.fontSize = "14px";
      tempElement.style.position = "fixed";
      tempElement.style.left = "-9999px";
      tempElement.style.top = "0";

      const currentTheme = document.documentElement.getAttribute("data-theme");
      tempElement.style.backgroundColor = currentTheme === "dark" ? "#0d1117" : "#ffffff";
      tempElement.style.color = currentTheme === "dark" ? "#c9d1d9" : "#24292e";

      document.body.appendChild(tempElement);
      await waitForPdfFrame(progressState);

      const mermaidNodes = tempElement.querySelectorAll('.mermaid');
      if (mermaidNodes.length > 0) {
        updatePdfProgress(progressState, 34, "Rendering diagrams");
        try {
          if (typeof mermaid === 'undefined') {
            await runPdfAbortable(progressState, loadScript(CDN.mermaid));
          }
          throwIfPdfExportAborted(progressState.signal);
          initMermaid(true);
          await runPdfAbortable(progressState, mermaid.init(undefined, mermaidNodes));
          tempElement.querySelectorAll('.mermaid-container.is-loading').forEach(container => {
            container.classList.remove('is-loading');
          });

          // Convert all rendered Mermaid SVGs inside tempElement to <img> tags with data URI sources
          const compiledMermaids = tempElement.querySelectorAll('.mermaid-container');
          compiledMermaids.forEach(container => {
            const svgElement = container.querySelector('svg');
            if (svgElement) {
              const rect = svgElement.getBoundingClientRect();
              const width = rect.width || svgElement.clientWidth || parseFloat(svgElement.getAttribute('width')) || 600;
              const height = rect.height || svgElement.clientHeight || parseFloat(svgElement.getAttribute('height')) || 400;

              const clonedSvg = svgElement.cloneNode(true);
              clonedSvg.setAttribute('width', width);
              clonedSvg.setAttribute('height', height);
              if (!clonedSvg.getAttribute('viewBox')) {
                clonedSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
              }
              clonedSvg.style.width = `${width}px`;
              clonedSvg.style.height = `${height}px`;

              const svgString = new XMLSerializer().serializeToString(clonedSvg);
              const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
              
              const img = document.createElement('img');
              img.className = 'mermaid-img';
              if (svgElement.id) img.id = svgElement.id + '-img';
              img.src = 'data:image/svg+xml;base64,' + svgBase64;
              
              img.style.width = `${width}px`;
              img.style.height = `${height}px`;
              img.style.maxWidth = '100%';
              img.style.display = 'block';
              img.style.margin = '0 auto';
              
              img.dataset.originalWidth = String(width);
              img.dataset.originalHeight = String(height);

              container.innerHTML = '';
              container.appendChild(img);
            }
          });
        } catch (mermaidError) {
          if (mermaidError instanceof PdfExportCancelledError) throw mermaidError;
          console.warn("Mermaid rendering issue:", mermaidError);
          tempElement.querySelectorAll('.mermaid-container.is-loading').forEach(container => {
            container.classList.remove('is-loading');
          });
        }
        throwIfPdfExportAborted(progressState.signal);
        await waitForPdfFrame(progressState);
      }

      const abcNodes = tempElement.querySelectorAll('.abc-notation');
      if (abcNodes.length > 0) {
        updatePdfProgress(progressState, 40, "Rendering music notation");
        try {
          if (typeof ABCJS === 'undefined') {
            await runPdfAbortable(progressState, loadScript(CDN.abcjs));
          }
          throwIfPdfExportAborted(progressState.signal);
          
          abcNodes.forEach(node => {
            const abcCode = decodeURIComponent(node.getAttribute('data-original-code') || '');
            if (abcCode) {
              ABCJS.renderAbc(node.id, abcCode, { responsive: 'resize' });
            }
          });
          
          tempElement.querySelectorAll('.abc-container.is-loading').forEach(container => {
            container.classList.remove('is-loading');
          });

          // Convert all rendered ABC SVGs inside tempElement to <img> tags with data URI sources
          const compiledAbcs = tempElement.querySelectorAll('.abc-container');
          compiledAbcs.forEach(container => {
            const svgElement = container.querySelector('svg');
            if (svgElement) {
              const rect = svgElement.getBoundingClientRect();
              const width = rect.width || svgElement.clientWidth || parseFloat(svgElement.getAttribute('width')) || 600;
              const height = rect.height || svgElement.clientHeight || parseFloat(svgElement.getAttribute('height')) || 400;

              const clonedSvg = svgElement.cloneNode(true);
              clonedSvg.setAttribute('width', width);
              clonedSvg.setAttribute('height', height);
              if (!clonedSvg.getAttribute('viewBox')) {
                clonedSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
              }
              clonedSvg.style.width = `${width}px`;
              clonedSvg.style.height = `${height}px`;

              const svgString = new XMLSerializer().serializeToString(clonedSvg);
              const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
              
              const img = document.createElement('img');
              img.className = 'abc-img';
              img.src = 'data:image/svg+xml;base64,' + svgBase64;
              
              img.style.width = `${width}px`;
              img.style.height = `${height}px`;
              img.style.maxWidth = '100%';
              img.style.display = 'block';
              img.style.margin = '0 auto';
              
              img.dataset.originalWidth = String(width);
              img.dataset.originalHeight = String(height);

              container.innerHTML = '';
              container.appendChild(img);
            }
          });
        } catch (abcError) {
          if (abcError instanceof PdfExportCancelledError) throw abcError;
          console.warn("ABC rendering issue:", abcError);
          tempElement.querySelectorAll('.abc-container.is-loading').forEach(container => {
            container.classList.remove('is-loading');
          });
        }
        throwIfPdfExportAborted(progressState.signal);
        await waitForPdfFrame(progressState);
      }

      if (window.MathJax && markdownLikelyContainsMath(markdown)) {
        updatePdfProgress(progressState, 44, "Rendering math");
        try {
          await runPdfAbortable(progressState, MathJax.typesetPromise([tempElement]));
        } catch (mathJaxError) {
          if (mathJaxError instanceof PdfExportCancelledError) throw mathJaxError;
          console.warn("MathJax rendering issue:", mathJaxError);
        }
        throwIfPdfExportAborted(progressState.signal);

        // Hide MathJax assistive elements that cause duplicate text in PDF
        // These are screen reader elements that html2canvas captures as visible
        // Use multiple CSS properties to ensure html2canvas doesn't render them
        const assistiveElements = tempElement.querySelectorAll('mjx-assistive-mml');
        assistiveElements.forEach(el => {
          el.style.display = 'none';
          el.style.visibility = 'hidden';
          el.style.position = 'absolute';
          el.style.width = '0';
          el.style.height = '0';
          el.style.overflow = 'hidden';
          el.remove(); // Remove entirely from DOM
        });

        // Also hide any MathJax script elements that might contain source
        const mathScripts = tempElement.querySelectorAll('script[type*="math"], script[type*="tex"]');
        mathScripts.forEach(el => el.remove());
      }

      await waitForPdfFrame(progressState);
      fitExportElementToContent(tempElement);
      await waitForPdfFrame(progressState);

      // Await loading of all images and fonts (including converted Mermaid base64 images) before cascade sizing runs
      updatePdfProgress(progressState, 50, "Loading document assets");
      await runPdfAbortable(progressState, Promise.all([
        waitForAllImages(tempElement),
        document.fonts ? document.fonts.ready : Promise.resolve()
      ]));
      throwIfPdfExportAborted(progressState.signal);
      await waitForPdfFrame(progressState);

      // Analyze and apply page-breaks for graphics (Story 1.1 + 1.2)
      updatePdfProgress(progressState, 55, "Optimizing page breaks");
      const pageBreakAnalysis = applyPageBreaksWithCascade(tempElement, PAGE_CONFIG, 10, progressState.signal);
      throwIfPdfExportAborted(progressState.signal);

      await waitForPdfFrame(progressState);

      const pdfOptions = {
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
        hotfixes: ["px_scaling"]
      };

      const pdf = new jspdf.jsPDF(pdfOptions);
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);
      const captureScale = choosePdfCanvasScale(tempElement);

      updatePdfProgress(progressState, 65, "Capturing document");
      const canvas = await runPdfAbortable(progressState, html2canvas(tempElement, {
        scale: captureScale,
        useCORS: true,
        allowTaint: false,
        logging: false,
        windowWidth: Math.max(PAGE_CONFIG.windowWidth, Math.ceil(tempElement.getBoundingClientRect().width)),
        windowHeight: Math.ceil(tempElement.getBoundingClientRect().height)
      }));
      await waitForPdfFrame(progressState);
      throwIfPdfExportAborted(progressState.signal);

      console.log(`[PDF DEBUG] canvas.width = ${canvas.width}, canvas.height = ${canvas.height}`);
      console.log(`[PDF DEBUG] tempElement.offsetWidth = ${tempElement.offsetWidth}, rect.width = ${tempElement.getBoundingClientRect().width}`);
      const scaleFactor = canvas.width / contentWidth;
      console.log(`[PDF DEBUG] scaleFactor = ${scaleFactor}, PAGE_CONFIG.scale = ${PAGE_CONFIG.scale}, captureScale = ${captureScale}`);
      const imgHeight = canvas.height / scaleFactor;
      console.log(`[PDF DEBUG] imgHeight = ${imgHeight}, contentHeight = ${pageHeight - margin * 2}`);
      // Introduce a 0.5mm tolerance to prevent rounding errors from creating a trailing blank page
      const pagesCount = Math.ceil((imgHeight - 0.5) / (pageHeight - margin * 2));
      console.log(`[PDF DEBUG] pagesCount = ${pagesCount}`);

      updatePdfProgress(progressState, 76, "Rendering pages");
      for (let page = 0; page < pagesCount; page++) {
        throwIfPdfExportAborted(progressState.signal);
        const pageProgress = 76 + ((page + 1) / pagesCount) * 18;
        updatePdfProgress(progressState, pageProgress, `Rendering page ${page + 1} of ${pagesCount}`);

        if (page > 0) pdf.addPage();

        const sourceY = page * (pageHeight - margin * 2) * scaleFactor;
        const sourceHeight = Math.min(canvas.height - sourceY, (pageHeight - margin * 2) * scaleFactor);
        const destHeight = sourceHeight / scaleFactor;

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sourceHeight;

        const ctx = pageCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);

        const imgData = pageCanvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, destHeight);
        await waitForPdfFrame(progressState);
      }

      throwIfPdfExportAborted(progressState.signal);
      updatePdfProgress(progressState, 98, "Preparing download");
      pdf.save(getExportFilename("pdf", "document.pdf"));
      updatePdfProgress(progressState, 100, "Complete");

    } catch (error) {
      if (error instanceof PdfExportCancelledError || progressState.signal.aborted) {
        console.info("PDF export cancelled");
      } else {
        console.error("PDF export failed:", error);
        alert("PDF export failed: " + error.message);
      }
    } finally {
      cleanupPdfExport(progressState);
    }
  });

  exportPng.addEventListener("click", async function (event) {
    event.preventDefault();
    logPdfExportDebug("PNG export button clicked!");
    if (activePdfExport) {
      logPdfExportDebug("Export already active, ignoring click");
      return;
    }

    const progressState = createPdfProgressState("png");
    activePdfExport = progressState;
    setPdfExportTriggersBusy(progressState, true);
    document.body.appendChild(progressState.overlay);
    updatePdfProgress(progressState, 5, "Starting PNG Export");
    progressState.overlay.querySelector(".pdf-progress-cancel")?.focus();

    try {
      if (typeof html2canvas === 'undefined') {
        updatePdfProgress(progressState, 15, "Loading image renderer");
        await runPdfAbortable(progressState, loadScript(CDN.html2canvas));
        throwIfPdfExportAborted(progressState.signal);
      }
      
      updatePdfProgress(progressState, 25, "Parsing markdown");
      await waitForPdfFrame(progressState);
      const markdown = markdownEditor.value;
      const html = marked.parse(markdown);
      const sanitizedHtml = DOMPurify.sanitize(html, {
        ADD_TAGS: ['mjx-container', 'svg', 'path', 'g', 'marker', 'defs', 'pattern', 'clipPath', 'input'],
        ADD_ATTR: ['id', 'class', 'style', 'align', 'viewBox', 'd', 'fill', 'stroke', 'transform', 'marker-end', 'marker-start', 'type', 'checked', 'disabled', 'data-original-code'],
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
      });
      throwIfPdfExportAborted(progressState.signal);

      updatePdfProgress(progressState, 40, "Preparing document");
      await waitForPdfFrame(progressState);
      const tempElement = document.createElement("div");
      progressState.tempElement = tempElement;
      tempElement.className = "markdown-body pdf-export";
      tempElement.innerHTML = sanitizedHtml;
      enhanceGitHubAlerts(tempElement);
      tempElement.style.padding = "40px"; // Give some padding for PNG
      tempElement.style.width = "1000px";
      tempElement.style.margin = "0 auto";
      tempElement.style.fontSize = "16px";
      tempElement.style.position = "fixed";
      tempElement.style.left = "-9999px";
      tempElement.style.top = "0";

      const currentTheme = document.documentElement.getAttribute("data-theme");
      tempElement.style.backgroundColor = currentTheme === "dark" ? "#0d1117" : "#ffffff";
      tempElement.style.color = currentTheme === "dark" ? "#c9d1d9" : "#24292e";

      document.body.appendChild(tempElement);
      await waitForPdfFrame(progressState);

      const mermaidNodes = tempElement.querySelectorAll('.mermaid');
      if (mermaidNodes.length > 0) {
        updatePdfProgress(progressState, 50, "Rendering diagrams");
        try {
          if (typeof mermaid === 'undefined') {
            await runPdfAbortable(progressState, loadScript(CDN.mermaid));
          }
          throwIfPdfExportAborted(progressState.signal);
          initMermaid(true);
          await runPdfAbortable(progressState, mermaid.init(undefined, mermaidNodes));
          tempElement.querySelectorAll('.mermaid-container.is-loading').forEach(container => container.classList.remove('is-loading'));

          const compiledMermaids = tempElement.querySelectorAll('.mermaid-container');
          compiledMermaids.forEach(container => {
            const svgElement = container.querySelector('svg');
            if (svgElement) {
              const width = svgElement.getBoundingClientRect().width || 600;
              const height = svgElement.getBoundingClientRect().height || 400;
              const clonedSvg = svgElement.cloneNode(true);
              clonedSvg.setAttribute('width', width);
              clonedSvg.setAttribute('height', height);
              if (!clonedSvg.getAttribute('viewBox')) {
                clonedSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
              }
              const svgString = new XMLSerializer().serializeToString(clonedSvg);
              const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
              const img = document.createElement('img');
              img.className = 'mermaid-img';
              img.src = 'data:image/svg+xml;base64,' + svgBase64;
              img.style.width = `${width}px`;
              img.style.height = `${height}px`;
              img.style.display = 'block';
              img.style.margin = '0 auto';
              container.innerHTML = '';
              container.appendChild(img);
            }
          });
        } catch (e) {
          if (e instanceof PdfExportCancelledError) throw e;
          console.warn("Mermaid issue:", e);
        }
        throwIfPdfExportAborted(progressState.signal);
        await waitForPdfFrame(progressState);
      }
      
      const abcNodes = tempElement.querySelectorAll('.abc-notation');
      if (abcNodes.length > 0) {
        updatePdfProgress(progressState, 60, "Rendering music notation");
        try {
          if (typeof ABCJS === 'undefined') {
            await runPdfAbortable(progressState, loadScript(CDN.abcjs));
          }
          throwIfPdfExportAborted(progressState.signal);
          abcNodes.forEach(node => {
            const abcCode = decodeURIComponent(node.getAttribute('data-original-code') || '');
            if (abcCode) ABCJS.renderAbc(node.id, abcCode, { responsive: 'resize' });
          });
          tempElement.querySelectorAll('.abc-container.is-loading').forEach(container => container.classList.remove('is-loading'));

          const compiledAbcs = tempElement.querySelectorAll('.abc-container');
          compiledAbcs.forEach(container => {
            const svgElement = container.querySelector('svg');
            if (svgElement) {
              const width = svgElement.getBoundingClientRect().width || 600;
              const height = svgElement.getBoundingClientRect().height || 400;
              const clonedSvg = svgElement.cloneNode(true);
              clonedSvg.setAttribute('width', width);
              clonedSvg.setAttribute('height', height);
              if (!clonedSvg.getAttribute('viewBox')) {
                clonedSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
              }
              const svgString = new XMLSerializer().serializeToString(clonedSvg);
              const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
              const img = document.createElement('img');
              img.src = 'data:image/svg+xml;base64,' + svgBase64;
              img.style.width = `${width}px`;
              img.style.height = `${height}px`;
              img.style.display = 'block';
              img.style.margin = '0 auto';
              container.innerHTML = '';
              container.appendChild(img);
            }
          });
        } catch (e) {
          if (e instanceof PdfExportCancelledError) throw e;
          console.warn("ABC rendering issue:", e);
        }
        throwIfPdfExportAborted(progressState.signal);
        await waitForPdfFrame(progressState);
      }

      if (window.MathJax && markdownLikelyContainsMath(markdown)) {
        updatePdfProgress(progressState, 70, "Rendering math");
        try {
          await runPdfAbortable(progressState, MathJax.typesetPromise([tempElement]));
        } catch (e) {
          if (e instanceof PdfExportCancelledError) throw e;
        }
        throwIfPdfExportAborted(progressState.signal);
        const assistiveElements = tempElement.querySelectorAll('mjx-assistive-mml');
        assistiveElements.forEach(el => {
          el.style.display = 'none';
          el.style.visibility = 'hidden';
          el.style.position = 'absolute';
          el.style.width = '0';
          el.style.height = '0';
          el.style.overflow = 'hidden';
          el.remove();
        });
        const mathScripts = tempElement.querySelectorAll('script[type*="math"], script[type*="tex"]');
        mathScripts.forEach(el => el.remove());
      }

      await waitForPdfFrame(progressState);
      fitExportElementToContent(tempElement);
      await waitForPdfFrame(progressState);

      updatePdfProgress(progressState, 80, "Loading document assets");
      await runPdfAbortable(progressState, Promise.all([
        waitForAllImages(tempElement),
        document.fonts ? document.fonts.ready : Promise.resolve()
      ]));
      throwIfPdfExportAborted(progressState.signal);
      await waitForPdfFrame(progressState);

      // No page breaks needed for PNG
      updatePdfProgress(progressState, 90, "Capturing image");
      const canvas = await runPdfAbortable(progressState, html2canvas(tempElement, {
        scale: 2, // 2x resolution
        useCORS: true,
        allowTaint: false,
        logging: false,
        windowWidth: Math.max(1000, Math.ceil(tempElement.getBoundingClientRect().width)),
        windowHeight: Math.ceil(tempElement.getBoundingClientRect().height)
      }));
      await waitForPdfFrame(progressState);
      throwIfPdfExportAborted(progressState.signal);

      updatePdfProgress(progressState, 95, "Saving image");
      canvas.toBlob((blob) => {
        saveAs(blob, getExportFilename("png", "document.png"));
      }, "image/png");
      updatePdfProgress(progressState, 100, "Complete");

    } catch (error) {
      if (error instanceof PdfExportCancelledError || progressState.signal.aborted) {
        console.info("PNG export cancelled");
      } else {
        console.error("PNG export failed:", error);
        alert("PNG export failed: " + error.message);
      }
    } finally {
      cleanupPdfExport(progressState);
    }
  });

  copyMarkdownButton.addEventListener("click", function () {
    try {
      const markdownText = markdownEditor.value;
      copyToClipboard(markdownText);
    } catch (e) {
      console.error("Copy failed:", e);
      alert("Failed to copy Markdown: " + e.message);
    }
  });

  async function copyTextToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    if (!successful) {
      throw new Error("Copy command was unsuccessful");
    }
  }

  async function copyToClipboard(text) {
    try {
      await copyTextToClipboard(text);
      showCopiedMessage();
    } catch (err) {
      console.error("Copy failed:", err);
      alert("Failed to copy HTML: " + err.message);
    }
  }

  function showCopiedMessage() {
    const originalText = copyMarkdownButton.innerHTML;
    copyMarkdownButton.innerHTML = '<i class="bi bi-check-lg"></i> Copied!';

    setTimeout(() => {
      copyMarkdownButton.innerHTML = originalText;
    }, 2000);
  }

  // ============================================
  // Share via URL (pako compression + base64url)
  // ============================================

  const MAX_SHARE_URL_LENGTH = 32000;

  function encodeMarkdownForShare(text) {
    if (typeof pako === 'undefined') throw new Error('pako not loaded');
    const compressed = pako.deflate(new TextEncoder().encode(text));
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < compressed.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, compressed.subarray(i, i + chunkSize));
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodeMarkdownFromShare(encoded) {
    if (typeof pako === 'undefined') throw new Error('pako not loaded');
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder().decode(pako.inflate(bytes));
  }

  // ============================================
  // Share Modal
  // ============================================

  const shareModal        = document.getElementById('share-modal');
  const shareModalCloseX  = document.getElementById('share-modal-close-icon');
  const shareModalClose   = document.getElementById('share-modal-close');
  const shareUrlInput     = document.getElementById('share-url-input');
  const shareCopyBtn      = document.getElementById('share-copy-btn');
  const shareModeView     = document.getElementById('share-mode-view');
  const shareModeEdit     = document.getElementById('share-mode-edit');
  const shareCardView     = document.getElementById('share-card-view');
  const shareCardEdit     = document.getElementById('share-card-edit');

  function buildShareUrl(mode) {
    const markdownText = markdownEditor.value;
    let encoded;
    try {
      encoded = encodeMarkdownForShare(markdownText);
    } catch (e) {
      console.error('Share encoding failed:', e);
      return null;
    }
    const isLocal = window.location.origin.includes('localhost') || 
                    window.location.origin.startsWith('file://') || 
                    typeof Neutralino !== 'undefined';
                    
    const baseUrl = isLocal 
      ? 'https://markdownviewer.pages.dev/' 
      : window.location.origin + window.location.pathname;

    const base = baseUrl + '#share=' + encoded;
    return mode === 'edit' ? base + '&edit=1' : base;
  }

  function updateShareUrlField() {
    const mode = shareModeView.checked ? 'view' : 'edit';
    const url = buildShareUrl(mode);
    if (!url) {
      shareUrlInput.value = 'Error generating link.';
      shareCopyBtn.disabled = true;
      return;
    }
    const tooLarge = url.length > MAX_SHARE_URL_LENGTH;
    if (tooLarge) {
      shareUrlInput.value = 'Document too large to share via URL.';
      shareCopyBtn.disabled = true;
    } else {
      shareUrlInput.value = url;
      shareCopyBtn.disabled = false;
    }
  }

  function openShareModal() {
    // PERF-002: Lazy-load pako on first share
    if (typeof pako === 'undefined') {
      loadScript(CDN.pako).then(function() {
        openShareModal();
      }).catch(function(e) {
        console.error('Failed to load pako:', e);
        alert('Failed to load sharing library. Please check your internet connection.');
      });
      return;
    }
    // Reset to view-only by default each time
    shareModeView.checked = true;
    syncShareCardStyles();
    updateShareUrlField();
    shareModal.style.display = '';
    requestAnimationFrame(() => {
      shareModal.classList.add('is-visible');
      shareModal.setAttribute('aria-hidden', 'false');
    });
  }

  function closeShareModal() {
    shareModal.classList.remove('is-visible');
    shareModal.setAttribute('aria-hidden', 'true');
    shareModal.addEventListener('transitionend', function handler() {
      shareModal.style.display = 'none';
      shareModal.removeEventListener('transitionend', handler);
    });
  }

  function syncShareCardStyles() {
    if (shareModeView.checked) {
      shareCardView.classList.add('is-selected');
      shareCardEdit.classList.remove('is-selected');
    } else {
      shareCardEdit.classList.add('is-selected');
      shareCardView.classList.remove('is-selected');
    }
  }

  shareModeView.addEventListener('change', function () {
    syncShareCardStyles();
    updateShareUrlField();
  });
  shareModeEdit.addEventListener('change', function () {
    syncShareCardStyles();
    updateShareUrlField();
  });

  shareCopyBtn.addEventListener('click', function () {
    const url = shareUrlInput.value;
    if (!url || shareCopyBtn.disabled) return;

    function onCopied() {
      const orig = shareCopyBtn.innerHTML;
      shareCopyBtn.innerHTML = '<i class="bi bi-check-lg"></i>';
      setTimeout(() => { shareCopyBtn.innerHTML = orig; }, 2000);
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(onCopied).catch(() => {});
    } else {
      try {
        const tmp = document.createElement('textarea');
        tmp.value = url;
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand('copy');
        document.body.removeChild(tmp);
        onCopied();
      } catch (_) {}
    }
  });

  shareModalCloseX.addEventListener('click', closeShareModal);
  shareModalClose.addEventListener('click', closeShareModal);
  shareModal.addEventListener('click', function (e) {
    if (e.target === shareModal) closeShareModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && shareModal.classList.contains('is-visible')) {
      closeShareModal();
    }
    
    // Global Ctrl+F / Cmd+F interception
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      openFindReplaceModal();
      const findInput = document.getElementById('find-replace-input');
      if (findInput) {
        findInput.focus();
        findInput.select();
      }
      return;
    }
    
    // Global Ctrl+H / Cmd+H interception
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      openFindReplaceModal();
      const replaceInput = document.getElementById('find-replace-with');
      if (replaceInput) {
        replaceInput.focus();
        replaceInput.select();
      }
      return;
    }
    
    // Global Escape dismissal for find-replace panel
    if (e.key === 'Escape' && isFindModalOpen) {
      e.preventDefault();
      closeFindReplaceModal();
      return;
    }
  });

  shareButton.addEventListener('click', openShareModal);
  mobileShareButton.addEventListener('click', openShareModal);

  function loadFromShareHash() {
    // PERF-002: Lazy-load pako when loading shared URL content
    if (typeof pako === 'undefined') {
      const hash = window.location.hash;
      if (!hash.startsWith('#share=')) return;
      loadScript(CDN.pako).then(function() {
        loadFromShareHash();
      }).catch(function(e) {
        console.error('Failed to load pako for shared URL:', e);
      });
      return;
    }
    const hash = window.location.hash;
    if (!hash.startsWith('#share=')) return;

    // Parse encoded content and optional &edit=1 flag.
    // Hash format: #share=<encoded>  or  #share=<encoded>&edit=1
    const rest = hash.slice('#share='.length);
    const ampIdx = rest.indexOf('&');
    const encoded = ampIdx === -1 ? rest : rest.slice(0, ampIdx);
    const params = ampIdx === -1 ? '' : rest.slice(ampIdx + 1);
    const isEdit = params.split('&').includes('edit=1');

    if (!encoded) return;
    try {
      const decoded = decodeMarkdownFromShare(encoded);
      markdownEditor.value = decoded;
      renderMarkdown({ reason: 'document-load', showSkeleton: true });
      saveCurrentTabState();
      // Apply the correct view mode: edit=1 → split, default → preview only
      setViewMode(isEdit ? 'split' : 'preview');
    } catch (e) {
      console.error("Failed to load shared content:", e);
      alert("The shared URL could not be decoded. It may be corrupted or incomplete.");
    }
  }

  loadFromShareHash();

  // Full-window drag-and-drop: track nesting level for reliable enter/leave detection
  let dragDepth = 0;

  document.addEventListener("dragenter", function(e) {
    if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      dragDepth++;
      dragOverlay.classList.add("active");
      dragOverlay.setAttribute("aria-hidden", "false");
    }
  }, false);

  document.addEventListener("dragover", function(e) {
    if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
    }
  }, false);

  document.addEventListener("dragleave", function(e) {
    if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes("Files")) {
      dragDepth--;
      if (dragDepth <= 0) {
        dragDepth = 0;
        dragOverlay.classList.remove("active");
        dragOverlay.setAttribute("aria-hidden", "true");
      }
    }
  }, false);

  document.addEventListener("drop", function(e) {
    e.preventDefault();
    dragDepth = 0;
    dragOverlay.classList.remove("active");
    dragOverlay.setAttribute("aria-hidden", "true");
    handleDrop(e);
  }, false);

  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length) {
      const file = files[0];
      const isMarkdownFile =
        file.type === "text/markdown" ||
        /\.(md|markdown)$/i.test(file.name || "");
      if (isMarkdownFile) {
        importMarkdownFile(file);
      } else {
        alert("Please upload a Markdown file (.md or .markdown)");
      }
    }
  }

  document.addEventListener("keydown", function (e) {
    if (document.activeElement === markdownEditor) {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        executeUndo();
        return;
      } else if ((isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'z') || (isCmdOrCtrl && e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        executeRedo();
        return;
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      exportMd.click();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "c") {
      const activeEl = document.activeElement;
      const isTextControl = activeEl && (activeEl.tagName === "TEXTAREA" || activeEl.tagName === "INPUT");
      const hasSelection = window.getSelection && window.getSelection().toString().trim().length > 0;
      const editorHasSelection = markdownEditor.selectionStart !== markdownEditor.selectionEnd;
      if (!isTextControl && !hasSelection && !editorHasSelection) {
        e.preventDefault();
        copyMarkdownButton.click();
      }
    }
    // Story 1.2: Only allow sync toggle shortcut when in split view
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (currentViewMode === 'split') {
        toggleSyncScrolling();
      }
    }
    const isDesktop = typeof Neutralino !== 'undefined';
    // New tab (Ctrl+T on desktop, Alt+Shift+T on web/desktop)
    if ((isDesktop && (e.ctrlKey || e.metaKey) && e.key === "t") || (e.altKey && e.shiftKey && e.key.toLowerCase() === "t")) {
      e.preventDefault();
      newTab();
    }
    // Close tab (Ctrl+W on desktop, Alt+Shift+W on web/desktop)
    if ((isDesktop && (e.ctrlKey || e.metaKey) && e.key === "w") || (e.altKey && e.shiftKey && e.key.toLowerCase() === "w")) {
      e.preventDefault();
      closeTab(activeTabId);
    }
    // Close Mermaid zoom modal with Escape
    if (e.key === "Escape") {
      closeTabMenus();
      closeMermaidModal();
    }
  });

  document.getElementById('tab-reset-btn').addEventListener('click', function() {
    resetAllTabs();
  });

  // ========================================
  // MERMAID DIAGRAM TOOLBAR
  // ========================================

  /**
   * Serialises an SVG element to a data URL suitable for use as an image source.
   * Inline styles and dimensions are preserved so the PNG matches the rendered diagram.
   */
  function svgToDataUrl(svgEl) {
    const clone = svgEl.cloneNode(true);
    // Ensure explicit width/height so the canvas has the right dimensions
    const bbox = svgEl.getBoundingClientRect();
    const intrinsicWidth = Number(svgEl.dataset.intrinsicWidth);
    const intrinsicHeight = Number(svgEl.dataset.intrinsicHeight);
    if (intrinsicWidth > 0 && intrinsicHeight > 0) clone.style.transform = 'none';
    if (!clone.getAttribute('width'))  clone.setAttribute('width',  Math.round(intrinsicWidth || bbox.width));
    if (!clone.getAttribute('height')) clone.setAttribute('height', Math.round(intrinsicHeight || bbox.height));
    const serialized = new XMLSerializer().serializeToString(clone);
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(serialized);
  }

  /**
   * Renders an SVG element onto a canvas and resolves with the canvas.
   */
  function svgToCanvas(svgEl) {
    return new Promise((resolve, reject) => {
      const bbox = svgEl.getBoundingClientRect();
      const scale = 2; // 2x scale for high quality without excessive file size
      const width  = Math.max(Math.round(Number(svgEl.dataset.intrinsicWidth) || bbox.width),  1);
      const height = Math.max(Math.round(Number(svgEl.dataset.intrinsicHeight) || bbox.height), 1);

      const canvas = document.createElement('canvas');
      canvas.width  = width  * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);

      // Fill background matching current theme using the CSS variable value
      const bgColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--bg-color').trim() || '#ffffff';
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);

      const img = new Image();
      img.onload  = () => { ctx.drawImage(img, 0, 0, width, height); resolve(canvas); };
      img.onerror = reject;
      img.src = svgToDataUrl(svgEl);
    });
  }

  // ========================================
  // SHARED DIAGRAM VIEWER
  // ========================================

  function getDiagramEngineLabel(engine) {
    const labels = {
      mermaid: 'Mermaid',
      abc: 'ABC notation'
    };
    return REMOTE_DIAGRAM_ENGINES[engine]?.label || labels[engine] || 'Diagram';
  }

  function setDiagramRenderState(container, state, message, retry) {
    if (!container) return;

    container.classList.toggle('is-loading', state === 'loading');
    container.classList.toggle('is-error', state === 'error');
    container.classList.toggle('is-ready', state === 'ready');
    const surface = container.querySelector('.diagram-surface');
    if (surface) surface.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');

    let status = container.querySelector(':scope > .diagram-status');
    if (!status) {
      status = document.createElement('div');
      status.className = 'diagram-status';
      status.setAttribute('role', 'status');
      container.insertBefore(status, container.firstChild);
    }

    status.replaceChildren();
    status.hidden = state === 'ready';
    if (state === 'ready') return;

    if (state === 'loading') {
      const spinner = document.createElement('span');
      spinner.className = 'diagram-status-spinner';
      spinner.setAttribute('aria-hidden', 'true');
      status.appendChild(spinner);
    } else {
      const icon = document.createElement('i');
      icon.className = 'bi bi-exclamation-triangle';
      icon.setAttribute('aria-hidden', 'true');
      status.appendChild(icon);
    }

    const text = document.createElement('span');
    text.textContent = message || (state === 'loading' ? 'Rendering diagram…' : 'Unable to render diagram.');
    status.appendChild(text);

    if (state === 'error' && typeof retry === 'function') {
      const retryButton = document.createElement('button');
      retryButton.type = 'button';
      retryButton.className = 'diagram-retry-btn';
      retryButton.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Retry';
      retryButton.addEventListener('click', retry);
      status.appendChild(retryButton);
    }
  }

  function createDiagramToolbarButton(action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'diagram-toolbar-btn';
    button.title = action.title;
    button.setAttribute('aria-label', action.ariaLabel || action.title);
    button.innerHTML = action.html;
    button.addEventListener('click', () => action.onClick(button));
    return button;
  }

  function mountDiagramViewer(container, engine, extraActions = []) {
    if (!container) return;
    const surface = container.querySelector('.diagram-surface') || container;
    const svg = surface.querySelector('svg');
    if (!svg) return;

    container.classList.add('diagram-viewer');
    container.setAttribute('data-diagram-engine', engine);
    surface.classList.add('diagram-surface');
    let source = '';
    try {
      source = decodeURIComponent(surface.getAttribute('data-original-code') || '');
    } catch (error) {
      source = surface.getAttribute('data-original-code') || '';
    }
    normalizeDiagramSvg(surface, engine, source);
    svg.setAttribute('aria-label', `${getDiagramEngineLabel(engine)} diagram`);

    container.querySelectorAll(':scope > .diagram-toolbar, :scope > .mermaid-toolbar, :scope > .abc-toolbar, :scope > .plantuml-toolbar, :scope > .d2-toolbar, :scope > .graphviz-toolbar').forEach(toolbar => toolbar.remove());

    const toolbar = document.createElement('div');
    toolbar.className = 'diagram-toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', `${getDiagramEngineLabel(engine)} diagram actions`);

    extraActions.forEach(action => toolbar.appendChild(createDiagramToolbarButton(action)));
    const actions = [
      {
        title: 'Open diagram viewer',
        ariaLabel: 'Open diagram viewer with zoom and pan controls',
        html: '<i class="bi bi-arrows-fullscreen"></i>',
        onClick: () => openMermaidZoomModal(container)
      },
      {
        title: 'Copy image to clipboard',
        html: '<i class="bi bi-clipboard-image"></i> Copy',
        onClick: button => copyMermaidImage(container, button)
      },
      {
        title: 'Download PNG',
        html: '<i class="bi bi-file-image"></i> PNG',
        onClick: button => downloadMermaidPng(container, button)
      },
      {
        title: 'Download SVG',
        html: '<i class="bi bi-filetype-svg"></i> SVG',
        onClick: button => downloadMermaidSvg(container, button)
      }
    ];
    actions.forEach(action => toolbar.appendChild(createDiagramToolbarButton(action)));
    container.appendChild(toolbar);
  }

  // ========================================
  // ABC DIAGRAM PLAYBACK AND EXPORT
  // ========================================

  function CursorControl(containerNode) {
    const self = this;
    self.container = containerNode;
    self.cursor = null;
    self.currentElements = [];

    self.onStart = function() {
      const svg = self.container.querySelector('svg');
      if (!svg) return;
      
      const oldCursor = svg.querySelector('.abcjs-cursor');
      if (oldCursor) oldCursor.remove();

      self.cursor = document.createElementNS("http://www.w3.org/2000/svg", "line");
      self.cursor.setAttribute("class", "abcjs-cursor");
      self.cursor.setAttribute("x1", "0");
      self.cursor.setAttribute("y1", "0");
      self.cursor.setAttribute("x2", "0");
      self.cursor.setAttribute("y2", "0");
      svg.appendChild(self.cursor);
    };

    self.onEvent = function(ev) {
      self.removeHighlight();

      if (ev.elements) {
        ev.elements.forEach(note => {
          note.forEach(el => {
            el.classList.add("abcjs-highlight");
            self.currentElements.push(el);
          });
        });
      }

      if (self.cursor && typeof ev.left === 'number') {
        const svg = self.container.querySelector('svg');
        if (svg) {
          const x = ev.left;
          const y1 = ev.top || 0;
          const y2 = (ev.top + ev.height) || svg.viewBox.baseVal.height || 500;
          
          self.cursor.setAttribute("x1", x);
          self.cursor.setAttribute("x2", x);
          self.cursor.setAttribute("y1", y1);
          self.cursor.setAttribute("y2", y2);
          self.cursor.style.display = "block";
        }
      }
    };

    self.removeHighlight = function() {
      self.currentElements.forEach(el => {
        el.classList.remove("abcjs-highlight");
      });
      self.currentElements = [];
    };

    self.onFinished = function() {
      self.removeHighlight();
      if (self.cursor) {
        self.cursor.remove();
        self.cursor = null;
      }
    };
  }

  function toggleAbcPlay(visualObj, btn, container) {
    if (!visualObj || !visualObj[0]) return;

    if (activeAbcBtn === btn) {
      stopActiveAbcPlayback();
      return;
    }

    stopActiveAbcPlayback();

    if (!ABCJS.synth.supportsAudio()) {
      alert("Audio playback is not supported in this browser.");
      return;
    }

    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Loading...';
    activeAbcBtn = btn;

    try {
      const synth = new ABCJS.synth.CreateSynth();
      activeAbcSynth = synth;

      const cursorControl = new CursorControl(container);

      const timingCallbacks = new ABCJS.TimingCallbacks(visualObj[0], {
        eventCallback: function(ev) {
          if (ev) {
            cursorControl.onEvent(ev);
          } else {
            cursorControl.onFinished();
          }
        }
      });
      activeAbcTimingCallbacks = timingCallbacks;

      synth.init({
        visualObj: visualObj[0],
        options: {
          onEnded: function() {
            if (activeAbcSynth === synth) {
              stopActiveAbcPlayback();
            }
          }
        }
      })
      .then(function() {
        if (activeAbcSynth !== synth) return;
        return synth.prime();
      })
      .then(function() {
        if (activeAbcSynth !== synth) return;
        
        cursorControl.onStart();
        timingCallbacks.start();

        btn.innerHTML = '<i class="bi bi-stop-fill"></i> Stop';
        btn.setAttribute('aria-label', 'Stop playback');
        return synth.start();
      })
      .catch(function(err) {
        console.error("ABC synth initialization failed:", err);
        btn.innerHTML = originalHtml;
        if (activeAbcBtn === btn) {
          activeAbcBtn = null;
        }
        if (activeAbcSynth === synth) {
          activeAbcSynth = null;
        }
        if (activeAbcTimingCallbacks === timingCallbacks) {
          activeAbcTimingCallbacks = null;
        }
        cursorControl.onFinished();
      });
    } catch (e) {
      console.error("ABC audio setup error:", e);
      btn.innerHTML = originalHtml;
      activeAbcBtn = null;
      activeAbcSynth = null;
      activeAbcTimingCallbacks = null;
    }
  }

  /** Downloads the ABC score in the given container as a PNG file. */
  async function downloadAbcPng(container, btn) {
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
    try {
      const canvas = await svgToCanvas(svgEl);
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `score-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        btn.innerHTML = '<i class="bi bi-check-lg"></i>';
        setTimeout(() => { btn.innerHTML = original; }, 1500);
      }, 'image/png');
    } catch (e) {
      console.error('ABC PNG export failed:', e);
      btn.innerHTML = original;
    }
  }

  /** Copies the ABC score in the given container as a PNG image to the clipboard. */
  async function copyAbcImage(container, btn) {
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
    try {
      const canvas = await svgToCanvas(svgEl);
      canvas.toBlob(async blob => {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          btn.innerHTML = '<i class="bi bi-check-lg"></i> Copied!';
        } catch (clipErr) {
          console.error('Clipboard write failed:', clipErr);
          btn.innerHTML = '<i class="bi bi-x-lg"></i>';
        }
        setTimeout(() => { btn.innerHTML = original; }, 1800);
      }, 'image/png');
    } catch (e) {
      console.error('ABC copy failed:', e);
      btn.innerHTML = original;
    }
  }

  /** Downloads the SVG source of the ABC score. */
  function downloadAbcSvg(container, btn) {
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;
    const clone = svgEl.cloneNode(true);
    const serialized = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([serialized], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `score-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-check-lg"></i>';
    setTimeout(() => { btn.innerHTML = original; }, 1500);
  }

  /** Downloads the diagram in the given container as a PNG file. */
  async function downloadMermaidPng(container, btn) {
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
    try {
      const canvas = await svgToCanvas(svgEl);
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `diagram-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        btn.innerHTML = '<i class="bi bi-check-lg"></i>';
        setTimeout(() => { btn.innerHTML = original; }, 1500);
      }, 'image/png');
    } catch (e) {
      console.error('Mermaid PNG export failed:', e);
      btn.innerHTML = original;
    }
  }

  /** Copies the diagram in the given container as a PNG image to the clipboard. */
  async function copyMermaidImage(container, btn) {
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
    try {
      const canvas = await svgToCanvas(svgEl);
      canvas.toBlob(async blob => {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          btn.innerHTML = '<i class="bi bi-check-lg"></i> Copied!';
        } catch (clipErr) {
          console.error('Clipboard write failed:', clipErr);
          btn.innerHTML = '<i class="bi bi-x-lg"></i>';
        }
        setTimeout(() => { btn.innerHTML = original; }, 1800);
      }, 'image/png');
    } catch (e) {
      console.error('Mermaid copy failed:', e);
      btn.innerHTML = original;
    }
  }

  /** Downloads the SVG source of a diagram. */
  function downloadMermaidSvg(container, btn) {
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;
    const clone = svgEl.cloneNode(true);
    const serialized = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([serialized], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagram-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-check-lg"></i>';
    setTimeout(() => { btn.innerHTML = original; }, 1500);
  }

  // ---- Zoom modal state ----
  let modalZoomScale = 1;
  let modalPanX = 0;
  let modalPanY = 0;
  let modalIsDragging = false;
  let modalDragStart = { x: 0, y: 0 };
  let modalCurrentSvgEl = null;

  const mermaidZoomModal   = document.getElementById('mermaid-zoom-modal');
  const mermaidModalDiagram = document.getElementById('mermaid-modal-diagram');

  function applyModalTransform() {
    if (modalCurrentSvgEl) {
      modalCurrentSvgEl.style.transform =
        `translate(${modalPanX}px, ${modalPanY}px) scale(${modalZoomScale})`;
    }
  }

  function closeMermaidModal() {
    if (!mermaidZoomModal.classList.contains('active')) return;
    mermaidZoomModal.classList.remove('active');
    mermaidZoomModal.setAttribute('aria-hidden', 'true');
    // PERF-007: Clear elements using textContent
    mermaidModalDiagram.textContent = '';
    mermaidModalDiagram.style.backgroundColor = '';
    modalCurrentSvgEl = null;
    modalZoomScale = 1;
    modalPanX = 0;
    modalPanY = 0;
  }

  function getDiagramBackdropColor(element) {
    let current = element;
    while (current) {
      const color = getComputedStyle(current).backgroundColor;
      if (color && color !== 'transparent' && !/^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/i.test(color)) {
        return color;
      }
      current = current.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  }

  /** Opens the zoom modal with the SVG from the given container. */
  function openMermaidZoomModal(container) {
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;

    // PERF-007: Clear elements using textContent
    mermaidModalDiagram.textContent = '';
    modalZoomScale = 1;
    modalPanX = 0;
    modalPanY = 0;

    const svgClone = svgEl.cloneNode(true);
    const renderedStyle = getComputedStyle(svgEl);
    const viewBox = svgEl.viewBox && svgEl.viewBox.baseVal;
    const renderedBounds = svgEl.getBoundingClientRect();
    const intrinsicWidth = viewBox && viewBox.width > 0 ? viewBox.width : renderedBounds.width;
    const intrinsicHeight = viewBox && viewBox.height > 0 ? viewBox.height : renderedBounds.height;
    svgClone.removeAttribute('width');
    svgClone.removeAttribute('height');
    svgClone.style.width = `${Math.max(intrinsicWidth, 1)}px`;
    svgClone.style.height = `${Math.max(intrinsicHeight, 1)}px`;
    svgClone.style.maxWidth = 'none';
    svgClone.style.maxHeight = 'none';
    svgClone.style.transformOrigin = 'center';
    // The preview applies engine-specific theme correction on the SVG root.
    // Preserve that computed appearance after the clone leaves its renderer
    // container, where those selectors no longer match.
    svgClone.style.filter = renderedStyle.filter;
    svgClone.style.backgroundColor = renderedStyle.backgroundColor;
    svgClone.style.color = renderedStyle.color;
    svgClone.style.opacity = renderedStyle.opacity;
    svgClone.dataset.intrinsicWidth = String(Math.max(intrinsicWidth, 1));
    svgClone.dataset.intrinsicHeight = String(Math.max(intrinsicHeight, 1));
    mermaidModalDiagram.style.backgroundColor = getDiagramBackdropColor(container);
    mermaidModalDiagram.appendChild(svgClone);
    modalCurrentSvgEl = svgClone;

    const engine = container.getAttribute('data-diagram-engine') || 'diagram';
    const title = document.getElementById('diagram-modal-title');
    if (title) title.textContent = `${getDiagramEngineLabel(engine)} Viewer`;
    mermaidZoomModal.classList.add('active');
    mermaidZoomModal.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(fitModalDiagram);
  }

  function fitModalDiagram() {
    if (!modalCurrentSvgEl) return;
    const width = Number(modalCurrentSvgEl.dataset.intrinsicWidth) || modalCurrentSvgEl.getBoundingClientRect().width;
    const height = Number(modalCurrentSvgEl.dataset.intrinsicHeight) || modalCurrentSvgEl.getBoundingClientRect().height;
    const availableWidth = Math.max(mermaidModalDiagram.clientWidth - 32, 1);
    const availableHeight = Math.max(mermaidModalDiagram.clientHeight - 32, 1);
    modalZoomScale = Math.min(availableWidth / width, availableHeight / height, 10);
    modalPanX = 0;
    modalPanY = 0;
    applyModalTransform();
  }

  // Modal close button
  document.getElementById('mermaid-modal-close').addEventListener('click', closeMermaidModal);
  // Click backdrop to close
  mermaidZoomModal.addEventListener('click', function(e) {
    if (e.target === mermaidZoomModal) closeMermaidModal();
  });

  // Zoom controls
  document.getElementById('mermaid-modal-zoom-in').addEventListener('click', () => {
    modalZoomScale = Math.min(modalZoomScale + 0.25, 10);
    applyModalTransform();
  });
  document.getElementById('mermaid-modal-zoom-out').addEventListener('click', () => {
    modalZoomScale = Math.max(modalZoomScale - 0.25, 0.1);
    applyModalTransform();
  });
  document.getElementById('mermaid-modal-zoom-reset').addEventListener('click', () => {
    modalZoomScale = 1; modalPanX = 0; modalPanY = 0;
    applyModalTransform();
  });
  document.getElementById('mermaid-modal-zoom-fit').addEventListener('click', fitModalDiagram);

  // Mouse-wheel zoom inside modal
  mermaidModalDiagram.addEventListener('wheel', function(e) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    modalZoomScale = Math.min(Math.max(modalZoomScale + delta, 0.1), 10);
    applyModalTransform();
  }, { passive: false });

  // Pointer events provide the same pan behavior for mouse, pen, and touch.
  mermaidModalDiagram.addEventListener('pointerdown', function(e) {
    if (!modalCurrentSvgEl) return;
    modalIsDragging = true;
    modalDragStart = { x: e.clientX - modalPanX, y: e.clientY - modalPanY };
    mermaidModalDiagram.classList.add('dragging');
    mermaidModalDiagram.setPointerCapture(e.pointerId);
  });
  mermaidModalDiagram.addEventListener('pointermove', function(e) {
    if (!modalIsDragging) return;
    modalPanX = e.clientX - modalDragStart.x;
    modalPanY = e.clientY - modalDragStart.y;
    applyModalTransform();
  });
  function finishModalPan() {
    if (modalIsDragging) {
      modalIsDragging = false;
      mermaidModalDiagram.classList.remove('dragging');
    }
  }
  mermaidModalDiagram.addEventListener('pointerup', finishModalPan);
  mermaidModalDiagram.addEventListener('pointercancel', finishModalPan);

  // Modal download buttons (operate on the currently displayed SVG or Image)
  document.getElementById('mermaid-modal-download-png').addEventListener('click', async function() {
    if (!modalCurrentSvgEl) return;
    const btn = this;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
    try {
      if (modalCurrentSvgEl.tagName.toLowerCase() === 'img') {
        const pngUrl = modalCurrentSvgEl.src.replace('/svg/', '/png/');
        const res = await fetch(pngUrl);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `diagram-${Date.now()}.png`; a.click();
        URL.revokeObjectURL(url);
        btn.innerHTML = '<i class="bi bi-check-lg"></i>';
        setTimeout(() => { btn.innerHTML = original; }, 1500);
      } else {
        // Use the original SVG (with dimensions) for proper PNG rendering
        const canvas = await svgToCanvas(modalCurrentSvgEl);
        canvas.toBlob(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `diagram-${Date.now()}.png`; a.click();
          URL.revokeObjectURL(url);
          btn.innerHTML = '<i class="bi bi-check-lg"></i>';
          setTimeout(() => { btn.innerHTML = original; }, 1500);
        }, 'image/png');
      }
    } catch (e) {
      console.error('Modal PNG export failed:', e);
      btn.innerHTML = original;
    }
  });

  document.getElementById('mermaid-modal-copy').addEventListener('click', async function() {
    if (!modalCurrentSvgEl) return;
    const btn = this;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
    try {
      if (modalCurrentSvgEl.tagName.toLowerCase() === 'img') {
        const pngUrl = modalCurrentSvgEl.src.replace('/svg/', '/png/');
        const res = await fetch(pngUrl);
        const blob = await res.blob();
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          btn.innerHTML = '<i class="bi bi-check-lg"></i> Copied!';
        } catch (clipErr) {
          console.error('Clipboard write failed:', clipErr);
          btn.innerHTML = '<i class="bi bi-x-lg"></i>';
        }
        setTimeout(() => { btn.innerHTML = original; }, 1800);
      } else {
        const canvas = await svgToCanvas(modalCurrentSvgEl);
        canvas.toBlob(async blob => {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            btn.innerHTML = '<i class="bi bi-check-lg"></i> Copied!';
          } catch (clipErr) {
            console.error('Clipboard write failed:', clipErr);
            btn.innerHTML = '<i class="bi bi-x-lg"></i>';
          }
          setTimeout(() => { btn.innerHTML = original; }, 1800);
        }, 'image/png');
      }
    } catch (e) {
      console.error('Modal copy failed:', e);
      btn.innerHTML = original;
    }
  });

  document.getElementById('mermaid-modal-download-svg').addEventListener('click', function() {
    if (!modalCurrentSvgEl) return;
    if (modalCurrentSvgEl.tagName.toLowerCase() === 'img') {
      fetch(modalCurrentSvgEl.src)
        .then(res => res.blob())
        .then(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `diagram-${Date.now()}.svg`; a.click();
          URL.revokeObjectURL(url);
        })
        .catch(e => console.error('Modal SVG download failed:', e));
    } else {
      const exportSvg = modalCurrentSvgEl.cloneNode(true);
      exportSvg.style.transform = 'none';
      delete exportSvg.dataset.intrinsicWidth;
      delete exportSvg.dataset.intrinsicHeight;
      const serialized = new XMLSerializer().serializeToString(exportSvg);
      const blob = new Blob([serialized], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `diagram-${Date.now()}.svg`; a.click();
      URL.revokeObjectURL(url);
    }
  });

  // ==========================================================================
  // PLANTUML TOOLBARS & EXPORT ENGINE
  // ==========================================================================

  /** Adds a solid white background to a transparent PNG blob. */
  function addWhiteBackgroundToPngBlob(blob) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(url);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(newBlob => {
            if (newBlob) {
              resolve(newBlob);
            } else {
              reject(new Error('Canvas toBlob failed'));
            }
          }, 'image/png');
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image for background addition'));
      };
      img.src = url;
    });
  }

  async function getSvgOriginalDimensions(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const text = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      if (!svg) return null;
      
      let width = parseFloat(svg.getAttribute('width'));
      let height = parseFloat(svg.getAttribute('height'));
      
      const viewBox = svg.getAttribute('viewBox');
      if (viewBox) {
        const parts = viewBox.trim().split(/\s+/);
        if (parts.length === 4) {
          const vbWidth = parseFloat(parts[2]);
          const vbHeight = parseFloat(parts[3]);
          if (!isNaN(vbWidth) && !isNaN(vbHeight)) {
            width = vbWidth;
            height = vbHeight;
          }
        }
      }
      
      if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
        return { width, height, text };
      }
    } catch (e) {
      console.warn('Failed to parse SVG dimensions:', e);
    }
    return null;
  }

  /** Generates a high-quality PNG blob from a rendered diagram image. */
  async function getDiagramPngBlob(imgEl, pngUrl) {
    // Attempt to fetch SVG text to parse the exact original coordinates (viewBox)
    const originalDim = await getSvgOriginalDimensions(imgEl.src);

    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        const scale = 2; // 2x scale for high quality without being excessively large
        
        let width = imgEl.naturalWidth || imgEl.width || 800;
        let height = imgEl.naturalHeight || imgEl.height || 600;
        
        if (originalDim) {
          width = originalDim.width;
          height = originalDim.height;
        }
        
        canvas.width = width * scale;
        canvas.height = height * scale;
        
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.scale(scale, scale);
        
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(blob => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas toBlob failed'));
            }
          }, 'image/png');
        };
        img.onerror = () => {
          // Fallback to direct imgEl drawing if data URL loading fails
          try {
            ctx.drawImage(imgEl, 0, 0, width, height);
            canvas.toBlob(blob => {
              if (blob) resolve(blob);
              else reject(new Error('Canvas toBlob failed'));
            }, 'image/png');
          } catch (err) {
            reject(err);
          }
        };
        
        if (originalDim && originalDim.text) {
          const blob = new Blob([originalDim.text], { type: 'image/svg+xml;charset=utf-8' });
          img.src = URL.createObjectURL(blob);
        } else {
          img.src = imgEl.src;
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  /** Helper to download an SVG diagram with fallback if fetch fails. */
  async function downloadSvgHelper(imgEl, filename, btn, originalHtml) {
    try {
      const res = await fetch(imgEl.src);
      if (!res.ok) throw new Error(`HTTP status ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      btn.innerHTML = '<i class="bi bi-check-lg"></i>';
      setTimeout(() => { btn.innerHTML = originalHtml; }, 1500);
    } catch (e) {
      console.warn('SVG fetch download failed, attempting fallback direct link download:', e);
      try {
        const a = document.createElement('a');
        a.href = imgEl.src;
        a.download = filename;
        a.target = '_blank';
        a.click();
        btn.innerHTML = '<i class="bi bi-check-lg"></i>';
      } catch (err) {
        console.error('SVG download completely failed:', err);
        btn.innerHTML = '<i class="bi bi-x-lg"></i>';
      }
      setTimeout(() => { btn.innerHTML = originalHtml; }, 1500);
    }
  }

  /** Downloads the PlantUML diagram in the given container as a PNG file. */
  async function downloadPlantumlPng(container, btn) {
    const imgEl = container.querySelector('img');
    if (!imgEl) return;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
    try {
      const pngUrl = imgEl.src.replace('/svg/', '/png/');
      const blob = await getDiagramPngBlob(imgEl, pngUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diagram-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      btn.innerHTML = '<i class="bi bi-check-lg"></i>';
      setTimeout(() => { btn.innerHTML = original; }, 1500);
    } catch (e) {
      console.error('PlantUML PNG export failed:', e);
      btn.innerHTML = original;
    }
  }

  /** Copies the PlantUML diagram in the given container as a PNG image to the clipboard. */
  async function copyPlantumlImage(container, btn) {
    const imgEl = container.querySelector('img');
    if (!imgEl) return;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
    try {
      const pngUrl = imgEl.src.replace('/svg/', '/png/');
      const blob = await getDiagramPngBlob(imgEl, pngUrl);
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        btn.innerHTML = '<i class="bi bi-check-lg"></i> Copied!';
      } catch (clipErr) {
        console.error('Clipboard write failed:', clipErr);
        btn.innerHTML = '<i class="bi bi-x-lg"></i>';
      }
      setTimeout(() => { btn.innerHTML = original; }, 1800);
    } catch (e) {
      console.error('PlantUML copy failed:', e);
      btn.innerHTML = original;
    }
  }

  /** Downloads the SVG source of a PlantUML diagram. */
  async function downloadPlantumlSvg(container, btn) {
    const imgEl = container.querySelector('img');
    if (!imgEl) return;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
    await downloadSvgHelper(imgEl, `diagram-${Date.now()}.svg`, btn, original);
  }

  /** Opens the zoom modal with the PlantUML image from the given container. */
  function openPlantumlZoomModal(container) {
    const imgEl = container.querySelector('img');
    if (!imgEl) return;

    mermaidModalDiagram.textContent = '';
    modalZoomScale = 1;
    modalPanX = 0;
    modalPanY = 0;

    const imgClone = imgEl.cloneNode(true);
    imgClone.removeAttribute('width');
    imgClone.removeAttribute('height');
    imgClone.style.width  = 'auto';
    imgClone.style.height = 'auto';
    imgClone.style.maxWidth  = '80vw';
    imgClone.style.maxHeight = '60vh';
    imgClone.style.transformOrigin = 'center';
    imgClone.draggable = false;
    imgClone.addEventListener('dragstart', e => e.preventDefault());
    mermaidModalDiagram.appendChild(imgClone);
    modalCurrentSvgEl = imgClone;

    mermaidZoomModal.classList.add('active');
  }

  function addPlantumlToolbars() {
    markdownPreview.querySelectorAll('.plantuml-container').forEach(container => {
      mountDiagramViewer(container, 'plantuml');
    });
  }

  // ==========================================================================
  // D2 TOOLBARS & EXPORT ENGINE
  // ==========================================================================

  /** Downloads the D2 diagram in the given container as a PNG file. */
  async function downloadD2Png(container, btn) {
    const imgEl = container.querySelector('img');
    if (!imgEl) return;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
    try {
      const pngUrl = imgEl.src.replace('/svg/', '/png/');
      const blob = await getDiagramPngBlob(imgEl, pngUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diagram-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      btn.innerHTML = '<i class="bi bi-check-lg"></i>';
      setTimeout(() => { btn.innerHTML = original; }, 1500);
    } catch (e) {
      console.error('D2 PNG export failed:', e);
      btn.innerHTML = original;
    }
  }

  /** Copies the D2 diagram in the given container as a PNG image to the clipboard. */
  async function copyD2Image(container, btn) {
    const imgEl = container.querySelector('img');
    if (!imgEl) return;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
    try {
      const pngUrl = imgEl.src.replace('/svg/', '/png/');
      const blob = await getDiagramPngBlob(imgEl, pngUrl);
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        btn.innerHTML = '<i class="bi bi-check-lg"></i> Copied!';
      } catch (clipErr) {
        console.error('Clipboard write failed:', clipErr);
        btn.innerHTML = '<i class="bi bi-x-lg"></i>';
      }
      setTimeout(() => { btn.innerHTML = original; }, 1800);
    } catch (e) {
      console.error('D2 copy failed:', e);
      btn.innerHTML = original;
    }
  }

  /** Downloads the SVG source of a D2 diagram. */
  async function downloadD2Svg(container, btn) {
    const imgEl = container.querySelector('img');
    if (!imgEl) return;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
    await downloadSvgHelper(imgEl, `diagram-${Date.now()}.svg`, btn, original);
  }

  /** Opens the zoom modal with the D2 image from the given container. */
  function openD2ZoomModal(container) {
    const imgEl = container.querySelector('img');
    if (!imgEl) return;

    mermaidModalDiagram.textContent = '';
    modalZoomScale = 1;
    modalPanX = 0;
    modalPanY = 0;

    const imgClone = imgEl.cloneNode(true);
    imgClone.removeAttribute('width');
    imgClone.removeAttribute('height');
    imgClone.style.width  = 'auto';
    imgClone.style.height = 'auto';
    imgClone.style.maxWidth  = '80vw';
    imgClone.style.maxHeight = '60vh';
    imgClone.style.transformOrigin = 'center';
    imgClone.draggable = false;
    imgClone.addEventListener('dragstart', e => e.preventDefault());
    mermaidModalDiagram.appendChild(imgClone);
    modalCurrentSvgEl = imgClone;

    mermaidZoomModal.classList.add('active');
  }

  function addD2Toolbars() {
    markdownPreview.querySelectorAll('.d2-container').forEach(container => {
      mountDiagramViewer(container, 'd2');
    });
  }

  // ==========================================================================
  // GRAPHVIZ TOOLBARS & EXPORT ENGINE
  // ==========================================================================

  /** Downloads the Graphviz diagram in the given container as a PNG file. */
  async function downloadGraphvizPng(container, btn) {
    const imgEl = container.querySelector('img');
    if (!imgEl) return;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
    try {
      const pngUrl = imgEl.src.replace('/svg/', '/png/');
      const blob = await getDiagramPngBlob(imgEl, pngUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diagram-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      btn.innerHTML = '<i class="bi bi-check-lg"></i>';
      setTimeout(() => { btn.innerHTML = original; }, 1500);
    } catch (e) {
      console.error('Graphviz PNG export failed:', e);
      btn.innerHTML = original;
    }
  }

  /** Copies the Graphviz diagram in the given container as a PNG image to the clipboard. */
  async function copyGraphvizImage(container, btn) {
    const imgEl = container.querySelector('img');
    if (!imgEl) return;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
    try {
      const pngUrl = imgEl.src.replace('/svg/', '/png/');
      const blob = await getDiagramPngBlob(imgEl, pngUrl);
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        btn.innerHTML = '<i class="bi bi-check-lg"></i> Copied!';
      } catch (clipErr) {
        console.error('Clipboard write failed:', clipErr);
        btn.innerHTML = '<i class="bi bi-x-lg"></i>';
      }
      setTimeout(() => { btn.innerHTML = original; }, 1800);
    } catch (e) {
      console.error('Graphviz copy failed:', e);
      btn.innerHTML = original;
    }
  }

  /** Downloads the SVG source of a Graphviz diagram. */
  async function downloadGraphvizSvg(container, btn) {
    const imgEl = container.querySelector('img');
    if (!imgEl) return;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
    await downloadSvgHelper(imgEl, `diagram-${Date.now()}.svg`, btn, original);
  }

  /** Opens the zoom modal with the Graphviz image from the given container. */
  function openGraphvizZoomModal(container) {
    const imgEl = container.querySelector('img');
    if (!imgEl) return;

    mermaidModalDiagram.textContent = '';
    modalZoomScale = 1;
    modalPanX = 0;
    modalPanY = 0;

    const imgClone = imgEl.cloneNode(true);
    imgClone.removeAttribute('width');
    imgClone.removeAttribute('height');
    imgClone.style.width  = 'auto';
    imgClone.style.height = 'auto';
    imgClone.style.maxWidth  = '80vw';
    imgClone.style.maxHeight = '60vh';
    imgClone.style.transformOrigin = 'center';
    imgClone.draggable = false;
    imgClone.addEventListener('dragstart', e => e.preventDefault());
    mermaidModalDiagram.appendChild(imgClone);
    modalCurrentSvgEl = imgClone;

    mermaidZoomModal.classList.add('active');
  }

  function addGraphvizToolbars() {
    markdownPreview.querySelectorAll('.graphviz-container').forEach(container => {
      mountDiagramViewer(container, 'graphviz');
    });
  }

  function zoomStl(view, factor) {
    if (!view || !view.camera || !view.controls) return;
    const camera = view.camera;
    const controls = view.controls;
    
    const target = controls.target;
    const position = camera.position;
    const offset = new THREE.Vector3().subVectors(position, target);
    
    offset.multiplyScalar(factor);
    
    position.copy(target).add(offset);
    controls.update();
  }

  function resetStlView(view) {
    if (!view || !view.camera || !view.controls || !view.initialPosition || !view.initialTarget) return;
    view.camera.position.copy(view.initialPosition);
    view.controls.target.copy(view.initialTarget);
    view.controls.update();
  }

  // STL Zoom Modal Event Listeners
  document.getElementById('stl-zoom-modal-close').addEventListener('click', closeStlZoomModal);
  document.getElementById('stl-zoom-modal').addEventListener('click', function(e) {
    if (e.target === this) closeStlZoomModal();
  });

  document.getElementById('stl-modal-btn-zoom-in').addEventListener('click', () => {
    if (activeModalStlView) zoomStl(activeModalStlView, 0.8);
  });

  document.getElementById('stl-modal-btn-zoom-out').addEventListener('click', () => {
    if (activeModalStlView) zoomStl(activeModalStlView, 1.25);
  });

  document.getElementById('stl-modal-btn-zoom-reset').addEventListener('click', () => {
    if (activeModalStlView) resetStlView(activeModalStlView);
  });

  const modalBtnSolid = document.getElementById('stl-modal-btn-solid');
  const modalBtnAngle = document.getElementById('stl-modal-btn-angle');
  const modalBtnWireframe = document.getElementById('stl-modal-btn-wireframe');
  
  const setModalActiveMode = (activeBtn) => {
    [modalBtnSolid, modalBtnAngle, modalBtnWireframe].forEach(btn => btn.classList.remove('active'));
    activeBtn.classList.add('active');
  };

  modalBtnSolid.addEventListener('click', () => {
    if (activeModalStlView) {
      activeModalStlView.solidMaterial.wireframe = false;
      activeModalStlView.mesh.material = activeModalStlView.solidMaterial;
      setModalActiveMode(modalBtnSolid);
    }
  });

  modalBtnAngle.addEventListener('click', () => {
    if (activeModalStlView) {
      activeModalStlView.mesh.material = activeModalStlView.normalMaterial;
      setModalActiveMode(modalBtnAngle);
    }
  });

  modalBtnWireframe.addEventListener('click', () => {
    if (activeModalStlView) {
      activeModalStlView.solidMaterial.wireframe = true;
      activeModalStlView.mesh.material = activeModalStlView.solidMaterial;
      setModalActiveMode(modalBtnWireframe);
    }
  });

  document.getElementById('stl-modal-btn-copy').addEventListener('click', function() {
    if (activeModalStlView) {
      exportStlImage(activeModalStlView, false, this, this.innerHTML);
    }
  });

  document.getElementById('stl-modal-btn-png').addEventListener('click', function() {
    if (activeModalStlView) {
      exportStlImage(activeModalStlView, true, this, this.innerHTML);
    }
  });

  /**
   * Adds the hover toolbar to every rendered Mermaid container.
   * Safe to call multiple times – existing toolbars are not duplicated.
   */
  function addMermaidToolbars() {
    markdownPreview.querySelectorAll('.mermaid-container').forEach(container => {
      mountDiagramViewer(container, 'mermaid');
    });
  }

  // ==========================================================================
  // Aegis SEO agency Multilingual & Internationalization (i18n) engine
  // ==========================================================================
  const I18N_DICTS = {
    en: {
      title: "Markdown Viewer",
      syncOff: "Sync Off",
      syncOn: "Sync On",
      import: "Import",
      importFile: "From files",
      importGithub: "From GitHub",
      export: "Export",
      exportMd: "Markdown (.md)",
      exportHtml: "HTML",
      exportPdf: "PDF",
      exportPng: "Image (.png)",
      copy: "Copy",
      copied: "Copied!",
      share: "Share",
      reset: "Reset",
      editor: "Editor",
      split: "Split",
      preview: "Preview",
      minRead: "Min Read",
      words: "Words",
      chars: "Chars",
      switchRtl: "Switch to RTL",
      switchLtr: "Switch to LTR",
      darkMode: "Dark Mode",
      lightMode: "Light Mode",
      helpTitle: "Markdown Viewer Help",
      aboutTitle: "About Markdown",
      shareTitle: "Share Document",
      renameTitle: "Rename file",
      insertLink: "Insert link",
      insertRef: "Insert reference",
      insertImg: "Insert image",
      insertTable: "Insert table",
      findReplace: "Find & Replace",
      placeholder: "Type your markdown here...",
      loadingEmojis: "Loading emojis...",
      loadingFiles: "Fetching file tree..."
    },
    zh: {
      title: "Markdown 阅读器",
      syncOff: "同步关闭",
      syncOn: "同步开启",
      import: "导入",
      importFile: "本地文件导入",
      importGithub: "从 GitHub 导入",
      export: "导出",
      exportMd: "导出 Markdown (.md)",
      exportHtml: "导出 HTML",
      exportPdf: "导出 PDF",
      exportPng: "Image (.png)",
      copy: "复制",
      copied: "已复制!",
      share: "分享",
      reset: "重置",
      editor: "编辑器",
      split: "分栏预览",
      preview: "纯预览",
      minRead: "分钟阅读",
      words: "字数",
      chars: "字符数",
      switchRtl: "切换为右至左布局",
      switchLtr: "切换为左至右布局",
      darkMode: "深色模式",
      lightMode: "浅色模式",
      helpTitle: "Markdown 阅读器帮助说明",
      aboutTitle: "关于 Markdown 阅读器",
      shareTitle: "分享当前文档",
      renameTitle: "重命名文件",
      insertLink: "插入超链接",
      insertRef: "插入脚注引用",
      insertImg: "插入图片",
      insertTable: "插入表格",
      findReplace: "查找与替换",
      placeholder: "在此输入您的 Markdown 文本...",
      loadingEmojis: "正在加载表情...",
      loadingFiles: "正在获取文件树..."
    },
    ja: {
      title: "Markdown ビューア",
      syncOff: "同期オフ",
      syncOn: "同期オン",
      import: "インポート",
      importFile: "ファイルから",
      importGithub: "GitHub から",
      export: "エクスポート",
      exportMd: "Markdown (.md)",
      exportHtml: "HTML",
      exportPdf: "PDF",
      exportPng: "Image (.png)",
      copy: "コピー",
      copied: "コピー完了!",
      share: "共有",
      reset: "リセット",
      editor: "エディタ",
      split: "分割表示",
      preview: "プレビュー",
      minRead: "分 読了",
      words: "単語数",
      chars: "文字数",
      switchRtl: "RTL表示に切替",
      switchLtr: "LTR表示に切替",
      darkMode: "ダークモード",
      lightMode: "ライトモード",
      helpTitle: "Markdown ビューア ヘルプ",
      aboutTitle: "Markdown について",
      shareTitle: "ドキュメントの共有",
      renameTitle: "ファイル名の変更",
      insertLink: "リンクの挿入",
      insertRef: "参照の挿入",
      insertImg: "画像の挿入",
      insertTable: "テーブルの挿入",
      findReplace: "検索と置換",
      placeholder: "ここにMarkdownを入力してください...",
      loadingEmojis: "絵文字を読み込んでいます...",
      loadingFiles: "ファイルツリーを取得しています..."
    },
    ko: {
      title: "마크다운 뷰어",
      syncOff: "동기화 끄기",
      syncOn: "동기화 켜기",
      import: "가져오기",
      importFile: "로컬 파일에서",
      importGithub: "GitHub에서",
      export: "내보내기",
      exportMd: "마크다운 (.md)",
      exportHtml: "HTML로 내보내기",
      exportPdf: "PDF로 내보내기",
      exportPng: "Image (.png)",
      copy: "복사",
      copied: "복사됨!",
      share: "공유",
      reset: "초기화",
      editor: "편집기",
      split: "분할 보기",
      preview: "미리보기",
      minRead: "분 읽기",
      words: "단어 수",
      chars: "글자 수",
      switchRtl: "우측 정렬로 전환",
      switchLtr: "좌측 정렬로 전환",
      darkMode: "다크 모드",
      lightMode: "라이트 모드",
      helpTitle: "마크다운 뷰어 도움말",
      aboutTitle: "마크다운 정보",
      shareTitle: "문서 공유",
      renameTitle: "파일 이름 바꾸기",
      insertLink: "링크 삽입",
      insertRef: "참조 삽입",
      insertImg: "이미지 삽입",
      insertTable: "표 삽입",
      findReplace: "찾기 및 바꾸기",
      placeholder: "여기에 마크다운 내용을 입력하세요...",
      loadingEmojis: "이모지 로딩 중...",
      loadingFiles: "파일 트리 가져오는 중..."
    },
    pt: {
      title: "Visualizador de Markdown",
      syncOff: "Desativar Sincronia",
      syncOn: "Ativar Sincronia",
      import: "Importar",
      importFile: "De arquivos",
      importGithub: "Do GitHub",
      export: "Exportar",
      exportMd: "Markdown (.md)",
      exportHtml: "HTML",
      exportPdf: "PDF",
      exportPng: "Image (.png)",
      copy: "Copiar",
      copied: "Copiado!",
      share: "Compartilhar",
      reset: "Redefinir",
      editor: "Editor",
      split: "Dividido",
      preview: "Visualizar",
      minRead: "Min de leitura",
      words: "Palavras",
      chars: "Caracteres",
      switchRtl: "Mudar para RTL",
      switchLtr: "Mudar para LTR",
      darkMode: "Modo Escuro",
      lightMode: "Modo Claro",
      helpTitle: "Ajuda do Visualizador de Markdown",
      aboutTitle: "Sobre o Markdown",
      shareTitle: "Compartilhar Documento",
      renameTitle: "Renomear arquivo",
      insertLink: "Inserir link",
      insertRef: "Inserir referência",
      insertImg: "Inserir imagem",
      insertTable: "Inserir tabela",
      findReplace: "Localizar & Substituir",
      placeholder: "Digite seu markdown aqui...",
      loadingEmojis: "Carregando emojis...",
      loadingFiles: "Buscando árvore de arquivos..."
    },
    es: {
      title: "Visualizador de Markdown",
      syncOff: "Sincronización desactivada",
      syncOn: "Sincronización activada",
      import: "Importar",
      importFile: "Desde archivos",
      importGithub: "Desde GitHub",
      export: "Exportar",
      exportMd: "Markdown (.md)",
      exportHtml: "HTML",
      exportPdf: "PDF",
      exportPng: "Image (.png)",
      copy: "Copiar",
      copied: "¡Copiado!",
      share: "Compartir",
      reset: "Restablecer",
      editor: "Editor",
      split: "Dividido",
      preview: "Previsualizar",
      minRead: "Min de lectura",
      words: "Palabras",
      chars: "Caracteres",
      switchRtl: "Cambiar a RTL",
      switchLtr: "Cambiar a LTR",
      darkMode: "Modo oscuro",
      lightMode: "Modo claro",
      helpTitle: "Ayuda del Visualizador de Markdown",
      aboutTitle: "Acerca de Markdown",
      shareTitle: "Compartir documento",
      renameTitle: "Renombrar archivo",
      insertLink: "Insertar enlace",
      insertRef: "Insertar referencia",
      insertImg: "Insertar imagen",
      insertTable: "Insertar tabla",
      findReplace: "Buscar y reemplazar",
      placeholder: "Escribe tu markdown aquí...",
      loadingEmojis: "Cargando emojis...",
      loadingFiles: "Obteniendo árbol de archivos..."
    },
    fr: {
      title: "Lecteur Markdown",
      syncOff: "Désactiver la synchro",
      syncOn: "Activer la synchro",
      import: "Importer",
      importFile: "Depuis des fichiers",
      importGithub: "Depuis GitHub",
      export: "Exporter",
      exportMd: "Markdown (.md)",
      exportHtml: "HTML",
      exportPdf: "PDF",
      exportPng: "Image (.png)",
      copy: "Copier",
      copied: "Copié !",
      share: "Partager",
      reset: "Réinitialiser",
      editor: "Éditeur",
      split: "Divisé",
      preview: "Aperçu",
      minRead: "Min de lecture",
      words: "Mots",
      chars: "Caractères",
      switchRtl: "Passer à RTL",
      switchLtr: "Passer à LTR",
      darkMode: "Mode sombre",
      lightMode: "Mode clair",
      helpTitle: "Aide du Lecteur Markdown",
      aboutTitle: "À propos de Markdown",
      shareTitle: "Partager le document",
      renameTitle: "Renommer le fichier",
      insertLink: "Insérer un lien",
      insertRef: "Insérer une référence",
      insertImg: "Insérer une image",
      insertTable: "Insérer un tableau",
      findReplace: "Rechercher & remplacer",
      placeholder: "Saisissez votre markdown ici...",
      loadingEmojis: "Chargement des émojis...",
      loadingFiles: "Récupération de l'arborescence des fichiers..."
    },
    de: {
      title: "Markdown Viewer",
      syncOff: "Synchronisierung aus",
      syncOn: "Synchronisierung an",
      import: "Importieren",
      importFile: "Aus Dateien",
      importGithub: "Aus GitHub",
      export: "Exportieren",
      exportMd: "Markdown (.md)",
      exportHtml: "HTML",
      exportPdf: "PDF",
      exportPng: "Image (.png)",
      copy: "Kopieren",
      copied: "Kopiert!",
      share: "Teilen",
      reset: "Zurücksetzen",
      editor: "Editor",
      split: "Geteilt",
      preview: "Vorschau",
      minRead: "Min. Lesezeit",
      words: "Wörter",
      chars: "Zeichen",
      switchRtl: "Zu RTL wechseln",
      switchLtr: "Zu LTR wechseln",
      darkMode: "Dunkelmodus",
      lightMode: "Heller Modus",
      helpTitle: "Markdown Viewer Hilfe",
      aboutTitle: "Über Markdown",
      shareTitle: "Dokument teilen",
      renameTitle: "Datei umbenennen",
      insertLink: "Link einfügen",
      insertRef: "Referenz einfügen",
      insertImg: "Bild einfügen",
      insertTable: "Tabelle einfügen",
      findReplace: "Suchen & Ersetzen",
      placeholder: "Geben Sie hier Ihr Markdown ein...",
      loadingEmojis: "Emojis werden geladen...",
      loadingFiles: "Dateibaum wird abgerufen..."
    },
    ru: {
      title: "Просмотрщик Markdown",
      syncOff: "Синхронизация выкл",
      syncOn: "Синхронизация вкл",
      import: "Импорт",
      importFile: "Из файлов",
      importGithub: "Из GitHub",
      export: "Экспорт",
      exportMd: "Markdown (.md)",
      exportHtml: "HTML",
      exportPdf: "PDF",
      exportPng: "Image (.png)",
      copy: "Копировать",
      copied: "Скопировано!",
      share: "Поделиться",
      reset: "Сбросить",
      editor: "Редактор",
      split: "Разделение",
      preview: "Предпросмотр",
      minRead: "Мин чтения",
      words: "Слов",
      chars: "Символов",
      switchRtl: "Переключить на RTL",
      switchLtr: "Переключить на LTR",
      darkMode: "Темная тема",
      lightMode: "Светлая тема",
      helpTitle: "Справка Markdown Viewer",
      aboutTitle: "О Markdown",
      shareTitle: "Поделиться документом",
      renameTitle: "Переименовать файл",
      insertLink: "Вставить ссылку",
      insertRef: "Вставить сноску",
      insertImg: "Вставить изображение",
      insertTable: "Вставить таблицу",
      findReplace: "Найти и заменить",
      placeholder: "Введите здесь ваш markdown...",
      loadingEmojis: "Загрузка эмодзи...",
      loadingFiles: "Получение списка файлов..."
    },
    it: {
      title: "Visualizzatore Markdown",
      syncOff: "Sincronia disattivata",
      syncOn: "Sincronia attivata",
      import: "Importa",
      importFile: "Da file",
      importGithub: "Da GitHub",
      export: "Esporta",
      exportMd: "Markdown (.md)",
      exportHtml: "HTML",
      exportPdf: "PDF",
      exportPng: "Image (.png)",
      copy: "Copia",
      copied: "Copiato!",
      share: "Condividi",
      reset: "Ripristina",
      editor: "Editor",
      split: "Diviso",
      preview: "Anteprima",
      minRead: "Min di lettura",
      words: "Parole",
      chars: "Caratteri",
      switchRtl: "Passa a RTL",
      switchLtr: "Passa a LTR",
      darkMode: "Tema scuro",
      lightMode: "Tema chiaro",
      helpTitle: "Aiuto di Visualizzatore Markdown",
      aboutTitle: "Informazioni su Markdown",
      shareTitle: "Condividi documento",
      renameTitle: "Rinomina file",
      insertLink: "Inserisci link",
      insertRef: "Inserisci riferimento",
      insertImg: "Inserisci immagine",
      insertTable: "Inserisci tabella",
      findReplace: "Trova e sostituisci",
      placeholder: "Scrivi il tuo markdown qui...",
      loadingEmojis: "Caricamento emoji...",
      loadingFiles: "Recupero albero dei file..."
    },
    tr: {
      title: "Markdown Görüntüleyici",
      syncOff: "Senkronizasyonu Kapat",
      syncOn: "Senkronizasyonu Aç",
      import: "İçe Aktar",
      importFile: "Dosyalardan",
      importGithub: "GitHub'dan",
      export: "Dışa Aktar",
      exportMd: "Markdown (.md)",
      exportHtml: "HTML",
      exportPdf: "PDF",
      exportPng: "Image (.png)",
      copy: "Kopyala",
      copied: "Kopyalandı!",
      share: "Paylaş",
      reset: "Sıfırla",
      editor: "Editör",
      split: "Bölünmüş",
      preview: "Önizleme",
      minRead: "Dk Okuma",
      words: "Kelime",
      chars: "Karakter",
      switchRtl: "RTL'ye Geç",
      switchLtr: "LTR'ye Geç",
      darkMode: "Karanlık Mod",
      lightMode: "Aydınlık Mod",
      helpTitle: "Markdown Görüntüleyici Yardımı",
      aboutTitle: "Markdown Hakkında",
      shareTitle: "Belgeyi Paylaş",
      renameTitle: "Dosyayı yeniden adlandır",
      insertLink: "Bağlantı ekle",
      insertRef: "Referans ekle",
      insertImg: "Resim ekle",
      insertTable: "Tablo ekle",
      findReplace: "Bul ve Değiştir",
      placeholder: "Markdown'ınızı buraya yazın...",
      loadingEmojis: "Emoji'ler yükleniyor...",
      loadingFiles: "Dosya ağacı alınıyor..."
    },
    pl: {
      title: "Czytnik Markdown",
      syncOff: "Wyłącz synchronizację",
      syncOn: "Włącz synchronizację",
      import: "Importuj",
      importFile: "Z plików",
      importGithub: "Z GitHub",
      export: "Eksportuj",
      exportMd: "Markdown (.md)",
      exportHtml: "HTML",
      exportPdf: "PDF",
      exportPng: "Image (.png)",
      copy: "Kopiuj",
      copied: "Skopiowano!",
      share: "Udostępnij",
      reset: "Resetuj",
      editor: "Edytor",
      split: "Podzielony",
      preview: "Podgląd",
      minRead: "Min. czytania",
      words: "Słowa",
      chars: "Znaki",
      switchRtl: "Przełącz na RTL",
      switchLtr: "Przełącz na LTR",
      darkMode: "Tryb ciemny",
      lightMode: "Tryb jasny",
      helpTitle: "Pomoc Czytnika Markdown",
      aboutTitle: "O Markdown",
      shareTitle: "Udostępnij dokument",
      renameTitle: "Zmień nazwę pliku",
      insertLink: "Wstaw link",
      insertRef: "Wstaw odnośnik",
      insertImg: "Wstaw obraz",
      insertTable: "Wstaw tabelę",
      findReplace: "Znajdź i zamień",
      placeholder: "Wpisz tutaj swój markdown...",
      loadingEmojis: "Ładowanie emoji...",
      loadingFiles: "Pobieranie drzewa plików..."
    },
    tw: {
      title: "Markdown 閱讀器",
      syncOff: "同步關閉",
      syncOn: "同步開啟",
      import: "匯入",
      importFile: "本地檔案匯入",
      importGithub: "從 GitHub 匯入",
      export: "匯出",
      exportMd: "匯出 Markdown (.md)",
      exportHtml: "匯出 HTML",
      exportPdf: "匯出 PDF",
      exportPng: "Image (.png)",
      copy: "複製",
      copied: "已複製!",
      share: "分享",
      reset: "重置",
      editor: "編輯器",
      split: "分欄預覽",
      preview: "純預覽",
      minRead: "分鐘閱讀",
      words: "字數",
      chars: "字元數",
      switchRtl: "切換為右至左佈局",
      switchLtr: "切換為左至右佈局",
      darkMode: "深色模式",
      lightMode: "淺色模式",
      helpTitle: "Markdown 閱讀器說明",
      aboutTitle: "關於 Markdown 閱讀器",
      shareTitle: "分享當前文件",
      renameTitle: "重新命名檔案",
      insertLink: "插入超連結",
      insertRef: "插入腳註引用",
      insertImg: "插入圖片",
      insertTable: "插入表格",
      findReplace: "尋找與取代",
      placeholder: "在此輸入您的 Markdown 文本...",
      loadingEmojis: "正在載入表情...",
      loadingFiles: "正在獲取檔案樹..."
    },
    uk: {
      title: "Переглядач Markdown",
      syncOff: "Вимкнути синхронізацію",
      syncOn: "Увімкнути синхронізацію",
      import: "Імпорт",
      importFile: "З файлів",
      importGithub: "З GitHub",
      export: "Експорт",
      exportMd: "Markdown (.md)",
      exportHtml: "HTML",
      exportPdf: "PDF",
      exportPng: "Image (.png)",
      copy: "Копіювати",
      copied: "Скопійовано!",
      share: "Поділитися",
      reset: "Скинути",
      editor: "Редактор",
      split: "Розділений",
      preview: "Перегляд",
      minRead: "Хв читання",
      words: "Слів",
      chars: "Символів",
      switchRtl: "Перемкнути на RTL",
      switchLtr: "Перемкнути на LTR",
      darkMode: "Темний режим",
      lightMode: "Світлий режим",
      helpTitle: "Довідка Markdown Viewer",
      aboutTitle: "Про Markdown",
      shareTitle: "Поділитися документом",
      renameTitle: "Перейменувати файл",
      insertLink: "Вставити посилання",
      insertRef: "Вставити витяг",
      insertImg: "Вставити зображення",
      insertTable: "Вставити таблицю",
      findReplace: "Знайти та замінити",
      placeholder: "Введіть ваш markdown тут...",
      loadingEmojis: "Завантаження емодзі...",
      loadingFiles: "Отримання структури файлів..."
    }
  };

  let activeLang = 'en';

  function applyTranslations(lang) {
    activeLang = lang;
    document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-Hans' : (lang === 'tw' ? 'zh-Hant' : lang));
    const dict = I18N_DICTS[lang] || I18N_DICTS.en;

    // Update main logo and header elements
    const logoEl = document.querySelector('.app-header h1');
    if (logoEl) logoEl.textContent = dict.title;

    // Update dynamic current language labels in drop menus
    const labelEl = document.getElementById('current-lang-label');
    if (labelEl) {
      const flags = {
        en: "🇺🇸 English",
        zh: "🇨🇳 简体中文",
        ja: "🇯🇵 日本語",
        ko: "🇰🇷 한국어",
        pt: "🇧🇷 Português (Brasil)",
        es: "🇪🇸 Español",
        fr: "🇫🇷 Français",
        de: "🇩🇪 Deutsch",
        ru: "🇷🇺 Русский",
        it: "🇮🇹 Italiano",
        tr: "🇹🇷 Türkçe",
        pl: "🇵🇱 Polski",
        tw: "🇹🇼 繁體中文",
        uk: "🇺🇦 Українська"
      };
      labelEl.textContent = flags[lang];
    }
    const mobileLabelEl = document.getElementById('mobile-current-lang-label');
    if (mobileLabelEl) {
      const flags = {
        en: "us English",
        zh: "CN 简体中文",
        ja: "JP 日本語",
        ko: "KR 한국어",
        pt: "BR Português (Brasil)",
        es: "ES Español",
        fr: "FR Français",
        de: "DE Deutsch",
        ru: "RU Русский",
        it: "IT Italiano",
        tr: "TR Türkçe",
        pl: "PL Polski",
        tw: "TW 繁體中文",
        uk: "UK Українська"
      };
      mobileLabelEl.textContent = flags[lang];
    }

    // Translate buttons with text content
    const toggleSyncEl = document.getElementById('toggle-sync');
    if (toggleSyncEl) {
      const isSyncActive = toggleSyncEl.classList.contains('sync-active');
      const textSpan = toggleSyncEl.querySelector('.btn-text');
      if (textSpan) textSpan.textContent = isSyncActive ? dict.syncOff : dict.syncOn;
    }
    const mobileToggleSyncEl = document.getElementById('mobile-toggle-sync');
    if (mobileToggleSyncEl) {
      const isSyncActive = mobileToggleSyncEl.classList.contains('sync-active');
      mobileToggleSyncEl.innerHTML = `<i class="bi bi-link"></i> ${isSyncActive ? dict.syncOff : dict.syncOn}`;
    }

    // Import buttons
    const importDropEl = document.getElementById('importDropdown');
    if (importDropEl) {
      const importText = importDropEl.querySelector('.btn-text');
      if (importText) importText.textContent = dict.import;
    }
    const importFileEl = document.getElementById('import-from-file');
    if (importFileEl) importFileEl.innerHTML = `<i class="bi bi-upload me-2"></i>${dict.importFile}`;
    const importGithubEl = document.getElementById('import-from-github');
    if (importGithubEl) importGithubEl.innerHTML = `<i class="bi bi-github me-2"></i>${dict.importGithub}`;

    const mImportFileEl = document.getElementById('mobile-import-button');
    if (mImportFileEl) mImportFileEl.innerHTML = `<i class="bi bi-upload me-2"></i>${dict.importFile}`;
    const mImportGithubEl = document.getElementById('mobile-import-github-button');
    if (mImportGithubEl) mImportGithubEl.innerHTML = `<i class="bi bi-github me-2"></i>${dict.importGithub}`;

    // Export buttons
    const exportDropEl = document.getElementById('exportDropdown');
    if (exportDropEl) {
      const exportText = exportDropEl.querySelector('.btn-text');
      if (exportText) exportText.textContent = dict.export;
    }
    const exportMdEl = document.getElementById('export-md');
    if (exportMdEl) exportMdEl.innerHTML = `<i class="bi bi-file-earmark-text me-2"></i>${dict.exportMd}`;
    const exportHtmlEl = document.getElementById('export-html');
    if (exportHtmlEl) exportHtmlEl.innerHTML = `<i class="bi bi-file-earmark-code me-2"></i>${dict.exportHtml}`;
    const exportPdfEl = document.getElementById('export-pdf');
    if (exportPdfEl) exportPdfEl.innerHTML = `<i class="bi bi-file-earmark-pdf me-2"></i>${dict.exportPdf}`;
    const exportPngEl = document.getElementById('export-png');
    if (exportPngEl) exportPngEl.innerHTML = `<i class="bi bi-file-earmark-image me-2"></i>${dict.exportPng}`;

    const mExportMdEl = document.getElementById('mobile-export-md');
    if (mExportMdEl) mExportMdEl.innerHTML = `<i class="bi bi-file-earmark-text me-2"></i>${dict.exportMd}`;
    const mExportHtmlEl = document.getElementById('mobile-export-html');
    if (mExportHtmlEl) mExportHtmlEl.innerHTML = `<i class="bi bi-file-earmark-code me-2"></i>${dict.exportHtml}`;
    const mExportPdfEl = document.getElementById('mobile-export-pdf');
    if (mExportPdfEl) mExportPdfEl.innerHTML = `<i class="bi bi-file-earmark-pdf me-2"></i>${dict.exportPdf}`;
    const mExportPngEl = document.getElementById('mobile-export-png');
    if (mExportPngEl) mExportPngEl.innerHTML = `<i class="bi bi-file-earmark-image me-2"></i>${dict.exportPng}`;

    // Copy / Share
    if (copyMarkdownButton) {
      const copyButtonText = copyMarkdownButton.querySelector('.btn-text');
      if (copyButtonText) copyButtonText.textContent = dict.copy;
    }
    const mCopyBtn = document.getElementById('mobile-copy-markdown');
    if (mCopyBtn) mCopyBtn.innerHTML = `<i class="bi bi-clipboard me-2"></i>${dict.copy}`;

    if (shareButton) {
      const shareButtonText = shareButton.querySelector('.btn-text');
      if (shareButtonText) shareButtonText.textContent = dict.share;
    }
    const mShareBtn = document.getElementById('mobile-share-button');
    if (mShareBtn) mShareBtn.innerHTML = `<i class="bi bi-share me-2"></i>${dict.share}`;

    // Document Reset
    const tabResetBtn = document.getElementById('tab-reset-btn');
    if (tabResetBtn) tabResetBtn.innerHTML = `<i class="bi bi-arrow-counterclockwise"></i> ${dict.reset}`;
    const mTabResetBtn = document.getElementById('mobile-tab-reset-btn');
    if (mTabResetBtn) mTabResetBtn.innerHTML = `<i class="bi bi-arrow-counterclockwise"></i> ${dict.reset} all files`;

    // View toggle buttons title tooltips
    document.querySelectorAll('[data-view-mode="editor"]').forEach(b => b.title = dict.editor);
    document.querySelectorAll('[data-view-mode="split"]').forEach(b => b.title = dict.split);
    document.querySelectorAll('[data-view-mode="preview"]').forEach(b => b.title = dict.preview);
    document.querySelectorAll('.mobile-view-mode-btn[data-mode="editor"] span').forEach(s => s.textContent = dict.editor);
    document.querySelectorAll('.mobile-view-mode-btn[data-mode="split"] span').forEach(s => s.textContent = dict.split);
    document.querySelectorAll('.mobile-view-mode-btn[data-mode="preview"] span').forEach(s => s.textContent = dict.preview);

    // Direction Toggle
    const dirToggle = document.getElementById('direction-toggle');
    if (dirToggle) {
      const isRtl = document.body.style.direction === 'rtl';
      dirToggle.title = isRtl ? dict.switchLtr : dict.switchRtl;
    }

    // Modal Titles
    const modalHelpTitle = document.getElementById('help-modal-title');
    if (modalHelpTitle) modalHelpTitle.textContent = dict.helpTitle;
    const modalAboutTitle = document.getElementById('about-modal-title');
    if (modalAboutTitle) modalAboutTitle.textContent = dict.aboutTitle;
    const modalShareTitle = document.getElementById('share-modal-title');
    if (modalShareTitle) modalShareTitle.textContent = dict.shareTitle;
    const modalRenameTitle = document.getElementById('rename-modal-title');
    if (modalRenameTitle) modalRenameTitle.textContent = dict.renameTitle;
    const modalLinkTitle = document.getElementById('link-modal-title');
    if (modalLinkTitle) modalLinkTitle.textContent = dict.insertLink;
    const modalRefTitle = document.getElementById('reference-modal-title');
    if (modalRefTitle) modalRefTitle.textContent = dict.insertRef;
    const modalImgTitle = document.getElementById('image-modal-title');
    if (modalImgTitle) modalImgTitle.textContent = dict.insertImg;
    const modalTableTitle = document.getElementById('table-modal-title');
    if (modalTableTitle) modalTableTitle.textContent = dict.insertTable;
    const modalFindTitle = document.getElementById('find-replace-title');
    if (modalFindTitle) modalFindTitle.textContent = dict.findReplace;

    // Theme titles
    const mThemeToggle = document.getElementById('mobile-theme-toggle');
    if (mThemeToggle) {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      mThemeToggle.innerHTML = `<i class="bi bi-${currentTheme === 'dark' ? 'sun' : 'moon'} me-2"></i> ${currentTheme === 'dark' ? dict.lightMode : dict.darkMode}`;
    }

    // Stats Labels
    const minReadEl = document.getElementById('lbl-min-read');
    if (minReadEl) minReadEl.textContent = dict.minRead;
    const wordsEl = document.getElementById('lbl-words');
    if (wordsEl) wordsEl.textContent = dict.words;
    const charsEl = document.getElementById('lbl-chars');
    if (charsEl) charsEl.textContent = dict.chars;

    const mMinReadEl = document.getElementById('lbl-mobile-min-read');
    if (mMinReadEl) mMinReadEl.textContent = dict.minRead;
    const mWordsEl = document.getElementById('lbl-mobile-words');
    if (mWordsEl) mWordsEl.textContent = dict.words;
    const mCharsEl = document.getElementById('lbl-mobile-chars');
    if (mCharsEl) mCharsEl.textContent = dict.chars;

    // Placeholder
    if (markdownEditor) {
      markdownEditor.placeholder = dict.placeholder;
    }

    // Trigger state tracking update
    updateDocumentStats();

    // Mark current selected dropdown items as active
    document.querySelectorAll('.lang-select-item').forEach(item => {
      if (item.getAttribute('data-lang') === lang) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  function detectAndInitLanguage() {
    const urlParams = new URLSearchParams(window.location.search);
    let lang = urlParams.get('lang');

    if (!lang) {
      const hash = window.location.hash;
      const hashParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
      lang = hashParams.get('lang');
    }

    if (!lang) {
      lang = localStorage.getItem('app-lang');
    }

    if (!lang && navigator.language) {
      const navLang = navigator.language.toLowerCase();
      if (navLang.startsWith('zh-tw') || navLang.startsWith('zh-hk') || navLang.startsWith('zh-hant')) lang = 'tw';
      else if (navLang.startsWith('zh')) lang = 'zh';
      else if (navLang.startsWith('ja')) lang = 'ja';
      else if (navLang.startsWith('ko')) lang = 'ko';
      else if (navLang.startsWith('pt')) lang = 'pt';
      else if (navLang.startsWith('es')) lang = 'es';
      else if (navLang.startsWith('fr')) lang = 'fr';
      else if (navLang.startsWith('de')) lang = 'de';
      else if (navLang.startsWith('ru')) lang = 'ru';
      else if (navLang.startsWith('it')) lang = 'it';
      else if (navLang.startsWith('tr')) lang = 'tr';
      else if (navLang.startsWith('pl')) lang = 'pl';
      else if (navLang.startsWith('uk')) lang = 'uk';
    }

    if (!lang || !I18N_DICTS[lang]) {
      lang = 'en';
    }

    applyTranslations(lang);
  }

  // Language selectors click event listeners
  document.addEventListener('click', function(e) {
    const item = e.target.closest('.lang-select-item');
    if (item) {
      e.preventDefault();
      const lang = item.getAttribute('data-lang');
      applyTranslations(lang);
      saveStorageItem('app-lang', lang);
      
      // Update browser search parameters dynamically without page reload
      const url = new URL(window.location.href);
      url.searchParams.set('lang', lang);
      window.history.replaceState({}, '', url.toString());
    }
  });

  // Accessibility dynamic screen reader announcer helper
  function announceToScreenReader(message) {
    const announcer = document.getElementById('app-accessibility-announcer');
    if (!announcer) return;
    announcer.textContent = '';
    clearTimeout(announceToScreenReader._timeoutId);
    announceToScreenReader._timeoutId = setTimeout(() => {
      announcer.textContent = message;
    }, 50);
  }

  // Visual skeleton loader generator for emoji list
  function renderEmojiSkeletons() {
    const grid = document.getElementById('emoji-modal-grid');
    if (!grid) return;
    // PERF-007: Clear elements using textContent
    grid.textContent = '';
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 18; i++) {
      const item = document.createElement('div');
      item.className = 'emoji-item skeleton-placeholder';
      item.setAttribute('aria-hidden', 'true');
      item.style.border = '1px solid var(--border-color)';
      item.style.borderRadius = '10px';
      item.style.padding = '10px';
      item.style.display = 'flex';
      item.style.flexDirection = 'column';
      item.style.alignItems = 'center';
      item.style.gap = '8px';

      const preview = document.createElement('span');
      preview.className = 'emoji-preview skeleton-circle';
      item.appendChild(preview);

      const shortcodeRow = document.createElement('div');
      shortcodeRow.className = 'emoji-shortcode';
      const code = document.createElement('span');
      code.className = 'skeleton-text';
      code.style.width = '60px';
      shortcodeRow.appendChild(code);
      item.appendChild(shortcodeRow);

      fragment.appendChild(item);
    }
    grid.appendChild(fragment);
  }

  // Visual skeleton loader generator for GitHub file list tree
  function renderGitHubImportTreeSkeleton() {
    if (!githubImportTree) return;
    // PERF-007: Clear elements using textContent
    githubImportTree.textContent = '';
    
    const wrapper = document.createElement('div');
    wrapper.className = 'github-import-tree-skeleton';
    
    const list = document.createElement('ul');
    list.style.listStyle = 'none';
    list.style.paddingLeft = '4px';
    list.style.margin = '0';
    
    for (let i = 0; i < 4; i++) {
      const folderItem = document.createElement('li');
      folderItem.style.margin = '6px 0';
      
      const folderSpan = document.createElement('span');
      folderSpan.className = 'skeleton-placeholder skeleton-tree-folder';
      folderItem.appendChild(folderSpan);
      
      const subList = document.createElement('ul');
      subList.style.listStyle = 'none';
      subList.style.paddingLeft = '18px';
      subList.style.margin = '0';
      
      for (let j = 0; j < 2; j++) {
        const fileItem = document.createElement('li');
        fileItem.style.margin = '4px 0';
        
        const fileSpan = document.createElement('span');
        fileSpan.className = 'skeleton-placeholder skeleton-tree-file';
        fileItem.appendChild(fileSpan);
        subList.appendChild(fileItem);
      }
      
      folderItem.appendChild(subList);
      list.appendChild(folderItem);
    }
    
    wrapper.appendChild(list);
    githubImportTree.appendChild(wrapper);
  }

  // Run detection
  detectAndInitLanguage();

  // Intercept all link clicks in the preview pane to open them securely and prevent page navigation
  if (markdownPreview) {
    markdownPreview.addEventListener('click', function(e) {
      const link = e.target.closest('a');
      if (link) {
        const href = link.getAttribute('href');
        if (href) {
          if (href.startsWith('#')) {
            const targetId = decodeURIComponent(href.slice(1));
            let targetEl = null;
            if (targetId) {
              try {
                targetEl = markdownPreview.querySelector(`[id="${CSS.escape(targetId)}"]`) ||
                           markdownPreview.querySelector(`[name="${CSS.escape(targetId)}"]`);
              } catch (err) {
                targetEl = Array.from(markdownPreview.querySelectorAll('[id], [name]')).find(el => {
                  return el.getAttribute('id') === targetId || el.getAttribute('name') === targetId;
                });
              }
              
              if (!targetEl) {
                const cleanTargetId = targetId.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (cleanTargetId) {
                  targetEl = Array.from(markdownPreview.querySelectorAll('h1, h2, h3, h4, h5, h6')).find(heading => {
                    const cleanText = heading.textContent.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return cleanText === cleanTargetId;
                  });
                }
              }
            }
            if (targetEl) {
              e.preventDefault();
              isProgrammaticScrolling = true;
              
              // Scroll preview pane to target heading
              targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
              
              // Scroll editor pane to the matching synced position
              const previewScrollRange = previewPane.scrollHeight - previewPane.clientHeight;
              const targetRatio = previewScrollRange > 0 ? Math.min(1, Math.max(0, targetEl.offsetTop / previewScrollRange)) : 0;
              const editorScrollPosition = targetRatio * (markdownEditor.scrollHeight - markdownEditor.clientHeight);
              
              markdownEditor.scrollTo({
                top: editorScrollPosition,
                behavior: 'smooth'
              });
              
              if (window.programmaticScrollTimeout) {
                clearTimeout(window.programmaticScrollTimeout);
              }
              window.programmaticScrollTimeout = setTimeout(() => {
                isProgrammaticScrolling = false;
              }, 1000);
            }
            return;
          }
          
          e.preventDefault();
          // Defense-in-depth: check that the URL protocol is safe
          let isSafe = false;
          try {
            const parsed = new URL(href, window.location.href);
            isSafe = ['http:', 'https:', 'mailto:', 'tel:', 'blob:'].includes(parsed.protocol);
          } catch (err) {
            // If URL constructor fails, it might be a relative path without a base, which is safe to resolve
            isSafe = !href.trim().toLowerCase().startsWith('javascript:');
          }
          
          if (isSafe) {
            if (typeof Neutralino !== 'undefined') {
              Neutralino.os.open(href);
            } else {
              window.open(href, '_blank', 'noopener,noreferrer');
            }
          } else {
            console.warn('Blocked opening potentially unsafe URL:', href);
          }
        }
      }
    });
  }

  // Register Service Worker for offline capabilities
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('sw.js').then(function(registration) {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      }, function(err) {
        console.log('ServiceWorker registration failed: ', err);
      });
    });
  }
});
