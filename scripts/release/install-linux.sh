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

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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
  read -r -p "Continue? [y/N] " answer
  [[ "$answer" =~ ^[Yy]$ ]] || { echo "Cancelled."; exit 1; }
fi

# ---------- port ----------
PORT_DEFAULT=3001
[ -f "$ROOT_DIR/port" ] && PORT_DEFAULT="$(tr -dc '0-9' < "$ROOT_DIR/port")"
[ -n "${PORT:-}" ] && PORT_DEFAULT="$PORT"
CHOSEN="$PORT_DEFAULT"
if [ "$YES" != 1 ]; then
  while :; do
    answer=""
    read -r -p "Which port should the server use? [$PORT_DEFAULT] " answer || true
    CHOSEN="${answer:-$PORT_DEFAULT}"
    if [[ "$CHOSEN" =~ ^[0-9]+$ ]] && [ "$CHOSEN" -ge 1 ] && [ "$CHOSEN" -le 65535 ]; then break; fi
    echo "Please enter a number from 1 to 65535."
  done
fi
[[ "$CHOSEN" =~ ^[0-9]+$ ]] && [ "$CHOSEN" -ge 1 ] && [ "$CHOSEN" -le 65535 ] || die "invalid port: $CHOSEN"
if (exec 3<>"/dev/tcp/127.0.0.1/$CHOSEN") 2>/dev/null; then
  echo "Note: something is already listening on port $CHOSEN right now. Stop it before starting YT Zero, or re-run this installer and pick another port."
fi
echo "$CHOSEN" > "$ROOT_DIR/port"
msg "port: $CHOSEN (saved in ./port; to change it later, re-run bash install-linux.sh or edit ./port)"

# ---------- tools ----------
if [ "${#NEED[@]}" -gt 0 ]; then
  tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
  mkdir -p "$BIN_DIR"
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
