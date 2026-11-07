#!/bin/bash
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
test "$(uname -s)" = Darwin
VERSION="$(node -p "require('$APP_DIR/neutralino.config.json').version")"
OUTPUT="$APP_DIR/dist/installers"
mkdir -p "$OUTPUT"
IDENTITY="${MACOS_SIGNING_IDENTITY:--}"
if [[ "$IDENTITY" != - ]]; then
  : "${MACOS_NOTARY_PROFILE:?Developer ID builds must also be notarized}"
fi

for arch in x64 arm64 universal; do
  INPUT="$APP_DIR/dist/markdown-viewer/markdown-viewer-mac_$arch"
  python3 "$APP_DIR/packaging/verify-macos.py" --arch "$arch" "$INPUT"
  STAGING="$(mktemp -d)"
  trap 'rm -rf "$STAGING"' EXIT
  APP="$STAGING/Markdown Viewer.app"
  mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
  cp "$INPUT" "$APP/Contents/MacOS/markdown-viewer"
  chmod 755 "$APP/Contents/MacOS/markdown-viewer"
  python3 "$APP_DIR/packaging/macos_support.py" plist "$VERSION" "$arch" "$APP/Contents/Info.plist"
  ICONSET="$STAGING/MarkdownViewer.iconset"
  mkdir "$ICONSET"
  for size in 16 32 128 256 512; do
    sips -z "$size" "$size" "$APP_DIR/resources/assets/icon.png" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
    double=$((size * 2))
    sips -z "$double" "$double" "$APP_DIR/resources/assets/icon.png" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
  done
  iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/MarkdownViewer.icns"
  rm -rf "$ICONSET"
  chmod -R u+rwX,go+rX "$APP"
  plutil -lint "$APP/Contents/Info.plist"
  # Resource embedding changes Mach-O bytes. Sign the FINAL bundle, never the input.
  if [[ "$IDENTITY" == - ]]; then
    codesign --force --sign - "$APP"
    cp "$APP_DIR/packaging/UNSIGNED-MACOS.txt" "$STAGING/READ-ME-FIRST.txt"
  else
    codesign --force --options runtime --timestamp --sign "$IDENTITY" "$APP"
    ditto -c -k --keepParent "$APP" "$STAGING/notarize.zip"
    xcrun notarytool submit "$STAGING/notarize.zip" --keychain-profile "$MACOS_NOTARY_PROFILE" --wait
    rm "$STAGING/notarize.zip"
    xcrun stapler staple "$APP"
    spctl --assess --type execute --verbose "$APP"
  fi
  codesign --verify --deep --strict --verbose=2 "$APP"
  ln -s /Applications "$STAGING/Applications"
  DMG="$OUTPUT/markdown-viewer-mac_$arch.dmg"
  rm -f "$DMG"
  hdiutil create -volname 'Markdown Viewer' -srcfolder "$STAGING" -ov -fs HFS+ -format UDZO "$DMG"
  if [[ "$IDENTITY" != - ]]; then
    codesign --sign "$IDENTITY" --timestamp "$DMG"
    xcrun notarytool submit "$DMG" --keychain-profile "$MACOS_NOTARY_PROFILE" --wait
    xcrun stapler staple "$DMG"
    xcrun stapler validate "$DMG"
  fi
  hdiutil verify "$DMG"
  rm -rf "$STAGING"
  trap - EXIT
done
if [[ "$IDENTITY" == - ]]; then
  cp "$APP_DIR/packaging/UNSIGNED-MACOS.txt" "$OUTPUT/MACOS-SIGNING.txt"
else
  printf 'Developer ID signed and Apple notarized. Native runtime baselines: Intel %s; Apple Silicon %s.\n' \
    "$(python3 "$APP_DIR/packaging/macos_support.py" target x86_64)" \
    "$(python3 "$APP_DIR/packaging/macos_support.py" target arm64)" > "$OUTPUT/MACOS-SIGNING.txt"
fi
