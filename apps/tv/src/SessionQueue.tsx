import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { addQueueVideo, moveQueueVideo } from "./playbackQueue";
import type { Video } from "./types";

type QueueActions = { add: (video: Video) => void; remove: (id: string) => void; move: (id: string, delta: -1 | 1) => void; clear: () => void };
type Queue = QueueActions & { items: Video[] };
const QueueItemsContext = createContext<Video[] | null>(null);
const QueueActionsContext = createContext<QueueActions | null>(null);
/** In memory, cleared on instance/profile changes. Never backed up. */
export function SessionQueueProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Video[]>([]);
  const actions = useMemo(() => ({
    add: (video: Video) => setItems((current) => addQueueVideo(current, video)),
    remove: (id: string) => setItems((current) => current.filter((item) => item.video_id !== id)),
    move: (id: string, delta: -1 | 1) => setItems((current) => moveQueueVideo(current, id, delta)),
    clear: () => setItems((current) => current.length ? [] : current),
  }), []);
  return <QueueActionsContext.Provider value={actions}>
    <QueueItemsContext.Provider value={items}>{children}</QueueItemsContext.Provider>
  </QueueActionsContext.Provider>;
}
export function useSessionQueueItems() {
  const items = useContext(QueueItemsContext);
  if (!items) throw new Error("SessionQueueProvider is missing");
  return items;
}
export function useSessionQueueActions() {
  const actions = useContext(QueueActionsContext);
  if (!actions) throw new Error("SessionQueueProvider is missing");
  return actions;
}
export function useSessionQueue(): Queue {
  const items = useSessionQueueItems();
  const actions = useSessionQueueActions();
  return useMemo(() => ({ items, ...actions }), [actions, items]);
}
