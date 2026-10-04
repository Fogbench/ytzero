# YouTube playback without an offline download

Verified on 2026-09-10 with yt-dlp 2026.08.19, Deno 2.9.6 and Chrome on macOS.

## Findings

The existing experimental HLS implementation already knew how to expose
separate H.264/AAC MP4 representations as HLS byte ranges, but always called
the background download scheduler. The separate direct player required a
progressive MP4 containing both tracks. That format was absent from the
public test video `jNQXAC9IVRw`, even though independent audio/video formats
were available and readable.

The [yt-dlp FAQ](https://github.com/yt-dlp/yt-dlp/wiki/FAQ#i-extracted-a-video-url-but-it-does-not-play-on-another-machine--in-my-web-browser)
explains that media requests can require the same IP and HTTP headers as the
extractor. It also documents throttling for YouTube requests larger than 10 MB.
The server therefore proxies media with the selected format's `http_headers`
(falling back to the metadata-level headers) and splits large HLS ranges into
upstream requests of at most 8 MiB. Signed URLs stay on the server.

The [EJS guide](https://github.com/yt-dlp/yt-dlp/wiki/EJS) recommends Deno
(at least 2.3.0). Current official yt-dlp executables include the challenge
solver scripts. Bun's EJS support is deprecated; running the application in
Bun does not replace Deno. The installed local yt-dlp and Deno worked without
a development-server fix. In this fork `bun run setup` downloads both. For YouTube refusals, the
[PO Token guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide)
describes token-provider support; the existing cookie/provider configuration
continues to apply.

A later tvOS failure for `As4DowYZPOQ` traced to the running development
server's PATH: `~/.deno/bin/deno` was 1.46.3, while the interactive terminal
found Homebrew's 2.9.6. yt-dlp returned "This video is not available" for the
public Short with the older runtime. The server now scans its PATH for a
supported Deno and supplies `--js-runtimes deno:<absolute-path>` to its shared
yt-dlp command builder. Runtime status reports that same selected executable's
version. No shell profile, installed binary or persistent setting is changed.
Missing-format extraction errors are retried once within the existing timeout
and are not cached as confirmed media incompatibility.

## Implementation and use

Choose **Settings → Downloads → Default player → Direct stream**. The direct
player does not require downloads or experimental play-while-downloading to
be enabled. Existing download/ask source preferences and already-downloaded
files retain their priority.

`/api/videos/:id/direct-hls/index.m3u8` resolves H.264 video and AAC audio
metadata with `--skip-download --dump-single-json`, respecting the profile's
quality limit. It reads their MP4 initialization and SIDX indexes, then
publishes local master/audio/video playlists. Seeking requests the bytes for
the selected timestamp; earlier video does not need to be transferred.

The standalone streaming service has no download-scheduler or ffmpeg
dependency. It creates neither media files nor download/ownership rows.
Only metadata, indexes and bounded media ranges live in memory. The browser
keeps a limited playback buffer. Watching still transfers video bytes over
the network; it does not create an offline copy.

The shared player uses native HLS where available and hls.js otherwise. If
indexed HLS is unavailable, the direct player tries the previous progressive
MP4 transport once, then returns to YouTube. It preserves playback position
across these handoffs. Unsupported live, private, unavailable, members-only,
and child-profile cases remain restricted. H.264 availability limits quality;
this is not a promise of AV1/VP9/4K or access to restricted videos.

The original experimental HLS mode still explicitly downloads in the
background. It shares the corrected header/range handling, but its download
behavior is separate from the direct player. Portable backup's `default_player`
field and schema are unchanged; transient playback material is not exported.

With `experimental_streaming=1` and downloads enabled, the web client's
`default_player=direct` still takes priority and uses `/direct-hls` without
queueing a download (when the watch-source preference permits remote playback).
Keeping `default_player=youtube` instead selects the experimental `/hls` player,
which uses the same indexed H.264/AAC transport and queues an offline copy.

## Native TV playback

`POST /api/videos/:id/playback-ticket` selects `direct-hls` for non-local VOD,
independently of download settings. Owned downloads and TubeArchivist copies
retain priority. The response has `content_type: "hls"`; the TV client validates
the transport and passes `contentType: "hls"` to `expo-video`/AVPlayer. This
replaces the old `/direct-stream` source, which could return 502 when YouTube
did not offer a combined progressive MP4.

The short-lived ticket is scoped to that video's `direct-hls` resources.
Playlist rewriting attaches it to video/audio rendition URLs, `EXT-X-MAP`
initialization URLs and byte-range media URLs, preserving the source generation
parameter. It cannot authorize `/hls`, `/direct-stream`, downloads or other
videos. Renewal and revocation keep their existing session/profile binding.

[Expo's video documentation](https://docs.expo.dev/versions/latest/sdk/video/)
requires an HLS URI extension or explicit `contentType: "hls"` for native HLS
track discovery. Apple's [HLS deployment guide](https://developer.apple.com/documentation/http-live-streaming/deploying-a-basic-http-live-streaming-hls-stream)
supports the fragmented MP4 H.264/AAC transport used here.

## Verification

- After fixing the shadowed Deno installation, the running development instance
  on port 5174 served `As4DowYZPOQ` at 1080×1920: master and both renditions
  returned 200, and audio/video initialization and first media ranges returned
  exact 206 responses. The tvOS 26.5 simulator played this previously failing
  Snoopy Short, advanced to the next Short and returned to Snoopy with Up.
- Real YouTube metadata/index/fragment requests: `jNQXAC9IVRw` and
  `aqz-KE-bpKQ` (Big Buck Bunny). The latter selected 1920×1080 at 60 FPS with
  AAC audio; both media endpoints returned bounded HTTP 206 responses.
- Chrome: played the 10:34 film, jumped to the midpoint with the `5` shortcut,
  and continued playback. Afterwards the test database had zero downloads and
  zero download owners, and the download directory was empty.
- A controlled missing-master test exposed a stalled HLS recovery: `startLoad`
  cannot retry an unloaded master. Recovery now reloads the source before
  falling back, and restores the progressive `src` after HLS effect cleanup.
  Verified in Chrome with a generated 20-second MP4: metadata loaded and
  playback, including audio, worked after the HLS endpoint returned 404.
- The browser test used an isolated instance on port 3017 with temporary data
  and downloads disabled. Safari/iOS playback was not manually verified.
- tvOS 26.5 simulator: the running TV app played the non-downloaded video
  `q1D90-uGvBg` and sought from 2:07 to 2:57 with the native controls, then
  returned to the feed. The video still had no download row after playback.
- Native ticket API with real YouTube `nZwdIPg7N3A`: master returned 200 with
  `avc1.640028,mp4a.40.2`; both initialization ranges and media ranges around
  minute 10 returned 206 using only the issued media ticket. The isolated
  database had zero downloads/owners and its media directory remained empty.
  Physical Apple TV, Android TV and long-session ticket renewal were not
  manually tested in this change.
- Standard web application with `experimental_streaming=1`, downloads enabled,
  and a temporary database: direct-player playback started at the requested
  3:00 timestamp with zero download rows or files. Switching the default player
  to YouTube selected the experimental UI and created one queued download.
  Both `/hls` and `/direct-hls` returned 1080p master playlists (200) and exact
  audio/video ranges around 5:00 (206) for `aqz-KE-bpKQ`. Background workers were
  disabled for this test so the experimental queue could be inspected before
  a local file existed. Continuous experimental playback was not visually
  confirmed; browser automation lost access to the window after loading.
- Regression tests cover standalone routing with downloads disabled, profile
  restrictions, source-header validation, a refused index followed by a fresh
  resolve, large-fragment splitting, exact far byte ranges, cache invalidation,
  and the existing experimental/progressive paths.

## Native live playback (2026-09-10)

Active broadcasts use `/videos/:id/live-hls/index.m3u8`, a master playlist with
separate H.264 video and AAC audio renditions. YouTube may return muxed live
formats 91–96 on one extraction and omit them on the next. Selecting only a
muxed format is therefore insufficient. Video uses
`bestvideo[protocol*=m3u8][vcodec^=avc1]` with the profile's quality cap; audio
uses `bestaudio[protocol*=m3u8][ext=mp4]`. Audio formats 233/234 can omit `acodec`
in yt-dlp metadata, so filtering them by an AAC codec string excludes valid audio.

The existing live-radio relay handles each rendition's rolling playlist,
bounded live window, signed-URL renewal and segment proxying. Radio and video
have separate caches. Video resource tokens include a random session namespace
and rendition prefix, so a discarded session's URL cannot resolve to a different
segment in its replacement. These maps and signed URLs are process-local
transient state, with no download jobs, media cache files or backup fields.
Native tickets authorize only this video's live playlists and opaque resources;
profile/session checks still run for every media request. Upcoming, private,
members-only and child-restricted playback remain unavailable.

The TV player accepts an indefinite duration for live HLS, starts at the live
edge and uses normal playback speed. It records the play in history, but does
not save a VOD resume position or mark the broadcast completed. VOD continues
to require a valid finite duration and retains its existing resume behavior.

Verified in the tvOS 26.5 simulator with `GSfT7H87zq4` (synth ambient radio),
including repeated playlist reloads over several minutes, and `rFZHOHl-L8A`
(lofi hip hop radio). A real proxied segment was also inspected with ffprobe.
The native live label and audio controls were visible. A separate experiment
with `requiresLinearPlayback` confirmed it disables seeking but does not remove
the tvOS timeline; that presentation change was not retained.

Sources: [yt-dlp format selection](https://github.com/yt-dlp/yt-dlp#format-selection),
[Apple HLS](https://developer.apple.com/streaming/),
[AVKit transport-bar configuration](https://developer.apple.com/documentation/avkit/avplayerviewcontroller/playbackcontrolsincludetransportbar).

Run backend checks from `app/` (the repository's normal backend test context):

```sh
bun test src/downloadVideoDirectStreaming.test.ts src/downloadVideoStreaming.test.ts src/downloadVideoProgressiveStreaming.test.ts src/directVideoRoutes.test.ts src/routesManifest.test.ts src/videoVodPlaylist.test.ts src/mediaSidx.test.ts src/serverMessages.test.ts
bun test src/portableBackup.test.ts
bun test src/mediaTickets.test.ts src/nativePlaybackRoutes.test.ts src/directVideoRoutes.test.ts
bun test src/liveVideoStreaming.test.ts src/downloadLiveAudioStreaming.test.ts src/liveAudioPlaylist.test.ts
bun run typecheck
```

Native TV checks, from `apps/tv/`:

```sh
bun test src
bun run typecheck
```

UI checks, from the repository root:

```sh
bun test ui/src/i18nCatalog.test.ts ui/src/i18nFormatting.test.ts ui/src/pages/watchPlayerMode.test.ts ui/src/videoHlsPolicy.test.ts
```

From `ui/`, run `bun run typecheck` and `bun run build:prepared`.
