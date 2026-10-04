# YT Zero (release tarball)

A self-hosted YouTube inbox. This is a personal fork of [Pelski/ytzero](https://github.com/Pelski/ytzero) (upstream): no support is promised for now, and that may change. The fork's own README, with what it adds and known limits, is at <https://github.com/Fogbench/ytzero>. Everything else (features, settings, authentication) is documented in the [upstream wiki](https://github.com/Pelski/ytzero/wiki). All credit for YT Zero goes to Pelski and the contributors. Licence: AGPL-3.0-only, see `LICENSE`.

This archive is a ready-built copy. Nothing needs compiling, and nothing is installed outside this folder.

## What you need

- Linux (x86_64 or aarch64) or macOS. Only Linux has been tested.
- [Bun](https://bun.sh) (install it yourself first; these scripts never install it).
- On Linux, for the automatic tool download: `curl`, `xz`, and `unzip` or `python3`.
- Without yt-dlp the app still runs and uses the YouTube embed player.

## Check the download

The release has a `.sha256` file next to the archive. Put both in one folder and run:

```bash
sha256sum -c ytzero-<version>.tar.gz.sha256     # should print: ... OK
```

On macOS use `shasum -a 256 -c` instead. The check only proves the file arrived intact and matches what was published.

## Quick start

```bash
tar -xzf ytzero-<version>.tar.gz
cd ytzero-<version>
bash install.sh      # once
bash start.sh        # http://localhost:3001
```

Start with no channels and add them under **Settings > Channels**. Your data is saved in `./data`; keep it backed up.

## The scripts

### `install.sh` (run once)

1. Checks that Bun is installed and stops with a message if not.
2. Runs `bun install --production --frozen-lockfile` in `app/`. This downloads the server's libraries into `app/node_modules`, using exactly the versions in `app/bun.lock`. Libraries are not shipped in the archive because some contain files that differ per CPU.
3. Runs `scripts/install-deps.sh` (below).

Bun also keeps a download cache in `~/.bun`. That is Bun's own, shared with your other Bun projects.

### `scripts/install-deps.sh` (called by install.sh)

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

### `uninstall.sh` (undo `install.sh`)

Removes what `install.sh` added, inside this folder only:

- `app/node_modules`
- the tools in `./bin` that were downloaded (`yt-dlp`, `deno`, `ffmpeg`, `ffprobe`)

It keeps `./data` unless you ask otherwise, and never touches anything outside this folder. A yt-dlp, deno or ffmpeg that was already on your system stays exactly as it was. Bun and `~/.bun` are also left alone.

```bash
bash uninstall.sh --dry-run      # list what would be removed, remove nothing
bash uninstall.sh                # ask first, keep ./data
bash uninstall.sh --remove-data  # also delete ./data (cannot be undone)
bash uninstall.sh --yes          # no confirmation question
```

It refuses to run while the server is running from this folder. At the end it prints the `rm -rf` command for the folder itself; run it only if you also want to delete the program (and `./data`, if you kept it).

## Updating

There is no updater. To move to a newer release: stop the server, unpack the new archive into a new folder, move your `data` folder into it, then run `bash install.sh` and `bash start.sh` there. Back up `./data` first.

## What is in the folder

| Path | What it is |
| --- | --- |
| `app/` | The server (`src/`) and its dependency list |
| `ui/dist/` | The built web client |
| `shared/` | Code used by both the server and the web client |
| `bin/` | Created by `install.sh`: downloaded tools |
| `data/` | Created at first start: your database, avatars and downloads |
| `VERSION` | The release name shown by the app |
| `install.sh`, `start.sh`, `uninstall.sh` | Described above |
