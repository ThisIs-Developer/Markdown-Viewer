const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent } = require('../helpers/app');

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('de-duplicates heading ids and resets slug state for each render', async ({ page }) => {
  await setEditorContent(page, [
    '#### Test',
    'First section',
    '',
    '#### Test',
    'Second section',
    '',
    '#### Test-1',
    'Explicit suffix collision',
    '',
    '#### Test',
    'Third duplicate',
    '',
    '[Second heading](#test-1)'
  ].join('\n'));

  await expect(page.locator('#markdown-preview h4')).toHaveCount(4);
  await expect(page.locator('#markdown-preview h4').first()).toHaveAttribute('id', 'test');
  await expect(page.locator('#markdown-preview h4').nth(1)).toHaveAttribute('id', 'test-1');
  await expect(page.locator('#markdown-preview h4').nth(2)).toHaveAttribute('id', 'test-1-1');
  await expect(page.locator('#markdown-preview h4').nth(3)).toHaveAttribute('id', 'test-2');

  await expect(page.locator('#markdown-preview a[href="#test-1"]')).toHaveAttribute('href', '#test-1');
  await page.locator('#markdown-preview a[href="#test-1"]').click();
  await expect(page.locator('#test-1')).toHaveText('Test');

  await setEditorContent(page, '# Test');
  await expect(page.locator('#markdown-preview h1')).toHaveAttribute('id', 'test');
});

test('preserves Unicode in heading ids and gives empty slugs stable fallbacks', async ({ page }) => {
  await setEditorContent(page, [
    '# 你好 世界',
    '',
    '# Café déjà vu',
    '',
    '# 🎉',
    '',
    '# 🎉',
    '',
    '[Jump to Chinese heading](#你好-世界)'
  ].join('\n'));

  const headings = page.locator('#markdown-preview h1');
  await expect(headings).toHaveCount(4);
  await expect(headings.nth(0)).toHaveAttribute('id', '你好-世界');
  await expect(headings.nth(1)).toHaveAttribute('id', 'café-déjà-vu');
  await expect(headings.nth(2)).toHaveAttribute('id', 'heading');
  await expect(headings.nth(3)).toHaveAttribute('id', 'heading-1');
  await expect(page.locator('#markdown-preview a')).toHaveAttribute(
    'href',
    '#%E4%BD%A0%E5%A5%BD-%E4%B8%96%E7%95%8C'
  );
  await expect(page.locator('#markdown-preview a')).toHaveJSProperty('hash', '#%E4%BD%A0%E5%A5%BD-%E4%B8%96%E7%95%8C');
  await expect.poll(() => page.evaluate(() => {
    const href = document.querySelector('#markdown-preview a').getAttribute('href');
    return Boolean(document.getElementById(decodeURIComponent(href.slice(1))));
  })).toBe(true);
});

test('de-duplicates headings across segmented worker blocks', async ({ page }) => {
  const blocks = ['# Worker duplicate'];
  for (let index = 0; index < 75; index += 1) {
    blocks.push(`Paragraph ${index} ${'worker filler '.repeat(70)}`);
  }
  blocks.splice(40, 0, '# Worker duplicate');

  await setEditorContent(page, blocks.join('\n\n'));

  await expect(page.locator('#markdown-preview .preview-render-block')).not.toHaveCount(0);
  await expect(page.locator('#markdown-preview h1')).toHaveCount(2);
  await expect(page.locator('#markdown-preview h1').first()).toHaveAttribute('id', 'worker-duplicate');
  await expect(page.locator('#markdown-preview h1').last()).toHaveAttribute('id', 'worker-duplicate-1');
});

test('uses full parsing for large documents with cross-block Markdown constructs', async ({ page }) => {
  const filler = Array.from(
    { length: 75 },
    (_, index) => `Paragraph ${index} ${'large document filler '.repeat(45)}`
  ).join('\n\n');

  await setEditorContent(page, [
    '- item one',
    '',
    '  continuation paragraph',
    '',
    '- item two',
    '',
    filler
  ].join('\n'));

  await expect(page.locator('#markdown-preview .preview-render-block')).toHaveCount(0);
  await expect(page.locator('#markdown-preview > ul')).toHaveCount(1);
  await expect(page.locator('#markdown-preview > ul > li')).toHaveCount(2);
  await expect(page.locator('#markdown-preview > ul > li').first()).toContainText('continuation paragraph');

  await setEditorContent(page, [
    '    line one',
    '',
    '    line two',
    '',
    filler
  ].join('\n'));

  await expect(page.locator('#markdown-preview .preview-render-block')).toHaveCount(0);
  await expect(page.locator('#markdown-preview pre code')).toHaveCount(1);
  await expect(page.locator('#markdown-preview pre code')).toHaveText('line one\n\nline two\n');

  await setEditorContent(page, [
    '<!--',
    'hidden first',
    '',
    'hidden second',
    '-->',
    '',
    'Visible content.',
    '',
    filler
  ].join('\n'));

  await expect(page.locator('#markdown-preview .preview-render-block')).toHaveCount(0);
  await expect(page.locator('#markdown-preview')).not.toContainText('hidden first');
  await expect(page.locator('#markdown-preview')).not.toContainText('hidden second');
  await expect(page.locator('#markdown-preview')).toContainText('Visible content.');
});

test('keeps GFM lists separated when the bullet character changes', async ({ page }) => {
  await setEditorContent(page, [
    '- List 1, item 1',
    '- List 1, item 2',
    '* List 2, item 1',
    '',
    '+ Same marker, item 1',
    '+ Same marker, item 2'
  ].join('\n'));

  const lists = page.locator('#markdown-preview > ul');
  await expect(lists).toHaveCount(3);
  await expect(lists.nth(0).locator('li')).toHaveCount(2);
  await expect(lists.nth(1).locator('li')).toHaveCount(1);
  await expect(lists.nth(2).locator('li')).toHaveCount(2);

  const visualSeparation = await lists.evaluateAll(([firstList, secondList]) => {
    const firstRect = firstList.getBoundingClientRect();
    const secondRect = secondList.getBoundingClientRect();
    return {
      gap: secondRect.top - firstRect.bottom,
      fontSize: Number.parseFloat(getComputedStyle(secondList).fontSize)
    };
  });
  expect(visualSeparation.gap).toBeGreaterThanOrEqual(visualSeparation.fontSize * 0.9);
});

test('distinguishes currency, escaped dollars, and valid inline math', async ({ page }) => {
  await setEditorContent(page, [
    'Options ran $20, $45, and $99 for the three tiers.',
    '',
    'Escaped prices cost \\$20, \\$45, and \\$99.',
    '',
    'We spent \\$20 which caused \\$45 of loss and \\$99.',
    '',
    'Before text $x_1^2$ then $x_2^2$ after text.',
    '',
    'A dollar inside math: $\\sqrt{\\$4}$.',
    '',
    'Mixed price and math: $20 plus $x^2$.',
    '',
    'Whitespace is literal: $ not math$ and $not math $.',
    '',
    'Digit adjacency is literal: $x$5.'
  ].join('\n'));

  const paragraphs = page.locator('#markdown-preview > p');
  await expect(paragraphs.nth(0)).toContainText('Options ran $20, $45, and $99 for the three tiers.');
  await expect(paragraphs.nth(0).locator('.math-inline')).toHaveCount(0);
  await expect(paragraphs.nth(0).locator('.math-literal-dollar')).toHaveCount(3);
  await expect(paragraphs.nth(1)).toContainText('Escaped prices cost $20, $45, and $99.');
  await expect(paragraphs.nth(1).locator('.math-inline')).toHaveCount(0);
  await expect(paragraphs.nth(1).locator('.math-literal-dollar')).toHaveCount(3);
  await expect(paragraphs.nth(2)).toContainText('We spent $20 which caused $45 of loss and $99.');
  await expect(paragraphs.nth(2).locator('.math-inline')).toHaveCount(0);
  await expect(paragraphs.nth(2).locator('.math-literal-dollar')).toHaveCount(3);
  await expect(page.locator('#markdown-preview .math-inline')).toHaveCount(4);
  await expect(page.locator('#markdown-preview .math-inline').nth(0)).toHaveText('$x_1^2$');
  await expect(page.locator('#markdown-preview .math-inline').nth(1)).toHaveText('$x_2^2$');
  await expect(page.locator('#markdown-preview .math-inline').nth(2)).toHaveText('$\\sqrt{\\$4}$');
  await expect(page.locator('#markdown-preview .math-inline').nth(3)).toHaveText('$x^2$');
  await expect(paragraphs.nth(5)).toContainText('Mixed price and math: $20 plus');
  await expect(paragraphs.nth(5).locator('.math-literal-dollar')).toHaveCount(1);
});

test('does not transform dollars or footnotes inside code', async ({ page }) => {
  await setEditorContent(page, [
    '~~~md',
    'Options ran \\$20, \\$45, and \\$99.',
    '[^fenced]: must stay code',
    '~~~',
    '',
    'Inline code: `[^inline]: must stay code` and `\\$20`.',
    '',
    'Real note[^note] and repeated note[^note].',
    '',
    '[^note]: Footnote body.',
    '  Continued body.'
  ].join('\n'));

  await expect(page.locator('#markdown-preview pre code')).toHaveText([
    'Options ran \\$20, \\$45, and \\$99.',
    '[^fenced]: must stay code'
  ].join('\n'));
  await expect(page.locator('#markdown-preview p code').nth(0)).toHaveText('[^inline]: must stay code');
  await expect(page.locator('#markdown-preview p code').nth(1)).toHaveText('\\$20');
  await expect(page.locator('#markdown-preview .footnote-ref')).toHaveCount(2);
  await expect(page.locator('#fnref-note')).toHaveText('[1]');
  await expect(page.locator('#fnref-note-2')).toHaveText('[1]');
  await expect(page.locator('#markdown-preview .footnotes')).toContainText('Footnote body.');
  await expect(page.locator('#markdown-preview .footnotes')).toContainText('Continued body.');
});

test('matches footnote labels case-insensitively and links every defined reference', async ({ page }) => {
  await setEditorContent(page, [
    'Undefined[^missing].',
    '',
    'Case reference[^Note].',
    '',
    'Repeated[^repeat] and again[^REPEAT].',
    '',
    'Slug collision[^a!] and another[^a?].',
    '',
    '[^note]: Case-insensitive definition.',
    '[^repeat]: Repeated definition.',
    '[^a!]: First collision definition.',
    '[^a?]: Second collision definition.'
  ].join('\n'));

  await expect(page.locator('#markdown-preview > p').first()).toContainText('Undefined[^missing].');
  await expect(page.locator('#markdown-preview .footnote-ref')).toHaveText(['[1]', '[2]', '[2]', '[3]', '[4]']);
  await expect(page.locator('#markdown-preview .footnotes li')).toHaveCount(4);
  await expect(page.locator('#fn-note')).toContainText('Case-insensitive definition.');
  await expect(page.locator('#fn-repeat')).toContainText('Repeated definition.');
  await expect(page.locator('#fn-a')).toContainText('First collision definition.');
  await expect(page.locator('#fn-a-1')).toContainText('Second collision definition.');

  const repeatedBackrefs = page.locator('#fn-repeat .footnote-backref');
  await expect(repeatedBackrefs).toHaveCount(2);
  await expect(repeatedBackrefs.nth(0)).toHaveAttribute('href', '#fnref-repeat');
  await expect(repeatedBackrefs.nth(1)).toHaveAttribute('href', '#fnref-repeat-2');
  await expect(repeatedBackrefs.nth(1)).toContainText('2');
});

test('supports Markdown Extra multi-term definition lists without changing ordinary prose', async ({ page }) => {
  await setEditorContent(page, [
    '~~~md',
    'Code term A',
    'Code term B',
    ': Must stay literal code',
    '~~~',
    '',
    'Term A',
    'Term B',
    ': Shared definition for both terms above',
    ': Alternate shared definition',
    '',
    'Single term',
    ': Single definition',
    '',
    'Ordinary line A',
    'Ordinary line B'
  ].join('\n'));

  const lists = page.locator('#markdown-preview dl');
  await expect(lists).toHaveCount(2);
  await expect(page.locator('#markdown-preview pre code')).toContainText(': Must stay literal code');
  await expect(lists.nth(0).locator('dt')).toHaveText(['Term A', 'Term B']);
  await expect(lists.nth(0).locator('dd')).toHaveText([
    'Shared definition for both terms above',
    'Alternate shared definition'
  ]);
  await expect(lists.nth(1).locator('dt')).toHaveText(['Single term']);
  await expect(page.locator('#markdown-preview > p').last()).toContainText('Ordinary line A');
  await expect(page.locator('#markdown-preview > p').last()).toContainText('Ordinary line B');
});

test('does not let definition lists preempt GFM and CommonMark block constructs', async ({ page }) => {
  await setEditorContent(page, [
    '1) Ordered item',
    ': lazy continuation in the list',
    '',
    'Setext heading',
    '---',
    ': paragraph after the heading',
    '',
    '***',
    ': paragraph after the thematic break',
    '',
    '    indented code',
    ': paragraph after the code',
    '',
    '[ref]: https://example.com',
    ': paragraph after the reference definition',
    '',
    '[uses ref][ref]',
    '',
    'A | B',
    '--- | ---',
    ': table row'
  ].join('\n'));

  await expect(page.locator('#markdown-preview dl')).toHaveCount(0);
  await expect(page.locator('#markdown-preview ol')).toHaveCount(1);
  await expect(page.locator('#markdown-preview ol')).toContainText(': lazy continuation in the list');
  await expect(page.locator('#markdown-preview h2')).toHaveText('Setext heading');
  await expect(page.locator('#markdown-preview hr')).toHaveCount(1);
  await expect(page.locator('#markdown-preview pre code')).toHaveText('indented code\n');
  await expect(page.locator('#markdown-preview a[href="https://example.com"]')).toHaveText('uses ref');
  await expect(page.locator('#markdown-preview table')).toHaveCount(1);
  await expect(page.locator('#markdown-preview table tbody td').first()).toHaveText(': table row');
});

test('keeps TeX atomic while preserving superscript, subscript, and highlight outside math', async ({ page }) => {
  await setEditorContent(page, [
    'Outside ^two^, ~down~, and ==marked==.',
    '',
    'Before text $x_1^2$ then $x_2^2$ after text.',
    '',
    'Before text $right\\_ascension = 5h35m$ after text.',
    '',
    'Before text $\\left\\{ x \\mid x > 0 \\right\\}$ after text.',
    '',
    '$A_cE\\left\\{-\\dfrac{du(x_1)}{dx},\\ \\dfrac{du(x_2)}{dx}\\right\\}$',
    '',
    'Other delimiters: \\(x^2\\) and \\[y^2\\].',
    '',
    '$$',
    'A_cE\\left\\{-\\dfrac{du(x_1)}{dx},\\ \\dfrac{du(x_2)}{dx}\\right\\}',
    '$$'
  ].join('\n'));

  await expect(page.locator('#markdown-preview')).toContainText('Outside two, down, and marked.');
  await expect(page.locator('#markdown-preview > p sup')).toHaveText('two');
  await expect(page.locator('#markdown-preview > p sub')).toHaveText('down');
  await expect(page.locator('#markdown-preview > p mark')).toHaveText('marked');

  const math = page.locator('#markdown-preview .math-inline');
  await expect(math).toHaveCount(7);
  await expect(math.nth(0)).toHaveText('$x_1^2$');
  await expect(math.nth(1)).toHaveText('$x_2^2$');
  await expect(math.nth(2)).toHaveText('$right\\_ascension = 5h35m$');
  await expect(math.nth(3)).toHaveText('$\\left\\{ x \\mid x > 0 \\right\\}$');
  await expect(math.nth(4)).toHaveText('$A_cE\\left\\{-\\dfrac{du(x_1)}{dx},\\ \\dfrac{du(x_2)}{dx}\\right\\}$');
  await expect(math.nth(5)).toHaveText('\\(x^2\\)');
  await expect(math.nth(6)).toHaveText('\\[y^2\\]');
  await expect(page.locator('#markdown-preview .math-block')).toContainText('A_cE\\left\\{');
});

test('scopes legacy MathJax color syntax without changing standard switches or sanitization', async ({ page }) => {
  await setEditorContent(page, [
    '$\\color{red}{v\\^2} \\color{blue}{G}M\\left(\\color{green}{\\frac{2}{r}} - \\color{purple}{\\frac{1}{a}}\\right)$',
    '',
    '${\\color{red}v^2} + \\textcolor{blue}{G}M$',
    '',
    '$\\color{red}{outer \\color{blue}{inner} outer} + z$',
    '',
    '$\\color{orange} x + y$',
    '',
    '$$',
    '\\color{teal}{A_{nested}}',
    '$$',
    '',
    '```math',
    '\\color{brown}{B^2}',
    '```',
    '',
    '$x <svg onload="window.__mathXss = true"></svg> y$',
    '',
    'Safe note[^safe].',
    '',
    '[^safe]: <img src="x" onerror="window.__footnoteXss = true"> body'
  ].join('\n'));

  const math = page.locator('#markdown-preview .math-inline');
  await expect(math).toHaveCount(5);
  await expect(math.nth(0)).toContainText('${\\color{red}v^2} {\\color{blue}G}M\\left({\\color{green}\\frac{2}{r}} - {\\color{purple}\\frac{1}{a}}\\right)$');
  await expect(math.nth(0)).not.toContainText('\\^');
  await expect(math.nth(1)).toContainText('{\\color{red}v^2}');
  await expect(math.nth(2)).toContainText('${\\color{red}outer {\\color{blue}inner} outer} + z$');
  await expect(math.nth(3)).toContainText('$\\color{orange} x + y$');
  const mathBlocks = page.locator('#markdown-preview .math-block');
  await expect(mathBlocks).toHaveCount(2);
  await expect(mathBlocks.nth(0)).toContainText('{\\color{teal}A_{nested}}');
  await expect(mathBlocks.nth(1)).toContainText('{\\color{brown}B^2}');
  await expect(page.locator('#markdown-preview svg')).toHaveCount(0);
  await expect(page.locator('#markdown-preview [onload], #markdown-preview [onerror]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => ({ math: window.__mathXss, note: window.__footnoteXss }))).toEqual({
    math: undefined,
    note: undefined
  });
});
