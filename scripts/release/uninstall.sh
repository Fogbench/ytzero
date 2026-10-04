#!/usr/bin/env bash
# Undoes what install.sh did, inside this folder only:
#   - removes app/node_modules
#   - removes the tools install.sh downloaded into ./bin (yt-dlp, deno, ffmpeg, ffprobe)
#   - keeps ./data (your database and downloads) unless you ask for it to be removed
# It never touches anything outside this folder, so a yt-dlp, deno or ffmpeg that
# was already installed on your system stays exactly as it was.
#
# Usage: bash uninstall.sh [--dry-run] [--remove-data] [--yes]
#   --dry-run      only list what would be removed
#   --remove-data  also delete ./data (cannot be undone)
#   --yes          do not ask for confirmation
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRY=0; DATA=0; YES=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY=1 ;;
    --remove-data) DATA=1 ;;
    --yes) YES=1 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

[ -f "$ROOT_DIR/VERSION" ] && [ -f "$ROOT_DIR/app/package.json" ] || { echo "error: this does not look like a YT Zero folder." >&2; exit 1; }

# Refuse to remove files from under a running server.
for cwd in /proc/[0-9]*/cwd; do
  if [ "$(readlink "$cwd" 2>/dev/null)" = "$ROOT_DIR/app" ]; then
    echo "error: YT Zero is still running from this folder (pid $(basename "$(dirname "$cwd")")). Stop it first." >&2
    exit 1
  fi
done

targets=()
[ -d "$ROOT_DIR/app/node_modules" ] && targets+=("$ROOT_DIR/app/node_modules")
for tool in yt-dlp deno ffmpeg ffprobe; do
  if [ -e "$ROOT_DIR/bin/$tool" ] || [ -L "$ROOT_DIR/bin/$tool" ]; then targets+=("$ROOT_DIR/bin/$tool"); fi
done
if [ "$DATA" = 1 ] && [ -d "$ROOT_DIR/data" ]; then targets+=("$ROOT_DIR/data"); fi

if [ "${#targets[@]}" = 0 ]; then echo "Nothing to remove."; exit 0; fi
echo "Will remove:"; printf '  %s\n' "${targets[@]}"
[ "$DATA" = 1 ] || echo "Keeping: $ROOT_DIR/data (use --remove-data to delete it)"
[ "$DRY" = 1 ] && { echo "(dry run, nothing removed)"; exit 0; }

if [ "$YES" != 1 ]; then
  read -r -p "Continue? [y/N] " answer
  [[ "$answer" =~ ^[Yy]$ ]] || { echo "Cancelled."; exit 1; }
fi

for target in "${targets[@]}"; do rm -rf -- "$target"; done
rmdir "$ROOT_DIR/bin" 2>/dev/null || true

echo "Done."
echo "Left alone: Bun and its package cache (~/.bun), and anything you installed yourself."
echo "To remove the program itself, delete this folder (this includes ./data if you kept it):"
echo "  rm -rf \"$ROOT_DIR\""
