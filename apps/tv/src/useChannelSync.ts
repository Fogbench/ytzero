import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import type { YtZeroApi } from "./api";
import { observeChannelSync, sameChannelSyncSnapshot } from "./channelSync";
import type { ChannelSyncSnapshot } from "./types";

export function useChannelSync(api: YtZeroApi, channelId: string, onFinished: () => Promise<void>) {
  const [snapshot, setSnapshot] = useState<ChannelSyncSnapshot | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [starting, setStarting] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const observer = useRef<ReturnType<typeof observeChannelSync> | null>(null);
  const current = useRef(onFinished);
  current.current = onFinished;
  const alive = useRef(false);
  const startLock = useRef(false);
  const completion = useRef(0);
  useEffect(() => {
    alive.current = true;
    const watch = observeChannelSync(() => api.channelSyncStatus(), channelId, (next) => {
      setStatusError(next === null);
      if (next) setSnapshot((previous) => sameChannelSyncSnapshot(previous, next, channelId) ? previous : next);
    }, (ok) => {
      const request = ++completion.current;
      setResult(null);
      void current.current().then(() => {
        if (alive.current && completion.current === request) setResult(ok ? "success" : "error");
      }).catch(() => { if (alive.current && completion.current === request) setResult("error"); });
    });
    observer.current = watch;
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") watch.refresh(); });
    return () => { alive.current = false; completion.current++; watch.dispose(); subscription.remove(); observer.current = null; };
  }, [api, channelId]);
  const start = useCallback(async () => {
    if (startLock.current || snapshot?.busy) return;
    startLock.current = true;
    completion.current++;
    setStarting(true);
    setResult(null);
    try {
      const result = await api.syncChannel(channelId);
      if (alive.current) observer.current?.started({ job: result.job, busy: result.job.status === "running" });
    } catch { if (alive.current) setResult("error"); }
    finally {
      startLock.current = false;
      if (alive.current) { setStarting(false); observer.current?.refresh(); }
    }
  }, [api, channelId, snapshot?.busy]);
  const working = starting || Boolean(snapshot?.job?.status === "running" && snapshot.job.channels.some((item) => item.channelId === channelId));
  return { working, busy: starting || snapshot?.busy, checking: snapshot === null, statusError, result, start, refresh: () => observer.current?.refresh() };
}
