#!/usr/bin/env bash
# Disposable test: verify an in-flight HTTP transfer survives Docker's
# configured SIGQUIT graceful shutdown within the documented grace period.
set -euo pipefail
image="$1"
name="mdv-graceful-$$"
temp="$(mktemp -d)"
curl_pid=''
cleanup() {
  if [ -n "$curl_pid" ]; then kill "$curl_pid" >/dev/null 2>&1 || true; fi
  docker rm -f "$name" >/dev/null 2>&1 || true
  rm -rf "$temp"
}
trap cleanup EXIT
# Throttle at the server as well as the client: otherwise the entire small
# response can fit in TCP buffers before stop, hiding a fast-shutdown bug.
docker run --rm -d --name "$name" -p 127.0.0.1:18081:80 --entrypoint sh "$image" -ec '
  sed -i "/server_name localhost;/a\\    limit_rate 256k;" /etc/nginx/conf.d/default.conf
  exec nginx -g "daemon off;"
' >/dev/null
for i in $(seq 1 30); do
  if curl -fsS --max-time 3 -o /dev/null http://127.0.0.1:18081/; then break; fi
  sleep 1
done
docker exec "$name" sh -c 'dd if=/dev/zero of=/usr/share/nginx/html/graceful-slow.bin bs=1048576 count=2 2>/dev/null'
curl --silent --show-error --fail --limit-rate 256k \
  --dump-header "$temp/slow-headers" \
  --output "$temp/slow-content" http://127.0.0.1:18081/graceful-slow.bin &
curl_pid=$!
ready=0
for i in $(seq 1 100); do
  if test -s "$temp/slow-headers" && grep -q '^HTTP/1.1 200' "$temp/slow-headers" && test -s "$temp/slow-content"; then
    ready=1
    break
  fi
  kill -0 "$curl_pid" >/dev/null 2>&1 || break
  sleep 0.1
done
test "$ready" -eq 1 || { echo "FAIL: controlled transfer never started" >&2; exit 1; }
docker stop --time 20 "$name" >/dev/null
wait "$curl_pid" || { echo "FAIL: transfer interrupted during graceful stop" >&2; exit 1; }
curl_pid=''
bytes="$(wc -c < "$temp/slow-content" | tr -d ' ')"
test "$bytes" = 2097152 || { echo "FAIL: truncated transfer ($bytes bytes)" >&2; exit 1; }
if curl -fsS --max-time 2 -o /dev/null http://127.0.0.1:18081/; then
  echo "FAIL: stopped container still accepts requests" >&2
  exit 1
fi
echo "PASS: SIGQUIT completed 2MiB active HTTP download within 20s grace period"
