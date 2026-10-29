// Browser-only, read-only access to a drag payload. Capture it synchronously:
// browsers protect DataTransfer as soon as the drop handler yields.
(function(target) {
  'use strict';
  function capture(transfer) {
    const items = Array.from(transfer && transfer.items || []).filter(item => item.kind === 'file');
    if (!items.length) return Array.from(transfer && transfer.files || []).map(file => ({ file }));
    return items.map(item => {
      let entry = null;
      let file = null;
      try { entry = (item.getAsEntry || item.webkitGetAsEntry || function() {}).call(item); } catch (_) {}
      try { file = item.getAsFile && item.getAsFile(); } catch (_) {}
      return { entry, file };
    });
  }
  function describe(snapshot) {
    return snapshot.map(({ entry, file }) => ({
      name: entry && entry.name || file && file.name || '',
      directory: Boolean(entry && entry.isDirectory),
      unknown: !entry && !file
    }));
  }
  async function collectFolders(snapshot, options) {
    const settings = options || {};
    const limits = Object.assign({ entries: 40000, directories: 2000, files: 10000,
      depth: 32, fileBytes: 10 * 1024 * 1024, totalBytes: 200 * 1024 * 1024, milliseconds: 60000 }, settings.limits);
    const deadline = Date.now() + limits.milliseconds;
    const result = { directories: [], files: [] };
    const visited = new Set();
    let entries = 0;
    let bytes = 0;
    function checkpoint() {
      if (settings.canContinue && !settings.canContinue()) throw new Error('Drop cancelled');
      if (Date.now() > deadline) throw new Error('Folder scan timed out');
    }
    // Bound a stalled filesystem callback as well as traversal CPU time.
    async function read(operation) {
      checkpoint();
      let timer;
      try {
        const value = await Promise.race([operation(), new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Folder scan timed out')), Math.max(1, deadline - Date.now()));
        })]);
        checkpoint();
        return value;
      } finally { clearTimeout(timer); }
    }
    async function visit(entry, parent, depth, root) {
      checkpoint();
      if (++entries > limits.entries || depth > limits.depth || visited.has(entry)) throw new Error('Folder scan limit exceeded');
      visited.add(entry);
      const name = entry.name;
      if (typeof name !== 'string' || !name || name === '.' || name === '..' || /[\\/\x00-\x1f]/.test(name)) throw new Error('Invalid folder entry');
      if (entry.isDirectory && (name === '.git' || name === 'node_modules')) return;
      const path = parent.concat(name);
      if (entry.isDirectory) {
        if (result.directories.length >= limits.directories) throw new Error('Too many folders');
        result.directories.push({ root, path });
        const reader = entry.createReader();
        // Chromium returns at most 100 entries per call. Keep the same reader
        // and drain every batch, including batches without Markdown files.
        while (true) {
          const batch = await read(() => new Promise((resolve, reject) => reader.readEntries(resolve, reject)));
          if (!batch.length) break;
          for (const child of batch) await visit(child, path, depth + 1, root);
        }
      } else if (entry.isFile && /\.(md|markdown)$/i.test(name)) {
        if (result.files.length >= limits.files) throw new Error('Too many Markdown files');
        const file = await read(() => new Promise((resolve, reject) => entry.file(resolve, reject)));
        if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > limits.fileBytes || bytes + file.size > limits.totalBytes) {
          throw new Error('Folder import size limit exceeded');
        }
        bytes += file.size;
        const content = await read(() => file.text());
        if (content.slice(0, 8000).includes('\0')) throw new Error('Binary Markdown file');
        result.files.push({ root, path, name, content });
      }
    }
    if (snapshot.length > 1000) throw new Error('Too many dropped items');
    for (let root = 0; root < snapshot.length; root++) {
      const entry = snapshot[root].entry;
      if (entry && entry.isDirectory) await visit(entry, [], 0, root);
    }
    checkpoint();
    return result;
  }
  const api = { capture, describe, collectFolders };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else target.MarkdownBrowserDropSource = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
