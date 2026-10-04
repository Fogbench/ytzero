#!/usr/bin/env bash
# Builds the release tarball: release/ytzero-<version>.tar.gz plus a .sha256 file.
# Usage: bash scripts/package-release.sh [version]   (default: git describe)
# The tarball keeps the repository layout (app/, ui/dist, shared/) because the
# server imports ../../shared. Dependencies are NOT inside it: the user runs
# `bash install-linux.sh`, which installs them for their own CPU, together
# with the tools pinned in tools.lock.
# The tarball is made from `git archive HEAD` (committed files only), built in a
# temp dir, so uncommitted, untracked and gitignored files never reach it and the
# working tree is never touched. The same commit gives the same tarball bytes.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$ROOT_DIR"
export PATH="$HOME/.bun/bin:$PATH" NODE_ENV=production

VERSION="${1:-$(git describe --tags --always)}"
[[ "$VERSION" =~ ^[0-9A-Za-z._-]+$ ]] || { echo "error: bad version '$VERSION'" >&2; exit 1; }
NAME="ytzero-$VERSION"
OUT="$ROOT_DIR/release"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
SRC="$TMP/src"      # the committed sources; the ui build runs here
STAGE="$TMP/stage"  # the tarball content, laid out as $NAME/
mkdir -p "$SRC" "$STAGE/$NAME/app" "$STAGE/$NAME/ui" "$STAGE/$NAME/scripts"

if [[ "$(git rev-parse --show-toplevel 2>/dev/null)" == "$ROOT_DIR" ]]; then
  COMMIT="$(git rev-parse HEAD)"
  EPOCH="$(git log -1 --format=%ct HEAD)"
  git archive HEAD | tar -x -C "$SRC"
else
  # Not a git checkout: this folder is already an export of the sources
  # (scripts/release/test-update.sh packages a `git archive` copy). Copy it as
  # it is; there is no commit to stamp.
  COMMIT=""
  EPOCH="${SOURCE_DATE_EPOCH:-$(date +%s)}"
  tar -c --exclude=./release --exclude=./node_modules --exclude=./ui/node_modules \
    --exclude=./app/node_modules . | tar -x -C "$SRC"
fi

# The ui build rewrites ui/public/changelog.json; that happens in the temp copy
# only. The temp copy has no .git, so the release label is passed as
# YTZERO_VERSION (the changelog script ignores it unless it is a release version).
# YTZERO_CHANGELOG_OFFLINE=1: the changelog script must not contact GitHub, it keeps the
# committed release list and only adds the entry for $VERSION itself. Otherwise the tarball
# bytes would depend on the live GitHub release list, and the same commit would not give the
# same tarball.
(cd "$SRC/ui" && bun install --frozen-lockfile >/dev/null && YTZERO_CHANGELOG_OFFLINE=1 YTZERO_VERSION="$VERSION" bun run build)

cp -r "$SRC/app/src" "$STAGE/$NAME/app/src"
cp "$SRC/app/package.json" "$SRC/app/bun.lock" "$STAGE/$NAME/app/"
cp -r "$SRC/ui/dist" "$STAGE/$NAME/ui/dist"
cp -r "$SRC/shared" "$STAGE/$NAME/shared"
cp "$SRC/scripts/release/tools-lib.sh" "$STAGE/$NAME/scripts/"
cp "$SRC/scripts/release/tools.lock" "$STAGE/$NAME/"
(cd "$SRC/scripts/release" && cp install-linux.sh start.sh uninstall.sh update.sh "$STAGE/$NAME/")
cp "$SRC/LICENSE" "$STAGE/$NAME/"; cp "$SRC/scripts/release/README.txt" "$STAGE/$NAME/README.txt"
echo "$VERSION" > "$STAGE/$NAME/VERSION"
# app/src/version.ts reads this file, so /api/health shows the commit.
[[ -z "$COMMIT" ]] || echo "$COMMIT" > "$STAGE/$NAME/app/src/build-commit.txt"
# Unit tests are not used at runtime (nothing in app/src or shared imports them).
find "$STAGE/$NAME/app/src" "$STAGE/$NAME/shared" -name '*.test.ts' -delete

# MANIFEST: the top-level entries of this release, one per line, in fixed (C locale)
# order, MANIFEST itself included. update.sh compares the installed release's list with
# the new one's and removes what the new release no longer ships. It is made from the
# finished layout, so it cannot drift from what is really in the tarball.
find "$STAGE/$NAME" -mindepth 1 -maxdepth 1 -printf '%f\n' > "$TMP/manifest.list"
echo MANIFEST >> "$TMP/manifest.list"
LC_ALL=C sort -u "$TMP/manifest.list" > "$STAGE/$NAME/MANIFEST"

# Same input, same bytes: fixed order, time, owner and permission bits, and no
# name or time inside the gzip header (gzip -n).
mkdir -p "$OUT"
rm -f "$OUT/$NAME.tar.gz" "$OUT/$NAME.tar.gz.sha256"
tar -C "$STAGE" --format=gnu --sort=name --mtime="@$EPOCH" --owner=0 --group=0 --numeric-owner \
  --mode='u+rwX,go+rX,go-w' -cf - "$NAME" | gzip -n > "$OUT/$NAME.tar.gz"
(cd "$OUT" && sha256sum "$NAME.tar.gz" > "$NAME.tar.gz.sha256")
echo "built $OUT/$NAME.tar.gz"
cat "$OUT/$NAME.tar.gz.sha256"
