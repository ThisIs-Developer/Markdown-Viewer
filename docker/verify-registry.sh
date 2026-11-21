#!/usr/bin/env bash
set -euo pipefail
image="$1"
platform="${DOCKER_PLATFORM:-linux/amd64}"
case "$platform" in linux/amd64|linux/arm64) ;; *) echo 'FAIL: unsupported platform' >&2; exit 1 ;; esac
architecture="${platform#linux/}"
artifacts="${DOCKER_ARTIFACT_DIR:-docker-artifacts}"
[[ "$image" =~ @sha256:[a-f0-9]{64}$ ]] || { echo 'FAIL: immutable digest required' >&2; exit 1; }
mkdir -p "$artifacts"
docker buildx imagetools inspect --raw "$image" > "$artifacts/candidate-index.json"
jq -e '.mediaType == "application/vnd.oci.image.index.v1+json"' "$artifacts/candidate-index.json"
platform_digest="$(jq -er --arg arch "$architecture" '[.manifests[] | select(.platform.os == "linux" and .platform.architecture == $arch) | .digest] |
  if length == 1 then .[0] else error("Expected one native platform manifest") end' "$artifacts/candidate-index.json")"
jq -e --arg digest "$platform_digest" 'any(.manifests[];
  .annotations["vnd.docker.reference.type"] == "attestation-manifest" and
  .annotations["vnd.docker.reference.digest"] == $digest)' "$artifacts/candidate-index.json"
docker buildx imagetools inspect --raw "${image%@*}@$platform_digest" > "$artifacts/candidate-platform-manifest.json"
config_digest="$(jq -er '.config.digest | select(test("^sha256:[a-f0-9]{64}$"))' "$artifacts/candidate-platform-manifest.json")"
printf 'platform=%s\nplatform_manifest_digest=%s\nimage_config_digest=%s\n' "$platform" "$platform_digest" "$config_digest" | tee -a "$artifacts/candidate-identity.txt"
docker buildx imagetools inspect "$image" --format '{{ json .SBOM }}' > "$artifacts/candidate-sbom.json"
docker buildx imagetools inspect "$image" --format '{{ json .Provenance }}' > "$artifacts/candidate-provenance.json"
node docker/verify-attestations.mjs "$artifacts/candidate-sbom.json" "$artifacts/candidate-provenance.json"
