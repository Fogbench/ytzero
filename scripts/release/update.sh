#!/usr/bin/env bash
# Updates this folder to the latest GitHub release of YT Zero, so that it ends up
# identical to a fresh install of that release: the program files, the libraries
# and the tools in ./bin (Bun, yt-dlp, Deno, ffmpeg), the tools at exactly the
# versions pinned in the release's tools.lock (never "latest"), checksum-verified.
# Only tools whose pinned version changed are replaced.
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
  for required in app/src app/package.json app/bun.lock ui/dist shared scripts/tools-lib.sh tools.lock VERSION LICENSE README.txt install-linux.sh start.sh uninstall.sh update.sh; do
    [ -e "$new/$required" ] || die "the release is incomplete (missing $required), nothing was changed."
  done

  # Tools: the new release's tools.lock decides. A tool is replaced only when its
  # pinned version differs from the one recorded in ./bin/.installed (what the
  # last install or update pinned, NOT what the binary reports, so a yt-dlp the
  # app updated by itself is not downgraded). A tool found elsewhere on your PATH
  # is left alone. New downloads are verified and test-run BEFORE anything changes.
  # shellcheck source=/dev/null
  . "$new/scripts/tools-lib.sh"
  tl_machine >/dev/null || die "unsupported CPU $(uname -m), nothing was changed."
  local tool arch pinned recorded files changed=() stage="$tmp/newbin"
  mkdir -p "$stage"
  for tool in $TL_TOOLS; do
    arch="$(tl_arch "$tool")"
    pinned="$(tl_version "$new/tools.lock" "$tool" "$arch")" || die "the release's tools.lock has no $tool for this CPU, nothing was changed."
    recorded="$(tl_installed_version "$tool")"
    if [ -z "$recorded" ] && [ ! -e "$ROOT_DIR/bin/$tool" ] && [ -n "$(tl_system_path "$tool")" ]; then
      echo "==> $tool: found on your system ($(tl_system_path "$tool")), left alone"
    elif [ "$recorded" = "$pinned" ] && [ -e "$ROOT_DIR/bin/$tool" ]; then
      echo "==> $tool: already at the pinned version $pinned"
    else
      echo "==> $tool: ${recorded:-unknown version} -> $pinned"
      tl_fetch "$new/tools.lock" "$tool" "$arch" "$stage" || die "could not get $tool $pinned, nothing was changed."
      changed+=("$tool")
    fi
  done

  if [ -d "$ROOT_DIR/data/db" ]; then
    local backup="$ROOT_DIR/backups/pre-update-$current-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup"
    cp -a "$ROOT_DIR/data/db" "$backup/db" || die "could not back up the database, nothing was changed."
    echo "==> database copied to ${backup#"$ROOT_DIR/"}"
  fi

  # Mirror the release: every top-level entry of the tarball replaces the one here,
  # except the folders that hold your data, tools and caches. Folders are swapped
  # whole (so app/node_modules goes too and is rebuilt below); files are copied
  # next to the target and renamed into place, so this running script can be
  # replaced safely.
  local entry n
  while IFS= read -r -d '' entry; do
    n="$(basename "$entry")"
    case "$n" in data|backups|bin|.cache|.bun-cache) continue ;; esac
    if [ -d "$entry" ]; then
      rm -rf "$ROOT_DIR/$n.new" "$ROOT_DIR/$n.old"
      cp -r "$entry" "$ROOT_DIR/$n.new"
      [ -e "$ROOT_DIR/$n" ] && mv "$ROOT_DIR/$n" "$ROOT_DIR/$n.old"
      mv "$ROOT_DIR/$n.new" "$ROOT_DIR/$n"
      rm -rf "$ROOT_DIR/$n.old"
    else
      cp "$entry" "$ROOT_DIR/$n.new" && mv "$ROOT_DIR/$n.new" "$ROOT_DIR/$n"
    fi
  done < <(find "$new" -mindepth 1 -maxdepth 1 -print0)

  # Swap in the new tools; the old ones are kept until the libraries install works.
  local old="$ROOT_DIR/bin/.previous" f
  rm -rf "$old"; mkdir -p "$old" "$ROOT_DIR/bin"
  [ -f "$TL_INSTALLED" ] && cp "$TL_INSTALLED" "$old/.installed"
  for tool in ${changed[@]+"${changed[@]}"}; do
    for f in $(tl_files "$tool"); do
      [ -e "$ROOT_DIR/bin/$f" ] && mv "$ROOT_DIR/bin/$f" "$old/$f"
      mv "$stage/$f" "$ROOT_DIR/bin/$f"
    done
    tl_record "$tool" "$(tl_version "$ROOT_DIR/tools.lock" "$tool" "$(tl_arch "$tool")")"
  done

  echo "==> reinstalling the server's libraries"
  export BUN_INSTALL_CACHE_DIR="$ROOT_DIR/.bun-cache"
  rm -rf "$ROOT_DIR/app/node_modules"
  if ! (cd "$ROOT_DIR/app" && bun install --production --frozen-lockfile); then
    for tool in ${changed[@]+"${changed[@]}"}; do
      for f in $(tl_files "$tool"); do
        rm -f "$ROOT_DIR/bin/$f"; [ -e "$old/$f" ] && mv "$old/$f" "$ROOT_DIR/bin/$f"
      done
    done
    if [ -f "$old/.installed" ]; then mv "$old/.installed" "$TL_INSTALLED"; else rm -f "$TL_INSTALLED"; fi
    rm -rf "$old"
    die "the program files were updated but installing the libraries failed; the old tools were put back. Run: bash install-linux.sh"
  fi
  rm -rf "$old"

  echo "Updated from ${current#v} to ${latest#v}. Start it with: bash start.sh"
}

main "$@"
exit $?
