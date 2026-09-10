import { test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

test("native playback works through authenticated tickets and range/HLS media requests", async () => {
  const root = mkdtempSync(resolve(tmpdir(), "ytzero-native-playback-"));
  try {
    const child = Bun.spawn([process.execPath, "app/tests/nativePlaybackHarness.ts"], {
      cwd: resolve(import.meta.dir, "../.."),
      env: { ...Bun.env, DB_PATH: resolve(root, "db", "test.db"), AVATAR_DIR: resolve(root, "avatars"), DOWNLOADS_DIR: resolve(root, "downloads") },
      stdout: "pipe", stderr: "pipe",
    });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    if (code !== 0) throw new Error(`Native playback harness failed:\n${stdout}\n${stderr}`);
    expect(stdout).toContain("RESULT native playback");
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 30_000);
