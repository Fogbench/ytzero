#!/usr/bin/env bash
# Run once after unpacking the release: installs the server's dependencies and
# downloads yt-dlp, Deno and ffmpeg into ./bin when they are not already on PATH.
# Needs Bun (https://bun.sh). No root needed.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
command -v bun >/dev/null || { echo "error: Bun is required, see https://bun.sh" >&2; exit 1; }
(cd "$ROOT_DIR/app" && bun install --production --frozen-lockfile)
bash "$ROOT_DIR/scripts/install-deps.sh"
echo "Done. Start it with: bun run start"
