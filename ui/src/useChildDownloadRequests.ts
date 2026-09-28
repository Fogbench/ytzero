import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type ChildDownloadRequest } from "./api";
import { subscribeServerEvent } from "./serverEvents";

/** "pin" is the one failure an approval dialog can recover from. */
export type ChildDownloadResolveOutcome = "ok" | "pin" | "failed";

export interface ChildDownloadRequestsState {
  requests: ChildDownloadRequest[];
  history: ChildDownloadRequest[];
  /** Whether this profile keeps the child-activity shortcut on screen. */
  monitorVisible: boolean;
  resolve: (request: ChildDownloadRequest, action: "approve" | "deny", pin?: string) => Promise<ChildDownloadResolveOutcome>;
  reload: () => void;
}

/**
 * Pending download requests from child profiles plus the recent decisions.
 * Shared by the child-activity shortcut and its home-feed fallback so both
 * surfaces answer to the same server state and resolve requests identically.
 */
export function useChildDownloadRequests(): ChildDownloadRequestsState {
  const [requests, setRequests] = useState<ChildDownloadRequest[]>([]);
  const [history, setHistory] = useState<ChildDownloadRequest[]>([]);
  const [monitorVisible, setMonitorVisible] = useState(true);
  /** Videos on the list, so unrelated downloads do not cause a refetch. */
  const trackedVideos = useRef(new Set<string>());

  const reload = useCallback(() => {
    api.childDownloadRequests()
      .then((result) => {
        setRequests(result.requests);
        setHistory(result.history);
        setMonitorVisible(result.monitor_visible);
        trackedVideos.current = new Set([...result.requests, ...result.history].map((request) => request.video_id));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    reload();
    const stopRequests = subscribeServerEvent("child-requests", reload);
    // A granted request shows how its download is going, so the file finishing
    // has to refresh the list as well — but only for the videos on it.
    const stopDownloads = subscribeServerEvent("downloads", (data) => {
      const videoId = typeof data?.videoId === "string" ? data.videoId : null;
      if (videoId && trackedVideos.current.has(videoId)) reload();
    });
    return () => { stopRequests(); stopDownloads(); };
  }, [reload]);

  const resolve = useCallback(async (request: ChildDownloadRequest, action: "approve" | "deny", pin?: string): Promise<ChildDownloadResolveOutcome> => {
    try {
      await api.resolveChildDownloadRequest(request.id, action, pin);
      reload();
      return "ok";
    } catch (error) {
      reload();
      return error instanceof ApiError && error.status === 401 ? "pin" : "failed";
    }
  }, [reload]);

  return { requests, history, monitorVisible, resolve, reload };
}
