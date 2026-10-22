import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { runIsolatedTestFile } from "../tests/isolatedTestFile";

const ISOLATION_FLAG = "YTZERO_REMOVE_LOCAL_COPY_TEST_ISOLATED";
if (process.env[ISOLATION_FLAG] !== "1") {
  test("remove local copy suite runs in an isolated application runtime", async () => {
    await runIsolatedTestFile("src/removeLocalCopy.test.ts", ISOLATION_FLAG);
  });
} else {
  const root = mkdtempSync(resolve(tmpdir(), "ytzero-remove-copy-"));
  process.env.DB_PATH = resolve(root, "db.sqlite");
  process.env.DOWNLOADS_DIR = resolve(root, "downloads");

  const { db } = await import("./db");
  const { api } = await import("./routes");
  const { enqueueDownload } = await import("./downloader");
  const { setProfileDownloadsEnabled } = await import("./downloadConfig");
  const { enqueueScheduledDownloadsForUser } = await import("./scheduledDownloads");

  await setProfileDownloadsEnabled(1, true);

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  const tick = (userId: number) =>
    enqueueScheduledDownloadsForUser(userId, (u, v) => enqueueDownload(u, v, "scheduled", false, true));
  const dl = (id: string) => db.prepare("SELECT status FROM downloads WHERE video_id=?").get(id) as { status: string } | null;
  const uv = (user: number, id: string) => db.prepare("SELECT status, queued_at FROM user_videos WHERE user_id=? AND video_id=?").get(user, id) as { status: string; queued_at: string | null };
  const owners = (id: string) => (db.prepare("SELECT user_id FROM download_owners WHERE video_id=? ORDER BY user_id").all(id) as { user_id: number }[]).map((r) => r.user_id);
  const remove = (id: string, profile = 1) => api.request(`http://localhost/videos/${id}/download`, { method: "DELETE", headers: { Cookie: `ytzero_profile=${profile}` } });

  function seed(id: string, users: number[] = [1]) {
    db.prepare("INSERT OR IGNORE INTO channels(channel_id,title,url) VALUES('UCrm','Rm','')").run();
    db.prepare("INSERT INTO videos(video_id,channel_id,title,live_status,is_short) VALUES(?, 'UCrm', 'T', 'none', 0)").run(id);
    for (const u of users) db.prepare("INSERT OR REPLACE INTO user_videos(user_id,video_id,status,queued_at) VALUES(?,?,'queued',datetime('now'))").run(u, id);
  }

  describe("Remove local copy", () => {
    test("scheduled tick does not revive a removed copy; manual download still works", async () => {
      seed("rmQueued001");
      expect(await tick(1)).toBe(1);
      expect(owners("rmQueued001")).toEqual([1]);
      expect((await remove("rmQueued001")).status).toBe(200);
      expect(dl("rmQueued001")?.status).toBe("deleted");
      expect(uv(1, "rmQueued001").status).not.toBe("queued");

      expect(await tick(1)).toBe(0);
      expect(dl("rmQueued001")?.status).toBe("deleted");
      expect(owners("rmQueued001")).toEqual([]);

      expect(await enqueueDownload(1, "rmQueued001", "manual", false)).toBe(true);
      expect(dl("rmQueued001")?.status).toBe("queued");
      expect(owners("rmQueued001")).toEqual([1]);
    });

    test("another owner's copy and queue entry are unaffected", async () => {
      db.prepare("INSERT OR IGNORE INTO users(id,name) VALUES(2,'Two')").run();
      await setProfileDownloadsEnabled(2, true);
      seed("rmShared001", [1, 2]);
      await enqueueDownload(1, "rmShared001", "scheduled");
      await enqueueDownload(2, "rmShared001", "scheduled");
      await remove("rmShared001", 1);
      expect(dl("rmShared001")?.status).toBe("queued");
      expect(owners("rmShared001")).toEqual([2]);
      expect(uv(2, "rmShared001").status).toBe("queued");
    });

    test("a watched video stays out of the scheduled tick after removal", async () => {
      seed("rmWatched01");
      await enqueueDownload(1, "rmWatched01", "manual");
      db.prepare("UPDATE user_videos SET watched=1 WHERE user_id=1 AND video_id='rmWatched01'").run();
      await remove("rmWatched01");
      expect(await tick(1)).toBe(0);
      expect(dl("rmWatched01")?.status).toBe("deleted");
    });
  });
}
