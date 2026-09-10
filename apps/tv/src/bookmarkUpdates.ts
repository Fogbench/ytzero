import type { BookmarkVideo, Video } from "./types";

export function applyBookmarkVideoUpdate(bookmarks: BookmarkVideo[], updated: Video): BookmarkVideo[] {
  // A Video callback may still carry a BookmarkVideo's extra runtime fields.
  // Share the video's changes across saved moments, never the source moment.
  return bookmarks.map((bookmark) => bookmark.video_id === updated.video_id ? {
    ...bookmark,
    ...updated,
    bookmark_id: bookmark.bookmark_id,
    position_seconds: bookmark.position_seconds,
    bookmark_description: bookmark.bookmark_description,
    bookmarked_at: bookmark.bookmarked_at,
    bookmark_updated_at: bookmark.bookmark_updated_at,
  } : bookmark);
}
