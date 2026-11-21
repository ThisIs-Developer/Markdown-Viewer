#!/usr/bin/env bash
set -euo pipefail
image="$1"
name="mdv-verify-browser-$$"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run --rm -d --name "$name" -p 127.0.0.1:18080:80 "$image" >/dev/null
ready=0
for i in $(seq 1 30); do
  if curl -fsS --max-time 3 -o /dev/null http://127.0.0.1:18080/; then ready=1; break; fi
  sleep 1
done
test "$ready" -eq 1 || { echo "FAIL: missing browser test Docker server" >&2; exit 1; }
MARKDOWN_VIEWER_TEST_CONTAINER=1 MARKDOWN_VIEWER_TEST_PORT=18080 \
  npx playwright test tests/e2e/smoke.spec.js tests/e2e/docker.spec.js tests/e2e/docker-sharing.spec.js tests/e2e/startup-recovery.spec.js \
  --project=chromium --grep-invert='static build smoke check passes'
