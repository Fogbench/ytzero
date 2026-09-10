import type { ChannelSyncSnapshot } from "./types";

/** One request at a time; a failed status read never repeats the sync mutation. */
export function observeChannelSync(
  read: () => Promise<ChannelSyncSnapshot>,
  channelId: string,
  onSnapshot: (snapshot: ChannelSyncSnapshot | null) => void,
  onFinished: (ok: boolean) => void,
  schedule: (run: () => void, delay: number) => () => void = (run, delay) => {
    const timer = setTimeout(run, delay);
    return () => clearTimeout(timer);
  },
) {
  let disposed = false;
  let reading = false;
  let requested = false;
  let cancelTimer: (() => void) | undefined;
  const finished = new Set<string>();
  let initial = true;
  let revision = 0;
  let activeJob: string | null = null;
  let nextDelay = 15_000;
  const accept = (snapshot: ChannelSyncSnapshot) => {
    onSnapshot(snapshot);
    nextDelay = snapshot.busy ? 2_000 : 15_000;
    const item = snapshot.job?.channels.find((item) => item.channelId === channelId);
    if (activeJob && activeJob !== snapshot.job?.id) {
      // A restart or a newer job may replace the terminal snapshot before a poll.
      onFinished(false);
      activeJob = null;
    }
    if (snapshot.job && item) {
      if (snapshot.job.status === "running") activeJob = snapshot.job.id;
      else if (!finished.has(snapshot.job.id)) {
        activeJob = null;
        finished.add(snapshot.job.id);
        if (!initial) onFinished(item.status === "completed");
      }
    }
    initial = false;
  };
  const poll = async () => {
    cancelTimer?.();
    if (disposed) return;
    if (reading) { requested = true; return; }
    reading = true;
    const requestRevision = revision;
    try {
      const snapshot = await read();
      if (disposed || requestRevision !== revision) return;
      accept(snapshot);
    } catch {
      if (!disposed && requestRevision === revision) {
        nextDelay = 5_000;
        onSnapshot(null);
      }
    }
    finally {
      reading = false;
      if (!disposed) {
        if (requested) { requested = false; void poll(); }
        else cancelTimer = schedule(() => { void poll(); }, nextDelay);
      }
    }
  };
  void poll();
  return {
    refresh: () => { void poll(); },
    started: (snapshot: ChannelSyncSnapshot) => {
      if (disposed) return;
      revision++;
      initial = false;
      accept(snapshot);
      void poll();
    },
    dispose: () => { disposed = true; cancelTimer?.(); },
  };
}

/** Ignore polling snapshots that cannot change this channel's controls. */
export function sameChannelSyncSnapshot(
  previous: ChannelSyncSnapshot | null,
  next: ChannelSyncSnapshot,
  channelId: string,
): boolean {
  if (!previous || previous.busy !== next.busy || previous.job?.id !== next.job?.id || previous.job?.status !== next.job?.status) return false;
  const previousChannel = previous.job?.channels.find((item) => item.channelId === channelId);
  const nextChannel = next.job?.channels.find((item) => item.channelId === channelId);
  return previousChannel?.status === nextChannel?.status && previousChannel?.added === nextChannel?.added;
}
