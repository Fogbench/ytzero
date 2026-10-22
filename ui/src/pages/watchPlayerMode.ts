export type WatchSourceMode = "youtube" | "ask" | "download";
export type SourceChoice = "undecided" | "remote" | "wait";
export type PlayerKind = "loading" | "local" | "youtube" | "direct" | "blocked" | "choice" | "waiting" | "stream";

export function shouldFallbackToDirectStream(errorCode: number | null): boolean {
  return errorCode === 100 || errorCode === 101 || errorCode === 150;
}

export function shouldLatchCompletedDownload(
  playerKind: PlayerKind,
  previousStatus: string | null,
  nextStatus: string | null,
): boolean {
  if (nextStatus !== "done") return false;
  if (playerKind === "stream") return true;
  return playerKind === "youtube" && (previousStatus === "queued" || previousStatus === "downloading");
}

export function resolvePlayerKind(input: {
  hasVideo: boolean;
  isLive: boolean;
  downloadStatus: string | null;
  localMediaSource?: "download" | "tubearchivist" | null;
  playerSource: "auto" | "youtube";
  defaultPlayer: "youtube" | "direct";
  directFallback: boolean;
  /** The video's library row could not be loaded or imported. */
  videoLoadFailed?: boolean;
  playbackPolicyReady: boolean;
  childDownloadsOnly: boolean;
  sourceChoice: SourceChoice;
  watchMode: WatchSourceMode;
  streamingEnabled: boolean;
  keepStreamingAfterDownload: boolean;
}): PlayerKind {
  const remoteForcedToYouTube = input.playerSource === "youtube";
  const wantsRemote = input.sourceChoice === "remote" || input.watchMode === "youtube";
  const streamEligible = input.streamingEnabled && input.defaultPlayer !== "direct" && !input.directFallback && !remoteForcedToYouTube && input.sourceChoice !== "remote";
  const canStream = input.hasVideo && streamEligible;
  // A stream is not a stable local file. Even if an old download row exists,
  // always use YouTube while the broadcast is live or scheduled.
  if (input.hasVideo && input.isLive) return "youtube";
  // Finishing the background download must not tear down a stream that is
  // already playing. The viewer explicitly hands off to the local file.
  if (canStream && input.keepStreamingAfterDownload && input.downloadStatus === "done") return "stream";
  // The fast background download finished: switch to the local file, which
  // seeks natively and perfectly (the streaming path hands off to it here).
  if (input.hasVideo && (input.downloadStatus === "done" || input.localMediaSource === "tubearchivist") && input.playerSource === "auto") return "local";
  if (!input.playbackPolicyReady) return "loading";
  // An external video is being imported. Do not mount the YouTube iframe in
  // the short gap before its library row arrives: it can only claim that the
  // video is unavailable, while streaming will take over as soon as it does.
  if (!input.hasVideo && streamEligible) return "loading";
  // Same for the direct player: wait for the library row instead of showing
  // the YouTube embed meanwhile. If the row never arrives, "direct" without a
  // video shows the "Direct playback failed" panel, never the embed.
  const wantsDirect = input.defaultPlayer === "direct" && !remoteForcedToYouTube && input.sourceChoice !== "remote";
  if (!input.hasVideo && wantsDirect) return input.videoLoadFailed ? "direct" : "loading";
  if (input.hasVideo && input.childDownloadsOnly) return "blocked";
  // Experimental: play-while-downloading. Holds the stream while the file is
  // still downloading; the viewer can still fall back to YouTube (which flips
  // sourceChoice / playerSource and skips this branch).
  if (canStream) return "stream";
  if (input.hasVideo && input.sourceChoice === "wait") return "waiting";
  if (input.hasVideo && input.watchMode === "download" && input.sourceChoice !== "remote") return "waiting";
  if (input.hasVideo && input.watchMode === "ask" && input.sourceChoice === "undecided") return "choice";
  if (input.hasVideo && !remoteForcedToYouTube && (input.directFallback || (wantsRemote && input.defaultPlayer === "direct"))) return "direct";
  return "youtube";
}
