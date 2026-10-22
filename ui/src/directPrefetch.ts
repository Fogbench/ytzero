import { api } from "./api";

/**
 * Warms the server's yt-dlp lookup for the direct player before it asks: at
 * once when the watch page opens, after a short hover on a video card. The
 * server shares and caches the lookup; this only avoids redundant requests.
 */
export function createDirectPrefetcher(
  send: (videoId: string) => Promise<unknown>,
  { hoverDelayMs = 300, repeatAfterMs = 5 * 60_000 }: { hoverDelayMs?: number; repeatAfterMs?: number } = {},
) {
  const sentAt = new Map<string, number>();
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let hoverTarget: string | null = null;
  let hoverInFlight = false;

  function fire(videoId: string): Promise<void> | null {
    const last = sentAt.get(videoId);
    if (last != null && Date.now() - last < repeatAfterMs) return null;
    sentAt.set(videoId, Date.now());
    return send(videoId).then(() => {}, () => { sentAt.delete(videoId); });
  }

  function now(videoId: string): void {
    void fire(videoId);
  }

  function hover(videoId: string): void {
    if (hoverTimer != null) clearTimeout(hoverTimer);
    hoverTarget = videoId;
    hoverTimer = setTimeout(() => {
      hoverTimer = null;
      hoverTarget = null;
      // Sweeping the pointer across a grid must not queue one lookup per card.
      if (hoverInFlight) return;
      const request = fire(videoId);
      if (!request) return;
      hoverInFlight = true;
      void request.finally(() => { hoverInFlight = false; });
    }, hoverDelayMs);
  }

  function cancelHover(videoId: string): void {
    if (hoverTarget !== videoId || hoverTimer == null) return;
    clearTimeout(hoverTimer);
    hoverTimer = null;
    hoverTarget = null;
  }

  return { now, hover, cancelHover };
}

export const directPrefetch = createDirectPrefetcher((videoId) => api.prefetchDirect(videoId));
