import { describe, expect, test } from "bun:test";
import { channelsForTags, dueScheduledVideos, visibleFeedTags, withoutInProgress } from "./feedSections";
import type { Channel, Video } from "./types";

const video = (video_id: string, fields: Partial<Video> = {}): Video => ({
  video_id,
  title: video_id,
  description: "",
  thumbnail: "",
  channel_title: "Channel",
  published_at: "2026-09-01 12:00:00",
  duration: null,
  live_status: "none",
  watched: null,
  status: "inbox",
  ...fields,
});

describe("TV feed sections", () => {
  test("uses backend filter visibility and ANY-tag channel semantics", () => {
    expect(visibleFeedTags([
      { id: 1, name: "One", color: "#fff" },
      { id: 2, name: "Two", color: "#fff", hidden_from_filters: 1 },
    ])).toHaveLength(1);

    const channels: Channel[] = [
      { channel_id: "a", title: "A", thumbnail: "", tags: [{ id: 1, name: "One", color: "#fff" }] },
      { channel_id: "b", title: "B", thumbnail: "", tags: [{ id: 2, name: "Two", color: "#fff" }] },
    ];
    expect(channelsForTags([], channels, [1, 2]).map((channel) => channel.channel_id)).toEqual(["a", "b"]);
    expect(channelsForTags([channels[1]!], channels, []).map((channel) => channel.channel_id)).toEqual(["b"]);
  });

  test("shows only unlocked scheduled videos in bucket order", () => {
    const result = dueScheduledVideos([
      video("future", { bucket: "today", show_from: "2026-09-10 10:00:00" }),
      video("tomorrow", { bucket: "tomorrow", show_from: "2026-09-09 08:00:00" }),
      video("today", { bucket: "today", show_from: "2026-09-09 09:00:00" }),
      video("unscheduled"),
    ], new Date("2026-09-09T12:00:00Z"));
    expect(result.map((item) => item.video_id)).toEqual(["today", "tomorrow"]);
  });

  test("removes continue-watching duplicates from the main grid", () => {
    expect(withoutInProgress([video("a"), video("b")], [video("b")]).map((item) => item.video_id)).toEqual(["a"]);
  });
});
