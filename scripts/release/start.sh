#!/usr/bin/env bash
# Starts YT Zero from the unpacked release (data in ./data). The port is the one
# chosen in install-linux.sh (file ./port), or PORT=... if set, or 3001.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$ROOT_DIR/bin:$PATH"
export YTZERO_VERSION="$(cat "$ROOT_DIR/VERSION")"
# Keep every cache (Bun, yt-dlp, Deno) inside this folder instead of ~/.cache and ~/.bun.
export BUN_INSTALL_CACHE_DIR="$ROOT_DIR/.bun-cache"
export XDG_CACHE_HOME="$ROOT_DIR/.cache"
export DENO_DIR="$ROOT_DIR/.cache/deno"
if [ -z "${PORT:-}" ]; then
  PORT=3001
  [ -f "$ROOT_DIR/port" ] && PORT="$(tr -dc '0-9' < "$ROOT_DIR/port")"
fi
export PORT
printf '\n==============================================================\n'
printf '  YT Zero %s is starting. Open it here:\n\n' "$YTZERO_VERSION"
printf '      http://localhost:%s\n\n' "$PORT"
printf '  Press Ctrl+C to stop the server. The server log follows.\n'
printf '==============================================================\n\n'
cd "$ROOT_DIR/app"
UI_DIST="../ui/dist" exec bun src/index.ts
