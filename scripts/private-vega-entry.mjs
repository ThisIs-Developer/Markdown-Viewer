import * as vega from 'vega';
import * as lite from 'vega-lite';
import { expressionInterpreter } from 'vega-interpreter';
export async function render(source) {
  const spec = JSON.parse(source);
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error('Invalid Vega-Lite specification');
  // Disallow all references to remote data, image assets, hyperlinks, and arbitrary URLs.
  const stack = [spec];
  let count = 0;
  while (stack.length) {
    if (++count > 20000) throw new Error('Vega-Lite specification is too complex');
    const current = stack.pop();
    if (Array.isArray(current)) { stack.push(...current); continue; }
    if (current && typeof current === 'object') {
      for (const [key, value] of Object.entries(current)) {
        if (/^(?:url|href|src|image)$/i.test(key)) throw new Error('External Vega-Lite resources are prohibited in private documents');
        if (typeof value === 'object' && value !== null) stack.push(value);
      }
    }
  }
  const compiled = lite.compile(spec);
  const loader = vega.loader();
  loader.load = async () => { throw new Error('External Vega-Lite data is prohibited in private documents'); };
  const runtime = vega.parse(compiled.spec, null, { ast: true });
  const view = new vega.View(runtime, { renderer: 'none', loader,
    expr: expressionInterpreter, logLevel: vega.Warn });
  try { return await view.toSVG(); }
  finally { view.finalize(); }
}
