import { afterEach, describe, expect, test } from "bun:test";
import { fetchAllChannelVideos, fetchChannelStreams, fetchChannelVideos } from "./youtube";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

function videoRenderer(videoId: string, title: string) {
  return {
    videoId,
    title: { simpleText: title },
    thumbnail: { thumbnails: [{ url: `https://example.com/${videoId}.jpg` }] },
    lengthText: { simpleText: "12:34" },
  };
}

describe("YouTube channel video history", () => {
  test("follows browse continuations and deduplicates videos across pages", async () => {
    const initial = {
      videoRenderer: videoRenderer("initial0001", "Initial"),
      continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: "page-2" } } },
    };
    const html = `ytInitialData = ${JSON.stringify(initial)}; "INNERTUBE_API_KEY":"key","INNERTUBE_CONTEXT_CLIENT_VERSION":"1.0"`;
    const secondPage = {
      onResponseReceivedActions: [{ appendContinuationItemsAction: { continuationItems: [
        { videoRenderer: videoRenderer("initial0001", "Duplicate") },
        { lockupViewModel: {
          contentId: "history0002",
          contentType: "LOCKUP_CONTENT_TYPE_VIDEO",
          contentImage: { thumbnailViewModel: { image: { sources: [{ url: "https://example.com/history0002.jpg" }] } } },
          metadata: { lockupMetadataViewModel: { title: { content: "Older upload" } } },
        } },
        { continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: "page-3" } } } },
      ] } }],
    };
    const thirdPage = { videoRenderer: videoRenderer("history0003", "Oldest upload") };
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (input, init) => {
      requests.push({ url: String(input), init });
      if (requests.length === 1) return new Response(html);
      return new Response(JSON.stringify(requests.length === 2 ? secondPage : thirdPage));
    }) as typeof fetch;

    const videos = await fetchAllChannelVideos("UC_channel_history_test");

    expect(videos.map((video) => video.videoId)).toEqual(["initial0001", "history0002", "history0003"]);
    expect(requests).toHaveLength(3);
    expect(requests[1].url).toContain("/youtubei/v1/browse");
    expect(JSON.parse(String(requests[1].init?.body))).toMatchObject({ continuation: "page-2" });
    expect(JSON.parse(String(requests[2].init?.body))).toMatchObject({ continuation: "page-3" });
  });

  test("propagates rate limiting from a history continuation", async () => {
    const initial = {
      videoRenderer: videoRenderer("initial0003", "Initial"),
      continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: "page-2-limited" } } },
    };
    const html = `ytInitialData = ${JSON.stringify(initial)}; "INNERTUBE_API_KEY":"key","INNERTUBE_CONTEXT_CLIENT_VERSION":"1.0"`;
    let requests = 0;
    globalThis.fetch = (async () => ++requests === 1
      ? new Response(html)
      : new Response("limited", { status: 429 })) as unknown as typeof fetch;

    await expect(fetchAllChannelVideos("UC_channel_history_limited_test")).rejects.toThrow("429");
  });

  test("keeps regular video and stream lookups on the first page", async () => {
    const initial = {
      videoRenderer: videoRenderer("initial0004", "Initial"),
      continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: "unused-page" } } },
    };
    const html = `ytInitialData = ${JSON.stringify(initial)}; "INNERTUBE_API_KEY":"key","INNERTUBE_CONTEXT_CLIENT_VERSION":"1.0"`;
    let requests = 0;
    globalThis.fetch = (async () => {
      requests++;
      return new Response(html);
    }) as unknown as typeof fetch;

    expect((await fetchChannelVideos("UC_channel_first_page_test")).map((video) => video.videoId)).toEqual(["initial0004"]);
    expect((await fetchChannelStreams("UC_stream_first_page_test")).map((video) => video.videoId)).toEqual(["initial0004"]);
    expect(requests).toBe(2);
  });

  test("rejects a repeated continuation instead of reporting a partial history as complete", async () => {
    const initial = {
      videoRenderer: videoRenderer("initial0005", "Initial"),
      continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: "repeated-page" } } },
    };
    const html = `ytInitialData = ${JSON.stringify(initial)}; "INNERTUBE_API_KEY":"key","INNERTUBE_CONTEXT_CLIENT_VERSION":"1.0"`;
    const repeated = {
      videoRenderer: videoRenderer("history0006", "Older upload"),
      continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: "repeated-page" } } },
    };
    let requests = 0;
    globalThis.fetch = (async () => ++requests === 1
      ? new Response(html)
      : new Response(JSON.stringify(repeated))) as unknown as typeof fetch;

    await expect(fetchAllChannelVideos("UC_channel_repeated_page_test")).rejects.toThrow("continuation repeated");
    expect(requests).toBe(2);
  });

  test("rejects a successful response without channel data", async () => {
    globalThis.fetch = (async () => new Response("<html>unexpected layout</html>")) as unknown as typeof fetch;

    await expect(fetchAllChannelVideos("UC_channel_missing_data_test")).rejects.toThrow("channel videos data missing");
  });
});
