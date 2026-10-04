#!/usr/bin/env bash
# End-to-end test of the release scripts (update.sh, install-linux.sh, start.sh, uninstall.sh)
# against a fake GitHub on 127.0.0.1. Not shipped in the tarball. Needs internet (it does a
# real install of Bun, Deno, yt-dlp and ffmpeg). Usage: bash scripts/release/test-update.sh
#
# How it works, in plain words:
#   1. It exports the repo with `git archive HEAD`, puts your working-tree release scripts on top,
#      turns the export into a throwaway git repo (so package-release.sh takes its real
#      `git archive` path, not the "no .git" fallback) and builds v2.0.0 with package-release.sh.
#   2. It makes faux releases v2.0.1 .. v2.0.6 by editing copies of that tarball (a changed yt-dlp pin,
#      a bad checksum, three ffmpeg mirrors, ...). The faux tools.lock points at files served
#      from 127.0.0.1, so no override variable is needed.
#   3. It installs v2.0.0 for real into a temp folder, with a fake HOME and a cut-down PATH
#      (env -i), and keeps a pristine copy. Each case restores that copy, runs one script and checks
#      the result.
# Every check prints PASS: or FAIL:. The last line is "== N passed, M failed in Ns"; the exit code is
# non-zero when anything failed.
# Programs it needs: bash, git, curl, tar, xz, python3, sha256sum and the usual coreutils. It does NOT
# need ss/lsof: servers it starts are stopped by the pid it remembered, and ports are looked up in /proc.
# Env: KEEP_TMP=1 keeps the temp dir; TEST_TMPDIR=<dir> is the parent for it (default $TMPDIR or /tmp).
# Option: --scripts-ref <git ref>  takes scripts/release/* and scripts/package-release.sh from that commit
#   instead of the working tree. This is how to check that a test really catches a bug: run the
#   current test against the scripts from BEFORE the fix; the cases for the fixed behaviour must FAIL.
set -u

SCRIPTS_REF=""
if [ "${1:-}" = "--scripts-ref" ]; then SCRIPTS_REF="${2:?--scripts-ref needs a git ref}"; fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
T="$(mktemp -d "${TEST_TMPDIR:-${TMPDIR:-/tmp}}/ytzero-update-test.XXXXXX")"
DUMMY_PID=""
START=$SECONDS
PASS=0; FAIL=0
PORT=""   # the fake GitHub's port, set below

# ---------- helpers ----------
# Which process listens on a TCP port. Three ways, tried in this order, so the test also works on a
# machine without `ss` (the iproute2 package):
#   1. ss -ltnp
#   2. /proc/net/tcp (the kernel's list of sockets) gives the socket number of the listener; then
#      /proc/<pid>/fd/* shows which process holds that socket. Needs no extra program.
#   3. lsof, when it is installed.
# It prints nothing when nothing listens on the port (or when none of the ways can tell).
port_pid_proc() {
  local port="$1" hex inode="" st lport f p
  hex="$(printf '%04X' "$port")"
  while read -r _ lport _ st _ _ _ _ _ inode _; do
    if [ "$st" = 0A ] && [ "${lport##*:}" = "$hex" ]; then break; fi   # state 0A = LISTEN
    inode=""
  done < <(cat /proc/net/tcp /proc/net/tcp6 2>/dev/null)
  if [ -z "$inode" ] || [ "$inode" = 0 ]; then return 0; fi
  for f in /proc/[0-9]*/fd/*; do
    [ "$(readlink "$f" 2>/dev/null)" = "socket:[$inode]" ] || continue
    p="${f#/proc/}"; echo "${p%%/*}"; return 0
  done
}
port_pid() {
  local out=""
  if command -v ss >/dev/null 2>&1; then out="$(ss -ltnpH "sport = :$1" 2>/dev/null | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | head -n 1)"; fi
  [ -n "$out" ] || out="$(port_pid_proc "$1")"
  if [ -z "$out" ] && command -v lsof >/dev/null 2>&1; then out="$(lsof -nP -t -iTCP:"$1" -sTCP:LISTEN 2>/dev/null | head -n 1)"; fi
  echo "$out"
}
# Try to connect to the port (bash's own /dev/tcp, no program needed): success means something listens.
port_open() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }
# The process is gone (or is only a finished "zombie" that nobody has collected yet).
proc_gone() {
  local st
  [ -r "/proc/$1/stat" ] || return 0
  st="$(sed 's/.*) //' "/proc/$1/stat" 2>/dev/null)"
  case "${st%% *}" in Z|X|"") return 0 ;; esac
  return 1
}
# Is this process one of ours? Only if its working folder is inside the temp dir. A process outside
# the test folders is never stopped.
T_REAL="$(cd "$T" && pwd -P)"
own_proc() {
  local w; w="$(readlink "/proc/$1/cwd" 2>/dev/null || true)"
  case "$w" in "$T"|"$T"/*|"$T_REAL"|"$T_REAL"/*) return 0 ;; *) return 1 ;; esac
}
# stop_pid <pid>: stop a background process THIS test started. The pid was remembered from $! when
# it was started, so no port lookup is needed. Asks nicely, waits up to 5 s, then kill -9.
stop_pid() {
  local p="${1:-}" i
  [ -n "$p" ] && [ -d "/proc/$p" ] || return 0
  proc_gone "$p" || own_proc "$p" || return 0
  proc_gone "$p" || kill "$p" 2>/dev/null || true
  for i in $(seq 50); do proc_gone "$p" && break; sleep 0.1; done
  proc_gone "$p" || { kill -9 "$p" 2>/dev/null || true; sleep 0.2; }
  wait "$p" 2>/dev/null || true   # collect it, so it does not stay behind as a zombie
}
# Fallback for a server whose pid we do not know: the port tells the pid. Never pkill -f.
kill_port() {
  local p; p="$(port_pid "$1")"; [ -n "$p" ] || return 0
  stop_pid "$p"
}
SERVER_PORT=""   # port of the YT Zero server a case started, if any
SERVER_PID=""    # its pid. start.sh ends in "exec bun", so the pid of the background job IS the server
GITHUB_PID=""    # pid of the fake GitHub
LOOKUP_OK=0      # 1 when port_pid works on this machine (tested when the fake GitHub starts)
SKIPPED=0
cleanup() {
  stop_pid "$DUMMY_PID"
  stop_pid "$SERVER_PID"
  stop_pid "$GITHUB_PID"
  [ -n "$SERVER_PORT" ] && kill_port "$SERVER_PORT"
  [ -n "$PORT" ] && kill_port "$PORT"
  if [ "${KEEP_TMP:-0}" = 1 ]; then echo "kept temp dir: $T"; else rm -rf "$T"; fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

pass() { PASS=$((PASS+1)); echo "PASS: $*"; }
fail() { FAIL=$((FAIL+1)); echo "FAIL: $*"; }
# skip "name": a check that cannot be judged on this machine. Loud, counted, repeated at the end.
# It is never counted as a pass.
skip() { SKIPPED=$((SKIPPED+1)); echo "SKIPPED: $*"; }
# check "name" <command...>: PASS when the command succeeds.
check() { local name="$1"; shift; if "$@"; then pass "$name"; else fail "$name"; fi; }
# checkx "name" '<shell condition>': like check, but for a condition with && in it. Writing
#   check "name" [ A ] && [ B ]
# would only count A (the && ends the check command, and B runs on its own, unchecked). Here the whole
# string is evaluated, so every part has to be true.
checkx() { local name="$1" cond="$2"; if eval "$cond"; then pass "$name"; else fail "$name"; fi; }
die() { echo "FATAL: $*" >&2; exit 2; }

# free TCP port on 127.0.0.1
free_port() { python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1])'; }
# file <$1> has none of the error messages a broken shell script prints (e.g. "msg: command not found")
clean_of_noise() { ! grep -qE 'command not found|syntax error|unbound variable|bad substitution|unexpected EOF' "$1"; }
# the fake HOME has no file in it: no script wrote into the home folder
home_empty() { [ -z "$(ls -A "$HOME_FAKE" 2>/dev/null)" ]; }
quiet() { "$@" >/dev/null 2>&1; }

# checksum of every file/symlink in a tree (paths relative), to detect any change
tree_sum() { (cd "$1" && find . \( -type f -o -type l \) -print0 | sort -z | xargs -0 sha256sum 2>/dev/null; find . -type l -printf '%p -> %l\n' | sort) | sha256sum | cut -d' ' -f1; }

INST="$T/inst"; PRISTINE="$T/pristine"; WWW="$T/www"; HOME_FAKE="$T/home"; LINK="$T/link"
HOSTTMP="$T/hosttmp"          # TMPDIR the scripts get in normal runs; it must stay empty
NO_TMP="$T/no-such-tmp"       # a TMPDIR that does not exist: a script that still needs /tmp-style temp files fails
mkdir -p "$WWW" "$HOME_FAKE" "$HOSTTMP" "$T/build"
# Hermetic PATH: only the system folders (no /usr/local/bin, where a host Bun or ffmpeg might sit).
# Bun, Deno, yt-dlp and ffmpeg are meant to come from ./bin only, so none of them is on this PATH.
FAKE_BASE_PATH="/usr/sbin:/usr/bin:/sbin:/bin"
for t in bun deno yt-dlp ffmpeg ffprobe; do
  p="$(PATH="$FAKE_BASE_PATH" command -v "$t" 2>/dev/null || true)"
  [ -z "$p" ] || echo "note: $p exists on the system path; update.sh and install-linux.sh must ignore it (decision D3)"
done

# ---------- 1. build v2.0.0 with the real packaging script ----------
echo "== building v2.0.0"
git -C "$REPO_ROOT" archive --prefix=src/ HEAD | tar -x -C "$T/build" || die "git archive failed"
if [ -n "$SCRIPTS_REF" ]; then
  echo "== using the release scripts of $SCRIPTS_REF, not the working tree"
  git -C "$REPO_ROOT" archive "$SCRIPTS_REF" scripts/release scripts/package-release.sh | tar -x -C "$T/build/src" || die "git archive $SCRIPTS_REF failed"
else
  cp "$REPO_ROOT"/scripts/release/*.sh "$REPO_ROOT"/scripts/release/tools.lock "$T/build/src/scripts/release/"   # include uncommitted edits to the release scripts
  cp "$REPO_ROOT/scripts/package-release.sh" "$T/build/src/scripts/"
fi
# Turn the export into a git repo with one commit, so that package-release.sh runs its normal
# `git archive HEAD` path (and stamps the commit). Throwaway name and email, no global config read or changed.
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null   # git reads no config of the user (and cannot change it)
GIT_ID=(-c user.name=test -c user.email=test@example.invalid -c commit.gpgsign=false -c init.defaultBranch=main)
(cd "$T/build/src" && git "${GIT_ID[@]}" init -q && git "${GIT_ID[@]}" add -f -A && git "${GIT_ID[@]}" commit -q -m "test export") || die "git init/commit in the test export failed"
BUILD_COMMIT="$(cd "$T/build/src" && git rev-parse HEAD)"
mkdir -p "$T/build/tmp"
(cd "$T/build/src" && TMPDIR="$T/build/tmp" bash scripts/package-release.sh v2.0.0 >"$T/build/package.log" 2>&1) || { tail -20 "$T/build/package.log"; die "package-release.sh failed"; }
REL="$T/build/src/release"
[ -f "$REL/ytzero-v2.0.0.tar.gz" ] && [ -f "$REL/ytzero-v2.0.0.tar.gz.sha256" ] || die "tarball missing"
tar -tzf "$REL/ytzero-v2.0.0.tar.gz" | grep -q 'test-update.sh' && fail "test-update.sh must not be in the tarball" || pass "test-update.sh not shipped in tarball"
check "P1 package-release.sh stamped the commit of the git repo (real git-archive path)" \
  bash -c '[ "$(tar -xzOf "$1" ytzero-v2.0.0/app/src/build-commit.txt 2>/dev/null)" = "$2" ]' _ "$REL/ytzero-v2.0.0.tar.gz" "$BUILD_COMMIT"
checkx "P2 MANIFEST lists exactly the top-level entries of the tarball" \
  '[ "$(tar -xzOf "$REL/ytzero-v2.0.0.tar.gz" ytzero-v2.0.0/MANIFEST 2>/dev/null | LC_ALL=C sort)" = "$(tar -tzf "$REL/ytzero-v2.0.0.tar.gz" | cut -d/ -f2 | grep . | LC_ALL=C sort -u)" ]'

# ---------- 2. faux releases (edited copies, repacked like package-release.sh) ----------
# fake pinned yt-dlp artifact, served locally; its sha256 goes into tools.lock
PORT="$(free_port)"
mkdir -p "$WWW/art"
printf '#!/bin/sh\necho 9999.01.01\n' > "$WWW/art/yt-dlp"
FAKE_SHA="$(sha256sum "$WWW/art/yt-dlp" | cut -d' ' -f1)"
# ffmpeg for the mirror test (case 10). It is a small FAKE ffmpeg archive made right here and served
# locally, so the case does not depend on any real download host (johnvansickle.com may be
# unreachable from some networks). The mirror logic is the same: 404 -> wrong sha256 -> good file.
# The archive looks like the real one: a folder holding the two programs "ffmpeg" and "ffprobe".
case "$(uname -m)" in aarch64|arm64) ARCH_KEY=aarch64 ;; *) ARCH_KEY=x86_64 ;; esac
FF_VER="$(grep -m1 "^ffmpeg .* $ARCH_KEY " "$T/build/src/scripts/release/tools.lock" | cut -d' ' -f2)"
[ -n "$FF_VER" ] || die "tools.lock has no ffmpeg line for $ARCH_KEY"
mkdir -p "$T/ffsrc/ffmpeg-fake-static"
for t in ffmpeg ffprobe; do
  printf '#!/bin/sh\necho "%s version fake-from-the-third-mirror"\n' "$t" > "$T/ffsrc/ffmpeg-fake-static/$t"
  chmod 755 "$T/ffsrc/ffmpeg-fake-static/$t"
done
tar -C "$T/ffsrc" -cJf "$WWW/art/ffmpeg.tar.xz" ffmpeg-fake-static || die "could not make the fake ffmpeg archive (is xz installed?)"
FF_SHA="$(sha256sum "$WWW/art/ffmpeg.tar.xz" | cut -d' ' -f1)"
echo "not an ffmpeg archive" > "$WWW/art/corrupt.tar.xz"
# build_faux <version> <good|same|badsha|ffmirror|ship>
#   good:     yt-dlp pin changed to the fake artifact (correct sha256), a top-level file and a folder added
#   same:     tools.lock identical to v2.0.0 (the extra file and folder of "good" are gone again)
#   badsha:   yt-dlp pin changed, but with a wrong sha256
#   ffmirror: ffmpeg pin changed, three mirrors: a 404, a file with the wrong sha256, then a good (fake) archive
#   ship:     same pins as v2.0.0, but the release also ships the user-owned names port, ytzero.env and .tmp
build_faux() {
  local v="$1" mode="$2" F="$T/faux/ytzero-$1" sha arch
  mkdir -p "$T/faux/x-$v" && tar -xzf "$REL/ytzero-v2.0.0.tar.gz" -C "$T/faux/x-$v" && mv "$T/faux/x-$v/ytzero-v2.0.0" "$F" || die "faux extract failed"
  echo "update marker ${v#v}" > "$F/app/src/UPDATE-MARKER.txt"
  sed -i "s/\"version\": *\"[^\"]*\"/\"version\": \"${v#v}\"/" "$F/app/package.json"
  echo "$v" > "$F/VERSION"
  case "$mode" in
    good|badsha)
      sha="$FAKE_SHA"; [ "$mode" = badsha ] && sha="$(printf '%064d' 7)"
      grep -v '^yt-dlp ' "$F/tools.lock" > "$F/tools.lock.new"
      for arch in x86_64 aarch64; do echo "yt-dlp 9999.01.01 $arch http://127.0.0.1:$PORT/art/yt-dlp $sha" >> "$F/tools.lock.new"; done
      mv "$F/tools.lock.new" "$F/tools.lock"
      echo "new top-level file" > "$F/NEW-TOPLEVEL.txt"
      mkdir "$F/NEW-FOLDER"; echo "new top-level folder" > "$F/NEW-FOLDER/file.txt"
      if [ -f "$F/MANIFEST" ]; then printf 'NEW-TOPLEVEL.txt\nNEW-FOLDER\n' >> "$F/MANIFEST"; LC_ALL=C sort -u -o "$F/MANIFEST" "$F/MANIFEST"; fi ;;
    ffmirror)
      grep -v '^ffmpeg ' "$F/tools.lock" > "$F/tools.lock.new"
      for arch in x86_64 aarch64; do
        echo "ffmpeg ${FF_VER}b $arch http://127.0.0.1:$PORT/art/missing.tar.xz $FF_SHA" >> "$F/tools.lock.new"
        echo "ffmpeg ${FF_VER}b $arch http://127.0.0.1:$PORT/art/corrupt.tar.xz $FF_SHA" >> "$F/tools.lock.new"
        echo "ffmpeg ${FF_VER}b $arch http://127.0.0.1:$PORT/art/ffmpeg.tar.xz $FF_SHA" >> "$F/tools.lock.new"
      done
      mv "$F/tools.lock.new" "$F/tools.lock" ;;
    ship)
      echo 7777 > "$F/port"; echo "SHIPPED=1" > "$F/ytzero.env"
      mkdir "$F/.tmp"; echo "shipped by the release" > "$F/.tmp/shipped.txt" ;;
  esac
  tar -C "$T/faux" -czf "$T/faux/ytzero-$v.tar.gz" "ytzero-$v"
  (cd "$T/faux" && sha256sum "ytzero-$v.tar.gz" > "ytzero-$v.tar.gz.sha256")
}
echo "== building faux v2.0.1 (changed pin), v2.0.2 (same pins), v2.0.3 (bad sha256), v2.0.4 (ffmpeg mirrors), v2.0.6 (ships port, ytzero.env and .tmp)"
build_faux v2.0.1 good; build_faux v2.0.2 same; build_faux v2.0.3 badsha; build_faux v2.0.4 ffmirror; build_faux v2.0.6 ship

# ---------- 3. fake GitHub ----------
D="$WWW/dl/Fogbench/ytzero/releases/download"
mkdir -p "$D/v2.0.0" "$D/v2.0.1" "$D/v2.0.2" "$D/v2.0.3" "$D/v2.0.4" "$D/v2.0.6" "$WWW/api/repos/Fogbench/ytzero/releases"
cp "$REL"/ytzero-v2.0.0.tar.gz* "$D/v2.0.0/"
for v in v2.0.1 v2.0.2 v2.0.3 v2.0.4 v2.0.6; do cp "$T/faux"/ytzero-$v.tar.gz* "$D/$v/"; done
set_latest() { printf '{"tag_name":"%s"}\n' "$1" > "$WWW/api/repos/Fogbench/ytzero/releases/latest"; }
set_latest v2.0.0
(cd "$WWW" && exec python3 -m http.server "$PORT" --bind 127.0.0.1 >"$T/server.log" 2>&1) &
GITHUB_PID=$!   # remembered, so cleanup stops exactly this process (exec keeps the pid: it is the python server)
for _ in $(seq 50); do curl -fs "http://127.0.0.1:$PORT/api/repos/Fogbench/ytzero/releases/latest" >/dev/null 2>&1 && break; sleep 0.1; done
curl -fs "http://127.0.0.1:$PORT/api/repos/Fogbench/ytzero/releases/latest" >/dev/null || die "fake GitHub did not start"
echo "== fake GitHub on 127.0.0.1:$PORT (pid $GITHUB_PID)"
# Does the port -> pid lookup work here? The fake GitHub is the test: the lookup must find the pid we started.
if [ "$(port_pid "$PORT")" = "$GITHUB_PID" ]; then LOOKUP_OK=1
else echo "note: this machine cannot tell which process listens on a port (no ss, and /proc/net/tcp, /proc/*/fd and lsof gave no answer). Servers are still stopped by their remembered pid; the checks that need the lookup are reported as SKIPPED."; fi
command -v ss >/dev/null 2>&1 || echo "note: ss (iproute2) is not installed; ports are looked up in /proc/net/tcp instead"

# ---------- 4. real install of 2.0.0 ----------
echo "== installing 2.0.0 with install-linux.sh (slow: downloads tools)"
mkdir "$T/ext" && tar -xzf "$REL/ytzero-v2.0.0.tar.gz" -C "$T/ext" && mv "$T/ext/ytzero-v2.0.0" "$INST" || die "extract failed"
# run_dir <folder> <script> [args]: run a script of that folder with a clean env: fake HOME, hermetic PATH, fake GitHub.
# Optional settings for one call (written before the call, like  EXTRA_ENV="X=1" run_in update.sh):
#   EXTRA_PATH  folder put first on PATH      EXTRA_ENV  more NAME=value words      RUN_TMPDIR  TMPDIR to give
#   RUN_PREFIX  a command to put in front (e.g. "timeout 60")
run_dir() {
  local dir="$1" script="$2"; shift 2
  (cd "$dir" && ${RUN_PREFIX:-} env -i HOME="$HOME_FAKE" PATH="${EXTRA_PATH:+$EXTRA_PATH:}$FAKE_BASE_PATH" TMPDIR="${RUN_TMPDIR:-$HOSTTMP}" \
    YTZERO_API="http://127.0.0.1:$PORT/api" YTZERO_DOWNLOAD="http://127.0.0.1:$PORT/dl" ${EXTRA_ENV:-} \
    bash "$dir/$script" "$@")
}
run_in() { run_dir "$INST" "$@"; }
run_in install-linux.sh --yes >"$T/install.log" 2>&1 || { tail -20 "$T/install.log"; die "install-linux.sh failed"; }
[ -x "$INST/bin/bun" ] && [ -d "$INST/app/node_modules" ] || die "install incomplete"
pass "install-linux.sh installed 2.0.0 (bun $("$INST/bin/bun" --version))"
check "install wrote bin/.installed with the four pinned tools" bash -c '[ "$(cut -d" " -f1 "$1/bin/.installed" | sort | tr "\n" " ")" = "bun deno ffmpeg yt-dlp " ]' _ "$INST"
check "installed versions match tools.lock" bash -c 'cd "$1"; for t in bun deno yt-dlp ffmpeg; do v="$(grep "^$t " bin/.installed | cut -d" " -f2)"; grep -q "^$t $v " tools.lock || exit 1; done' _ "$INST"
check "bin/bun reports the pinned version" [ "$("$INST/bin/bun" --version)" = "$(grep -m1 '^bun ' "$INST/tools.lock" | cut -d' ' -f2)" ]
check "PORTABLE install-linux.sh left the fake HOME empty" home_empty
check "PORTABLE install-linux.sh left nothing in TMPDIR" bash -c '[ -z "$(ls -A "$1")" ]' _ "$HOSTTMP"
check "stderr install-linux.sh prints no shell errors" clean_of_noise "$T/install.log"

mkdir -p "$INST/data/db" "$INST/data/downloads/sub"
python3 - "$INST/data/db/ytzero.sqlite" <<'PY'
import sqlite3, sys
c = sqlite3.connect(sys.argv[1]); c.execute("create table t(x)"); c.executemany("insert into t values(?)", [(i,) for i in range(100)]); c.commit(); c.close()
PY
echo "some user file" > "$INST/data/downloads/sub/video.txt"; echo "settings" > "$INST/data/config.json"
echo '{"state":"kept"}' > "$INST/data/database-state.json"
# seven backups from earlier updates (oldest first) and one folder that is not an update backup
for i in 1 2 3 4 5 6 7; do mkdir -p "$INST/backups/pre-update-v1.0.0-2025010$i-000000/db"; done
mkdir -p "$INST/backups/my-own-backup"
cp -a "$INST" "$PRISTINE"
restore() { rm -rf "$INST" "$LINK"; cp -a "$PRISTINE" "$INST"; }
data_sum() { (cd "$INST/data" && find . -type f -print0 | sort -z | xargs -0 sha256sum) | sha256sum | cut -d' ' -f1; }
ver() { tr -d '[:space:]' < "$INST/VERSION"; }
tsum() { sha256sum "$INST/bin/$1" | cut -d' ' -f1; }
# stop the YT Zero server a case started
stop_server() { stop_pid "$SERVER_PID"; SERVER_PID=""; [ -n "$SERVER_PORT" ] && kill_port "$SERVER_PORT"; return 0; }

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
bun_s="$(tsum bun)"; deno_s="$(tsum deno)"; ffm_s="$(tsum ffmpeg)"; ffp_s="$(tsum ffprobe)"; old_ytdlp="$(tsum yt-dlp)"
out="$(run_in update.sh --yes 2>"$T/err3")"; rc=$?
{ echo "$out"; cat "$T/err3"; } | sed 's/^/   | /' | tail -12
check "3 exit 0" [ $rc -eq 0 ]
check "3 marker installed" [ "$(cat "$INST/app/src/UPDATE-MARKER.txt" 2>/dev/null)" = "update marker 2.0.1" ]
check "3 VERSION is v2.0.1" [ "$(ver)" = "v2.0.1" ]
check "3 app/package.json version 2.0.1" grep -q '"version": "2.0.1"' "$INST/app/package.json"
bk="$(ls -d "$INST"/backups/pre-update-v2.0.0-* 2>/dev/null | head -n 1)"
checkx "3 database backup in ./backups" '[ -n "$bk" ] && [ -f "$bk/db/ytzero.sqlite" ]'
check "3 backup db readable (100 rows)" [ "$(python3 -c 'import sqlite3,sys; print(sqlite3.connect(sys.argv[1]).execute("select count(*) from t").fetchone()[0])' "${bk:-/nonexistent}/db/ytzero.sqlite" 2>/dev/null)" = 100 ]
checkx "D5 backup includes data/database-state.json" '[ -n "$bk" ] && [ "$(cat "$bk/database-state.json" 2>/dev/null)" = "{\"state\":\"kept\"}" ]'
check "R2-5 the backup message names both things it copied (data/db and data/database-state.json)" grep -qE "^==> copied data/db and data/database-state.json to backups/pre-update-v2.0.0-[0-9]{8}-[0-9]{6}$" <<<"$out"
checkx "D5 only the newest 5 pre-update backups stay (the new one + the 4 newest old ones)" \
  '[ "$(ls -d "$INST"/backups/pre-update-* | wc -l)" = 5 ] && [ -d "$INST/backups/pre-update-v1.0.0-20250107-000000" ] && [ -d "$INST/backups/pre-update-v1.0.0-20250104-000000" ] && [ ! -e "$INST/backups/pre-update-v1.0.0-20250103-000000" ] && [ ! -e "$INST/backups/pre-update-v1.0.0-20250101-000000" ]'
check "D5 a folder in backups/ that is not an update backup is kept" [ -d "$INST/backups/my-own-backup" ]
check "3 data/ unchanged" [ "$(data_sum)" = "$dbefore" ]
checkx "3 unchanged tools untouched (bun, deno, ffmpeg, ffprobe)" '[ "$(tsum bun)" = "$bun_s" ] && [ "$(tsum deno)" = "$deno_s" ] && [ "$(tsum ffmpeg)" = "$ffm_s" ] && [ "$(tsum ffprobe)" = "$ffp_s" ]'
checkx "3 changed tool (yt-dlp) replaced" '[ "$(tsum yt-dlp)" != "$old_ytdlp" ] && [ "$("$INST/bin/yt-dlp" --version)" = "9999.01.01" ]'
check "3 bin/.installed updated for yt-dlp only" bash -c 'grep -qx "yt-dlp 9999.01.01" "$1/bin/.installed" && [ "$(wc -l < "$1/bin/.installed")" = 4 ] && grep -q "^bun " "$1/bin/.installed"' _ "$INST"
check "3 tools.lock is the new one" grep -q "^yt-dlp 9999.01.01 " "$INST/tools.lock"
check "3 new top-level file appeared" [ "$(cat "$INST/NEW-TOPLEVEL.txt" 2>/dev/null)" = "new top-level file" ]
checkx "3 node_modules rebuilt (stale marker gone, libraries present)" '[ ! -e "$INST/app/node_modules/.stale-marker" ] && [ -n "$(ls "$INST/app/node_modules" 2>/dev/null)" ]'
check "3 bin/.previous cleaned up" [ ! -e "$INST/bin/.previous" ]
check "3 no leftover *.new files" [ -z "$(find "$INST" -maxdepth 2 \( -name '*.new' -o -name '*.old' \) -not -path '*/node_modules/*')" ]
check "3 no leftover lock or staging folder" [ -z "$(ls -A "$INST/.update.lock" "$INST/.update-stage" "$INST/.tmp" 2>/dev/null)" ]
check "stderr update.sh prints no shell errors (msg: command not found was the old L1 bug)" clean_of_noise "$T/err3"
check "PORTABLE update.sh left the fake HOME empty" home_empty
check "3 second run says already latest" grep -qF "Already on version 2.0.1 (latest)" <<<"$(run_in update.sh 2>&1)"

echo "== case M1: a later release that drops files (MANIFEST)"
# The folder is now release 2.0.1 (it has NEW-TOPLEVEL.txt and NEW-FOLDER/). 2.0.2 does not ship them.
echo "mine" > "$INST/my-notes.txt"; echo "FOO=bar" > "$INST/ytzero.env"; echo "4242" > "$INST/port"
mkdir -p "$INST/data/more"; echo "later data" > "$INST/data/more/x.txt"; dbefore="$(data_sum)"
set_latest v2.0.2
out="$(run_in update.sh --yes 2>"$T/errm1")"; rc=$?
echo "$out" | sed 's/^/   | /' | tail -6
check "M1 exit 0" [ $rc -eq 0 ]
check "M1 VERSION is v2.0.2" [ "$(ver)" = "v2.0.2" ]
check "M1 the file the new release dropped (NEW-TOPLEVEL.txt) is removed" [ ! -e "$INST/NEW-TOPLEVEL.txt" ]
check "M1 the folder the new release dropped (NEW-FOLDER/) is removed" [ ! -e "$INST/NEW-FOLDER" ]
checkx "M1 data/, my-notes.txt, ytzero.env and port survive" '[ "$(data_sum)" = "$dbefore" ] && [ "$(cat "$INST/my-notes.txt")" = mine ] && [ "$(cat "$INST/ytzero.env")" = "FOO=bar" ] && [ "$(cat "$INST/port")" = 4242 ]'
check "M1 MANIFEST is the new one (no longer lists the dropped entries)" bash -c '! grep -q NEW- "$1/MANIFEST" && grep -qx MANIFEST "$1/MANIFEST"' _ "$INST"
check "M1 no leftover staging folder" [ ! -e "$INST/.update-stage" ]
check "stderr M1 update prints no shell errors" clean_of_noise "$T/errm1"

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
check "6b update works again once stopped" quiet run_in update.sh --yes

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

echo "== case 9: a yt-dlp on PATH is ignored (D3), the pinned one goes into ./bin"
restore; set_latest v2.0.1
mkdir -p "$T/syspath"; printf '#!/bin/sh\necho 1.0-system\n' > "$T/syspath/yt-dlp"; chmod 755 "$T/syspath/yt-dlp"
rm -f "$INST/bin/yt-dlp"; grep -v '^yt-dlp ' "$INST/bin/.installed" > "$INST/bin/.installed.x"; mv "$INST/bin/.installed.x" "$INST/bin/.installed"
out="$(EXTRA_PATH="$T/syspath" run_in update.sh --yes 2>&1)"; rc=$?
check "9 exit 0" [ $rc -eq 0 ]
check "9 says yt-dlp: unknown version -> 9999.01.01" grep -qF "yt-dlp: unknown version -> 9999.01.01" <<<"$out"
checkx "9 bin/yt-dlp is the downloaded one, not the system script" '[ -x "$INST/bin/yt-dlp" ] && [ "$("$INST/bin/yt-dlp" --version)" = "9999.01.01" ] && ! grep -q 1.0-system "$INST/bin/yt-dlp"'
check "9 bin/.installed has the yt-dlp pin" grep -qx "yt-dlp 9999.01.01" "$INST/bin/.installed"
check "9 no 'found on your system' message" bash -c '! grep -q "found on your system" <<<"$1"' _ "$out"

# pin_local_ytdlp: in the restored folder, pin yt-dlp in tools.lock to the local fake file and
# remove the installed one, so that install-linux.sh has to fetch it (and needs no real download)
pin_local_ytdlp() {
  grep -v '^yt-dlp ' "$INST/tools.lock" > "$INST/tools.lock.x"
  for arch in x86_64 aarch64; do echo "yt-dlp 9999.01.01 $arch http://127.0.0.1:$PORT/art/yt-dlp $FAKE_SHA" >> "$INST/tools.lock.x"; done
  mv "$INST/tools.lock.x" "$INST/tools.lock"
  rm -f "$INST/bin/yt-dlp"; grep -v '^yt-dlp ' "$INST/bin/.installed" > "$INST/bin/.installed.x"; mv "$INST/bin/.installed.x" "$INST/bin/.installed"
}
echo "== case 9b: install-linux.sh also ignores a yt-dlp on PATH (D3) and answers the questions"
restore; pin_local_ytdlp
out="$(printf 'y\n4999\n' | EXTRA_PATH="$T/syspath" run_in install-linux.sh 2>"$T/err9b")"; rc=$?
check "9b exit 0" [ $rc -eq 0 ]
checkx "9b bin/yt-dlp is the pinned download, not the system script" '[ "$("$INST/bin/yt-dlp" --version 2>/dev/null)" = "9999.01.01" ] && grep -qx "yt-dlp 9999.01.01" "$INST/bin/.installed"'
check "9b no 'found'/'as found' message about a system tool" bash -c '! grep -qiE "found on your system|used as found" <<<"$1"' _ "$out"
check "9b the port answer 4999 is saved in ./port" [ "$(cat "$INST/port")" = 4999 ]
check "9b stderr clean" clean_of_noise "$T/err9b"

echo "== case T: the scripts need no /tmp: TMPDIR points at a folder that does not exist (L3)"
restore; set_latest v2.0.2
out="$(RUN_TMPDIR="$NO_TMP" run_in update.sh --yes 2>&1)"; rc=$?
checkx "T1 update.sh works (its downloads are staged in ./.tmp inside the folder)" '[ $rc -eq 0 ] && [ "$(ver)" = v2.0.2 ]'
restore; pin_local_ytdlp
out="$(RUN_TMPDIR="$NO_TMP" run_in install-linux.sh --yes 2>&1)"; rc=$?
checkx "T2 install-linux.sh works (stages in ./.tmp) and installs the tool" '[ $rc -eq 0 ] && [ "$("$INST/bin/yt-dlp" --version 2>/dev/null)" = 9999.01.01 ]'
check "T the folders ./.tmp are cleaned up again" [ ! -e "$INST/.tmp" ]
check "T the nonexistent TMPDIR was never created" [ ! -e "$NO_TMP" ]

echo "== case 10: ffmpeg mirrors: 404, then a wrong sha256, then the good one (all three served locally)"
restore; set_latest v2.0.4
bun_s="$(tsum bun)"; ytd="$(tsum yt-dlp)"
out="$(run_in update.sh --yes 2>"$T/err10")"; rc=$?
echo "$out" | sed 's/^/   | /' | tail -8
check "10 exit 0" [ $rc -eq 0 ]
check "10 warned about the 404 mirror" grep -q "could not download http://127.0.0.1:$PORT/art/missing.tar.xz" "$T/err10"
check "10 warned about the mirror with the wrong checksum" grep -q "checksum mismatch for http://127.0.0.1:$PORT/art/corrupt.tar.xz" "$T/err10"
checkx "10 ffmpeg and ffprobe installed from the third mirror and recorded" '[ "$("$INST/bin/ffmpeg" -version 2>&1)" = "ffmpeg version fake-from-the-third-mirror" ] && [ "$("$INST/bin/ffprobe" -version 2>&1)" = "ffprobe version fake-from-the-third-mirror" ] && grep -qx "ffmpeg ${FF_VER}b" "$INST/bin/.installed" && [ "$(ver)" = v2.0.4 ]'
checkx "10 bun and yt-dlp untouched" '[ "$(tsum bun)" = "$bun_s" ] && [ "$(tsum yt-dlp)" = "$ytd" ]'
check "10 stderr has no shell errors" clean_of_noise "$T/err10"

echo "== case M4: downgrades are refused unless --allow-downgrade"
restore; set_latest v2.0.0
echo v2.0.5 > "$INST/VERSION"; before="$(tree_sum "$INST")"
out="$(run_in update.sh --check 2>&1)"; rc=$?
check "M4 --check on a newer install: exit 0" [ $rc -eq 0 ]
check "M4 --check says the installed version is newer" grep -q "newer than the latest" <<<"$out"
check "M4 --check does not offer an update" bash -c '! grep -q "An update is available" <<<"$1"' _ "$out"
out="$(run_in update.sh --yes 2>&1)"; rc=$?
check "M4 --yes refuses to downgrade (exit non-zero)" [ $rc -ne 0 ]
check "M4 the refusal names --allow-downgrade" grep -q -- "--allow-downgrade" <<<"$out"
check "M4 nothing changed after the refusal" [ "$(tree_sum "$INST")" = "$before" ]
echo "v2.0.0-3-gabc" > "$INST/VERSION"; before="$(tree_sum "$INST")"
out="$(run_in update.sh --yes 2>&1)"; rc=$?
checkx "M4 a git-describe build (v2.0.0-3-gabc) is newer than v2.0.0: refused, unchanged" '[ $rc -ne 0 ] && [ "$(tree_sum "$INST")" = "$before" ]'
set_latest v2.0.1
out="$(run_in update.sh --check 2>&1)"; rc=$?
checkx "M4 v2.0.0-3-gabc is older than v2.0.1: an update is offered" '[ $rc -eq 0 ] && grep -q "An update is available" <<<"$out"'
set_latest v2.0.0; echo v2.0.5 > "$INST/VERSION"
out="$(run_in update.sh --yes --allow-downgrade 2>&1)"; rc=$?
check "M4 --allow-downgrade: exit 0" [ $rc -eq 0 ]
check "M4 --allow-downgrade: VERSION is v2.0.0" [ "$(ver)" = "v2.0.0" ]
check "M4 --allow-downgrade says it updated from 2.0.5 to 2.0.0" grep -q "Updated from 2.0.5 to 2.0.0" <<<"$out"

echo "== case H1: no bin/.installed (all four tools get installed, update does not abort)"
restore; set_latest v2.0.2
rm -f "$INST/bin/.installed"
out="$(run_in update.sh --yes 2>"$T/errh1")"; rc=$?
echo "$out" | sed 's/^/   | /' | grep -E 'unknown version|Updated|error' | head -8
check "H1 exit 0 (it used to stop silently with exit 2)" [ $rc -eq 0 ]
check "H1 each of the four tools is shown as 'unknown version -> <pin>'" [ "$(grep -c 'unknown version ->' <<<"$out")" = 4 ]
check "H1 VERSION is v2.0.2" [ "$(ver)" = "v2.0.2" ]
check "H1 bin/.installed was written again for all four tools" bash -c 'cd "$1"; [ "$(wc -l < bin/.installed)" = 4 ] && for t in bun deno yt-dlp ffmpeg; do v="$(grep "^$t " bin/.installed | cut -d" " -f2)"; grep -q "^$t $v " tools.lock || exit 1; done' _ "$INST"
check "H1 stderr has no shell errors" clean_of_noise "$T/errh1"

echo "== case H2: the copy fails partway (a full disk): old VERSION stays, a rerun completes"
restore; set_latest v2.0.1
mkdir -p "$T/failcp"
cat > "$T/failcp/cp" <<'EOF'
#!/bin/sh
# Stands in for a full disk: copying a FOLDER with "cp -r" fails. Every other cp is the real one.
if [ "${1:-}" = "-r" ] && [ -d "${2:-}" ]; then echo "cp: cannot write: No space left on device" >&2; exit 1; fi
exec /usr/bin/cp "$@"
EOF
chmod 755 "$T/failcp/cp"
old_ytdlp="$(tsum yt-dlp)"
out="$(EXTRA_PATH="$T/failcp" run_in update.sh --yes 2>&1)"; rc=$?
check "H2 exit non-zero" [ $rc -ne 0 ]
check "H2 says it could not copy the new files" grep -q "could not copy the new files" <<<"$out"
check "H2 VERSION is still v2.0.0" [ "$(ver)" = "v2.0.0" ]
checkx "H2 nothing of the new release is in the folder (no marker, no new files, old tools.lock)" \
  '[ ! -e "$INST/app/src/UPDATE-MARKER.txt" ] && [ ! -e "$INST/NEW-TOPLEVEL.txt" ] && [ ! -e "$INST/NEW-FOLDER" ] && cmp -s "$INST/tools.lock" "$PRISTINE/tools.lock" && cmp -s "$INST/update.sh" "$PRISTINE/update.sh"'
check "H2 the old yt-dlp is still in place" [ "$(tsum yt-dlp)" = "$old_ytdlp" ]
check "H2 no leftover lock or staging folder" [ -z "$(ls -A "$INST/.update.lock" "$INST/.update-stage" 2>/dev/null)" ]
out="$(run_in update.sh --yes 2>&1)"; rc=$?
checkx "H2 a rerun does the whole update (exit 0, VERSION v2.0.1, marker, new tool)" \
  '[ $rc -eq 0 ] && [ "$(ver)" = v2.0.1 ] && [ -f "$INST/app/src/UPDATE-MARKER.txt" ] && [ "$("$INST/bin/yt-dlp" --version)" = 9999.01.01 ]'

echo "== case H3: the library install fails (no registry, empty cache): rollback is not half a rollback"
restore; set_latest v2.0.1
rm -rf "$INST/.bun-cache"
out="$(EXTRA_ENV="BUN_CONFIG_REGISTRY=http://127.0.0.1:1/" run_in update.sh --yes 2>&1)"; rc=$?
echo "$out" | sed 's/^/   | /' | tail -4
check "H3 exit non-zero" [ $rc -ne 0 ]
check "H3 tells the user to run 'bash update.sh again'" grep -q "bash update.sh again" <<<"$out"
check "H3 VERSION stays v2.0.0 (so a rerun retries)" [ "$(ver)" = "v2.0.0" ]
checkx "H3 the new verified yt-dlp is kept and recorded" '[ "$("$INST/bin/yt-dlp" --version)" = 9999.01.01 ] && grep -qx "yt-dlp 9999.01.01" "$INST/bin/.installed"'
check "H3 no bin/.previous left" [ ! -e "$INST/bin/.previous" ]
out="$(run_in update.sh --yes 2>&1)"; rc=$?
checkx "H3 rerun finishes: exit 0, VERSION v2.0.1, libraries present" '[ $rc -eq 0 ] && [ "$(ver)" = v2.0.1 ] && [ -n "$(ls "$INST/app/node_modules" 2>/dev/null)" ]'
check "H3 rerun does not download yt-dlp again" grep -q "yt-dlp: already at the pinned version 9999.01.01" <<<"$out"

echo "== case L11: closed input gives a message, not a silent exit"
restore; set_latest v2.0.1; before="$(tree_sum "$INST")"
out="$(run_in update.sh <&- 2>&1)"; rc=$?
checkx "L11 update.sh without --yes and closed input: exit non-zero, says the input is closed" '[ $rc -ne 0 ] && grep -q "input is closed" <<<"$out"'
check "L11 update.sh changed nothing" [ "$(tree_sum "$INST")" = "$before" ]
out="$(run_in install-linux.sh <&- 2>&1)"; rc=$?
checkx "L11 install-linux.sh without --yes and closed input: exit non-zero, says the input is closed" '[ $rc -ne 0 ] && grep -q "input is closed" <<<"$out"'
out="$(run_in uninstall.sh <&- 2>&1)"; rc=$?
checkx "L11 uninstall.sh without --yes and closed input: exit non-zero, says the input is closed" '[ $rc -ne 0 ] && grep -q "input is closed" <<<"$out"'
check "L11 uninstall.sh removed nothing" [ -d "$INST/app/node_modules" ]

echo "== case L4: a bad ./port in the installer (answers end after 'y': the question must not loop)"
restore; echo "abc" > "$INST/port"
RUN_PREFIX="timeout 90" run_in install-linux.sh < <(printf 'y\n') 2>&1 | head -c 300000 > "$T/l4.log"
rc=${PIPESTATUS[0]}
checkx "L4 installer finished (exit 0, a short log, no endless prompts)" '[ $rc -eq 0 ] && [ "$(wc -c < "$T/l4.log")" -lt 20000 ]'
check "L4 installer says ./port is not a port number" grep -q "does not hold a port number" "$T/l4.log"
check "L4 installer fell back to 3001 and saved it" [ "$(cat "$INST/port")" = 3001 ]

# dead_pid: prints a process number that is not in use (a short job that has already ended)
dead_pid() { local p; ( : ) & p=$!; wait "$p" 2>/dev/null; echo "$p"; }

echo "== case R2-1: update.sh on macOS (a stand-in uname says Darwin/arm64): program files update, tools stay"
restore; set_latest v2.0.1   # v2.0.1 pins a NEW yt-dlp: on Linux it would be downloaded from the fake GitHub (/art/yt-dlp)
mkdir -p "$T/darwin"
cat > "$T/darwin/uname" <<'EOF'
#!/bin/sh
# Stands in for macOS: "uname -s" says Darwin, "uname -m" says arm64. Any other use is the real uname.
case "${1:-}" in -s) echo Darwin ;; -m) echo arm64 ;; *) exec /usr/bin/uname "$@" ;; esac
EOF
chmod 755 "$T/darwin/uname"
binsum="$(tree_sum "$INST/bin")"; art_before="$(grep -c 'GET /art/' "$T/server.log")"
out="$(EXTRA_PATH="$T/darwin" run_in update.sh --yes 2>"$T/errr21")"; rc=$?
echo "$out" | sed 's/^/   | /' | tail -5
check "R2-1 exit 0" [ $rc -eq 0 ]
checkx "R2-1 VERSION moved to v2.0.1 and the new program files are in" '[ "$(ver)" = v2.0.1 ] && [ -f "$INST/app/src/UPDATE-MARKER.txt" ]'
check "R2-1 says the tools are not touched on Darwin" grep -q "tools: not touched on Darwin" <<<"$out"
check "R2-1 ./bin is exactly as before (no tool replaced, no .installed change)" [ "$(tree_sum "$INST/bin")" = "$binsum" ]
check "R2-1 nothing was downloaded from the tool server (/art/ in the fake GitHub's log)" [ "$(grep -c 'GET /art/' "$T/server.log")" = "$art_before" ]
check "R2-1 stderr has no shell errors" clean_of_noise "$T/errr21"

echo "== case R2-lock: a live .update.lock stops update.sh"
restore; set_latest v2.0.2
mkdir "$INST/.update.lock"; echo "$$" > "$INST/.update.lock/pid"   # this test's own pid: certainly alive
before="$(tree_sum "$INST")"
out="$(run_in update.sh --yes 2>&1)"; rc=$?
checkx "LOCK live pid: exit non-zero, says another update.sh is running, nothing changed" '[ $rc -ne 0 ] && grep -q "another update.sh is already running (pid $$)" <<<"$out" && [ "$(tree_sum "$INST")" = "$before" ]'

echo "== case R2-2/R2-3: update after a killed run (dead-pid lock, stale ./.tmp folder, backups dated in the future)"
restore; set_latest v2.0.2
# five backups named with dates far in the FUTURE (a clock that was wrong): by name they sort newer than the new backup
for i in 1 2 3 4 5; do mkdir -p "$INST/backups/pre-update-v9.0.0-2099010$i-000000/db"; done
# what a run killed with kill -9 leaves behind: its lock (pid no longer alive) and its download folder
mkdir "$INST/.update.lock"; echo "$(dead_pid)" > "$INST/.update.lock/pid"
mkdir -p "$INST/.tmp/update.AbCdEf" "$INST/.tmp/update.abc" "$INST/.tmp/my-stuff"; echo junk > "$INST/.tmp/update.AbCdEf/old-download.tar.gz"
out="$(run_in update.sh --yes 2>"$T/errr2")"; rc=$?
echo "$out" | sed 's/^/   | /' | tail -4
checkx "LOCK dead pid: the lock is taken over, the update finishes (exit 0, v2.0.2, lock gone)" '[ $rc -eq 0 ] && [ "$(ver)" = v2.0.2 ] && [ ! -e "$INST/.update.lock" ]'
bk="$(ls -d "$INST"/backups/pre-update-v2.0.0-* 2>/dev/null | head -n 1)"
checkx "R2-2 the new backup survives although future-dated backups sort above it" '[ -n "$bk" ] && [ "$(cat "$bk/database-state.json" 2>/dev/null)" = "{\"state\":\"kept\"}" ]'
checkx "R2-2 exactly 5 pre-update backups remain: the new one and the 4 newest of the future-dated" \
  '[ "$(ls -d "$INST"/backups/pre-update-* | wc -l)" = 5 ] && [ -d "$INST/backups/pre-update-v9.0.0-20990105-000000" ] && [ -d "$INST/backups/pre-update-v9.0.0-20990102-000000" ] && [ ! -e "$INST/backups/pre-update-v9.0.0-20990101-000000" ]'
check "R2-2 a folder in backups/ that is not an update backup is kept" [ -d "$INST/backups/my-own-backup" ]
check "R2-3 the stale ./.tmp/update.AbCdEf of the killed run is removed" [ ! -e "$INST/.tmp/update.AbCdEf" ]
checkx "R2-3 other folders in ./.tmp stay (one that is not update.*, one with a wrong-length name)" '[ -d "$INST/.tmp/my-stuff" ] && [ -d "$INST/.tmp/update.abc" ] && [ "$(ls -A "$INST/.tmp" | wc -l)" = 2 ]'
check "R2-2/R2-3 stderr has no shell errors" clean_of_noise "$T/errr2"

echo "== case R2-5: the backup message names what was copied (only data/database-state.json exists)"
restore; set_latest v2.0.2
rm -rf "$INST/data/db"
out="$(run_in update.sh --yes 2>&1)"; rc=$?
bk="$(ls -d "$INST"/backups/pre-update-v2.0.0-* 2>/dev/null | head -n 1)"
check "R2-5 exit 0" [ $rc -eq 0 ]
check "R2-5 message says: copied data/database-state.json to backups/pre-update-v2.0.0-..." grep -qE "^==> copied data/database-state.json to backups/pre-update-v2.0.0-[0-9]{8}-[0-9]{6}$" <<<"$out"
check "R2-5 message does not claim a database (data/db) was copied" bash -c '! grep -q "data/db" <<<"$1"' _ "$out"
checkx "R2-5 the backup holds database-state.json and no db folder" '[ -n "$bk" ] && [ -f "$bk/database-state.json" ] && [ ! -e "$bk/db" ]'

echo "== case R2-12: a release that ships port, ytzero.env and .tmp must not overwrite the user's files"
restore; set_latest v2.0.6
echo 4242 > "$INST/port"; echo "FOO=mine" > "$INST/ytzero.env"
out="$(run_in update.sh --yes 2>"$T/errr12")"; rc=$?
echo "$out" | sed 's/^/   | /' | tail -4
checkx "R2-12 update finishes (exit 0, VERSION v2.0.6)" '[ $rc -eq 0 ] && [ "$(ver)" = v2.0.6 ]'
check "R2-12 the user's ./port is still 4242 (the release's 7777 is ignored)" [ "$(cat "$INST/port")" = 4242 ]
check "R2-12 the user's ytzero.env is unchanged (the release's SHIPPED=1 is ignored)" [ "$(cat "$INST/ytzero.env")" = "FOO=mine" ]
check "R2-12 the release's .tmp content was not copied in" [ ! -e "$INST/.tmp/shipped.txt" ]
check "R2-12 stderr has no shell errors" clean_of_noise "$T/errr12"

echo "== start.sh with a stand-in bun (what port, what environment the server would get)"
STUB="$T/stub"; mkdir -p "$STUB/bin" "$STUB/app"; cp "$INST/start.sh" "$STUB/start.sh"; echo v9.9.9 > "$STUB/VERSION"
cat > "$STUB/bin/bun" <<'EOF'
#!/bin/sh
echo "STUB PORT=$PORT TMPDIR=$TMPDIR HOME=$HOME VAR=${YTZERO_TEST_VAR-unset}"
echo "STUB2 XDG=${XDG_CACHE_HOME-unset} DENO=${DENO_DIR-unset} BUNCACHE=${BUN_INSTALL_CACHE_DIR-unset}"
EOF
chmod 755 "$STUB/bin/bun"
# stub_run: run start.sh in the stub folder; STUB_PORT gets the port the "server" would see
stub_run() {
  (cd "$STUB" && env -i HOME="$HOME_FAKE" PATH="$FAKE_BASE_PATH" ${STUB_ENV:-} bash "$STUB/start.sh" >"$T/stub.out" 2>"$T/stub.err" </dev/null); STUB_RC=$?
  STUB_PORT="$(sed -n 's/^STUB PORT=\([^ ]*\) .*/\1/p' "$T/stub.out")"
}
port_case() { # <name> <port file content, or - for no file> <expected port> [expect a note on stderr: note]
  if [ "$2" = - ]; then rm -f "$STUB/port"; else printf '%s\n' "$2" > "$STUB/port"; fi
  stub_run
  local want="$3"   # (a condition given to checkx is evaluated inside checkx, where $3 would mean something else)
  checkx "L4 start.sh $1: server gets port $3 and the banner shows it" '[ $STUB_RC -eq 0 ] && [ "$STUB_PORT" = "$want" ] && grep -q "http://localhost:$want\$" "$T/stub.out"'
  if [ "${4:-}" = note ]; then check "L4 start.sh $1: says why on stderr" grep -q "Note:" "$T/stub.err"; fi
}
STUB_ENV=""
port_case "no ./port file" - 3001
port_case "./port holds 4242" 4242 4242
port_case "./port holds ' 5000 '" " 5000 " 5000
port_case "./port is empty" "" 3001 note
port_case "./port holds abc" abc 3001 note
port_case "./port holds 99999" 99999 3001 note
port_case "./port holds 0" 0 3001 note
port_case "./port holds 12ab" 12ab 3001 note
echo 4242 > "$STUB/port"
STUB_ENV="PORT=5555"; stub_run
check "start.sh PORT=5555 in the environment beats ./port" [ "$STUB_PORT" = 5555 ]
STUB_ENV="PORT=junk"; stub_run
checkx "L4 start.sh PORT=junk in the environment: 3001 and a note" '[ "$STUB_PORT" = 3001 ] && grep -q "Note:" "$T/stub.err"'
STUB_ENV=""
printf 'PORT=6060\nYTZERO_TEST_VAR="hello world"\n' > "$STUB/ytzero.env"; stub_run
checkx "M2 start.sh reads ytzero.env (its PORT beats ./port, its other settings reach the server)" '[ "$STUB_PORT" = 6060 ] && grep -q "VAR=hello world" "$T/stub.out"'
rm -f "$STUB/ytzero.env"; stub_run
check "M2 without ytzero.env the setting is not there" grep -q "VAR=unset" "$T/stub.out"
checkx "PORTABLE start.sh points TMPDIR into the folder (and makes it), leaves HOME alone" \
  'grep -q "TMPDIR=$STUB/.cache/tmp " "$T/stub.out" && [ -d "$STUB/.cache/tmp" ] && grep -q "HOME=$HOME_FAKE " "$T/stub.out"'
check "stderr start.sh prints no shell errors" clean_of_noise "$T/stub.err"
# R2-9: ytzero.env edge cases
printf 'PORT=6161\r\nYTZERO_TEST_VAR=crlf-value\r\n' > "$STUB/ytzero.env"; stub_run   # a file saved on Windows: every line ends in CR LF
checkx "R2-9 ytzero.env with CRLF line endings: the server gets PORT 6161 and a value without a stray CR" \
  '[ $STUB_RC -eq 0 ] && [ "$STUB_PORT" = 6161 ] && grep -qx "STUB PORT=6161 .* VAR=crlf-value" "$T/stub.out"'
printf 'A=$UNSET\nPORT=6262\n' > "$STUB/ytzero.env"; stub_run   # A=$UNSET reads a variable that does not exist
checkx "R2-9 a line A=\$UNSET does not stop start.sh (empty value), the next line still works" '[ $STUB_RC -eq 0 ] && [ "$STUB_PORT" = 6262 ]'
check "R2-9 A=\$UNSET prints no shell error ('unbound variable')" clean_of_noise "$T/stub.err"
printf 'TMPDIR=/ytz-bogus/tmp\nXDG_CACHE_HOME=/ytz-bogus/xdg\nDENO_DIR=/ytz-bogus/deno\nBUN_INSTALL_CACHE_DIR=/ytz-bogus/bun\n' > "$STUB/ytzero.env"; stub_run
checkx "R2-9 TMPDIR, XDG_CACHE_HOME, DENO_DIR and BUN_INSTALL_CACHE_DIR set in ytzero.env stay overridden by start.sh" \
  '[ $STUB_RC -eq 0 ] && grep -q "TMPDIR=$STUB/.cache/tmp " "$T/stub.out" && grep -qx "STUB2 XDG=$STUB/.cache DENO=$STUB/.cache/deno BUNCACHE=$STUB/.bun-cache" "$T/stub.out"'
rm -f "$STUB/ytzero.env"
# R2-C: order of the settings = command line, then ytzero.env, then ./port, then 3001
echo 4242 > "$STUB/port"; STUB_ENV=""
printf 'PORT=6060\n' > "$STUB/ytzero.env"; stub_run
check "R2-C ytzero.env PORT (6060) beats ./port (4242)" [ "$STUB_PORT" = 6060 ]
STUB_ENV="PORT=5555"; stub_run
checkx "R2-C PORT=5555 on the command line beats ytzero.env PORT=6060 and ./port, and the banner shows it" \
  '[ $STUB_RC -eq 0 ] && [ "$STUB_PORT" = 5555 ] && grep -q "http://localhost:5555\$" "$T/stub.out"'
printf 'PORT=6060\nYTZERO_TEST_VAR=only-in-file\n' > "$STUB/ytzero.env"; stub_run
checkx "R2-C with PORT on the command line, a setting that is only in ytzero.env still reaches the server" \
  '[ "$STUB_PORT" = 5555 ] && grep -q "VAR=only-in-file$" "$T/stub.out"'
printf 'YTZERO_TEST_VAR=from-file\n' > "$STUB/ytzero.env"; STUB_ENV="YTZERO_TEST_VAR=from-cmdline"; stub_run
check "R2-C any setting (not only PORT): the command line value beats ytzero.env" grep -q "VAR=from-cmdline$" "$T/stub.out"
STUB_ENV="YTZERO_TEST_VAR="; stub_run   # set but empty on the command line: counts as set
checkx "R2-C an empty value on the command line stays empty (ytzero.env does not fill it in)" \
  '[ $STUB_RC -eq 0 ] && grep -q "VAR=$" "$T/stub.out"'
printf 'BASE=7070\nPORT=$BASE\nYTZERO_TEST_VAR="$BASE-x y"\n' > "$STUB/ytzero.env"; STUB_ENV=""; stub_run
checkx "R2-C a line in ytzero.env can use a variable set earlier in the same file" \
  '[ "$STUB_PORT" = 7070 ] && grep -q "VAR=7070-x y$" "$T/stub.out"'
printf "PORT='6363'\nYTZERO_TEST_VAR=\"quoted value\"\n" > "$STUB/ytzero.env"; stub_run
checkx "R2-C quoted values in ytzero.env still work" '[ "$STUB_PORT" = 6363 ] && grep -q "VAR=quoted value$" "$T/stub.out"'
printf 'PATH=/ytz-bogus\n' > "$STUB/ytzero.env"; stub_run   # PATH is always in the environment, so the file cannot change it
checkx "R2-C PATH in ytzero.env does not break start.sh (the command line PATH stays)" \
  '[ $STUB_RC -eq 0 ] && grep -q "^STUB PORT=" "$T/stub.out" && clean_of_noise "$T/stub.err"'
rm -f "$STUB/ytzero.env"
STUB_ENV="TMPDIR=/ytz-cl/tmp XDG_CACHE_HOME=/ytz-cl/xdg DENO_DIR=/ytz-cl/deno BUN_INSTALL_CACHE_DIR=/ytz-cl/bun"; stub_run
checkx "R2-C the four cache variables given on the command line are overridden by start.sh too" \
  '[ $STUB_RC -eq 0 ] && grep -q "TMPDIR=$STUB/.cache/tmp " "$T/stub.out" && grep -qx "STUB2 XDG=$STUB/.cache DENO=$STUB/.cache/deno BUNCACHE=$STUB/.bun-cache" "$T/stub.out"'
STUB_ENV=""

echo "== case S:start.sh boots the real server (started through a symlink, PORT in the environment), GET /api/health"
restore; rm -rf "$INST/data"
SERVER_PORT="$(free_port)"
printf 'YTZERO_TEST_VAR="from ytzero.env"\n' > "$INST/ytzero.env"   # also proves ytzero.env is read by the real start.sh
echo 3001 > "$INST/port"
ln -s "$INST" "$LINK"
(cd "$LINK" && exec env -i HOME="$HOME_FAKE" PATH="$FAKE_BASE_PATH" PORT="$SERVER_PORT" bash "$LINK/start.sh" >"$T/start.log" 2>&1 </dev/null) &
SERVER_PID=$!   # remembered: this is the pid we stop at the end (exec keeps it through env -> bash -> bun)
health=""
for _ in $(seq 120); do health="$(curl -fs "http://127.0.0.1:$SERVER_PORT/api/health" 2>/dev/null)" && break; health=""; sleep 0.5; done
echo "   | $health"
check "S GET /api/health answers with status ok" grep -q '"status":"ok"' <<<"$health"
check "S /api/health reports the release version v2.0.0" grep -q '"version":"v2.0.0"' <<<"$health"
check "S /api/health reports the commit the tarball was built from (the app shows its first 7 characters)" grep -q "\"commit\":\"${BUILD_COMMIT:0:7}\"" <<<"$health"
check "S the banner shows the port" grep -q "http://localhost:$SERVER_PORT\$" "$T/start.log"
spid="$SERVER_PID"
if [ "$LOOKUP_OK" = 1 ]; then
  check "S the process that listens on the port is the server we started (pid $spid)" [ "$(port_pid "$SERVER_PORT")" = "$spid" ]
else
  skip "S the process that listens on the port is the server we started (no way to look up a port's pid here)"
fi
checkx "S the server runs with its working folder in the real app/ folder" '[ -n "$spid" ] && [ "$(readlink "/proc/$spid/cwd")" = "$INST/app" ]'
checkx "S the server got ytzero.env settings and a TMPDIR inside the folder" \
  '[ -n "$spid" ] && tr "\0" "\n" < "/proc/$spid/environ" | grep -qx "YTZERO_TEST_VAR=from ytzero.env" && tr "\0" "\n" < "/proc/$spid/environ" | grep -qx "TMPDIR=$INST/.cache/tmp"'
check "S the server log has no shell errors" clean_of_noise "$T/start.log"
check "PORTABLE running the server left the fake HOME empty" home_empty

echo "== case M3: the folder reached through a symlink: a running server is still found"
set_latest v2.0.1
out="$(run_dir "$INST" update.sh --yes 2>&1)"; rc=$?
checkx "M3 update.sh (real path) refuses while the server runs" '[ $rc -ne 0 ] && grep -q "still running" <<<"$out"'
out="$(run_dir "$LINK" update.sh --yes 2>&1)"; rc=$?
checkx "M3 update.sh started through the symlinked path refuses too" '[ $rc -ne 0 ] && grep -q "still running" <<<"$out" && [ "$(ver)" = v2.0.0 ]'
out="$(run_dir "$LINK" uninstall.sh --dry-run 2>&1)"; rc=$?
checkx "M3 uninstall.sh --dry-run through the symlinked path refuses too" '[ $rc -ne 0 ] && grep -q "still running" <<<"$out"'
sport="$SERVER_PORT"; spid_run="$SERVER_PID"; stop_server; SERVER_PORT=""
# "Stopped" is judged without ss: the pid we started is gone AND a connection to the port is refused.
# (When the port lookup works, it must also find no listener.)
checkx "S the server stopped (the pid we started is gone and its port refuses connections)" 'proc_gone "$spid_run" && [ ! -d "/proc/$spid_run" ] && ! port_open "$sport"'
if [ "$LOOKUP_OK" = 1 ]; then check "S the server stopped (no process listens on its port any more)" [ -z "$(port_pid "$sport")" ]
else skip "S no process listens on the server's port any more (no way to look up a port's pid here)"; fi
rm -f "$LINK"
check "S the server created its data under the folder (./data)" [ -d "$INST/data" ]

echo "== case U: uninstall.sh"
restore; before="$(tree_sum "$INST")"; dbefore="$(data_sum)"
out="$(run_in uninstall.sh --dry-run 2>&1)"; rc=$?
checkx "U --dry-run: exit 0, says dry run, lists node_modules and bin/bun" '[ $rc -eq 0 ] && grep -q "dry run" <<<"$out" && grep -q "app/node_modules" <<<"$out" && grep -q "bin/bun" <<<"$out"'
check "U --dry-run removed nothing" [ "$(tree_sum "$INST")" = "$before" ]
# a symlinked bin/: rm -rf bin/bun would delete the file in the folder it points to
mkdir "$T/real-bin-target"; mv "$INST/bin"/* "$INST/bin"/.installed "$T/real-bin-target/"; rmdir "$INST/bin"; ln -s "$T/real-bin-target" "$INST/bin"
out="$(run_in uninstall.sh --yes 2>&1)"; rc=$?
checkx "U a symlinked bin/ is refused (exit non-zero, message names the link)" '[ $rc -ne 0 ] && grep -q "symbolic link" <<<"$out"'
checkx "U ... and the files it points to are still there, node_modules too" '[ -x "$T/real-bin-target/bun" ] && [ -d "$INST/app/node_modules" ]'
rm "$INST/bin"; mv "$T/real-bin-target" "$INST/bin"
out="$(run_in uninstall.sh --yes 2>&1)"; rc=$?
check "U real run: exit 0" [ $rc -eq 0 ]
checkx "U removed node_modules, the tools, bin/, caches and ./port" '[ ! -e "$INST/app/node_modules" ] && [ ! -e "$INST/bin" ] && [ ! -e "$INST/.bun-cache" ] && [ ! -e "$INST/port" ]'
checkx "U kept ./data unchanged and the program files" '[ "$(data_sum)" = "$dbefore" ] && [ -f "$INST/VERSION" ] && [ -f "$INST/app/package.json" ]'
check "U prints the rm -rf line for the folder" grep -q "rm -rf " <<<"$out"
check "PORTABLE uninstall.sh left the fake HOME empty" home_empty
out="$(run_in uninstall.sh --remove-data --yes 2>&1)"; rc=$?
checkx "U --remove-data --yes deletes ./data" '[ $rc -eq 0 ] && [ ! -e "$INST/data" ]'

echo "== case R2-11: uninstall.sh and a running update.sh (the .update.lock folder)"
restore; mkdir "$INST/.update.lock"; echo "$$" > "$INST/.update.lock/pid"   # this test's own pid: certainly alive
before="$(tree_sum "$INST")"
out="$(run_in uninstall.sh --yes 2>&1)"; rc=$?
checkx "R2-11 uninstall.sh --yes refuses while the lock holds a live pid (nothing removed)" '[ $rc -ne 0 ] && grep -q "update.sh is running in this folder (pid $$)" <<<"$out" && [ "$(tree_sum "$INST")" = "$before" ]'
out="$(run_in uninstall.sh --dry-run 2>&1)"; rc=$?
checkx "R2-11 uninstall.sh --dry-run refuses too" '[ $rc -ne 0 ] && grep -q "update.sh is running in this folder" <<<"$out"'
echo "$(dead_pid)" > "$INST/.update.lock/pid"   # a leftover of a killed update.sh
out="$(run_in uninstall.sh --dry-run 2>&1)"; rc=$?
checkx "R2-11 a lock with a dead pid does not block (--dry-run lists the files, exit 0)" '[ $rc -eq 0 ] && grep -q "dry run" <<<"$out" && ! grep -q "update.sh is running" <<<"$out"'
out="$(run_in uninstall.sh --yes 2>&1)"; rc=$?
checkx "R2-11 a lock with a dead pid does not block a real uninstall either" '[ $rc -eq 0 ] && [ ! -e "$INST/app/node_modules" ]'

echo "== end: nothing leaked outside the test folders"
check "PORTABLE no script put anything in TMPDIR" bash -c '[ -z "$(ls -A "$1")" ]' _ "$HOSTTMP"
check "PORTABLE the nonexistent TMPDIR was never created" [ ! -e "$NO_TMP" ]
check "PORTABLE the fake HOME is still empty" home_empty

echo
[ "$SKIPPED" -eq 0 ] || echo "!! $SKIPPED check(s) were SKIPPED (not counted as passed): see the SKIPPED: lines above"
echo "== $PASS passed, $FAIL failed in $((SECONDS-START))s"
[ "$FAIL" -eq 0 ]
