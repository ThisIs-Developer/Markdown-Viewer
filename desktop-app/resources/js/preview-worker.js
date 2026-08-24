/* global importScripts, marked, hljs */

let librariesLoaded = false;
let markedConfigured = false;
let mermaidIdCounter = 0;
let abcIdCounter = 0;
let geojsonIdCounter = 0;
let topojsonIdCounter = 0;
let stlIdCounter = 0;
let plantumlIdCounter = 0;
let d2IdCounter = 0;
let graphvizIdCounter = 0;
let krokiIdCounter = 0;

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
const INLINE_MATH_START_PATTERN = /\\(?:\$|\(|\[)|\$/;
const DEFINITION_LIST_ITEM_PATTERN = /^:[ \t]+(.*)$/;
const SUPERSCRIPT_PATTERN = /^\^(?!\s)([^^\n]*?\S)\^(?!\^)/;
const SUBSCRIPT_PATTERN = /^~(?!~)(?!\s)([^~\n]*?\S)~(?!~)/;
const HIGHLIGHT_PATTERN = /^==(?=\S)([\s\S]*?\S)==/;
const MARKDOWN_LIST_MARKER_PATTERN = /^(\s*)(?:[-*+]\s+|\d+\.\s+|>\s+)/;
const DEFINITION_LIST_DISALLOWED_TERM_PATTERN = /^[ \t]{0,3}(?:`{3,}|~{3,}|#{1,6}(?:[ \t]+|$)|<\/?[a-zA-Z][\w:-]*(?:\s|>|\/>))/;
const EMPTY_LINE_PATTERN = /^\s*$/;

let suppressFootnotePreprocess = false;
let preserveExtendedMarkdownState = false;
const footnoteDefinitions = new Map();
const footnoteOrder = [];
const footnoteRefCounts = new Map();
const footnoteFirstRefId = new Map();
const usedHeadingIds = new Set();
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
  usedHeadingIds.clear();
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

function renderFootnotesSection() {
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

  return footnotesHtml
    ? `<section class="footnotes"><hr><ol>${footnotesHtml}</ol></section>`
    : "";
}

function isEscapedCharacter(source, index) {
  let backslashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) {
    backslashCount += 1;
  }
  return backslashCount % 2 === 1;
}

function findClosingMathDelimiter(source, delimiter, startIndex) {
  for (let index = startIndex; index <= source.length - delimiter.length; index += 1) {
    if (source[index] === "\n") return -1;
    if (source.startsWith(delimiter, index) && !isEscapedCharacter(source, index)) return index;
  }
  return -1;
}

function tokenizeDollarMath(source) {
  if (source.startsWith("$$")) {
    const closeIndex = findClosingMathDelimiter(source, "$$", 2);
    if (closeIndex > 2) {
      return { type: "inlineMath", raw: source.slice(0, closeIndex + 2), display: true };
    }
    return null;
  }
  if (source[0] !== "$" || !source[1] || /[\s$]/.test(source[1])) return null;
  for (let index = 1; index < source.length; index += 1) {
    if (source[index] === "\n") break;
    if (source[index] !== "$" || isEscapedCharacter(source, index)) continue;
    if (/\s/.test(source[index - 1]) || /\d/.test(source[index + 1] || "")) return null;
    return { type: "inlineMath", raw: source.slice(0, index + 1), display: false };
  }
  return null;
}

function createUniqueHeadingId(raw) {
  const baseId = String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-') || 'heading';
  let id = baseId;
  let suffix = 0;
  while (usedHeadingIds.has(id)) {
    suffix += 1;
    id = `${baseId}-${suffix}`;
  }
  usedHeadingIds.add(id);
  return id;
}

function normalizeWorkerMarkmapFences(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const output = [];
  let index = 0;

  while (index < lines.length) {
    const opening = lines[index].match(/^([ \t]{0,3})(`{3,}|~{3,})([ \t]*)(.*)$/);
    const info = opening ? opening[4].trim() : '';
    if (!opening || !/^markmap(?:\s|$)/i.test(info)) {
      output.push(lines[index]);
      index += 1;
      continue;
    }

    const indent = opening[1];
    const fence = opening[2];
    const marker = fence[0];
    const content = [];
    let nestedFence = null;
    let maxInnerFenceLength = fence.length;
    let closeIndex = -1;

    for (let scan = index + 1; scan < lines.length; scan += 1) {
      const line = lines[scan];
      const fenceMatch = line.match(/^[ \t]{0,3}(`{3,}|~{3,})([ \t]*.*)$/);
      if (fenceMatch) {
        const currentFence = fenceMatch[1];
        const currentMarker = currentFence[0];
        const tail = fenceMatch[2].trim();
        if (currentMarker === marker) {
          maxInnerFenceLength = Math.max(maxInnerFenceLength, currentFence.length);
        }
        if (nestedFence) {
          if (currentMarker === nestedFence.marker && currentFence.length >= nestedFence.length && tail === '') {
            nestedFence = null;
          }
        } else if (currentMarker === marker && currentFence.length >= fence.length && tail === '') {
          closeIndex = scan;
          break;
        } else if (tail !== '') {
          nestedFence = { marker: currentMarker, length: currentFence.length };
        }
      }
      content.push(line);
    }

    if (closeIndex === -1) {
      output.push(lines[index]);
      index += 1;
      continue;
    }

    const normalizedFence = marker.repeat(maxInnerFenceLength + 1);
    output.push(`${indent}${normalizedFence}${opening[3]}${opening[4]}`);
    output.push(...content);
    output.push(`${indent}${normalizedFence}`);
    index = closeIndex + 1;
  }

  return output.join('\n');
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
      return `<div class="math-block tex2jax_process">$$\n${escapeHtml(token.text)}\n$$</div>\n`;
    },
  };

  const footnoteDefinitionExtension = {
    name: "footnoteDefinition",
    level: "block",
    start(src) {
      const match = src.match(/(?:^|\n)[ \t]{0,3}\[\^[^\]\n]+\]:/);
      if (!match) return undefined;
      return match.index + (match[0][0] === "\n" ? 1 : 0);
    },
    tokenizer(src) {
      if (suppressFootnotePreprocess) return undefined;
      const lines = src.split("\n");
      const match = /^([ \t]{0,3})\[\^([^\]\n]+)\]:[ \t]*(.*)$/.exec(lines[0]);
      if (!match) return undefined;
      const baseIndent = match[1] || "";
      const id = match[2].trim();
      const definitionLines = [match[3] || ""];
      const rawLines = [lines[0]];
      let index = 1;
      while (index < lines.length) {
        const line = lines[index];
        if (!line.startsWith(baseIndent)) break;
        const lineAfterBase = line.slice(baseIndent.length);
        const indentedMatch = /^(?: {2,}|\t)(.*)$/.exec(lineAfterBase);
        if (indentedMatch) {
          rawLines.push(line);
          definitionLines.push(indentedMatch[1]);
          index += 1;
          continue;
        }
        if (lineAfterBase.trim() === "") {
          const nextLine = lines[index + 1] || "";
          const nextAfterBase = nextLine.startsWith(baseIndent) ? nextLine.slice(baseIndent.length) : "";
          if (/^(?: {2,}|\t)/.test(nextAfterBase)) {
            rawLines.push(line);
            definitionLines.push("");
            index += 1;
            continue;
          }
        }
        break;
      }
      let raw = rawLines.join("\n");
      if (src.startsWith(raw + "\n")) raw += "\n";
      footnoteDefinitions.set(id, definitionLines.join("\n").trim());
      return { type: "footnoteDefinition", raw };
    },
    renderer() {
      return "";
    },
  };

  const footnoteReferenceExtension = {
    name: "footnoteReference",
    level: "inline",
    start(src) {
      if (suppressFootnotePreprocess) return undefined;
      const index = src.indexOf("[^");
      return index >= 0 ? index : undefined;
    },
    tokenizer(src) {
      if (suppressFootnotePreprocess) return undefined;
      const match = /^\[\^([^\]\n]+)\]/.exec(src);
      if (!match) return undefined;
      return { type: "footnoteReference", raw: match[0], id: match[1].trim() };
    },
    renderer(token) {
      const id = token.id;
      if (!id) return token.raw;
      if (!footnoteOrder.includes(id)) footnoteOrder.push(id);
      const refCount = (footnoteRefCounts.get(id) || 0) + 1;
      footnoteRefCounts.set(id, refCount);
      const normalizedId = normalizeFootnoteId(id);
      const refId = `fnref-${normalizedId}${refCount > 1 ? `-${refCount}` : ""}`;
      if (!footnoteFirstRefId.has(id)) footnoteFirstRefId.set(id, refId);
      const noteNumber = footnoteOrder.indexOf(id) + 1;
      return `<sup id="${escapeHtmlAttribute(refId)}" class="footnote-ref"><a href="#fn-${escapeHtmlAttribute(normalizedId)}" aria-label="Footnote ${noteNumber}">[${noteNumber}]</a></sup>`;
    },
  };

  const inlineMathExtension = {
    name: "inlineMath",
    level: "inline",
    start(src) {
      const match = INLINE_MATH_START_PATTERN.exec(src);
      return match ? match.index : undefined;
    },
    tokenizer(src) {
      if (src.startsWith("\\$")) return { type: "inlineMath", raw: "\\$", literalDollar: true };
      if (src.startsWith("\\(") || src.startsWith("\\[")) {
        const opening = src.slice(0, 2);
        const closing = opening === "\\(" ? "\\)" : "\\]";
        const closeIndex = findClosingMathDelimiter(src, closing, 2);
        if (closeIndex >= 2) {
          return {
            type: "inlineMath",
            raw: src.slice(0, closeIndex + 2),
            display: opening === "\\[",
          };
        }
        return undefined;
      }
      if (src[0] !== "$" || isEscapedCharacter(src, 0)) return undefined;
      const mathToken = tokenizeDollarMath(src);
      return mathToken || { type: "inlineMath", raw: "$", literalDollar: true };
    },
    renderer(token) {
      if (token.literalDollar) return '<span class="math-literal-dollar tex2jax_ignore">&#36;</span>';
      const displayClass = token.display ? ' math-display-inline' : '';
      return `<span class="math-inline tex2jax_process${displayClass}">${escapeHtml(token.raw)}</span>`;
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

      const terms = [];
      const rawLines = [];
      let index = 0;
      while (index < lines.length && !DEFINITION_LIST_ITEM_PATTERN.test(lines[index])) {
        const term = lines[index];
        if (
          EMPTY_LINE_PATTERN.test(term) ||
          MARKDOWN_LIST_MARKER_PATTERN.test(term) ||
          DEFINITION_LIST_DISALLOWED_TERM_PATTERN.test(term)
        ) return undefined;
        terms.push(term.trim());
        rawLines.push(term);
        index += 1;
      }
      if (terms.length === 0 || index >= lines.length) return undefined;
      const definitions = [];
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
      return { type: "definitionList", raw, terms, definitions };
    },
    renderer(token) {
      const termHtml = token.terms
        .map((term) => `<dt>${parseInlineWithoutFootnotes(term)}</dt>`)
        .join("");
      const definitionHtml = token.definitions
        .map((definition) => `<dd>${renderDefinitionContent(definition)}</dd>`)
        .join("");
      return `<dl>${termHtml}${definitionHtml}</dl>\n`;
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
      return `<sup>${parseInlineWithoutFootnotes(token.text)}</sup>`;
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
      return `<sub>${parseInlineWithoutFootnotes(token.text)}</sub>`;
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
      return `<mark>${parseInlineWithoutFootnotes(token.text)}</mark>`;
    },
  };

  function renderDiagramShell(engine, containerClass, surfaceClass, uniqueId, code, label) {
    return `<div class="diagram-viewer ${containerClass} is-loading" data-diagram-engine="${engine}">` +
      `<div class="diagram-status" role="status"><span class="diagram-status-spinner" aria-hidden="true"></span>` +
      `<span>Rendering ${label}…</span></div>` +
      `<div class="diagram-surface ${surfaceClass}" id="${uniqueId}" data-original-code="${encodeURIComponent(code)}">${escapeHtml(code)}</div>` +
      `</div>`;
  }

  renderer.code = function(code, language) {
    if (language === "mermaid") {
      const uniqueId = `mermaid-diagram-worker-${mermaidIdCounter++}`;
      return renderDiagramShell('mermaid', 'mermaid-container', 'mermaid', uniqueId, code, 'Mermaid');
    }

    if (language === "abc") {
      const uniqueId = `abc-notation-worker-${abcIdCounter++}`;
      return renderDiagramShell('abc', 'abc-container', 'abc-notation', uniqueId, code, 'ABC notation');
    }

    if (language === "geojson") {
      const uniqueId = `geojson-map-worker-${geojsonIdCounter++}`;
      return `<div class="geojson-container is-loading"><div class="geojson-map" id="${uniqueId}" data-original-code="${encodeURIComponent(code)}">${escapeHtml(code)}</div></div>`;
    }

    if (language === "topojson") {
      const uniqueId = `topojson-map-worker-${topojsonIdCounter++}`;
      return `<div class="topojson-container is-loading"><div class="topojson-map" id="${uniqueId}" data-original-code="${encodeURIComponent(code)}">${escapeHtml(code)}</div></div>`;
    }

    if (language === "stl") {
      const uniqueId = `stl-viewer-worker-${stlIdCounter++}`;
      return `<div class="stl-container is-loading"><div class="stl-viewer" id="${uniqueId}" data-original-code="${encodeURIComponent(code)}">${escapeHtml(code)}</div></div>`;
    }

    if (language === "plantuml") {
      const uniqueId = `plantuml-diagram-worker-${plantumlIdCounter++}`;
      return renderDiagramShell('plantuml', 'plantuml-container', 'plantuml-diagram', uniqueId, code, 'PlantUML');
    }

    if (language === "d2") {
      const uniqueId = `d2-diagram-worker-${d2IdCounter++}`;
      return renderDiagramShell('d2', 'd2-container', 'd2-diagram', uniqueId, code, 'D2');
    }

    if (language === "graphviz" || language === "dot") {
      const uniqueId = `graphviz-diagram-worker-${graphvizIdCounter++}`;
      return renderDiagramShell('graphviz', 'graphviz-container', 'graphviz-diagram', uniqueId, code, 'Graphviz');
    }

    const krokiLanguages = {
      'vega-lite': ['vegalite', 'Vega-Lite'],
      vegalite: ['vegalite', 'Vega-Lite'],
      wavedrom: ['wavedrom', 'WaveDrom']
    };
    if (krokiLanguages[language]) {
      const [engine, label] = krokiLanguages[language];
      const uniqueId = `${engine}-diagram-worker-${krokiIdCounter++}`;
      return renderDiagramShell(engine, 'kroki-container', 'kroki-diagram', uniqueId, code, label);
    }
    if (language === 'markmap') {
      const uniqueId = `markmap-diagram-worker-${krokiIdCounter++}`;
      return renderDiagramShell('markmap', 'markmap-container', 'markmap-diagram', uniqueId, code, 'Markmap');
    }

    if (language === "math") {
      return `<div class="math-block">$$\n${code}\n$$</div>\n`;
    }

    const validLanguage = hljs && hljs.getLanguage(language) ? language : "plaintext";
    const highlightedCode = hljs
      ? hljs.highlight(code, { language: validLanguage }).value
      : escapeHtml(code);
    return `<pre><code class="hljs ${escapeHtmlAttribute(validLanguage)}">${highlightedCode}</code></pre>`;
  };

  renderer.heading = function(text, level, raw) {
    const id = createUniqueHeadingId(raw);
    return `<h${level} id="${id}">${text}</h${level}>`;
  };

  function normalizeMarkmapFences(markdown) {
    const lines = String(markdown || '').split(/\r?\n/);
    const output = [];
    let index = 0;

    while (index < lines.length) {
      const opening = lines[index].match(/^([ \t]{0,3})(`{3,}|~{3,})([ \t]*)(.*)$/);
      const info = opening ? opening[4].trim() : '';
      if (!opening || !/^markmap(?:\s|$)/i.test(info)) {
        output.push(lines[index]);
        index += 1;
        continue;
      }

      const indent = opening[1];
      const fence = opening[2];
      const marker = fence[0];
      const content = [];
      let nestedFence = null;
      let maxInnerFenceLength = fence.length;
      let closeIndex = -1;

      for (let scan = index + 1; scan < lines.length; scan += 1) {
        const line = lines[scan];
        const fenceMatch = line.match(/^[ \t]{0,3}(`{3,}|~{3,})([ \t]*.*)$/);
        if (fenceMatch) {
          const currentFence = fenceMatch[1];
          const currentMarker = currentFence[0];
          const tail = fenceMatch[2].trim();
          if (currentMarker === marker) {
            maxInnerFenceLength = Math.max(maxInnerFenceLength, currentFence.length);
          }

          if (nestedFence) {
            if (currentMarker === nestedFence.marker && currentFence.length >= nestedFence.length && tail === '') {
              nestedFence = null;
            }
          } else if (currentMarker === marker && currentFence.length >= fence.length && tail === '') {
            closeIndex = scan;
            break;
          } else if (tail !== '') {
            nestedFence = {
              marker: currentMarker,
              length: currentFence.length
            };
          }
        }
        content.push(line);
      }

      if (closeIndex === -1) {
        output.push(lines[index]);
        index += 1;
        continue;
      }

      const normalizedFence = marker.repeat(maxInnerFenceLength + 1);
      output.push(`${indent}${normalizedFence}${opening[3]}${opening[4]}`);
      output.push(...content);
      output.push(`${indent}${normalizedFence}`);
      index = closeIndex + 1;
    }

    return output.join('\n');
  }

  marked.use({
    extensions: [
      blockMathExtension,
      footnoteDefinitionExtension,
      definitionListExtension,
      inlineMathExtension,
      footnoteReferenceExtension,
      superscriptExtension,
      subscriptExtension,
      highlightExtension,
    ],
    hooks: {
      preprocess(markdown) {
        if (suppressFootnotePreprocess) return markdown;
        if (!preserveExtendedMarkdownState) resetExtendedMarkdownState();
        return normalizeMarkmapFences(markdown);
      },
      postprocess(html) {
        if (suppressFootnotePreprocess) return html;
        return html + renderFootnotesSection();
      },
    },
  });

  marked.setOptions(Object.assign({}, markedOptions, { renderer }));
  markedConfigured = true;
}

function ensureLibraries(urls) {
  if (!librariesLoaded) {
    importScripts(urls.marked, urls.highlight);
    if (urls.powershell) {
      importScripts(urls.powershell);
    }
    librariesLoaded = true;
  }
  configureMarked();
}

function isSegmentedPreviewSafe(markdown) {
  if (/^\s*---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.test(markdown)) return false;
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
  const normalizedMarkdown = normalizeWorkerMarkmapFences(markdown);
  if (!isSegmentedPreviewSafe(normalizedMarkdown)) {
    return { mode: "full-required", reason: "unsafe-markdown" };
  }

  const blocks = splitMarkdownBlocks(normalizedMarkdown);
  if (blocks.length < (options.minimumBlocks || 1)) {
    return { mode: "full-required", reason: "too-few-blocks" };
  }

  const seenHashes = new Map();
  resetExtendedMarkdownState();
  preserveExtendedMarkdownState = true;
  let renderedBlocks;
  try {
    renderedBlocks = blocks.map((block) => {
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
  } finally {
    preserveExtendedMarkdownState = false;
  }

  return {
    mode: "segmented",
    blocks: renderedBlocks,
    blockCount: renderedBlocks.length,
  };
}

self.onmessage = function(event) {
  const data = event.data || {};
  if (data.type !== "render") return;

  try {
    const options = data.options || {};
    ensureLibraries(options.libraryUrls || {});
    mermaidIdCounter = 0;
    abcIdCounter = 0;
    geojsonIdCounter = 0;
    topojsonIdCounter = 0;
    stlIdCounter = 0;
    plantumlIdCounter = 0;
    d2IdCounter = 0;
    graphvizIdCounter = 0;
    krokiIdCounter = 0;
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
