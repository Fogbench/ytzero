import { NativeModule, requireNativeModule } from "expo";
import type { VideoPlayer } from "expo-video";
import type { PlayerQueue } from "./playerQueueControl";

type QueueEvent = { videoId: string; currentId: string; action?: "details" };
declare class QueueControl extends NativeModule<{ queueSelection: (event: QueueEvent) => void }> {
  setQueue(player: VideoPlayer, currentId: string, nextId: string, previousId: string, items: PlayerQueue["items"], labels: PlayerQueue["labels"]): Promise<boolean>;
  clearQueue(player: VideoPlayer): Promise<void>;
  setShortsNavigation?(player: VideoPlayer, currentId: string, nextId: string, previousId: string): Promise<boolean>;
  enableShortsNavigation?(player: VideoPlayer, enabled: boolean): Promise<void>;
}
const control = requireNativeModule<QueueControl>("YtZeroPlayerControl");
let pendingUpdate = Promise.resolve();
export const updatePlayerQueue = (player: VideoPlayer, queue: PlayerQueue): Promise<boolean> => {
  const update = pendingUpdate.then(async () => {
    if (!await control.setQueue(player, queue.currentId, queue.nextId, queue.previousId, queue.items, queue.labels)) return false;
    // Older development clients can still use the transport menu until rebuilt.
    const installed = await control.setShortsNavigation?.(player, queue.currentId, queue.shorts.nextId, queue.shorts.previousId) ?? true;
    await control.enableShortsNavigation?.(player, queue.navigationEnabled);
    return installed;
  });
  // An old, partially completed menu update must not re-enable input after a
  // newer update has disabled it for source replacement.
  pendingUpdate = update.then(() => {}, () => {});
  return update;
};
export const clearPlayerQueue = (player: VideoPlayer) => control.clearQueue(player);
export const subscribePlayerQueue = (callback: (event: QueueEvent) => void) => control.addListener("queueSelection", callback);
