#!/usr/bin/env bash
# Starts YT Zero from the unpacked release on http://localhost:3001 (data in ./data).
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$ROOT_DIR/bin:$PATH"
export YTZERO_VERSION="$(cat "$ROOT_DIR/VERSION")"
cd "$ROOT_DIR/app"
UI_DIST="../ui/dist" exec bun src/index.ts
