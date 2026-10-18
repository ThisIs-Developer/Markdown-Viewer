/**
 * visual-settings-adapters.js
 * Library adapters for Markdown Viewer visual settings (Issue #129).
 * Manages runtime theming and visual configurations for:
 * - highlight.js: theme stylesheets (auto, github, monokai, dracula, etc.)
 * - MathJax: mathematical typesetting fonts (Modern, STIX2, Asana, Bonum, etc.)
 * - Mermaid: diagram themes (auto, default, dark, forest, neutral, base) & looks (classic, handDrawn)
 * - JoyPixels: emoji Fitzpatrick skin tones (default, tone1 - tone5)
 */

(function () {
  'use strict';

  // Allowed options metadata
  const OPTIONS = Object.freeze({
    hljsTheme: [
      { value: 'auto', label: 'Follow app theme' },
      { value: 'github', label: 'GitHub' },
      { value: 'github-dark', label: 'GitHub Dark' },
      { value: 'monokai', label: 'Monokai' },
      { value: 'dracula', label: 'Dracula' },
      { value: 'atom-one-dark', label: 'Atom One Dark' },
      { value: 'atom-one-light', label: 'Atom One Light' },
      { value: 'solarized-dark', label: 'Solarized Dark' },
      { value: 'solarized-light', label: 'Solarized Light' },
      { value: 'vs', label: 'Visual Studio' },
      { value: 'vs2015', label: 'Visual Studio 2015' },
      { value: 'nord', label: 'Nord' },
      { value: 'tokyo-night-dark', label: 'Tokyo Night Dark' },
      { value: 'tokyo-night-light', label: 'Tokyo Night Light' },
      { value: 'default', label: 'Default' }
    ],
    mathFont: [
      { value: 'mathjax-modern', label: 'Computer Modern' },
      { value: 'mathjax-tex', label: 'Classic TeX' },
      { value: 'mathjax-stix2', label: 'STIX Two' },
      { value: 'mathjax-asana', label: 'Asana Math' },
      { value: 'mathjax-bonum', label: 'Gyre Bonum' },
      { value: 'mathjax-dejavu', label: 'DejaVu Math' },
      { value: 'mathjax-fira', label: 'Fira Math' },
      { value: 'mathjax-pagella', label: 'Gyre Pagella' },
      { value: 'mathjax-schola', label: 'Gyre Schola' },
      { value: 'mathjax-termes', label: 'Gyre Termes' }
    ],
    mermaidTheme: [
      { value: 'auto', label: 'Follow app theme' },
      { value: 'default', label: 'Default' },
      { value: 'neutral', label: 'Neutral' },
      { value: 'dark', label: 'Dark' },
      { value: 'forest', label: 'Forest' },
      { value: 'base', label: 'Base' }
    ],
    mermaidLook: [
      { value: 'classic', label: 'Classic' },
      { value: 'handDrawn', label: 'Hand drawn' }
    ],
    emojiSkinTone: [
      { value: 'default', label: 'Default yellow' },
      { value: 'tone1', label: 'Light' },
      { value: 'tone2', label: 'Medium light' },
      { value: 'tone3', label: 'Medium' },
      { value: 'tone4', label: 'Medium dark' },
      { value: 'tone5', label: 'Dark' }
    ]
  });

  const DEFAULTS = Object.freeze({
    hljsTheme: 'auto',
    mathFont: 'mathjax-modern',
    mermaidTheme: 'auto',
    mermaidLook: 'classic',
    emojiSkinTone: 'default'
  });

  // Active state
  let _activeHljsTheme = DEFAULTS.hljsTheme;
  let _activeMathFont = DEFAULTS.mathFont;
  let _activeMermaidTheme = DEFAULTS.mermaidTheme;
  let _activeMermaidLook = DEFAULTS.mermaidLook;
  let _activeEmojiSkinTone = DEFAULTS.emojiSkinTone;

  const HLJS_CDN_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/';
  const MATHJAX_FONT_CDN_BASE = 'https://cdn.jsdelivr.net/npm/';

  // Mapping for highlight.js themes on cdnjs 11.9.0 (dracula & solarized live under base16/)
  const HLJS_THEME_PATHS = Object.freeze({
    'github': 'github.min.css',
    'github-dark': 'github-dark.min.css',
    'monokai': 'monokai.min.css',
    'dracula': 'base16/dracula.min.css',
    'atom-one-dark': 'atom-one-dark.min.css',
    'atom-one-light': 'atom-one-light.min.css',
    'solarized-dark': 'base16/solarized-dark.min.css',
    'solarized-light': 'base16/solarized-light.min.css',
    'vs': 'vs.min.css',
    'vs2015': 'vs2015.min.css',
    'nord': 'nord.min.css',
    'tokyo-night-dark': 'tokyo-night-dark.min.css',
    'tokyo-night-light': 'tokyo-night-light.min.css',
    'default': 'default.min.css'
  });

  // Fallback background and foreground colors for syntax themes
  const HLJS_THEME_COLORS = Object.freeze({
    'github': { bg: '#ffffff', color: '#24292e' },
    'github-dark': { bg: '#0d1117', color: '#c9d1d9' },
    'monokai': { bg: '#272822', color: '#dddddd' },
    'dracula': { bg: '#282a36', color: '#f8f8f2' },
    'atom-one-dark': { bg: '#282c34', color: '#abb2bf' },
    'atom-one-light': { bg: '#fafafa', color: '#383a42' },
    'solarized-dark': { bg: '#002b36', color: '#839496' },
    'solarized-light': { bg: '#fdf6e3', color: '#657b83' },
    'vs': { bg: '#ffffff', color: '#000000' },
    'vs2015': { bg: '#1e1e1e', color: '#dcdcdc' },
    'nord': { bg: '#2e3440', color: '#d8dee9' },
    'tokyo-night-dark': { bg: '#1a1b26', color: '#a9b1d6' },
    'tokyo-night-light': { bg: '#d5d6db', color: '#343b58' },
    'default': { bg: '#f3f3f3', color: '#444444' }
  });

  function getEffectiveAppTheme() {
    if (typeof document === 'undefined' || !document.documentElement) return 'light';
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function resolveHljsThemeName(theme, themeOverride) {
    if (theme === 'auto') {
      const effective = themeOverride || getEffectiveAppTheme();
      return effective === 'dark' ? 'github-dark' : 'github';
    }
    return theme || 'github';
  }

  function resolveMermaidThemeName(theme, themeOverride) {
    if (theme === 'auto') {
      const effective = themeOverride || getEffectiveAppTheme();
      return effective === 'dark' ? 'dark' : 'default';
    }
    return theme || 'default';
  }

  // Update dynamic helper stylesheet so code blocks adopt the theme's background and contrast
  function updateHljsHelperStyle(effectiveName) {
    if (typeof document === 'undefined') return;
    let style = document.getElementById('mdv-hljs-style-helper');
    if (!style) {
      style = document.createElement('style');
      style.id = 'mdv-hljs-style-helper';
      if (document.head) document.head.appendChild(style);
    }

    const fallback = HLJS_THEME_COLORS[effectiveName] || HLJS_THEME_COLORS['github'];
    let bg = fallback.bg;
    let fg = fallback.color;

    if (document.body && typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
      try {
        const probe = document.createElement('div');
        probe.className = 'hljs';
        probe.style.position = 'fixed';
        probe.style.top = '-9999px';
        probe.style.left = '-9999px';
        probe.style.visibility = 'hidden';
        document.body.appendChild(probe);
        const cs = window.getComputedStyle(probe);
        if (cs && cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') {
          bg = cs.backgroundColor;
        }
        if (cs && cs.color && cs.color !== 'rgba(0, 0, 0, 0)' && cs.color !== 'transparent') {
          fg = cs.color;
        }
        document.body.removeChild(probe);
      } catch (_) {}
    }

    if (_activeHljsTheme === 'auto') {
      style.textContent = `
        /* Preview code blocks in Auto mode adopt application theme */
        .markdown-body:not(.pdf-export):not(.export-render-root) pre:has(> code.hljs) {
          background-color: ${bg} !important;
          color: ${fg} !important;
          border-radius: 6px;
          padding: 16px !important;
          overflow: auto;
        }
        .markdown-body:not(.pdf-export):not(.export-render-root) pre > code.hljs,
        .markdown-body:not(.pdf-export):not(.export-render-root) code.hljs {
          background-color: ${bg} !important;
          color: ${fg} !important;
          padding: 0 !important;
          border-radius: 0 !important;
        }

        /* Export documents in Auto mode resolve against the selected export theme */
        .pdf-export.theme-dark pre:has(> code.hljs),
        .pdf-export[data-theme="dark"] pre:has(> code.hljs),
        .export-render-root[data-theme="dark"] pre:has(> code.hljs),
        .export-render-root.theme-dark pre:has(> code.hljs) {
          background-color: #161b22 !important;
          color: #c9d1d9 !important;
          border-radius: 6px;
          padding: 16px !important;
          overflow: auto;
        }
        .pdf-export.theme-dark pre > code.hljs,
        .pdf-export[data-theme="dark"] pre > code.hljs,
        .export-render-root[data-theme="dark"] pre > code.hljs,
        .export-render-root.theme-dark pre > code.hljs,
        .pdf-export.theme-dark code.hljs,
        .pdf-export[data-theme="dark"] code.hljs,
        .export-render-root[data-theme="dark"] code.hljs,
        .export-render-root.theme-dark code.hljs {
          background-color: #161b22 !important;
          color: #c9d1d9 !important;
          padding: 0 !important;
          border-radius: 0 !important;
        }

        .pdf-export.theme-light pre:has(> code.hljs),
        .pdf-export[data-theme="light"] pre:has(> code.hljs),
        .export-render-root[data-theme="light"] pre:has(> code.hljs),
        .export-render-root.theme-light pre:has(> code.hljs) {
          background-color: #f6f8fa !important;
          color: #24292e !important;
          border-radius: 6px;
          padding: 16px !important;
          overflow: auto;
        }
        .pdf-export.theme-light pre > code.hljs,
        .pdf-export[data-theme="light"] pre > code.hljs,
        .export-render-root[data-theme="light"] pre > code.hljs,
        .export-render-root.theme-light pre > code.hljs,
        .pdf-export.theme-light code.hljs,
        .pdf-export[data-theme="light"] code.hljs,
        .export-render-root[data-theme="light"] code.hljs,
        .export-render-root.theme-light code.hljs {
          background-color: #f6f8fa !important;
          color: #24292e !important;
          padding: 0 !important;
          border-radius: 0 !important;
        }

        @media print {
          .markdown-body:not(.pdf-export):not(.export-render-root) pre:has(> code.hljs),
          .markdown-body:not(.pdf-export):not(.export-render-root) pre > code.hljs,
          .markdown-body:not(.pdf-export):not(.export-render-root) code.hljs {
            background-color: ${bg} !important;
            color: ${fg} !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          html[data-browser-print-export="dark"] .markdown-body pre:has(> code.hljs),
          html[data-browser-print-export="dark"] .markdown-body pre > code.hljs,
          html[data-browser-print-export="dark"] .markdown-body code.hljs,
          .pdf-export.theme-dark pre:has(> code.hljs),
          .pdf-export.theme-dark pre > code.hljs,
          .pdf-export.theme-dark code.hljs {
            background-color: #161b22 !important;
            color: #c9d1d9 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          html:not([data-browser-print-export="dark"]) .markdown-body.pdf-export.theme-light pre:has(> code.hljs),
          html:not([data-browser-print-export="dark"]) .markdown-body.pdf-export.theme-light pre > code.hljs,
          html:not([data-browser-print-export="dark"]) .markdown-body.pdf-export.theme-light code.hljs,
          html[data-browser-print-export="light"] .markdown-body pre:has(> code.hljs),
          html[data-browser-print-export="light"] .markdown-body pre > code.hljs,
          html[data-browser-print-export="light"] .markdown-body code.hljs,
          .pdf-export.theme-light pre:has(> code.hljs),
          .pdf-export.theme-light pre > code.hljs,
          .pdf-export.theme-light code.hljs {
            background-color: #f6f8fa !important;
            color: #24292e !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `;
    } else {
      style.textContent = `
        .markdown-body pre:has(> code.hljs) {
          background-color: ${bg} !important;
          color: ${fg} !important;
          border-radius: 6px;
          padding: 16px !important;
          overflow: auto;
        }
        .markdown-body pre > code.hljs,
        .markdown-body code.hljs {
          background-color: ${bg} !important;
          color: ${fg} !important;
          padding: 0 !important;
          border-radius: 0 !important;
        }
        @media print {
          .markdown-body pre:has(> code.hljs),
          .markdown-body pre > code.hljs,
          .markdown-body code.hljs {
            background-color: ${bg} !important;
            color: ${fg} !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `;
    }
  }

  /**
   * Apply highlight.js theme stylesheet.
   * Dynamically manages the <link id="mdv-hljs-theme-link"> in <head>.
   */
  function applyHighlightTheme(theme) {
    _activeHljsTheme = theme || DEFAULTS.hljsTheme;
    const effectiveName = resolveHljsThemeName(_activeHljsTheme);
    updateHljsHelperStyle(effectiveName);

    if (typeof document === 'undefined') return Promise.resolve();

    if (document.documentElement) {
      if (_activeHljsTheme !== 'auto') {
        document.documentElement.setAttribute('data-custom-syntax-theme', _activeHljsTheme);
        document.documentElement.setAttribute('data-hljs-theme', _activeHljsTheme);
      } else {
        if (typeof document.documentElement.removeAttribute === 'function') {
          document.documentElement.removeAttribute('data-custom-syntax-theme');
        }
        document.documentElement.setAttribute('data-hljs-theme', 'auto');
      }
    }

    const subpath = HLJS_THEME_PATHS[effectiveName] || `${effectiveName}.min.css`;
    const href = `${HLJS_CDN_BASE}${subpath}`;

    let link = document.getElementById('mdv-hljs-theme-link');
    if (!link) {
      link = document.createElement('link');
      link.id = 'mdv-hljs-theme-link';
      link.rel = 'stylesheet';
      link.crossOrigin = 'anonymous';
      if (document.head) document.head.appendChild(link);
    }

    if (link.getAttribute('href') === href) {
      updateHljsHelperStyle(effectiveName);
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      link.onload = () => {
        updateHljsHelperStyle(effectiveName);
        resolve();
      };
      link.onerror = () => {
        console.warn(`[VisualAdapters] Failed to load highlight.js theme: ${href}`);
        updateHljsHelperStyle(effectiveName);
        resolve(); // resolve gracefully so UI does not stall
      };
      link.href = href;
    });
  }

  // Share pending downloads, and allow a failed component to be retried.
  const _loadingScripts = new Map();
  function loadScriptOnce(src) {
    if (_loadingScripts.has(src)) return _loadingScripts.get(src);
    const pending = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.charset = 'UTF-8';
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        script.remove();
        resolve();
      };
      script.onerror = () => {
        script.remove();
        reject(new Error(`Failed to load math font: ${src}`));
      };
      document.head.appendChild(script);
    }).finally(() => _loadingScripts.delete(src));
    _loadingScripts.set(src, pending);
    return pending;
  }

  function getMathFontClass(mathJax, font) {
    const exports = mathJax._?.output?.fonts?.[font]?.chtml_ts;
    return exports ? Object.values(exports)[0] : null;
  }

  async function loadMathFont(mathJax, font) {
    if (!getMathFontClass(mathJax, font)) {
      await loadScriptOnce(`${MATHJAX_FONT_CDN_BASE}${font}-font/chtml.js`);
    }
    const fontClass = getMathFontClass(mathJax, font);
    if (!fontClass) throw new Error(`Math font did not register: ${font}`);
    return fontClass;
  }

  let _mathFontRequest = 0;

  /** Apply only the latest font selection, after the default renderer is ready. */
  async function applyMathFont(font) {
    const requestedFont = font || DEFAULTS.mathFont;
    const request = ++_mathFontRequest;
    _activeMathFont = requestedFont;

    const mathJax = typeof window !== 'undefined' && window.MathJax;
    // Startup owns its configuration until the bundled Modern renderer exists.
    // ensureMathJaxReady will apply the saved/latest choice once it is ready.
    // Legacy v3 bundles retain their supported built-in font.
    if (!mathJax?._?.output?.fonts || !mathJax.startup?.output ||
        String(mathJax.version).startsWith('3.')) return;

    const isCurrent = () => request === _mathFontRequest && window.MathJax === mathJax;
    let effectiveFont = requestedFont;
    let fontClass;
    try {
      fontClass = await loadMathFont(mathJax, requestedFont);
    } catch (error) {
      if (!isCurrent()) return;
      console.warn(`[VisualAdapters] Math font unavailable (${requestedFont}); using Modern.`, error);
      effectiveFont = DEFAULTS.mathFont;
      fontClass = await loadMathFont(mathJax, effectiveFont);
    }
    if (!isCurrent()) return;

    // Finish any queued typesetting before replacing its output/document.
    if (mathJax.startup.promise) await mathJax.startup.promise;
    if (!isCurrent()) return;

    const packageUrl = `${MATHJAX_FONT_CDN_BASE}${effectiveFont}-font`;
    const fontURL = `${packageUrl}/chtml/woff`;
    const dynamicPrefix = `[${effectiveFont}]/chtml/dynamic`;
    mathJax.config.output = Object.assign(mathJax.config.output || {}, { font: effectiveFont });
    mathJax.config.chtml = Object.assign(mathJax.config.chtml || {}, {
      fontData: fontClass, fontURL, dynamicPrefix
    });
    // v3 expects a font instance in chtml.font; v4 uses fontData for the class.
    if (typeof mathJax.config.chtml.font === 'string') delete mathJax.config.chtml.font;
    mathJax.config.loader = mathJax.config.loader || {};
    mathJax.config.loader.paths = Object.assign(mathJax.config.loader.paths || {}, {
      [effectiveFont]: packageUrl
    });
    // The loader's runtime path table is separate from its original config.
    const loaderConfig = mathJax._.components?.loader?.CONFIG;
    if (loaderConfig) {
      loaderConfig.paths = Object.assign(loaderConfig.paths || {}, { [effectiveFont]: packageUrl });
    }

    _activeMathFont = effectiveFont;
    const currentOutput = mathJax.startup.output;
    if (currentOutput.font?.constructor === fontClass) {
      Object.assign(currentOutput.font.options, { fontURL, dynamicPrefix });
      return;
    }

    mathJax.startup.output = mathJax.startup.getOutputJax();
    mathJax.startup.document = mathJax.startup.getDocument();

    const roots = ['markdown-preview', 'document-split-preview']
      .map(id => document.getElementById(id))
      .filter(root => root && root.querySelector('mjx-container, .math-block, .math-inline'));
    if (roots.length > 0) {
      if (typeof window.renderMarkdown === 'function') {
        window.renderMarkdown({ force: true, forceAdvancedPostProcess: true });
      } else if (typeof mathJax.typesetPromise === 'function') {
        await mathJax.typesetPromise(roots);
      }
    }
  }

  /**
   * Apply Mermaid theme and look drawing style.
   */
  async function applyMermaid(options) {
    if (options) {
      if (typeof options.theme !== 'undefined') _activeMermaidTheme = options.theme;
      if (typeof options.look !== 'undefined') _activeMermaidLook = options.look;
    }

    if (typeof mermaid === 'undefined') {
      return;
    }

    const effectiveTheme = resolveMermaidThemeName(_activeMermaidTheme);
    const effectiveLook = _activeMermaidLook === 'handDrawn' ? 'handDrawn' : 'classic';

    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: effectiveTheme,
        look: effectiveLook,
        securityLevel: 'strict',
        flowchart: { useMaxWidth: true, htmlLabels: true },
        fontSize: 16,
        gantt: { useWidth: 1200 }
      });
    } catch (err) {
      console.warn('[VisualAdapters] Mermaid initialize error:', err);
    }

    // Re-render existing Mermaid nodes in the preview
    if (typeof document !== 'undefined') {
      const preview = document.getElementById('markdown-preview');
      if (preview) {
        const mermaidNodes = preview.querySelectorAll('.mermaid');
        if (mermaidNodes.length > 0) {
          mermaidNodes.forEach((node) => {
            const originalCode = node.getAttribute('data-original-code');
            if (originalCode) {
              node.innerHTML = decodeURIComponent(originalCode)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            }
            node.removeAttribute('data-processed');

            const container = node.closest('.mermaid-container');
            if (container) {
              const oldToolbar = container.querySelector('.mermaid-toolbar');
              if (oldToolbar) oldToolbar.remove();
            }
          });

          if (typeof window.renderMarkdown === 'function') {
            window.renderMarkdown({ force: true, forceAdvancedPostProcess: true });
          }
        }
      }
    }
  }

  /**
   * Resolves a shortcode to JoyPixels' canonical shortcode name (e.g. '+1' -> 'thumbsup', 'runner' -> 'person_running').
   */
  function getCanonicalEmojiShortcode(code, joy) {
    if (!code) return code;
    const clean = code.replace(/^:|:$/g, '');
    if (!joy) return clean;
    const colonCode = `:${clean}:`;

    // 1. If it's already a canonical key in joy.emojiList
    if (joy.emojiList && joy.emojiList[colonCode]) {
      return clean;
    }

    // 2. Check joy.altShortNames (native JoyPixels alias map)
    if (joy.altShortNames) {
      const alt = joy.altShortNames[colonCode] || joy.altShortNames[clean];
      if (alt) {
        return alt.replace(/^:|:$/g, '');
      }
    }

    // 3. Fallback: scan emojiList if altShortNames is not populated
    if (joy.emojiList) {
      for (const [key, val] of Object.entries(joy.emojiList)) {
        if (val && Array.isArray(val.shortnames)) {
          if (val.shortnames.includes(colonCode) || val.shortnames.includes(clean)) {
            return key.replace(/^:|:$/g, '');
          }
        }
      }
    }

    return clean;
  }

  /**
   * Resolves an emoji shortcode to include the active Fitzpatrick skin tone modifier
   * if the emoji supports skin tone modifiers, otherwise returns the original shortcode.
   * Canonicalizes JoyPixels aliases prior to checking tone support.
   * Shortcodes with explicit tone modifiers are left untouched.
   */
  function resolveEmojiShortcode(shortcode) {
    if (!shortcode) return shortcode;
    const clean = shortcode.replace(/^:|:$/g, '');

    if (!_activeEmojiSkinTone || _activeEmojiSkinTone === 'default') {
      return shortcode;
    }

    // If already has an explicit skin tone suffix, preserve it
    if (/_tone[1-5]$/.test(clean)) {
      return shortcode;
    }

    const joy = typeof joypixels !== 'undefined' ? joypixels : (typeof window !== 'undefined' ? window.joypixels : undefined);
    const canonical = getCanonicalEmojiShortcode(clean, joy);
    const toneCandidate = `${canonical}_${_activeEmojiSkinTone}`;

    // Check JoyPixels library list if available
    if (joy && joy.emojiList) {
      if (joy.emojiList[`:${toneCandidate}:`]) {
        return toneCandidate;
      }
      const directCandidate = `${clean}_${_activeEmojiSkinTone}`;
      if (joy.emojiList[`:${directCandidate}:`]) {
        return directCandidate;
      }
      return shortcode;
    }

    return toneCandidate;
  }

  /**
   * Apply JoyPixels emoji skin tone.
   */
  function applyEmojiSkinTone(tone) {
    _activeEmojiSkinTone = tone || DEFAULTS.emojiSkinTone;

    const joy = typeof joypixels !== 'undefined' ? joypixels : (typeof window !== 'undefined' ? window.joypixels : undefined);
    if (joy && typeof joy.shortnameToUnicode === 'function' && !joy._visualAdapterWrapped) {
      const origShortnameToUnicode = joy.shortnameToUnicode.bind(joy);
      joy.shortnameToUnicode = function (str) {
        if (_activeEmojiSkinTone && _activeEmojiSkinTone !== 'default') {
          str = str.replace(/:([\w+-]+):/g, function (match, code) {
            const resolved = resolveEmojiShortcode(code);
            return `:${resolved}:`;
          });
        }
        return origShortnameToUnicode(str);
      };
      joy._visualAdapterWrapped = true;
    }

    if (typeof document !== 'undefined') {
      const preview = document.getElementById('markdown-preview');
      if (preview && typeof window.renderMarkdown === 'function') {
        window.renderMarkdown({ force: true, forceAdvancedPostProcess: true });
      }
    }
  }

  /**
   * React to application light/dark theme toggle.
   * Idempotently re-applies any setting configured as 'auto'.
   */
  function onAppThemeChange(newAppTheme) {
    if (_activeHljsTheme === 'auto') {
      applyHighlightTheme('auto');
    }
    if (_activeMermaidTheme === 'auto') {
      applyMermaid({ theme: 'auto', look: _activeMermaidLook });
    }
  }

  // Observe theme changes on documentElement
  if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined' && document.documentElement) {
    const themeObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          onAppThemeChange(getEffectiveAppTheme());
        }
      }
    });

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }

  /**
   * Check if setting change needs a markdown document re-render.
   */
  function needsRerender(key) {
    if (key === 'hljsTheme') return false;
    return true;
  }

  /**
   * Generic apply method for any setting key.
   */
  async function apply(key, value) {
    if (key === 'hljsTheme') {
      return applyHighlightTheme(value);
    } else if (key === 'mathFont') {
      return applyMathFont(value);
    } else if (key === 'mermaidTheme') {
      return applyMermaid({ theme: value, look: _activeMermaidLook });
    } else if (key === 'mermaidLook') {
      return applyMermaid({ theme: _activeMermaidTheme, look: value });
    } else if (key === 'emojiSkinTone') {
      return applyEmojiSkinTone(value);
    }
  }

  /**
   * Apply all settings simultaneously.
   */
  async function applyAll(settings) {
    if (!settings) return;
    const tasks = [];
    if (typeof settings.hljsTheme !== 'undefined') {
      tasks.push(applyHighlightTheme(settings.hljsTheme));
    }
    if (typeof settings.mathFont !== 'undefined') {
      tasks.push(applyMathFont(settings.mathFont));
    }
    if (typeof settings.mermaidTheme !== 'undefined' || typeof settings.mermaidLook !== 'undefined') {
      tasks.push(applyMermaid({
        theme: settings.mermaidTheme !== undefined ? settings.mermaidTheme : _activeMermaidTheme,
        look: settings.mermaidLook !== undefined ? settings.mermaidLook : _activeMermaidLook
      }));
    }
    if (typeof settings.emojiSkinTone !== 'undefined') {
      tasks.push(applyEmojiSkinTone(settings.emojiSkinTone));
    }

    await Promise.all(tasks);
  }

  // Public API exported to window.visualSettingsAdapters
  const adapters = {
    getOptions: () => JSON.parse(JSON.stringify(OPTIONS)),
    getDefaults: () => Object.assign({}, DEFAULTS),
    getCurrentSettings: () => ({
      hljsTheme: _activeHljsTheme,
      mathFont: _activeMathFont,
      mermaidTheme: _activeMermaidTheme,
      mermaidLook: _activeMermaidLook,
      emojiSkinTone: _activeEmojiSkinTone
    }),
    getCurrentMathFont: () => _activeMathFont,
    getMermaidConfig: (themeOverride) => ({
      theme: resolveMermaidThemeName(_activeMermaidTheme, themeOverride),
      look: _activeMermaidLook === 'handDrawn' ? 'handDrawn' : 'classic'
    }),
    getHljsTheme: (themeOverride) => resolveHljsThemeName(_activeHljsTheme, themeOverride),
    resolveHljsThemeName,
    needsRerender,
    apply,
    getCanonicalEmojiShortcode: (code) => getCanonicalEmojiShortcode(code, typeof joypixels !== 'undefined' ? joypixels : (typeof window !== 'undefined' ? window.joypixels : undefined)),
    resolveEmojiShortcode,
    applyHighlightTheme,
    applyMathFont,
    applyMermaid,
    applyEmojiSkinTone,
    applyAll,
    onAppThemeChange
  };

  if (typeof window !== 'undefined') {
    window.visualSettingsAdapters = adapters;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = adapters;
  }

})();
