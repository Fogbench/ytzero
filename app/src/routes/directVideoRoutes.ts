import type { Context, Hono } from "hono";
import { database } from "../database";
import { isChildUser } from "../childTime";
import { ytdlpStatus } from "../downloadConfig";
import { dlSettings, profileDownloadsEnabled } from "../downloadSettingsStore";
import { directVideoStreaming } from "../directVideoStreaming";
import { DIRECT_QUALITY_PATTERN } from "../downloadVideoDirectStreaming";

type ApiEnvironment = { Variables: { userId: number; sessionAdmin?: boolean; profileAdmin?: boolean } };
type VideoState = { live_status: string; members_only: number; is_private: number; is_unavailable: number };

/** Mirrors the watch page: the embed preference, or a download-first watch mode, never opens the direct player. */
async function opensDirectPlayer(userId: number): Promise<boolean> {
  const settings = await dlSettings(userId);
  if (settings.default_player === "youtube") return false;
  if (!["ask", "download"].includes(String(settings.watch_source_mode))) return true;
  return !await profileDownloadsEnabled(userId);
}

export function registerDirectVideoRoutes(
  api: Hono<ApiEnvironment>,
  currentUserId: (context: Context<ApiEnvironment>) => number,
): void {
  /** Shared checks for every direct-stream request; a Response means refused. */
  async function refusal(context: Context<ApiEnvironment>, userId: number, videoId: string): Promise<Response | null> {
    if (await isChildUser(userId)) return context.json({ error: "not allowed" }, 403);
    const video = await database.prepare(
      "SELECT live_status, members_only, is_private, is_unavailable FROM videos WHERE video_id = ?",
    ).get<VideoState>(videoId);
    if (!video) return context.json({ error: "not found" }, 404);
    if (video.is_private || video.is_unavailable || video.members_only || ["live", "upcoming"].includes(video.live_status)) {
      return context.json({ error: "direct stream unavailable" }, 409);
    }
    // Streaming is independent of the offline-download feature and its
    // experimental play-while-downloading preference.
    if (!await ytdlpStatus()) return context.json({ error: "yt-dlp unavailable" }, 503);
    return null;
  }

  // Warm the yt-dlp lookup (watch page opened, card hovered) so the player's
  // first request finds it cached or in flight. Answers at once; the lookup
  // runs without the request's signal so a disconnect does not cancel it.
  // Fired blindly by the UI, so anything that would not open the direct
  // player answers 204 (nothing to do) rather than an error.
  api.post("/videos/:id/direct-hls/prefetch", async (context) => {
    const userId = currentUserId(context);
    const videoId = context.req.param("id");
    if (await refusal(context, userId, videoId)) return context.body(null, 204);
    if (!await opensDirectPlayer(userId)) return context.body(null, 204);
    void directVideoStreaming.prefetchDirectSources(userId, videoId).catch(() => {});
    return context.json({ ok: true }, 202);
  });

  api.get("/videos/:id/direct-hls/:file", async (context) => {
    const userId = currentUserId(context);
    const videoId = context.req.param("id");
    const file = context.req.param("file");
    if (!["index.m3u8", "video.m3u8", "audio.m3u8", "video.mp4", "audio.mp4", "qualities.json"].includes(file)) {
      return context.json({ error: "not found" }, 404);
    }
    const refused = await refusal(context, userId, videoId);
    if (refused) return refused;
    const signal = context.req.raw.signal;
    const generation = context.req.query("v") ?? null;
    if (file === "qualities.json") {
      const result = await directVideoStreaming.getDirectQualities(userId, videoId, signal);
      if (result.kind === "qualities") return context.json({ qualities: result.qualities, audioTracks: result.audioTracks });
      return context.json({ error: "direct stream unavailable" }, 502);
    }
    const choice = context.req.query("q") ?? null;
    if (choice !== null && !DIRECT_QUALITY_PATTERN.test(choice)) return context.json({ error: "bad quality" }, 400);
    if (file === "video.mp4" || file === "audio.mp4") {
      const result = await directVideoStreaming.getDirectHlsResource(
        userId, videoId, file, context.req.header("range") ?? null, signal, generation,
      );
      if (result.kind === "response") return result.response;
      if (result.kind === "stale") return context.json({ error: "stream changed; reload the playlist" }, 410);
      return context.json({ error: "direct stream unavailable" }, result.kind === "not_found" ? 404 : 502);
    }
    const result = await directVideoStreaming.getDirectHlsPlaylist(
      userId, videoId, file as "index.m3u8" | "video.m3u8" | "audio.m3u8", signal, generation, choice,
    );
    if (result.kind === "playlist") return new Response(result.playlist, {
      headers: { "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-store" },
    });
    if (result.kind === "stale") return context.json({ error: "stream changed; reload the playlist" }, 410);
    return context.json({ error: "direct stream unavailable" }, result.kind === "unsupported" ? 404 : 502);
  });
}
