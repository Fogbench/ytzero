import { describe, expect, test } from "bun:test";
import { addQueueVideo, browseQueue, effectiveQueue, moveQueueVideo, sessionContext, shortsNavigation, shouldAdvanceQueue, type PlaybackQueueContext } from "./playbackQueue";
import { queueMessages } from "./queueMessages";
import { LANGUAGE_CODES } from "../../../shared/uiLanguages";
import { YtZeroApi } from "./api";
import type { Video } from "./types";

// Run the canonical validator without importing the web project's type graph
// into the separate React Native TypeScript configuration.
const webContract: string = "../../../ui/src/playbackQueue";
const { isPlaybackQueueContext } = await import(webContract);

const video = (id: string) => ({ video_id: id, title: id, thumbnail: "", channel_title: "Channel" } as Video);
const a = video("video_a"), b = video("video_b"), c = video("video_c");
const feed: PlaybackQueueContext = { version: 1, kind: "feed", tags: [4, 9], showAll: false, sort: "arrival" };

describe("TV playback queue", () => {
  test("vertical navigation only selects adjacent Shorts and respects queue boundaries", () => {
    const shortA = { ...a, is_short: 1 };
    const shortB = { ...b, is_short: 1 };
    const shortC = { ...c, is_short: 1 };
    expect(shortsNavigation(shortB, shortC, shortA)).toEqual({ nextId: c.video_id, previousId: a.video_id });
    expect(shortsNavigation(shortA, shortB, null)).toEqual({ nextId: b.video_id, previousId: "" });
    expect(shortsNavigation(shortC, null, shortB)).toEqual({ nextId: "", previousId: b.video_id });
    expect(shortsNavigation(shortA, b, shortA)).toEqual({ nextId: "", previousId: "" });
    expect(shortsNavigation(a, shortB, shortC)).toEqual({ nextId: "", previousId: "" });
  });
  test("deduplicates without changing order and moves existing entries in both directions", () => {
    const items = addQueueVideo(addQueueVideo([], a), b);
    expect(addQueueVideo(items, a)).toBe(items);
    expect(moveQueueVideo(items, a.video_id, -1)).toBe(items);
    expect(moveQueueVideo(items, "unknown", 1)).toBe(items);
    const moved = moveQueueVideo(items, a.video_id, 1);
    expect(moved).toEqual([b, a]);
    expect(moveQueueVideo(moved, a.video_id, -1)).toEqual(items);
  });
  test("explicit queue wins; clearing it restores the exact original feed context", () => {
    expect(effectiveQueue(a.video_id, feed, [b, c])).toEqual({ version: 1, kind: "session", ids: [a.video_id, b.video_id, c.video_id] });
    expect(effectiveQueue(b.video_id, feed, [a, b, c])).toEqual(sessionContext([a, b, c]));
    expect(effectiveQueue(b.video_id, feed, [])).toBe(feed);
    const playlist = { version: 1, kind: "user-playlist", playlistUuid: "owned-list", sort: "playlist-order" } as const;
    expect(effectiveQueue(a.video_id, playlist, [b])).toBe(playlist);
  });
  test("bounds wire contexts without losing the final stored queue item", () => {
    const full = Array.from({ length: 100 }, (_, index) => video(`video_${index}`));
    expect(addQueueVideo(full, a)).toBe(full);
    expect(isPlaybackQueueContext(effectiveQueue(a.video_id, feed, full))).toBe(true);
    const advanced = effectiveQueue(full[0]!.video_id, feed, full);
    expect(advanced?.kind === "session" && advanced.ids.at(-1)).toBe(full.at(-1)!.video_id);
    expect(full).toHaveLength(100);
  });
  test("uses the web contract for each supported source and passes feed filters through", () => {
    expect(browseQueue("/", [a], "arrival", [4, 9])).toEqual(feed);
    for (const destination of ["/", "/watchlist", "/liked", "/history", "/archive", "/recommendations", "/downloads", "/shorts", "/followed-playlists"] as const) {
      expect(isPlaybackQueueContext(browseQueue(destination, [a, b], "published"))).toBe(true);
    }
    expect(browseQueue("/downloads", [b, a], "published")).toEqual(sessionContext([b, a]));
  });
  test("continues an explicit queue and respects the web feed autoplay preference", () => {
    expect(shouldAdvanceQueue(sessionContext([a, b]), "0", "prompt")).toBe(true);
    expect(shouldAdvanceQueue(feed, "1", "autoplay")).toBe(true);
    expect(shouldAdvanceQueue(feed, "1", "prompt")).toBe(false);
    expect(shouldAdvanceQueue(feed, "0", "autoplay")).toBe(false);
  });
  test("asks the shared backend for adjacent videos beyond loaded pages", async () => {
    const original = globalThis.fetch;
    const calls: Array<{ url: string; body: unknown }> = [];
    globalThis.fetch = (async (input, init) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return Response.json({ video_id: b.video_id });
    }) as typeof fetch;
    try {
      const api = new YtZeroApi("http://ytzero.local:3001", "test-only-token");
      expect(await api.playbackAdjacent(a.video_id, "newest", feed)).toEqual({ video_id: b.video_id });
      await api.playbackAdjacent(b.video_id, "newest", sessionContext([a, b]), "previous");
      expect(calls[0]).toEqual({ url: "http://ytzero.local:3001/api/playback/adjacent", body: { video_id: a.video_id, direction: "newest", relative: "next", context: feed } });
      expect(calls[1]!.body).toEqual({ video_id: b.video_id, direction: "newest", relative: "previous", context: sessionContext([a, b]) });
    } finally { globalThis.fetch = original; }
  });
  test("every supported language has complete queue and carousel copy", () => {
    for (const language of LANGUAGE_CODES) {
      expect(Object.keys(queueMessages[language]).sort()).toEqual(Object.keys(queueMessages.en).sort());
      for (const value of Object.values(queueMessages[language])) expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});
