import { afterEach, expect, test } from "bun:test";
import { YtZeroApi } from "./api";
import { matchingChannels, searchVideo } from "./search";
const originalFetch = globalThis.fetch;
test("YouTube cards retain resume and download state for the native player", () => {
  const video = searchVideo({ videoId: "abcdefghijk", title: "Example", thumbnail: "https://example.com/image.jpg", duration: "1:12:03",
    channelId: "channel-id", channelTitle: "Channel", channelAvatar: null, viewCount: 1200, watched: 0,
    watch_position: 120, watch_duration: 4323, bucket: "tonight", download_status: null, downloads_enabled: true, downloads_allowed: true });
  expect(video).toMatchObject({ video_id: "abcdefghijk", external: 1, duration: "1:12:03", watch_position: 120, watch_duration: 4323, bucket: "tonight", download_status: null });
});
afterEach(() => { globalThis.fetch = originalFetch; });
function mockApi(handler: (url: URL, init?: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => Promise.resolve(handler(new URL(String(url)), init))) as typeof fetch;
}
test("local searches encode punctuation and include watched library videos", async () => {
  const paths: string[] = [];
  mockApi((url, init) => {
    paths.push(url.pathname);
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
    if (url.pathname.endsWith("/feed")) {
      expect(url.searchParams.get("q")).toBe("C++ & TV");
      expect(url.searchParams.get("status")).toBe("all");
      expect(url.searchParams.get("page")).toBe("1");
      return Response.json({ videos: [], page: 1, limit: 24 });
    }
    throw new Error("Unexpected channel reload while paging");
  });
  expect((await new YtZeroApi("https://example.com", "test-token").searchLocal("C++ & TV", 1)).hasMore).toBe(false);
  expect(paths).toEqual(["/api/feed"]);
});
test("local-only profiles never issue a YouTube search", async () => {
  const paths: string[] = [];
  mockApi((url) => { paths.push(url.pathname); return Response.json({ local_only: true }); });
  expect(await new YtZeroApi("https://example.com").searchYoutube("cats")).toEqual({ videos: [], channels: [] });
  expect(paths).toEqual(["/api/child/status"]);
});
test("empty YouTube responses from older servers are supported", async () => {
  mockApi((url) => Response.json(url.pathname.endsWith("/status") ? { local_only: false } : { results: [] }));
  expect(await new YtZeroApi("https://example.com").searchYoutube("cats")).toEqual({ videos: [], channels: [] });
});
test("missing external videos load metadata before the full video, without downloading media", async () => {
  const paths: string[] = [];
  mockApi((url) => {
    paths.push(url.pathname);
    if (paths.length === 1) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json(url.pathname.endsWith("/info") ? { info: {} } : { video: { video_id: "abcdefghijk" }, related: [] });
  });
  expect((await new YtZeroApi("https://example.com").video("abcdefghijk")).video.video_id).toBe("abcdefghijk");
  expect(paths).toEqual(["/api/videos/abcdefghijk", "/api/videos/abcdefghijk/info", "/api/videos/abcdefghijk"]);
});
test("permission failures do not trigger an external import", async () => {
  let requests = 0;
  mockApi(() => { requests++; return Response.json({ error: "restricted" }, { status: 403 }); });
  await expect(new YtZeroApi("https://example.com").video("abcdefghijk")).rejects.toMatchObject({ status: 403 });
  expect(requests).toBe(1);
});
test("channel matching supports accents, handles and partial titles", () => {
  const channel = { channel_id: "channel-id", title: "Café TV", handle: "@coffeetime", thumbnail: "", tags: [] };
  expect(matchingChannels([channel], "cafe")).toEqual([channel]);
  expect(matchingChannels([channel], "@coffee")).toEqual([channel]);
  expect(matchingChannels([channel], "!!!")).toEqual([]);
});
