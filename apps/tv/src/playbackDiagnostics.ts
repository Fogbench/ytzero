/** Technical console diagnostics, not UI copy. Never log a media URL or a raw error. */
export type PlaybackStage = "prepare" | "load" | "metadata" | "seek" | "present" | "playing" | "dismiss" | "renew" | "restriction" | "controls" | "closed";
export type NativePlaybackDiagnostics = {
  playerStatus: number;
  timeControlStatus: number;
  itemStatus?: number;
  bufferEmpty?: boolean;
  likelyToKeepUp?: boolean;
  hasTitle?: boolean;
  errors?: Array<{ domain: string; code: number }>;
  requestErrors?: Array<{ domain: string; code: number }>;
  stalls?: number;
  droppedFrames?: number;
};
const domains = new Set(["NSURLErrorDomain", "NSOSStatusErrorDomain", "AVFoundationErrorDomain", "CoreMediaErrorDomain", "CoreMediaErrorDomainError", "NSCocoaErrorDomain"]);

export function playbackDiagnostic(stage: PlaybackStage, cause?: unknown, native?: NativePlaybackDiagnostics | null) {
  const value: Record<string, unknown> = { stage };
  // Native and API error messages can contain URLs, tickets, paths and headers.
  // Keep only an HTTP status and a bounded classification, never arbitrary text.
  if (cause && typeof cause === "object") {
    const error = cause as { status?: unknown; message?: unknown; name?: unknown };
    if (typeof error.status === "number" && Number.isInteger(error.status) && error.status >= 100 && error.status <= 599) value.httpStatus = error.status;
    const message = typeof error.message === "string" ? error.message : "";
    value.cause = error.name === "AbortError" ? "cancelled"
      : /timed?\s*out|timeout/i.test(message) ? "timeout"
      : /network|offline|connection/i.test(message) ? "network"
      : /decode|codec|unsupported|not supported/i.test(message) ? "unsupported-media"
      : "error";
  }
  if (native) {
    for (const key of ["playerStatus", "timeControlStatus", "itemStatus", "stalls", "droppedFrames"] as const) {
      if (Number.isFinite(native[key])) value[key] = native[key];
    }
    for (const key of ["bufferEmpty", "likelyToKeepUp", "hasTitle"] as const) {
      if (typeof native[key] === "boolean") value[key] = native[key];
    }
    for (const key of ["errors", "requestErrors"] as const) {
      value[key] = native[key]?.slice(-4).filter((entry) => Number.isInteger(entry.code)).map((entry) => ({
        domain: domains.has(entry.domain) ? entry.domain : "other", code: entry.code,
      })) ?? [];
    }
  }
  return value;
}
