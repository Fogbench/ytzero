import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { addQueueVideo, moveQueueVideo } from "./playbackQueue";
import type { Video } from "./types";

type Queue = { items: Video[]; add: (video: Video) => void; remove: (id: string) => void; move: (id: string, delta: -1 | 1) => void; clear: () => void };
const QueueContext = createContext<Queue | null>(null);
/** In memory, cleared on instance/profile changes. Never backed up. */
export function SessionQueueProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Video[]>([]);
  const actions = useMemo(() => ({
    add: (video: Video) => setItems((current) => addQueueVideo(current, video)),
    remove: (id: string) => setItems((current) => current.filter((item) => item.video_id !== id)),
    move: (id: string, delta: -1 | 1) => setItems((current) => moveQueueVideo(current, id, delta)),
    clear: () => setItems([]),
  }), []);
  return <QueueContext.Provider value={{ items, ...actions }}>{children}</QueueContext.Provider>;
}
export function useSessionQueue() {
  const queue = useContext(QueueContext);
  if (!queue) throw new Error("SessionQueueProvider is missing");
  return queue;
}
