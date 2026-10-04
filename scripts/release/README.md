# YT Zero (release tarball)

A self-hosted YouTube inbox. This is a personal fork of [Pelski/ytzero](https://github.com/Pelski/ytzero) (upstream): no support is promised for now, and that may change. The fork's own README, with what it adds and known limits, is at <https://github.com/Fogbench/ytzero>. Everything else (features, settings, authentication) is documented in the [upstream wiki](https://github.com/Pelski/ytzero/wiki). All credit for YT Zero goes to Pelski and the contributors. Licence: AGPL-3.0-only, see `LICENSE`. The full source code is at <https://github.com/Fogbench/ytzero> (every release also has a source archive).

This archive is a ready-built copy. Nothing needs compiling, and nothing is installed outside this folder.

## What you need

- **Linux** (x86_64 or aarch64): nothing installed beforehand except `curl`, and `unzip` or `python3`. `install-linux.sh` installs everything else, including Bun.
- **macOS**: you install Bun and the tools yourself, see [macOS](#macos). Only Linux has been tested.
- Without yt-dlp the app still runs and uses the YouTube embed player.

## Check the download

The release has a `.sha256` file next to the archive. Put both in one folder and run:

```bash
sha256sum -c ytzero-<version>.tar.gz.sha256     # should print: ... OK
```

On macOS use `shasum -a 256 -c` instead. The check only proves the file arrived intact and matches what was published.

## Quick start (Linux)

```bash
tar -xzf ytzero-<version>.tar.gz
cd ytzero-<version>
bash install-linux.sh    # once
bash start.sh            # http://localhost:3001
```

Start with no channels and add them under **Settings > Channels**. Your data is saved in `./data`; keep it backed up.

## macOS

There is no installer for macOS. Do these steps once instead:

1. Install [Bun](https://bun.sh), and the tools, for example with Homebrew: `brew install yt-dlp deno ffmpeg` (Deno 2.3 or newer; yt-dlp is optional).
2. In the unpacked folder: `cd app && bun install --production --frozen-lockfile && cd ..`
3. `bash start.sh`

`update.sh` and `uninstall.sh` also work on macOS, but this is untested.

## The scripts

### `install-linux.sh` (Linux only, run once)

This is the installer. Everything happens inside this folder. It needs no root and does not edit your shell profile. It first prints what it is about to do and asks for confirmation (`--yes` skips the question), then:

1. **Installs Bun if you don't already have it.** Bun is the program that runs the server. If `bun` is already on your system it is used as it is and not changed. If not, the matching Bun release is downloaded for your CPU into `./bin/bun`, and checked against the checksum Bun publishes. (CPUs without AVX2 get Bun's "baseline" build automatically.)
2. **Downloads the server's libraries** by running Bun's `bun install --production --frozen-lockfile` in `app/`. Note: here `bun install` is Bun's command for fetching a project's libraries. It does not install Bun itself. The libraries land in `app/node_modules`, at exactly the versions in `app/bun.lock`. They are not inside the archive because some contain files that differ per CPU. Bun's download cache is kept in `./.bun-cache`.
3. **Runs `scripts/install-deps.sh`** (below).

### `scripts/install-deps.sh` (called by install-linux.sh)

Downloads the helper tools into `./bin`, but only those not already available on your system:

| Tool | Used for | Downloaded from |
| --- | --- | --- |
| yt-dlp | Reads YouTube for the direct player | the latest yt-dlp release on GitHub |
| deno | Lets yt-dlp solve YouTube's JavaScript checks | the latest Deno release on GitHub |
| ffmpeg and ffprobe | Audio and video handling | a static build from johnvansickle.com |

- If `yt-dlp`, `deno` or `ffmpeg` is already on your `PATH`, it says "found" and downloads nothing. Your own copy is never touched.
- It runs on Linux x86_64 and aarch64 only. On macOS or another CPU it tells you to install the three tools yourself (for example with Homebrew).
- The downloads are not checksum-verified and the versions are "latest", not pinned.

### `start.sh` (run every time)

Starts the server on `http://localhost:3001`. It puts `./bin` first on the `PATH` (so the downloaded tools are found), reads the version from `VERSION`, and runs `bun src/index.ts` inside `app/` with the built web client from `ui/dist`. It stays in the foreground; press Ctrl+C to stop it. Run it under `tmux`, `screen` or a systemd service if you want it to keep running. Setting that up is not covered here.

To change the port: `PORT=8080 bash start.sh`. Other settings are environment variables, listed on the [upstream Configuration page](https://github.com/Pelski/ytzero/wiki/Configuration).

### `uninstall.sh` (undo `install-linux.sh`)

Removes what `install-linux.sh` added, inside this folder only:

- `app/node_modules` and `.bun-cache`
- Bun and the tools in `./bin` that the installer downloaded (`bun`, `yt-dlp`, `deno`, `ffmpeg`, `ffprobe`)

It keeps `./data` and `./backups` unless you ask otherwise, and never touches anything outside this folder. A Bun, yt-dlp, deno or ffmpeg that was already on your system stays exactly as it was.

```bash
bash uninstall.sh --dry-run      # list what would be removed, remove nothing
bash uninstall.sh                # ask first, keep ./data
bash uninstall.sh --remove-data  # also delete ./data (cannot be undone)
bash uninstall.sh --yes          # no confirmation question
```

It refuses to run while the server is running from this folder. At the end it prints the `rm -rf` command for the folder itself; run it only if you also want to delete the program (and `./data`, if you kept it).

### `update.sh` (update to the latest release)

Asks GitHub for the latest release of `Fogbench/ytzero` and compares it with the `VERSION` file in this folder.

- **Same version:** prints `Already on version 2.0.0 (latest)` and changes nothing.
- **Newer version:** shows both versions and asks to continue (`--yes` skips the question). It then downloads the tarball and its `.sha256` file, refuses to go on if the checksum file is missing or does not match, and copies your database (`data/db`) to `./backups/pre-update-<old version>-<time>/`.
- It replaces only the program files (`app/src`, `ui/dist`, `shared`, `scripts`, the three scripts, `README.md`, `LICENSE`, `VERSION`) and then updates the libraries with Bun. `./data`, `./bin` and `./backups` are never overwritten.
- `bash update.sh --check` only tells you whether an update exists.
- It refuses to run while the server is running from this folder.
- It needs internet access and a published (not draft) release. It does not update yt-dlp, Deno or ffmpeg.

## What is in the folder

| Path | What it is |
| --- | --- |
| `app/` | The server (`src/`) and its dependency list |
| `ui/dist/` | The built web client |
| `shared/` | Code used by both the server and the web client |
| `bin/` | Created by `install-linux.sh`: Bun and the downloaded tools |
| `data/` | Created at first start: your database, avatars and downloads |
| `VERSION` | The release name shown by the app |
| `install-linux.sh`, `start.sh`, `update.sh`, `uninstall.sh` | Described above |
| `.bun-cache/` | Bun's download cache, created by the installer |
| `backups/` | Database copies made by `update.sh` |
