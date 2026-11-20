#!/bin/sh
set -eu
db="${APK_DB_PATH:-/lib/apk/db/installed}"
if [ ! -r "$db" ] || [ ! -s "$db" ]; then
  echo "FAIL: missing/unreadable APK installed-package inventory: $db" >&2; exit 1
fi
if ! grep -q '^P:' "$db"; then
  echo "FAIL: invalid APK installed-package inventory" >&2; exit 1
fi
if grep -Eq '^P:(openssl|libssl3|libcrypto3)$' "$db"; then
  echo "FAIL: OpenSSL runtime package detected" >&2; exit 1
fi
for path in /lib/libssl* /usr/lib/libssl* /usr/local/lib/libssl* /lib/libcrypto* /usr/lib/libcrypto* /usr/local/lib/libcrypto*; do
  if [ -e "$path" ] || [ -L "$path" ]; then
    echo "FAIL: OpenSSL shared library found: $path" >&2; exit 1
  fi
done
if ! command -v ldd >/dev/null 2>&1; then
  echo "FAIL: missing ldd" >&2; exit 1
fi
links="$(ldd /usr/sbin/nginx 2>&1)" || {
  echo "FAIL: cannot inspect nginx linkage" >&2; exit 1
}
if printf '%s\n' "$links" | grep -Eq 'lib(ssl|crypto)|not found|Error'; then
  echo "FAIL: forbidden/unresolved nginx shared library" >&2; exit 1
fi
options="$(nginx -V 2>&1)" || { echo "FAIL: nginx -V failed" >&2; exit 1; }
if printf '%s\n' "$options" | grep -Eq -- '--with-(http_ssl|http_v3|stream_ssl)_module'; then
  echo "FAIL: SSL/QUIC module enabled" >&2; exit 1
fi
if ! printf '%s\n' "$options" | grep -Fxq 'nginx version: nginx/1.31.9'; then
  echo "FAIL: NGINX version differs from SBOM" >&2; exit 1
fi
echo "PASS: no OpenSSL packages, libraries or NGINX SSL modules"
