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

PORTABLE: install-linux.sh, start.sh, update.sh and uninstall.sh makes no
changes to your PC outside this folder. Nothing is written to your home
directory (no ~/.bashrc edit, no ~/.cache, no ~/.bun), to /usr, /etc or /opt,
and no system service or scheduled job is created. Bun, yt-dlp, Deno, ffmpeg
and every cache live inside the folder. macOS (manual steps) is not covered by
this.


WHAT YOU NEED
-------------

Linux (x86_64 or aarch64): nothing installed beforehand except curl, xz, and
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
    bash install-linux.sh      (once; it asks which port to use, default 3001)
    bash start.sh              (prints the address to open, for example
                               http://localhost:3001)

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

  1. Installs the tools from the pinned list tools.lock (see below) into
     ./bin: Bun (runs the server), Deno (lets yt-dlp solve YouTube's
     JavaScript checks), yt-dlp (reads YouTube for the direct player), and
     ffmpeg with ffprobe (audio and video handling). Every download is
     checked against the sha256 checksum in tools.lock before it is used,
     and must run on your machine, otherwise nothing is installed for it.
     The pinned tools are always installed into ./bin. A copy of any of
     them on your PATH is ignored (and never touched), so the same release
     always runs the same tool versions. If ./bin already holds a tool at
     the pinned version, it is not downloaded again. (CPUs without AVX2 get
     Bun's "baseline" build automatically.) It runs on Linux x86_64 and
     aarch64 only; on another CPU it tells you to install the tools
     yourself.
     Needs unzip or python3 (for Bun and Deno) and xz (for ffmpeg).

  2. Asks which port the server should use and shows the default, 3001 (or
     the port you chose last time). Press Enter to keep it. The choice is
     saved in ./port, which start.sh reads. With "--yes" the question is
     skipped and the default is used (or PORT=... from the environment). If
     something is already listening on that port, it tells you.

  3. Downloads the server's libraries by running Bun's command
     "bun install --production --frozen-lockfile" in app/. Note: here
     "bun install" is Bun's command for fetching a project's libraries. It
     does not install Bun itself. The libraries land in app/node_modules, at
     exactly the versions listed in app/bun.lock. They are not inside the
     archive because some contain files that differ per CPU. Bun's download
     cache is kept in ./.bun-cache.

  It also writes ./bin/.installed, a short list of which pinned versions it
  installed, so update.sh can tell what has to change.


tools.lock  (the pinned tool list, one per release)

  A plain text list in this folder: for each tool, its exact version, and for
  each CPU the download address and sha256 checksum. Nothing in it is
  "latest". A given release always installs exactly these versions, whether
  you install it fresh or reach it with update.sh, so two people on the same
  release have the same tools. The tools are:

    bun      1.4.2        deno     2.9.7
    yt-dlp   2026.08.19   ffmpeg   7.0.2 (static build, johnvansickle.com)

  One exception: yt-dlp. YouTube changes often, and the app can update yt-dlp
  by itself on a schedule (set under Settings; it replaces the copy in ./bin).
  So yt-dlp may be newer than the pinned version. update.sh does not
  downgrade it: it only replaces yt-dlp when a new release pins a different
  yt-dlp version.


start.sh  (run every time)

  Starts the server. First it prints a box with the address to open, for
  example http://localhost:3001, and then the server log follows. The port is
  the one you chose in install-linux.sh (saved in the file ./port; 3001 if
  you accepted the default). It puts ./bin first on the PATH
  (so the downloaded tools are found), reads the version from the file
  VERSION, and runs "bun src/index.ts" inside app/ with the built web client
  from ui/dist. Temporary files go to ./.cache/tmp, inside this folder. It
  stays in the foreground; press Ctrl+C to stop it. Run it
  under tmux, screen or a systemd service if you want it to keep running.
  Setting that up is not covered here.

  To change the port for good, run bash install-linux.sh again or edit the
  number in ./port. For a single run:

      PORT=8080 bash start.sh

  If the port file holds anything but a number from 1 to 65535, start.sh
  says so and uses 3001.

  Other settings are environment variables, listed on the upstream
  Configuration page:
  https://github.com/Pelski/ytzero/wiki/Configuration

  Your own settings: ytzero.env. If a file named ytzero.env exists in this
  folder, start.sh reads it before it starts the server, and every setting
  in it becomes an environment variable of the server. It can also set PORT,
  and then it wins over the file ./port and over PORT=... on the command
  line. You create it yourself with a text editor; the release does not
  contain one. It is read like a shell script: one NAME=value per line, with
  quotes around a value that contains spaces. For example:

      PORT=8080

  update.sh never changes or deletes ytzero.env, and neither does
  uninstall.sh, so your settings survive updates. Do not put them in
  app/.env: an update replaces the whole app folder.


update.sh  (update to the latest release)

  Asks GitHub for the latest release of Fogbench/ytzero and compares it with
  the file VERSION in this folder.

  - Same version: prints "Already on version 2.0.0 (latest)" (with the
    version you have) and changes nothing.
  - Different version: if the latest release is newer than yours, it shows
    both versions and asks to continue ("--yes" skips the question). If it
    is OLDER than yours (a downgrade), update.sh refuses, because a newer
    version may have changed your database in a way the older one cannot
    read; "bash update.sh --allow-downgrade" overrides that.
  - After you confirm, it downloads the tarball and its .sha256 file,
    refuses to go on if the checksum file is missing or does not match, and
    copies your database (data/db) to
    ./backups/pre-update-<old version>-<time>/ before changing anything.
  - It makes this folder match the new release: every program folder (app,
    ui/dist, shared, scripts) and every other file at the top of the release
    (the scripts, tools.lock, README.txt, LICENSE, VERSION) is replaced.
    ./data, ./backups, ./bin, ./.cache and ./.bun-cache are kept. The
    server's libraries are deleted and installed again from bun.lock, so
    the result equals a fresh install of that release.
  - It changes only what the release specifies. For each tool it compares the
    version pinned in the new tools.lock with the version recorded in
    ./bin/.installed. Only a tool whose pinned version differs is replaced:
    the new one is downloaded and checked against its sha256 first, and the
    old one is kept until the new one works (and put back if anything
    fails). Tools with the same pinned version are not touched, and a tool
    found elsewhere on your PATH is left alone. Nothing is ever fetched as
    "latest".
  - "bash update.sh --check" only tells you whether an update exists.
  - It refuses to run while the server is running from this folder.
  - Only one update can run at a time. While it runs, it keeps a folder
    named .update.lock here. If an update was stopped and update.sh still
    complains about the lock, delete the folder .update.lock; this is safe
    as long as no update is running.
  - If an update stops partway (for example the library install fails
    because there is no internet), your data is untouched and the folder
    still counts as the old version. Run "bash update.sh" again to finish.
  - It keeps the newest 5 database copies in ./backups and removes older
    ones that it made itself (the folders named pre-update-...).
  - It needs internet access and a published (not draft) release.


uninstall.sh  (undo install-linux.sh)

  Removes what install-linux.sh added, inside this folder only:

  - app/node_modules, .bun-cache, .cache and .tmp
  - Bun and the tools in ./bin that the installer downloaded
    (bun, yt-dlp, deno, ffmpeg, ffprobe), the list ./bin/.installed and ./port

  It keeps ./data unless you use --remove-data. It always keeps ./backups:
  there is no option to remove them, so delete that folder by hand if you
  want it gone. It never touches anything outside this folder. A Bun,
  yt-dlp, deno or ffmpeg that was already on your system stays exactly as it
  was.

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
  bin/                  Created by install-linux.sh: the downloaded tools and
                        .installed, the list of pinned versions installed
  tools.lock            The pinned tool versions and checksums of this release
  scripts/              tools-lib.sh, used by install-linux.sh and update.sh
  data/                 Created at first start: database, avatars, downloads
  VERSION               The release name shown by the app
  port                  The port you chose in install-linux.sh
  install-linux.sh      Installer (Linux)
  start.sh              Starts the server
  update.sh             Updates to the latest release (same result as a fresh
                        install of it)
  uninstall.sh          Removes what the installer added
  .bun-cache/           Bun's download cache, created by the installer
  .cache/               yt-dlp, Deno and Bun caches and temporary files, made
                        when start.sh runs (not before)
  .tmp/                 Temporary downloads of install-linux.sh and update.sh,
                        removed when they finish
  backups/              Database copies made by update.sh (the newest 5)
  ytzero.env            Your own settings, if you made the file (see start.sh)
