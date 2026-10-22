import { describe, expect, test } from "bun:test";
import { resolvePlayerKind, shouldFallbackToDirectStream, shouldLatchCompletedDownload } from "./watchPlayerMode";

const base = {
  hasVideo: true,
  isLive: false,
  downloadStatus: null,
  playerSource: "auto" as const,
  defaultPlayer: "youtube" as const,
  directFallback: false,
  playbackPolicyReady: true,
  childDownloadsOnly: false,
  sourceChoice: "undecided" as const,
  watchMode: "youtube" as const,
  streamingEnabled: false,
  keepStreamingAfterDownload: false,
};

describe("resolvePlayerKind", () => {
  describe("direct player never yields to the embed on its own", () => {
    const direct = { ...base, defaultPlayer: "direct" as const };

    test("plays direct when the video row is there", () => {
      expect(resolvePlayerKind(direct)).toBe("direct");
    });

    test("waits for a video that is still being imported instead of mounting the embed", () => {
      expect(resolvePlayerKind({ ...direct, hasVideo: false })).toBe("loading");
    });

    test("shows the direct failure (not the embed) when the video cannot be loaded", () => {
      expect(resolvePlayerKind({ ...direct, hasVideo: false, videoLoadFailed: true })).toBe("direct");
    });

    test("uses the embed only when asked for", () => {
      expect(resolvePlayerKind({ ...direct, hasVideo: false, playerSource: "youtube" })).toBe("youtube");
      expect(resolvePlayerKind({ ...direct, playerSource: "youtube" })).toBe("youtube");
      expect(resolvePlayerKind({ ...base, hasVideo: false })).toBe("youtube");
    });
  });

  test("does not mount YouTube before the download policy is loaded", () => {
    expect(resolvePlayerKind({ ...base, playbackPolicyReady: false })).toBe("loading");
  });

  test("shows the source choice when ask mode is ready", () => {
    expect(resolvePlayerKind({ ...base, watchMode: "ask" })).toBe("choice");
  });

  test("honors each choice made in ask mode", () => {
    expect(resolvePlayerKind({ ...base, watchMode: "ask", sourceChoice: "remote" })).toBe("youtube");
    expect(resolvePlayerKind({ ...base, watchMode: "ask", sourceChoice: "wait" })).toBe("waiting");
  });

  test("plays an existing local file without waiting for policy requests", () => {
    expect(resolvePlayerKind({ ...base, downloadStatus: "done", playbackPolicyReady: false })).toBe("local");
  });

  test("always uses YouTube for a live or upcoming stream", () => {
    expect(resolvePlayerKind({ ...base, isLive: true, downloadStatus: "done", watchMode: "download" })).toBe("youtube");
  });

  test("plays TubeArchivist media as a local source, including downloads-only profiles", () => {
    expect(resolvePlayerKind({ ...base, localMediaSource: "tubearchivist" })).toBe("local");
    expect(resolvePlayerKind({ ...base, localMediaSource: "tubearchivist", childDownloadsOnly: true })).toBe("local");
    expect(resolvePlayerKind({ ...base, localMediaSource: "tubearchivist", playerSource: "youtube" })).toBe("youtube");
  });

  describe("experimental streaming", () => {
    test("streams a not-yet-downloaded video when enabled", () => {
      expect(resolvePlayerKind({ ...base, streamingEnabled: true })).toBe("stream");
    });

    test("shows loading while the streamable video's library row is being imported", () => {
      expect(resolvePlayerKind({ ...base, hasVideo: false, streamingEnabled: true })).toBe("loading");
    });

    test("keeps YouTube for a missing video when streaming cannot take over", () => {
      expect(resolvePlayerKind({ ...base, hasVideo: false })).toBe("youtube");
      expect(resolvePlayerKind({ ...base, hasVideo: false, streamingEnabled: true, playerSource: "youtube" })).toBe("youtube");
      expect(resolvePlayerKind({ ...base, hasVideo: false, streamingEnabled: true, sourceChoice: "remote" })).toBe("youtube");
      expect(resolvePlayerKind({ ...base, hasVideo: false, streamingEnabled: true, defaultPlayer: "direct" })).toBe("loading");
    });

    test("prefers streaming over the wait/ask panels", () => {
      expect(resolvePlayerKind({ ...base, streamingEnabled: true, watchMode: "download" })).toBe("stream");
      expect(resolvePlayerKind({ ...base, streamingEnabled: true, watchMode: "ask" })).toBe("stream");
    });

    test("still plays a finished local file instead of re-streaming", () => {
      expect(resolvePlayerKind({ ...base, streamingEnabled: true, downloadStatus: "done" })).toBe("local");
    });

    test("never streams a live broadcast", () => {
      expect(resolvePlayerKind({ ...base, streamingEnabled: true, isLive: true })).toBe("youtube");
    });

    test("lets the viewer fall back to YouTube", () => {
      expect(resolvePlayerKind({ ...base, streamingEnabled: true, playerSource: "youtube" })).toBe("youtube");
      expect(resolvePlayerKind({ ...base, streamingEnabled: true, sourceChoice: "remote" })).toBe("youtube");
    });

    test("does not stream for a downloads-only child profile", () => {
      expect(resolvePlayerKind({ ...base, streamingEnabled: true, childDownloadsOnly: true })).toBe("blocked");
    });

    test("hands off to the local player once the background download finishes", () => {
      expect(resolvePlayerKind({ ...base, streamingEnabled: true, downloadStatus: "done" })).toBe("local");
    });

    test("keeps an active stream mounted until the viewer accepts the finished local file", () => {
      expect(resolvePlayerKind({ ...base, streamingEnabled: true, downloadStatus: "done", keepStreamingAfterDownload: true })).toBe("stream");
      expect(resolvePlayerKind({ ...base, streamingEnabled: true, downloadStatus: "done", keepStreamingAfterDownload: true, playerSource: "youtube" })).toBe("youtube");
    });

    test("keeps streaming while the download is still in progress", () => {
      expect(resolvePlayerKind({ ...base, streamingEnabled: true, downloadStatus: "downloading" })).toBe("stream");
    });
  });

});

describe("direct streaming", () => {
  test("uses the direct player when it is the remote default and never for live video", () => {
    expect(resolvePlayerKind({ ...base, defaultPlayer: "direct" })).toBe("direct");
    expect(resolvePlayerKind({ ...base, defaultPlayer: "direct", isLive: true })).toBe("youtube");
  });

  test("falls back once from the embed only for its unavailable/embed-disabled errors", () => {
    expect(resolvePlayerKind({ ...base, directFallback: true })).toBe("direct");
    expect(shouldFallbackToDirectStream(100)).toBe(true);
    expect(shouldFallbackToDirectStream(101)).toBe(true);
    expect(shouldFallbackToDirectStream(150)).toBe(true);
    expect(shouldFallbackToDirectStream(153)).toBe(false);
  });

  test("direct preference takes precedence over experimental downloading", () => {
    expect(resolvePlayerKind({ ...base, defaultPlayer: "direct", streamingEnabled: true })).toBe("direct");
  });
});

describe("shouldLatchCompletedDownload", () => {
  test("latches every completion observed by an active stream", () => {
    expect(shouldLatchCompletedDownload("stream", null, "done")).toBe(true);
    expect(shouldLatchCompletedDownload("stream", "error", "done")).toBe(true);
    expect(shouldLatchCompletedDownload("stream", "downloading", "done")).toBe(true);
  });

  test("only announces a YouTube background download that was already in progress", () => {
    expect(shouldLatchCompletedDownload("youtube", "downloading", "done")).toBe(true);
    expect(shouldLatchCompletedDownload("youtube", null, "done")).toBe(false);
    expect(shouldLatchCompletedDownload("local", "downloading", "done")).toBe(false);
    expect(shouldLatchCompletedDownload("stream", "downloading", "error")).toBe(false);
  });
});
