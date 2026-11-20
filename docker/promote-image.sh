#!/usr/bin/env bash
# Promote the already-verified OCI index, never rebuild it.
set -euo pipefail
image="$1"
repository="$2"
shift 2
[[ "$image" =~ @sha256:[a-f0-9]{64}$ ]] || { echo 'FAIL: immutable digest required' >&2; exit 1; }
test "$#" -gt 0
expected="${image##*@}"
mkdir -p docker-artifacts
for tag in "$@"; do
  docker buildx imagetools create --tag "$repository:$tag" "$image"
  actual="$(docker buildx imagetools inspect "$repository:$tag" --format '{{ .Manifest.Digest }}')"
  test "$actual" = "$expected" || { echo "FAIL: changed index digest for $tag: $actual" >&2; exit 1; }
  printf 'promoted_%s=%s\n' "$tag" "$actual" | tee -a docker-artifacts/candidate-identity.txt
done
