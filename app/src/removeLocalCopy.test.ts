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
  const { cancelAllPendingDownloads, enqueueDownload } = await import("./downloader");
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

    test("only a queued status changes on removal", async () => {
      seed("rmArchived1");
      db.prepare("UPDATE user_videos SET status='archived' WHERE user_id=1 AND video_id='rmArchived1'").run();
      await enqueueDownload(1, "rmArchived1", "manual");
      await remove("rmArchived1");
      expect(uv(1, "rmArchived1").status).toBe("archived");
    });

    test("other owner's queued video is not duplicated by a tick", async () => {
      await tick(2);
      expect(owners("rmShared001")).toEqual([2]);
      expect(dl("rmShared001")?.status).toBe("queued");
    });

    test("cancel-all leaves the watch-later queue organisation alone", async () => {
      seed("rmCancel001");
      db.prepare("UPDATE user_videos SET bucket='evening' WHERE user_id=1 AND video_id='rmCancel001'").run();
      await enqueueDownload(1, "rmCancel001", "manual");
      await cancelAllPendingDownloads(1);
      expect(dl("rmCancel001")?.status).toBe("deleted");
      expect(db.prepare("SELECT status, bucket FROM user_videos WHERE user_id=1 AND video_id='rmCancel001'").get()).toEqual({ status: "queued", bucket: "evening" });
    });

    test("tick rechecks the queue state right before enqueueing", async () => {
      seed("rmRace00001");
      seed("rmRace00002");
      const seen: string[] = [];
      await enqueueScheduledDownloadsForUser(1, async (u, v) => {
        if (!v.startsWith("rmRace")) return false;
        seen.push(v);
        const other = v === "rmRace00001" ? "rmRace00002" : "rmRace00001";
        db.prepare("UPDATE user_videos SET status='inbox' WHERE user_id=1 AND video_id=?").run(other);
        return false;
      });
      expect(seen.length).toBe(1);
    });
  });
}
