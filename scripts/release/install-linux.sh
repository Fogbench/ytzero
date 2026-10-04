#!/usr/bin/env bash
# Installer for Linux (x86_64 and aarch64). Run it once after unpacking.
# It installs the tools YT Zero needs (Bun, Deno, yt-dlp, ffmpeg) and the
# server's libraries, all inside this folder. The tools are exactly the
# versions pinned in tools.lock, each checked against its sha256 before use;
# nothing is ever downloaded as "latest". A tool that is already on your PATH is
# used as found and not downloaded. It needs no root and does not edit your
# shell profile.
# macOS: do not use this script, follow the macOS steps in README.txt.
#
# Usage: bash install-linux.sh [--yes]     (--yes skips the confirmation question)
set -euo pipefail

# pwd -P gives the real folder path even when you reached it through a symlink
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
BIN_DIR="$ROOT_DIR/bin"
export PATH="$BIN_DIR:$PATH"
# Bun's download cache stays in this folder too, so uninstall.sh can remove it.
export BUN_INSTALL_CACHE_DIR="$ROOT_DIR/.bun-cache"

msg() { printf '==> %s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

[ "$(uname -s)" = "Linux" ] || die "install-linux.sh is for Linux only. On macOS follow the macOS steps in README.txt."
command -v curl >/dev/null || die "curl is required."
LOCK="$ROOT_DIR/tools.lock"
[ -f "$LOCK" ] && [ -f "$ROOT_DIR/scripts/tools-lib.sh" ] || die "tools.lock or scripts/tools-lib.sh is missing: this is not a complete release."
# shellcheck source=/dev/null
. "$ROOT_DIR/scripts/tools-lib.sh"
tl_machine >/dev/null || die "unsupported CPU $(uname -m): install bun, deno (2.3+), yt-dlp and ffmpeg yourself."

YES=0
[ "${1:-}" = "--yes" ] && YES=1

# Decide per tool: found on PATH (used as found) or download the pinned version.
NEED=(); PLAN=""
for tool in $TL_TOOLS; do
  ver="$(tl_version "$LOCK" "$tool" "$(tl_arch "$tool")")" || die "tools.lock has no $tool for this CPU."
  if command -v "$tool" >/dev/null; then
    PLAN+="     $tool: already installed ($(command -v "$tool")), used as found, not changed."$'\n'
  else
    NEED+=("$tool"); PLAN+="     $tool $ver: will be downloaded into $BIN_DIR (checksum from tools.lock is checked)."$'\n'
  fi
done

cat <<EOF2
This installer will, inside $ROOT_DIR only:
  1. Install the tools, exactly the versions pinned in tools.lock:
$PLAN  2. Download the server's libraries into app/node_modules (Bun's cache goes to .bun-cache).
Nothing is installed system-wide. 'bash uninstall.sh' removes all of it again.
EOF2
if [ "$YES" != 1 ]; then
  read -r -p "Continue? [y/N] " answer || { echo; die "no answer (the input is closed). Nothing was changed. Use --yes to skip the question."; }
  [[ "$answer" =~ ^[Yy]$ ]] || { echo "Cancelled."; exit 1; }
fi

# ---------- port ----------
# A port is valid when it is a whole number from 1 to 65535 (digits only).
port_ok() { [[ "$1" =~ ^[0-9]{1,5}$ ]] && [ "$((10#$1))" -ge 1 ] && [ "$((10#$1))" -le 65535 ]; }
PORT_DEFAULT=3001
if [ -f "$ROOT_DIR/port" ]; then
  port_file=""; read -r port_file < "$ROOT_DIR/port" || true   # first line, spaces at the ends dropped
  if port_ok "$port_file"; then PORT_DEFAULT="$((10#$port_file))"
  else echo "Note: the file ./port does not hold a port number from 1 to 65535, so the default is 3001."; fi
fi
[ -n "${PORT:-}" ] && PORT_DEFAULT="$PORT"
CHOSEN="$PORT_DEFAULT"
if [ "$YES" != 1 ]; then
  while :; do
    answer=""
    # The question ends when the input is closed (EOF): then the default is used.
    # (Otherwise this loop would ask again, forever, with nobody to answer.)
    if ! read -r -p "Which port should the server use? [$PORT_DEFAULT] " answer; then
      echo
      port_ok "$PORT_DEFAULT" || die "no answer (the input is closed) and the default port '$PORT_DEFAULT' is not valid. Use --yes with PORT=... set."
      echo "No answer (the input is closed), using the default port $PORT_DEFAULT."
      CHOSEN="$PORT_DEFAULT"; break
    fi
    CHOSEN="${answer:-$PORT_DEFAULT}"
    if port_ok "$CHOSEN"; then break; fi
    echo "Please enter a number from 1 to 65535."
  done
fi
port_ok "$CHOSEN" || die "invalid port: $CHOSEN"
CHOSEN="$((10#$CHOSEN))"
if (exec 3<>"/dev/tcp/127.0.0.1/$CHOSEN") 2>/dev/null; then
  echo "Note: something is already listening on port $CHOSEN right now. Stop it before starting YT Zero, or re-run this installer and pick another port."
fi
echo "$CHOSEN" > "$ROOT_DIR/port"
msg "port: $CHOSEN (saved in ./port; to change it later, re-run bash install-linux.sh or edit ./port)"

# ---------- tools ----------
# ./bin/.installed is the list of what this installer put in ./bin. It is created
# every time, even when all tools were found on your PATH and the list stays empty.
mkdir -p "$BIN_DIR"
touch "$BIN_DIR/.installed"
if [ "${#NEED[@]}" -gt 0 ]; then
  # Downloads wait in a temporary folder INSIDE this folder (not in /tmp), so that moving
  # a finished tool into ./bin is a quick rename that cannot run out of space halfway.
  # TMPDIR points there too, so the test runs of the tools leave nothing in /tmp.
  mkdir -p "$ROOT_DIR/.tmp"
  tmp="$(mktemp -d "$ROOT_DIR/.tmp/install.XXXXXX")"
  trap 'rm -rf "$tmp"; rmdir "$ROOT_DIR/.tmp" 2>/dev/null || true' EXIT
  export TMPDIR="$tmp"
  for tool in "${NEED[@]}"; do
    tl_fetch "$LOCK" "$tool" "$(tl_arch "$tool")" "$tmp" || die "could not install $tool."
    for f in $(tl_files "$tool"); do mv -f "$tmp/$f" "$BIN_DIR/$f"; done
    tl_record "$tool" "$(tl_version "$LOCK" "$tool" "$(tl_arch "$tool")")"
    msg "$tool: installed to $BIN_DIR"
  done
fi
for tool in $TL_TOOLS; do msg "$tool: $(command -v "$tool")"; done

# ---------- libraries ----------
msg "installing the server's libraries"
(cd "$ROOT_DIR/app" && bun install --production --frozen-lockfile)

echo "Done. Start it with: bash start.sh"
