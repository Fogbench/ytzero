#!/usr/bin/env bash
# Downloads yt-dlp, Deno and ffmpeg into ./bin when they are not already on PATH.
# `bun run start` puts ./bin on PATH. Linux x86_64 and aarch64; no root needed.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="$ROOT_DIR/bin"
mkdir -p "$BIN_DIR"
export PATH="$BIN_DIR:$PATH"

msg() { printf '==> %s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

[ "$(uname -s)" = "Linux" ] || { msg "Not Linux: install yt-dlp, deno (2.3+) and ffmpeg yourself (for example with Homebrew)."; exit 0; }
command -v curl >/dev/null || die "curl is required."

case "$(uname -m)" in
  x86_64|amd64) YTDLP_FILE=yt-dlp_linux; DENO_TARGET=x86_64-unknown-linux-gnu; FFMPEG_ARCH=amd64 ;;
  aarch64|arm64) YTDLP_FILE=yt-dlp_linux_aarch64; DENO_TARGET=aarch64-unknown-linux-gnu; FFMPEG_ARCH=arm64 ;;
  *) die "unsupported CPU $(uname -m): install yt-dlp, deno and ffmpeg yourself." ;;
esac

if command -v yt-dlp >/dev/null; then
  msg "yt-dlp: found $(command -v yt-dlp)"
else
  msg "yt-dlp: downloading"
  curl -fsSL "https://github.com/yt-dlp/yt-dlp/releases/latest/download/$YTDLP_FILE" -o "$BIN_DIR/yt-dlp"
  chmod 0755 "$BIN_DIR/yt-dlp"
fi

if command -v deno >/dev/null; then
  msg "deno: found $(command -v deno)"
else
  msg "deno: downloading"
  tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
  curl -fsSL "https://github.com/denoland/deno/releases/latest/download/deno-$DENO_TARGET.zip" -o "$tmp/deno.zip"
  if command -v unzip >/dev/null; then unzip -q -o "$tmp/deno.zip" deno -d "$BIN_DIR"
  else python3 -c "import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extract('deno', sys.argv[2])" "$tmp/deno.zip" "$BIN_DIR"; fi
  chmod 0755 "$BIN_DIR/deno"
fi

if command -v ffmpeg >/dev/null; then
  msg "ffmpeg: found $(command -v ffmpeg)"
else
  command -v xz >/dev/null || die "xz is required to unpack ffmpeg (apt install xz-utils), or install ffmpeg yourself."
  msg "ffmpeg: downloading a static build"
  tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
  curl -fsSL "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-$FFMPEG_ARCH-static.tar.xz" -o "$tmp/ffmpeg.tar.xz"
  tar -xJf "$tmp/ffmpeg.tar.xz" -C "$tmp" --wildcards '*/ffmpeg' '*/ffprobe'
  mv "$tmp"/*/ffmpeg "$tmp"/*/ffprobe "$BIN_DIR/"
fi

"$BIN_DIR/yt-dlp" --version >/dev/null 2>&1 || command -v yt-dlp >/dev/null || die "yt-dlp does not run on this machine."
msg "dependencies ready"
