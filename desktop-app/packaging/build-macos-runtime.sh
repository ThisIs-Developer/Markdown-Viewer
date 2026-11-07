#!/bin/bash
# Rebuild the pinned runtime: upstream 6.5.0 binaries require macOS 14.
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_DIR="${1:?Usage: build-macos-runtime.sh /path/to/neutralinojs}"
EXPECTED_COMMIT=d1b3a4050f2073f236e14c4746ee8aa7dbb9bfe5
test "$(git -C "$SOURCE_DIR" rev-parse HEAD)" = "$EXPECTED_COMMIT"
test "$(uname -s)" = Darwin

# With a 12.0 deployment target upstream selects its CoreGraphics fallback.
# ScreenCaptureKit only exists from 12.3; do not link an unused mandatory framework.
python3 - "$SOURCE_DIR/CMakeLists.txt" <<'PY'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
source = p.read_text()
line = '      ${SCREENCAPTUREKIT_FRAMEWORK}\n'
assert source.count(line) == 1, 'Pinned upstream link configuration changed'
p.write_text(source.replace(line, ''))
PY

mkdir -p "$APP_DIR/bin"
for arch in x86_64 arm64; do
  cmake -S "$SOURCE_DIR" -B "$SOURCE_DIR/build-$arch" \
    -DCMAKE_BUILD_TYPE=Release -DCMAKE_OSX_ARCHITECTURES="$arch" \
    -DCMAKE_OSX_DEPLOYMENT_TARGET=12.0
  cmake --build "$SOURCE_DIR/build-$arch" --parallel 3
done
cp "$SOURCE_DIR/bin/neutralino-mac_x64" "$APP_DIR/bin/"
cp "$SOURCE_DIR/bin/neutralino-mac_arm64" "$APP_DIR/bin/"
lipo -create "$APP_DIR/bin/neutralino-mac_x64" "$APP_DIR/bin/neutralino-mac_arm64" \
  -output "$APP_DIR/bin/neutralino-mac_universal"
python3 "$APP_DIR/packaging/verify-macos.py" "$APP_DIR/bin/neutralino-mac_universal"
