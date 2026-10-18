import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

function createAdapterContext() {
  const createdElements = [];

  const documentElement = {
    getAttribute(name) {
      return this._attrs?.[name] || null;
    },
    setAttribute(name, val) {
      this._attrs = this._attrs || {};
      this._attrs[name] = val;
    },
    removeAttribute(name) {
      if (this._attrs) delete this._attrs[name];
    }
  };

  const head = {
    appendChild(el) {
      createdElements.push(el);
      return el;
    }
  };

  const document = {
    documentElement,
    head,
    createElement(tag) {
      let _href = '';
      let _src = '';
      const el = {
        tagName: tag.toUpperCase(),
        id: '',
        rel: '',
        textContent: '',
        onload: null,
        onerror: null,
        get href() { return _href; },
        set href(val) {
          _href = val;
          setTimeout(() => { if (this.onload) this.onload(); }, 1);
        },
        get src() { return _src; },
        set src(val) {
          _src = val;
          setTimeout(() => { if (this.onload) this.onload(); }, 1);
        },
        setAttribute(k, v) { this[k] = v; },
        getAttribute(k) { return this[k] || null; },
        removeAttribute(k) { delete this[k]; }
      };
      return el;
    },
    getElementById(id) {
      return createdElements.find(e => e.id === id) || null;
    },
    querySelector(selector) {
      return null;
    },
    querySelectorAll(selector) {
      return [];
    }
  };

  class MockMutationObserver {
    constructor(cb) { this.cb = cb; }
    observe() {}
    disconnect() {}
  }

  const context = {
    window: {},
    document,
    MutationObserver: MockMutationObserver,
    console: { warn: () => {}, log: () => {} },
    setTimeout,
    clearTimeout
  };
  context.window = context;

  const code = fs.readFileSync(path.join(rootDir, 'visual-settings-adapters.js'), 'utf8');
  vm.runInNewContext(code, context);

  return { context, adapters: context.window.visualSettingsAdapters };
}

test('getOptions() returns valid metadata for all visual settings', () => {
  const { adapters } = createAdapterContext();
  const options = adapters.getOptions();

  assert.ok(options.hljsTheme && Array.isArray(options.hljsTheme));
  assert.ok(options.mathFont && Array.isArray(options.mathFont));
  assert.ok(options.mermaidTheme && Array.isArray(options.mermaidTheme));
  assert.ok(options.mermaidLook && Array.isArray(options.mermaidLook));
  assert.ok(options.emojiSkinTone && Array.isArray(options.emojiSkinTone));

  // Check required values exist
  const hljsValues = options.hljsTheme.map(o => o.value);
  assert.ok(hljsValues.includes('auto'));
  assert.ok(hljsValues.includes('github'));
  assert.ok(hljsValues.includes('monokai'));
  assert.ok(hljsValues.includes('dracula'));

  const mathValues = options.mathFont.map(o => o.value);
  assert.ok(mathValues.includes('mathjax-modern'));
  assert.ok(mathValues.includes('mathjax-stix2'));

  const mermaidThemes = options.mermaidTheme.map(o => o.value);
  assert.ok(mermaidThemes.includes('auto'));
  assert.ok(mermaidThemes.includes('forest'));
  assert.ok(mermaidThemes.includes('dark'));

  const mermaidLooks = options.mermaidLook.map(o => o.value);
  assert.ok(mermaidLooks.includes('classic'));
  assert.ok(mermaidLooks.includes('handDrawn'));

  const tones = options.emojiSkinTone.map(o => o.value);
  assert.ok(tones.includes('default'));
  assert.ok(tones.includes('tone1'));
  assert.ok(tones.includes('tone5'));
});

test('getDefaults() returns standard default visual settings', () => {
  const { adapters } = createAdapterContext();
  const defaults = JSON.parse(JSON.stringify(adapters.getDefaults()));

  assert.deepEqual(defaults, {
    hljsTheme: 'auto',
    mathFont: 'mathjax-modern',
    mermaidTheme: 'auto',
    mermaidLook: 'classic',
    emojiSkinTone: 'default'
  });
});

test('resolveEmojiShortcode handles skin tones accurately', () => {
  const { context, adapters } = createAdapterContext();

  // Mock joypixels emojiList and altShortNames
  context.joypixels = {
    emojiList: {
      ':wave:': {},
      ':wave_tone1:': {},
      ':wave_tone2:': {},
      ':wave_tone3:': {},
      ':wave_tone4:': {},
      ':wave_tone5:': {},
      ':thumbsup:': { shortnames: [':+1:', ':thumbup:'] },
      ':thumbsup_tone1:': { shortnames: [':+1_tone1:'] },
      ':thumbsup_tone5:': { shortnames: [':+1_tone5:'] },
      ':person_running:': { shortnames: [':runner:'] },
      ':person_running_tone1:': { shortnames: [':runner_tone1:'] },
      ':person_running_tone5:': { shortnames: [':runner_tone5:'] },
      ':smile:': {}
    },
    altShortNames: {
      ':+1:': ':thumbsup:',
      ':+1_tone1:': ':thumbsup_tone1:',
      ':runner:': ':person_running:',
      ':runner_tone1:': ':person_running_tone1:'
    }
  };

  // When default tone is active
  adapters.applyEmojiSkinTone('default');
  assert.equal(adapters.resolveEmojiShortcode('wave'), 'wave');
  assert.equal(adapters.resolveEmojiShortcode('thumbsup'), 'thumbsup');
  assert.equal(adapters.resolveEmojiShortcode('+1'), '+1');
  assert.equal(adapters.resolveEmojiShortcode('runner'), 'runner');
  assert.equal(adapters.resolveEmojiShortcode('smile'), 'smile');

  // When tone1 is active
  adapters.applyEmojiSkinTone('tone1');
  assert.equal(adapters.resolveEmojiShortcode('wave'), 'wave_tone1');
  assert.equal(adapters.resolveEmojiShortcode('thumbsup'), 'thumbsup_tone1');
  // Aliases canonicalize to JoyPixels canonical keys with tone
  assert.equal(adapters.resolveEmojiShortcode('+1'), 'thumbsup_tone1');
  assert.equal(adapters.resolveEmojiShortcode('runner'), 'person_running_tone1');
  // Emoji that does NOT support tone is untouched
  assert.equal(adapters.resolveEmojiShortcode('smile'), 'smile');
  // Emoji with existing tone modifier is untouched
  assert.equal(adapters.resolveEmojiShortcode('wave_tone3'), 'wave_tone3');
  assert.equal(adapters.resolveEmojiShortcode('+1_tone3'), '+1_tone3');
  assert.equal(adapters.resolveEmojiShortcode('runner_tone2'), 'runner_tone2');

  // When tone5 is active
  adapters.applyEmojiSkinTone('tone5');
  assert.equal(adapters.resolveEmojiShortcode('wave'), 'wave_tone5');
  assert.equal(adapters.resolveEmojiShortcode('thumbsup'), 'thumbsup_tone5');
  assert.equal(adapters.resolveEmojiShortcode('+1'), 'thumbsup_tone5');
  assert.equal(adapters.resolveEmojiShortcode('runner'), 'person_running_tone5');
  assert.equal(adapters.resolveEmojiShortcode('smile'), 'smile');
});

test('applyMermaid handles auto theme and look style', async () => {
  const { context, adapters } = createAdapterContext();

  context.document.documentElement.setAttribute('data-theme', 'dark');
  await adapters.applyMermaid({ theme: 'auto', look: 'handDrawn' });

  let config = adapters.getMermaidConfig();
  assert.equal(config.theme, 'dark');
  assert.equal(config.look, 'handDrawn');

  context.document.documentElement.setAttribute('data-theme', 'light');
  adapters.onAppThemeChange('light');
  config = adapters.getMermaidConfig();
  assert.equal(config.theme, 'default');
  assert.equal(config.look, 'handDrawn');

  // Explicit theme overrides auto
  await adapters.applyMermaid({ theme: 'forest', look: 'classic' });
  config = adapters.getMermaidConfig();
  assert.equal(config.theme, 'forest');
  assert.equal(config.look, 'classic');
});

test('applyHighlightTheme manages stylesheet, auto theme, and export styling', async () => {
  const { context, adapters } = createAdapterContext();

  context.document.documentElement.setAttribute('data-theme', 'light');
  await adapters.applyHighlightTheme('monokai');
  let link = context.document.getElementById('mdv-hljs-theme-link');
  assert.ok(link);
  assert.ok(link.href.includes('monokai.min.css'));
  assert.equal(context.document.documentElement.getAttribute('data-custom-syntax-theme'), 'monokai');
  assert.equal(context.document.documentElement.getAttribute('data-hljs-theme'), 'monokai');

  // Test getHljsTheme and resolveHljsThemeName
  assert.equal(adapters.resolveHljsThemeName('monokai'), 'monokai');
  assert.equal(adapters.resolveHljsThemeName('auto', 'dark'), 'github-dark');
  assert.equal(adapters.resolveHljsThemeName('auto', 'light'), 'github');
  assert.equal(adapters.getHljsTheme(), 'monokai');

  await adapters.applyHighlightTheme('auto');
  link = context.document.getElementById('mdv-hljs-theme-link');
  assert.ok(link.href.includes('github.min.css'));
  assert.equal(adapters.getHljsTheme(), 'github');
  assert.equal(adapters.getHljsTheme('dark'), 'github-dark');
  assert.equal(context.document.documentElement.getAttribute('data-custom-syntax-theme'), null);
  assert.equal(context.document.documentElement.getAttribute('data-hljs-theme'), 'auto');

  // Verify mdv-hljs-style-helper content scopes preview and provides export rules
  const helper = context.document.getElementById('mdv-hljs-style-helper');
  assert.ok(helper);
  assert.ok(helper.textContent.includes('.markdown-body:not(.pdf-export):not(.export-render-root)'));
  assert.ok(helper.textContent.includes('.pdf-export.theme-dark'));
  assert.ok(helper.textContent.includes('.pdf-export.theme-light'));
  assert.ok(helper.textContent.includes('data-browser-print-export="dark"'));

  context.document.documentElement.setAttribute('data-theme', 'dark');
  adapters.onAppThemeChange('dark');
  link = context.document.getElementById('mdv-hljs-theme-link');
  assert.ok(link.href.includes('github-dark.min.css'));
  assert.equal(adapters.getHljsTheme(), 'github-dark');
  assert.equal(adapters.getHljsTheme('light'), 'github');
});

function installMathRuntime(context) {
  class ModernFont {
    constructor(options) { this.options = options; }
  }
  const mathJax = {
    version: '4.0.0-beta.7',
    config: { output: {}, chtml: {} },
    _: {
      components: { loader: { CONFIG: { paths: {} } } },
      output: { fonts: { 'mathjax-modern': { chtml_ts: { ModernFont } } } }
    },
    startup: {
      promise: Promise.resolve(),
      output: { font: new ModernFont({}) },
      getOutputJax() { return { font: new mathJax.config.chtml.fontData(mathJax.config.chtml) }; },
      getDocument() { return { outputJax: this.output }; }
    }
  };
  context.window.MathJax = mathJax;
  return mathJax;
}

function controlFontDownloads(context, mathJax) {
  const scripts = [];
  const createElement = context.document.createElement.bind(context.document);
  context.document.createElement = tag => {
    if (tag !== 'script') return createElement(tag);
    const script = { remove() { this.removed = true; } };
    scripts.push(script);
    return script;
  };
  return {
    scripts,
    succeed(index, font) {
      class LoadedFont {
        constructor(options) { this.options = options; }
      }
      mathJax._.output.fonts[font] = { chtml_ts: { LoadedFont } };
      scripts[index].onload();
      return LoadedFont;
    }
  };
}

test('font choices preserve an initializing runtime and legacy v3 configuration', async () => {
  const { context, adapters } = createAdapterContext();
  const starting = { _: {}, config: { output: { font: 'mathjax-modern' } }, startup: {} };
  context.window.MathJax = starting;
  await adapters.applyMathFont('mathjax-stix2');
  assert.equal(context.window.MathJax, starting);
  assert.deepEqual(starting.config, { output: { font: 'mathjax-modern' } });
  assert.equal(adapters.getCurrentMathFont(), 'mathjax-stix2');

  const legacy = { version: '3.2.2', config: { chtml: {} }, startup: {} };
  context.window.MathJax = legacy;
  await adapters.applyMathFont('mathjax-modern');
  assert.deepEqual(legacy.config, { chtml: {} });
});

test('font switches configure matching WOFF and dynamic resources, including reset', async () => {
  const { context, adapters } = createAdapterContext();
  const mj = installMathRuntime(context);
  const downloads = controlFontDownloads(context, mj);
  const pending = adapters.applyMathFont('mathjax-stix2');
  downloads.succeed(0, 'mathjax-stix2');
  await pending;

  for (const font of ['mathjax-stix2', 'mathjax-modern']) {
    await adapters.applyMathFont(font);
    const base = `https://cdn.jsdelivr.net/npm/${font}-font`;
    assert.equal(mj.config.output.font, font);
    assert.equal(mj.config.chtml.fontURL, `${base}/chtml/woff`);
    assert.equal(mj.config.chtml.dynamicPrefix, `[${font}]/chtml/dynamic`);
    assert.equal(mj.config.loader.paths[font], base);
    assert.equal(mj._.components.loader.CONFIG.paths[font], base);
    assert.equal(mj.startup.output.font.options.fontURL, `${base}/chtml/woff`);
    assert.equal(mj.startup.document.outputJax, mj.startup.output);
    assert.equal(typeof mj.config.chtml.font, 'undefined');
  }
});

for (const order of ['older-first', 'newer-first', 'older-fails']) {
  test(`the latest font wins when overlapping requests finish ${order}`, async () => {
    const { context, adapters } = createAdapterContext();
    const mj = installMathRuntime(context);
    const downloads = controlFontDownloads(context, mj);
    const stix = adapters.applyMathFont('mathjax-stix2');
    const asana = adapters.applyMathFont('mathjax-asana');
    let expectedFont;
    if (order === 'older-first') {
      downloads.succeed(0, 'mathjax-stix2');
      await stix;
      assert.equal(adapters.getCurrentMathFont(), 'mathjax-asana');
      expectedFont = downloads.succeed(1, 'mathjax-asana');
    } else {
      expectedFont = downloads.succeed(1, 'mathjax-asana');
      await asana;
      if (order === 'older-fails') downloads.scripts[0].onerror();
      else downloads.succeed(0, 'mathjax-stix2');
    }
    await Promise.all([stix, asana]);
    assert.equal(adapters.getCurrentMathFont(), 'mathjax-asana');
    assert.equal(mj.startup.output.font.constructor, expectedFont);
    assert.equal(mj.config.output.font, 'mathjax-asana');
  });
}

test('duplicate font selections share a pending download without resolving early', async () => {
  const { context, adapters } = createAdapterContext();
  const mj = installMathRuntime(context);
  const downloads = controlFontDownloads(context, mj);
  const first = adapters.applyMathFont('mathjax-stix2');
  let finished = false;
  const second = adapters.applyMathFont('mathjax-stix2').then(() => { finished = true; });
  await Promise.resolve();
  assert.equal(finished, false);
  assert.equal(downloads.scripts.length, 1);
  const Font = downloads.succeed(0, 'mathjax-stix2');
  await Promise.all([first, second]);
  assert.equal(mj.startup.output.font.constructor, Font);
});

test('a failed font falls back to Modern and can be retried', async () => {
  const { context, adapters } = createAdapterContext();
  const mj = installMathRuntime(context);
  const downloads = controlFontDownloads(context, mj);
  const fallback = mj.startup.output;
  const failed = adapters.applyMathFont('mathjax-stix2');
  downloads.scripts[0].onerror();
  await failed;
  assert.equal(mj.startup.output, fallback);
  assert.equal(adapters.getCurrentMathFont(), 'mathjax-modern');
  assert.equal(downloads.scripts[0].removed, true);

  const retry = adapters.applyMathFont('mathjax-stix2');
  assert.equal(downloads.scripts.length, 2);
  const Font = downloads.succeed(1, 'mathjax-stix2');
  await retry;
  assert.equal(mj.startup.output.font.constructor, Font);
});

test('reset takes effect while a font is pending and ignores its later completion', async () => {
  const { context, adapters } = createAdapterContext();
  const mj = installMathRuntime(context);
  const downloads = controlFontDownloads(context, mj);
  const initialOutput = mj.startup.output;
  const pending = adapters.applyMathFont('mathjax-stix2');
  await adapters.applyMathFont('mathjax-modern');
  assert.equal(mj.startup.output, initialOutput);
  downloads.succeed(0, 'mathjax-stix2');
  await pending;
  assert.equal(mj.startup.output, initialOutput);
  assert.equal(adapters.getCurrentMathFont(), 'mathjax-modern');
  assert.equal(mj.config.output.font, 'mathjax-modern');
});
