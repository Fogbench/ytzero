# syntax=docker/dockerfile:1
# YT Zero image: ghcr.io/fogbench/ytzero:<version> (x86_64 and aarch64).
# Built and published by .github/workflows/release.yml; see README "Run with Docker".
# Bun is the pinned base image (same version as scripts/release/tools.lock, checked
# below); Deno, yt-dlp and ffmpeg come from tools.lock with their sha256 checked.
# Everything that changes at runtime lives in the one volume /data.

# Bun 1.4.3, pinned by digest (multi-arch index). Change together with tools.lock.
ARG BUN_IMAGE=oven/bun:1.4.3-slim@sha256:14a223fa35747ec728bce300ef85888bc5f7958164d15bbba6a54b22b52a3288
ARG BUN_BUILD_IMAGE=oven/bun:1.4.3@sha256:ec06c3b6cea04192ae6770c434f668ca41d343ad19fa6472216c7b48be39c598

# ---- web client: the same files on every CPU, so it is built once on the build machine ----
FROM --platform=$BUILDPLATFORM ${BUN_BUILD_IMAGE} AS ui
ARG YTZERO_VERSION=dev
WORKDIR /src/ui
COPY ui/package.json ui/bun.lock ./
RUN bun install --frozen-lockfile
COPY shared/ /src/shared/
COPY ui/ ./
# Offline changelog: same as scripts/package-release.sh, so the build never asks GitHub.
RUN YTZERO_CHANGELOG_OFFLINE=1 YTZERO_VERSION="$YTZERO_VERSION" bun run build

# ---- third-party tools for the target CPU, from tools.lock ----
FROM ${BUN_BUILD_IMAGE} AS tools
RUN apt-get update && apt-get install -y --no-install-recommends bash ca-certificates curl unzip xz-utils \
 && rm -rf /var/lib/apt/lists/*
COPY scripts/release/tools-lib.sh scripts/release/tools.lock /lock/
COPY scripts/docker/fetch-tools.sh /lock/
RUN bash /lock/fetch-tools.sh /lock /opt/ytzero/bin

# ---- server dependencies for the target CPU (sharp and resvg ship per-CPU binaries) ----
FROM ${BUN_BUILD_IMAGE} AS deps
WORKDIR /app/app
COPY app/package.json app/bun.lock ./
RUN bun install --production --frozen-lockfile

# ---- runtime ----
FROM ${BUN_IMAGE}
ARG YTZERO_VERSION=dev
ARG YTZERO_COMMIT=unknown
LABEL org.opencontainers.image.title="YT Zero" \
      org.opencontainers.image.source="https://github.com/Fogbench/ytzero" \
      org.opencontainers.image.licenses="AGPL-3.0-only" \
      org.opencontainers.image.version="${YTZERO_VERSION}" \
      org.opencontainers.image.revision="${YTZERO_COMMIT}"

# The repository layout is kept (app/, shared/, ui/dist) because the server imports ../../shared.
WORKDIR /app/app
COPY --from=tools /opt/ytzero/bin /opt/ytzero/bin
COPY --from=deps /app/app/node_modules ./node_modules
COPY app/package.json ./
COPY app/src ./src
COPY app/scripts/provision-ytdlp.sh ./scripts/provision-ytdlp.sh
COPY shared/ /app/shared/
COPY --from=ui /src/ui/dist /app/ui/dist
COPY scripts/docker/entrypoint.sh /app/entrypoint.sh
COPY LICENSE /app/LICENSE
# Unit tests are not used at runtime. /data belongs to the non-root user "bun" (uid 1000),
# so a new named volume is writable for it.
RUN find /app/app/src /app/shared -name '*.test.ts' -delete \
 && chmod 0755 /app/entrypoint.sh ./scripts/provision-ytdlp.sh \
 && mkdir -p /data && chown bun:bun /data

ENV PORT=3001 \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    NODE_ENV=production \
    PATH=/opt/ytzero/bin:$PATH \
    UI_DIST=../ui/dist \
    DB_PATH=/data/db/ytzero.db \
    IMG_CACHE_DIR=/data/imgcache \
    DOWNLOADS_DIR=/data/downloads \
    DOWNLOAD_COOKIES_DIR=/data/download-cookies \
    RESTORE_SESSION_DIR=/data/restore-sessions \
    AVATAR_DIR=/data/avatars \
    LOG_PATH=/data/logs/ytzero.log \
    XDG_CACHE_HOME=/data/cache \
    DENO_DIR=/data/cache/deno \
    YTDLP_PATH=/data/bin/yt-dlp \
    YTDLP_MANAGED_PATH=/data/bin/yt-dlp \
    YTDLP_BOOTSTRAP_PATH=/opt/ytzero/bin/yt-dlp \
    YTDLP_PROVISION_MARKER=/data/bin/.yt-dlp-channel-reconciliation-pending \
    YTDLP_AUTO_UPDATE=1 \
    YTZERO_VERSION=${YTZERO_VERSION} \
    YTZERO_COMMIT=${YTZERO_COMMIT}

USER bun
VOLUME /data
EXPOSE 3001

# The slim image has no curl; Bun itself probes the health endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["bun", "-e", "const r = await fetch(`http://127.0.0.1:${process.env.PORT ?? 3001}/api/health`); process.exit(r.ok ? 0 : 1)"]

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["bun", "src/index.ts"]
