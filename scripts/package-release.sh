#!/usr/bin/env bash
# Builds the release tarball: release/ytzero-<version>.tar.gz plus a .sha256 file.
# Usage: bash scripts/package-release.sh [version]   (default: git describe)
# The tarball keeps the repository layout (app/, ui/dist, shared/) because the
# server imports ../../shared. Dependencies are NOT inside it: the user runs
# `bash install-linux.sh`, which installs them for their own CPU, together
# with the tools pinned in tools.lock.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
export PATH="$HOME/.bun/bin:$PATH" NODE_ENV=production

VERSION="${1:-$(git describe --tags --always)}"
[[ "$VERSION" =~ ^[0-9A-Za-z._-]+$ ]] || { echo "error: bad version '$VERSION'" >&2; exit 1; }
NAME="ytzero-$VERSION"
OUT="$ROOT_DIR/release"

(cd ui && bun install --frozen-lockfile >/dev/null && bun run build)
git checkout -- ui/public/changelog.json 2>/dev/null || true

rm -rf "$OUT/$NAME" "$OUT/$NAME.tar.gz" "$OUT/$NAME.tar.gz.sha256"
mkdir -p "$OUT/$NAME/app" "$OUT/$NAME/ui" "$OUT/$NAME/scripts"
cp -r app/src "$OUT/$NAME/app/src"
cp app/package.json app/bun.lock "$OUT/$NAME/app/"
cp -r ui/dist "$OUT/$NAME/ui/dist"
cp -r shared "$OUT/$NAME/shared"
cp scripts/release/tools-lib.sh "$OUT/$NAME/scripts/"
cp scripts/release/tools.lock "$OUT/$NAME/"
cp scripts/release/install-linux.sh scripts/release/start.sh scripts/release/uninstall.sh scripts/release/update.sh "$OUT/$NAME/"
cp LICENSE "$OUT/$NAME/"; cp scripts/release/README.txt "$OUT/$NAME/README.txt"
echo "$VERSION" > "$OUT/$NAME/VERSION"

tar -C "$OUT" -czf "$OUT/$NAME.tar.gz" "$NAME"
(cd "$OUT" && sha256sum "$NAME.tar.gz" > "$NAME.tar.gz.sha256")
rm -rf "$OUT/$NAME"
echo "built $OUT/$NAME.tar.gz"
cat "$OUT/$NAME.tar.gz.sha256"
