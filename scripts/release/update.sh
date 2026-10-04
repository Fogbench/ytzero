#!/usr/bin/env bash
# Updates this folder to the latest GitHub release of YT Zero, so that it ends up
# identical to a fresh install of that release: the program files, the libraries
# and the tools in ./bin (Bun, yt-dlp, Deno, ffmpeg), the tools at exactly the
# versions pinned in the release's tools.lock (never "latest"), checksum-verified.
# Only tools whose pinned version changed are replaced. (Linux only: on macOS the
# tools are your own installs and update.sh leaves them alone.)
# Your ./data is never touched; a copy of the database is saved first.
#
# Usage: bash update.sh [--check] [--yes] [--allow-downgrade]
#   --check            only say whether a newer release exists
#   --yes              do not ask for confirmation
#   --allow-downgrade  also go to an OLDER release (refused by default)
set -euo pipefail

REPO="${YTZERO_REPO:-Fogbench/ytzero}"
API="${YTZERO_API:-https://api.github.com}"
DOWNLOAD="${YTZERO_DOWNLOAD:-https://github.com}"
# pwd -P resolves symlinks, so this is the real path (what /proc/<pid>/cwd shows)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

msg() { printf '==> %s\n' "$*"; }   # tools-lib.sh calls msg and die too
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

# State the exit trap needs to know about.
TMP=""            # temp dir with the download, removed at exit (it lives in ./.tmp, see main)
LOCKED=0          # 1 while this run owns ./.update.lock
TOUCHED=0         # 1 from the moment the folder is changed until the update has finished
STAGE="$ROOT_DIR/.update-stage"   # new files wait here; replaced folders are parked here
LOCK="$ROOT_DIR/.update.lock"

# Delete one path, but only if it is inside this folder (never "/", never empty).
rm_path() {
  case "$1" in "$ROOT_DIR"/?*) ;; *) die "internal error: refusing to delete '$1'." ;; esac
  case "$1" in *..*) die "internal error: refusing to delete '$1'." ;; esac
  rm -rf -- "$1"
}

# sha256 of a file (tools-lib.sh has the same helper, but it only comes out of the
# tarball, which must be checked first).
sha256_of() {
  if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

# "git describe" builds look like v2.0.0-3-g1846a21 (3 commits after v2.0.0). They are
# rewritten to 2.0.0.3, which sort -V puts after 2.0.0 and before 2.0.1.
norm_version() {
  local v="${1#v}"
  if [[ "$v" =~ ^(.+)-([0-9]+)-g[0-9a-f]+(-dirty)?$ ]]; then v="${BASH_REMATCH[1]}.${BASH_REMATCH[2]}"; fi
  printf '%s' "$v"
}
# version_cmp <installed> <latest>: prints "same", "older" (installed is older than
# latest) or "newer" (installed is newer than latest).
version_cmp() {
  local a b lowest
  a="$(norm_version "$1")"; b="$(norm_version "$2")"
  if [ "$a" = "$b" ]; then echo same; return 0; fi
  lowest="$(printf '%s\n%s\n' "$a" "$b" | LC_ALL=C sort -V | head -n 1)" || lowest=""
  if [ "$lowest" = "$b" ]; then echo newer; else echo older; fi   # when sort -V is missing: treat as an update
}

# Only one update.sh may run at a time. mkdir is atomic, so it works as a lock; the
# pid inside tells a live run from a leftover of a run that was killed.
take_lock() {
  local pid=""
  if ! mkdir "$LOCK" 2>/dev/null; then
    [ -d "$LOCK" ] || die "cannot write to $ROOT_DIR (is it read-only?)."
    [ -f "$LOCK/pid" ] && pid="$(cat "$LOCK/pid" 2>/dev/null || true)"
    if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then
      rm_path "$LOCK"   # the run that made it is gone
      mkdir "$LOCK" 2>/dev/null || die "another update.sh just started. Try again in a minute."
    else
      die "another update.sh is already running${pid:+ (pid $pid)}. If you are sure it is not, delete the folder .update.lock and try again."
    fi
  fi
  LOCKED=1
  echo "$$" > "$LOCK/pid"
}

# Puts the folder back to what it was before the swap started: folders that were
# moved out of the way come back, and the half-copied new files are thrown away.
# Safe to run at any time while holding the lock; does nothing when there is nothing to do.
recover_stage() {
  local d n
  if [ -d "$STAGE/old" ]; then
    for d in "$STAGE/old"/* "$STAGE/old"/.[!.]*; do
      [ -e "$d" ] || continue
      n="$(basename "$d")"
      if [ -e "$ROOT_DIR/$n" ]; then rm_path "$ROOT_DIR/$n"; fi
      mv "$d" "$ROOT_DIR/$n"
    done
  fi
  if [ -e "$STAGE" ]; then rm_path "$STAGE"; fi
}

# Runs on every way out: normal end, die, Ctrl+C, kill.
cleanup() {
  local rc=$?
  trap - EXIT INT TERM HUP
  if [ "$LOCKED" = 1 ]; then recover_stage || true; fi   # put folders back if the swap was cut short; remove ./.update-stage
  if [ "$TOUCHED" = 1 ]; then
    echo "The update did not finish. Your data is safe. Run: bash update.sh again" >&2
  fi
  if [ "$LOCKED" = 1 ]; then rm -rf -- "$LOCK"; fi
  case "$TMP" in ""|/|.) ;; *) rm -rf -- "$TMP"; rmdir "$ROOT_DIR/.tmp" 2>/dev/null || true ;; esac
  exit "$rc"
}

# Keeps only the newest 5 copies made by updates (named pre-update-<version>-<date>-<time>).
# prune_backups <name>: <name> is the copy this run has just made. It always stays (it counts
# as one of the 5), even if the clock was wrong and older-looking names sort above it.
prune_backups() {
  local keep=5 d n rest current="$1"
  [ -d "$ROOT_DIR/backups" ] || return 0
  rest="$(for d in "$ROOT_DIR/backups"/pre-update-*; do
            [ -d "$d" ] || continue
            n="$(basename "$d")"
            [ "$n" != "$current" ] || continue
            [[ "$n" =~ ^pre-update-[0-9A-Za-z._-]+-([0-9]{8}-[0-9]{6})$ ]] || continue
            printf '%s %s\n' "${BASH_REMATCH[1]}" "$n"
          done | sort -r | tail -n +$keep | cut -d' ' -f2)"   # the others, newest first; the first keep-1 stay
  while IFS= read -r n; do
    [ -n "$n" ] || continue
    rm_path "$ROOT_DIR/backups/$n"
    echo "==> removed the old backup backups/$n (only the newest $keep are kept)"
  done <<<"$rest"
}

main() {
  local check=0 yes=0 allow_down=0 arg
  for arg in "$@"; do
    case "$arg" in
      --check) check=1 ;;
      --yes) yes=1 ;;
      --allow-downgrade) allow_down=1 ;;
      *) die "unknown option: $arg" ;;
    esac
  done

  trap cleanup EXIT
  trap 'echo >&2; echo "Stopped." >&2; exit 130' INT
  trap 'echo >&2; echo "Terminated." >&2; exit 143' TERM HUP
  take_lock
  recover_stage   # a run that was killed in the middle of the swap is repaired here

  [ -f "$ROOT_DIR/VERSION" ] && [ -f "$ROOT_DIR/app/package.json" ] || die "this does not look like a YT Zero folder."
  command -v curl >/dev/null || die "curl is required."
  export PATH="$ROOT_DIR/bin:$PATH"
  command -v bun >/dev/null || die "Bun was not found. Run install-linux.sh, or install Bun yourself."

  # A server counts when its working folder is app/ or any folder below it.
  local cwd proc_cwd
  for cwd in /proc/[0-9]*/cwd; do
    proc_cwd="$(readlink "$cwd" 2>/dev/null || true)"
    if [ "$proc_cwd" = "$ROOT_DIR/app" ] || [[ "$proc_cwd" == "$ROOT_DIR/app/"* ]]; then
      die "YT Zero is still running from this folder (pid $(basename "$(dirname "$cwd")")). Stop it first."
    fi
  done

  local current latest json rel
  current="$(tr -d '[:space:]' < "$ROOT_DIR/VERSION")"
  json="$(curl -fsSL "$API/repos/$REPO/releases/latest")" \
    || die "could not read the latest release from GitHub (no internet, or no release has been published yet)."
  latest="$(printf '%s' "$json" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
  [[ "$latest" =~ ^[0-9A-Za-z._-]+$ ]] || die "could not read a version from the latest release."

  rel="$(version_cmp "$current" "$latest")"
  if [ "$rel" = same ]; then
    echo "Already on version ${current#v} (latest)"
    return 0
  fi
  echo "Installed: ${current#v}"
  echo "Latest:    ${latest#v}"
  if [ "$rel" = newer ]; then
    # The database may have been changed by the newer version; an older one may not understand it.
    if [ "$check" = 1 ]; then echo "No update: the installed version is newer than the latest release."; return 0; fi
    if [ "$allow_down" != 1 ]; then
      echo "The installed version is newer than the latest release, so this would be a downgrade." >&2
      echo "Refusing. A downgrade can break a database that the newer version already changed." >&2
      echo "If you really want it, run: bash update.sh --allow-downgrade" >&2
      return 1
    fi
  fi
  if [ "$check" = 1 ]; then echo "An update is available. Run: bash update.sh"; return 0; fi
  if [ "$yes" != 1 ]; then
    local answer verb="Update"
    [ "$rel" = newer ] && verb="Downgrade"
    printf '%s to %s? [y/N] ' "$verb" "${latest#v}"   # printed here: read -p shows nothing when input is not a terminal
    read -r answer || { echo; die "no answer (the input is closed). Nothing was changed. Use --yes to skip the question."; }
    [[ "$answer" =~ ^[Yy]$ ]] || { echo "Cancelled."; return 1; }
  fi

  local tmp name base got want
  # The download is unpacked in a temporary folder INSIDE this folder (./.tmp), not in /tmp.
  # So the new files and tools are on the same disk as the folder: moving them into place
  # later is a quick rename, which cannot fail halfway because the disk is full.
  mkdir -p "$ROOT_DIR/.tmp" || die "cannot write to $ROOT_DIR (is it read-only?)."
  tmp="$(mktemp -d "$ROOT_DIR/.tmp/update.XXXXXX")" || die "cannot create a temporary folder in $ROOT_DIR/.tmp."
  TMP="$tmp"
  export TMPDIR="$tmp"   # the test runs of the new tools leave nothing in /tmp either
  name="ytzero-$latest"
  base="$DOWNLOAD/$REPO/releases/download/$latest"
  echo "==> downloading $name.tar.gz"
  curl -fsSL "$base/$name.tar.gz" -o "$tmp/$name.tar.gz" || die "could not download $name.tar.gz."
  curl -fsSL "$base/$name.tar.gz.sha256" -o "$tmp/$name.tar.gz.sha256" || die "the release has no checksum file, refusing to install it."
  # Compare the hash written in the .sha256 file with the real hash of the tarball. (sha256sum -c
  # would also pass a file that names some other file, like /dev/null.)
  want=""; read -r want _ < "$tmp/$name.tar.gz.sha256" || true
  [[ "$want" =~ ^[0-9A-Fa-f]{64}$ ]] || die "the checksum file is not a sha256 checksum, nothing was changed."
  want="$(printf '%s' "$want" | tr 'A-F' 'a-f')"
  got="$(sha256_of "$tmp/$name.tar.gz")"
  [ "$got" = "$want" ] || die "checksum mismatch, nothing was changed."
  echo "==> checksum verified"

  tar -xzf "$tmp/$name.tar.gz" -C "$tmp"
  local new="$tmp/$name" required
  for required in app/src app/package.json app/bun.lock ui/dist shared scripts/tools-lib.sh tools.lock VERSION LICENSE README.txt install-linux.sh start.sh uninstall.sh update.sh; do
    [ -e "$new/$required" ] || die "the release is incomplete (missing $required), nothing was changed."
  done

  # Tools: the new release's tools.lock decides. A tool is replaced only when its
  # pinned version differs from the one recorded in ./bin/.installed (what the
  # last install or update pinned, NOT what the binary reports, so a yt-dlp the
  # app updated by itself is not downgraded). No record, a different record or a
  # missing file in ./bin all mean "install the pinned version". Copies of the
  # tools elsewhere on your PATH are ignored, as in install-linux.sh. New downloads
  # are verified and test-run BEFORE anything changes. A missing ./bin/.installed
  # simply means "nothing recorded".
  # The pinned tools are Linux builds. On any other system (macOS) this whole step is
  # skipped: there is no ./bin there, so every tool would count as missing, and the
  # Linux builds would be downloaded and then refuse to run.
  # shellcheck source=/dev/null
  . "$new/scripts/tools-lib.sh"
  local tool arch pinned recorded changed=() fetched="$tmp/newbin"
  if [ "$(uname -s)" != Linux ]; then
    echo "==> tools: not touched on $(uname -s); Bun, yt-dlp, Deno and ffmpeg come from your own installs (see the MACOS section of README.txt)"
  else
    tl_machine >/dev/null || die "unsupported CPU $(uname -m), nothing was changed."
    mkdir -p "$fetched"
    for tool in $TL_TOOLS; do
      arch="$(tl_arch "$tool")"
      pinned="$(tl_version "$new/tools.lock" "$tool" "$arch")" || die "the release's tools.lock has no $tool for this CPU, nothing was changed."
      recorded="$(tl_installed_version "$tool")"
      if tl_in_bin "$tool" "$pinned"; then
        echo "==> $tool: already at the pinned version $pinned"
      else
        echo "==> $tool: ${recorded:-unknown version} -> $pinned"
        tl_fetch "$new/tools.lock" "$tool" "$arch" "$fetched" || die "could not get $tool $pinned, nothing was changed."
        changed+=("$tool")
      fi
    done
  fi

  # Backup of what the database holds, kept (newest 5) in ./backups.
  if [ -d "$ROOT_DIR/data/db" ] || [ -f "$ROOT_DIR/data/database-state.json" ]; then
    local backup="" tries=0
    mkdir -p "$ROOT_DIR/backups"
    # mkdir without -p fails if the name exists (a rerun within the same second): wait and take a new name
    until backup="$ROOT_DIR/backups/pre-update-$current-$(date +%Y%m%d-%H%M%S)"; mkdir "$backup" 2>/dev/null; do
      tries=$((tries + 1)); [ "$tries" -lt 5 ] || die "could not create a backup folder in ./backups, nothing was changed."
      sleep 1
    done
    if [ -d "$ROOT_DIR/data/db" ]; then
      cp -a "$ROOT_DIR/data/db" "$backup/db" || die "could not back up the database, nothing was changed."
    fi
    if [ -f "$ROOT_DIR/data/database-state.json" ]; then
      cp -a "$ROOT_DIR/data/database-state.json" "$backup/database-state.json" || die "could not back up data/database-state.json, nothing was changed."
    fi
    echo "==> database copied to ${backup#"$ROOT_DIR/"}"
    prune_backups "$(basename "$backup")"
  fi

  # Mirror the release: every top-level entry of the tarball replaces the one here,
  # except the folders that hold your data, tools and caches, and VERSION (written
  # last, see below). Folders are swapped whole (so app/node_modules goes too and is
  # rebuilt below). A top-level entry that the OLD release shipped and the new one no
  # longer does is removed too (see "gone" below), so the result matches a fresh download.
  # Two passes, so that a failure (full disk, Ctrl+C) cannot leave half an update:
  #   pass 1: copy everything new into ./.update-stage (the old files are not touched yet)
  #   pass 2: rename the copies into place. Renames are quick and do not need space.
  # If a stop happens in pass 2, the folders that were moved aside are put back (see
  # recover_stage). VERSION is only changed after the libraries are installed, so until
  # then a rerun of update.sh sees the old version and does the whole update again.
  local entry n f
  rm_path "$STAGE"; mkdir -p "$STAGE/new" "$STAGE/newbin"
  while IFS= read -r -d '' entry; do
    n="$(basename "$entry")"
    case "$n" in data|backups|bin|.cache|.bun-cache|VERSION|.update-stage|.update.lock) continue ;; esac
    cp -r "$entry" "$STAGE/new/$n" || die "could not copy the new files (is the disk full?), nothing was changed."
  done < <(find "$new" -mindepth 1 -maxdepth 1 -print0)
  if [ "${#changed[@]}" -gt 0 ]; then mkdir -p "$ROOT_DIR/bin"; fi
  for tool in ${changed[@]+"${changed[@]}"}; do
    for f in $(tl_files "$tool"); do
      mv "$fetched/$f" "$STAGE/newbin/$f" || die "could not stage the new $tool, nothing was changed."   # same disk: a rename
    done
  done

  # Which top-level entries did the old release ship that the new one does not? Each
  # release lists its top-level entries in a file called MANIFEST (one name per line).
  # Only names in the OLD list can be removed, so a file of yours that no release ever
  # shipped is never touched. Without the old list (an install made before MANIFEST
  # existed) or without the new one, nothing is removed.
  local gone=() drop_manifest=0
  if [ -f "$ROOT_DIR/MANIFEST" ] && [ -f "$new/MANIFEST" ]; then
    while IFS= read -r n || [ -n "$n" ]; do
      n="${n%$'\r'}"
      [[ "$n" =~ ^[0-9A-Za-z._-]+$ ]] || continue          # plain names only: no paths, no spaces
      case "$n" in .|..) continue ;; esac
      # your data, tools, caches and this script's own files are never removed
      case "$n" in data|backups|bin|.cache|.bun-cache|.tmp|.update-stage|.update.lock|port|ytzero.env|node_modules|VERSION|VERSION.new|MANIFEST) continue ;; esac
      if grep -qxF -- "$n" "$new/MANIFEST"; then continue; fi   # the new release still ships it
      if [ -e "$new/$n" ]; then continue; fi
      case " ${gone[*]-} " in *" $n "*) continue ;; esac     # listed twice
      if [ -e "$ROOT_DIR/$n" ] || [ -L "$ROOT_DIR/$n" ]; then gone+=("$n"); fi
    done < "$ROOT_DIR/MANIFEST"
  elif [ -f "$ROOT_DIR/MANIFEST" ]; then
    drop_manifest=1   # the new release has no MANIFEST: the old list would only go stale
  fi
  if [ "${#gone[@]}" -gt 0 ]; then
    echo "==> the new release no longer ships: ${gone[*]} (removed; a copy is kept until the update has finished)"
  fi

  TOUCHED=1
  mkdir -p "$STAGE/old"
  for entry in "$STAGE/new"/* "$STAGE/new"/.[!.]*; do
    [ -e "$entry" ] || continue
    n="$(basename "$entry")"
    if [ -d "$entry" ]; then
      if [ -e "$ROOT_DIR/$n" ]; then mv "$ROOT_DIR/$n" "$STAGE/old/$n"; fi
      mv "$entry" "$ROOT_DIR/$n"
    else
      # (a folder that the release turned into a file is moved aside first)
      if [ -d "$ROOT_DIR/$n" ] && [ ! -L "$ROOT_DIR/$n" ]; then mv "$ROOT_DIR/$n" "$STAGE/old/$n"; fi
      # The old MANIFEST is kept aside too: if this update is cut short, the next run still needs to know what the old release shipped.
      if [ "$n" = MANIFEST ] && [ -f "$ROOT_DIR/MANIFEST" ]; then mv "$ROOT_DIR/MANIFEST" "$STAGE/old/MANIFEST"; fi
      mv -f "$entry" "$ROOT_DIR/$n"   # a file is replaced in one step; this running script can be replaced safely
    fi
  done
  # Entries the new release dropped: moved aside (not deleted), so recover_stage can put them back.
  # "mv" moves a symlink itself, never what it points to.
  for n in ${gone[@]+"${gone[@]}"}; do
    mv "$ROOT_DIR/$n" "$STAGE/old/$n"
  done
  if [ "$drop_manifest" = 1 ]; then mv "$ROOT_DIR/MANIFEST" "$STAGE/old/MANIFEST"; fi
  mv "$STAGE/old" "$STAGE/trash"   # from here on the old folders are not wanted back
  rm_path "$STAGE/trash"

  # The tools were downloaded, checksum-verified and test-run above, so they stay even
  # if the libraries below fail. Each one is recorded in bin/.installed right away.
  for tool in ${changed[@]+"${changed[@]}"}; do
    for f in $(tl_files "$tool"); do
      mv -f "$STAGE/newbin/$f" "$ROOT_DIR/bin/$f"
    done
    tl_record "$tool" "$(tl_version "$ROOT_DIR/tools.lock" "$tool" "$(tl_arch "$tool")")"
  done
  rm_path "$STAGE"

  echo "==> reinstalling the server's libraries"
  export BUN_INSTALL_CACHE_DIR="$ROOT_DIR/.bun-cache"
  rm_path "$ROOT_DIR/app/node_modules"
  if ! (cd "$ROOT_DIR/app" && bun install --production --frozen-lockfile); then
    # VERSION still names the old release, so a rerun does the update again.
    TOUCHED=0
    die "the program files were updated but installing the libraries failed (no internet?). The new tools were kept. Run: bash update.sh again"
  fi

  # Last step: only now does this folder call itself the new version.
  cp "$new/VERSION" "$ROOT_DIR/VERSION.new" || die "could not write VERSION. Run: bash update.sh again"
  mv -f "$ROOT_DIR/VERSION.new" "$ROOT_DIR/VERSION" || die "could not write VERSION. Run: bash update.sh again"
  TOUCHED=0

  echo "Updated from ${current#v} to ${latest#v}. Start it with: bash start.sh"
}

main "$@"
exit $?
