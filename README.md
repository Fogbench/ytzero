<div align="center">
  <img src="docs/assets/ytzero-logo.svg" width="112" height="112" alt="YT Zero logo">
  <h1>YT Zero</h1>
  <p><strong>A self-hosted YouTube inbox for people who want subscriptions, not recommendations.</strong></p>
  <p>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="AGPL-3.0-only"></a>
  </p>
</div>

> [!NOTE]
> **This is a community fork of [Pelski/ytzero](https://github.com/Pelski/ytzero).** The original author has stepped away from the project and welcomed anyone who wants to carry it on; all credit for YT Zero itself goes to them and to the contributors named in the upstream README. This fork keeps the app as it was and adds a much more complete **direct player**, described below. Everything added is optional: removals are settings that are shown by default, and every new string is translated into all nine UI languages.
>
> ### Direct player vs. the embedded YouTube player
>
> The direct player is the default in this fork: it streams the video from YouTube through your own server (via yt-dlp), without saving anything to disk, and plays it in YT Zero's own controls. YouTube's embed remains an option (**Settings > Downloads**, tab **Configuration**, **Default player**), and is used automatically when yt-dlp is not installed. In practice:
>
> - **Faster to start and to seek**, no embed iframe to load, and no YouTube page chrome, end cards or suggestions on top of the video.
> - **Everything in one gear menu**, laid out like YouTube's: Autoplay, SponsorBlock, Stable volume, Voice boost, Audio track, Sleep timer, Playback speed, Subtitles and Quality. Menus also work in fullscreen.
> - **Quality up to 4K**: pick a height, or Auto for the tallest. Choose AV1 or H.264 (MP4) per your hardware; the current quality is checkmarked and the list only offers what your browser can decode.
> - **Audio track**: videos with dubbed audio let you switch language without leaving the player. Playback continues from the same position.
> - **Subtitles**: the CC button only switches captions on and off. Language and style (size, colour, background, with a live sample) are in the gear. Auto-generated captions are labelled "(auto-generated)", can be limited to a fallback when the uploader made none, or hidden entirely.
> - **Stable volume and Voice boost**: evens out loud and quiet parts, and lifts the speech range, using your browser's audio engine (nothing is re-encoded).
> - **Sleep timer**: 5 to 60 minutes, or **End of video** (the video is still marked watched, but autoplay does not move on).
> - **Playback speed slider** from 0.25x to 2x in 0.05 steps, previewed live and saved on release.
> - **SponsorBlock** switch in the gear; a segment you deliberately seek into is no longer skipped.
> - **Autoplay that works**: the gear switch turns on continuing through lists, and with no queue or playlist, up next falls back to "More like this", including a banner that shows in fullscreen.
> - **Never silently falls back to the embed.** If direct playback fails you get an explanation, a YouTube link and a button to use the embed.
>
> Other additions, as settings (all shown by default, switch them off in your profile):
>
> - **Hide "Continue watching"** (Settings > Experience > Navigation).
> - **Hide the player's Download, Screenshot and Picture-in-picture buttons** (Settings > Experience > Playback).
> - **Auto-generated captions** mode (Settings > Experience > Subtitles).
>
> Known limits: the direct player proxies H.264/AAC and AV1 streams from YouTube, so it depends on yt-dlp keeping up with YouTube, and two tabs playing the same video at different qualities replace each other's stream. Stable volume and Voice boost only work in the direct player. It has been tested mostly in Firefox and Chrome.

It reads public YouTube RSS feeds, stores everything in your own SQLite or PostgreSQL database, and gives you a calm place to sort, schedule, watch, archive, and revisit videos from creators you already follow. [yt-dlp](https://github.com/yt-dlp/yt-dlp) is installed with the app: it lets YT Zero stream videos through your own server into its own player, and, if you switch Downloads on, keep copies on disk.

PostgreSQL deployments can run multiple HTTP replicas with one nominated
background worker. See the [clustered deployment configuration](wiki/Configuration.md#clustered-postgresql-deployment)
for worker, shared-storage, and load-balancer requirements. SQLite deployments
remain single-instance.

If the problem is "YouTube is good at surfacing more, not better," YT Zero is the opposite: a quiet inbox, your own rules, and a player built around intentional watching.

![YT Zero main feed](docs/assets/feed.png)

| Standard player | Theater player |
| --- | --- |
| <img src="docs/assets/video-standard.png" alt="YT Zero standard video player" width="360"> | <img src="docs/assets/video-theater.png" alt="YT Zero theater video player" width="360"> |

| Tags and rules | Display settings |
| --- | --- |
| <img src="docs/assets/tags.png" alt="YT Zero tags and rules settings" width="360"> | <img src="docs/assets/display.png" alt="YT Zero display settings" width="360"> |

## Why it exists

YouTube is excellent at keeping attention and bad at staying out of the way. If all you want is:

- your subscriptions in one place
- a clean watch queue
- no forced sign-in
- no API setup
- no recommendation loop

then the default YouTube experience keeps adding noise around the thing you actually came for.

YT Zero removes that layer. It keeps subscriptions, watch progress, playlists, tags, and playback controls. It drops the account dependency and the recommendation machinery.

## What makes it useful

- **Focused inbox** — all new videos from followed channels in one chronological feed.
- **No Google dependency** — works without a Google account or YouTube Data API key.
- **Local-first state** — subscriptions, progress, history, playlists, tags, and rules are stored in your own SQLite or PostgreSQL database.
- **Built for triage** — schedule videos for later, archive the ones you will not watch, and come back on your terms.
- **Organized watching** — use tags, inherited channel tags, rules, and local playlists to shape your own feed.
- **Real playback controls** — theater view, captions, quality, display settings, and optional SponsorBlock support.
- **Audio-only background playback** — switch a video or active livestream to a compact audio player that can keep playing from the lock screen on supported mobile browsers.
- **[Direct video streaming](docs/direct-streaming-research.md)** — play YouTube video and audio on demand in the built-in player, with seeking and no offline file or background download. Supports available H.264/AAC formats within your selected quality limit.
- **Downloads & local playback** — Downloads (a per-profile switch, off by default) fetch videos to disk and play them in YT Zero's own player: instant seeking, no embeds, no buffering, works offline.
- **TubeArchivist source** — connect an existing TubeArchivist archive and let its videos appear directly in the normal feed, with protected local playback, archived comments and subtitles, and watched-status synchronization.
- **Works for households** — profiles, authentication modes, child profiles with watch-time limits, and child lock make one install usable by more than one person.
- **Pulse** — understand actual viewing time by profile, channel, tag, hour, weekday, and content type without sending analytics outside your server.

## Features

- **Subscription inbox** — all new videos from followed channels in one feed.
- **Channel import** — add channels manually, import OPML, NewPipe subscription JSON, or `subscriptions.csv` from Google Takeout.
- **Live and upcoming streams** — dedicated live view with automatic status refresh, plus a per-profile option to keep live and Upcoming entries out of the main feed.
- **Watch later buckets** — schedule videos for Today, Tonight, Tomorrow, Tomorrow evening, or Weekend.
- **Archive flow** — reject videos, restore them later, and keep the main feed clean.
- **History and progress** — record watched videos and resume partially watched ones.
- **Incognito mode** — stop history, progress, and viewing-insight writes for the current browser tab.
- **Tags & rules** — tag videos and channels, inherit channel tags to videos, and automate sorting with rules.
- **User playlists** — local playlists with icons, manual additions, and rules.
- **Profiles** — multiple isolated profiles on one install, each with its own state.
- **Pulse** — an optional, default-hidden sidebar view with combined and per-profile viewing patterns, favorite channels and tags, activity hours, content mix, and time saved by SponsorBlock.
- **Authentication** — none, shared login, per-profile login, OIDC, or proxy headers, with password and passkey support. Per-profile logins derive from profile names; an administrator can generate or reset a one-time temporary password for one profile at a time, and each profile can replace it after signing in.
- **Public sharing** — optional, default-off bearer links for individual videos, personal playlists, and followed YouTube playlists, with per-link local-media access and a separate read-only `/share/*` surface. Public links bypass normal sign-in; read the [security and proxy guide](docs/public-sharing.md) before enabling or exposing them.
- **Child lock** — PIN-protect household settings while leaving each profile's own tags and playlists editable.
- **Child profiles** — daily watch-time limits, parent-approved extensions, subscribed-content-only mode, optional Shorts/live blocking, downloaded-videos-only mode, reduced settings access, and a parent activity panel with immediate stop/unlock controls.
- **Downloads (yt-dlp)** — a per-profile switch, off by default, for scheduled, manual, playlist-wide, and rule-based downloads. It plays local files in a built-in player, supports metadata and subtitle sidecars, shows live progress, and cleans up with retention rules and a storage cap.
- **TubeArchivist Integration** — an optional, default-disabled plugin that treats TubeArchivist as a headless source for the existing feed rather than adding a separate library page. Catalog items are deduplicated by YouTube ID and protected media is streamed through YT Zero without exposing the TubeArchivist token.
- **Shorts tab & player** — a followed-channels-only vertical Shorts feed with format-native cards and a full-screen swipe player.
- **SponsorBlock** — optionally skip sponsored segments, intros, outros, and more.
- **DeArrow** — optionally replace clickbait titles and thumbnails with community-created alternatives from the [DeArrow project](https://dearrow.ajay.app/). Hover or focus a video card to reveal the control that switches between the DeArrow and original versions; library metadata stays intact.
- **Comments and list continuation** — optionally load comments on demand and continue through whichever list opened the player, automatically or after confirmation.
- **Playback and display controls** — theater view, captions, quality, display customization, and optional auto-fullscreen when a phone rotates to landscape.
- **Audio mode** — switch regular videos and active livestreams to an audio-only player with Media Session controls, background playback, seeking, volume control, and per-profile browser persistence. It uses yt-dlp directly and does not require downloads to be enabled.
- **Internationalization** — complete UI catalogues for English (`en`), Polish
  (`pl`), German (`de`), French (`fr`), Spanish (`es`), Brazilian Portuguese
  (`pt-BR`), Russian (`ru`), Japanese (`ja`), and Hungarian (`hu`). Language is selected per
  profile. See the [localization guide](docs/localization.md) for native names,
  locale behavior, and contribution notes.

See the full list with screens in the **[Features](wiki/Features.md)** wiki page.

## yt-dlp: direct playback and downloads

[yt-dlp](https://github.com/yt-dlp/yt-dlp) is installed by `bun run setup` and is always used for direct playback, audio mode, subtitles and comments. On top of that, the **Downloads** feature, a per-profile switch in **Settings > Downloads** that is off by default, uses it to keep local copies of the videos you actually plan to watch — and plays them in YT Zero's own player instead of the YouTube embed:

- **Automatic downloads** — videos you schedule for later are fetched ahead of time; optionally every fresh upload from followed channels.
- **Watch your way** — when a video isn't downloaded yet, choose: play from YouTube now, or wait for a priority download and watch locally. Either can be the default.
- **A real player** — instant seeking, chapter and SponsorBlock markers on the seek bar, keyboard shortcuts, picture-in-picture, Media Session — with the same progress tracking as the embedded player.
- **Smart retention** — keep files for N days or retain them in a profile until manually deleted; optionally drop watched files, protect liked and pinned videos, and cap total shared disk usage. The storage cap can still evict unprotected downloads retained by a profile.
- **Household-aware** — one download serves every profile, and child profiles can be limited to downloaded videos only.

`bun run setup` downloads yt-dlp, ffmpeg and Deno into `./bin` (Linux). Deno is
the JavaScript runtime yt-dlp uses to solve YouTube's extraction challenges. YT Zero checks
available Deno executables in PATH order and passes a supported executable
directly to yt-dlp, so an older installation cannot shadow a working one.
Administrators
can update yt-dlp from the UI and choose stable or nightly releases plus an
automatic-update interval. Details and the full settings reference:
**[YT-DLP Integration](wiki/YT-DLP-Integration.md)**.

## Audio mode

Use the audio/video control on the watch page to replace the video player with
a compact audio-only player. On supported mobile browsers, including iOS
Safari, playback can continue while YT Zero is in the background or the screen
is locked. Media Session integration provides system play/pause and seeking
controls where the browser supports them.

Audio mode supports regular public videos and active public livestreams. It
uses yt-dlp on the YT Zero server, but the Downloads switch
does not need to be on and no media file is kept on disk. The choice is
remembered in that browser for the active profile, so continuous playback can
remain in audio mode across videos. Upcoming, private, members-only, unavailable,
child-profile, and Watch Together playback is excluded.

Implementation details, browser behavior, privacy, limitations, and
troubleshooting are covered in **[Audio mode](docs/audio-mode.md)**.

## TubeArchivist Integration

The optional **TubeArchivist Integration** plugin is disabled by default. It
connects an existing TubeArchivist instance to YT Zero as a source behind the
normal feed—there is no separate TubeArchivist page:

- archived videos enter the existing feed, search, channel pages, playlists,
  history, and recommendations;
- duplicate YouTube IDs remain one video, while the local archive becomes an
  additional playback source;
- YT Zero proxies TubeArchivist media with authenticated HTTP Range requests,
  so the browser can seek without receiving the API token;
- archived comments, thumbnails, and subtitles use the existing watch-page and
  local-player UI;
- cards identify media already available in TubeArchivist, and watched or
  unwatched changes synchronize in both directions through a durable queue.

Configure it under **Settings → Plugins → TubeArchivist** with the server URL
and API token. The YT Zero server/container must be able to reach that address;
the browser does not need direct TubeArchivist access. Full setup, data flow,
security, backup behavior, troubleshooting, and limitations:
**[TubeArchivist Integration](wiki/TubeArchivist-Integration.md)**.

## How it works

YT Zero does not scrape your account or sync with YouTube through a private API. It watches public channel feeds, fetches the metadata needed to build your local library, and serves that library back as a quieter interface. It then streams the video through your server with yt-dlp, or, with Downloads switched on, saves the video files — everything else stays the same.

That means:

- easy self-hosting
- no API quota headaches
- local ownership of your app state
- a product that stays narrow on purpose

## Quick start

Run it natively with [Bun](https://bun.sh). `bun run setup` installs the JavaScript dependencies and, on Linux (x86_64, aarch64), downloads yt-dlp, Deno and ffmpeg into `./bin` when they are not already on your `PATH` (needs `curl`, `xz` and `unzip` or `python3`). On macOS install them yourself, for example with Homebrew. If yt-dlp is missing the app still runs and uses the YouTube embed.

```bash
git clone https://github.com/Fogbench/ytzero && cd ytzero
bun run setup
bun run start   # http://localhost:3001, data in ./data
```

The app starts empty: add channels from **Settings → Channels**. The direct player is the default; to switch back to YouTube's embed, set **Default player** to **YouTube embed** in **Settings > Downloads > Configuration**. Environment variables are listed in [Configuration](wiki/Configuration.md). Keep `./data` backed up.

## Documentation

Documentation lives in the [`wiki/`](wiki/) folder of this repository (some of those pages still describe upstream's Docker and cloud installs, which this fork does not provide):

- **[Configuration](wiki/Configuration.md)** — environment variables.
- **[Features](wiki/Features.md)** — everything the app does, with screens.
- **[Settings](wiki/Settings.md)** — current navigation, sections, and administrator-only access.
- **[Importing Subscriptions](wiki/Importing-Subscriptions.md)** — OPML and Google Takeout.
- **[Profiles](wiki/Profiles.md)** — multi-account profiles.
- **[Authentication](wiki/Authentication.md)** — login methods and setup.
- **[Child Lock](wiki/Child-Lock.md)** — PIN-protecting settings.
- **[YT-DLP Integration](wiki/YT-DLP-Integration.md)** — downloads, offline playback, and retention.
- **[Audio mode](docs/audio-mode.md)** — background audio playback for regular videos and active livestreams.
- **[TubeArchivist Integration](wiki/TubeArchivist-Integration.md)** — use an existing archive in the normal feed and local player.
- **[Backup & Updates](wiki/Backup-and-Updates.md)** — keeping your data safe.
- **[How It Works](wiki/How-It-Works.md)** — what is fetched and stored.
- **[Privacy & License](wiki/Privacy-and-License.md)** — external requests, optional integrations, and licensing.
- **[Development](wiki/Development.md)** — tech stack and repository layout.

## Tech stack

| Layer | Stack |
| --- | --- |
| Backend | Bun, Hono |
| Frontend | React, Vite, TypeScript |
| Storage | SQLite by default, PostgreSQL optional |
| Media | [yt-dlp](https://github.com/yt-dlp/yt-dlp) + Deno + ffmpeg (installed by `bun run setup`) |
| Archive integration | TubeArchivist API and protected media proxy (optional plugin) |
| Runtime | Bun |

## Privacy & license

YT Zero does not require a Google account or a YouTube Data API key, and stores app data in your own SQLite or PostgreSQL database. It still connects to YouTube to fetch RSS feeds, metadata, thumbnails, pages, and embedded videos. It also uses yt-dlp to stream videos from YouTube through your server for the direct player; with Downloads switched on it saves video files locally, removed by the retention rules.

With the optional TubeArchivist plugin enabled, the YT Zero server connects to
the administrator-configured TubeArchivist origin to synchronize metadata,
load archive comments, proxy thumbnails/subtitles/media, and optionally send
watched completion. The API token remains server-side and is excluded from
portable backups.

The optional [DeArrow](https://dearrow.ajay.app/) integration fetches community-created replacement titles and thumbnails from DeArrow/SponsorBlock services. It is disabled by default, never overwrites metadata stored in the local library, and can be enabled separately for titles and thumbnails. Replacement-title lookups send the first four characters of the video's SHA-256 hash; thumbnail requests include the YouTube video ID. Branding lookup results are cached in memory for 15 minutes, and failures fall back to the original title and thumbnail. DeArrow/SponsorBlock data is provided under CC BY-NC-SA 4.0.

YouTube is a trademark of Google LLC. This project is not affiliated with, endorsed by, or associated with YouTube or Google LLC.

Licensed under the **GNU Affero General Public License v3.0 only** (`AGPL-3.0-only`). See [LICENSE](LICENSE). More in **[Privacy & License](wiki/Privacy-and-License.md)**.

## Thanks

YT Zero is better because of the people who contribute translations, testing,
research, ideas, and code. Special thanks to:

| Contributor | Contributions |
| --- | --- |
| <a href="https://github.com/Green-Kite"><img src="https://github.com/Green-Kite.png?size=40" height="20" alt="@Green-Kite avatar"> <strong>@Green-Kite</strong></a> | German language support and wiki updates. |
| <a href="https://github.com/Zan1456"><img src="https://github.com/Zan1456.png?size=40" height="20" alt="@Zan1456 avatar"> <strong>@Zan1456</strong></a> | Hungarian language support. |
| <a href="https://github.com/cerede2000"><img src="https://github.com/cerede2000.png?size=40" height="20" alt="@cerede2000 avatar"> <strong>@cerede2000</strong></a> | French translation and major contributions to audio mode through implementation, research, detailed issue reports, and continued testing. |
| <a href="https://github.com/baldemar-wuda"><img src="https://github.com/baldemar-wuda.png?size=40" height="20" alt="@baldemar-wuda avatar"> <strong>@baldemar-wuda</strong></a> | Extensive testing, thoughtful suggestions, and bug reports. |
| <a href="https://github.com/Taruvi"><img src="https://github.com/Taruvi.png?size=40" height="20" alt="@Taruvi avatar"> <strong>@Taruvi</strong></a> | Issue support, hands-on testing, and feature ideas. |

## Development note

AI-assisted coding tools have been used selectively to support development tasks such as code exploration, prototyping, and review. Project direction, architectural decisions, validation, and responsibility for the final code remain with the maintainers.

<div align="center">
  <img src="docs/assets/ai-generated.svg" width="160" alt="AI-generated content">
</div>
