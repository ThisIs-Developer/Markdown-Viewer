import { build } from 'esbuild';
import { mkdir, readFile, writeFile, copyFile, readdir, stat, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { lockNetwork } from '../private-renderer-network.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));
const out = path.resolve(repository, 'assets/private-renderers');
// This is exclusively generated output. Verify the absolute deletion boundary.
if (path.dirname(out) !== path.resolve(repository, 'assets')) throw new Error('Invalid generated asset directory');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const bundles = [], moduleFiles = {};
const engines = {
  viz: "import * as value from '@viz-js/viz';",
  mermaid: "import * as value from 'mermaid';",
  abc: "import * as value from 'abcjs';",
  vega: "import * as vega from 'vega'; import * as vl from 'vega-lite'; import * as interpreter from 'vega-interpreter'; const value = {vega,vl,interpreter};",
  wavedrom: "import WaveDrom from 'wavedrom'; import JSON5 from 'json5'; const value = {WaveDrom,JSON5};",
  markmap: "import {Transformer} from 'markmap-lib'; import {Markmap} from 'markmap-view'; const value = {Transformer,Markmap};",
  geo: "import L from 'leaflet'; import {feature} from 'topojson-client'; const value = {L,feature};",
  stl: "import * as THREE from 'three'; import {STLLoader} from 'three/examples/jsm/loaders/STLLoader.js'; import {SVGRenderer} from 'three/examples/jsm/renderers/SVGRenderer.js'; const value = {THREE,STLLoader,SVGRenderer};"
};
async function writeEngine(name, code) {
  const hash = createHash('sha256').update(code).digest('hex').slice(0,12);
  const file = `engines/${name}-${hash}.js`;
  await mkdir(path.dirname(out+'/'+file), { recursive: true });
  await writeFile(out+'/'+file,code);
  moduleFiles[name] = file;
}
for (const [name, contents] of Object.entries(engines)) {
  const bundle = await build({ stdin: { contents: contents + `globalThis.MarkdownRendererModules.${name}=value;`, resolveDir: repository },
    bundle: true, format: 'iife', platform: 'browser', minify: true, legalComments: 'inline', write: false, metafile: true, logLevel: 'warning' });
  bundles.push(bundle);
  await writeEngine(name,bundle.outputFiles[0].contents);
}
// TeaVM's generated labels must be preserved. Wrap the pinned module verbatim,
// changing only its single export statement into the sandbox's local registry.
const plantuml = await readFile('node_modules/@plantuml/core/plantuml.js','utf8');
const plantExport = 'export{C as render,D as renderToString};';
if (!plantuml.endsWith(plantExport) || plantuml.indexOf(plantExport) !== plantuml.lastIndexOf(plantExport)) throw Error('Review updated PlantUML exports');
await writeEngine('plantuml','(()=>{'+plantuml.slice(0,-plantExport.length)+'globalThis.MarkdownRendererModules.plantuml={render:C,renderToString:D};})();');

const runtimeBundle = await build({ entryPoints: ['private-renderer-runtime.js'], bundle: true, format: 'iife', platform: 'browser',
  write: false, minify: true, metafile: true, define: { PRIVATE_MODULE_FILES: JSON.stringify(moduleFiles) } });
bundles.push(runtimeBundle);
const bootstrap = runtimeBundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const bootstrapHash = createHash('sha256').update(bootstrap).digest('base64');
// D2 creates a nested Blob worker. Lock its network APIs before the Go runtime
// starts, including on native servers without response-header configuration.
const d2Marker = 'new Blob([zf,Tf],{type:"text/javascript;charset=utf-8"})';
bundles.push(await build({ entryPoints: ['private-d2-worker.js'], bundle: true, splitting: true, format: 'esm', platform: 'browser',
  outdir: out, entryNames: 'd2-worker', chunkNames: '[name]-[hash]', minify: true, legalComments: 'linked', metafile: true,
  plugins: [{ name: 'd2-disable-network', setup(builder) {
    builder.onLoad({ filter: /@d2lang[\\/]d2[\\/]dist[\\/]browser[\\/]index\.js$/ }, async args => {
      const source = await readFile(args.path,'utf8');
      if (source.split(d2Marker).length !== 2) throw Error('Review updated D2 worker creation');
      const prelude = JSON.stringify('('+lockNetwork.toString()+')();\n');
      return { contents: source.replace(d2Marker,`new Blob([${prelude},zf,Tf],{type:"text/javascript;charset=utf-8"})`), loader: 'js' };
    });
  } }] }));
const policy = "default-src 'none'; script-src 'sha256-" + bootstrapHash + "' 'strict-dynamic' 'wasm-unsafe-eval'; worker-src 'none'; connect-src 'none'; " +
  "style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'";
await writeFile(out + '/frame.html', '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + policy +
  '"><style>body{margin:0;font:16px Arial}#surface{width:960px;min-height:600px}</style></head><body><div id="surface"></div>' +
  '<script>' + bootstrap + '</script></body></html>\n');
async function copyTree(from, to) {
  await mkdir(to, { recursive: true });
  for (const item of await readdir(from, { withFileTypes: true })) {
    if (item.isDirectory()) await copyTree(path.join(from,item.name), path.join(to,item.name));
    else if (/\.(js|woff2?|json)$/.test(item.name)) await copyFile(path.join(from,item.name),path.join(to,item.name));
  }
}
await mkdir(out + '/plantuml', { recursive: true });
for (const name of ['themes.js','emoji.js','openiconic.js']) await copyFile('node_modules/@plantuml/core/'+name,out+'/plantuml/'+name);
// The private renderer always boots TeX -> SVG. Other complete MathJax
// startup bundles duplicate megabytes and are never loaded by this runtime.
await mkdir(out + '/mathjax', { recursive: true });
await copyFile('node_modules/mathjax/tex-svg.js',out+'/mathjax/tex-svg.js');
for (const name of ['input','output','a11y','sre','ui']) await copyTree('node_modules/mathjax/'+name,out+'/mathjax/'+name);
await copyTree('node_modules/mathjax-modern-font/svg',out+'/mathjax/output/fonts/mathjax-modern/svg');
await copyFile('node_modules/mathjax-modern-font/svg.js',out+'/mathjax/output/fonts/mathjax-modern/svg.js');
const packages = ['@plantuml/core','@viz-js/viz','@d2lang/d2','mermaid','vega','vega-lite','vega-interpreter',
  'wavedrom','json5','markmap-lib','markmap-view','d3','abcjs','leaflet','topojson-client','three','mathjax','mathjax-modern-font'];
const packageRoots = new Set(packages.map(name => 'node_modules/' + name));
for (const input of bundles.flatMap(bundle => Object.keys(bundle.metafile.inputs))) {
  const match = input.replaceAll('\\', '/').match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//);
  if (match) packageRoots.add(match[1]);
}
const licenses = [];
for (const base of [...packageRoots].sort()) {
  const pkg=JSON.parse(await readFile(base+'/package.json','utf8'));
  licenses.push(pkg.name+' '+pkg.version+' ('+pkg.license+')');
  for(const f of await readdir(base)) if (/^(license|copying|third.party.notices)(\.|$)/i.test(f)) licenses.push(await readFile(base+'/'+f,'utf8'));
}
await writeFile(out+'/LICENSES.txt',licenses.join('\n\n'));
let files = 0, bytes = 0;
async function check(directory) {
  for(const item of await readdir(directory,{withFileTypes:true})) {
    const file=path.join(directory,item.name);
    if(item.isDirectory()) await check(file);
    else { const size=(await stat(file)).size; if(size>25*1024*1024) throw Error('Cloudflare Pages asset too large: '+file); files++;bytes+=size; }
  }
}
await check(out);
console.log(`Private renderers: ${files} files, ${(bytes/1024/1024).toFixed(1)} MiB; all assets below 25 MiB.`);
