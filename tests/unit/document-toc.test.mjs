import test from 'node:test';
import assert from 'node:assert/strict';
import { Marked, marked } from 'marked';
import { createHeadingExtension, createHeadingSlugger, extractHeadings, generateTableOfContents } from '../../src/document-toc.mjs';

const toc = (markdown, options = {}) => generateTableOfContents(markdown, { lexer: marked.lexer, ...options });
const headings = markdown => extractHeadings(markdown, { lexer: marked.lexer });

test('defaults to H2–H4 and preserves hierarchy; accepts an AST without mutating it', () => {
  const ast = marked.lexer('# Title\n## Introduction\n### Background\n#### Goals\n##### Detail\n###### Note\n## Usage');
  const original = structuredClone(ast);
  assert.equal(generateTableOfContents(ast), '- [Introduction](#introduction)\n  - [Background](#background)\n    - [Goals](#goals)\n- [Usage](#usage)');
  assert.deepEqual(structuredClone(ast), original);
});

test('supports the full H1–H6 range and an explicit single level', () => {
  const markdown = '# Title\n## Two\n### Three\n#### Four\n##### Five\n###### Six';
  assert.equal(toc(markdown, { minLevel: 1, maxLevel: 6 }), '- [Title](#title)\n  - [Two](#two)\n    - [Three](#three)\n      - [Four](#four)\n        - [Five](#five)\n          - [Six](#six)');
  assert.equal(toc(markdown, { minLevel: 6, maxLevel: 6 }), '- [Six](#six)');
});

test('extracts visible text from formatting, links, code, HTML and entities', () => {
  const markdown = '## **Mixed** *Case* `Code` [Link](https://example.com) ~~Old~~ <em>HTML</em> &amp; More!';
  assert.deepEqual(headings(markdown), [{ level: 2, text: 'Mixed Case Code Link Old HTML & More!', slug: 'mixed-case-code-link-old-html--more' }]);
  assert.equal(toc(markdown), '- [Mixed Case Code Link Old HTML \\& More!](#mixed-case-code-link-old-html--more)');
});

test('keeps literal code contents, escaped punctuation and reference link labels', () => {
  const markdown = '## `*a* &amp; <tag>` \\*literal\\* [Docs][ref]\n\n[ref]: https://example.com';
  assert.equal(headings(markdown)[0].text, '*a* &amp; <tag> *literal* Docs');
  assert.equal(toc(markdown), '- [\\*a\\* \\&amp; \\<tag\\> \\*literal\\* Docs](#a-amp-tag-literal-docs)');
});

test('GitHub slugs retain underscores and repeated hyphens while stripping punctuation', () => {
  assert.deepEqual(headings('## Hello, World!\n## API: v2.0 & Tips\n## foo_bar\n## foo - bar').map(h => h.slug), ['hello-world', 'api-v20--tips', 'foo_bar', 'foo---bar']);
});

test('duplicates count in document order before filtering and reset for every document', () => {
  const markdown = '# Overview\n## Overview\n### Overview\n##### Overview\n## Overview';
  const expected = '- [Overview](#overview-1)\n  - [Overview](#overview-2)\n- [Overview](#overview-4)';
  assert.equal(toc(markdown), expected);
  assert.equal(toc(markdown), expected);
  assert.equal(toc('## Overview'), '- [Overview](#overview)');
});

test('duplicate suffixes cannot collide with explicitly numbered headings', () => {
  assert.deepEqual(headings('## echo\n## echo\n## echo 1\n## echo-1\n## echo\n## foxtrot-1\n## foxtrot\n## foxtrot').map(h => h.slug),
    ['echo', 'echo-1', 'echo-1-1', 'echo-1-2', 'echo-2', 'foxtrot-1', 'foxtrot', 'foxtrot-2']);
});

test('ignores backtick and tilde fences, indented code and fake inline headings', () => {
  const markdown = ['## Real', '', '```md', '## Hidden', '```', '', '~~~md', '## Also hidden', '~~~', '', '    ## Indented code', '', '`## Inline code`', '', '### Use `code`'].join('\n');
  assert.equal(toc(markdown), '- [Real](#real)\n  - [Use code](#use-code)');
});

test('YAML title and multiline front matter never become headings', () => {
  for (const end of ['---', '...']) {
    const markdown = '\uFEFF---\r\ntitle: Example\r\ndescription: |\r\n  ## Metadata\r\n' + end + '\r\n# Example\r\n## Overview';
    assert.equal(toc(markdown), '- [Overview](#overview)');
  }
  assert.equal(toc('---\n## A real heading\n---\n## Another'), '- [A real heading](#a-real-heading)\n- [Another](#another)');
});

test('walks blockquote/list AST headings and setext headings without inspecting raw HTML blocks', () => {
  const markdown = 'Intro\n=====\n\nOverview\n--------\n\n> ### Quoted\n\n- #### Nested\n\n<pre>\n## Hidden\n</pre>\n\n<h2>HTML block</h2>';
  assert.equal(toc(markdown), '- [Overview](#overview)\n  - [Quoted](#quoted)\n    - [Nested](#nested)');
});

test('numbered mode counts siblings and restarts child counters under each parent', () => {
  const markdown = '## Intro\n### Background\n#### Goals\n#### Scope\n### Audience\n## Usage\n### Setup';
  const result = toc(markdown, { format: 'numbered' });
  assert.equal(result, '1. [Intro](#intro)  \n  1.1 [Background](#background)  \n    1.1.1 [Goals](#goals)  \n    1.1.2 [Scope](#scope)  \n  1.2 [Audience](#audience)  \n2. [Usage](#usage)  \n  2.1 [Setup](#setup)');
  assert.equal((marked.parse(result).match(/<br>/g) || []).length, 5);
});

test('plain mode contains only unescaped, indented display text, even with wrapper selected', () => {
  assert.equal(toc('## A & B\n### `[*]`\n## Next', { format: 'plain', collapsible: true }), 'A & B\n  [*]\nNext');
});

test('preserves Unicode and emoji display text with GitHub-compatible fragments', () => {
  // GitHub strips the emoji, not the space following it (leading hyphen remains).
  // Verified against GitHub's rendered outline, not just the slugger library:
  // https://github.com/assafelovic/gpt-researcher#-contributing
  // https://github.com/abedhraiz/how_to/blob/main/GETTING_STARTED.md#-your-first-30-days
  assert.equal(createHeadingSlugger().slug('🚀 Contributing'), '-contributing');
  assert.equal(createHeadingSlugger().slug('🚀 Your First 30 Days'), '-your-first-30-days');
  assert.equal(toc('## 🚀 Getting Started\n## 🚀 Getting Started\n## Привет 你好\n## Café'), '- [🚀 Getting Started](#-getting-started)\n- [🚀 Getting Started](#-getting-started-1)\n- [Привет 你好](#привет-你好)\n- [Café](#café)');
});

test('symbol-only headings receive usable, distinct fallback targets', () => {
  assert.deepEqual(headings('## !!!\n## ???\n## 🚀\n## heading\n## - -').map(h => h.slug), ['heading', 'heading-1', 'heading-2', 'heading-3', 'heading-4']);
});

test('skipped levels retain their actual indentation unless normalized', () => {
  const markdown = '## Parent\n#### Child\n### Sibling\n#### Grandchild\n## Next';
  assert.equal(toc(markdown), '- [Parent](#parent)\n    - [Child](#child)\n  - [Sibling](#sibling)\n    - [Grandchild](#grandchild)\n- [Next](#next)');
  assert.equal(toc(markdown, { normalizeLevels: true }), '- [Parent](#parent)\n  - [Child](#child)\n  - [Sibling](#sibling)\n    - [Grandchild](#grandchild)\n- [Next](#next)');
});

test('optional details wrapper keeps blank lines needed to render its Markdown list', () => {
  assert.equal(toc('## Intro', { collapsible: true }), '<details>\n<summary>Table of Contents</summary>\n\n- [Intro](#intro)\n\n</details>');
});

test('empty documents and ranges without headings return an empty string, including with wrapper', () => {
  for (const markdown of ['', 'Only prose', '# Title only', '```md\n## Example\n```']) {
    assert.equal(toc(markdown, { collapsible: true }), '');
  }
  assert.equal(generateTableOfContents([]), '');
});

test('Table of Contents is included when it is a heading in the selected range', () => {
  assert.equal(toc('## Table of Contents\n- [Overview](#overview)\n\n## Overview'), '- [Table of Contents](#table-of-contents)\n- [Overview](#overview)');
});

test('long headings stay on one Markdown link line and escape label syntax', () => {
  const title = 'A very long heading '.repeat(30) + '[brackets]';
  const result = toc('## ' + title);
  assert.equal(result.split('\n').length, 1);
  assert.ok(result.startsWith('- [A very long heading '));
  assert.ok(result.includes('\\[brackets\\]](#'));
});

test('slug strategy is replaceable without losing duplicate handling', () => {
  assert.equal(toc('## One\n## One', { slugStrategy: text => 'custom-' + text.toLowerCase() }), '- [One](#custom-one)\n- [One](#custom-one-1)');
  assert.throws(() => toc('## One', { slugStrategy: 'unknown' }), /slug strategy/);
});

test('rejects invalid ranges and output modes', () => {
  for (const options of [{ minLevel: 0 }, { maxLevel: 7 }, { minLevel: 5, maxLevel: 2 }, { minLevel: 2.5 }, { format: 'unknown' }]) {
    assert.throws(() => toc('## Heading', options), RangeError);
  }
});

test('preview heading extension uses the same targets as copied TOCs', () => {
  const slugger = createHeadingSlugger();
  const parser = new Marked({ extensions: [createHeadingExtension(slugger)], hooks: { preprocess(source) { slugger.reset(); return source; } } });
  const markdown = '# Overview\n## Overview\n## 🚀 Getting Started\n## `*foo*` &amp; <b>Bar</b>\n## !!!';
  const expected = headings(markdown).map(h => h.slug);
  for (let document = 0; document < 2; document++) {
    const html = parser.parse(markdown);
    assert.deepEqual([...html.matchAll(/<h\d id="([^"]+)"/g)].map(match => match[1]), expected);
  }
});
