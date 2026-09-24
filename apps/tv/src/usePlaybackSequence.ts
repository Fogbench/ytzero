import { useEffect, useMemo, useState } from "react";
import type { YtZeroApi } from "./api";
import { effectiveQueue, type PlaybackQueueContext } from "./playbackQueue";
import { useSessionQueueItems } from "./SessionQueue";
import type { TvProfileSettings, Video } from "./types";

export function usePlaybackSequence(api: YtZeroApi, video: Video, source: PlaybackQueueContext | null, settings: TvProfileSettings | null | undefined) {
  const items = useSessionQueueItems();
  const context = useMemo(() => effectiveQueue(video.video_id, source ?? video.playback_context ?? null, items), [video.video_id, video.playback_context, source, items]);
  const [adjacent, setAdjacent] = useState<{ key: string; next: Video | null; previous: Video | null; failed: boolean } | null>(null);
  const settingsPending = context?.kind !== "session" && settings === undefined;
  const direction = context?.kind === "session" || settings?.feed_autoplay_direction === "newest" ? "newest" : "oldest";
  const key = JSON.stringify([video.video_id, context, direction]);
  useEffect(() => {
    if (!context || settingsPending) return;
    let active = true;
    const resolve = async (relative: "next" | "previous") => {
      const result = await api.playbackAdjacent(video.video_id, direction, context, relative);
      if (!result.video_id) return null;
      return items.find((item) => item.video_id === result.video_id) ?? (await api.video(result.video_id)).video;
    };
    const supportsPrevious = context.kind === "session" || context.kind === "user-playlist" || context.kind === "channel-playlist";
    void Promise.allSettled([resolve("next"), supportsPrevious ? resolve("previous") : Promise.resolve(null)]).then(([next, previous]) => {
      if (active) setAdjacent({ key, next: next.status === "fulfilled" ? next.value : null, previous: previous.status === "fulfilled" ? previous.value : null, failed: next.status === "rejected" });
    });
    return () => { active = false; };
  }, [api, context, direction, items, key, settingsPending, video.video_id]);
  const next = !settingsPending && adjacent?.key === key ? adjacent.next : null;
  const previous = !settingsPending && adjacent?.key === key ? adjacent.previous : null;
  const queueVideos = useMemo(() => {
    if (context?.kind === "session") {
      const byId = new Map([video, ...items, ...(previous ? [previous] : []), ...(next ? [next] : [])].map((item) => [item.video_id, item]));
      return context.ids.flatMap((id) => byId.get(id) ? [byId.get(id)!] : []);
    }
    return [previous, video, next].filter((item): item is Video => item !== null);
  }, [context, items, next, previous, video]);
  return { context, next, previous, queueVideos, loading: Boolean(context && (settingsPending || adjacent?.key !== key)), failed: !settingsPending && adjacent?.key === key && adjacent.failed };
}
