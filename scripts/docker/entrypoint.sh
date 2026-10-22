#!/bin/sh
# Container start: checks that /data is writable, creates its folders, then hands over to
# provision-ytdlp.sh, which copies the image's yt-dlp to /data/bin/yt-dlp on a new volume
# (from then on yt-dlp updates itself there, between image releases).
set -eu

if ! mkdir -p /data/db /data/logs /data/bin /data/cache 2>/dev/null || [ ! -w /data ]; then
  echo "error: /data is not writable for user $(id -u):$(id -g)." >&2
  echo "Use a named volume (-v ytzero-data:/data), or give a host folder to that user: sudo chown -R $(id -u):$(id -g) <folder>" >&2
  exit 1
fi

exec /app/app/scripts/provision-ytdlp.sh "$@"
