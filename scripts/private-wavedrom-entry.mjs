import W from 'wavedrom';
export async function render(source) {
  const spec = JSON.parse(source);
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error('Invalid WaveDrom diagram');
  const tree = W.renderAny(0, spec, W.waveSkin);
  const result = W.onml.stringify(tree);
  if (!result.startsWith('<svg')) throw new Error('WaveDrom did not return SVG');
  return result;
}
