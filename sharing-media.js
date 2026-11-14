/* Client-only encrypted media resolution. Keys are removed before fetch. */
(function(root) {
  'use strict';
  const states = new WeakMap();
  const MEDIA_URL = /https?:\/\/[^\s<>"')]+\/api\/(?:image|media)\/e2_[A-Za-z0-9_-]{24}#key=[A-Za-z0-9_-]{43}/g;
  function reference(value, base) {
    try {
      const url = new URL(value, base);
      const expected = new URL(base);
      if (url.origin !== expected.origin || url.search || !/^\/api\/(?:image|media)\/e2_[A-Za-z0-9_-]{24}$/.test(url.pathname) ||
          !/^#key=[A-Za-z0-9_-]{43}$/.test(url.hash)) return null;
      return { url: url.origin + url.pathname, key: url.hash.slice(5) };
    } catch (_) { return null; }
  }
  function validateDataUrl(dataUrl) {
    if (typeof dataUrl !== 'string' || dataUrl.length > 14_100_000) throw new Error('Invalid encrypted media.');
    const match = /^data:((?:image\/(?:avif|bmp|gif|jpeg|png|webp))|(?:video\/(?:mp4|ogg|webm)));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
    if (!match) throw new Error('Unsupported encrypted media type.');
    const mime = match[1];
    const limit = mime.startsWith('video/') ? 10 * 1024 * 1024 : mime === 'image/gif' ? 5 * 1024 * 1024 : 300 * 1024;
    if (match[2].length > Math.ceil(limit / 3) * 4) throw new Error('Encrypted media is too large.');
    const bytes = Uint8Array.from(atob(match[2]), ch => ch.charCodeAt(0));
    const ascii = (a, b) => String.fromCharCode.apply(null, bytes.subarray(a, b));
    const prefix = values => values.every((value, index) => bytes[index] === value);
    const valid = {
      'image/png': () => prefix([137, 80, 78, 71, 13, 10, 26, 10]),
      'image/jpeg': () => prefix([255, 216, 255]),
      'image/gif': () => ['GIF87a', 'GIF89a'].includes(ascii(0, 6)),
      'image/webp': () => ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP',
      'image/bmp': () => ascii(0, 2) === 'BM',
      'image/avif': () => ascii(4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(8, 12)),
      'video/mp4': () => ascii(4, 8) === 'ftyp',
      'video/ogg': () => ascii(0, 4) === 'OggS',
      'video/webm': () => prefix([26, 69, 223, 163])
    }[mime];
    if (!bytes.length || bytes.length > limit || !valid()) throw new Error('Invalid encrypted media bytes.');
    return { mime, bytes };
  }
  async function decrypt(ref, signal) {
    const response = await fetch(ref.url, { signal, cache: 'no-store', referrerPolicy: 'no-referrer', credentials: 'omit' });
    if (!response.ok) throw new Error('Encrypted media is unavailable or expired.');
    const body = await MarkdownShareCrypto.readJson(response, Math.ceil((MarkdownShareCrypto.MEDIA_LIMIT + 16) * 4 / 3) + 1024);
    const payload = await MarkdownShareCrypto.open(body.encrypted, ref.key, 'media', MarkdownShareCrypto.MEDIA_LIMIT);
    if (!MarkdownShareCrypto.exactKeys(payload, ['dataUrl'])) throw new Error('Invalid encrypted media.');
    const parsed = validateDataUrl(payload.dataUrl);
    return { dataUrl: payload.dataUrl, mime: parsed.mime, bytes: parsed.bytes };
  }
  function prepareHtml(html, options) {
    const template = document.createElement('template');
    template.innerHTML = html;
    const content = template.content;
    // Template contents are inert: remove remote URLs before nodes enter a live document.
    content.querySelectorAll('img, video, source').forEach(node => {
      const value = node.getAttribute('src');
      const ref = reference(value || '', options.base);
      if (ref) {
        node.removeAttribute('src');
        node.removeAttribute('srcset');
        node.setAttribute('data-encrypted-media', MarkdownShareCrypto.pack(ref, 2048));
      }
    });
    if (options.privateContent) {
      content.querySelectorAll('*').forEach(node => {
        node.removeAttribute('style');
        node.removeAttribute('srcset');
        node.removeAttribute('poster');
        node.removeAttribute('background');
        node.removeAttribute('ping');
        for (const name of ['src', 'href', 'xlink:href']) {
          if (name === 'href' && node.tagName === 'A') continue;
          const value = node.getAttribute(name);
          if (value && !value.startsWith('#') && !/^data:(?:image\/(?:png|jpeg|gif|webp|avif|bmp)|video\/(?:mp4|ogg|webm));base64,/.test(value)) {
            node.removeAttribute(name);
            if (node.tagName === 'IMG') node.setAttribute('alt', (node.getAttribute('alt') || 'External image') + ' (external resource blocked)');
          }
        }
      });
      content.querySelectorAll('style, link, iframe, object, embed').forEach(node => node.remove());
      // Render source locally rather than allowing renderer-specific remote assets/fallbacks.
      content.querySelectorAll('.mermaid, .plantuml-diagram, .d2-diagram, .graphviz-diagram, .kroki-diagram, .geojson-map, .topojson-map, .stl-viewer, .abc-notation').forEach(node => {
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        let source = node.getAttribute('data-original-code');
        try { source = source ? decodeURIComponent(source) : node.textContent; } catch (_) { source = node.textContent; }
        code.textContent = source || '';
        pre.appendChild(code);
        const shell = node.closest('.diagram-viewer, .mermaid-container, .geojson-container, .topojson-container, .stl-container, .abc-container');
        (shell || node).replaceWith(pre);
      });
    }
    return template.innerHTML;
  }
  function release(container) {
    const state = states.get(container);
    if (!state) return;
    state.controller.abort();
    state.urls.forEach(url => URL.revokeObjectURL(url));
    states.delete(container);
  }
  async function resolve(container, options = {}) {
    release(container);
    const state = { controller: new AbortController(), urls: [] };
    states.set(container, state);
    for (const node of container.querySelectorAll('[data-encrypted-media]')) {
      if (states.get(container) !== state) return;
      const timeout = setTimeout(() => state.controller.abort(), 15000);
      try {
        const decoded = MarkdownShareCrypto.unpack(node.getAttribute('data-encrypted-media'), 2048);
        const ref = reference(decoded.url + '#key=' + decoded.key, options.base);
        if (!ref) throw new Error('Invalid encrypted media reference.');
        const media = await decrypt(ref, state.controller.signal);
        if (states.get(container) !== state || !container.contains(node)) return;
        const url = options.inline ? media.dataUrl : URL.createObjectURL(new Blob([media.bytes], { type: media.mime }));
        if (!options.inline) state.urls.push(url);
        node.setAttribute('src', url);
        if (options.inline) node.removeAttribute('data-encrypted-media');
        const video = node.tagName === 'VIDEO' ? node : node.closest('video');
        if (video) video.load();
      } catch (_) {
        if (options.inline) throw new Error('An encrypted attachment could not be exported. Check the connection and expiry.');
        if (states.get(container) === state) node.setAttribute('title', 'Encrypted media is unavailable. Check the complete link and connection.');
      } finally { clearTimeout(timeout); }
    }
  }
  async function inlineMarkdown(markdown, base) {
    let output = markdown;
    for (const url of new Set(markdown.match(MEDIA_URL) || [])) {
      const ref = reference(url, base);
      if (!ref) continue;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try { output = output.split(url).join((await decrypt(ref, controller.signal)).dataUrl); }
      finally { clearTimeout(timer); }
    }
    return output;
  }
  root.MarkdownShareMedia = Object.freeze({ reference, validateDataUrl, prepareHtml, resolve, release, inlineMarkdown });
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MarkdownShareMedia;
})(globalThis);
