import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyAssembly } from '../../docker/verify-assembly.mjs';

const mediaType = 'application/vnd.oci.image.index.v1+json';
const source = arch => ({ mediaType, manifests: [
  { digest: `image-${arch}`, size: 100, platform: { os: 'linux', architecture: arch } },
  { digest: `attestation-${arch}`, size: 200, platform: { os: 'unknown', architecture: 'unknown' },
    annotations: { 'vnd.docker.reference.type': 'attestation-manifest',
      'vnd.docker.reference.digest': `image-${arch}` } }
] });
const sources = [source('amd64'), source('arm64')];
const combined = { mediaType, manifests: sources.flatMap(s => s.manifests) };

test('combines the exact tested images and attestations regardless of order', () => {
  verifyAssembly({ ...combined, manifests: [...combined.manifests].reverse() }, sources);
});
test('rejects missing, substituted or extra manifests and missing architectures', () => {
  for (const manifests of [combined.manifests.slice(1),
    [...combined.manifests, combined.manifests[0]],
    combined.manifests.map((m, i) => i === 0 ? { ...m, digest: 'untested-image' } : m)]) {
    assert.throws(() => verifyAssembly({ ...combined, manifests }, sources));
  }
  assert.throws(() => verifyAssembly(source('amd64'), [source('amd64')]));
});
test('requires an attestation linked to each tested platform', () => {
  const broken = sources.map(s => ({ ...s, manifests: s.manifests.slice(0, 1) }));
  assert.throws(() => verifyAssembly({ mediaType, manifests: broken.flatMap(s => s.manifests) }, broken));
});

