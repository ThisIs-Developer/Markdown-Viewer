const fs = require('node:fs/promises');
const path = require('node:path');
const { expect } = require('@playwright/test');

const rootDir = path.resolve(__dirname, '../..');
const fixturesDir = path.join(rootDir, 'tests', 'fixtures');
const routedPages = new WeakSet();
const assetBodyCache = new Map();
let appVersionPromise;

const localBrowserAssets = [
  ['https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.2/css/bootstrap.min.css', 'node_modules/bootstrap/dist/css/bootstrap.min.css', 'text/css'],
  ['https://cdn.jsdelivr.net/npm/github-markdown-css@5.3.0/github-markdown.css', 'node_modules/github-markdown-css/github-markdown.css', 'text/css'],
  ['https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js', 'node_modules/marked/marked.min.js', 'application/javascript'],
  ['https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js', 'node_modules/@highlightjs/cdn-assets/highlight.min.js', 'application/javascript'],
  ['https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/powershell.min.js', 'node_modules/@highlightjs/cdn-assets/languages/powershell.min.js', 'application/javascript'],
  ['https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.4.13/purify.min.js', 'node_modules/dompurify/dist/purify.min.js', 'application/javascript'],
  ['https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js', 'node_modules/file-saver/dist/FileSaver.min.js', 'application/javascript'],
  ['https://cdn.jsdelivr.net/npm/js-yaml@4.3.1/dist/js-yaml.min.js', 'node_modules/js-yaml/dist/js-yaml.min.js', 'application/javascript'],
  ['https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.2/js/bootstrap.bundle.min.js', 'node_modules/bootstrap/dist/js/bootstrap.bundle.min.js', 'application/javascript'],
  ['https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', 'node_modules/jszip/dist/jszip.min.js', 'application/javascript'],
  ['https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js', 'node_modules/pako/dist/pako.min.js', 'application/javascript']
];

async function appVersion() {
  if (!appVersionPromise) {
    appVersionPromise = fs.readFile(path.join(rootDir, 'script.js'), 'utf8').then(source => {
      const match = source.match(/const APP_VERSION = '([^']+)'/);
      if (!match) throw new Error('Unable to read APP_VERSION from script.js');
      return match[1];
    });
  }
  return appVersionPromise;
}

async function installLocalBrowserAssets(page) {
  if (routedPages.has(page)) return;
  routedPages.add(page);

  for (const [url, relativePath, contentType] of localBrowserAssets) {
    await page.route(url, async route => {
      if (!assetBodyCache.has(relativePath)) {
        assetBodyCache.set(relativePath, fs.readFile(path.join(rootDir, relativePath)));
      }
      await route.fulfill({
        status: 200,
        contentType,
        body: await assetBodyCache.get(relativePath)
      });
    });
  }

  await page.addInitScript(() => {
    window.MathJax = {
      startup: { promise: Promise.resolve() },
      typesetPromise(targets = []) {
        targets.forEach(target => {
          if (target.querySelector('mjx-container[data-test-renderer]')) return;
          const rendered = document.createElement('mjx-container');
          rendered.dataset.testRenderer = 'true';
          rendered.textContent = 'Rendered math';
          target.appendChild(rendered);
        });
        return Promise.resolve();
      },
      typesetClear(targets = []) {
        targets.forEach(target => {
          target.querySelectorAll('mjx-container[data-test-renderer]').forEach(node => node.remove());
        });
      }
    };
  });
}

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.marked && window.DOMPurify);
  await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
}

async function fixture(name) {
  return fs.readFile(path.join(fixturesDir, name), 'utf8');
}

function isCriticalBrowserMessage(message) {
  const text = message.text();
  return message.type() === 'error' &&
    !/Failed to load resource: the server responded with a status of 404.*favicon/i.test(text) &&
    !/Failed to load resource: net::ERR_BLOCKED_BY_RESPONSE\.NotSameSite/i.test(text);
}

async function openApp(page, url = '/', options = {}) {
  const expectEditorVisible = options.expectEditorVisible !== false;
  const criticalErrors = [];
  await installLocalBrowserAssets(page);
  if (options.showReleaseNotes !== true) {
    const version = await appVersion();
    await page.addInitScript(currentVersion => {
      localStorage.setItem('markdownViewerLastVersion', currentVersion);
      localStorage.setItem('markdownViewerReleaseNotesSeenVersion', currentVersion);
      localStorage.removeItem('markdownViewerPendingReleaseNotesVersion');
      localStorage.removeItem('markdownViewerPendingReleaseNotesMode');
    }, version);
  }
  page.on('console', message => {
    if (isCriticalBrowserMessage(message)) {
      criticalErrors.push(message.text());
    }
  });
  page.on('pageerror', error => {
    criticalErrors.push(error.message);
  });

  await page.goto(url);
  if (expectEditorVisible) {
    await expect(page.locator('#markdown-editor')).toBeVisible();
  } else {
    await expect(page.locator('#markdown-editor')).toBeAttached();
  }
  await expect(page.locator('#markdown-preview')).toBeVisible();
  await waitForAppReady(page);
  return criticalErrors;
}

async function setEditorContent(page, markdown) {
  await page.locator('#markdown-editor').evaluate((editor, value) => {
    editor.focus();
    editor.value = value;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }, markdown);
}

async function stubClipboard(page) {
  await page.evaluate(() => {
    window.__copiedText = '';
    navigator.clipboard.writeText = text => {
      window.__copiedText = text;
      return Promise.resolve();
    };
  });
}

async function editorValue(page) {
  return page.locator('#markdown-editor').inputValue();
}

async function readWorkspaceStore(page, storeName) {
  return page.evaluate(async name => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('markdownViewerWorkspace');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction(name, 'readonly');
        const request = transaction.objectStore(name).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      database.close();
    }
  }, storeName);
}

async function storedDocuments(page) {
  const [metadata, contents] = await Promise.all([
    readWorkspaceStore(page, 'documents'),
    readWorkspaceStore(page, 'contents')
  ]);
  const contentById = new Map(contents.map(record => [record.id, record.content]));
  return metadata.map(record => ({
    ...record,
    content: contentById.get(record.id) || ''
  }));
}

async function waitForPreviewText(page, text) {
  await expect(page.locator('#markdown-preview')).toContainText(text);
}

async function selectedDownloadName(downloadPromise, clickPromise) {
  const [download] = await Promise.all([downloadPromise, clickPromise]);
  return download.suggestedFilename();
}

function svgResponse(label) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120" viewBox="0 0 320 120" role="img" aria-label="${label}">
  <rect width="320" height="120" fill="#f6f8fa" stroke="#57606a"/>
  <circle cx="74" cy="60" r="24" fill="#0969da"/>
  <path d="M104 60H214" stroke="#24292f" stroke-width="4"/>
  <polygon points="214,48 244,60 214,72" fill="#24292f"/>
  <text x="160" y="104" text-anchor="middle" font-family="Arial" font-size="16" fill="#24292f">${label}</text>
</svg>`;
}

async function stubRemoteDiagramServices(page) {
  await page.route('https://www.plantuml.com/plantuml/svg/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: svgResponse('PlantUML test diagram')
    });
  });

  await page.route('https://kroki.io/**', route => {
    const url = route.request().url();
    const label = url.includes('/d2/') ? 'D2 test diagram'
      : url.includes('/graphviz/') ? 'Graphviz test diagram'
        : url.includes('/vegalite/') ? 'Vega-Lite test chart'
          : url.includes('/wavedrom/') ? 'WaveDrom test diagram'
            : 'Kroki test diagram';
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: svgResponse(label)
    });
  });
}

async function stubLazyRendererLibraries(page) {
  await page.addInitScript(() => {
    window.pako = window.pako || {
      deflate() { return new Uint8Array([1, 2, 3, 4]); },
      inflate(bytes) { return bytes; }
    };

    window.mermaid = window.mermaid || {
      initialize() {},
      render(id) {
        return Promise.resolve({
          svg: '<svg id="' + id + '" xmlns="http://www.w3.org/2000/svg" width="260" height="100" role="img"><rect width="260" height="100" fill="#ddf4ff"></rect><text x="130" y="55" text-anchor="middle">Mermaid test diagram</text></svg>'
        });
      }
    };

    window.ABCJS = window.ABCJS || {
      renderAbc(target) {
        const node = typeof target === 'string' ? document.getElementById(target) : target;
        node.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="90" role="img"><text x="20" y="45">ABC notation test score</text><path d="M20 60H260" stroke="black"></path></svg>';
        return [{}];
      }
    };

    window.d3 = window.d3 || {};
    window.markmap = window.markmap || {};
    window.markmap.Transformer = window.markmap.Transformer || class {
      transform() {
        return {
          root: { content: 'Markmap test mind map', children: [{ content: 'Branch', children: [] }] },
          features: {},
          frontmatter: {}
        };
      }
      getUsedAssets() {
        return {};
      }
    };
    window.markmap.loadCSS = window.markmap.loadCSS || function() {};
    window.markmap.loadJS = window.markmap.loadJS || function() { return Promise.resolve(); };
    window.markmap.deriveOptions = window.markmap.deriveOptions || function(options) { return options || {}; };
    window.markmap.Markmap = window.markmap.Markmap || class {
      constructor(svg) {
        this.svg = svg;
        this.state = { rect: { x1: 0, y1: 0, x2: 240, y2: 120 } };
      }
      async setData() {
        this.svg.innerHTML = '<g><circle cx="80" cy="45" r="20" fill="#2da44e"></circle><text x="115" y="50">Markmap test mind map</text></g>';
      }
      fit() {}
      static create(svg) {
        const instance = new window.markmap.Markmap(svg);
        instance.setData();
        return instance;
      }
    };

    class Vector3 {
      constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
      set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
      normalize() { return this; }
      clone() { return new Vector3(this.x, this.y, this.z); }
      sub(v) { this.x -= v.x || 0; this.y -= v.y || 0; this.z -= v.z || 0; return this; }
    }
    class Scene { constructor() { this.children = []; } add(node) { this.children.push(node); } }
    class PerspectiveCamera {
      constructor(fov) { this.fov = fov; this.position = new Vector3(); }
      lookAt() {}
      updateProjectionMatrix() {}
    }
    class WebGLRenderer {
      constructor() { this.domElement = document.createElement('canvas'); this.domElement.width = 400; this.domElement.height = 400; }
      setSize(width, height) { this.domElement.width = width; this.domElement.height = height; }
      setPixelRatio() {}
      render() {
        const ctx = this.domElement.getContext('2d');
        if (ctx) { ctx.fillStyle = '#ddf4ff'; ctx.fillRect(0, 0, this.domElement.width, this.domElement.height); }
      }
      dispose() {}
    }
    class Light { constructor() { this.position = new Vector3(); } }
    class GridHelper { constructor() { this.position = new Vector3(); this.geometry = { dispose() {} }; this.material = { dispose() {} }; } }
    class Material { dispose() {} }
    class Mesh { constructor(geometry, material) { this.geometry = geometry; this.material = material; this.position = new Vector3(); } }
    class STLLoader {
      parse() {
        return {
          getAttribute() { return { array: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), count: 3 }; },
          rotateX() {},
          computeBoundingBox() {
            this.boundingBox = {
              getCenter(target) { target.set(0.5, 0.5, 0); },
              getSize(target) { target.set(1, 1, 1); }
            };
          },
          computeVertexNormals() {},
          dispose() {}
        };
      }
    }
    class OrbitControls {
      constructor() { this.target = new Vector3(); }
      update() {}
      dispose() {}
    }
    window.THREE = window.THREE || {
      Vector3,
      Scene,
      PerspectiveCamera,
      WebGLRenderer,
      AmbientLight: Light,
      DirectionalLight: Light,
      GridHelper,
      MeshStandardMaterial: Material,
      MeshNormalMaterial: Material,
      MeshBasicMaterial: Material,
      Mesh,
      STLLoader,
      OrbitControls
    };
  });

  await page.route(/mermaid.*mermaid\.min\.js/, route => {
    route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.mermaid = {
          initialize() {},
          render(id, source) {
            return Promise.resolve({
              svg: '<svg id="' + id + '" xmlns="http://www.w3.org/2000/svg" width="260" height="100" role="img"><rect width="260" height="100" fill="#ddf4ff"/><text x="130" y="55" text-anchor="middle">Mermaid test diagram</text></svg>'
            });
          }
        };
      `
    });
  });

  await page.route(/abcjs-basic-min\.js/, route => {
    route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.ABCJS = {
          renderAbc(target, code) {
            const node = typeof target === 'string' ? document.getElementById(target) : target;
            node.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="90" role="img"><text x="20" y="45">ABC notation test score</text><path d="M20 60H260" stroke="black"/></svg>';
            return [{}];
          }
        };
      `
    });
  });

  await page.route(/d3.*\.min\.js/, route => {
    route.fulfill({ contentType: 'application/javascript', body: 'window.d3 = window.d3 || {};' });
  });

  await page.route(/markmap-lib.*\.js|markmap-lib.*\.iife\.js/, route => {
    route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.markmap = window.markmap || {};
        window.markmap.Transformer = class {
          transform(source) {
            return {
              root: { content: 'Markmap test mind map', children: [{ content: 'Branch', children: [] }] },
              features: {},
              frontmatter: {}
            };
          }
          getUsedAssets() { return {}; }
        };
        window.markmap.loadCSS = function() {};
        window.markmap.loadJS = function() { return Promise.resolve(); };
        window.markmap.deriveOptions = function(options) { return options || {}; };
      `
    });
  });

  await page.route(/markmap-view.*\.js/, route => {
    route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.markmap = window.markmap || {};
        window.markmap.Markmap = class {
          constructor(svg) { this.svg = svg; this.state = { rect: { x1: 0, y1: 0, x2: 240, y2: 120 } }; }
          async setData() { this.svg.innerHTML = '<g><circle cx="80" cy="45" r="20" fill="#2da44e"></circle><text x="115" y="50">Markmap test mind map</text></g>'; }
          fit() {}
          static create(svg) {
            const instance = new window.markmap.Markmap(svg);
            instance.setData();
            return instance;
          }
        };
      `
    });
  });

  await page.route(/three\.min\.js/, route => {
    route.fulfill({
      contentType: 'application/javascript',
      body: `
        (function() {
          class Vector3 {
            constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
            set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
            normalize() { return this; }
            clone() { return new Vector3(this.x, this.y, this.z); }
            sub(v) { this.x -= v.x || 0; this.y -= v.y || 0; this.z -= v.z || 0; return this; }
          }
          class Scene { constructor() { this.children = []; } add(node) { this.children.push(node); } }
          class PerspectiveCamera {
            constructor(fov) { this.fov = fov; this.position = new Vector3(); }
            lookAt() {}
            updateProjectionMatrix() {}
          }
          class WebGLRenderer {
            constructor() { this.domElement = document.createElement('canvas'); this.domElement.width = 400; this.domElement.height = 400; }
            setSize(width, height) { this.domElement.width = width; this.domElement.height = height; }
            setPixelRatio() {}
            render() {
              const ctx = this.domElement.getContext('2d');
              if (ctx) { ctx.fillStyle = '#ddf4ff'; ctx.fillRect(0, 0, this.domElement.width, this.domElement.height); }
            }
            dispose() {}
          }
          class Light { constructor() { this.position = new Vector3(); } }
          class GridHelper { constructor() { this.position = new Vector3(); this.geometry = { dispose() {} }; this.material = { dispose() {} }; } }
          class Material { dispose() {} }
          class Mesh { constructor(geometry, material) { this.geometry = geometry; this.material = material; this.position = new Vector3(); } }
          window.THREE = {
            Vector3,
            Scene,
            PerspectiveCamera,
            WebGLRenderer,
            AmbientLight: Light,
            DirectionalLight: Light,
            GridHelper,
            MeshStandardMaterial: Material,
            MeshNormalMaterial: Material,
            MeshBasicMaterial: Material,
            Mesh
          };
        })();
      `
    });
  });

  await page.route(/STLLoader\.js/, route => {
    route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.THREE.STLLoader = class {
          parse() {
            return {
              getAttribute() { return { array: new Float32Array([0,0,0, 1,0,0, 0,1,0]), count: 3 }; },
              rotateX() {},
              computeBoundingBox() {
                this.boundingBox = {
                  getCenter(target) { target.set(0.5, 0.5, 0); },
                  getSize(target) { target.set(1, 1, 1); }
                };
              },
              computeVertexNormals() {},
              dispose() {}
            };
          }
        };
      `
    });
  });

  await page.route(/OrbitControls\.js/, route => {
    route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.THREE.OrbitControls = class {
          constructor() { this.target = new window.THREE.Vector3(); }
          update() {}
          dispose() {}
        };
      `
    });
  });
}

async function stubExportLibraries(page) {
  await page.addInitScript(() => {
    window.__printCalled = 0;
    window.print = () => {
      window.__printCalled += 1;
      window.dispatchEvent(new Event('afterprint'));
    };
    window.html2canvas = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#0969da';
      ctx.fillText('PNG export test', 20, 40);
      return canvas;
    };
  });
}

async function stubLiveShareRuntime(page) {
  await page.route('https://esm.sh/yjs@13.6.10/es2022/yjs.mjs', route => {
    route.fulfill({
      contentType: 'application/javascript',
      body: `
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        class FakeText {
          constructor(doc) { this.doc = doc; this.value = ''; this.observers = new Set(); }
          get length() { return this.value.length; }
          toString() { return this.value; }
          insert(index, text) { this.value = this.value.slice(0, index) + text + this.value.slice(index); this.doc._notify(); }
          delete(index, length) { this.value = this.value.slice(0, index) + this.value.slice(index + length); this.doc._notify(); }
          observe(fn) { this.observers.add(fn); }
          unobserve(fn) { this.observers.delete(fn); }
        }
        class FakeMap {
          constructor(doc) { this.doc = doc; this.values = new Map(); this.observers = new Set(); }
          get(key) { return this.values.get(key); }
          set(key, value) { this.values.set(key, value); this.doc._notifyMap(); }
          delete(key) { const deleted = this.values.delete(key); if (deleted) this.doc._notifyMap(); return deleted; }
          forEach(fn) { this.values.forEach(fn); }
          observe(fn) { this.observers.add(fn); }
          unobserve(fn) { this.observers.delete(fn); }
        }
        export class Doc {
          constructor() { this.handlers = new Set(); this.origin = null; this.text = new FakeText(this); this.map = new FakeMap(this); }
          getText() { return this.text; }
          getMap() { return this.map; }
          on(type, fn) { if (type === 'update') this.handlers.add(fn); }
          off(type, fn) { if (type === 'update') this.handlers.delete(fn); }
          transact(fn, origin) { const previous = this.origin; this.origin = origin; fn(); this.origin = previous; this._emitUpdate(origin); }
          _notify() { const event = { transaction: { origin: this.origin } }; this.text.observers.forEach(fn => fn(event)); this._emitUpdate(this.origin); }
          _notifyMap() { const event = { transaction: { origin: this.origin } }; this.map.observers.forEach(fn => fn(event, event.transaction)); this._emitUpdate(this.origin); }
          _emitUpdate(origin) { const update = encodeStateAsUpdate(this); this.handlers.forEach(fn => fn(update, origin)); }
        }
        export function encodeStateAsUpdate(doc) {
          const session = {};
          doc.map.values.forEach((value, key) => { session[key] = value; });
          return encoder.encode(JSON.stringify({ text: doc.text.value, session }));
        }
        export function applyUpdate(doc, update, origin) {
          const payload = JSON.parse(decoder.decode(update));
          doc.origin = origin;
          doc.text.value = payload.text || '';
          doc.map.values = new Map(Object.entries(payload.session || {}));
          const event = { transaction: { origin } };
          doc.text.observers.forEach(fn => fn(event));
          doc.map.observers.forEach(fn => fn(event, event.transaction));
          doc.origin = null;
        }
        export function createRelativePositionFromTypeIndex(type, index) { return { index }; }
        export function encodeRelativePosition(position) { return encoder.encode(JSON.stringify(position)); }
        export function decodeRelativePosition(bytes) { return JSON.parse(decoder.decode(bytes)); }
        export function createAbsolutePositionFromRelativePosition(position, doc) { return { index: Math.min(position.index || 0, doc.text.value.length) }; }
      `
    });
  });

  await page.addInitScript(() => {
    class FakeWebSocket extends EventTarget {
      constructor(url) {
        super();
        this.url = url;
        this.readyState = FakeWebSocket.CONNECTING;
        this.id = Math.random().toString(36).slice(2);
        const parsed = new URL(url);
        const roomId = parsed.pathname.split('/').filter(Boolean).pop() || 'default';
        this.channel = new BroadcastChannel('playwright-live-share-' + roomId);
        this.channel.onmessage = event => {
          if (!event.data || event.data.sender === this.id) return;
          this.dispatchEvent(new MessageEvent('message', { data: event.data.payload }));
        };
        setTimeout(() => {
          this.readyState = FakeWebSocket.OPEN;
          this.dispatchEvent(new Event('open'));
        }, 0);
      }
      send(payload) {
        this.channel.postMessage({ sender: this.id, payload });
      }
      close() {
        this.readyState = FakeWebSocket.CLOSED;
        this.channel.close();
        this.dispatchEvent(new Event('close'));
      }
    }
    FakeWebSocket.CONNECTING = 0;
    FakeWebSocket.OPEN = 1;
    FakeWebSocket.CLOSING = 2;
    FakeWebSocket.CLOSED = 3;
    window.WebSocket = FakeWebSocket;
  });
}

module.exports = {
  appVersion,
  fixture,
  openApp,
  setEditorContent,
  stubClipboard,
  editorValue,
  readWorkspaceStore,
  storedDocuments,
  waitForPreviewText,
  selectedDownloadName,
  waitForAppReady,
  stubRemoteDiagramServices,
  stubLazyRendererLibraries,
  stubExportLibraries,
  stubLiveShareRuntime
};
