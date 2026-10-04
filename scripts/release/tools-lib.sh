#!/usr/bin/env bash
# Shared by install-linux.sh and update.sh (sourced, never run on its own).
# Reads tools.lock and installs ONLY what it pins: every download is checked
# against the sha256 in tools.lock and must run before it is used.
# Needs these set by the caller: ROOT_DIR, and the functions msg and die.

TL_TOOLS="bun deno yt-dlp ffmpeg"
TL_BIN="$ROOT_DIR/bin"
TL_INSTALLED="$TL_BIN/.installed"   # lines "<tool> <pinned version>", written by the installers

tl_files() { if [ "$1" = ffmpeg ]; then echo "ffmpeg ffprobe"; else echo "$1"; fi; }

tl_machine() {
  case "$(uname -m)" in
    x86_64|amd64) echo x86_64 ;;
    aarch64|arm64) echo aarch64 ;;
    *) return 1 ;;
  esac
}

# arch key used in tools.lock for this machine (Bun needs its baseline build without AVX2)
tl_arch() {
  local m; m="$(tl_machine)" || return 1
  if [ "$1" = bun ] && [ "$m" = x86_64 ] && ! grep -qw avx2 /proc/cpuinfo 2>/dev/null; then echo x86_64-baseline; else echo "$m"; fi
}

# tl_version <lock> <tool> <arch>: the pinned version (first matching line)
tl_version() {
  local t v a rest
  while read -r t v a rest; do
    [ "$t" = "$2" ] && [ "$a" = "$3" ] && { echo "$v"; return 0; }
  done < <(grep -v '^[[:space:]]*#' "$1" 2>/dev/null || true)
  return 1
}

# tl_sources <lock> <tool> <arch>: "<url> <sha256>" for each mirror of the pinned version
tl_sources() {
  local ver t v a u s
  ver="$(tl_version "$1" "$2" "$3")" || return 1
  while read -r t v a u s; do
    [ "$t" = "$2" ] && [ "$a" = "$3" ] && [ "$v" = "$ver" ] && [[ "$s" =~ ^[0-9a-f]{64}$ ]] && echo "$u $s"
  done < <(grep -v '^[[:space:]]*#' "$1")
}

tl_sha256() {
  if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

# A copy of this tool on the system PATH that is NOT the one in ./bin (empty output if none).
# Nothing in a release uses system copies any more (the tools always come from tools.lock
# into ./bin). Only update.sh still calls this; delete it once update.sh stops.
tl_system_path() {
  local p="" d IFS=:
  for d in $PATH; do [ "$d" = "$TL_BIN" ] || p="${p:+$p:}$d"; done
  PATH="$p" command -v "$1" 2>/dev/null || true
}

# The recorded version of a tool. No file, or no line for the tool, means "no record":
# empty output and success (a missing file must not stop a script that uses set -e).
tl_installed_version() {
  [ -f "$TL_INSTALLED" ] || return 0
  sed -n "/^$1 /{s///p;q;}" "$TL_INSTALLED" 2>/dev/null || true
}

# tl_in_bin <tool> <version>: success when ./bin already holds this tool (all its files, so
# ffmpeg means ffmpeg and ffprobe) and ./bin/.installed records exactly this version.
tl_in_bin() {
  local f
  for f in $(tl_files "$1"); do [ -x "$TL_BIN/$f" ] || return 1; done
  [ "$(tl_installed_version "$1")" = "$2" ]
}

tl_record() { # <tool> <version>
  local tmp="$TL_INSTALLED.tmp"
  mkdir -p "$TL_BIN"
  { grep -v "^$1 " "$TL_INSTALLED" 2>/dev/null || true; echo "$1 $2"; } > "$tmp"
  mv "$tmp" "$TL_INSTALLED"
}

tl_unzip() { # <zip> <dest>
  if command -v unzip >/dev/null; then unzip -q -o "$1" -d "$2"
  elif command -v python3 >/dev/null; then python3 -c "import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "$1" "$2"
  else die "unzip or python3 is required to unpack $(basename "$1")."; fi
}

# tl_fetch <lock> <tool> <arch> <outdir>: download, verify sha256, unpack and test-run.
# The ready files (see tl_files) end up in <outdir>; nothing else is touched.
tl_fetch() {
  local lock="$1" tool="$2" arch="$3" out="$4" ver url sha got work ok=0 f
  ver="$(tl_version "$lock" "$tool" "$arch")" || { echo "error: tools.lock has no $tool for $arch." >&2; return 1; }
  work="$out/.work-$tool"; rm -rf "$work"; mkdir -p "$work"
  while read -r url sha; do
    msg "$tool $ver: downloading $url"
    rm -f "$work/download"
    curl -fsSL --retry 2 "$url" -o "$work/download" || { echo "warning: could not download $url" >&2; continue; }
    got="$(tl_sha256 "$work/download")"
    if [ "$got" = "$sha" ]; then ok=1; break; fi
    echo "warning: checksum mismatch for $url (expected $sha, got $got), not using it." >&2
  done < <(tl_sources "$lock" "$tool" "$arch")
  if [ "$ok" != 1 ]; then rm -rf "$work"; echo "error: no verified download for $tool $ver, nothing was installed for it." >&2; return 1; fi
  msg "$tool $ver: checksum verified"
  case "$tool" in
    bun|deno)
      tl_unzip "$work/download" "$work/x" || return 1
      f="$(find "$work/x" -type f -name "$tool" | head -n 1)"
      [ -n "$f" ] || { echo "error: $tool not found inside its download." >&2; return 1; }
      mv "$f" "$out/$tool" ;;
    yt-dlp) mv "$work/download" "$out/yt-dlp" ;;
    ffmpeg)
      command -v xz >/dev/null || { echo "error: xz is required to unpack ffmpeg (apt install xz-utils), or install ffmpeg yourself." >&2; return 1; }
      tar -xJf "$work/download" -C "$work" --wildcards '*/ffmpeg' '*/ffprobe' || return 1
      mv "$work"/*/ffmpeg "$work"/*/ffprobe "$out/" ;;
    *) echo "error: unknown tool $tool." >&2; return 1 ;;
  esac
  for f in $(tl_files "$tool"); do chmod 0755 "$out/$f"; done
  rm -rf "$work"
  case "$tool" in ffmpeg) "$out/ffmpeg" -version >/dev/null 2>&1 && "$out/ffprobe" -version >/dev/null 2>&1 ;; *) "$out/$tool" --version >/dev/null 2>&1 ;; esac \
    || { echo "error: $tool $ver was downloaded and verified but will not run on this machine." >&2; for f in $(tl_files "$tool"); do rm -f "$out/$f"; done; return 1; }
  return 0
}
