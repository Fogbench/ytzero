import { describe, expect, test } from "bun:test";
import { channelContentTabs, splitChannelVideos } from "./channelContent";
import type { Video } from "./types";

const video = (id: string, isShort = false): Video => ({
  video_id: id,
  title: id,
  description: "",
  thumbnail: "",
  channel_title: "Channel",
  published_at: "2026-09-09T12:00:00Z",
  duration: null,
  live_status: "none",
  watched: 0,
  status: "inbox",
  is_short: isShort ? 1 : 0,
});

describe("TV channel content", () => {
  test("keeps regular uploads and Shorts in separate tabs", () => {
    const result = splitChannelVideos([video("regular"), video("short", true)]);
    expect(result.videos.map((item) => item.video_id)).toEqual(["regular"]);
    expect(result.shorts.map((item) => item.video_id)).toEqual(["short"]);
  });

  test("uses backend counts but honors the profile-wide Shorts setting", () => {
    const items = [video("regular"), video("short", true)];
    expect(channelContentTabs(items, { videos: 12, shorts: 7, processing: 0 }, true)).toEqual([
      { value: "videos", count: 12 },
      { value: "shorts", count: 7 },
    ]);
    expect(channelContentTabs(items, { videos: 12, shorts: 7, processing: 0 }, false)).toEqual([
      { value: "videos", count: 12 },
    ]);
  });
});
