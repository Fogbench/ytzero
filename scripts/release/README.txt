YT ZERO (release tarball)
=========================

A self-hosted YouTube inbox. This is a personal fork of Pelski's YT Zero
(upstream): no support is promised for now, and that may change.

  This fork:      https://github.com/Fogbench/ytzero
  Upstream:       https://github.com/Pelski/ytzero
  Upstream wiki:  https://github.com/Pelski/ytzero/wiki

Features, settings and authentication are documented in the upstream wiki. All
credit for YT Zero goes to Pelski and the contributors. Licence:
AGPL-3.0-only, see the file LICENSE. The full source code is in the fork's
repository above (every release also has a source archive).

This archive is a ready-built copy. Nothing needs compiling.

PORTABLE: install-linux.sh, start.sh, update.sh and uninstall.sh make no
changes to your PC outside this folder. Nothing is written to your home
directory (no ~/.bashrc edit, no ~/.cache, no ~/.bun), to /usr, /etc or /opt,
and no system service or scheduled job is created. Bun, yt-dlp, Deno, ffmpeg
and every cache live inside the folder. macOS (manual steps) is not covered by
this.


WHAT YOU NEED
-------------

Linux (x86_64 or aarch64): nothing installed beforehand except curl, and
unzip or python3. install-linux.sh installs everything else, including Bun.

macOS: you install Bun and the tools yourself, see the MACOS section. Only
Linux has been tested.

Without yt-dlp the app still runs and uses the YouTube embed player.


CHECK THE DOWNLOAD
------------------

The release has a .sha256 file next to the archive. Put both in one folder and
run:

    sha256sum -c ytzero-<version>.tar.gz.sha256

It should print "... OK". On macOS use "shasum -a 256 -c" instead of
"sha256sum -c". The check only proves the file arrived intact and matches
what was published.


QUICK START (LINUX)
-------------------

    tar -xzf ytzero-<version>.tar.gz
    cd ytzero-<version>
    bash install-linux.sh      (once)
    bash start.sh              (then open http://localhost:3001)

Start with no channels and add them under Settings > Channels. Your data is
saved in ./data. Keep it backed up.


MACOS
-----

There is no installer for macOS. Do these steps once instead:

 1. Install Bun (https://bun.sh) and the tools, for example with Homebrew:
        brew install yt-dlp deno ffmpeg
    (Deno 2.3 or newer; yt-dlp is optional.)
 2. In the unpacked folder:
        cd app && bun install --production --frozen-lockfile && cd ..
 3. Start it:
        bash start.sh

update.sh and uninstall.sh also work on macOS, but this is untested.


THE SCRIPTS
-----------

install-linux.sh  (Linux only, run once)

  This is the installer. Everything happens inside this folder. It needs no
  root and does not edit your shell profile. It first prints what it is about
  to do and asks for confirmation ("--yes" skips the question), then:

  1. Installs Bun if you don't already have it. Bun is the program that runs
     the server. If bun is already on your system it is used as it is and
     not changed. If not, the matching Bun release is downloaded for your
     CPU into ./bin/bun and checked against the checksum Bun publishes.
     (CPUs without AVX2 get Bun's "baseline" build automatically.)

  2. Downloads the server's libraries by running Bun's command
     "bun install --production --frozen-lockfile" in app/. Note: here
     "bun install" is Bun's command for fetching a project's libraries. It
     does not install Bun itself. The libraries land in app/node_modules, at
     exactly the versions listed in app/bun.lock. They are not inside the
     archive because some contain files that differ per CPU. Bun's download
     cache is kept in ./.bun-cache.

  3. Runs scripts/install-deps.sh (next).


scripts/install-deps.sh  (called by install-linux.sh)

  Downloads the helper tools into ./bin, but only those not already available
  on your system:

    yt-dlp              Reads YouTube for the direct player.
                        Source: the latest yt-dlp release on GitHub.
    deno                Lets yt-dlp solve YouTube's JavaScript checks.
                        Source: the latest Deno release on GitHub.
    ffmpeg and ffprobe  Audio and video handling.
                        Source: a static build from johnvansickle.com.

  - If yt-dlp, deno or ffmpeg is already on your PATH, it says "found" and
    downloads nothing. Your own copy is never touched.
  - It runs on Linux x86_64 and aarch64 only. On macOS or another CPU it
    tells you to install the three tools yourself (for example with
    Homebrew).
  - These three downloads are not checksum-verified, and the versions are
    "latest", not pinned.


start.sh  (run every time)

  Starts the server on http://localhost:3001. It puts ./bin first on the PATH
  (so the downloaded tools are found), reads the version from the file
  VERSION, and runs "bun src/index.ts" inside app/ with the built web client
  from ui/dist. It stays in the foreground; press Ctrl+C to stop it. Run it
  under tmux, screen or a systemd service if you want it to keep running.
  Setting that up is not covered here.

  To change the port:

      PORT=8080 bash start.sh

  Other settings are environment variables, listed on the upstream
  Configuration page:
  https://github.com/Pelski/ytzero/wiki/Configuration


update.sh  (update to the latest release)

  Asks GitHub for the latest release of Fogbench/ytzero and compares it with
  the file VERSION in this folder.

  - Same version: prints "Already on version 2.0.0 (latest)" (with the
    version you have) and changes nothing.
  - Newer version: shows both versions and asks to continue ("--yes" skips
    the question). It then downloads the tarball and its .sha256 file,
    refuses to go on if the checksum file is missing or does not match, and
    copies your database (data/db) to
    ./backups/pre-update-<old version>-<time>/ before changing anything.
  - It replaces only the program files (app/src, ui/dist, shared, scripts,
    the four scripts, README.txt, LICENSE, VERSION) and then updates the
    libraries with Bun. ./data, ./bin and ./backups are never overwritten.
  - "bash update.sh --check" only tells you whether an update exists.
  - It refuses to run while the server is running from this folder.
  - It needs internet access and a published (not draft) release. It does
    not update yt-dlp, Deno or ffmpeg. The app keeps yt-dlp current by
    itself (it updates the copy in ./bin on a schedule). To refresh Deno or
    ffmpeg, delete them from ./bin and run bash install-linux.sh again.


uninstall.sh  (undo install-linux.sh)

  Removes what install-linux.sh added, inside this folder only:

  - app/node_modules, .bun-cache and .cache
  - Bun and the tools in ./bin that the installer downloaded
    (bun, yt-dlp, deno, ffmpeg, ffprobe)

  It keeps ./data and ./backups unless you ask otherwise, and never touches
  anything outside this folder. A Bun, yt-dlp, deno or ffmpeg that was
  already on your system stays exactly as it was.

      bash uninstall.sh --dry-run      list what would go, remove nothing
      bash uninstall.sh                ask first, keep ./data
      bash uninstall.sh --remove-data  also delete ./data (cannot be undone)
      bash uninstall.sh --yes          no confirmation question

  It refuses to run while the server is running from this folder. At the end
  it prints the "rm -rf" command for the folder itself; run it only if you
  also want to delete the program (and ./data, if you kept it).


WHAT IS IN THE FOLDER
---------------------

  app/                  The server (src/) and its dependency list
  ui/dist/              The built web client
  shared/               Code used by both the server and the web client
  bin/                  Created by install-linux.sh: Bun and downloaded tools
  data/                 Created at first start: database, avatars, downloads
  VERSION               The release name shown by the app
  install-linux.sh      Installer (Linux)
  start.sh              Starts the server
  update.sh             Updates to the latest release
  uninstall.sh          Removes what the installer added
  .bun-cache/           Bun's download cache, created by the installer
  .cache/               yt-dlp, Deno and Bun caches, created by start.sh
  backups/              Database copies made by update.sh
