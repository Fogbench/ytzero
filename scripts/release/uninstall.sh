#!/usr/bin/env bash
# Undoes what install-linux.sh did, inside this folder only:
#   - removes app/node_modules
#   - removes Bun and the tools install-linux.sh downloaded into ./bin (bun, yt-dlp, deno, ffmpeg, ffprobe)
#     and the list of what was installed (./bin/.installed), and ./port
#   - removes .bun-cache, .cache and .tmp (Bun, yt-dlp and Deno caches and temporary files for this folder)
#   - keeps ./data (your database and downloads) unless you ask for it to be removed
# It never touches anything outside this folder, so a Bun, yt-dlp, deno or ffmpeg
# that was already installed on your system stays exactly as it was.
#
# Usage: bash uninstall.sh [--dry-run] [--remove-data] [--yes]
#   --dry-run      only list what would be removed
#   --remove-data  also delete ./data (cannot be undone)
#   --yes          do not ask for confirmation
set -euo pipefail

# pwd -P gives the real folder path even when you reached it through a symlink. The
# running-server check below needs that: /proc/<pid>/cwd always shows the real path.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
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

# ./bin must be a real folder. If it were a symlink, "rm -rf bin/bun" would delete the
# file in the folder it points to, which can be anywhere.
if [ -L "$ROOT_DIR/bin" ]; then
  echo "error: $ROOT_DIR/bin is a symbolic link, not a folder. Refusing to remove anything through it." >&2
  echo "Check where it points, then delete the link or the tools by hand." >&2
  exit 1
fi

# update.sh keeps a folder .update.lock (with its process number in the file "pid") while
# it runs. Do not remove things from under it. A lock whose process is gone is a leftover
# of a run that was killed; that does not block (same rule as in update.sh).
if [ -d "$ROOT_DIR/.update.lock" ]; then
  lock_pid=""
  [ -f "$ROOT_DIR/.update.lock/pid" ] && lock_pid="$(cat "$ROOT_DIR/.update.lock/pid" 2>/dev/null || true)"
  if [ -z "$lock_pid" ] || kill -0 "$lock_pid" 2>/dev/null; then
    echo "error: update.sh is running in this folder${lock_pid:+ (pid $lock_pid)}. Wait for it to finish, then run this again." >&2
    echo "If you are sure it is not running, delete the folder .update.lock and try again." >&2
    exit 1
  fi
fi

# Refuse to remove files from under a running server (a process whose working folder is
# app/ or inside it).
for cwd in /proc/[0-9]*/cwd; do
  proc_cwd="$(readlink "$cwd" 2>/dev/null || true)"
  if [ "$proc_cwd" = "$ROOT_DIR/app" ] || [[ "$proc_cwd" == "$ROOT_DIR/app/"* ]]; then
    echo "error: YT Zero is still running from this folder (pid $(basename "$(dirname "$cwd")")). Stop it first." >&2
    exit 1
  fi
done

targets=()
[ -d "$ROOT_DIR/app/node_modules" ] && targets+=("$ROOT_DIR/app/node_modules")
[ -d "$ROOT_DIR/.bun-cache" ] && targets+=("$ROOT_DIR/.bun-cache")
[ -d "$ROOT_DIR/.cache" ] && targets+=("$ROOT_DIR/.cache")
[ -d "$ROOT_DIR/.tmp" ] && targets+=("$ROOT_DIR/.tmp")
[ -e "$ROOT_DIR/port" ] && targets+=("$ROOT_DIR/port")
for tool in bun yt-dlp deno ffmpeg ffprobe .installed; do
  if [ -e "$ROOT_DIR/bin/$tool" ] || [ -L "$ROOT_DIR/bin/$tool" ]; then targets+=("$ROOT_DIR/bin/$tool"); fi
done
if [ "$DATA" = 1 ] && [ -d "$ROOT_DIR/data" ]; then targets+=("$ROOT_DIR/data"); fi

if [ "${#targets[@]}" = 0 ]; then echo "Nothing to remove."; exit 0; fi
echo "Will remove:"; printf '  %s\n' "${targets[@]}"
[ "$DATA" = 1 ] || echo "Keeping: $ROOT_DIR/data (use --remove-data to delete it)"
[ "$DRY" = 1 ] && { echo "(dry run, nothing removed)"; exit 0; }

if [ "$YES" != 1 ]; then
  read -r -p "Continue? [y/N] " answer || { echo; echo "error: no answer (the input is closed). Nothing was removed. Use --yes to skip the question." >&2; exit 1; }
  [[ "$answer" =~ ^[Yy]$ ]] || { echo "Cancelled."; exit 1; }
fi

for target in "${targets[@]}"; do rm -rf -- "$target"; done
rmdir "$ROOT_DIR/bin" 2>/dev/null || true

echo "Done."
echo "Left alone: anything you installed yourself (a Bun already on your system, ~/.bun), and ./backups if update.sh made any."
echo "To remove the program itself, delete this folder (this includes ./data if you kept it):"
printf '  rm -rf %q\n' "$ROOT_DIR"   # %q quotes the path so spaces and special characters are safe to paste
