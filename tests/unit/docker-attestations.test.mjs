import test from 'node:test';
import assert from 'node:assert/strict';
import { verifySbom, verifyProvenance } from '../../docker/verify-attestations.mjs';

const inventory = { spdxVersion: 'SPDX-2.3', packages: [{ name: 'nginx', versionInfo: '1.31.9' }] };
const provenance = { buildType: 'https://mobyproject.org/buildkit@v1' };

test('checks each requested architecture instead of accepting the other platform', () => {
  const sbom = { 'linux/amd64': { SPDX: inventory }, 'linux/arm64': { SPDX: inventory } };
  const attestations = { 'linux/amd64': { SLSA: provenance }, 'linux/arm64': { SLSA: provenance } };
  for (const platform of ['linux/amd64', 'linux/arm64']) {
    verifySbom(sbom, '1.31.9', platform);
    verifyProvenance(attestations, platform);
  }
  assert.throws(() => verifySbom({ 'linux/amd64': sbom['linux/amd64'] }, '1.31.9', 'linux/arm64'));
  assert.throws(() => verifyProvenance({ 'linux/amd64': attestations['linux/amd64'] }, 'linux/arm64'));
});

test('accepts Syft, single-platform Buildx and multi-platform Buildx inventory', () => {
  for (const value of [inventory, { SPDX: inventory }, { 'linux/amd64': { SPDX: inventory } }]) {
    assert.equal(verifySbom(value, '1.31.9'), inventory);
  }
});

test('rejects missing inventory, wrong platform, missing NGINX and stale version', () => {
  for (const value of [null, {}, { 'linux/arm64': { SPDX: inventory } },
    { ...inventory, packages: [] },
    { ...inventory, packages: [{ name: 'nginx', versionInfo: '1.31.8' }] }]) {
    assert.throws(() => verifySbom(value, '1.31.9'));
  }
});

test('requires real provenance independently of the presence of an SBOM', () => {
  assert.equal(verifyProvenance({ SLSA: provenance }), provenance);
  assert.equal(verifyProvenance({ 'linux/amd64': { SLSA: provenance } }), provenance);
  verifyProvenance({ SLSA: { buildDefinition: provenance } });
  verifyProvenance({ SLSA: { buildDefinition: {
    buildType: 'https://github.com/moby/buildkit/blob/master/docs/attestations/slsa-definitions.md'
  } } });
  for (const value of [null, {}, { SPDX: inventory }, { SLSA: {} },
    { SLSA: { buildType: 'unrecognized-builder' } }]) {
    assert.throws(() => verifyProvenance(value));
  }
});
