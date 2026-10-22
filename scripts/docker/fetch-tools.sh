#!/usr/bin/env bash
# Used by the Dockerfile only: downloads Deno, yt-dlp and ffmpeg (with ffprobe) for the
# CPU this image is built for, exactly as pinned in scripts/release/tools.lock, with the
# same sha256 checks and test runs as install-linux.sh (tools-lib.sh). Nothing is "latest".
# Also stops the build when the Bun of the base image is not the Bun pinned in tools.lock.
# Usage: bash fetch-tools.sh <dir with tools-lib.sh and tools.lock> <output dir>
set -euo pipefail
ROOT_DIR="$1"; OUT="$2"
msg() { echo "$*"; }
die() { echo "error: $*" >&2; exit 1; }
# shellcheck source=scripts/release/tools-lib.sh
. "$ROOT_DIR/tools-lib.sh"
LOCK="$ROOT_DIR/tools.lock"

arch="$(tl_machine)" || die "unsupported CPU $(uname -m); the image is built for x86_64 and aarch64."
want_bun="$(tl_version "$LOCK" bun "$arch")" || die "tools.lock has no bun for $arch."
have_bun="$(bun --version)"
[ "$have_bun" = "$want_bun" ] || die "base image has Bun $have_bun but tools.lock pins $want_bun: change the Dockerfile's BUN_IMAGE and tools.lock together."

mkdir -p "$OUT"
for tool in deno yt-dlp ffmpeg; do
  tl_fetch "$LOCK" "$tool" "$arch" "$OUT" || die "could not install $tool."
  echo "$tool $(tl_version "$LOCK" "$tool" "$arch")" >> "$OUT/.installed"
done
