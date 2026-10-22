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
}
