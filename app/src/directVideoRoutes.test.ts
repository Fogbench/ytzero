import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("direct HLS routes stream without enabling or creating downloads and enforce profile access", async () => {
  const root = mkdtempSync(join(tmpdir(), "ytzero-direct-routes-"));
  const ytdlp = join(root, "yt-dlp");
  writeFileSync(ytdlp, "#!/bin/sh\nprintf 'test-version\\n'\n", { mode: 0o700 });
  try {
    const child = Bun.spawn([process.execPath, "app/tests/directVideoRoutesHarness.ts"], {
      cwd: resolve(import.meta.dir, "../.."),
      env: { ...Bun.env, DB_PATH: join(root, "db/source.db"), AVATAR_DIR: join(root, "avatars"), DOWNLOADS_DIR: join(root, "downloads"), DOWNLOAD_COOKIES_DIR: join(root, "cookies"), YTDLP_PATH: ytdlp },
      stdout: "pipe", stderr: "pipe",
    });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    if (code !== 0) throw new Error(stderr || stdout || `Harness exited with ${code}`);
    expect(code, stderr).toBe(0);
    expect(stdout, stderr).toContain("RESULT direct routes");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
