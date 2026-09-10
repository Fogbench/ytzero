import type { PlaybackQueueContext } from "./playbackQueue";
import type { Video } from "./types";

export const PLAYLIST_SORTS = ["playlist-order", "oldest", "newest", "title-asc", "title-desc"] as const;
export type PlaylistSort = typeof PLAYLIST_SORTS[number];
export function normalizePlaylistSort(value: unknown): PlaylistSort {
  return typeof value === "string" && (PLAYLIST_SORTS as readonly string[]).includes(value) ? value as PlaylistSort : "oldest";
}

// Preserve the server's merged order, including videos whose metadata is pending.
export function playlistVideos(contents: { videos: Video[]; processing: Video[]; order: string[] }): Video[] {
  const byId = new Map([...contents.videos, ...contents.processing].map((video) => [video.video_id, video]));
  return [...new Set([...contents.order, ...byId.keys()])].flatMap((id) => byId.has(id) ? [byId.get(id)!] : []);
}

/** Same frontier as the web: continue after the furthest watched/skipped item. */
export function playlistContinueTarget(videos: readonly Video[]): Video | null {
  for (let index = videos.length - 1; index >= 0; index--) {
    const video = videos[index]!;
    if (video.watched === 1 || video.status === "archived") return videos[index + 1] ?? null;
  }
  // Also expose resume when the first video is only partially watched.
  return videos[0]?.watch_position && videos[0].watch_position > 0 ? videos[0] : null;
}
export function playlistQueue(playlistId: string, sort: PlaylistSort): PlaybackQueueContext {
  return { version: 1, kind: "channel-playlist", playlistId, sort };
}

