/* global importScripts, marked, hljs */

let librariesLoaded = false;
let markedConfigured = false;
let mermaidIdCounter = 0;

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

const BLOCK_MATH_MARKER_PATTERN = /^\$\$/m;
const BLOCK_MATH_PATTERN = /^\$\$[ \t]*\n?([\s\S]*?)\n?\$\$[ \t]*(?:\n|$)/;
const DEFINITION_LIST_ITEM_PATTERN = /^:[ \t]+(.*)$/;
const SUPERSCRIPT_PATTERN = /^\^(?!\s)([^^\n]*?\S)\^(?!\^)/;
const SUBSCRIPT_PATTERN = /^~(?!~)(?!\s)([^~\n]*?\S)~(?!~)/;
const HIGHLIGHT_PATTERN = /^==(?=\S)([\s\S]*?\S)==/;
const MARKDOWN_LIST_MARKER_PATTERN = /^(\s*)(?:[-*+]\s+|\d+\.\s+|>\s+)/;
const EMPTY_LINE_PATTERN = /^\s*$/;

let suppressFootnotePreprocess = false;
const footnoteDefinitions = new Map();
const footnoteOrder = [];
const footnoteRefCounts = new Map();
const footnoteFirstRefId = new Map();
let anonymousFootnoteCounter = 0;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHtmlAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

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
  if (normalized) return normalized;
  anonymousFootnoteCounter += 1;
  return `footnote-${anonymousFootnoteCounter}`;
}

function parseInlineWithoutFootnotes(text) {
  suppressFootnotePreprocess = true;
  try {
    return marked.parseInline(text);
  } finally {
    suppressFootnotePreprocess = false;
  }
}

function renderDefinitionContent(content, options) {
  const appendHtml = options && options.appendHtml ? options.appendHtml : "";
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
    .map((paragraph) => `<p>${parseInlineWithoutFootnotes(paragraph)}</p>`)
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
      if (!line.startsWith(baseIndent)) break;
      const lineAfterBase = line.slice(baseIndent.length);
      const indentedMatch = /^(?: {2,}|\t)(.*)$/.exec(lineAfterBase);
      if (indentedMatch) {
        definitionLines.push(indentedMatch[1]);
        index += 1;
        continue;
      }
      if (lineAfterBase.trim() === "") {
        const nextLine = lines[index + 1] || "";
        const nextAfterBase = nextLine.startsWith(baseIndent) ? nextLine.slice(baseIndent.length) : "";
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
    if (!id) return match;
    if (!footnoteOrder.includes(id)) footnoteOrder.push(id);

    const refCount = (footnoteRefCounts.get(id) || 0) + 1;
    footnoteRefCounts.set(id, refCount);

    const normalizedId = normalizeFootnoteId(id);
    const refId = `fnref-${normalizedId}${refCount > 1 ? `-${refCount}` : ""}`;
    if (!footnoteFirstRefId.has(id)) footnoteFirstRefId.set(id, refId);

    const noteNumber = footnoteOrder.indexOf(id) + 1;
    return `<sup id="${escapeHtmlAttribute(refId)}" class="footnote-ref"><a href="#fn-${escapeHtmlAttribute(normalizedId)}" aria-label="Footnote ${noteNumber}">[${noteNumber}]</a></sup>`;
  });

  const footnotesHtml = footnoteOrder
    .filter((id) => footnoteDefinitions.has(id))
    .map((id) => {
      const normalizedId = normalizeFootnoteId(id);
      const backRefId = footnoteFirstRefId.get(id) || `fnref-${normalizedId}`;
      const backRefHtml = `<a href="#${escapeHtmlAttribute(backRefId)}" class="footnote-backref" aria-label="Back to content">&#8592;</a>`;
      const noteHtml = renderDefinitionContent(footnoteDefinitions.get(id) || "", { appendHtml: backRefHtml });
      return `<li id="fn-${escapeHtmlAttribute(normalizedId)}">${noteHtml}</li>`;
    })
    .join("");

  if (!footnotesHtml) return markdownWithReferences;
  return `${markdownWithReferences}\n\n<section class="footnotes"><hr><ol>${footnotesHtml}</ol></section>`;
}

function configureMarked() {
  if (markedConfigured) return;

  const renderer = new marked.Renderer();
  const blockMathExtension = {
    name: "blockMath",
    level: "block",
    start(src) {
      const match = src.match(BLOCK_MATH_MARKER_PATTERN);
      return match ? match.index : undefined;
    },
    tokenizer(src) {
      const match = BLOCK_MATH_PATTERN.exec(src);
      if (!match) return undefined;
      return { type: "blockMath", raw: match[0], text: match[1] };
    },
    renderer(token) {
      return `<div class="math-block">$$\n${token.text}\n$$</div>\n`;
    },
  };

  const definitionListExtension = {
    name: "definitionList",
    level: "block",
    start(src) {
      const match = src.match(/\n:[ \t]+/);
      return match ? match.index + 1 : undefined;
    },
    tokenizer(src) {
      const lines = src.split("\n");
      if (lines.length < 2) return undefined;

      const term = lines[0];
      if (EMPTY_LINE_PATTERN.test(term) || MARKDOWN_LIST_MARKER_PATTERN.test(term)) return undefined;
      if (!DEFINITION_LIST_ITEM_PATTERN.test(lines[1])) return undefined;

      const definitions = [];
      const rawLines = [term];
      let index = 1;
      while (index < lines.length) {
        const itemMatch = DEFINITION_LIST_ITEM_PATTERN.exec(lines[index]);
        if (!itemMatch) break;

        rawLines.push(lines[index]);
        const definitionLines = [itemMatch[1]];
        index += 1;

        while (index < lines.length) {
          const line = lines[index];
          if (DEFINITION_LIST_ITEM_PATTERN.test(line)) break;
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
          if (!continuationMatch) break;
          rawLines.push(line);
          definitionLines.push(continuationMatch[1]);
          index += 1;
        }

        definitions.push(definitionLines.join("\n").trim());
      }

      if (definitions.length === 0) return undefined;
      let raw = rawLines.join("\n");
      if (src.startsWith(raw + "\n")) raw += "\n";
      return { type: "definitionList", raw, term: term.trim(), definitions };
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
      return match ? { type: "superscript", raw: match[0], text: match[1] } : undefined;
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
      return match ? { type: "subscript", raw: match[0], text: match[1] } : undefined;
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
      return match ? { type: "highlight", raw: match[0], text: match[1] } : undefined;
    },
    renderer(token) {
      return `<mark>${marked.parseInline(token.text)}</mark>`;
    },
  };

  renderer.code = function(code, language) {
    if (language === "mermaid") {
      const uniqueId = `mermaid-diagram-worker-${mermaidIdCounter++}`;
      return `<div class="mermaid-container is-loading"><div class="mermaid" id="${uniqueId}" data-original-code="${encodeURIComponent(code)}">${escapeHtml(code)}</div></div>`;
    }

    const validLanguage = hljs && hljs.getLanguage(language) ? language : "plaintext";
    const highlightedCode = hljs
      ? hljs.highlight(code, { language: validLanguage }).value
      : escapeHtml(code);
    return `<pre><code class="hljs ${escapeHtmlAttribute(validLanguage)}">${highlightedCode}</code></pre>`;
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
        if (suppressFootnotePreprocess) return markdown;
        resetExtendedMarkdownState();
        const protectedMarkdown = markdown.replace(/\\\$/g, "&#36;");
        return applyFootnotes(extractFootnoteDefinitions(protectedMarkdown));
      },
    },
  });

  marked.setOptions(Object.assign({}, markedOptions, { renderer }));
  markedConfigured = true;
}

function ensureLibraries(urls) {
  if (!librariesLoaded) {
    const scripts = [];
    if (urls.marked) scripts.push(urls.marked);
    if (urls.highlight) scripts.push(urls.highlight);
    if (urls.purify) scripts.push(urls.purify);
    if (scripts.length > 0) {
      importScripts(...scripts);
    }
    librariesLoaded = true;
  }
  configureMarked();
}

function isSegmentedPreviewSafe(markdown) {
  if (/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.test(markdown)) return false;
  if (/^\[[^\]\n]+\]:\s+\S+/m.test(markdown)) return false;
  if (/\[\^[^\]\n]+\]/.test(markdown)) return false;
  if (/\n:[ \t]+/.test(markdown)) return false;
  if (/^\s{0,3}<\/?[a-zA-Z][\w:-]*(?:\s|>|\/>)/m.test(markdown)) return false;
  return true;
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function splitMarkdownBlocks(markdown) {
  const normalized = String(markdown || "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const blocks = [];
  let buffer = [];
  let startLine = 1;
  let inFence = false;
  let fenceChar = "";
  let fenceLength = 0;
  let inMathBlock = false;

  function flush(endLine) {
    const source = buffer.join("\n").trimEnd();
    if (source.trim()) {
      blocks.push({
        source,
        startLine,
        endLine,
      });
    }
    buffer = [];
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    const trimmed = line.trim();

    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!inFence) {
        inFence = true;
        fenceChar = marker[0];
        fenceLength = marker.length;
      } else if (marker[0] === fenceChar && marker.length >= fenceLength) {
        inFence = false;
      }
    }

    if (!inFence && trimmed === "$$") {
      inMathBlock = !inMathBlock;
    }

    if (!inFence && !inMathBlock && trimmed === "") {
      flush(lineNumber);
      startLine = lineNumber + 1;
      continue;
    }

    if (buffer.length === 0) startLine = lineNumber;
    buffer.push(line);
  }

  flush(lines.length);
  return blocks;
}

function renderSegmentedMarkdown(markdown, options) {
  if (!isSegmentedPreviewSafe(markdown)) {
    return { mode: "full-required", reason: "unsafe-markdown" };
  }

  const blocks = splitMarkdownBlocks(markdown);
  if (blocks.length < (options.minimumBlocks || 1)) {
    return { mode: "full-required", reason: "too-few-blocks" };
  }

  const seenHashes = new Map();
  const renderedBlocks = blocks.map((block) => {
    const hash = hashString(block.source);
    const seenCount = seenHashes.get(hash) || 0;
    seenHashes.set(hash, seenCount + 1);
    const html = marked.parse(block.source);
    return {
      id: `preview-block-${hash}-${seenCount}`,
      hash,
      html,
      htmlLength: html.length,
      sourceLength: block.source.length,
      startLine: block.startLine,
      endLine: block.endLine,
    };
  });

  return {
    mode: "segmented",
    blocks: renderedBlocks,
    blockCount: renderedBlocks.length,
  };
}

self.onmessage = function(event) {
  const data = event.data || {};
  if (data.type === "render-full") {
    try {
      const options = data.options || {};
      ensureLibraries(options.libraryUrls || {});
      mermaidIdCounter = 0;
      const html = marked.parse(data.markdown || "");
      let sanitized = html;
      if (typeof DOMPurify !== "undefined") {
        sanitized = DOMPurify.sanitize(html, {
          ADD_TAGS: ['mjx-container', 'svg', 'path', 'g', 'marker', 'defs', 'pattern', 'clipPath', 'input'],
          ADD_ATTR: ['id', 'class', 'style', 'align', 'viewBox', 'd', 'fill', 'stroke', 'transform', 'marker-end', 'marker-start', 'type', 'checked', 'disabled', 'data-original-code']
        });
      }
      self.postMessage({
        type: "render-full-result",
        requestId: data.requestId,
        html: sanitized
      });
    } catch (error) {
      self.postMessage({
        type: "render-full-error",
        requestId: data.requestId,
        error: error && error.message ? error.message : "Full worker render failed."
      });
    }
    return;
  }

  if (data.type !== "render") return;

  try {
    const options = data.options || {};
    ensureLibraries(options.libraryUrls || {});
    mermaidIdCounter = 0;
    const result = renderSegmentedMarkdown(data.markdown || "", options);
    self.postMessage({
      type: "render-result",
      requestId: data.requestId,
      result,
    });
  } catch (error) {
    self.postMessage({
      type: "render-error",
      requestId: data.requestId,
      error: error && error.message ? error.message : "Preview worker render failed.",
    });
  }
};
