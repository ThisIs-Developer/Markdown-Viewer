/* Same-origin, offline-capable renderer for confidential shared content.
 * Import all heavy engines lazily. Never fetch raw source or use a remote fallback.
 */
const MAX_SOURCE = 64 * 1024;
const MAX_SVG = 4 * 1024 * 1024;
let d2Engine, graphvizModule, vegaModule, wavedromModule, plantumlModule;
export async function render(engine, source) {
  if (typeof source !== 'string' || new TextEncoder().encode(source).length > MAX_SOURCE)
    throw new Error('This private diagram exceeds the 64 KiB local renderer limit.');
  let svg;
  if (engine === 'plantuml') {
    plantumlModule ||= import('./plantuml/plantuml.js');
    const { renderToString } = await plantumlModule;
    svg = await new Promise((resolve,reject) => renderToString(
      source.split(/\r?\n/), resolve, error => reject(new Error(String(error))),
      { maxSvgSize: 4096 }));
  } else if (engine === 'd2') {
    d2Engine ||= import('./d2/index.js').then(({ D2 }) => new D2());
    const d2 = await d2Engine;
    const result = await d2.compile(source);
    svg = await d2.render(result.diagram, result.renderOptions);
  } else if (engine === 'graphviz') {
    graphvizModule ||= import('./graphviz/index.mjs');
    svg = await (await graphvizModule).render(source);
  } else if (engine === 'vegalite') {
    vegaModule ||= import('./vegalite/index.mjs');
    svg = await (await vegaModule).render(source);
  } else if (engine === 'wavedrom') {
    wavedromModule ||= import('./wavedrom/index.mjs');
    svg = await (await wavedromModule).render(source);
  } else {
    throw new Error('Unknown confidential diagram engine.');
  }
  if (typeof svg !== 'string' || svg.length > MAX_SVG || !/<svg\b/i.test(svg))
    throw new Error('Local diagram returned invalid or oversized SVG.');
  return svg;
}
