import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function verifySbom(value, expectedVersion, platform = 'linux/amd64') {
  // Buildx returns a direct stub for one platform and a map for multiple
  // platforms. Syft emits the SPDX document directly.
  const document = value?.spdxVersion ? value :
    (value?.SPDX ?? value?.[platform]?.SPDX);
  assert.equal(document?.spdxVersion, 'SPDX-2.3', 'Missing SPDX 2.3 inventory');
  assert.ok(Array.isArray(document.packages), 'Missing SBOM packages');
  assert.ok(document.packages.some(pkg =>
    pkg.name?.toLowerCase() === 'nginx' && pkg.versionInfo === expectedVersion),
  `SBOM must identify nginx ${expectedVersion}`);
  return document;
}

export function verifyProvenance(value, platform = 'linux/amd64') {
  const provenance = value?.SLSA ?? value?.[platform]?.SLSA;
  const buildType = provenance?.buildType ?? provenance?.buildDefinition?.buildType;
  const supportedBuildTypes = [
    'https://mobyproject.org/buildkit@v1',
    'https://github.com/moby/buildkit/blob/master/docs/attestations/slsa-definitions.md'
  ];
  assert.ok(supportedBuildTypes.includes(buildType), 'Missing or unrecognized BuildKit SLSA provenance');
  return provenance;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const expected = JSON.parse(fs.readFileSync(new URL('./nginx-component.spdx.json', import.meta.url)))
    .packages.find(pkg => pkg.name === 'nginx').versionInfo;
  const [sbomFile, provenanceFile] = process.argv.slice(2);
  assert.ok(sbomFile, 'Usage: node docker/verify-attestations.mjs SBOM.json [provenance.json]');
  const platform = process.env.DOCKER_PLATFORM || 'linux/amd64';
  assert.ok(['linux/amd64', 'linux/arm64'].includes(platform), 'Unsupported Docker platform');
  verifySbom(JSON.parse(fs.readFileSync(sbomFile)), expected, platform);
  if (provenanceFile) verifyProvenance(JSON.parse(fs.readFileSync(provenanceFile)), platform);
  console.log(`PASS: ${platform} nginx ${expected} inventory${provenanceFile ? ' and BuildKit provenance' : ''}`);
}
