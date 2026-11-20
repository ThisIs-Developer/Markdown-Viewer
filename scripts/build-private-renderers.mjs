import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { build } from 'esbuild';

const out = 'assets/secure-renderers';
const copy = (source, relative) => {
  const dest = join(out, relative);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(join('node_modules', source), dest);
};

for (const [source, dest] of [
  ['mermaid/dist/mermaid.min.js','libs/mermaid.min.js'],
  ['mathjax/tex-mml-chtml.js','libs/tex-mml-chtml.js'],
  ['mathjax/tex-svg.js','libs/tex-svg.js'],
  ['abcjs/dist/abcjs-basic-min.js','libs/abcjs-basic-min.js'],
  ['markmap-lib/dist/browser/index.iife.js','libs/markmap-lib.iife.js'],
  ['markmap-view/dist/browser/index.js','libs/markmap-view.js'],
  ['d3/dist/d3.min.js','libs/d3.min.js'],
  ['pako/dist/pako.min.js','libs/pako.min.js'],
  ['leaflet/dist/leaflet.css','libs/leaflet.css'],
  ['leaflet/dist/images/marker-icon.png','libs/images/marker-icon.png'],
  ['leaflet/dist/images/marker-icon-2x.png','libs/images/marker-icon-2x.png'],
  ['leaflet/dist/images/marker-shadow.png','libs/images/marker-shadow.png'],
  ['leaflet/dist/leaflet.js','libs/leaflet.js'],
  ['topojson-client/dist/topojson-client.min.js','libs/topojson.min.js'],
  ['three/build/three.min.js','libs/three.min.js'],
  ['three/examples/js/loaders/STLLoader.js','libs/STLLoader.js'],
  ['three/examples/js/controls/OrbitControls.js','libs/OrbitControls.js'],
  ['@plantuml/core/plantuml.js','plantuml/plantuml.js'],
  ['@plantuml/core/viz-global.js','plantuml/viz-global.js'],
  ['@plantuml/core/emoji.js','plantuml/emoji.js'],
  ['@plantuml/core/openiconic.js','plantuml/openiconic.js'],
  ['@plantuml/core/themes.js','plantuml/themes.js'],
  ['@d2lang/d2/dist/browser/index.js','d2/index.js']
]) copy(source, dest);

for (const [source, dest] of [
  ['scripts/private-graphviz-entry.mjs','graphviz/index.mjs'],
  ['scripts/private-vega-entry.mjs','vegalite/index.mjs'],
  ['scripts/private-wavedrom-entry.mjs','wavedrom/index.mjs']
]) {
  mkdirSync(dirname(join(out,dest)),{ recursive:true });
  await build({ entryPoints:[source], outfile: join(out,dest), bundle:true, format:'esm',
    platform:'browser', target:'es2022', minify:true, legalComments:'external' });
}
copyFileSync('scripts/private-renderer-entry.mjs', join(out,'private-renderer.mjs'));
// Keep exact library legal texts alongside privately loaded renderer assets.
for (const [src,dst] of [
  ['mermaid/LICENSE','libs/MERMAID-LICENSE.txt'],
  ['mathjax/LICENSE','libs/MATHJAX-LICENSE.txt'],
  ['abcjs/LICENSE.md','libs/ABCJS-LICENSE.txt'],
  ['markmap-lib/LICENSE','libs/MARKMAP-LIB-LICENSE.txt'],
  ['markmap-view/LICENSE','libs/MARKMAP-VIEW-LICENSE.txt'],
  ['d3/LICENSE','libs/D3-LICENSE.txt'],
  ['pako/LICENSE','libs/PAKO-LICENSE.txt'],
  ['leaflet/LICENSE','libs/LEAFLET-LICENSE.txt'],
  ['topojson-client/LICENSE','libs/TOPOJSON-LICENSE.txt'],
  ['three/LICENSE','libs/THREE-LICENSE.txt'],
  ['katex/LICENSE','libs/KATEX-LICENSE.txt'],
  ['@plantuml/core/LICENSE','plantuml/LICENSE.txt'],
  ['@d2lang/d2/LICENSE.txt','d2/LICENSE.txt'],
  ['@hpcc-js/wasm-graphviz/LICENSE','graphviz/LICENSE.txt'],
  ['vega/LICENSE','vegalite/VEGA-LICENSE.txt'],
  ['vega-lite/LICENSE','vegalite/VEGA-LITE-LICENSE.txt'],
  ['wavedrom/LICENSE','wavedrom/LICENSE.txt']
]) copy(src,dst);
console.log('Private same-origin renderer bundles are ready.');
