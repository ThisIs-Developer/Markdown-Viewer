#!/usr/bin/env bash
set -euo pipefail
image="$1"
name="mdv-verify-image-$$"
temp="$(mktemp -d)"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; rm -rf "$temp"; }
trap cleanup EXIT
docker run --rm -d --name "$name" -p 127.0.0.1:18080:80 "$image" >/dev/null
docker exec "$name" nginx -t
docker exec "$name" /usr/local/bin/check-docker-runtime
docker exec "$name" test -s /usr/share/licenses/nginx/LICENSE
docker exec "$name" test -s /usr/share/doc/nginx/component.spdx.json
docker exec "$name" sh -ec '
  cp /lib/apk/db/installed /tmp/installed-test
  printf "\nP:libssl3\n" >> /tmp/installed-test
  if APK_DB_PATH=/tmp/installed-test /usr/local/bin/check-docker-runtime; then
    echo "FAIL: forbidden library fixture accepted" >&2; exit 1
  fi
  if APK_DB_PATH=/tmp/missing-inventory /usr/local/bin/check-docker-runtime; then
    echo "FAIL: missing package inventory accepted" >&2; exit 1
  fi
  rm -f /tmp/installed-test
'
test "$(docker image inspect "$image" --format '{{.Config.StopSignal}}')" = "SIGQUIT"
ready=0
for i in $(seq 1 30); do
  if curl -fsS --max-time 3 -o /dev/null http://127.0.0.1:18080/; then ready=1; break; fi
  sleep 1
done
test "$ready" -eq 1 || { echo "FAIL: HTTP container not ready" >&2; exit 1; }
python3 - <<'PY' > "$temp/critical-assets"
import pathlib,re,sys
source=pathlib.Path('sw.js').read_text()
match=re.search(r'const CRITICAL_ASSETS = \[(.*?)\];',source,re.S)
if not match: sys.exit('No critical asset list')
items=re.findall(r"""['"](\./[^'"]+)['"]""",match.group(1))
if len(items)<10: sys.exit('Too few critical assets')
print('\n'.join(items))
PY
while IFS= read -r item; do
  relative="$(printf '%s' "$item" | sed 's,^\./,,')"
  if [ -z "$relative" ]; then relative="index.html"; fi
  test -f "$relative"
  curl -fsS --max-time 10 "http://127.0.0.1:18080/$relative" -o "$temp/actual"
  cmp -s "$relative" "$temp/actual" || { echo "FAIL: incorrect /$relative (SPA fallback?)" >&2; exit 1; }
done < "$temp/critical-assets"
for rel in browser-drop-source.js native-markdown-source.js preview-worker.js assets/linked-workspace-guide.md; do
  test -f "$rel"
  curl -fsS --max-time 10 "http://127.0.0.1:18080/$rel" -o "$temp/actual"
  cmp -s "$rel" "$temp/actual" || { echo "FAIL: incorrect $rel" >&2; exit 1; }
done
for url in / /index.html /script.js /styles.css /sw.js /preview-worker.js /assets/seo-metadata.mjs /not-a-real-file.mjs; do
  curl -sS -D "$temp/headers" -o /dev/null --max-time 10 "http://127.0.0.1:18080$url"
  grep -iq '^x-content-type-options: nosniff' "$temp/headers"
  grep -iq '^content-security-policy:' "$temp/headers"
  grep -iq '^x-frame-options: SAMEORIGIN' "$temp/headers"
  if [ "$url" != "/not-a-real-file.mjs" ]; then
    grep -iq '^cache-control: no-cache' "$temp/headers" || { echo "FAIL: immutable mutable resource $url" >&2; exit 1; }
  fi
done
for url in /not-a-real-file.mjs /not-a-real-file.js /not-a-real-file.css; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:18080$url")"
  test "$code" = 404 || { echo "FAIL: $url is $code not 404" >&2; exit 1; }
done
curl -fsSI http://127.0.0.1:18080/assets/seo-metadata.mjs | grep -Eiq '^content-type: (application|text)/javascript'
if curl -fsSI http://127.0.0.1:18080/ | grep -qi 'upgrade-insecure-requests'; then
  echo "FAIL: HTTP-only image forces HTTPS" >&2; exit 1
fi
etag="$(curl -fsSI http://127.0.0.1:18080/script.js | sed -n 's/^[Ee][Tt][Aa][Gg]:[[:space:]]*//p' | tr -d '\r' | head -1)"
test -n "$etag"
code="$(curl -sS -o /dev/null -w '%{http_code}' -H "If-None-Match: $etag" http://127.0.0.1:18080/script.js)"
test "$code" = 304 || { echo "FAIL: conditional request is $code" >&2; exit 1; }
echo "PASS: actual assets/content, missing resources, headers, cache, OpenSSL, shutdown signal"
