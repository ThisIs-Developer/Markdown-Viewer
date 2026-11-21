import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function verifyAssembly(combined, sources) {
  assert.equal(combined.mediaType, 'application/vnd.oci.image.index.v1+json');
  const expected = sources.flatMap(source => {
    assert.equal(source.mediaType, combined.mediaType);
    assert.ok(Array.isArray(source.manifests));
    return source.manifests;
  });
  const sort = manifests => [...manifests].sort((a, b) => a.digest.localeCompare(b.digest));
  assert.deepEqual(sort(combined.manifests), sort(expected),
    'Assembly changed or omitted tested manifests/attestations');
  const platforms = combined.manifests.filter(m => m.platform?.os === 'linux')
    .map(m => `${m.platform.os}/${m.platform.architecture}`).sort();
  assert.deepEqual(platforms, ['linux/amd64', 'linux/arm64'],
    'Exactly one tested AMD64 and ARM64 image is required');
  for (const manifest of combined.manifests.filter(m => m.platform?.os === 'linux')) {
    assert.ok(combined.manifests.some(m =>
      m.annotations?.['vnd.docker.reference.type'] === 'attestation-manifest' &&
      m.annotations?.['vnd.docker.reference.digest'] === manifest.digest),
    'Missing attestation for a tested platform');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [combined, ...sources] = process.argv.slice(2).map(file => JSON.parse(fs.readFileSync(file)));
  assert.equal(sources.length, 2, 'Supply combined index and both tested source indexes');
  verifyAssembly(combined, sources);
  console.log('PASS: combined index preserves both tested platforms and their attestations');
}

