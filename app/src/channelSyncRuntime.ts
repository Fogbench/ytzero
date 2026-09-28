import type { ChannelSyncMode } from "../../shared/channelSyncModes";
import { publishAppEvent, publishAppEventForUser } from "./appEvents";
import { createChannelSyncJobManager, type ChannelSyncJobTarget } from "./channelSyncJobs";
import { beginMutation } from "./maintenance";

type SyncChannel = (channelId: string, mode: ChannelSyncMode) => Promise<{ added: number; rateLimited?: boolean }>;

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// The worker is injected per profile rather than kept as one process-wide
// implementation: profiles run their jobs concurrently, and each worker carries
// its owner's identity (per-profile YouTube cookies and request language). One
// shared slot would re-point a running batch at whoever started a job last.
const syncChannelImplementations = new Map<number, SyncChannel>();
const channelSyncJobs = createChannelSyncJobManager({
  syncChannel: (channelId, mode, userId) => {
    const implementation = syncChannelImplementations.get(userId);
    if (!implementation) throw new Error("channel sync implementation unavailable");
    return implementation(channelId, mode);
  },
  beginMutation,
  publish: (userId) => publishAppEventForUser("channel-sync", userId),
  publishBusy: () => publishAppEvent("channel-sync"),
  sleep: (milliseconds) => Bun.sleep(milliseconds),
  delayMs: positiveNumber(process.env.CHANNEL_SYNC_BATCH_DELAY_MS, 5_000),
});

export function startChannelSyncJob(userId: number, targets: readonly ChannelSyncJobTarget[], syncChannel: SyncChannel) {
  const previousImplementation = syncChannelImplementations.get(userId);
  syncChannelImplementations.set(userId, syncChannel);
  try {
    return channelSyncJobs.start(userId, targets);
  } catch (error) {
    if (previousImplementation) syncChannelImplementations.set(userId, previousImplementation);
    else syncChannelImplementations.delete(userId);
    throw error;
  }
}

export function getChannelSyncJob(userId: number) {
  return channelSyncJobs.current(userId);
}

export function channelSyncJobIsRunning(): boolean {
  return channelSyncJobs.isRunning();
}
