#!/usr/bin/env bash
# Starts YT Zero from the unpacked release (data in ./data). The port is the one
# chosen in install-linux.sh (file ./port), or PORT=... if set, or 3001.
# Your own settings can go in ./ytzero.env (see README.txt); updates never touch it.
set -euo pipefail
# pwd -P gives the real folder path even when you reached it through a symlink
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

# Optional settings file. "set -a" makes every NAME=value line in it an environment
# variable of the server. It is read first, so it can also set PORT.
# Two things make the file forgiving: carriage returns (CRLF line endings, from a file
# saved on Windows) are removed before it is read, and "set +u" lets a line such as
# A=$UNSET work (it gives an empty value) instead of stopping with "unbound variable".
if [ -f "$ROOT_DIR/ytzero.env" ]; then
  env_text="$(tr -d '\r' < "$ROOT_DIR/ytzero.env")"
  set +u
  set -a
  eval "$env_text"
  set +a
  set -u
fi

export PATH="$ROOT_DIR/bin:$PATH"
export YTZERO_VERSION="$(cat "$ROOT_DIR/VERSION")"
# Keep every cache (Bun, yt-dlp, Deno) inside this folder instead of ~/.cache and ~/.bun.
# These four are set after ytzero.env on purpose, so ytzero.env cannot change them.
export BUN_INSTALL_CACHE_DIR="$ROOT_DIR/.bun-cache"
export XDG_CACHE_HOME="$ROOT_DIR/.cache"
export DENO_DIR="$ROOT_DIR/.cache/deno"
# Temporary files stay in this folder too (yt-dlp unpacks about 64 MB there on every run).
export TMPDIR="$ROOT_DIR/.cache/tmp"
mkdir -p "$TMPDIR"

# The port: PORT from the environment (or ytzero.env), else the file ./port, else 3001.
# Only a whole number from 1 to 65535 is accepted; anything else falls back to 3001.
port_ok() { [[ "$1" =~ ^[0-9]{1,5}$ ]] && [ "$((10#$1))" -ge 1 ] && [ "$((10#$1))" -le 65535 ]; }
if [ -z "${PORT:-}" ]; then
  PORT=3001
  if [ -f "$ROOT_DIR/port" ]; then
    port_file=""; read -r port_file < "$ROOT_DIR/port" || true   # first line, spaces at the ends dropped
    if port_ok "$port_file"; then
      PORT="$((10#$port_file))"
    else
      echo "Note: the file ./port does not hold a port number from 1 to 65535, using 3001. Fix it by running bash install-linux.sh or editing ./port." >&2
    fi
  fi
elif ! port_ok "$PORT"; then
  echo "Note: PORT='$PORT' is not a port number from 1 to 65535, using 3001." >&2
  PORT=3001
fi
export PORT
printf '\n==============================================================\n'
printf '  YT Zero %s is starting. Open it here:\n\n' "$YTZERO_VERSION"
printf '      http://localhost:%s\n\n' "$PORT"
printf '  Press Ctrl+C to stop the server. The server log follows.\n'
printf '==============================================================\n\n'
cd "$ROOT_DIR/app"
UI_DIST="../ui/dist" exec bun src/index.ts
