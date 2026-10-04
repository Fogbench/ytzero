#!/usr/bin/env bash
# Installer for Linux (x86_64 and aarch64). Run it once after unpacking.
# It installs Bun if you don't have it, then everything YT Zero needs, all inside
# this folder. It needs no root and does not edit your shell profile.
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

YES=0
[ "${1:-}" = "--yes" ] && YES=1

if command -v bun >/dev/null; then BUN_PLAN="Bun: already installed ($(command -v bun)), it will be used and not changed."
else BUN_PLAN="Bun: NOT found. It will be downloaded into $BIN_DIR/bun (checked against Bun's published checksum)."; fi

cat <<EOF
This installer will, inside $ROOT_DIR only:
  1. $BUN_PLAN
  2. Download the server's libraries into app/node_modules (Bun's cache goes to .bun-cache).
  3. Download yt-dlp, Deno and ffmpeg into ./bin, but only those not already on your system.
Nothing is installed system-wide. 'bash uninstall.sh' removes all of it again.
EOF
if [ "$YES" != 1 ]; then
  read -r -p "Continue? [y/N] " answer
  [[ "$answer" =~ ^[Yy]$ ]] || { echo "Cancelled."; exit 1; }
fi

# ---------- Bun ----------
if command -v bun >/dev/null; then
  msg "bun: found $(command -v bun)"
else
  command -v unzip >/dev/null || die "unzip is required to unpack Bun (for example: apt install unzip)."
  case "$(uname -m)" in
    x86_64|amd64)
      # Older CPUs without AVX2 need Bun's "baseline" build.
      if grep -qw avx2 /proc/cpuinfo 2>/dev/null; then BUN_FILE=bun-linux-x64; else BUN_FILE=bun-linux-x64-baseline; fi ;;
    aarch64|arm64) BUN_FILE=bun-linux-aarch64 ;;
    *) die "unsupported CPU $(uname -m): install Bun yourself from https://bun.sh and run this again." ;;
  esac
  msg "bun: downloading $BUN_FILE"
  tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
  BUN_URL="https://github.com/oven-sh/bun/releases/latest/download"
  curl -fsSL "$BUN_URL/$BUN_FILE.zip" -o "$tmp/$BUN_FILE.zip"
  curl -fsSL "$BUN_URL/SHASUMS256.txt" -o "$tmp/SHASUMS256.txt"
  expected="$(grep " $BUN_FILE.zip\$" "$tmp/SHASUMS256.txt" | head -n 1 | cut -d' ' -f1)"
  [ -n "$expected" ] || die "no checksum published for $BUN_FILE.zip."
  [ "$(sha256sum "$tmp/$BUN_FILE.zip" | cut -d' ' -f1)" = "$expected" ] || die "checksum mismatch on $BUN_FILE.zip, nothing was installed."
  msg "bun: checksum verified"
  unzip -q -o "$tmp/$BUN_FILE.zip" -d "$tmp"
  mkdir -p "$BIN_DIR"
  mv "$tmp/$BUN_FILE/bun" "$BIN_DIR/bun"; chmod 0755 "$BIN_DIR/bun"
  "$BIN_DIR/bun" --version >/dev/null 2>&1 || die "Bun was downloaded but will not run on this machine."
  msg "bun: $("$BIN_DIR/bun" --version) installed to $BIN_DIR/bun"
fi

# ---------- libraries ----------
msg "installing the server's libraries"
(cd "$ROOT_DIR/app" && bun install --production --frozen-lockfile)

# ---------- tools ----------
bash "$ROOT_DIR/scripts/install-deps.sh"

echo "Done. Start it with: bash start.sh"
