import type { TvBrowseDestination } from "./navigation";
import type { Video } from "./types";

// Same wire contract as ui/src/playbackQueue.ts. Metro is isolated to apps/tv.
export type PlaybackQueueContext =
  | { version: 1; kind: "feed"; tags: number[]; showAll: boolean; sort: "published" | "arrival" }
  | { version: 1; kind: "liked"; showShorts: boolean }
  | { version: 1; kind: "history" | "archive" | "recommendations" | "in-progress" }
  | { version: 1; kind: "watchlist"; sort: "schedule" | "duration-asc" | "duration-desc" | "title-asc" | "channel-asc"; dueOnly: boolean }
  | { version: 1; kind: "user-playlist"; playlistUuid: string; sort: "playlist-order" | "oldest" | "newest" | "title-asc" | "title-desc" | "added-oldest" | "added-newest" }
  | { version: 1; kind: "channel-playlist"; playlistId: string; sort: "playlist-order" | "oldest" | "newest" | "title-asc" | "title-desc" }
  | { version: 1; kind: "session"; ids: string[] };

export type OpenVideo = (video: Video, context?: PlaybackQueueContext, autoplay?: boolean, startPosition?: number) => void;
export const SESSION_QUEUE_LIMIT = 100;

/** Only adjacent Shorts participate in vertical remote gestures. */
export function shortsNavigation(video: Video, next: Video | null, previous: Video | null) {
  const target = (item: Video | null) => video.is_short === 1 && item?.is_short === 1 && item.video_id !== video.video_id ? item.video_id : "";
  return { nextId: target(next), previousId: target(previous) };
}

export function addQueueVideo(items: Video[], video: Video): Video[] {
  if (items.length >= SESSION_QUEUE_LIMIT || items.some((item) => item.video_id === video.video_id)) return items;
  return [...items, video];
}
export function moveQueueVideo(items: Video[], id: string, delta: -1 | 1): Video[] {
  const index = items.findIndex((video) => video.video_id === id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
export function sessionContext(items: Video[]): Extract<PlaybackQueueContext, { kind: "session" }> {
  return { version: 1, kind: "session", ids: [...new Set(items.map((video) => video.video_id))].slice(0, SESSION_QUEUE_LIMIT) };
}
export function effectiveQueue(currentId: string, source: PlaybackQueueContext | null, items: Video[]): PlaybackQueueContext | null {
  if (!items.length || source?.kind === "user-playlist" || source?.kind === "channel-playlist") return source;
  const ids = items.map((item) => item.video_id);
  return { version: 1, kind: "session", ids: ids.includes(currentId) ? ids : [currentId, ...ids].slice(0, SESSION_QUEUE_LIMIT) };
}
export function browseQueue(destination: TvBrowseDestination, videos: Video[], sort: "published" | "arrival", tags: number[] = []): PlaybackQueueContext {
  if (destination === "/") return { version: 1, kind: "feed", tags, sort, showAll: false };
  if (destination === "/watchlist") return { version: 1, kind: "watchlist", sort: "schedule", dueOnly: false };
  if (destination === "/liked") return { version: 1, kind: "liked", showShorts: true };
  if (destination === "/history" || destination === "/archive" || destination === "/recommendations") return { version: 1, kind: destination.slice(1) as "history" | "archive" | "recommendations" };
  return sessionContext(videos);
}
export function shouldAdvanceQueue(queue: PlaybackQueueContext | null, enabled?: string, behavior?: string): boolean {
  if (queue?.kind === "session" || queue?.kind === "user-playlist" || queue?.kind === "channel-playlist") return true;
  return enabled === "1" && behavior !== "prompt";
}
