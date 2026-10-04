#!/usr/bin/env bash
# Starts YT Zero from the unpacked release on http://localhost:3001 (data in ./data).
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$ROOT_DIR/bin:$PATH"
export YTZERO_VERSION="$(cat "$ROOT_DIR/VERSION")"
# Keep every cache (Bun, yt-dlp, Deno) inside this folder instead of ~/.cache and ~/.bun.
export BUN_INSTALL_CACHE_DIR="$ROOT_DIR/.bun-cache"
export XDG_CACHE_HOME="$ROOT_DIR/.cache"
export DENO_DIR="$ROOT_DIR/.cache/deno"
cd "$ROOT_DIR/app"
UI_DIST="../ui/dist" exec bun src/index.ts
