#!/usr/bin/env bash
# Mac App Store recipe: PyInstaller .app -> sandbox entitlements -> .pkg (productbuild).
# Signing is optional: only runs if MAS_APP_IDENTITY / MAS_INSTALLER_IDENTITY are set
# (e.g. "3rd Party Mac Developer Application: ..." / "3rd Party Mac Developer Installer: ...").
set -euo pipefail
cd "$(dirname "$0")/.."
export APP_BUNDLE_ID="${APP_BUNDLE_ID:-forcebrax.com}"
APP="dist/oranizator-igualizator.app"
ENT="packaging/macos/app-store/entitlements.plist"
ENT_INHERIT="packaging/macos/app-store/entitlements-inherit.plist"
VERSION="$(python3 -c 'import tomllib;print(tomllib.load(open("pyproject.toml","rb"))["project"]["version"])')"
mkdir -p release
python3 -m PyInstaller --noconfirm --clean packaging/desktop.spec
if [[ -n "${MAS_PROVISIONING_PROFILE:-}" && -f "${MAS_PROVISIONING_PROFILE}" ]]; then
  cp "$MAS_PROVISIONING_PROFILE" "$APP/Contents/embedded.provisionprofile"
fi
APP_ID="${MAS_APP_IDENTITY:--}"   # "-" = ad-hoc (unsigned for distribution)
# Nested binaries inherit the sandbox; main executable gets the full entitlements.
find "$APP/Contents" -type f \( -name '*.dylib' -o -name '*.so' -o -perm -111 \) ! -path '*/MacOS/oranizator-igualizator' -print0 |
  xargs -0 -I{} codesign --force --timestamp=none --options runtime --entitlements "$ENT_INHERIT" -s "$APP_ID" {} || true
codesign --force --timestamp=none --options runtime --entitlements "$ENT" -s "$APP_ID" "$APP"
codesign -d --entitlements - "$APP"
PKG="release/oranizator-igualizator-${VERSION}-appstore.pkg"
if [[ -n "${MAS_INSTALLER_IDENTITY:-}" ]]; then
  productbuild --component "$APP" /Applications --sign "$MAS_INSTALLER_IDENTITY" "$PKG"
else
  productbuild --component "$APP" /Applications "$PKG"
  echo "Pacote NÃO assinado (sem MAS_INSTALLER_IDENTITY): serve para teste, não para envio à Apple."
fi
shasum -a 256 "$PKG" > "$PKG.sha256"
