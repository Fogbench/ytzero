import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { runIsolatedTestFile } from "../tests/isolatedTestFile";

const ISOLATION_FLAG = "YTZERO_VIDEO_IMPORT_ROUTE_TEST_ISOLATED";
if (process.env[ISOLATION_FLAG] !== "1") {
  test("video import route suite runs in an isolated application runtime", async () => {
    await runIsolatedTestFile("src/videoImportRoute.test.ts", ISOLATION_FLAG);
  });
} else {
  const root = mkdtempSync(resolve(tmpdir(), "ytzero-video-import-route-"));
  process.env.DB_PATH = resolve(root, "db.sqlite");

  const { db, setUserSetting } = await import("./db");
  const { api } = await import("./routes");
  const originalFetch = globalThis.fetch;

  afterAll(() => {
    globalThis.fetch = originalFetch;
    rmSync(root, { recursive: true, force: true });
  });

  function mockPlayer(videoId: string) {
    const playerResponse = {
      videoDetails: {
        videoId,
        title: "Imported video",
        channelId: "UCimportchannel",
        author: "Import channel",
        shortDescription: "",
        thumbnail: { thumbnails: [] },
        viewCount: "1",
        lengthSeconds: "60",
      },
      microformat: { playerMicroformatRenderer: { publishDate: "2026-09-08" } },
    };
    globalThis.fetch = (async () =>
      new Response(`ytInitialPlayerResponse = ${JSON.stringify(playerResponse)};`)) as unknown as typeof fetch;
  }

  const importVideo = (id: string) => api.request(`http://localhost/videos/${id}/import`, {
    method: "POST",
    headers: { Cookie: "ytzero_profile=1" },
  });
  const row = (id: string) => db.prepare("SELECT status, external FROM videos WHERE video_id=?").get(id) as any;

  describe("POST /videos/:id/import", () => {
    test("stores an external inbox row for an unknown video", async () => {
      mockPlayer("importNew01");
      const res = await importVideo("importNew01");
      expect(res.status).toBe(200);
      expect(row("importNew01")).toMatchObject({ status: "inbox", external: 1 });
    });

    test("leaves an existing row untouched", async () => {
      db.prepare("INSERT INTO channels(channel_id,title,url) VALUES('UCold','Old','')").run();
      db.prepare("INSERT INTO videos(video_id,channel_id,title,status,external) VALUES('importOld01','UCold','Old','archived',0)").run();
      const res = await importVideo("importOld01");
      expect(res.status).toBe(200);
      expect(row("importOld01")).toMatchObject({ status: "archived", external: 0 });
    });

    test("child local-only profiles get 403 and nothing is stored", async () => {
      setUserSetting(1, "child_local_only", "1");
      try {
        mockPlayer("importKid01");
        const res = await importVideo("importKid01");
        expect(res.status).toBe(403);
        expect(row("importKid01")).toBeNull();
      } finally {
        setUserSetting(1, "child_local_only", "0");
      }
    });
  });

  describe("playlist routes", () => {
    const post = (path: string, body: unknown, method = "POST") => api.request(`http://localhost${path}`, {
      method,
      headers: { Cookie: "ytzero_profile=1", "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    test("from-session-queue stores the playlist and its videos", async () => {
      db.prepare("INSERT OR IGNORE INTO channels(channel_id,title,url) VALUES('UCold','Old','')").run();
      db.prepare("INSERT INTO videos(video_id,channel_id,title) VALUES('queueVid001','UCold','Q1'),('queueVid002','UCold','Q2')").run();
      const res = await post("/playlists/from-session-queue", { name: "From queue", video_ids: ["queueVid001", "queueVid002"] });
      expect(res.status).toBe(200);
      const { playlist } = await res.json() as any;
      expect(playlist.name).toBe("From queue");
      const rows = db.prepare("SELECT video_id FROM user_playlist_videos WHERE playlist_id=? ORDER BY position").all(playlist.id) as any[];
      expect(rows.map((r) => r.video_id)).toEqual(["queueVid001", "queueVid002"]);
    });

    test("deleting a video from a playlist removes it", async () => {
      const { playlist } = await (await post("/playlists", { name: "Del" })).json() as any;
      db.prepare("INSERT INTO user_playlist_videos(playlist_id,video_id,position) VALUES(?, 'queueVid001', 0)").run(playlist.id);
      const res = await post(`/playlists/${playlist.id}/videos/queueVid001`, undefined, "DELETE");
      expect(res.status).toBe(200);
      expect(db.prepare("SELECT 1 FROM user_playlist_videos WHERE playlist_id=?").get(playlist.id)).toBeNull();
    });
  });
}
