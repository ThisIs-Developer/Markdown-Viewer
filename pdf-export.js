(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PdfPrintEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_OPTIONS = Object.freeze({
    pageSize: "A4",
    margin: "15mm",
    imageTimeoutMs: 15000,
    layoutTimeoutMs: 3000,
    cleanupTimeoutMs: 60000
  });

  class PdfExportCancelledError extends Error {
    constructor() {
      super("PDF export cancelled.");
      this.name = "PdfExportCancelledError";
    }
  }

  function throwIfAborted(signal) {
    if (signal && signal.aborted) throw new PdfExportCancelledError();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeCssLength(value, fallback) {
    return /^\d+(?:\.\d+)?(?:mm|cm|in|pt|px)$/.test(String(value || "")) ? String(value) : fallback;
  }

  function normalizePageSize(value) {
    return /^(?:A[3-5]|letter|legal)$/i.test(String(value || "")) ? String(value) : DEFAULT_OPTIONS.pageSize;
  }

  function createPrintCss(options) {
    const settings = Object.assign({}, DEFAULT_OPTIONS, options);
    const pageSize = normalizePageSize(settings.pageSize);
    const margin = normalizeCssLength(settings.margin, DEFAULT_OPTIONS.margin);
    return `
@page { size: ${pageSize}; margin: ${margin}; }
html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
body { margin: 0 !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
.pdf-print-document.markdown-body {
  box-sizing: border-box !important;
  width: auto !important;
  max-width: none !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: visible !important;
}
.pdf-print-document h1,
.pdf-print-document h2,
.pdf-print-document h3,
.pdf-print-document h4,
.pdf-print-document h5,
.pdf-print-document h6 { break-after: avoid-page; page-break-after: avoid; }
.pdf-print-document p,
.pdf-print-document li { orphans: 3; widows: 3; }
.pdf-print-document img,
.pdf-print-document figure,
.pdf-print-document svg,
.pdf-print-document .mermaid-container,
.pdf-print-document .pdf-keep-together,
.pdf-print-document blockquote { break-inside: avoid-page; page-break-inside: avoid; }
.pdf-print-document img,
.pdf-print-document svg,
.pdf-print-document canvas,
.pdf-print-document .mermaid-container { max-width: 100% !important; height: auto !important; }
.pdf-print-document .mermaid-container svg { display: block; margin-inline: auto; max-height: 247mm; }
.pdf-print-document pre {
  white-space: pre-wrap !important;
  overflow-wrap: anywhere !important;
  overflow: visible !important;
  max-height: none !important;
}
.pdf-print-document pre.pdf-keep-together { break-inside: avoid-page; page-break-inside: avoid; }
.pdf-print-document table { width: 100% !important; border-collapse: collapse; break-inside: auto; page-break-inside: auto; }
.pdf-print-document thead { display: table-header-group; }
.pdf-print-document tfoot { display: table-footer-group; }
.pdf-print-document tr { break-inside: avoid-page; page-break-inside: avoid; }
.pdf-print-document th,
.pdf-print-document td { overflow-wrap: anywhere; }
.pdf-print-document a { color: inherit; text-decoration: underline; }
.pdf-print-document .mermaid-toolbar,
.pdf-print-document .copy-code-btn,
.pdf-print-document .sr-only,
.pdf-print-document [aria-hidden="true"] { display: none !important; }
.pdf-print-document .pdf-asset-error {
  min-height: 2rem;
  outline: 1px dashed #cf222e;
}
`;
  }

  function nextFrame(win) {
    return new Promise(resolve => win.requestAnimationFrame(() => resolve()));
  }

  function withTimeout(promise, timeoutMs, message) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]).finally(() => clearTimeout(timer));
  }

  async function waitForImages(container, options) {
    const settings = Object.assign({}, DEFAULT_OPTIONS, options);
    const signal = settings.signal;
    const images = Array.from(container.querySelectorAll("img"));
    const failures = [];

    await Promise.all(images.map(async image => {
      throwIfAborted(signal);
      if (image.complete && image.naturalWidth > 0) return;
      try {
        if (typeof image.decode === "function") {
          await withTimeout(image.decode(), settings.imageTimeoutMs, `Image timed out: ${image.currentSrc || image.src}`);
        } else {
          await withTimeout(new Promise((resolve, reject) => {
            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", reject, { once: true });
          }), settings.imageTimeoutMs, `Image timed out: ${image.currentSrc || image.src}`);
        }
      } catch (error) {
        image.classList.add("pdf-asset-error");
        failures.push({ src: image.currentSrc || image.src || "", message: error.message || "Image failed to load" });
      }
    }));

    throwIfAborted(signal);
    return failures;
  }

  async function waitForStableLayout(element, options) {
    const settings = Object.assign({}, DEFAULT_OPTIONS, options);
    const signal = settings.signal;
    const win = element.ownerDocument.defaultView;
    const startedAt = Date.now();
    let previous = null;
    let stableFrames = 0;

    while (Date.now() - startedAt < settings.layoutTimeoutMs) {
      throwIfAborted(signal);
      await nextFrame(win);
      const current = `${element.scrollWidth}:${element.scrollHeight}`;
      stableFrames = current === previous ? stableFrames + 1 : 0;
      if (stableFrames >= 2) return;
      previous = current;
    }
  }

  function markAtomicBlocks(container, printableHeightPx) {
    const limit = Number.isFinite(printableHeightPx) ? printableHeightPx : 934;
    container.querySelectorAll("pre, blockquote, figure, .mermaid-container").forEach(element => {
      if (element.getBoundingClientRect().height <= limit) element.classList.add("pdf-keep-together");
    });
  }

  function collectStyleMarkup(doc) {
    return Array.from(doc.querySelectorAll('link[rel="stylesheet"], style'))
      .map(node => node.outerHTML)
      .join("\n");
  }

  function buildPrintHtml(config) {
    const options = Object.assign({}, DEFAULT_OPTIONS, config.options);
    const theme = config.theme === "dark" ? "dark" : "light";
    return `<!doctype html>
<html lang="${escapeHtml(config.lang || "en")}" data-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="${escapeHtml(config.baseUrl)}">
<title>${escapeHtml(config.title || "document")}</title>
${config.styleMarkup || ""}
<style id="pdf-print-layout">${createPrintCss(options)}</style>
</head>
<body><main class="markdown-body pdf-print-document">${config.contentHtml}</main></body>
</html>`;
  }

  function createPrintFrame(doc) {
    const frame = doc.createElement("iframe");
    frame.setAttribute("title", "PDF print document");
    frame.setAttribute("aria-hidden", "true");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "1px";
    frame.style.height = "1px";
    frame.style.border = "0";
    frame.style.opacity = "0";
    frame.style.pointerEvents = "none";
    return frame;
  }

  async function loadPrintFrame(frame, html, signal) {
    throwIfAborted(signal);
    const loaded = new Promise((resolve, reject) => {
      frame.addEventListener("load", resolve, { once: true });
      frame.addEventListener("error", () => reject(new Error("Unable to prepare the print document.")), { once: true });
    });
    frame.srcdoc = html;
    await loaded;
    throwIfAborted(signal);
    if (frame.contentDocument && frame.contentDocument.fonts && frame.contentDocument.fonts.ready) {
      await frame.contentDocument.fonts.ready;
    }
    await nextFrame(frame.contentWindow);
    await nextFrame(frame.contentWindow);
  }

  function printFrame(frame, options) {
    const settings = Object.assign({}, DEFAULT_OPTIONS, options);
    const win = frame.contentWindow;
    if (!win || typeof win.print !== "function") throw new Error("Printing is not supported in this environment.");

    return new Promise(resolve => {
      let settled = false;
      let fallbackTimer = null;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (fallbackTimer) clearTimeout(fallbackTimer);
        win.removeEventListener("afterprint", finish);
        resolve();
      };
      win.addEventListener("afterprint", finish, { once: true });
      fallbackTimer = setTimeout(finish, settings.cleanupTimeoutMs);
      win.focus();
      win.print();
      setTimeout(finish, 0);
    });
  }

  async function exportElement(config) {
    if (!config || !config.element || !config.element.ownerDocument) {
      throw new TypeError("A rendered export element is required.");
    }
    const element = config.element;
    const doc = element.ownerDocument;
    const signal = config.signal;
    const progress = typeof config.onProgress === "function" ? config.onProgress : function () {};
    let frame = null;

    try {
      throwIfAborted(signal);
      progress(55, "Loading images");
      const imageFailures = await waitForImages(element, { signal, imageTimeoutMs: config.imageTimeoutMs });
      progress(65, "Finalizing layout");
      if (doc.fonts && doc.fonts.ready) await doc.fonts.ready;
      await waitForStableLayout(element, { signal, layoutTimeoutMs: config.layoutTimeoutMs });
      markAtomicBlocks(element, config.printableHeightPx);

      progress(75, "Preparing print document");
      frame = createPrintFrame(doc);
      doc.body.appendChild(frame);
      const html = buildPrintHtml({
        title: config.title,
        lang: doc.documentElement.lang,
        theme: config.theme,
        baseUrl: doc.baseURI,
        styleMarkup: collectStyleMarkup(doc),
        contentHtml: element.innerHTML,
        options: config.options
      });
      await loadPrintFrame(frame, html, signal);
      const frameImageFailures = await waitForImages(frame.contentDocument.body, {
        signal,
        imageTimeoutMs: config.imageTimeoutMs
      });
      imageFailures.push(...frameImageFailures);
      await waitForStableLayout(frame.contentDocument.body, {
        signal,
        layoutTimeoutMs: config.layoutTimeoutMs
      });

      progress(90, "Opening print dialog");
      await printFrame(frame, config.options);
      progress(100, "Ready to save");
      return { imageFailures };
    } finally {
      if (frame && frame.parentNode) frame.parentNode.removeChild(frame);
    }
  }

  return Object.freeze({
    DEFAULT_OPTIONS,
    PdfExportCancelledError,
    buildPrintHtml,
    createPrintCss,
    exportElement,
    markAtomicBlocks,
    normalizeCssLength,
    normalizePageSize,
    waitForImages,
    waitForStableLayout
  });
});
