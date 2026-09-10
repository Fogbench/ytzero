import { describe, expect, test } from "bun:test";
import { YtZeroApi } from "./api";
import { playlistContinueTarget, playlistQueue, playlistVideos } from "./playlist";
import { libraryMessages } from "./libraryMessages";
import { LANGUAGE_CODES } from "../../../shared/uiLanguages";
import type { Video } from "./types";

const video = (id: string, state: Partial<Video> = {}) => ({ video_id: id, title: id, watched: 0, watch_position: 0, status: "inbox", ...state } as Video);
describe("followed playlists on TV", () => {
  test("preserves the server's full order including pending metadata and deduplicates", () => {
    const videos = Array.from({ length: 150 }, (_, i) => video(String(i)));
    const processing = video("pending");
    const order = ["pending", ...videos.map((v) => v.video_id).reverse(), "pending", "missing"];
    const result = playlistVideos({ videos, processing: [processing], order });
    expect(result.length).toBe(151);
    expect(result.slice(0, 3).map((v) => v.video_id)).toEqual(["pending", "149", "148"]);
    expect(playlistQueue("PL-example", "newest")).toEqual({ version: 1, kind: "channel-playlist", playlistId: "PL-example", sort: "newest" });
  });
  test("continues after the furthest watched/skipped item, or resumes a partially watched first item", () => {
    const a = video("a"), b = video("b"), c = video("c");
    expect(playlistContinueTarget([])).toBeNull();
    expect(playlistContinueTarget([a, b, c])).toBeNull();
    expect(playlistContinueTarget([{ ...a, watch_position: 25 }, b])).toEqual({ ...a, watch_position: 25 });
    expect(playlistContinueTarget([{ ...a, watched: 1 }, b, c])).toBe(b);
    expect(playlistContinueTarget([a, { ...b, status: "archived" }, c])).toBe(c);
    expect(playlistContinueTarget([a, b, { ...c, watched: 1 }])).toBeNull();
  });
  test("reads the instance preference and writes changes with authentication", async () => {
    const original = globalThis.fetch;
    const calls: Array<{ path: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (url, init) => { calls.push({ path: String(url), init }); return Response.json({ sort: "newest", videos: [], processing: [], order: [] }); }) as typeof fetch;
    try {
      const api = new YtZeroApi("http://instance.test", "test-bearer");
      expect((await api.channelPlaylistVideos("PL id")).sort).toBe("newest");
      await api.updatePlaylistSort("PL id", "title-asc");
      expect(calls[0]?.path).toBe("http://instance.test/api/channel-playlists/PL%20id/videos");
      expect(calls[1]?.init?.method).toBe("PUT");
      expect(calls[1]?.init?.body).toBe('{"sort":"title-asc"}');
      expect(new Headers(calls[1]?.init?.headers).get("Authorization")).toBe("Bearer test-bearer");
    } finally { globalThis.fetch = original; }
  });
  test("provides complete localized channel and playlist messages", () => {
    const keys = Object.keys(libraryMessages.en).sort();
    for (const language of LANGUAGE_CODES) {
      expect(Object.keys(libraryMessages[language]).sort()).toEqual(keys);
      expect(Object.values(libraryMessages[language]).every((message) => message.trim())).toBe(true);
    }
  });
});
