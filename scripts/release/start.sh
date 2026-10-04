#!/usr/bin/env bash
# Starts YT Zero from the unpacked release (data in ./data). Every setting follows
# the same order: a value given on the command line (PORT=8080 bash start.sh) wins,
# then ./ytzero.env, then (for the port only) the file ./port, then 3001.
# Your own settings can go in ./ytzero.env (see README.txt); updates never touch it.
set -euo pipefail
# pwd -P gives the real folder path even when you reached it through a symlink
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

# Optional settings file. "set -a" makes every NAME=value line in it an environment
# variable of the server. It is read first, so it can also set PORT.
# A value given on the command line wins over the file. The file is run like a shell
# script, so it would overwrite such a value; therefore a copy of every variable that is
# already in the environment is taken first ("export -p" prints them in a form the shell
# can read back) and put back after the file has been read. Variables that exist only in
# the file are not touched by that, so they still reach the server. (A variable that is
# set but empty counts as set: the file does not fill it in.)
# Two things make the file forgiving: carriage returns (CRLF line endings, from a file
# saved on Windows) are removed before it is read, and "set +u" lets a line such as
# A=$UNSET work (it gives an empty value) instead of stopping with "unbound variable".
if [ -f "$ROOT_DIR/ytzero.env" ]; then
  env_text="$(tr -d '\r' < "$ROOT_DIR/ytzero.env")"
  env_before="$(export -p)"
  set +u
  set -a
  eval "$env_text"
  set +a
  eval "$env_before" || true   # "|| true": one line that cannot be restored must not stop the rest
  set -u
  unset env_text env_before
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

# The port: PORT from the command line, else from ytzero.env, else the file ./port, else 3001.
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
