import { describe, expect, test } from "bun:test";
import { formatVideoAge, formatVideoCardMetadata, formatVideoViews } from "./videoMetadata";
import type { Video } from "./types";

const video: Video = {
  video_id: "video",
  title: "Title",
  description: "",
  thumbnail: "",
  channel_title: "Channel",
  published_at: "2026-09-07T12:00:00.000Z",
  duration: "12:34",
  live_status: "none",
  watched: 0,
  status: "inbox",
  views: 12_400,
};

describe("TV video card metadata", () => {
  test("formats views and published age in the selected locale", () => {
    const now = new Date("2026-09-09T12:00:00.000Z").getTime();
    expect(formatVideoViews(12_400, "en", "views")).toBe("12.4K views");
    expect(formatVideoAge(video.published_at, "en", now)).toBe("2 days ago");
    expect(formatVideoCardMetadata(video, "en", "views", now)).toBe("12.4K views  •  2 days ago");
  });

  test("omits unavailable or invalid metadata", () => {
    expect(formatVideoViews(null, "pl", "wyświetleń")).toBe("");
    expect(formatVideoAge("not-a-date", "pl", 0)).toBe("");
    expect(formatVideoCardMetadata({ ...video, views: null, published_at: null }, "pl", "wyświetleń", 0)).toBe("");
  });

  test("falls back when tvOS Hermes has no RelativeTimeFormat constructor", () => {
    const now = new Date("2026-09-09T12:00:00.000Z").getTime();
    expect(formatVideoAge(video.published_at, "pl", now, null)).toBe("2 dni temu");
    expect(formatVideoAge("2026-09-11T12:00:00.000Z", "en", now, null)).toBe("in 2 days");
    expect(formatVideoAge("2026-09-09T11:59:45.000Z", "ja", now, null)).toBe("たった今");
  });
});
