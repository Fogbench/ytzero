// Fake brand-new Docker volume: a bootstrap yt-dlp plus the provision marker.
// YTDLP_TEST_MODE picks how the fake self-update behaves: slow (1 s), hang, fail.
import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.env.YTDLP_TEST_ROOT!;
const mode = process.env.YTDLP_TEST_MODE!;
const q = (path: string) => `'${path.replaceAll("'", "'\"'\"'")}'`;
const updated = join(root, "updated");
const updateRuns = join(root, "update-runs");
writeFileSync(process.env.YTDLP_PATH!, `#!/bin/sh
if [ "$1" = "--version" ]; then
  if [ -f ${q(updated)} ]; then echo "2026.10.21"; else echo "2026.08.19"; fi
  exit 0
fi
if [ "$1" = "--update-to" ]; then
  echo run >> ${q(updateRuns)}
  case "${mode}" in
    slow) sleep 1; touch ${q(updated)}; echo "Updated"; exit 0 ;;
    hang) sleep 2; exit 0 ;;
    fail) echo "network unavailable" >&2; exit 1 ;;
  esac
fi
exit 2
`);
chmodSync(process.env.YTDLP_PATH!, 0o755);
if (mode !== "none") writeFileSync(process.env.YTDLP_PROVISION_MARKER!, "");

const { waitForFirstYtdlpUpdate } = await import("../src/ytdlpUpdater");
const { ytdlpStatus } = await import("../src/downloadConfig");
const runs = async () => (await Bun.file(updateRuns).exists() ? (await Bun.file(updateRuns).text()).trim().split("\n").length : 0);

let started = performance.now();
await Promise.all([waitForFirstYtdlpUpdate(400), waitForFirstYtdlpUpdate(400)].slice(0, mode === "hang" ? 2 : 1));
if (mode !== "hang") await Promise.all([waitForFirstYtdlpUpdate(5_000), waitForFirstYtdlpUpdate(5_000)]);
const firstWaitMs = performance.now() - started;
const versionAfterWait = await ytdlpStatus();
started = performance.now();
await waitForFirstYtdlpUpdate(mode === "hang" ? 400 : 5_000);
const secondWaitMs = performance.now() - started;
console.log("RESULT " + JSON.stringify({ firstWaitMs, versionAfterWait, secondWaitMs, updateRuns: await runs() }));
process.exit(0);
