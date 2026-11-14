// Shared bounded reader for desktop launch, link, reload, import and Save.
// Loading this module does not request native permissions or change web behavior.
(function(target) {
  'use strict';
  const maxBytes = 20 * 1024 * 1024;
  function assertContent(content) {
    if (typeof content !== 'string' || new TextEncoder().encode(content).byteLength > maxBytes) {
      throw new Error('Markdown content exceeds the 20 MiB desktop file limit. Existing drafts were kept.');
    }
    return content;
  }
  async function read(filesystem, path, knownStats) {
    function checkStats(stats) {
      if (!stats || stats.isDirectory || stats.isFile === false || !Number.isSafeInteger(stats.size) || stats.size < 0) {
        throw new Error('Could not safely determine the Markdown file size/type. Nothing was changed.');
      }
      if (stats.size > maxBytes) throw new Error('Markdown file exceeds the 20 MiB desktop file limit. Existing drafts were kept.');
    }
    checkStats(knownStats || await filesystem.getStats(path));
    const content = await filesystem.readFile(path, { size: maxBytes + 1 });
    // Check growth even when a decoder removes a BOM or replaces partial UTF-8.
    checkStats(await filesystem.getStats(path));
    return assertContent(content);
  }
  async function readBinary(filesystem, path, limit) {
    if (!Number.isSafeInteger(limit) || limit < 0 || limit > 25 * 1024 * 1024) {
      throw new Error('Invalid native media size limit.');
    }
    function checkStats(stats) {
      if (!stats || stats.isDirectory || stats.isFile === false ||
          !Number.isSafeInteger(stats.size) || stats.size < 0 || stats.size > limit) {
        throw new Error('The dropped media file cannot be read safely or exceeds its size limit.');
      }
    }
    checkStats(await filesystem.getStats(path));
    const content = await filesystem.readBinaryFile(path, { size: limit + 1 });
    checkStats(await filesystem.getStats(path));
    if (!(content instanceof ArrayBuffer) || content.byteLength > limit) {
      throw new Error('The dropped media file cannot be read safely or exceeds its size limit.');
    }
    return content;
  }
  target.MarkdownNativeSourceReader = Object.freeze({ maxBytes, assertContent, read, readBinary });
})(globalThis);
