import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const roots: string[] = [];

async function run(mode: "slow" | "hang" | "fail" | "none") {
  const root = mkdtempSync(resolve(tmpdir(), "ytzero-ytdlp-first-update-test-"));
  roots.push(root);
  const child = Bun.spawn([process.execPath, "app/tests/ytdlpFirstUpdateHarness.ts"], {
    cwd: resolve(import.meta.dir, "../.."),
    env: {
      ...Bun.env,
      DB_PATH: join(root, "db", "source.db"),
      DOWNLOADS_DIR: join(root, "downloads"),
      YTDLP_PATH: join(root, "yt-dlp"),
      YTDLP_MANAGED_PATH: join(root, "yt-dlp"),
      YTDLP_PROVISION_MARKER: join(root, "yt-dlp-reconciliation-pending"),
      YTDLP_TEST_ROOT: root,
      YTDLP_TEST_MODE: mode,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  const line = stdout.split("\n").find((entry) => entry.startsWith("RESULT "));
  if (exitCode !== 0 || !line) throw new Error(`harness failed (${mode}):\n${stderr}\n${stdout}`);
  return JSON.parse(line.slice("RESULT ".length)) as { firstWaitMs: number; versionAfterWait: string; secondWaitMs: number; updateRuns: number };
}

afterAll(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }); });

// A fresh Docker volume starts with the image's pinned yt-dlp, which YouTube
// may already have outrun; lookups wait (bounded) for the first self-update.
describe("first yt-dlp update on a new volume", () => {
  test("a lookup waits for the running first update and then uses the new binary", async () => {
    const result = await run("slow");
    expect(result.firstWaitMs).toBeGreaterThanOrEqual(900);
    expect(result.versionAfterWait).toBe("2026.10.21");
    expect(result.updateRuns).toBe(1);
    expect(result.secondWaitMs).toBeLessThan(100);
  });

  test("the wait is bounded when the update hangs", async () => {
    const result = await run("hang");
    expect(result.firstWaitMs).toBeLessThan(1_500);
    expect(result.versionAfterWait).toBe("2026.08.19");
  });

  test("a failed first update lets lookups go on with the bootstrap binary and is not retried per lookup", async () => {
    const result = await run("fail");
    expect(result.versionAfterWait).toBe("2026.08.19");
    expect(result.updateRuns).toBe(1);
    expect(result.secondWaitMs).toBeLessThan(100);
  });

  test("an existing volume never waits or updates on a lookup", async () => {
    const result = await run("none");
    expect(result.firstWaitMs).toBeLessThan(100);
    expect(result.updateRuns).toBe(0);
  });
});
