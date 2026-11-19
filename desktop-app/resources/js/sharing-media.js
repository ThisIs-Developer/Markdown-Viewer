/* Client-only encrypted media resolution. Keys are removed before fetch. */
(function(root) {
  'use strict';
  const states = new WeakMap();
  const ciphertextCache = new Map(), pending = new Map();
  const CACHE_BYTES = 24 * 1024 * 1024, CACHE_MS = 60000, MAX_ASSETS = 32, RENDER_BYTES = 32 * 1024 * 1024;
  let cachedBytes = 0, cacheGeneration = 0;
  function clearCache() { ciphertextCache.clear(); cachedBytes = 0; cacheGeneration += 1; }
  if (root.addEventListener) root.addEventListener('pagehide', clearCache);
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
  async function loadEnvelope(url) {
    for (const [id, entry] of ciphertextCache) if (entry.until <= Date.now()) {
      ciphertextCache.delete(id); cachedBytes -= entry.size;
    }
    if (ciphertextCache.has(url)) return ciphertextCache.get(url).body;
    if (pending.has(url)) return pending.get(url);
    if (pending.size >= 4) throw new Error('Too many encrypted attachments are loading.');
    const generation = cacheGeneration;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
    const work = (async () => {
      const response = await fetch(url, { signal: controller.signal, cache: 'no-store', referrerPolicy: 'no-referrer', credentials: 'omit' });
      if (!response.ok) throw new Error('Encrypted media is unavailable or expired.');
      const received = await MarkdownShareCrypto.readJson(response, Math.ceil((MarkdownShareCrypto.MEDIA_LIMIT + 16) * 4 / 3) + 1024);
      if (!MarkdownShareCrypto.exactKeys(received, ['encrypted']) && !MarkdownShareCrypto.exactKeys(received, ['encrypted', 'expiresAt'])) throw new Error('Invalid encrypted media response.');
      const body = { encrypted: MarkdownShareCrypto.envelope(received.encrypted, MarkdownShareCrypto.MEDIA_LIMIT), expiresAt: received.expiresAt };
      if (body.expiresAt !== undefined && (!Number.isSafeInteger(body.expiresAt) || body.expiresAt <= Date.now())) throw new Error('Encrypted media expired.');
      const size = body.encrypted.ct.length, until = Math.min(Date.now() + CACHE_MS, Number(body.expiresAt) || 0);
      if (generation === cacheGeneration && until > Date.now() && size <= CACHE_BYTES) {
        while (cachedBytes + size > CACHE_BYTES || ciphertextCache.size >= MAX_ASSETS) {
          const oldest = ciphertextCache.keys().next().value;
          cachedBytes -= ciphertextCache.get(oldest).size; ciphertextCache.delete(oldest);
        }
        ciphertextCache.set(url, { body, size, until }); cachedBytes += size;
      }
      return body;
    })().finally(() => { clearTimeout(timeout); pending.delete(url); });
    pending.set(url, work);
    return work;
  }
  async function decrypt(ref, signal) {
    if (signal && signal.aborted) throw new Error('Attachment loading cancelled.');
    const body = await loadEnvelope(ref.url);
    if (signal && signal.aborted) throw new Error('Attachment loading cancelled.');
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
        // CSS escapes can disguise url() in SVG presentation attributes. Keep
        // only simple colors/numbers and strictly local fragment paint servers.
        for (const name of ['fill', 'stroke', 'filter', 'clip-path', 'mask', 'marker', 'marker-start', 'marker-mid', 'marker-end', 'cursor']) {
          const value = node.getAttribute(name);
          if (value && !/^(?:none|currentColor|transparent|[a-z]+|#[\da-f]{3,8}|(?:rgb|rgba|hsl|hsla)\([\d\s.,%+-]+\)|url\(#[\w:.-]+\))$/i.test(value.trim())) node.removeAttribute(name);
        }
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
    const references = new Set();
    let totalBytes = 0, nodes = 0;
    for (const node of container.querySelectorAll('[data-encrypted-media]')) {
      if (states.get(container) !== state) return;
      const timeout = setTimeout(() => state.controller.abort(), 15000);
      try {
        const decoded = MarkdownShareCrypto.unpack(node.getAttribute('data-encrypted-media'), 2048);
        const ref = reference(decoded.url + '#key=' + decoded.key, options.base);
        if (!ref) throw new Error('Invalid encrypted media reference.');
        references.add(ref.url);
        if (++nodes > 128 || references.size > MAX_ASSETS || totalBytes >= RENDER_BYTES) throw new Error('Attachment limit reached.');
        const media = await decrypt(ref, state.controller.signal);
        totalBytes += media.bytes.length;
        if (totalBytes > RENDER_BYTES) throw new Error('Attachment limit reached.');
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
  async function inlineMarkdown(markdown, base, outputLimit = RENDER_BYTES) {
    let output = markdown;
    const encoder = new TextEncoder();
    let outputBytes = encoder.encode(output).length;
    if (outputBytes > outputLimit) throw new Error('Portable document size limit reached.');
    const urls = new Map(), occurrences = [], replacements = new Map();
    const decoder = root.document && root.document.createElement('textarea');
    // Token boundaries cover Markdown destinations, reference definitions and
    // quoted HTML attributes, including relative URLs and HTML entities.
    for (const match of markdown.matchAll(/[^\s<>"'()]+/g)) {
      const raw = match[0].replace(/^(?:src|href)=/i, '');
      if (!raw.includes('e2_')) continue;
      let value = raw;
      if (decoder) { decoder.innerHTML = raw; value = decoder.value; }
      const ref = reference(value, base);
      if (!ref) continue;
      if (!urls.has(raw)) urls.set(raw, { ref, count: 0 });
      urls.get(raw).count += 1;
      const start = match.index + match[0].length - raw.length;
      occurrences.push({ start, end: start + raw.length, raw });
      if (occurrences.length > 128) throw new Error('A portable export supports up to 128 attachment references.');
      if (urls.size > MAX_ASSETS) throw new Error('A portable export supports up to 32 encrypted attachments.');
    }
    let totalBytes = 0;
    for (const [url, { ref, count }] of urls) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const media = await decrypt(ref, controller.signal);
        totalBytes += media.bytes.length;
        if (totalBytes > RENDER_BYTES) throw new Error('Portable attachment size limit reached.');
        outputBytes += count * (media.dataUrl.length - encoder.encode(url).length);
        // Check multiplicity before allocating a potentially huge replacement.
        if (outputBytes > outputLimit) throw new Error('Portable document size limit reached.');
        replacements.set(url, media.dataUrl);
      }
      finally { clearTimeout(timer); }
    }
    const parts = [];
    let position = 0;
    for (const item of occurrences) {
      parts.push(markdown.slice(position, item.start), replacements.get(item.raw)); position = item.end;
    }
    parts.push(markdown.slice(position));
    output = parts.join('');
    if (root.document && root.marked && root.DOMPurify) {
      const template = document.createElement('template');
      template.innerHTML = root.DOMPurify.sanitize(root.marked.parse(output));
      for (const node of template.content.querySelectorAll('[src], [href]')) {
        if (reference(node.getAttribute('src') || node.getAttribute('href'), base)) {
          throw new Error('An attachment URL could not be embedded. Use its complete unescaped managed-media link and retry.');
        }
      }
    }
    return output;
  }
  root.MarkdownShareMedia = Object.freeze({ reference, validateDataUrl, prepareHtml, resolve, release, inlineMarkdown, clearCache });
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MarkdownShareMedia;
})(globalThis);
