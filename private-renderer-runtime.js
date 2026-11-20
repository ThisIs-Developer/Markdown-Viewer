// Loaded only inside the opaque-origin renderer frame. No share keys enter here.
const surface = document.getElementById('surface');
const serializeSvg = node => new XMLSerializer().serializeToString(node);
// Classic scripts work in an opaque iframe on native/static servers without
// CORS headers. Only these build-generated, fixed asset paths may be loaded.
const runtimeUrl = document.baseURI;
// WebKit treats 'self' as the opaque origin in sandboxed frames. A hashed
// bootstrap is trusted by the document CSP; this additional policy restricts
// every script it loads to this exact local asset directory on any host.
const localScripts = document.createElement('meta');
localScripts.httpEquiv = 'Content-Security-Policy';
localScripts.content = "script-src " + new URL('./', runtimeUrl).href + " 'wasm-unsafe-eval'";
document.head.appendChild(localScripts);
globalThis.MarkdownRendererModules = Object.create(null);
const imports = new Map();
const script = name => {
  if (!imports.has(name)) imports.set(name, new Promise((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = new URL(name, runtimeUrl).href;
    tag.onload = resolve; tag.onerror = () => reject(new Error('Local renderer asset unavailable.'));
    document.head.appendChild(tag);
  }));
  return imports.get(name);
};
async function loadModule(name) {
  const file = PRIVATE_MODULE_FILES[name];
  if (!file) throw new Error('Unsupported local renderer.');
  await script(file);
  return globalThis.MarkdownRendererModules[name];
}
let viz, mathReady;
async function render(engine, source, options) {
  surface.replaceChildren();
  if (engine === 'graphviz' || engine === 'plantuml') {
    const Viz = await loadModule('viz');
    viz ||= await Viz.instance();
    if (engine === 'graphviz') return viz.renderString(source, { format: 'svg' });
    globalThis.PLANTUML_VIZ = Viz;
    globalThis.PLANTUML_STDLIB_LOADER = (name, ok, err) => {
      if (!['themes.js', 'emoji.js', 'openiconic.js'].includes(name)) { err('This include is not bundled for local rendering.'); return true; }
      script('plantuml/' + name).then(ok, err); return true;
    };
    const plantuml = await loadModule('plantuml');
    return new Promise((resolve, reject) => plantuml.renderToString(source.split(/\r\n|\r|\n/), resolve,
      error => reject(new Error(String(error))), { dark: !!options.dark, maxSvgSize: 8192 }));
  }
  if (engine === 'mermaid') {
    const { default: mermaid } = await loadModule('mermaid');
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: options.dark ? 'dark' : 'default',
      flowchart: { htmlLabels: false }, maxTextSize: 200000 });
    return (await mermaid.render('private-mermaid', source, surface)).svg;
  }
  if (engine === 'vegalite') {
    const { vega, vl, interpreter } = await loadModule('vega');
    const spec = vl.compile(JSON.parse(source)).spec;
    let blocked = false;
    const loader = { load: async () => { blocked = true; throw new Error('Use inline chart data in encrypted shares.'); },
      sanitize: async () => { blocked = true; throw new Error('External chart resources are disabled.'); } };
    const view = new vega.View(vega.parse(spec, null, { ast: true }), {
      expr: interpreter.expressionInterpreter, renderer: 'none', loader
    });
    try {
      await view.runAsync(); const svg = await view.toSVG();
      if (blocked) throw new Error('Use inline chart data and images in encrypted shares.');
      return svg;
    } finally { view.finalize(); }
  }
  if (engine === 'wavedrom') {
    const { WaveDrom, JSON5 } = await loadModule('wavedrom');
    return WaveDrom.onml.stringify(WaveDrom.renderAny(0, JSON5.parse(source), WaveDrom.waveSkin));
  }
  if (engine === 'markmap') {
    const { Transformer, Markmap } = await loadModule('markmap');
    // No getUsedAssets/loadJS: document-controlled plugins cannot load code.
    const { root } = new Transformer().transform(source);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '960'); svg.setAttribute('height', '600'); surface.append(svg);
    const map = Markmap.create(svg, { duration: 0, zoom: false, pan: false }, root);
    try { await map.setData(root); await map.fit(); return serializeSvg(svg); } finally { map.destroy(); }
  }
  if (engine === 'abc') {
    const { default: ABCJS } = await loadModule('abc');
    ABCJS.renderAbc(surface, source, { responsive: 'resize' });
    const svg = surface.querySelector('svg');
    if (!svg) throw new Error('Invalid ABC notation.');
    return serializeSvg(svg);
  }
  if (engine === 'geojson' || engine === 'topojson') {
    const { L, feature } = await loadModule('geo');
    let data = JSON.parse(source);
    if (engine === 'topojson') {
      data = { type: 'FeatureCollection', features: Object.values(data.objects).flatMap(object => {
        const value = feature(data, object); return value.type === 'FeatureCollection' ? value.features : [value];
      }) };
    }
    // Vector geometry is projected locally; no tile requests reveal coordinates.
    surface.style.height = '600px';
    const map = L.map(surface, { zoomControl: false, attributionControl: false, zoomAnimation: false, fadeAnimation: false });
    try {
      const layer = L.geoJSON(data, { pointToLayer: (_feature, latlng) => L.circleMarker(latlng, { radius: 7 }) }).addTo(map);
      const bounds = layer.getBounds();
      if (!bounds.isValid()) throw new Error('No map coordinates found.');
      map.fitBounds(bounds, { padding: [25, 25], maxZoom: 18, animate: false });
      const svg = surface.querySelector('svg');
      if (!svg) throw new Error('No vector geometry found.');
      return serializeSvg(svg);
    } finally { map.remove(); }
  }
  if (engine === 'stl') {
    const { THREE, STLLoader, SVGRenderer } = await loadModule('stl');
    if (!/^\s*solid\b/.test(source)) throw new Error('Use inline STL data in encrypted shares.');
    const geometry = new STLLoader().parse(source);
    geometry.computeBoundingBox(); geometry.center(); geometry.computeVertexNormals();
    const size = geometry.boundingBox.getSize(new THREE.Vector3()).length() || 1;
    const scene = new THREE.Scene();
    const material = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
    scene.add(new THREE.Mesh(geometry, material));
    const camera = new THREE.PerspectiveCamera(40, 1.6, size / 1000, size * 100);
    camera.position.set(size, size * .7, size); camera.lookAt(0, 0, 0);
    const renderer = new SVGRenderer(); renderer.setSize(960, 600); renderer.render(scene, camera);
    const svg = serializeSvg(renderer.domElement); geometry.dispose(); material.dispose(); return svg;
  }
  if (engine === 'math') {
    mathReady ||= (async () => {
      globalThis.MathJax = { loader: { paths: { mathjax: new URL('mathjax', runtimeUrl).href,
        'mathjax-modern': new URL('mathjax/output/fonts/mathjax-modern', runtimeUrl).href }, load: ['ui/safe'] },
        startup: { typeset: false }, svg: { fontCache: 'none' }, options: { enableMenu: false,
          safeOptions: { allow: { URLs: 'none', classes: 'none', cssIDs: 'none', styles: 'none' } } } };
      await script('mathjax/tex-svg.js'); await MathJax.startup.promise;
    })();
    await mathReady;
    const container = await MathJax.tex2svgPromise(source, { display: !!options.display });
    return serializeSvg(container.querySelector('svg'));
  }
  throw new Error('Unsupported local renderer.');
}
let queue = Promise.resolve();
addEventListener('message', event => {
  if (event.source !== parent || event.data?.channel !== 'private-renderer') return;
  const { id, engine, source, options = {} } = event.data;
  if (!Number.isSafeInteger(id) || typeof source !== 'string' || source.length > 8 * 1024 * 1024) return;
  queue = queue.then(async () => {
    try { parent.postMessage({ channel: 'private-renderer', id, svg: await render(engine, source, options) }, '*'); }
    catch (error) { parent.postMessage({ channel: 'private-renderer', id, error: String(error.message || error).slice(0,300) }, '*'); }
  });
});
parent.postMessage({ channel: 'private-renderer', ready: true }, '*');
