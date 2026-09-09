import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const root = mkdtempSync(resolve(tmpdir(), "ytzero-device-auth-test-"));
let completed = false;

beforeAll(async () => {
  const process = Bun.spawn(["bun", "app/tests/deviceAuthHarness.ts"], {
    cwd: resolve(import.meta.dir, "../.."),
    env: {
      ...Bun.env,
      DB_PATH: resolve(root, "db", "auth.db"),
      AVATAR_DIR: resolve(root, "avatars"),
      DOWNLOADS_DIR: resolve(root, "downloads"),
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exitCode !== 0) throw new Error(`TV device auth harness failed:\n${stderr}\n${stdout}`);
  completed = stdout.split("\n").includes("RESULT ok");
  if (!completed) throw new Error(`TV device auth harness returned no completion marker:\n${stdout}`);
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("TV device authorization routes", () => {
  test("pairs once, accepts a Bearer session, and revokes it on logout", () => {
    expect(completed).toBe(true);
  });
});
