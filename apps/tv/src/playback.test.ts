import { describe, expect, test } from "bun:test";
import { PlaybackProgress, playbackTime, resumePosition, validPlaybackPosition } from "./playback";
import { YtZeroApi } from "./api";

describe("TV playback", () => {
  test("accepts a scoped live HLS source without forwarding the API bearer", () => {
    const api = new YtZeroApi("https://tv.example", "private-session");
    const ticket = { ticket: "short", url: "/api/videos/live/live-hls/index.m3u8?media_ticket=short", content_type: "hls" as const, expires_in: 900 };
    expect(api.playbackSource(ticket)).toEqual({ uri: `https://tv.example${ticket.url}`, contentType: "hls" });
    expect(JSON.stringify(api.playbackSource(ticket))).not.toContain("private-session");
    expect(() => api.playbackSource({ ...ticket, url: "https://other.example" + ticket.url })).toThrow();
    expect(() => api.playbackSource({ ...ticket, content_type: "progressive" })).toThrow();
  });
  test("resumes actual progress, but restarts finished, invalid and nearly finished videos", () => {
    expect(resumePosition(90, 600)).toBe(90);
    for (const value of [null, -5, NaN, Infinity, 3, 599]) expect(resumePosition(value, 600)).toBe(0);
    expect(resumePosition(90, 600, 1)).toBe(0);
    expect(playbackTime(3661)).toBe("1:01:01");
    expect(playbackTime(NaN)).toBe("0:00");
    expect(validPlaybackPosition({ position: 9, duration: Infinity })).toBe(false);
  });

  test("serializes heartbeats and final state; never writes after completing", async () => {
    const events: string[] = [];
    const progress = new PlaybackProgress(true, async ({ position }) => { events.push(`save:${position}`); }, async () => { events.push("complete"); });
    progress.update({ position: 5, duration: 10 });
    await progress.finish({ position: 10, duration: 10 }, true);
    progress.update({ position: 6, duration: 10 });
    await progress.finish({ position: 10, duration: 10 }, true);
    expect(events).toEqual(["save:5", "save:10", "complete"]);
  });

  test("incognito suppresses every progress/history mutation, including exit and completion", async () => {
    let writes = 0;
    const progress = new PlaybackProgress(false, async () => { writes++; }, async () => { writes++; });
    progress.update({ position: 5, duration: 10 });
    expect(await progress.finish({ position: 10, duration: 10 }, true)).toBe(false);
    expect(writes).toBe(0);
  });

  test("coalesces slow heartbeats while preserving the final position", async () => {
    const writes: number[] = [];
    let unblock!: () => void;
    const blocked = new Promise<void>((resolve) => { unblock = resolve; });
    const progress = new PlaybackProgress(true, async ({ position }) => {
      writes.push(position);
      if (writes.length === 1) await blocked;
    }, async () => { writes.push(-1); });
    for (const position of [5, 10, 15, 20]) progress.update({ position, duration: 30 });
    const finished = progress.finish({ position: 30, duration: 30 }, true);
    unblock();
    await finished;
    expect(writes).toEqual([5, 30, -1]);
  });

  test("playback API works with React Native AbortSignal without static timeout", async () => {
    const originalFetch = globalThis.fetch;
    const timeout = Object.getOwnPropertyDescriptor(AbortSignal, "timeout");
    const requests: RequestInit[] = [];
    Object.defineProperty(AbortSignal, "timeout", { configurable: true, value: undefined });
    globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
      requests.push(init);
      return new Response(JSON.stringify({ ok: true }));
    }) as unknown as typeof fetch;
    try {
      const api = new YtZeroApi("https://tv.example", "session");
      await api.savePlaybackProgress("v", { position: 20, duration: 60 });
      await api.markWatched("v");
      await api.renewPlaybackTicket("v", "media");
      await api.releasePlaybackTicket("v", "media");
      await api.playbackRestriction();
      expect(requests).toHaveLength(5);
      for (const request of requests) {
        expect(request.signal).toBeInstanceOf(AbortSignal);
        expect(request.signal?.aborted).toBe(false);
      }
    } finally {
      globalThis.fetch = originalFetch;
      if (timeout) Object.defineProperty(AbortSignal, "timeout", timeout);
    }
  });

  test("failed start does not erase saved progress, and network failures are reported", async () => {
    let writes = 0;
    const progress = new PlaybackProgress(true, async () => { writes++; throw new Error("offline"); }, async () => {});
    await progress.finish({ position: 0, duration: 0 }, false);
    expect(writes).toBe(0);
    const offline = new PlaybackProgress(true, async () => { throw new Error("offline"); }, async () => {});
    expect(await offline.finish({ position: 20, duration: 90 }, false)).toBe(true);
  });

  test("cancels waiting for a compatible file without issuing more tickets", async () => {
    const originalFetch = globalThis.fetch;
    const controller = new AbortController();
    let requests = 0;
    globalThis.fetch = (async () => {
      requests++;
      return new Response(JSON.stringify({ preparing: true }), { status: 202 });
    }) as unknown as typeof fetch;
    try {
      const pending = new YtZeroApi("https://tv.example", "session").playbackTicket("v", controller.signal);
      controller.abort();
      await expect(pending).rejects.toThrow("playback cancelled");
      expect(requests).toBe(1);
    } finally { globalThis.fetch = originalFetch; }
  });

  test("native player sources contain only the short media ticket and stay on the chosen instance", () => {
    const api = new YtZeroApi("https://tv.example", "long-lived-bearer");
    const ticket = { ticket: "short", url: "/api/videos/v/stream?media_ticket=short", content_type: "progressive" as const, expires_in: 900 };
    expect(api.playbackSource(ticket)).toEqual({ uri: "https://tv.example/api/videos/v/stream?media_ticket=short", contentType: "progressive" });
    expect(JSON.stringify(api.playbackSource(ticket))).not.toContain(api.accessToken!);
    for (const url of ["https://external.example/api/videos/v/stream?media_ticket=short", "/api/settings", "/api/videos/v/stream?media_ticket=wrong"]) {
      expect(() => api.playbackSource({ ...ticket, url })).toThrow();
    }
  });

  test("undownloaded videos use native HLS with a ticket and no API bearer", async () => {
    const originalFetch = globalThis.fetch;
    const api = new YtZeroApi("https://tv.example", "long-lived-bearer");
    const ticket = { ticket: "short", url: "/api/videos/v/direct-hls/index.m3u8?media_ticket=short", content_type: "hls" as const, expires_in: 900 };
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      expect(url).toBe("https://tv.example/api/videos/v/playback-ticket");
      expect(init.method).toBe("POST");
      expect(new Headers(init.headers).get("Authorization")).toBe(`Bearer ${api.accessToken}`);
      return Response.json(ticket);
    }) as typeof fetch;
    try {
      const source = api.playbackSource(await api.playbackTicket("v"));
      expect(source).toEqual({ uri: `https://tv.example${ticket.url}`, contentType: "hls" });
      expect(source).not.toHaveProperty("headers");
      expect(JSON.stringify(source)).not.toContain(api.accessToken!);
      expect(() => api.playbackSource({ ...ticket, content_type: "progressive" })).toThrow();
      for (const path of ["stream", "download", "direct-stream", "direct-hls/video.mp4"]) {
        expect(() => api.playbackSource({ ...ticket, url: `/api/videos/v/${path}?media_ticket=short` })).toThrow();
      }
    } finally { globalThis.fetch = originalFetch; }
  });
});
