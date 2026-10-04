#!/usr/bin/env bash
# End-to-end test of update.sh against a fake GitHub on 127.0.0.1. Not shipped in the tarball.
# Builds v2.0.0 (real package-release.sh from a `git archive HEAD` copy plus the working-tree scripts/release/*.sh, so the repo
# working tree is untouched) and a faux v2.0.1, does a real install-linux.sh of 2.0.0 in a
# temp dir with a fake HOME (downloads Bun, yt-dlp, Deno, ffmpeg: needs internet), then
# checks update.sh, including tools.lock handling: a changed pin is replaced (served from a local fake
# artifact; the lock of a faux release simply points its url at 127.0.0.1, so no override variable is needed),
# unchanged pins are untouched, a wrong sha256 is refused. Usage: bash scripts/release/test-update.sh
# Env: KEEP_TMP=1 keeps the temp dir; TEST_TMPDIR=<dir> parent for it (default $TMPDIR or /tmp).
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
T="$(mktemp -d "${TEST_TMPDIR:-${TMPDIR:-/tmp}}/ytzero-update-test.XXXXXX")"
SERVER_PID=""; DUMMY_PID=""
START=$SECONDS
PASS=0; FAIL=0

cleanup() {
  [ -n "$DUMMY_PID" ] && kill "$DUMMY_PID" 2>/dev/null
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
  if [ "${KEEP_TMP:-0}" = 1 ]; then echo "kept temp dir: $T"; else rm -rf "$T"; fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

pass() { PASS=$((PASS+1)); echo "PASS: $*"; }
fail() { FAIL=$((FAIL+1)); echo "FAIL: $*"; }
check() { local name="$1"; shift; if "$@"; then pass "$name"; else fail "$name"; fi; }
die() { echo "FATAL: $*" >&2; exit 2; }

# checksum of every file/symlink in a tree (paths relative), to detect any change
tree_sum() { (cd "$1" && find . \( -type f -o -type l \) -print0 | sort -z | xargs -0 sha256sum 2>/dev/null; find . -type l -printf '%p -> %l\n' | sort) | sha256sum | cut -d' ' -f1; }

INST="$T/inst"; PRISTINE="$T/pristine"; WWW="$T/www"; HOME_FAKE="$T/home"
mkdir -p "$WWW" "$HOME_FAKE" "$T/build"
FAKE_BASE_PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# ---------- 1. build v2.0.0 with the real packaging script ----------
echo "== building v2.0.0"
git -C "$REPO_ROOT" archive --prefix=src/ HEAD | tar -x -C "$T/build" || die "git archive failed"
cp "$REPO_ROOT"/scripts/release/*.sh "$REPO_ROOT"/scripts/release/tools.lock "$T/build/src/scripts/release/"   # include uncommitted edits to the release scripts
cp "$REPO_ROOT/scripts/package-release.sh" "$T/build/src/scripts/"
(cd "$T/build/src" && bash scripts/package-release.sh v2.0.0 >"$T/build/package.log" 2>&1) || { tail -20 "$T/build/package.log"; die "package-release.sh failed"; }
REL="$T/build/src/release"
[ -f "$REL/ytzero-v2.0.0.tar.gz" ] && [ -f "$REL/ytzero-v2.0.0.tar.gz.sha256" ] || die "tarball missing"
tar -tzf "$REL/ytzero-v2.0.0.tar.gz" | grep -q 'test-update.sh' && fail "test-update.sh must not be in the tarball" || pass "test-update.sh not shipped in tarball"

# ---------- 2. faux releases (edited copies, repacked like package-release.sh) ----------
# fake pinned yt-dlp artifact, served locally; its sha256 goes into tools.lock
PORT="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1])')"
mkdir -p "$WWW/art"
printf '#!/bin/sh\necho 9999.01.01\n' > "$WWW/art/yt-dlp"
FAKE_SHA="$(sha256sum "$WWW/art/yt-dlp" | cut -d' ' -f1)"
# build_faux <version> <good|same|badsha>
#   good:   yt-dlp pin changed to the fake artifact (correct sha256), a top-level file added
#   same:   tools.lock identical to v2.0.0
#   badsha: yt-dlp pin changed, but with a wrong sha256
build_faux() {
  local v="$1" mode="$2" F="$T/faux/ytzero-$1" sha
  mkdir -p "$T/faux/x-$v" && tar -xzf "$REL/ytzero-v2.0.0.tar.gz" -C "$T/faux/x-$v" && mv "$T/faux/x-$v/ytzero-v2.0.0" "$F" || die "faux extract failed"
  echo "update marker ${v#v}" > "$F/app/src/UPDATE-MARKER.txt"
  sed -i "s/\"version\": *\"[^\"]*\"/\"version\": \"${v#v}\"/" "$F/app/package.json"
  echo "$v" > "$F/VERSION"
  if [ "$mode" != same ]; then
    sha="$FAKE_SHA"; [ "$mode" = badsha ] && sha="$(printf '%064d' 7)"
    grep -v '^yt-dlp ' "$F/tools.lock" > "$F/tools.lock.new"
    for arch in x86_64 aarch64; do echo "yt-dlp 9999.01.01 $arch http://127.0.0.1:$PORT/art/yt-dlp $sha" >> "$F/tools.lock.new"; done
    mv "$F/tools.lock.new" "$F/tools.lock"
    echo "new top-level file" > "$F/NEW-TOPLEVEL.txt"
  fi
  tar -C "$T/faux" -czf "$T/faux/ytzero-$v.tar.gz" "ytzero-$v"
  (cd "$T/faux" && sha256sum "ytzero-$v.tar.gz" > "ytzero-$v.tar.gz.sha256")
}
echo "== building faux v2.0.1 (changed pin), v2.0.2 (same pins), v2.0.3 (bad sha256)"
build_faux v2.0.1 good; build_faux v2.0.2 same; build_faux v2.0.3 badsha

# ---------- 3. fake GitHub ----------
D="$WWW/dl/Fogbench/ytzero/releases/download"
mkdir -p "$D/v2.0.0" "$D/v2.0.1" "$D/v2.0.2" "$D/v2.0.3" "$WWW/api/repos/Fogbench/ytzero/releases"
cp "$REL"/ytzero-v2.0.0.tar.gz* "$D/v2.0.0/"
for v in v2.0.1 v2.0.2 v2.0.3; do cp "$T/faux"/ytzero-$v.tar.gz* "$D/$v/"; done
set_latest() { printf '{"tag_name":"%s"}\n' "$1" > "$WWW/api/repos/Fogbench/ytzero/releases/latest"; }
set_latest v2.0.0
(cd "$WWW" && exec python3 -m http.server "$PORT" --bind 127.0.0.1 >"$T/server.log" 2>&1) &
SERVER_PID=$!
for _ in $(seq 50); do curl -fs "http://127.0.0.1:$PORT/api/repos/Fogbench/ytzero/releases/latest" >/dev/null 2>&1 && break; sleep 0.1; done
curl -fs "http://127.0.0.1:$PORT/api/repos/Fogbench/ytzero/releases/latest" >/dev/null || die "fake GitHub did not start"
echo "== fake GitHub on 127.0.0.1:$PORT"

# ---------- 4. real install of 2.0.0 ----------
echo "== installing 2.0.0 with install-linux.sh (slow: downloads tools)"
mkdir "$T/ext" && tar -xzf "$REL/ytzero-v2.0.0.tar.gz" -C "$T/ext" && mv "$T/ext/ytzero-v2.0.0" "$INST" || die "extract failed"
run_in() { # run a script from $INST with a clean env: fake HOME, no bun on PATH, fake GitHub
  local script="$1"; shift
  (cd "$INST" && env -i HOME="$HOME_FAKE" PATH="$FAKE_BASE_PATH" TMPDIR="$T" \
    YTZERO_API="http://127.0.0.1:$PORT/api" YTZERO_DOWNLOAD="http://127.0.0.1:$PORT/dl" \
    bash "$INST/$script" "$@")
}
run_in install-linux.sh --yes >"$T/install.log" 2>&1 || { tail -20 "$T/install.log"; die "install-linux.sh failed"; }
[ -x "$INST/bin/bun" ] && [ -d "$INST/app/node_modules" ] || die "install incomplete"
pass "install-linux.sh installed 2.0.0 (bun $("$INST/bin/bun" --version))"
check "install wrote bin/.installed with the four pinned tools" bash -c '[ "$(cut -d" " -f1 "$1/bin/.installed" | sort | tr "\n" " ")" = "bun deno ffmpeg yt-dlp " ]' _ "$INST"
check "installed versions match tools.lock" bash -c 'cd "$1"; for t in bun deno yt-dlp ffmpeg; do v="$(grep "^$t " bin/.installed | cut -d" " -f2)"; grep -q "^$t $v " tools.lock || exit 1; done' _ "$INST"
check "bin/bun reports the pinned version" [ "$("$INST/bin/bun" --version)" = "$(grep -m1 '^bun ' "$INST/tools.lock" | cut -d' ' -f2)" ]

mkdir -p "$INST/data/db" "$INST/data/downloads/sub"
python3 - "$INST/data/db/ytzero.sqlite" <<'PY'
import sqlite3, sys
c = sqlite3.connect(sys.argv[1]); c.execute("create table t(x)"); c.executemany("insert into t values(?)", [(i,) for i in range(100)]); c.commit(); c.close()
PY
echo "some user file" > "$INST/data/downloads/sub/video.txt"; echo "settings" > "$INST/data/config.json"
cp -a "$INST" "$PRISTINE"
restore() { rm -rf "$INST"; cp -a "$PRISTINE" "$INST"; }
data_sum() { (cd "$INST/data" && find . -type f -print0 | sort -z | xargs -0 sha256sum) | sha256sum | cut -d' ' -f1; }
ver() { tr -d '[:space:]' < "$INST/VERSION"; }

# ---------- 5. cases ----------
echo "== case 1: already on latest"
set_latest v2.0.0; before="$(tree_sum "$INST")"
out="$(run_in update.sh 2>&1)"; rc=$?
check "1 exit 0" [ $rc -eq 0 ]
check "1 prints 'Already on version 2.0.0 (latest)'" grep -qF "Already on version 2.0.0 (latest)" <<<"$out"
check "1 nothing changed" [ "$(tree_sum "$INST")" = "$before" ]

echo "== case 2: --check with 2.0.1 available"
set_latest v2.0.1; before="$(tree_sum "$INST")"
out="$(run_in update.sh --check 2>&1)"; rc=$?
check "2 exit 0" [ $rc -eq 0 ]
check "2 reports update available" grep -q "An update is available" <<<"$out"
check "2 shows Latest 2.0.1" grep -qE "Latest: +2\.0\.1" <<<"$out"
check "2 nothing changed" [ "$(tree_sum "$INST")" = "$before" ]

echo "== case 3: real update --yes"
dbefore="$(data_sum)"
touch "$INST/app/node_modules/.stale-marker"
tsum() { sha256sum "$INST/bin/$1" | cut -d' ' -f1; }
bun_s="$(tsum bun)"; deno_s="$(tsum deno)"; ffm_s="$(tsum ffmpeg)"; ffp_s="$(tsum ffprobe)"; old_ytdlp="$(tsum yt-dlp)"
out="$(run_in update.sh --yes 2>&1)"; rc=$?
echo "$out" | sed 's/^/   | /' | tail -12
check "3 exit 0" [ $rc -eq 0 ]
check "3 marker installed" [ "$(cat "$INST/app/src/UPDATE-MARKER.txt" 2>/dev/null)" = "update marker 2.0.1" ]
check "3 VERSION is v2.0.1" [ "$(ver)" = "v2.0.1" ]
check "3 app/package.json version 2.0.1" grep -q '"version": "2.0.1"' "$INST/app/package.json"
bk="$(ls -d "$INST"/backups/pre-update-v2.0.0-*/db 2>/dev/null | head -n 1)"
check "3 database backup in ./backups" [ -n "$bk" ] && [ -f "$bk/ytzero.sqlite" ]
check "3 backup db readable (100 rows)" [ "$(python3 -c 'import sqlite3,sys; print(sqlite3.connect(sys.argv[1]).execute("select count(*) from t").fetchone()[0])' "${bk:-/nonexistent}/ytzero.sqlite" 2>/dev/null)" = 100 ]
check "3 data/ unchanged" [ "$(data_sum)" = "$dbefore" ]
check "3 unchanged tools untouched (bun, deno, ffmpeg, ffprobe)" [ "$(tsum bun)" = "$bun_s" ] && [ "$(tsum deno)" = "$deno_s" ] && [ "$(tsum ffmpeg)" = "$ffm_s" ] && [ "$(tsum ffprobe)" = "$ffp_s" ]
check "3 changed tool (yt-dlp) replaced" [ "$(tsum yt-dlp)" != "$old_ytdlp" ] && [ "$("$INST/bin/yt-dlp" --version)" = "9999.01.01" ]
check "3 bin/.installed updated for yt-dlp only" bash -c 'grep -qx "yt-dlp 9999.01.01" "$1/bin/.installed" && [ "$(wc -l < "$1/bin/.installed")" = 4 ] && grep -q "^bun " "$1/bin/.installed"' _ "$INST"
check "3 tools.lock is the new one" grep -q "^yt-dlp 9999.01.01 " "$INST/tools.lock"
check "3 new top-level file appeared" [ "$(cat "$INST/NEW-TOPLEVEL.txt" 2>/dev/null)" = "new top-level file" ]
check "3 node_modules rebuilt (stale marker gone, libraries present)" [ ! -e "$INST/app/node_modules/.stale-marker" ] && [ -n "$(ls "$INST/app/node_modules" 2>/dev/null)" ]
check "3 bin/.previous cleaned up" [ ! -e "$INST/bin/.previous" ]
check "3 no leftover *.new files" [ -z "$(find "$INST" -maxdepth 2 \( -name '*.new' -o -name '*.old' \) -not -path '*/node_modules/*')" ]
check "3 second run says already latest" grep -qF "Already on version 2.0.1 (latest)" <<<"$(run_in update.sh 2>&1)"

echo "== case 4: missing .sha256 refused"
restore; set_latest v2.0.1
mv "$D/v2.0.1/ytzero-v2.0.1.tar.gz.sha256" "$T/sha256.saved"
before="$(tree_sum "$INST")"
out="$(run_in update.sh --yes 2>&1)"; rc=$?
check "4 exit non-zero" [ $rc -ne 0 ]
check "4 says no checksum file" grep -q "no checksum file" <<<"$out"
check "4 folder unchanged" [ "$(tree_sum "$INST")" = "$before" ]
mv "$T/sha256.saved" "$D/v2.0.1/ytzero-v2.0.1.tar.gz.sha256"

echo "== case 5: wrong checksum refused"
restore
cp "$D/v2.0.1/ytzero-v2.0.1.tar.gz.sha256" "$T/sha256.saved"
printf '%064d  ytzero-v2.0.1.tar.gz\n' 0 > "$D/v2.0.1/ytzero-v2.0.1.tar.gz.sha256"
before="$(tree_sum "$INST")"
out="$(run_in update.sh --yes 2>&1)"; rc=$?
check "5 exit non-zero" [ $rc -ne 0 ]
check "5 says checksum mismatch" grep -q "checksum mismatch" <<<"$out"
check "5 folder unchanged" [ "$(tree_sum "$INST")" = "$before" ]
cp "$T/sha256.saved" "$D/v2.0.1/ytzero-v2.0.1.tar.gz.sha256"

echo "== case 6: running server refused"
restore
(cd "$INST/app" && exec sleep 600) & DUMMY_PID=$!   # update.sh looks for a process whose cwd is <folder>/app
sleep 0.3
before="$(tree_sum "$INST")"
out="$(run_in update.sh --yes 2>&1)"; rc=$?
check "6 exit non-zero" [ $rc -ne 0 ]
check "6 says still running" grep -q "still running" <<<"$out"
check "6 folder unchanged" [ "$(tree_sum "$INST")" = "$before" ]
kill "$DUMMY_PID" 2>/dev/null; wait "$DUMMY_PID" 2>/dev/null; DUMMY_PID=""
restore
check "6b update works again once stopped" bash -c "$(declare -f run_in); T='$T' INST='$INST' HOME_FAKE='$HOME_FAKE' FAKE_BASE_PATH='$FAKE_BASE_PATH' PORT='$PORT'; run_in update.sh --yes >/dev/null 2>&1"

echo "== case 7: same pins in the new release, self-updated yt-dlp is not downgraded"
restore; set_latest v2.0.2
printf '#!/bin/sh\necho 2099.12.31-selfupdated\n' > "$INST/bin/yt-dlp"; chmod 755 "$INST/bin/yt-dlp"
ytd="$(sha256sum "$INST/bin/yt-dlp" | cut -d' ' -f1)"; bun_s="$(tsum bun)"
out="$(run_in update.sh --yes 2>&1)"; rc=$?
check "7 exit 0" [ $rc -eq 0 ]
check "7 VERSION is v2.0.2" [ "$(ver)" = "v2.0.2" ]
check "7 yt-dlp binary kept (not downgraded)" [ "$(tsum yt-dlp)" = "$ytd" ]
check "7 bun untouched" [ "$(tsum bun)" = "$bun_s" ]
check "7 says tools are already at the pinned version" grep -q "yt-dlp: already at the pinned version" <<<"$out"

echo "== case 8: wrong sha256 in tools.lock refused"
restore; set_latest v2.0.3
before="$(tree_sum "$INST")"
out="$(run_in update.sh --yes 2>&1)"; rc=$?
check "8 exit non-zero" [ $rc -ne 0 ]
check "8 reports checksum mismatch" grep -q "checksum mismatch" <<<"$out"
check "8 folder unchanged (old tool, old program, no backup)" [ "$(tree_sum "$INST")" = "$before" ]

echo "== case 9: tool found on PATH is skipped"
restore; set_latest v2.0.1
mkdir -p "$T/syspath"; printf '#!/bin/sh\necho 1.0-system\n' > "$T/syspath/yt-dlp"; chmod 755 "$T/syspath/yt-dlp"
rm -f "$INST/bin/yt-dlp"; grep -v '^yt-dlp ' "$INST/bin/.installed" > "$INST/bin/.installed.x"; mv "$INST/bin/.installed.x" "$INST/bin/.installed"
out="$(cd "$INST" && env -i HOME="$HOME_FAKE" PATH="$T/syspath:$FAKE_BASE_PATH" TMPDIR="$T" YTZERO_API="http://127.0.0.1:$PORT/api" YTZERO_DOWNLOAD="http://127.0.0.1:$PORT/dl" bash "$INST/update.sh" --yes 2>&1)"; rc=$?
check "9 exit 0" [ $rc -eq 0 ]
check "9 yt-dlp not downloaded into ./bin" [ ! -e "$INST/bin/yt-dlp" ] && grep -q "yt-dlp: found on your system" <<<"$out"

echo
echo "== $PASS passed, $FAIL failed in $((SECONDS-START))s"
[ "$FAIL" -eq 0 ]
