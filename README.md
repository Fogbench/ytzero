<div align="center">
  <img src="docs/assets/ytzero-logo.svg" width="112" height="112" alt="YT Zero logo">
  <h1>YT Zero</h1>
  <p><strong>A self-hosted YouTube inbox for people who want subscriptions, not recommendations.</strong></p>
  <p>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="AGPL-3.0-only"></a>
  </p>
</div>

This is a personal fork of [Pelski/ytzero](https://github.com/Pelski/ytzero) (upstream). No support or releases are promised for now; that may change. For everything this README does not cover (features, settings, authentication, TubeArchivist, public sharing, child profiles and more), see upstream and its [wiki](https://github.com/Pelski/ytzero/wiki) (upstream). All credit for YT Zero itself goes to Pelski and the contributors listed under [Thanks](#thanks).

## What this fork adds

![YT Zero video player with the quality menu open](docs/assets/player-quality.png)

<p align="center">
  <img src="docs/assets/player-subtitle-style.png" alt="YT Zero player with the subtitle style menu open" width="720">
</p>

### Direct player

The direct player is the default. It streams the video from YouTube through your own server with yt-dlp, saves nothing to disk, and plays it in YT Zero's own controls. The YouTube embed stays available (**Settings > Downloads > Configuration > Default player**) and is used when yt-dlp is not installed.

The gear menu holds:

- **Autoplay**, which continues through lists and falls back to "More like this" when there is no queue.
- **SponsorBlock** switch. A segment you deliberately seek into is not skipped.
- **Stable volume** and **Voice boost**, done with your browser's audio engine (nothing is re-encoded).
- **Audio track**, to switch the language of dubbed videos without losing your position.
- **Sleep timer** from 5 to 60 minutes, or at the end of the video.
- **Playback speed** slider from 0.25x to 2x in 0.05 steps.
- **Subtitles**, with language and style (size, colour, background, live sample). The CC button only switches captions on and off.
- **Quality** up to 4K. Pick a height or Auto, and choose AV1 or H.264. The list only offers what your browser can decode.

If direct playback fails, the player never falls back to the embed silently. You get an explanation, a YouTube link and a button to use the embed.

### Settings

- Hide "Continue watching" (Settings > Experience > Navigation).
- Hide the player's Download, Screenshot and Picture-in-picture buttons (Settings > Experience > Playback).
- Auto-generated captions mode (Settings > Experience > Subtitles): show them, use them only when the uploader made none, or hide them.

All of these are shown by default and can be switched off per profile. Every new string is translated into the nine UI languages.

## Quick start

Run it natively with [Bun](https://bun.sh). On Linux (x86_64, aarch64), `bun run setup` installs the dependencies and downloads yt-dlp, Deno and ffmpeg into `./bin` when they are not already on your `PATH` (needs `curl`, `xz` and `unzip` or `python3`). On macOS, install them yourself, for example with Homebrew. Without yt-dlp the app still runs and uses the YouTube embed.

```bash
git clone https://github.com/Fogbench/ytzero && cd ytzero
bun run setup
bun run start   # http://localhost:3001, data in ./data
```

The app starts empty; add channels from **Settings > Channels**. Keep `./data` backed up. Environment variables are listed in [Configuration](https://github.com/Pelski/ytzero/wiki/Configuration) (upstream).

## Known limits

- The direct player depends on yt-dlp keeping up with YouTube.
- Two tabs playing the same video at different qualities replace each other's stream.
- Stable volume and Voice boost only work in the direct player.
- Tested mostly in Firefox and Chrome.
- Upstream's tvOS app and browser extension are not part of this fork.

## Documentation

General documentation is in the [upstream wiki](https://github.com/Pelski/ytzero/wiki) (upstream). Where it differs from this README (Docker and cloud installs, yt-dlp being optional), this README is correct for the fork.

In this repository: [Audio mode](docs/audio-mode.md), [Direct streaming research](docs/direct-streaming-research.md), [Public sharing](docs/public-sharing.md), [Backup and restore architecture](docs/backup-restore-architecture.md) and [Localization](docs/localization.md).

## License

Licensed under the **GNU Affero General Public License v3.0 only** (`AGPL-3.0-only`). See [LICENSE](LICENSE).

YouTube is a trademark of Google LLC. This project is not affiliated with, endorsed by, or associated with YouTube or Google LLC.

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

AI-assisted coding tools have been used moderately. Project direction, architectural decisions, validation, and responsibility for the final code remain with the author of this fork.

<div align="center">
  <img src="docs/assets/ai-generated.svg" width="160" alt="AI-generated content">
</div>
