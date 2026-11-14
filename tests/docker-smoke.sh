#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

http=(docker compose -p mdv-ci-http -f docker-compose.yml)
https=(docker compose -p mdv-ci-https -f docker-compose.https.yml)
public=(docker compose -p mdv-ci-public -f docker-compose.https-public.yml)

scratch="$(mktemp -d)"
cleanup() {
  MDV_DOMAIN=example.com "${public[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  "${https[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  "${http[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$scratch"
}
trap cleanup EXIT

wait_for() {
  local url="$1"
  for _ in $(seq 1 80); do
    if curl -kfsS --connect-timeout 2 --max-time 4 -o /dev/null "$url"; then
      return 0
    fi
    sleep 2
  done
  echo "FAIL: Service did not become available: $url" >&2
  return 1
}

headers() {
  curl -kfsSI --max-time 12 "$1"
}

assert_headers() {
  local url="$1"
  local path="$2"
  local expected="$3"
  local response
  response="$(headers "$url$path")"
  echo "$response" | grep -qi '^HTTP/.* 200' || { echo "FAIL: $path is not HTTP 200" >&2; return 1; }
  echo "$response" | grep -qi "^content-type: $expected" || { echo "FAIL: Incorrect MIME for $path: $response" >&2; return 1; }
  echo "$response" | grep -qi '^x-content-type-options: nosniff' || { echo "FAIL: security header missing for $path" >&2; return 1; }
  echo "$response" | grep -qi '^content-security-policy:' || { echo "FAIL: CSP missing for $path" >&2; return 1; }
  if echo "$response" | grep -qi 'upgrade-insecure-requests'; then
    echo "FAIL: HTTP-only Nginx must not send HTTPS-upgrade CSP" >&2
    return 1
  fi
}

check_all_critical_assets() {
  local url="$1"
  while IFS= read -r path; do
    if ! curl -kfsS --max-time 15 -o /dev/null "$url/${path#./}"; then
      echo "FAIL: Service Worker critical asset missing: $path at $url" >&2
      return 1
    fi
  done < <(node - <<'NODE'
const fs = require('node:fs');
const sw = fs.readFileSync('sw.js', 'utf8');
const critical = sw.match(/const CRITICAL_ASSETS = \[([\s\S]*?)\]/);
if (!critical) throw new Error('Missing CRITICAL_ASSETS');
for (const match of critical[1].matchAll(/'([^']+)'/g)) {
  console.log(match[1] === './' ? '' : match[1]);
}
NODE
)
}

check_site() {
  local url="$1"
  assert_headers "$url" "/styles.css" 'text/css'
  assert_headers "$url" "/script.js" 'application/javascript\|text/javascript'
  assert_headers "$url" "/native-markdown-source.js" 'application/javascript\|text/javascript'
  assert_headers "$url" "/assets/seo-metadata.mjs" 'application/javascript'
  assert_headers "$url" "/assets/icon.jpg" 'image/jpeg'
  for asset in /styles.css /script.js /assets/seo-metadata.mjs; do
    if ! headers "$url$asset" | grep -qi '^cache-control: no-cache'; then
      echo "FAIL: $asset must revalidate on upgrades" >&2
      return 1
    fi
  done
  for asset in /not-found.js /not-found.mjs /not-found.css; do
    local status
    status="$(curl -ksS -o /dev/null -w '%{http_code}' "$url$asset")"
    [[ "$status" == 404 ]] || { echo "FAIL: $asset returned $status instead of 404" >&2; return 1; }
  done
  check_all_critical_assets "$url"
  # A SPA index.html fallback is a false positive for a missing .md file.
  curl -kfsS "$url/sample.md" | grep -Fq 'title: Welcome to Markdown Viewer' || {
    echo "FAIL: packaged sample.md is missing or is HTML fallback" >&2
    return 1
  }
  curl -kfsS "$url/assets/linked-workspace-guide.md" | grep -Fq '# Welcome to Linked Workspace' || {
    echo "FAIL: packaged linked-workspace guide is missing or is HTML fallback" >&2
    return 1
  }
}

echo "== Docker HTTP / default port 8080 =="
"${http[@]}" up -d --build
wait_for "http://127.0.0.1:8080/"
check_site "http://127.0.0.1:8080"
DOCKER_SMOKE_URL=http://localhost:8080 node tests/docker-browser-smoke.cjs

# Keep HTTP running while starting HTTPS to verify the two published ports coexist.
echo "== Docker local HTTPS / port 8443 =="
"${https[@]}" up -d --build
wait_for "https://localhost:8443/"
check_site "https://localhost:8443"
# Verify HTTPS without -k by explicitly trusting the test Caddy CA.
"${https[@]}" cp caddy:/data/caddy/pki/authorities/local/root.crt "$scratch/local-root.crt"
curl --cacert "$scratch/local-root.crt" -fsS --max-time 12 -o /dev/null https://localhost:8443/
DOCKER_SMOKE_URL=https://localhost:8443 node tests/docker-browser-smoke.cjs
check_site "http://127.0.0.1:8080"
echo "PASS: HTTP 8080 and HTTPS 8443 work concurrently"

echo "== Validate optional public HTTPS config and Caddyfile without attempting certificate issuance =="
MDV_DOMAIN=example.com "${public[@]}" config --quiet
MDV_DOMAIN=example.com "${public[@]}" run --rm --no-deps --entrypoint caddy caddy validate --config /etc/caddy/Caddyfile
echo "PASS: HTTP + HTTPS browser smoke, assets, CSP, MIME, caching, local TLS, public config."
