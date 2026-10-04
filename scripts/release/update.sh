#!/usr/bin/env bash
# Updates this folder to the latest GitHub release of YT Zero.
# Your ./data is never touched; a copy of the database is saved first.
#
# Usage: bash update.sh [--check] [--yes]
#   --check  only say whether a newer release exists
#   --yes    do not ask for confirmation
set -euo pipefail

REPO="${YTZERO_REPO:-Fogbench/ytzero}"
API="${YTZERO_API:-https://api.github.com}"
DOWNLOAD="${YTZERO_DOWNLOAD:-https://github.com}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

die() { printf 'error: %s\n' "$*" >&2; exit 1; }

main() {
  local check=0 yes=0 arg
  for arg in "$@"; do
    case "$arg" in
      --check) check=1 ;;
      --yes) yes=1 ;;
      *) die "unknown option: $arg" ;;
    esac
  done

  [ -f "$ROOT_DIR/VERSION" ] && [ -f "$ROOT_DIR/app/package.json" ] || die "this does not look like a YT Zero folder."
  command -v curl >/dev/null || die "curl is required."
  export PATH="$ROOT_DIR/bin:$PATH"
  command -v bun >/dev/null || die "Bun was not found. Run install-linux.sh, or install Bun yourself."

  local cwd
  for cwd in /proc/[0-9]*/cwd; do
    if [ "$(readlink "$cwd" 2>/dev/null)" = "$ROOT_DIR/app" ]; then
      die "YT Zero is still running from this folder (pid $(basename "$(dirname "$cwd")")). Stop it first."
    fi
  done

  local current latest json
  current="$(tr -d '[:space:]' < "$ROOT_DIR/VERSION")"
  json="$(curl -fsSL "$API/repos/$REPO/releases/latest")" \
    || die "could not read the latest release from GitHub (no internet, or no release has been published yet)."
  latest="$(printf '%s' "$json" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
  [[ "$latest" =~ ^[0-9A-Za-z._-]+$ ]] || die "could not read a version from the latest release."

  if [ "$current" = "$latest" ]; then
    echo "Already on version ${current#v} (latest)"
    return 0
  fi
  echo "Installed: ${current#v}"
  echo "Latest:    ${latest#v}"
  if [ "$check" = 1 ]; then echo "An update is available. Run: bash update.sh"; return 0; fi
  if [ "$yes" != 1 ]; then
    local answer
    read -r -p "Update to ${latest#v}? [y/N] " answer
    [[ "$answer" =~ ^[Yy]$ ]] || { echo "Cancelled."; return 1; }
  fi

  local tmp name base
  tmp="$(mktemp -d)"; trap "rm -rf '$tmp'" EXIT
  name="ytzero-$latest"
  base="$DOWNLOAD/$REPO/releases/download/$latest"
  echo "==> downloading $name.tar.gz"
  curl -fsSL "$base/$name.tar.gz" -o "$tmp/$name.tar.gz" || die "could not download $name.tar.gz."
  curl -fsSL "$base/$name.tar.gz.sha256" -o "$tmp/$name.tar.gz.sha256" || die "the release has no checksum file, refusing to install it."
  if command -v sha256sum >/dev/null; then (cd "$tmp" && sha256sum -c "$name.tar.gz.sha256" >/dev/null) || die "checksum mismatch, nothing was changed."
  else (cd "$tmp" && shasum -a 256 -c "$name.tar.gz.sha256" >/dev/null) || die "checksum mismatch, nothing was changed."; fi
  echo "==> checksum verified"

  tar -xzf "$tmp/$name.tar.gz" -C "$tmp"
  local new="$tmp/$name" required
  for required in app/src app/package.json app/bun.lock ui/dist shared scripts VERSION LICENSE README.txt install-linux.sh start.sh uninstall.sh update.sh; do
    [ -e "$new/$required" ] || die "the release is incomplete (missing $required), nothing was changed."
  done

  if [ -d "$ROOT_DIR/data/db" ]; then
    local backup="$ROOT_DIR/backups/pre-update-$current-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup"
    cp -a "$ROOT_DIR/data/db" "$backup/db" || die "could not back up the database, nothing was changed."
    echo "==> database copied to ${backup#"$ROOT_DIR/"}"
  fi

  local d f
  for d in app/src ui/dist shared scripts; do
    rm -rf "$ROOT_DIR/$d"; mkdir -p "$(dirname "$ROOT_DIR/$d")"; cp -r "$new/$d" "$ROOT_DIR/$d"
  done
  # Single files are copied next to the target and renamed into place, so this
  # running script can be replaced safely (update.sh goes last).
  for f in app/package.json app/bun.lock VERSION LICENSE README.txt install-linux.sh start.sh uninstall.sh update.sh; do
    cp "$new/$f" "$ROOT_DIR/$f.new" && mv "$ROOT_DIR/$f.new" "$ROOT_DIR/$f"
  done

  [ -d "$ROOT_DIR/.bun-cache" ] && export BUN_INSTALL_CACHE_DIR="$ROOT_DIR/.bun-cache"
  echo "==> updating the server's libraries"
  (cd "$ROOT_DIR/app" && bun install --production --frozen-lockfile)

  echo "Updated from ${current#v} to ${latest#v}. Start it with: bash start.sh"
}

main "$@"
exit $?
