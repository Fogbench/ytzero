import { expect, test } from "bun:test";
import { applyBookmarkVideoUpdate } from "./bookmarkUpdates";
import type { BookmarkVideo } from "./types";

function bookmark(id: string, position: number, videoId = "video-one"): BookmarkVideo {
  return {
    video_id: videoId, title: "Video", channel_title: "Channel", thumbnail: "", duration: "10:00",
    bookmark_id: id, position_seconds: position, bookmark_description: `Note ${id}`,
    bookmarked_at: `2026-09-0${position}T12:00:00Z`, bookmark_updated_at: `2026-09-0${position}T13:00:00Z`,
  } as BookmarkVideo;
}

test("updating a video from one saved moment preserves every bookmark's identity and context", () => {
  const first = bookmark("first", 1);
  const second = bookmark("second", 2);
  const other = bookmark("other", 3, "video-two");
  // The actions menu spreads its input, which can be a BookmarkVideo at runtime.
  const updated = { ...first, watched: 1, watch_position: 120, title: "Updated video" };
  const result = applyBookmarkVideoUpdate([first, second, other], updated);
  expect(result.map((item) => item.bookmark_id)).toEqual(["first", "second", "other"]);
  for (const [index, original] of [first, second].entries()) {
    expect(result[index]).toMatchObject({
      bookmark_id: original.bookmark_id, position_seconds: original.position_seconds,
      bookmark_description: original.bookmark_description, bookmarked_at: original.bookmarked_at,
      bookmark_updated_at: original.bookmark_updated_at, watched: 1, watch_position: 120, title: "Updated video",
    });
  }
  expect(result[2]).toBe(other);
  expect(first.title).toBe("Video");
  expect(second.bookmark_id).toBe("second");
});

test("plain playback progress updates all saved moments without changing their seek positions", () => {
  const first = bookmark("first", 1);
  const second = bookmark("second", 2);
  const { bookmark_id, position_seconds, bookmark_description, bookmarked_at, bookmark_updated_at, ...video } = first;
  const result = applyBookmarkVideoUpdate([first, second], { ...video, watch_position: 400, watch_duration: 600 });
  expect(result.map((item) => item.position_seconds)).toEqual([1, 2]);
  expect(result.map((item) => item.watch_position)).toEqual([400, 400]);
});
