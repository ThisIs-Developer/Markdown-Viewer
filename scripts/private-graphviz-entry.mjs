import { Graphviz } from '@hpcc-js/wasm-graphviz';
let loader;
export async function render(source) {
  loader ||= Graphviz.load();
  const engine = await loader;
  return engine.dot(source);
}
