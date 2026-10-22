# Notes for the next release

Not released yet, so `ui/public/changelog.json` has no entry for these: that file is generated from the published GitHub releases (bullets in each release body), and an entry without a CalVer version is dropped at the next build. When cutting the release, paste the bullets below into the draft release body, then delete this file.

- Faster direct start. YT Zero looks the video up early, when you hover a card or open the watch page, and the player shares that one lookup.
- The default stream is H.264 up to 1080p, within your profile's quality limit. Auto stays within the limit too.
- Docker: a public image on the GitHub Container Registry (`ghcr.io/fogbench/ytzero`, x86_64 and aarch64), published when a release is published. Dockerfile and `compose.yaml` are in the repository; see "Run with Docker" in the README.
- Fixed importing a video (`POST /api/videos/<id>/import`): it now stores the video.
- Fixed "Create playlist from session queue" and "Remove video from playlist", which did nothing.
- Fixed "Remove local copy" downloading the video again while it was queued. It now moves to Main/inbox. Playlists set to keep videos offline still download them again, on purpose.
- Fixed direct playback taking 10 to 15 seconds to start with newer yt-dlp builds: the tv_samsung client is excluded, a 403 on the stream index is retried, failures are logged, and a failed lookup is remembered briefly.
- Dependencies, tools: Bun 1.4.2 -> 1.4.3 (also the Docker base images), Deno 2.9.7 -> 2.9.8, yt-dlp 2026.08.19 -> 2026.10.21. ffmpeg stays at 7.0.2.
- Dependencies, server: @types/bun 1.4.2 -> 1.4.3, @peculiar/x509 2.1.0 -> 2.2.0 and its asn1 packages 2.10.0 -> 2.11.0, asn1js 3.0.10 -> 3.1.0, jose 6.2.12 -> 6.2.13, strnum 2.4.2 -> 2.5.1, @types/node 26.6.4 -> 26.6.5.
- Dependencies, web: react and react-dom 19.3.0 -> 19.3.1, react-router 8.4.0 -> 8.5.0, vite 8.3.2 -> 8.3.5, @vitejs/plugin-react 6.1.1 -> 6.1.2, lucide-react 1.52.0 -> 1.61.0, emoji-picker-react 4.22.3 -> 5.1.0 (the picker looks the same, emoji are about 2px further apart), plus smaller build-tool updates (rolldown 1.2.12 -> 1.2.15, postcss 8.5.28 -> 8.5.31, nanoid, source-map-js).
- Dependencies, GitHub Actions: ci.yml now uses the same pinned commits as release.yml. docker/setup-buildx-action v3.12.0 -> v4.4.1, docker/build-push-action v6.19.2 -> v7.4.0, docker/login-action v3.7.0 -> v4.6.0.
