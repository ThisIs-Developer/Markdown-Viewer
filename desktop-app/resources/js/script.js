document.addEventListener("DOMContentLoaded", function () {
  let markdownRenderTimeout = null;
  const RENDER_DELAY = 100;
  let syncScrollingEnabled = true;
  let isEditorScrolling = false;
  let isPreviewScrolling = false;
  let scrollSyncTimeout = null;
  const SCROLL_SYNC_DELAY = 10;

  // View Mode State - Story 1.1
  let currentViewMode = 'split'; // 'editor', 'split', or 'preview'
  const APP_VERSION = '3.5.4';
  let activeModal = null;
  let lastFocusedElement = null;
  let isFindModalOpen = false;
  let findMatches = [];
  let activeFindIndex = -1;
  let lastFindQuery = '';

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
  const mobileDirectionToggle = document.getElementById("mobile-direction-toggle");
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

  function loadGlobalState() {
    try { return JSON.parse(localStorage.getItem(GLOBAL_STATE_KEY)) || {}; }
    catch { return {}; }
  }

  function saveGlobalState(patch) {
    localStorage.setItem(GLOBAL_STATE_KEY, JSON.stringify({ ...loadGlobalState(), ...patch }));
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
    if (mobileDirectionToggle) {
      const icon = isRtl
        ? '<i class="bi bi-text-left me-2"></i>'
        : '<i class="bi bi-text-right me-2"></i>';
      mobileDirectionToggle.innerHTML = `${icon} ${toggleLabel}`;
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

  const initMermaid = () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const mermaidTheme = currentTheme === "dark" ? "dark" : "default";
    
    mermaid.initialize({
      startOnLoad: false,
      theme: mermaidTheme,
      securityLevel: 'loose',
      flowchart: { useMaxWidth: true, htmlLabels: true },
      fontSize: 16
    });
  };

  try {
    initMermaid();
  } catch (e) {
    console.warn("Mermaid initialization failed:", e);
  }

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
  let lineNumberMeasure = null;
  let lineNumberUpdateFrame = null;

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
        const renderedParagraph = marked.parseInline(paragraph);
        const safeParagraph = typeof DOMPurify !== "undefined"
          ? DOMPurify.sanitize(renderedParagraph)
          : renderedParagraph;
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
      const termHtml = marked.parseInline(token.term);
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
      return `<div class="mermaid-container"><div class="mermaid" id="${uniqueId}">${code}</div></div>`;
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
        resetExtendedMarkdownState();
        return applyFootnotes(extractFootnoteDefinitions(markdown));
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

  const sampleMarkdown = `---
title: Welcome to Markdown Viewer
description: A GitHub-style Markdown renderer with live preview, math, diagrams, and export support.
author: ThisIs-Developer
tags: ["markdown", "preview", "mermaid", "latex", "open-source"]
---

# Welcome to Markdown Viewer

## ✨ Key Features
- **Live Preview** with GitHub styling
- **Smart Import/Export** (MD, HTML, PDF)
- **Mermaid Diagrams** for visual documentation
- **LaTeX Math Support** for scientific notation
- **Emoji Support** 😄 👍 🎉

## 💻 Code with Syntax Highlighting
\`\`\`javascript
  function renderMarkdown() {
    const markdown = markdownEditor.value;
    const html = marked.parse(markdown);
    const sanitizedHtml = DOMPurify.sanitize(html);
    markdownPreview.innerHTML = sanitizedHtml;
    
    // Syntax highlighting is handled automatically
    // during the parsing phase by the marked renderer.
    // Themes are applied instantly via CSS variables.
  }
\`\`\`

## 🧮 Mathematical Expressions
Write complex formulas with LaTeX syntax:

Inline equation: $$E = mc^2$$

Display equations:
$$\\frac{\\partial f}{\\partial x} = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}$$

$$\\sum_{i=1}^{n} i^2 = \\frac{n(n+1)(2n+1)}{6}$$

## 📊 Mermaid Diagrams
Create powerful visualizations directly in markdown:

\`\`\`mermaid
flowchart LR
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    C --> E[Deploy]
    D --> B
\`\`\`

### Sequence Diagram Example
\`\`\`mermaid
sequenceDiagram
    User->>Editor: Type markdown
    Editor->>Preview: Render content
    User->>Editor: Make changes
    Editor->>Preview: Update rendering
    User->>Export: Save as PDF
\`\`\`

## 📋 Task Management
- [x] Create responsive layout
- [x] Implement live preview with GitHub styling
- [x] Add syntax highlighting for code blocks
- [x] Support math expressions with LaTeX
- [x] Enable mermaid diagrams

## 🆚 Feature Comparison

| Feature                  | Markdown Viewer (Ours) | Other Markdown Editors  |
|:-------------------------|:----------------------:|:-----------------------:|
| Live Preview             | ✅ GitHub-Styled       | ✅                     |
| Sync Scrolling           | ✅ Two-way             | 🔄 Partial/None        |
| Mermaid Support          | ✅                     | ❌/Limited             |
| LaTeX Math Rendering     | ✅                     | ❌/Limited             |

### 📝 Multi-row Headers Support

<table>
  <thead>
    <tr>
      <th rowspan="2">Document Type</th>
      <th colspan="2">Support</th>
    </tr>
    <tr>
      <th>Markdown Viewer (Ours)</th>
      <th>Other Markdown Editors</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Technical Docs</td>
      <td>Full + Diagrams</td>
      <td>Limited/Basic</td>
    </tr>
    <tr>
      <td>Research Notes</td>
      <td>Full + Math</td>
      <td>Partial</td>
    </tr>
    <tr>
      <td>Developer Guides</td>
      <td>Full + Export Options</td>
      <td>Basic</td>
    </tr>
  </tbody>
</table>

## 📝 Text Formatting Examples

### Text Formatting

Text can be formatted in various ways for ~~strikethrough~~, **bold**, *italic*, or ***bold italic***.

For highlighting important information, use <mark>highlighted text</mark> or add <u>underlines</u> where appropriate.

### Superscript and Subscript

Chemical formulas: H<sub>2</sub>O, CO<sub>2</sub>  
Mathematical notation: x<sup>2</sup>, e<sup>iπ</sup>

### Keyboard Keys

Press <kbd>Ctrl</kbd> + <kbd>B</kbd> for bold text.

### Abbreviations

<abbr title="Graphical User Interface">GUI</abbr>  
<abbr title="Application Programming Interface">API</abbr>

### Text Alignment

<div style="text-align: center">
Centered text for headings or important notices
</div>

<div style="text-align: right">
Right-aligned text (for dates, signatures, etc.)
</div>

### **Lists**

Create bullet points:
* Item 1
* Item 2
  * Nested item
    * Nested further

### **Links and Images**

Add a [link](https://github.com/ThisIs-Developer/Markdown-Viewer) to important resources.

Embed an image:
![Markdown Logo](https://markdownviewer.pages.dev/assets/icon.jpg)

### **Blockquotes**

Quote someone famous:
> "The best way to predict the future is to invent it." - Alan Kay

---

## 🛡️ Security Note

This is a fully client-side application. Your content never leaves your browser and stays secure on your device.`;

  markdownEditor.value = sampleMarkdown;

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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tabsArr));
    } catch (e) {
      console.warn('Failed to save tabs to localStorage:', e);
    }
  }

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
    menuBtn.innerHTML = '&#8943;';

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
    tabList.innerHTML = '';
    tabsArr.forEach(function(tab) {
      const item = document.createElement('div');
      item.className = 'tab-item' + (tab.id === currentActiveTabId ? ' active' : '');
      item.setAttribute('data-tab-id', tab.id);
      item.setAttribute('role', 'tab');
      item.setAttribute('aria-selected', tab.id === currentActiveTabId ? 'true' : 'false');
      item.setAttribute('draggable', 'true');

      const titleSpan = document.createElement('span');
      titleSpan.className = 'tab-title';
      titleSpan.textContent = tab.title || 'Untitled';
      titleSpan.title = tab.title || 'Untitled';

      const tabMenu = createTabActionMenu(tab, { menuIdPrefix: 'desktop-tab-menu' });

      item.appendChild(titleSpan);
      item.appendChild(tabMenu.button);

      item.addEventListener('click', function() {
        switchTab(tab.id);
      });

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

    // "+ Create" button at end of tab list
    const newBtn = document.createElement('button');
    newBtn.className = 'tab-new-btn';
    newBtn.title = 'New Tab (Ctrl+T)';
    newBtn.setAttribute('aria-label', 'Open new tab');
    newBtn.innerHTML = '<i class="bi bi-plus-lg"></i>';
    newBtn.addEventListener('click', function() { newTab(); });
    tabList.appendChild(newBtn);

    // Auto-scroll active tab into view
    const activeItem = tabList.querySelector('.tab-item.active');
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    renderMobileTabList(tabsArr, currentActiveTabId);
  }

  function renderMobileTabList(tabsArr, currentActiveTabId) {
    const mobileTabList = document.getElementById('mobile-tab-list');
    if (!mobileTabList) return;
    mobileTabList.innerHTML = '';
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
    activeTabId = tabId;
    saveActiveTabId(activeTabId);
    const tab = tabs.find(function(t) { return t.id === tabId; });
    if (!tab) return;
    markdownEditor.value = tab.content;
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
    modal.style.display = 'flex';
    input.focus();
    input.select();

    function doRename() {
      const newName = input.value.trim();
      if (newName) {
        tab.title = newName;
        saveTabsToStorage(tabs);
        renderTabBar(tabs, activeTabId);
      }
      modal.style.display = 'none';
      cleanup();
    }

    function cleanup() {
      confirmBtn.removeEventListener('click', doRename);
      cancelBtn.removeEventListener('click', doCancel);
      input.removeEventListener('keydown', onKey);
    }

    function doCancel() {
      modal.style.display = 'none';
      cleanup();
    }

    function onKey(e) {
      if (e.key === 'Enter') doRename();
      else if (e.key === 'Escape') doCancel();
    }

    confirmBtn.addEventListener('click', doRename);
    cancelBtn.addEventListener('click', doCancel);
    input.addEventListener('keydown', onKey);
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
    modal.style.display = 'flex';

    function doReset() {
      modal.style.display = 'none';
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
      modal.style.display = 'none';
      cleanup();
    }

    function cleanup() {
      confirmBtn.removeEventListener('click', doReset);
      cancelBtn.removeEventListener('click', doCancel);
    }

    confirmBtn.addEventListener('click', doReset);
    cancelBtn.addEventListener('click', doCancel);
  }

  function initTabs() {
    untitledCounter = loadUntitledCounter();
    tabs = loadTabsFromStorage();
    activeTabId = loadActiveTabId();
    if (tabs.length === 0) {
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
    restoreViewMode(activeTab.viewMode);
    renderMarkdown();
    requestAnimationFrame(function() {
      markdownEditor.scrollTop = activeTab.scrollPos || 0;
    });
    renderTabBar(tabs, activeTabId);
  }

  function renderMarkdown() {
    try {
      const { frontmatter, body } = parseFrontmatter(markdownEditor.value);
      const tableHtml = frontmatter ? renderFrontmatterTable(frontmatter) : '';
      const referenceData = extractReferenceDefinitions(body);
      const html = tableHtml + marked.parse(referenceData.cleanedMarkdown);
      const sanitizedHtml = DOMPurify.sanitize(html, {
        ADD_TAGS: ['mjx-container', 'input'],
        ADD_ATTR: ['id', 'class', 'style', 'align', 'type', 'checked', 'disabled'],
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
      });
      markdownPreview.innerHTML = sanitizedHtml;
      applyReferencePreviewLinks(markdownPreview, referenceData.definitions);
      enhanceGitHubAlerts(markdownPreview);

      processEmojis(markdownPreview);
      
      // Reinitialize mermaid with current theme before rendering diagrams
      initMermaid();
      
      try {
        const mermaidNodes = markdownPreview.querySelectorAll('.mermaid');
        if (mermaidNodes.length > 0) {
          Promise.resolve(mermaid.init(undefined, mermaidNodes))
            .then(() => addMermaidToolbars())
            .catch((e) => {
              console.warn("Mermaid rendering failed:", e);
              addMermaidToolbars();
            });
        }
      } catch (e) {
        console.warn("Mermaid rendering failed:", e);
      }
      
      if (window.MathJax) {
        try {
          MathJax.typesetPromise([markdownPreview]).catch((err) => {
            console.warn('MathJax typesetting failed:', err);
          });
        } catch (e) {
          console.warn("MathJax rendering failed:", e);
        }
      }

      updateDocumentStats();
      updateFindHighlights();
      cleanupImageObjectUrls();
      scheduleLineNumberUpdate();
    } catch (e) {
      console.error("Markdown rendering failed:", e);
      const safeMessage = escapeHtml(e && e.message ? e.message : 'Unknown error');
      const safeMarkdown = escapeHtml(markdownEditor.value);
      markdownPreview.innerHTML = `<div class="alert alert-danger">
              <strong>Error rendering markdown:</strong> ${safeMessage}
          </div>
          <pre>${safeMarkdown}</pre>`;
    }
  }

  function importMarkdownFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      newTab(e.target.result, file.name.replace(/\.md$/i, ''));
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
      if (segments.length < 5) return null;
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
    githubImportModal.style.display = "flex";
    githubImportUrlInput.focus();
  }

  function closeGitHubImportModal() {
    if (!githubImportModal) return;
    githubImportModal.style.display = "none";
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
      try {
        for (const selectedPath of selectedPaths) {
          const markdown = await fetchTextContent(buildRawGitHubUrl(owner, repo, ref, selectedPath));
          newTab(markdown, getFileName(selectedPath).replace(/\.(md|markdown)$/i, ""));
        }
        closeGitHubImportModal();
      } catch (error) {
        console.error("GitHub import failed:", error);
        setGitHubImportMessage("GitHub import failed: " + error.message);
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
        const markdown = await fetchTextContent(buildRawGitHubUrl(parsed.owner, parsed.repo, parsed.ref, parsed.filePath));
        newTab(markdown, getFileName(parsed.filePath).replace(/\.(md|markdown)$/i, ""));
        closeGitHubImportModal();
        return;
      }

      const ref = parsed.ref || await getDefaultBranch(parsed.owner, parsed.repo);
      const files = await listMarkdownFiles(parsed.owner, parsed.repo, ref, parsed.basePath || "");

      if (!files.length) {
        setGitHubImportMessage("No Markdown files were found at that GitHub location.");
        return;
      }

      const shownFiles = files.slice(0, MAX_GITHUB_FILES_SHOWN);
      if (files.length === 1) {
        const targetPath = files[0];
        const markdown = await fetchTextContent(buildRawGitHubUrl(parsed.owner, parsed.repo, ref, targetPath));
        newTab(markdown, getFileName(targetPath).replace(/\.(md|markdown)$/i, ""));
        closeGitHubImportModal();
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
          renderMarkdown();
        }
      })
      .finally(() => {
        emojiRenderScheduled = false;
      });
  }

  function processEmojis(element) {
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
    markdownRenderTimeout = setTimeout(renderMarkdown, RENDER_DELAY);
  }

  function updateDocumentStats() {
    const text = markdownEditor.value;

    const charCount = text.length;
    charCountElement.textContent = charCount.toLocaleString();

    const wordCount = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
    wordCountElement.textContent = wordCount.toLocaleString();

    const readingTimeMinutes = Math.ceil(wordCount / 200);
    readingTimeElement.textContent = readingTimeMinutes;
  }

  function syncEditorToPreview() {
    if (!syncScrollingEnabled || isPreviewScrolling) return;

    isEditorScrolling = true;
    clearTimeout(scrollSyncTimeout);

    scrollSyncTimeout = setTimeout(() => {
      const editorScrollRatio =
        editorPane.scrollTop /
        (editorPane.scrollHeight - editorPane.clientHeight);
      const previewScrollPosition =
        (previewPane.scrollHeight - previewPane.clientHeight) *
        editorScrollRatio;

      if (!isNaN(previewScrollPosition) && isFinite(previewScrollPosition)) {
        previewPane.scrollTop = previewScrollPosition;
      }

      setTimeout(() => {
        isEditorScrolling = false;
      }, 50);
    }, SCROLL_SYNC_DELAY);
  }

  function syncPreviewToEditor() {
    if (!syncScrollingEnabled || isEditorScrolling) return;

    isPreviewScrolling = true;
    clearTimeout(scrollSyncTimeout);

    scrollSyncTimeout = setTimeout(() => {
      const previewScrollRatio =
        previewPane.scrollTop /
        (previewPane.scrollHeight - previewPane.clientHeight);
      const editorScrollPosition =
        (editorPane.scrollHeight - editorPane.clientHeight) *
        previewScrollRatio;

      if (!isNaN(editorScrollPosition) && isFinite(editorScrollPosition)) {
        editorPane.scrollTop = editorScrollPosition;
      }

      setTimeout(() => {
        isPreviewScrolling = false;
      }, 50);
    }, SCROLL_SYNC_DELAY);
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
      renderMarkdown();
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
    markdownEditor.focus();
    markdownEditor.setRangeText(replacement, start, end, 'end');
    const nextStart = typeof selectStart === 'number' ? selectStart : start + replacement.length;
    const nextEnd = typeof selectEnd === 'number' ? selectEnd : nextStart;
    markdownEditor.setSelectionRange(nextStart, nextEnd);
    markdownEditor.dispatchEvent(new Event('input', { bubbles: true }));
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
    emptyMessage.textContent = 'Loading emojis...';
    emptyMessage.style.display = 'block';
    searchInput.value = '';
    emojiSelection.clear();
    grid.innerHTML = '';
    emojiItems = [];

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

    function renderEmojiGrid() {
      grid.innerHTML = '';
      const fragment = document.createDocumentFragment();
      emojiItems = emojiEntries.map((entry) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'emoji-item';
        item.setAttribute('aria-pressed', 'false');
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
      grid.appendChild(fragment);
    }

    function applyFilter() {
      const query = searchInput.value.trim().toLowerCase();
      let visibleCount = 0;
      emojiItems.forEach((item) => {
        const match = !query || item.search.includes(query);
        item.element.style.display = match ? '' : 'none';
        if (match) visibleCount += 1;
      });
      emptyMessage.style.display = visibleCount ? 'none' : 'block';
    }

    function insertEmojis() {
      if (!emojiSelection.size) return;
      const ordered = emojiItems
        .filter((item) => emojiSelection.has(item.shortcode))
        .map((item) => item.shortcode);
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
    }

    loadEmojiEntries().then((entries) => {
      if (!entries.length) {
        emptyMessage.textContent = 'Unable to load emojis.';
        emptyMessage.style.display = 'block';
        grid.innerHTML = '';
        emojiItems = [];
        return;
      }
      renderEmojiGrid();
      emptyMessage.textContent = 'No emojis found.';
      applyFilter();
      updateInsertState();
    });

    confirmBtn.addEventListener('click', insertEmojis);
    cancelBtn.addEventListener('click', closeModal);
    searchInput.addEventListener('input', applyFilter);
    searchInput.addEventListener('keydown', onKey);

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
    grid.innerHTML = '';

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
    grid.innerHTML = '';

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
    const text = markdownEditor.value || '';
    const scrollTop = markdownEditor.scrollTop;
    const scrollLeft = markdownEditor.scrollLeft;
    if (!isFindModalOpen || !findReplaceInput || !findReplaceInput.value || !findMatches.length) {
      editorHighlightLayer.textContent = text;
      editorHighlightLayer.scrollTop = scrollTop;
      editorHighlightLayer.scrollLeft = scrollLeft;
      return;
    }
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
    editorHighlightLayer.scrollTop = markdownEditor.scrollTop;
    editorHighlightLayer.scrollLeft = markdownEditor.scrollLeft;
  }

  function updateLineNumberGutter(lineCount) {
    if (!editorPaneElement) return;
    const digits = String(Math.max(1, lineCount)).length;
    const gutterSize = `${Math.max(LINE_NUMBER_GUTTER_MIN_CH, digits + LINE_NUMBER_GUTTER_PADDING_CH)}ch`;
    editorPaneElement.style.setProperty('--line-number-gutter', gutterSize);
  }

  function ensureLineNumberMeasure() {
    if (!lineNumbers) return;
    if (!lineNumberMeasure) {
      lineNumberMeasure = document.createElement('div');
      lineNumberMeasure.setAttribute('aria-hidden', 'true');
      document.body.appendChild(lineNumberMeasure);
    }
    const styles = window.getComputedStyle(markdownEditor);
    lineNumberMeasure.style.position = 'absolute';
    lineNumberMeasure.style.visibility = 'hidden';
    lineNumberMeasure.style.whiteSpace = 'pre-wrap';
    lineNumberMeasure.style.wordWrap = 'break-word';
    lineNumberMeasure.style.boxSizing = 'border-box';
    lineNumberMeasure.style.padding = styles.padding;
    lineNumberMeasure.style.fontFamily = styles.fontFamily;
    lineNumberMeasure.style.fontSize = styles.fontSize;
    lineNumberMeasure.style.lineHeight = styles.lineHeight;
    lineNumberMeasure.style.letterSpacing = styles.letterSpacing;
    lineNumberMeasure.style.width = `${markdownEditor.clientWidth}px`;
    lineNumberMeasure.style.top = '-9999px';
    lineNumberMeasure.style.left = '-9999px';
  }

  function getLineHeight(styles) {
    const computed = parseFloat(styles.lineHeight);
    if (!Number.isNaN(computed)) return computed;
    const fontSize = parseFloat(styles.fontSize) || 14;
    return fontSize * 1.5;
  }

  function getWrappedLineCount(line, lineHeight, paddingSum) {
    if (!lineNumberMeasure) return 1;
    lineNumberMeasure.textContent = line.length ? line : LINE_NUMBER_EMPTY_PLACEHOLDER;
    const contentHeight = lineNumberMeasure.scrollHeight - paddingSum;
    return Math.max(1, Math.round(contentHeight / lineHeight));
  }

  function updateLineNumbers() {
    if (!lineNumbers || !markdownEditor) return;
    const lines = (markdownEditor.value || '').split('\n');
    const lineCount = Math.max(1, lines.length);
    updateLineNumberGutter(lineCount);
    ensureLineNumberMeasure();
    const styles = window.getComputedStyle(markdownEditor);
    const lineHeight = getLineHeight(styles);
    const paddingSum =
      (parseFloat(styles.paddingTop) || 0) +
      (parseFloat(styles.paddingBottom) || 0);
    const existingItems = lineNumbers.children;
    if (existingItems.length !== lineCount) {
      const fragment = document.createDocumentFragment();
      lines.forEach(function(line, index) {
        const lineNumber = document.createElement('div');
        lineNumber.className = 'line-number';
        lineNumber.textContent = index + 1;
        const wrapCount = getWrappedLineCount(line, lineHeight, paddingSum);
        lineNumber.style.height = `${wrapCount * lineHeight}px`;
        fragment.appendChild(lineNumber);
      });
      lineNumbers.textContent = '';
      lineNumbers.appendChild(fragment);
    } else {
      for (let i = 0; i < lineCount; i += 1) {
        const wrapCount = getWrappedLineCount(lines[i], lineHeight, paddingSum);
        existingItems[i].style.height = `${wrapCount * lineHeight}px`;
      }
    }
    syncLineNumberScroll();
  }

  function scheduleLineNumberUpdate() {
    if (!lineNumbers) return;
    if (lineNumberUpdateFrame) return;
    lineNumberUpdateFrame = window.requestAnimationFrame(function() {
      lineNumberUpdateFrame = null;
      updateLineNumbers();
    });
  }

  function syncLineNumberScroll() {
    if (!lineNumbers) return;
    lineNumbers.scrollTop = markdownEditor.scrollTop;
  }

  function computeFindMatches(value, query) {
    if (!query) return [];
    const haystack = value.toLowerCase();
    const needle = query.toLowerCase();
    const matches = [];
    let index = haystack.indexOf(needle);
    while (index !== -1) {
      matches.push({ start: index, end: index + needle.length });
      index = haystack.indexOf(needle, index + needle.length);
    }
    return matches;
  }

  function updateFindControls() {
    if (!findReplaceCount) return;
    const total = findMatches.length;
    const current = total && activeFindIndex >= 0 ? activeFindIndex + 1 : 0;
    findReplaceCount.textContent = current + ' of ' + total + ' matches';
    const hasMatches = total > 0;
    const hasQuery = !!(findReplaceInput && findReplaceInput.value);
    if (findReplacePrev) findReplacePrev.disabled = !hasMatches;
    if (findReplaceNext) findReplaceNext.disabled = !hasMatches;
    if (findReplaceCurrent) findReplaceCurrent.disabled = !hasMatches;
    if (findReplaceAll) findReplaceAll.disabled = !hasQuery || !hasMatches;
  }

  function refreshFindMatches(options) {
    const opts = options || {};
    const query = findReplaceInput ? findReplaceInput.value : '';
    if (!isFindModalOpen || !query) {
      findMatches = [];
      activeFindIndex = -1;
      updateFindControls();
      updateFindHighlights();
      return;
    }
    findMatches = computeFindMatches(markdownEditor.value, query);
    if (opts.resetIndex || query !== lastFindQuery) {
      activeFindIndex = findMatches.length ? 0 : -1;
    } else if (activeFindIndex >= findMatches.length) {
      activeFindIndex = findMatches.length - 1;
    }
    lastFindQuery = query;
    updateFindControls();
    updateFindHighlights();
  }

  function selectActiveMatch() {
    if (!findMatches.length || activeFindIndex < 0) return;
    const match = findMatches[activeFindIndex];
    markdownEditor.focus();
    markdownEditor.setSelectionRange(match.start, match.end);
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
    isFindModalOpen = true;
    const selected = markdownEditor.value.slice(markdownEditor.selectionStart, markdownEditor.selectionEnd);
    if (selected) {
      findReplaceInput.value = selected;
    }
    openAppModal(findReplaceModal, { focusTarget: findReplaceInput, onClose: closeFindReplaceModal });
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
    closeAppModal(findReplaceModal);
    findMatches = [];
    activeFindIndex = -1;
    updateFindControls();
    updateFindHighlights();
  }

  function replaceCurrentMatch() {
    if (!findMatches.length) return;
    const replacement = findReplaceWith ? findReplaceWith.value : '';
    const match = findMatches[activeFindIndex];
    replaceEditorRange(match.start, match.end, replacement, match.start, match.start + replacement.length);
    refreshFindMatches();
    if (findMatches.length) {
      activeFindIndex = Math.min(activeFindIndex, findMatches.length - 1);
      selectActiveMatch();
    }
  }

  function replaceAllMatches() {
    const query = findReplaceInput ? findReplaceInput.value : '';
    if (!query) return;
    const replacement = findReplaceWith ? findReplaceWith.value : '';
    const regex = new RegExp(escapeRegExp(query), 'gi');
    markdownEditor.value = markdownEditor.value.replace(regex, replacement);
    markdownEditor.dispatchEvent(new Event('input', { bubbles: true }));
    refreshFindMatches({ resetIndex: true });
    if (findMatches.length) {
      selectActiveMatch();
    }
  }

  function openClearFormattingModal() {
    if (!clearFormattingModal) return;
    openAppModal(clearFormattingModal, { focusTarget: clearFormattingConfirm || clearFormattingCancel });
  }

  function applyClearFormatting() {
    const stripped = stripBasicMarkdown(markdownEditor.value);
    replaceEditorRange(0, markdownEditor.value.length, stripped, 0, 0);
  }

  function openHelpModal() {
    if (!helpModal) return;
    openAppModal(helpModal, { focusTarget: helpModalClose || helpModalCloseIcon });
  }

  function openAboutModal() {
    if (!aboutModal) return;
    openAppModal(aboutModal, { focusTarget: aboutModalClose || aboutModalCloseIcon });
  }

  function initFindReplaceModal() {
    if (!findReplaceModal || !findReplaceInput) return;
    findReplaceInput.addEventListener('input', function() {
      refreshFindMatches({ resetIndex: true });
    });
    findReplaceInput.addEventListener('keydown', function(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        cycleFindMatch(event.shiftKey ? -1 : 1);
      }
    });
    if (findReplaceWith) {
      findReplaceWith.addEventListener('input', updateFindControls);
    }
    if (findReplacePrev) {
      findReplacePrev.addEventListener('click', function() { cycleFindMatch(-1); });
    }
    if (findReplaceNext) {
      findReplaceNext.addEventListener('click', function() { cycleFindMatch(1); });
    }
    if (findReplaceCurrent) {
      findReplaceCurrent.addEventListener('click', replaceCurrentMatch);
    }
    if (findReplaceAll) {
      findReplaceAll.addEventListener('click', replaceAllMatches);
    }
    if (findReplaceClose) {
      findReplaceClose.addEventListener('click', closeFindReplaceModal);
    }
    if (findReplaceCloseIcon) {
      findReplaceCloseIcon.addEventListener('click', closeFindReplaceModal);
    }
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

  function runMarkdownTool(action, button) {
    if (action === 'undo' || action === 'redo') {
      markdownEditor.focus();
      document.execCommand(action);
      markdownEditor.dispatchEvent(new Event('input', { bubbles: true }));
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

    resizeDivider.addEventListener('mousedown', startResize);
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);

    // Touch support for tablets (though disabled via CSS, keeping for future)
    resizeDivider.addEventListener('touchstart', startResizeTouch);
    document.addEventListener('touchmove', handleResizeTouch);
    document.addEventListener('touchend', stopResize);
  }

  function startResize(e) {
    if (currentViewMode !== 'split') return;
    e.preventDefault();
    isResizing = true;
    resizeDivider.classList.add('dragging');
    document.body.classList.add('resizing');
  }

  function startResizeTouch(e) {
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
    if (currentViewMode !== 'split') return;

    const previewPercent = 100 - editorWidthPercent;
    editorPaneElement.style.flex = `0 0 calc(${editorWidthPercent}% - 4px)`;
    previewPaneElement.style.flex = `0 0 calc(${previewPercent}% - 4px)`;
    scheduleLineNumberUpdate();
  }

  function resetPaneWidths() {
    editorPaneElement.style.flex = '';
    previewPaneElement.style.flex = '';
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
  mobileImportBtn.addEventListener("click", () => fileInput.click());
  mobileImportGithubBtn.addEventListener("click", () => {
    closeMobileMenu();
    openGitHubImportModal();
  });
  mobileExportMd.addEventListener("click", () => exportMd.click());
  mobileExportHtml.addEventListener("click", () => exportHtml.click());
  mobileExportPdf.addEventListener("click", () => exportPdf.click());
  mobileCopyMarkdown.addEventListener("click", () => copyMarkdownButton.click());
  if (mobileDirectionToggle) {
    mobileDirectionToggle.addEventListener("click", () => {
      if (directionToggle) {
        directionToggle.click();
      } else {
        const currentDir = markdownEditor ? markdownEditor.getAttribute("dir") : "ltr";
        const direction = currentDir === "rtl" ? "ltr" : "rtl";
        applyDirectionToContent(direction);
        saveGlobalState({ direction });
        updateDirectionToggleUI(direction);
      }
    });
  }
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

  // Initialize resizer - Story 1.3
  initResizer();
  window.addEventListener('resize', scheduleLineNumberUpdate);

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

  markdownEditor.addEventListener("input", function() {
    debouncedRender();
    clearTimeout(saveTabStateTimeout);
    saveTabStateTimeout = setTimeout(saveCurrentTabState, 500);
    if (isFindModalOpen) {
      refreshFindMatches();
    } else {
      updateFindHighlights();
    }
    scheduleLineNumberUpdate();
  });

  initMarkdownFormatToolbar();
  initFindReplaceModal();
  initAppModals();
  
  // Editor key handlers for list continuation and indentation
  markdownEditor.addEventListener("keydown", function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      openFindReplaceModal();
      return;
    }
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
  
  editorPane.addEventListener("scroll", function() {
    syncEditorToPreview();
    syncHighlightScroll();
    syncLineNumberScroll();
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
    
    renderMarkdown();
  });

  if (importFromFileButton) {
    importFromFileButton.addEventListener("click", function (e) {
      e.preventDefault();
      fileInput.click();
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
      const markdown = markdownEditor.value;
      const html = marked.parse(markdown);
      const sanitizedHtml = DOMPurify.sanitize(html, {
        ADD_TAGS: ['mjx-container', 'input'], 
        ADD_ATTR: ['id', 'class', 'style', 'align', 'type', 'checked', 'disabled']
      });
      const tempContainer = document.createElement("div");
      tempContainer.innerHTML = sanitizedHtml;
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
          tex: {
              inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
              displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
              processEscapes: true
          }
      };
  </script>
  <script defer src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-mml-chtml.min.js"></script>
  <style>
      body {
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
      window.addEventListener('load', function () {
          if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
              window.MathJax.typesetPromise().catch(function (err) {
                  console.warn('MathJax typeset failed:', err);
              });
          }
      });
  </script>
</body>
</html>`;
      const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
      saveAs(blob, "document.html");
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

  /**
   * Task 1: Identifies all graphic elements that may need page-break handling
   * @param {HTMLElement} container - The container element to search within
   * @returns {Array} Array of {element, type} objects
   */
  function identifyGraphicElements(container) {
    const graphics = [];

    // Query for images
    container.querySelectorAll('img').forEach(el => {
      graphics.push({ element: el, type: 'img' });
    });

    // Query for SVGs (Mermaid diagrams)
    container.querySelectorAll('svg').forEach(el => {
      graphics.push({ element: el, type: 'svg' });
    });

    // Query for pre elements (code blocks)
    container.querySelectorAll('pre').forEach(el => {
      graphics.push({ element: el, type: 'pre' });
    });

    // Query for tables
    container.querySelectorAll('table').forEach(el => {
      graphics.push({ element: el, type: 'table' });
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
  function analyzeGraphicsForPageBreaks(tempElement) {
    try {
      // Step 1: Identify all graphic elements
      const graphics = identifyGraphicElements(tempElement);
      console.log('Step 1 - Graphics found:', graphics.length, graphics.map(g => g.type));

      // Step 2: Calculate positions for each element
      const elementsWithPositions = calculateElementPositions(graphics, tempElement);
      console.log('Step 2 - Element positions:', elementsWithPositions.map(e => ({
        type: e.type,
        top: Math.round(e.top),
        height: Math.round(e.height),
        bottom: Math.round(e.bottom)
      })));

      // Step 3: Calculate page boundaries using the element's ACTUAL width
      const totalHeight = tempElement.scrollHeight;
      const elementWidth = tempElement.offsetWidth;
      const { boundaries: pageBoundaries, pageHeightPx } = calculatePageBoundaries(
        totalHeight,
        elementWidth,
        PAGE_CONFIG
      );

      console.log('Step 3 - Page boundaries:', {
        elementWidth,
        totalHeight,
        pageHeightPx: Math.round(pageHeightPx),
        boundaries: pageBoundaries.map(b => Math.round(b))
      });

      // Step 4: Detect split elements
      const splitElements = detectSplitElements(elementsWithPositions, pageBoundaries);
      console.log('Step 4 - Split elements detected:', splitElements.length);

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
  function insertPageBreaks(fittingElements, pageHeightPx) {
    for (const item of fittingElements) {
      // Calculate where the current page ends
      const currentPageBottom = (item.splitPageIndex + 1) * pageHeightPx;

      // Calculate remaining space on current page
      const remainingSpace = currentPageBottom - item.top;
      const remainingRatio = remainingSpace / pageHeightPx;

      console.log('Processing split element:', {
        type: item.type,
        top: Math.round(item.top),
        height: Math.round(item.height),
        splitPageIndex: item.splitPageIndex,
        currentPageBottom: Math.round(currentPageBottom),
        remainingSpace: Math.round(remainingSpace),
        remainingRatio: remainingRatio.toFixed(2)
      });

      // Task 4: Whitespace optimization
      // If remaining space is more than threshold and element almost fits, skip
      // (Will be handled by Story 1.3 scaling instead)
      if (remainingRatio > PAGE_BREAK_THRESHOLD) {
        const scaledHeight = item.height * 0.9; // 90% scale
        if (scaledHeight <= remainingSpace) {
          console.log('  -> Skipping (can fit with 90% scaling)');
          continue;
        }
      }

      // Calculate margin needed to push element to next page
      const marginNeeded = currentPageBottom - item.top + 5; // 5px buffer

      console.log('  -> Applying marginTop:', marginNeeded, 'px');

      // Determine which element to apply margin to
      // For SVG elements (Mermaid diagrams), apply to parent container for proper layout
      let targetElement = item.element;
      if (item.type === 'svg' && item.element.parentElement) {
        targetElement = item.element.parentElement;
        console.log('  -> Using parent element:', targetElement.tagName, targetElement.className);
      }

      // Apply margin to push element to next page
      const currentMargin = parseFloat(targetElement.style.marginTop) || 0;
      targetElement.style.marginTop = `${currentMargin + marginNeeded}px`;

      console.log('  -> Element after margin:', targetElement.tagName, 'marginTop =', targetElement.style.marginTop);
    }
  }

  /**
   * Task 2: Applies page breaks with cascading adjustment handling
   * @param {HTMLElement} tempElement - The rendered content container
   * @param {Object} pageConfig - Page configuration object (unused, kept for API compatibility)
   * @param {number} maxIterations - Maximum iterations to prevent infinite loops
   * @returns {Object} Final analysis result
   */
  function applyPageBreaksWithCascade(tempElement, pageConfig, maxIterations = 10) {
    let iteration = 0;
    let analysis;
    let previousSplitCount = -1;

    do {
      // Re-analyze after each adjustment
      analysis = analyzeGraphicsForPageBreaks(tempElement);

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
      insertPageBreaks(fittingElements, pageHeightPx);
      iteration++;

    } while (iteration < maxIterations);

    if (iteration >= maxIterations) {
      console.warn('Page-break stabilization reached max iterations:', maxIterations);
    }

    console.log('Page-break cascade complete:', {
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
  function handleOversizedElements(oversizedElements, pageHeightPx) {
    if (!oversizedElements || oversizedElements.length === 0) {
      return;
    }

    let scaledCount = 0;
    let clampedCount = 0;

    for (const item of oversizedElements) {
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

    console.log('Oversized graphics scaling complete:', {
      totalScaled: scaledCount,
      clampedToMinimum: clampedCount
    });
  }

  // ============================================
  // End Oversized Graphics Scaling Functions
  // ============================================

  exportPdf.addEventListener("click", async function () {
    try {
      const originalText = exportPdf.innerHTML;
      exportPdf.innerHTML = '<i class="bi bi-hourglass-split"></i> Generating...';
      exportPdf.disabled = true;

      const progressContainer = document.createElement('div');
      progressContainer.style.position = 'fixed';
      progressContainer.style.top = '50%';
      progressContainer.style.left = '50%';
      progressContainer.style.transform = 'translate(-50%, -50%)';
      progressContainer.style.padding = '15px 20px';
      progressContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      progressContainer.style.color = 'white';
      progressContainer.style.borderRadius = '5px';
      progressContainer.style.zIndex = '9999';
      progressContainer.style.textAlign = 'center';

      const statusText = document.createElement('div');
      statusText.textContent = 'Generating PDF...';
      progressContainer.appendChild(statusText);
      document.body.appendChild(progressContainer);

      const markdown = markdownEditor.value;
      const html = marked.parse(markdown);
      const sanitizedHtml = DOMPurify.sanitize(html, {
        ADD_TAGS: ['mjx-container', 'svg', 'path', 'g', 'marker', 'defs', 'pattern', 'clipPath', 'input'],
        ADD_ATTR: ['id', 'class', 'style', 'align', 'viewBox', 'd', 'fill', 'stroke', 'transform', 'marker-end', 'marker-start', 'type', 'checked', 'disabled']
      });

      const tempElement = document.createElement("div");
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

      await new Promise(resolve => setTimeout(resolve, 200));

      try {
        await mermaid.run({
          nodes: tempElement.querySelectorAll('.mermaid'),
          suppressErrors: true
        });
      } catch (mermaidError) {
        console.warn("Mermaid rendering issue:", mermaidError);
      }

      if (window.MathJax) {
        try {
          await MathJax.typesetPromise([tempElement]);
        } catch (mathJaxError) {
          console.warn("MathJax rendering issue:", mathJaxError);
        }

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

      await new Promise(resolve => setTimeout(resolve, 500));

      // Analyze and apply page-breaks for graphics (Story 1.1 + 1.2)
      const pageBreakAnalysis = applyPageBreaksWithCascade(tempElement, PAGE_CONFIG);

      // Scale oversized graphics that can't fit on a single page (Story 1.3)
      if (pageBreakAnalysis.oversizedElements && pageBreakAnalysis.pageHeightPx) {
        handleOversizedElements(pageBreakAnalysis.oversizedElements, pageBreakAnalysis.pageHeightPx);
      }

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

      const canvas = await html2canvas(tempElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        windowWidth: 1000,
        windowHeight: tempElement.scrollHeight
      });

      const scaleFactor = canvas.width / contentWidth;
      const imgHeight = canvas.height / scaleFactor;
      const pagesCount = Math.ceil(imgHeight / (pageHeight - margin * 2));

      for (let page = 0; page < pagesCount; page++) {
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
      }

      pdf.save("document.pdf");

      statusText.textContent = 'Download successful!';
      setTimeout(() => {
        document.body.removeChild(progressContainer);
      }, 1500);

      document.body.removeChild(tempElement);
      exportPdf.innerHTML = originalText;
      exportPdf.disabled = false;

    } catch (error) {
      console.error("PDF export failed:", error);
      alert("PDF export failed: " + error.message);
      exportPdf.innerHTML = '<i class="bi bi-file-earmark-pdf"></i> Export';
      exportPdf.disabled = false;

      const progressContainer = document.querySelector('div[style*="Preparing PDF"]');
      if (progressContainer) {
        document.body.removeChild(progressContainer);
      }
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
    const compressed = pako.deflate(new TextEncoder().encode(text));
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < compressed.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, compressed.subarray(i, i + chunkSize));
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodeMarkdownFromShare(encoded) {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder().decode(pako.inflate(bytes));
  }

  function copyShareUrl(btn) {
    const markdownText = markdownEditor.value;
    let encoded;
    try {
      encoded = encodeMarkdownForShare(markdownText);
    } catch (e) {
      console.error("Share encoding failed:", e);
      alert("Failed to encode content for sharing: " + e.message);
      return;
    }

    const shareUrl = window.location.origin + window.location.pathname + '#share=' + encoded;
    const tooLarge = shareUrl.length > MAX_SHARE_URL_LENGTH;

    const originalHTML = btn.innerHTML;
    const copiedHTML = '<i class="bi bi-check-lg"></i> Copied!';

    function onCopied() {
      if (!tooLarge) {
        window.location.hash = 'share=' + encoded;
      }
      btn.innerHTML = copiedHTML;
      setTimeout(() => { btn.innerHTML = originalHTML; }, 2000);
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(shareUrl).then(onCopied).catch(() => {
        // clipboard.writeText failed; nothing further to do in secure context
      });
    } else {
      try {
        const tempInput = document.createElement("textarea");
        tempInput.value = shareUrl;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand("copy");
        document.body.removeChild(tempInput);
        onCopied();
      } catch (_) {
        // copy failed silently
      }
    }
  }

  shareButton.addEventListener("click", function () { copyShareUrl(shareButton); });
  mobileShareButton.addEventListener("click", function () { copyShareUrl(mobileShareButton); });

  function loadFromShareHash() {
    if (typeof pako === 'undefined') return;
    const hash = window.location.hash;
    if (!hash.startsWith('#share=')) return;
    const encoded = hash.slice('#share='.length);
    if (!encoded) return;
    try {
      const decoded = decodeMarkdownFromShare(encoded);
      markdownEditor.value = decoded;
      renderMarkdown();
      saveCurrentTabState();
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
        file.name.endsWith(".md") ||
        file.name.endsWith(".markdown");
      if (isMarkdownFile) {
        importMarkdownFile(file);
      } else {
        alert("Please upload a Markdown file (.md or .markdown)");
      }
    }
  }

  document.addEventListener("keydown", function (e) {
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
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "S") {
      e.preventDefault();
      if (currentViewMode === 'split') {
        toggleSyncScrolling();
      }
    }
    // New tab
    if ((e.ctrlKey || e.metaKey) && e.key === "t") {
      e.preventDefault();
      newTab();
    }
    // Close tab
    if ((e.ctrlKey || e.metaKey) && e.key === "w") {
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
    mermaidModalDiagram.innerHTML = '';
    modalCurrentSvgEl = null;
    modalZoomScale = 1;
    modalPanX = 0;
    modalPanY = 0;
  }

  /** Opens the zoom modal with the SVG from the given container. */
  function openMermaidZoomModal(container) {
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;

    mermaidModalDiagram.innerHTML = '';
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
});
