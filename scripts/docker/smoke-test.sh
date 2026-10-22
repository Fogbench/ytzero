#!/usr/bin/env bash
# Smoke test for a built image: start it on a fresh volume, wait for /api/health, check
# the version, the non-root user and the bundled tools, then play one video directly
# (open it like the player does, then read the first bytes of /api/videos/<id>/direct-stream).
# Usage: bash scripts/docker/smoke-test.sh <image> [expected version] [host port, default 3113]
# The direct play needs YouTube. It fails the test, except when YouTube answers with its
# "confirm you're not a bot" check, which it gives to many datacenter addresses (GitHub's
# runners included): that is about the runner's address, not the image, so it is a warning.
# SMOKE_PLAY_STRICT=1 makes that a failure too.
set -euo pipefail
IMAGE="$1"; EXPECT_VERSION="${2:-}"; PORT="${3:-3113}"
VIDEO="${SMOKE_VIDEO:-jNQXAC9IVRw}"   # "Me at the zoo": public, short, never removed
NAME="ytzero-smoke-$$"; VOL="ytzero-smoke-$$"
BASE="http://127.0.0.1:$PORT"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; docker volume rm "$VOL" >/dev/null 2>&1 || true; }
trap cleanup EXIT
fail() { echo "FAIL: $*" >&2; echo "--- container log ---" >&2; docker logs --tail 80 "$NAME" >&2 || true; exit 1; }

docker run -d --name "$NAME" -p "127.0.0.1:$PORT:3001" -v "$VOL:/data" "$IMAGE" >/dev/null

health=""
for _ in $(seq 1 60); do
  health="$(curl -fsS "$BASE/api/health" 2>/dev/null)" && break
  [ "$(docker inspect -f '{{.State.Running}}' "$NAME")" = true ] || fail "the container stopped"
  sleep 1
done
[ -n "$health" ] || fail "/api/health did not answer within 60 s"
echo "health: $health"
if [ -n "$EXPECT_VERSION" ]; then
  grep -q "\"version\":\"$EXPECT_VERSION\"" <<<"$health" || fail "health does not report version $EXPECT_VERSION"
fi

uid="$(docker exec "$NAME" id -u)"
[ "$uid" != 0 ] || fail "the server runs as root"
docker exec "$NAME" sh -c '/data/bin/yt-dlp --version && deno --version | head -n 1 && ffmpeg -version | head -n 1 && ffprobe -version | head -n 1' \
  || fail "a bundled tool does not run"

# Docker's own health check must agree (it runs every 30 s after a 30 s start period).
if [ "${SMOKE_DOCKER_HEALTH:-1}" = 1 ]; then
  for _ in $(seq 1 90); do
    state="$(docker inspect -f '{{.State.Health.Status}}' "$NAME")"
    [ "$state" = healthy ] && break
    [ "$state" = unhealthy ] && fail "docker reports the container unhealthy"
    sleep 1
  done
  [ "$state" = healthy ] || fail "docker health status is '$state' after 90 s"
  echo "docker health: healthy"
fi

# The player opens a video through /info first (that stores it), then streams it.
info_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 120 "$BASE/api/videos/$VIDEO/info" || true)"
body="$(mktemp)"
code="$(curl -sS -o "$body" -w '%{http_code}' -H 'Range: bytes=0-65535' --max-time 120 "$BASE/api/videos/$VIDEO/direct-stream" || true)"
size="$(wc -c < "$body")"; rm -f "$body"
if { [ "$code" = 200 ] || [ "$code" = 206 ]; } && [ "$size" -gt 1000 ]; then
  echo "direct play: HTTP $code, $size bytes"
elif [ "${SMOKE_PLAY_STRICT:-0}" != 1 ] && docker logs "$NAME" 2>&1 | grep -qiE "confirm you.?re not a bot"; then
  echo "::warning::direct play skipped: YouTube asked this runner to confirm it is not a bot (info HTTP $info_code, stream HTTP $code)."
else
  fail "direct play: info HTTP $info_code, stream HTTP $code, $size bytes"
fi
echo "smoke test passed"
