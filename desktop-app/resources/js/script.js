document.addEventListener("DOMContentLoaded", function () {
  // PERF-002: Lazy script loader for optional heavy libraries
  const _loadedScripts = new Set();
  function loadScript(url) {
    if (_loadedScripts.has(url)) return Promise.resolve();
    return new Promise(function(resolve, reject) {
      const script = document.createElement('script');
      script.src = url;
      script.onload = function() { _loadedScripts.add(url); resolve(); };
      script.onerror = function() { reject(new Error('Failed to load: ' + url)); };
      document.head.appendChild(script);
    });
  }

  const _loadedStyles = new Set();
  function loadStyle(url) {
    if (_loadedStyles.has(url)) return Promise.resolve();
    return new Promise(function(resolve, reject) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.onload = function() { _loadedStyles.add(url); resolve(); };
      link.onerror = function() { reject(new Error('Failed to load style: ' + url)); };
      document.head.appendChild(link);
    });
  }

  // CDN URLs for lazy-loaded libraries
  const CDN = {
    mermaid: 'https://cdn.jsdelivr.net/npm/mermaid@11.15.0/dist/mermaid.min.js',
    mathjax: 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-mml-chtml.min.js',
    jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    html2canvas: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    pako: 'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js',
    joypixels: 'https://cdn.jsdelivr.net/npm/emoji-toolkit@9.0.1/lib/js/joypixels.min.js',
    joypixels_css: 'https://cdn.jsdelivr.net/npm/emoji-toolkit@9.0.1/extras/css/joypixels.min.css'
  };

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
    ADD_ATTR: ['id', 'class', 'style', 'align', 'type', 'checked', 'disabled', 'data-original-code'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
  };
  const RENDER_DELAY = 100;
  const LARGE_RENDER_DELAY = 160;
  const HUGE_RENDER_DELAY = 240;
  let syncScrollingEnabled = true;
  let isEditorScrolling = false;
  let isPreviewScrolling = false;
  let scrollSyncTimeout = null;
  const SCROLL_SYNC_DELAY = 10;

  // View Mode State - Story 1.1
  let currentViewMode = 'split'; // 'editor', 'split', or 'preview'
  const APP_VERSION = '3.7.3';
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
    localStorage.setItem(GLOBAL_STATE_KEY, JSON.stringify(_globalStateCache));
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
      fontSize: 16
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
    };
  }

  function isSegmentedPreviewSafe(markdown) {
    if (!markdown || markdown.length < PREVIEW_WORKER_THRESHOLD) return false;
    if (/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.test(markdown)) return false;
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
        } else if (data.type === "render-full-result") {
          previewWorkerFailureCount = 0;
          pending.resolve(data.html);
        } else if (data.type === "render-full-error") {
          pending.reject(new Error(data.error || "Preview worker render-full failed."));
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

  function requestFullWorkerRender(rawVal) {
    const worker = getPreviewWorker();
    if (!worker) return Promise.reject(new Error("Worker unavailable"));

    const requestId = ++previewWorkerRequestCounter;
    return new Promise(function(resolve, reject) {
      const timeoutId = setTimeout(function() {
        previewWorkerRequests.delete(requestId);
        reject(new Error("Full render worker timeout."));
      }, 30000); // 30s timeout for full document render

      previewWorkerRequests.set(requestId, { resolve, reject, timeoutId });

      try {
        worker.postMessage({
          type: "render-full",
          requestId: requestId,
          markdown: rawVal,
          options: {
            libraryUrls: getPreviewWorkerLibraryUrls()
          },
        });
      } catch (e) {
        previewWorkerRequests.delete(requestId);
        clearTimeout(timeoutId);
        reject(e);
      }
    });
  }

  async function parseMarkdownFull(markdown) {
    try {
      const html = await requestFullWorkerRender(markdown);
      return html;
    } catch (e) {
      console.warn("Full worker render failed, falling back to main thread:", e);
      const { frontmatter, body } = parseFrontmatter(markdown);
      const tableHtml = frontmatter ? renderFrontmatterTable(frontmatter) : '';
      const referenceData = extractReferenceDefinitions(body);
      const parsedHtml = tableHtml + marked.parse(referenceData.cleanedMarkdown);
      const sanitizedHtml = DOMPurify.sanitize(parsedHtml, {
        ADD_TAGS: ['mjx-container', 'svg', 'path', 'g', 'marker', 'defs', 'pattern', 'clipPath', 'input'],
        ADD_ATTR: ['id', 'class', 'style', 'align', 'viewBox', 'd', 'fill', 'stroke', 'transform', 'marker-end', 'marker-start', 'type', 'checked', 'disabled', 'data-original-code']
      });
      return sanitizedHtml;
    }
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

  renderer.code = function (code, language) {
    if (language === 'mermaid') {
      const uniqueId = 'mermaid-diagram-' + Math.random().toString(36).substr(2, 9);
      const escapedCode = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<div class="mermaid-container is-loading"><div class="mermaid" id="${uniqueId}" data-original-code="${encodeURIComponent(code)}">${escapedCode}</div></div>`;
    }
    
    const validLanguage = hljs.getLanguage(language) ? language : "plaintext";
    const highlightedCode = hljs.highlight(code, {
      language: validLanguage,
    }).value;
    return `<pre><code class="hljs ${validLanguage}">${highlightedCode}</code></pre>`;
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
    const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tabsArr || tabs));
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
    localStorage.setItem(ACTIVE_TAB_KEY, id);
  }

  function loadUntitledCounter() {
    return parseInt(localStorage.getItem(UNTITLED_COUNTER_KEY) || '0', 10);
  }

  function saveUntitledCounter(val) {
    localStorage.setItem(UNTITLED_COUNTER_KEY, String(val));
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

  function markPreviewRootsReady(roots) {
    queryPreviewRoots(roots, '.mermaid-container.is-loading').forEach(function(container) {
      container.classList.remove('is-loading');
    });
  }

  function postProcessPreview(rawVal, context, patchResult) {
    const roots = getPreviewPostProcessRoots(patchResult);

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
              markPreviewRootsReady(roots);
              addMermaidToolbars();
            });
        };
        if (typeof mermaid === 'undefined') {
          loadScript(CDN.mermaid).then(function() {
            if (context.renderId !== previewRenderGeneration) return;
            initMermaid(true);
            renderMermaidNodes();
          }).catch(function(e) { console.warn('Failed to load mermaid:', e); });
        } else {
          renderMermaidNodes();
        }
      }
    } catch (e) {
      console.warn("Mermaid rendering failed:", e);
    }

    const hasMath = /\$\$|\$[^$]|\\\(|\\\[/.test(rawVal || '');
    if (hasMath) {
      const typesetTargets = roots.filter(function(root) {
        return root && root.nodeType === Node.ELEMENT_NODE && /\$\$|\$[^$]|\\\(|\\\[/.test(root.textContent || '');
      });
      const mathTargets = typesetTargets.length ? typesetTargets : roots;
      if (window.MathJax) {
        try {
          MathJax.typesetPromise(mathTargets).then(function() {
            if (context.renderId !== previewRenderGeneration) return;
            queryPreviewRoots(mathTargets, 'mjx-container[tabindex="0"]').forEach(function(mjx) {
              mjx.removeAttribute('tabindex');
            });
          }).catch(function(err) {
            console.warn('MathJax typesetting failed:', err);
          });
        } catch (e) {
          console.warn("MathJax rendering failed:", e);
        }
      } else {
        window.MathJax = {
          loader: { load: ['[tex]/ams', '[tex]/boldsymbol'] },
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
        loadScript(CDN.mathjax).then(function() {
          if (context.renderId !== previewRenderGeneration) return;
          try {
            MathJax.typesetPromise(mathTargets).then(function() {
              if (context.renderId !== previewRenderGeneration) return;
              queryPreviewRoots(mathTargets, 'mjx-container[tabindex="0"]').forEach(function(mjx) {
                mjx.removeAttribute('tabindex');
              });
            }).catch(function(err) {
              console.warn('MathJax typesetting failed:', err);
            });
          } catch (e) {
            console.warn('MathJax rendering failed:', e);
          }
        }).catch(function(e) { console.warn('Failed to load MathJax:', e); });
      }
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
    if (!syncScrollingEnabled || isPreviewScrolling) return;
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
    if (!syncScrollingEnabled || isEditorScrolling) return;
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
    localStorage.setItem('find-replace-docked', frPreferredDocked ? 'true' : 'false');

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
      saveAs(blob, "document.md");
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
        ADD_ATTR: ['id', 'class', 'style', 'align', 'type', 'checked', 'disabled', 'data-original-code']
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
          max-width: 980px;
          margin: 0 auto;
          padding: 45px;
          background-color: ${isDarkTheme ? "#0d1117" : "#ffffff"};
          color: ${isDarkTheme ? "#c9d1d9" : "#24292e"};
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
          var paddingRight = parseFloat(styles.paddingRight) || 0;
          var borderRight = parseFloat(styles.borderRightWidth) || 0;
          var borderLeft = parseFloat(styles.borderLeftWidth) || 0;
          var requiredWidth = Math.ceil(article.scrollWidth + paddingRight + borderLeft + borderRight);

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
                  window.mermaid.initialize({ startOnLoad: true, theme: '${isDarkTheme ? "dark" : "default"}' });
              } catch (e) {
                  console.warn('Mermaid initialization failed:', e);
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
        saveAs(blob, "document.html");
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

  const PDF_EXPORT_DEBUG = false;
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

  function createPdfProgressState() {
    const abortController = new AbortController();
    const overlay = document.createElement("div");
    overlay.className = "pdf-progress-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "pdf-progress-title");

    overlay.innerHTML = `
      <div class="pdf-progress-modal">
        <div class="pdf-progress-header">
          <p class="pdf-progress-title" id="pdf-progress-title">Generating PDF</p>
          <button type="button" class="modal-close-btn pdf-progress-cancel-icon" aria-label="Cancel PDF generation" title="Cancel PDF generation">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <div class="pdf-progress-percent">0%</div>
        <div class="pdf-progress-track"
             role="progressbar"
             aria-label="PDF generation progress"
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
    const triggers = [exportPdf, mobileExportPdf].filter(Boolean);
    triggers.forEach((trigger, index) => {
      if (busy) {
        state.triggerHtml.set(trigger, trigger.innerHTML);
        trigger.innerHTML = index === 0
          ? '<i class="bi bi-hourglass-split"></i> Generating...'
          : '<i class="bi bi-hourglass-split me-2"></i> Generating PDF...';
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
      state.tempElement.parentNode.removeChild(state.tempElement);
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
    return /(^|[^\\])\$\$|\\\[|\\\(|(^|[^\\])\$[^$\n]+\$/.test(markdown);
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
      ? Math.ceil(element.scrollWidth + paddingRight + borderLeft + borderRight)
      : Math.ceil(element.scrollWidth - paddingLeft + paddingRight);

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
    container.querySelectorAll('img, svg, pre, table, mjx-container[display="true"]').forEach(el => {
      let type = 'img';
      const tag = el.tagName.toLowerCase();
      if (tag === 'svg') type = 'svg';
      else if (tag === 'pre') type = 'pre';
      else if (tag === 'table') type = 'table';
      else if (tag === 'mjx-container') type = 'math';
      
      graphics.push({ element: el, type: type });
    });

    return graphics;
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
    // Calculate pixel height per page based on the element's actual width
    // This must match how PDF pagination will split the canvas
    // The aspect ratio of content area determines page height relative to width
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
    // Handle edge case: empty elements array
    if (!elements || elements.length === 0) {
      return [];
    }

    // Handle edge case: no page boundaries (single page)
    if (!pageBoundaries || pageBoundaries.length === 0) {
      return [];
    }

    const splitElements = [];

    for (const item of elements) {
      // Find which page the element starts on
      let startPage = 0;
      for (let i = 0; i < pageBoundaries.length; i++) {
        if (item.top >= pageBoundaries[i]) {
          startPage = i + 1;
        } else {
          break;
        }
      }

      // Find which page the element ends on
      let endPage = 0;
      for (let i = 0; i < pageBoundaries.length; i++) {
        if (item.bottom > pageBoundaries[i]) {
          endPage = i + 1;
        } else {
          break;
        }
      }

      // Element is split if it spans multiple pages
      if (endPage > startPage) {
        // Calculate overflow amount (how much crosses into next page)
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

      // Step 1: Identify all graphic elements
      const graphics = identifyGraphicElements(tempElement);
      logPdfExportDebug('Step 1 - Graphics found:', graphics.length, graphics.map(g => g.type));

      // Step 2: Calculate positions for each element
      const elementsWithPositions = calculateElementPositions(graphics, tempElement);
      logPdfExportDebug('Step 2 - Element positions:', elementsWithPositions.map(e => ({
        type: e.type,
        top: Math.round(e.top),
        height: Math.round(e.height),
        bottom: Math.round(e.bottom)
      })));

      throwIfPdfExportAborted(signal);

      // Step 3: Calculate page boundaries using the element's ACTUAL width
      const totalHeight = tempElement.scrollHeight;
      const elementWidth = tempElement.offsetWidth;
      const { boundaries: pageBoundaries, pageHeightPx } = calculatePageBoundaries(
        totalHeight,
        elementWidth,
        PAGE_CONFIG
      );

      logPdfExportDebug('Step 3 - Page boundaries:', {
        elementWidth,
        totalHeight,
        pageHeightPx: Math.round(pageHeightPx),
        boundaries: pageBoundaries.map(b => Math.round(b))
      });

      // Step 4: Detect split elements
      const splitElements = detectSplitElements(elementsWithPositions, pageBoundaries);
      logPdfExportDebug('Step 4 - Split elements detected:', splitElements.length);

      // Calculate page count
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

  // Threshold for whitespace optimization (30% of page height)
  const PAGE_BREAK_THRESHOLD = 0.3;

  /**
   * Task 3: Categorizes split elements by whether they fit on a single page
   * @param {Array} splitElements - Array of split elements from detection
   * @param {number} pageHeightPx - Page height in pixels
   * @returns {Object} { fittingElements, oversizedElements }
   */
  function categorizeBySize(splitElements, pageHeightPx) {
    const fittingElements = [];
    const oversizedElements = [];

    for (const item of splitElements) {
      if (item.height <= pageHeightPx) {
        fittingElements.push(item);
      } else {
        oversizedElements.push(item);
      }
    }

    return { fittingElements, oversizedElements };
  }

  /**
   * Task 1: Inserts page breaks by adjusting margins for fitting elements
   * @param {Array} fittingElements - Elements that fit on a single page
   * @param {number} pageHeightPx - Page height in pixels
   */
  function insertPageBreaks(fittingElements, pageHeightPx, signal) {
    for (const item of fittingElements) {
      throwIfPdfExportAborted(signal);

      // Calculate where the current page ends
      const currentPageBottom = (item.splitPageIndex + 1) * pageHeightPx;

      // Calculate remaining space on current page
      const remainingSpace = currentPageBottom - item.top;
      const remainingRatio = remainingSpace / pageHeightPx;

      logPdfExportDebug('Processing split element:', {
        type: item.type,
        top: Math.round(item.top),
        height: Math.round(item.height),
        splitPageIndex: item.splitPageIndex,
        currentPageBottom: Math.round(currentPageBottom),
        remainingSpace: Math.round(remainingSpace),
        remainingRatio: remainingRatio.toFixed(2)
      });

      // Element is pushed to the next page to prevent splitting across page boundaries.

      // Calculate margin needed to push element to next page
      const marginNeeded = currentPageBottom - item.top + 5; // 5px buffer

      logPdfExportDebug('  -> Applying marginTop:', marginNeeded, 'px');

      // Determine which element to apply margin to
      // For SVG elements (Mermaid diagrams), apply to parent container for proper layout
      let targetElement = item.element;
      if (item.type === 'svg' && item.element.parentElement) {
        targetElement = item.element.parentElement;
        logPdfExportDebug('  -> Using parent element:', targetElement.tagName, targetElement.className);
      }

      // Apply margin to push element to next page
      const currentMargin = parseFloat(targetElement.style.marginTop) || 0;
      targetElement.style.marginTop = `${currentMargin + marginNeeded}px`;

      logPdfExportDebug('  -> Element after margin:', targetElement.tagName, 'marginTop =', targetElement.style.marginTop);
    }
  }

  /**
   * Task 2: Applies page breaks with cascading adjustment handling
   * @param {HTMLElement} tempElement - The rendered content container
   * @param {Object} pageConfig - Page configuration object (unused, kept for API compatibility)
   * @param {number} maxIterations - Maximum iterations to prevent infinite loops
   * @returns {Object} Final analysis result
   */
  function applyPageBreaksWithCascade(tempElement, pageConfig, maxIterations = 10, signal) {
    let iteration = 0;
    let analysis;
    let previousSplitCount = -1;

    do {
      throwIfPdfExportAborted(signal);

      // Re-analyze after each adjustment
      analysis = analyzeGraphicsForPageBreaks(tempElement, signal);

      // Use pageHeightPx from analysis (calculated from actual element width)
      const pageHeightPx = analysis.pageHeightPx;

      // Categorize elements by size
      const { fittingElements, oversizedElements } = categorizeBySize(
        analysis.splitElements,
        pageHeightPx
      );

      // Store oversized elements for Story 1.3
      analysis.oversizedElements = oversizedElements;

      // If no fitting elements need adjustment, we're done
      if (fittingElements.length === 0) {
        break;
      }

      // Check if we're making progress (prevent infinite loops)
      if (fittingElements.length === previousSplitCount) {
        console.warn('Page-break adjustment not making progress, stopping');
        break;
      }
      previousSplitCount = fittingElements.length;

      // Apply page breaks to fitting elements
      insertPageBreaks(fittingElements, pageHeightPx, signal);
      iteration++;

    } while (iteration < maxIterations);

    if (iteration >= maxIterations) {
      console.warn('Page-break stabilization reached max iterations:', maxIterations);
    }

    logPdfExportDebug('Page-break cascade complete:', {
      iterations: iteration,
      finalSplitCount: analysis.splitElements.length,
      oversizedCount: analysis.oversizedElements ? analysis.oversizedElements.length : 0
    });

    return analysis;
  }

  // ============================================
  // End Page-Break Insertion Functions
  // ============================================

  // ============================================
  // Oversized Graphics Scaling Functions (Story 1.3)
  // ============================================

  // Minimum scale factor to maintain readability (50%)
  const MIN_SCALE_FACTOR = 0.5;

  /**
   * Task 1 & 2: Calculates scale factor with minimum enforcement
   * @param {number} elementHeight - Original height of element in pixels
   * @param {number} availableHeight - Available page height in pixels
   * @param {number} buffer - Small buffer to prevent edge overflow
   * @returns {Object} { scaleFactor, wasClampedToMin }
   */
  function calculateScaleFactor(elementHeight, availableHeight, buffer = 5) {
    const targetHeight = availableHeight - buffer;
    let scaleFactor = targetHeight / elementHeight;
    let wasClampedToMin = false;

    // Enforce minimum scale for readability
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

  /**
   * Task 3: Applies CSS transform scaling to an element
   * @param {HTMLElement} element - The element to scale
   * @param {number} scaleFactor - Scale factor (0.5 = 50%)
   * @param {string} elementType - Type of element (svg, pre, img, table)
   */
  function applyGraphicScaling(element, scaleFactor, elementType) {
    // Get original dimensions before transform
    const originalHeight = element.offsetHeight;

    // Task 4: Handle SVG elements (Mermaid diagrams)
    if (elementType === 'svg') {
      // Remove max-width constraint that may interfere
      element.style.maxWidth = 'none';
    }

    // Apply CSS transform
    element.style.transform = `scale(${scaleFactor})`;
    element.style.transformOrigin = 'top left';

    // Calculate margin adjustment to collapse visual space
    const scaledHeight = originalHeight * scaleFactor;
    const marginAdjustment = originalHeight - scaledHeight;

    // Apply negative margin to pull subsequent content up
    element.style.marginBottom = `-${marginAdjustment}px`;
  }

  /**
   * Task 6: Handles all oversized elements by applying appropriate scaling
   * @param {Array} oversizedElements - Array of oversized element data
   * @param {number} pageHeightPx - Page height in pixels
   */
  function handleOversizedElements(oversizedElements, pageHeightPx, signal) {
    if (!oversizedElements || oversizedElements.length === 0) {
      return;
    }

    let scaledCount = 0;
    let clampedCount = 0;

    for (const item of oversizedElements) {
      throwIfPdfExportAborted(signal);

      // Calculate required scale factor
      const { scaleFactor, wasClampedToMin } = calculateScaleFactor(
        item.height,
        pageHeightPx
      );

      // Apply scaling to the element
      applyGraphicScaling(item.element, scaleFactor, item.type);

      scaledCount++;
      if (wasClampedToMin) {
        clampedCount++;
      }
    }

    logPdfExportDebug('Oversized graphics scaling complete:', {
      totalScaled: scaledCount,
      clampedToMinimum: clampedCount
    });
  }

  // ============================================
  // End Oversized Graphics Scaling Functions
  // ============================================

  // ============================================
  // New Modular PDF Export Engine
  // ============================================
  const PdfExportEngine = {
    ExportDocumentBuilder: {
      build: async function(markdown, state) {
        updatePdfProgress(state, 15, "Parsing markdown");
        await waitForPdfFrame(state);
        
        const sanitizedHtml = await parseMarkdownFull(markdown);
        throwIfPdfExportAborted(state.signal);

        updatePdfProgress(state, 24, "Preparing document");
        await waitForPdfFrame(state);
        
        const tempElement = document.createElement("div");
        state.tempElement = tempElement;
        tempElement.className = "markdown-body pdf-export";
        tempElement.innerHTML = sanitizedHtml;
        enhanceGitHubAlerts(tempElement);
        tempElement.style.padding = "20px";
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
        await waitForPdfFrame(state);

        await PdfExportEngine.AssetReadinessGate.awaitReady(tempElement, markdown, state);
        throwIfPdfExportAborted(state.signal);

        const pageHeightPx = tempElement.offsetWidth * (PAGE_CONFIG.contentHeight / PAGE_CONFIG.contentWidth);
        tempElement.querySelectorAll("pre").forEach(pre => {
          if (pre.offsetHeight > pageHeightPx) {
            pre.classList.add("oversized");
          }
        });

        const parentStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
          .map(el => el.outerHTML)
          .join("\n");

        const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Export Document</title>
  ${parentStyles}
</head>
<body class="${currentTheme === 'dark' ? 'dark-theme' : 'light-theme'}" data-theme="${currentTheme}">
  <div class="markdown-body pdf-export" style="padding: 20px; width: 100%; box-shadow: none;">
    ${tempElement.innerHTML}
  </div>
</body>
</html>`;

        return { fullHtml, tempElement };
      }
    },

    AssetReadinessGate: {
      awaitReady: async function(tempElement, markdown, state) {
        if (window.MathJax && markdownLikelyContainsMath(markdown)) {
          updatePdfProgress(state, 30, "Rendering math");
          try {
            await runPdfAbortable(state, MathJax.typesetPromise([tempElement]));
          } catch (err) {
            console.warn("MathJax rendering issue:", err);
          }
          throwIfPdfExportAborted(state.signal);
          
          tempElement.querySelectorAll('mjx-assistive-mml').forEach(el => el.remove());
          tempElement.querySelectorAll('script[type*="math"], script[type*="tex"]').forEach(el => el.remove());
        }

        const mermaidNodes = tempElement.querySelectorAll('.mermaid');
        if (mermaidNodes.length > 0) {
          updatePdfProgress(state, 40, "Rendering diagrams");
          try {
            if (typeof mermaid === 'undefined') {
              await runPdfAbortable(state, loadScript(CDN.mermaid));
            }
            throwIfPdfExportAborted(state.signal);
            initMermaid(true);
            await runPdfAbortable(state, mermaid.init(undefined, mermaidNodes));
            tempElement.querySelectorAll('.mermaid-container.is-loading').forEach(container => {
              container.classList.remove('is-loading');
            });
          } catch (err) {
            console.warn("Mermaid rendering issue:", err);
            tempElement.querySelectorAll('.mermaid-container.is-loading').forEach(container => {
              container.classList.remove('is-loading');
            });
          }
          throwIfPdfExportAborted(state.signal);
        }

        const images = Array.from(tempElement.querySelectorAll("img"));
        if (images.length > 0) {
          updatePdfProgress(state, 50, "Loading images");
          await Promise.all(images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
              img.addEventListener("load", resolve, { once: true });
              img.addEventListener("error", resolve, { once: true });
            });
          }));
          await Promise.all(images.map(img => {
            if (typeof img.decode === "function") {
              return img.decode().catch(() => {});
            }
            return Promise.resolve();
          }));
          throwIfPdfExportAborted(state.signal);
        }

        if (document.fonts && typeof document.fonts.ready === "object") {
          updatePdfProgress(state, 55, "Loading fonts");
          await document.fonts.ready;
          throwIfPdfExportAborted(state.signal);
        }

        updatePdfProgress(state, 60, "Stabilizing layout");
        await waitForPdfFrame(state);
        await waitForPdfFrame(state);
      }
    },

    WebPrintBackend: {
      print: function(fullHtml, state) {
        return new Promise((resolve, reject) => {
          try {
            throwIfPdfExportAborted(state.signal);
            
            const iframe = document.createElement("iframe");
            iframe.style.position = "fixed";
            iframe.style.left = "-9999px";
            iframe.style.top = "0";
            iframe.style.width = "100%";
            iframe.style.height = "100%";
            document.body.appendChild(iframe);
            
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            doc.open();
            doc.write(fullHtml);
            doc.close();

            const cleanup = () => {
              if (iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
              }
            };

            iframe.contentWindow.focus();
            
            iframe.contentWindow.addEventListener("afterprint", () => {
              cleanup();
              resolve();
            }, { once: true });
            
            iframe.contentWindow.print();
            
            setTimeout(() => {
              cleanup();
              resolve();
            }, 5000);
          } catch (err) {
            reject(err);
          }
        });
      }
    },

    DesktopChromiumSidecarBackend: {
      print: async function(fullHtml, state) {
        throwIfPdfExportAborted(state.signal);

        const outputPath = await Neutralino.os.showSaveDialog("Save PDF Document", {
          filters: [{ name: "PDF files", extensions: ["pdf"] }]
        });

        if (!outputPath) {
          throw new Error("Export cancelled by user.");
        }

        throwIfPdfExportAborted(state.signal);

        let port;
        try {
          port = await Neutralino.filesystem.readFile(".pdf_exporter_port");
          port = port.trim();
        } catch (err) {
          throw new Error("Local PDF exporter extension is not running. Please make sure the desktop application is running properly.");
        }

        throwIfPdfExportAborted(state.signal);

        const response = await fetch(`http://127.0.0.1:${port}/export`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            html: fullHtml,
            outputPath: outputPath
          }),
          signal: state.signal
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP error ${response.status}`);
        }

        return outputPath;
      }
    },

    LegacyRasterBackend: {
      print: async function(tempElement, state) {
        throwIfPdfExportAborted(state.signal);

        if (typeof jspdf === 'undefined' || typeof html2canvas === 'undefined') {
          updatePdfProgress(state, 62, "Loading PDF libraries");
          await runPdfAbortable(state, Promise.all([loadScript(CDN.jspdf), loadScript(CDN.html2canvas)]));
          throwIfPdfExportAborted(state.signal);
        }

        updatePdfProgress(state, 65, "Calculating legacy page breaks");
        const pageBreakAnalysis = applyPageBreaksWithCascade(tempElement, PAGE_CONFIG, 10, state.signal);
        throwIfPdfExportAborted(state.signal);

        if (pageBreakAnalysis.oversizedElements && pageBreakAnalysis.pageHeightPx) {
          handleOversizedElements(pageBreakAnalysis.oversizedElements, pageBreakAnalysis.pageHeightPx, state.signal);
        }
        await waitForPdfFrame(state);

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

        updatePdfProgress(state, 75, "Capturing document");
        const canvas = await runPdfAbortable(state, html2canvas(tempElement, {
          scale: captureScale,
          useCORS: true,
          allowTaint: false,
          logging: false,
          windowWidth: Math.max(PAGE_CONFIG.windowWidth, Math.ceil(tempElement.getBoundingClientRect().width)),
          windowHeight: tempElement.scrollHeight
        }));
        await waitForPdfFrame(state);
        throwIfPdfExportAborted(state.signal);

        const scaleFactor = canvas.width / contentWidth;
        const imgHeight = canvas.height / scaleFactor;
        const pagesCount = Math.ceil(imgHeight / (pageHeight - margin * 2));

        updatePdfProgress(state, 80, "Rendering pages");
        for (let page = 0; page < pagesCount; page++) {
          throwIfPdfExportAborted(state.signal);
          const pageProgress = 80 + ((page + 1) / pagesCount) * 18;
          updatePdfProgress(state, pageProgress, `Rendering page ${page + 1} of ${pagesCount}`);

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
          await waitForPdfFrame(state);
        }

        throwIfPdfExportAborted(state.signal);
        updatePdfProgress(state, 98, "Saving document");
        pdf.save("document.pdf");
      }
    }
  };

  // PDF Export Modal Elements
  const pdfExportModal = document.getElementById("pdf-export-modal");
  const pdfExportConfirmBtn = document.getElementById("pdf-export-modal-confirm");
  const pdfExportCancelBtn = document.getElementById("pdf-export-modal-close");
  const pdfExportCloseIcon = document.getElementById("pdf-export-modal-close-icon");
  const pdfCardPrint = document.getElementById("pdf-card-print");
  const pdfCardLegacy = document.getElementById("pdf-card-legacy");
  const pdfEnginePrintInput = document.getElementById("pdf-engine-print");
  const pdfEngineLegacyInput = document.getElementById("pdf-engine-legacy");

  function syncPdfCardStyles() {
    if (pdfEnginePrintInput.checked) {
      pdfCardPrint.classList.add("is-selected");
      pdfCardLegacy.classList.remove("is-selected");
    } else {
      pdfCardLegacy.classList.add("is-selected");
      pdfCardPrint.classList.remove("is-selected");
    }
  }

  if (pdfEnginePrintInput && pdfEngineLegacyInput) {
    pdfEnginePrintInput.addEventListener("change", syncPdfCardStyles);
    pdfEngineLegacyInput.addEventListener("change", syncPdfCardStyles);
  }

  function openPdfExportModal() {
    pdfEnginePrintInput.checked = true;
    syncPdfCardStyles();
    pdfExportModal.style.display = "";
    requestAnimationFrame(() => {
      pdfExportModal.classList.add("is-visible");
      pdfExportModal.setAttribute("aria-hidden", "false");
    });
  }

  function closePdfExportModal() {
    pdfExportModal.classList.remove("is-visible");
    pdfExportModal.setAttribute("aria-hidden", "true");
    pdfExportModal.addEventListener("transitionend", function handler() {
      pdfExportModal.style.display = "none";
      pdfExportModal.removeEventListener("transitionend", handler);
    });
  }

  if (pdfExportCancelBtn) pdfExportCancelBtn.addEventListener("click", closePdfExportModal);
  if (pdfExportCloseIcon) pdfExportCloseIcon.addEventListener("click", closePdfExportModal);
  if (pdfExportModal) {
    pdfExportModal.addEventListener("click", function (e) {
      if (e.target === pdfExportModal) closePdfExportModal();
    });
  }

  if (pdfExportConfirmBtn) {
    pdfExportConfirmBtn.addEventListener("click", async function() {
      closePdfExportModal();
      
      if (activePdfExport) return;

      const progressState = createPdfProgressState();
      activePdfExport = progressState;
      setPdfExportTriggersBusy(progressState, true);
      document.body.appendChild(progressState.overlay);
      updatePdfProgress(progressState, 3, "Starting");
      progressState.overlay.querySelector(".pdf-progress-cancel")?.focus();

      try {
        const isLegacy = pdfEngineLegacyInput.checked;
        const markdown = markdownEditor.value;

        const { fullHtml, tempElement } = await PdfExportEngine.ExportDocumentBuilder.build(markdown, progressState);

        if (isLegacy) {
          await PdfExportEngine.LegacyRasterBackend.print(tempElement, progressState);
        } else {
          updatePdfProgress(progressState, 75, "Generating PDF");
          if (typeof Neutralino !== 'undefined') {
            await PdfExportEngine.DesktopChromiumSidecarBackend.print(fullHtml, progressState);
          } else {
            await PdfExportEngine.WebPrintBackend.print(fullHtml, progressState);
          }
        }

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
  }

  exportPdf.addEventListener("click", async function (event) {
    event.preventDefault();
    openPdfExportModal();
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
    if (!clone.getAttribute('width'))  clone.setAttribute('width',  Math.round(bbox.width));
    if (!clone.getAttribute('height')) clone.setAttribute('height', Math.round(bbox.height));
    const serialized = new XMLSerializer().serializeToString(clone);
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(serialized);
  }

  /**
   * Renders an SVG element onto a canvas and resolves with the canvas.
   */
  function svgToCanvas(svgEl) {
    return new Promise((resolve, reject) => {
      const bbox = svgEl.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      const width  = Math.max(Math.round(bbox.width),  1);
      const height = Math.max(Math.round(bbox.height), 1);

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
    // PERF-007: Clear elements using textContent
    mermaidModalDiagram.textContent = '';
    modalCurrentSvgEl = null;
    modalZoomScale = 1;
    modalPanX = 0;
    modalPanY = 0;
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
    // Remove fixed dimensions so it sizes naturally inside the modal
    svgClone.removeAttribute('width');
    svgClone.removeAttribute('height');
    svgClone.style.width  = 'auto';
    svgClone.style.height = 'auto';
    svgClone.style.maxWidth  = '80vw';
    svgClone.style.maxHeight = '60vh';
    svgClone.style.transformOrigin = 'center';
    mermaidModalDiagram.appendChild(svgClone);
    modalCurrentSvgEl = svgClone;

    mermaidZoomModal.classList.add('active');
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

  // Mouse-wheel zoom inside modal
  mermaidModalDiagram.addEventListener('wheel', function(e) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    modalZoomScale = Math.min(Math.max(modalZoomScale + delta, 0.1), 10);
    applyModalTransform();
  }, { passive: false });

  // Drag to pan inside modal
  mermaidModalDiagram.addEventListener('mousedown', function(e) {
    modalIsDragging = true;
    modalDragStart = { x: e.clientX - modalPanX, y: e.clientY - modalPanY };
    mermaidModalDiagram.classList.add('dragging');
  });
  document.addEventListener('mousemove', function(e) {
    if (!modalIsDragging) return;
    modalPanX = e.clientX - modalDragStart.x;
    modalPanY = e.clientY - modalDragStart.y;
    applyModalTransform();
  });
  document.addEventListener('mouseup', function() {
    if (modalIsDragging) {
      modalIsDragging = false;
      mermaidModalDiagram.classList.remove('dragging');
    }
  });

  // Modal download buttons (operate on the currently displayed SVG)
  document.getElementById('mermaid-modal-download-png').addEventListener('click', async function() {
    if (!modalCurrentSvgEl) return;
    const btn = this;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
    try {
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
    } catch (e) {
      console.error('Modal copy failed:', e);
      btn.innerHTML = original;
    }
  });

  document.getElementById('mermaid-modal-download-svg').addEventListener('click', function() {
    if (!modalCurrentSvgEl) return;
    const serialized = new XMLSerializer().serializeToString(modalCurrentSvgEl);
    const blob = new Blob([serialized], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `diagram-${Date.now()}.svg`; a.click();
    URL.revokeObjectURL(url);
  });

  /**
   * Adds the hover toolbar to every rendered Mermaid container.
   * Safe to call multiple times – existing toolbars are not duplicated.
   */
  function addMermaidToolbars() {
    markdownPreview.querySelectorAll('.mermaid-container').forEach(container => {
      if (container.querySelector('.mermaid-toolbar')) return; // already added
      const svgEl = container.querySelector('svg');
      if (!svgEl) return; // diagram not yet rendered

      const toolbar = document.createElement('div');
      toolbar.className = 'mermaid-toolbar';
      toolbar.setAttribute('aria-label', 'Diagram actions');

      const btnZoom = document.createElement('button');
      btnZoom.className = 'mermaid-toolbar-btn';
      btnZoom.title = 'Zoom diagram';
      btnZoom.setAttribute('aria-label', 'Zoom diagram');
      btnZoom.innerHTML = '<i class="bi bi-arrows-fullscreen"></i>';
      btnZoom.addEventListener('click', () => openMermaidZoomModal(container));

      const btnPng = document.createElement('button');
      btnPng.className = 'mermaid-toolbar-btn';
      btnPng.title = 'Download PNG';
      btnPng.setAttribute('aria-label', 'Download PNG');
      btnPng.innerHTML = '<i class="bi bi-file-image"></i> PNG';
      btnPng.addEventListener('click', () => downloadMermaidPng(container, btnPng));

      const btnCopy = document.createElement('button');
      btnCopy.className = 'mermaid-toolbar-btn';
      btnCopy.title = 'Copy image to clipboard';
      btnCopy.setAttribute('aria-label', 'Copy image to clipboard');
      btnCopy.innerHTML = '<i class="bi bi-clipboard-image"></i> Copy';
      btnCopy.addEventListener('click', () => copyMermaidImage(container, btnCopy));

      const btnSvg = document.createElement('button');
      btnSvg.className = 'mermaid-toolbar-btn';
      btnSvg.title = 'Download SVG';
      btnSvg.setAttribute('aria-label', 'Download SVG');
      btnSvg.innerHTML = '<i class="bi bi-filetype-svg"></i> SVG';
      btnSvg.addEventListener('click', () => downloadMermaidSvg(container, btnSvg));

      toolbar.appendChild(btnZoom);
      toolbar.appendChild(btnCopy);
      toolbar.appendChild(btnPng);
      toolbar.appendChild(btnSvg);
      container.appendChild(toolbar);
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
    }
  };

  let activeLang = 'en';

  function applyTranslations(lang) {
    activeLang = lang;
    document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-Hans' : lang);
    const dict = I18N_DICTS[lang] || I18N_DICTS.en;

    // Update main logo and header elements
    const logoEl = document.querySelector('.app-header h1');
    if (logoEl) logoEl.textContent = dict.title;

    // Update dynamic current language labels in drop menus
    const labelEl = document.getElementById('current-lang-label');
    if (labelEl) {
      const flags = { en: "🇺🇸 English", zh: "🇨🇳 简体中文", ja: "🇯🇵 日本語", ko: "🇰🇷 한국어", pt: "🇧🇷 Português (Brasil)" };
      labelEl.textContent = flags[lang];
    }
    const mobileLabelEl = document.getElementById('mobile-current-lang-label');
    if (mobileLabelEl) {
      const flags = { en: "us English", zh: "CN 简体中文", ja: "JP 日本語", ko: "KR 한국어", pt: "BR Português (Brasil)" };
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

    const mExportMdEl = document.getElementById('mobile-export-md');
    if (mExportMdEl) mExportMdEl.innerHTML = `<i class="bi bi-file-earmark-text me-2"></i>${dict.exportMd}`;
    const mExportHtmlEl = document.getElementById('mobile-export-html');
    if (mExportHtmlEl) mExportHtmlEl.innerHTML = `<i class="bi bi-file-earmark-code me-2"></i>${dict.exportHtml}`;
    const mExportPdfEl = document.getElementById('mobile-export-pdf');
    if (mExportPdfEl) mExportPdfEl.innerHTML = `<i class="bi bi-file-earmark-pdf me-2"></i>${dict.exportPdf}`;

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
      if (navLang.startsWith('zh')) lang = 'zh';
      else if (navLang.startsWith('ja')) lang = 'ja';
      else if (navLang.startsWith('ko')) lang = 'ko';
      else if (navLang.startsWith('pt')) lang = 'pt';
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
      localStorage.setItem('app-lang', lang);
      
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
