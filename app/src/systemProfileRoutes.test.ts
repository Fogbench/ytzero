import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

test("Apple TV profile links use stable identity without bypassing server authorization", async () => {
  const root = mkdtempSync(resolve(tmpdir(), "ytzero-system-profiles-"));
  try {
    const child = Bun.spawn(["bun", "app/tests/systemProfileHarness.ts"], {
      cwd: resolve(import.meta.dir, "../.."),
      env: { ...Bun.env, DB_PATH: resolve(root, "db.sqlite"), AVATAR_DIR: resolve(root, "avatars"), LOG_PATH: resolve(root, "server.log") },
      stdout: "pipe", stderr: "pipe",
    });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    if (code !== 0) throw new Error(`System profile harness failed:\n${stderr}\n${stdout}`);
    expect(stdout).toContain("RESULT stable profile identity, PINs, child lock and personal-session isolation passed");
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 20_000);
