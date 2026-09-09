import type { Context, Next } from "hono";
import { existsSync } from "node:fs";
import { validateSession } from "./auth";
import { childStatus } from "./childTime";
import { database } from "./database";
import { getDownload, liveStreamEnabled, ytdlpStatus } from "./downloader";
import { authorizeHlsPlaylist, MediaTicketStore, ticketAllowsPath, type NativeMediaKind } from "./mediaTickets";
import { tubeArchivistConfigured } from "./tubeArchivist";

export const mediaTickets = new MediaTicketStore();

export async function nativePlaybackAccess(userId: number, videoId: string) {
  const video = await database.prepare("SELECT live_status, is_short, external, members_only FROM videos WHERE video_id=?")
    .get<{ live_status: string; is_short: number; external: number; members_only: number }>(videoId);
  if (!video) return { error: "not found", status: 404 as const };
  const child = await childStatus(userId);
  if (child.locked || (child.is_child && (
    (child.hide_shorts && video.is_short === 1) ||
    (child.hide_live && ["live", "upcoming"].includes(video.live_status)) ||
    (child.local_only && video.external === 1)
  ))) return { error: "playback restricted", status: 403 as const };
  return { video, child };
}

export async function nativePlaybackSource(userId: number, videoId: string): Promise<
  { kind: NativeMediaKind } | { error: string; status: 403 | 404 | 409 | 503 }
> {
  const access = await nativePlaybackAccess(userId, videoId);
  if ("error" in access) return access;
  const download = await getDownload(userId, videoId);
  const local = download?.status === "done" && download.path && existsSync(download.path);
  const archived = tubeArchivistConfigured() && await database.prepare(
    "SELECT 1 FROM tube_archivist_items WHERE video_id=? AND available=1"
  ).get(videoId);
  if (local || archived) return { kind: "file" };
  // Server streaming routes disallow child profiles; keep the same boundary.
  if (access.child.is_child) return { error: "playback restricted", status: 403 };
  if (["live", "upcoming"].includes(access.video.live_status)) return { error: "live playback unavailable", status: 409 };
  if (!await ytdlpStatus()) return { error: "native playback unavailable", status: 503 };
  if (await liveStreamEnabled(userId)) return { kind: "hls" };
  if (access.video.members_only === 1) return { error: "native playback unavailable", status: 409 };
  return { kind: "direct" };
}

/** Called in place of ordinary auth only when a media capability is present. */
export async function serveMediaTicket(c: Context, next: Next): Promise<Response | void> {
  c.header("Cache-Control", "private, no-store");
  c.header("Referrer-Policy", "no-referrer");
  const token = c.req.query("media_ticket") ?? "";
  const ticket = mediaTickets.read(token);
  const url = new URL(c.req.url);
  if (!ticket || !ticketAllowsPath(ticket, url.pathname, c.req.method)) return c.json({ error: "invalid media ticket" }, 401);
  const session = await validateSession(ticket.sessionToken);
  if (!session || session.user_id !== ticket.userId) {
    mediaTickets.revoke(token);
    return c.json({ error: "expired media session" }, 401);
  }
  const access = await nativePlaybackAccess(ticket.userId, ticket.videoId);
  if ("error" in access) return c.json({ error: access.error }, access.status);
  c.set("userId", ticket.userId);
  // No administrator authority, cookie profile switching, or other API access.
  await next();
  if (c.res.ok && /(?:mpegurl)/i.test(c.res.headers.get("Content-Type") ?? "")) {
    try {
      const playlist = authorizeHlsPlaylist(await c.res.text(), c.req.url, ticket, token);
      const headers = new Headers(c.res.headers);
      headers.delete("Content-Length");
      headers.delete("ETag");
      c.res = new Response(playlist, { status: 200, headers });
    } catch {
      c.res = c.json({ error: "unsupported media playlist" }, 502);
    }
  }
  c.header("Cache-Control", "private, no-store");
  c.header("Referrer-Policy", "no-referrer");
}
