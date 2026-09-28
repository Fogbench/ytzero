import type { Context, Hono } from "hono";
import { isChannelSyncMode, normalizeChannelSyncMode, type ChannelSyncMode } from "../../../shared/channelSyncModes";
import { channelSyncJobIsRunning, getChannelSyncJob, startChannelSyncJob } from "../channelSyncRuntime";
import { database } from "../database";
import { syncChannel, syncChannelRecent } from "../refresher";
import { log } from "../logger";
import { ageMs } from "../routeCache";

type ApiEnvironment = { Variables: { userId: number; sessionAdmin?: boolean; profileAdmin?: boolean } };
type Api = Hono<ApiEnvironment>;
type ApiContext = Context<ApiEnvironment>;

async function channelSyncIsDisabled(channelId: string): Promise<boolean> {
  const row = await database.prepare("SELECT manual_status FROM channels WHERE channel_id=?").get(channelId) as { manual_status: string } | null;
  return Boolean(row && row.manual_status !== "active");
}

/** Depth decides which worker runs; both report the same progress shape. */
const syncChannelByMode = (userId: number) => (channelId: string, mode: ChannelSyncMode) =>
  mode === "recent" ? syncChannelRecent(channelId, userId) : syncChannel(channelId, userId);

// Opening a channel page can start a sync on its own. Each depth keeps a
// cooldown so navigating back and forth does not replay scrapes into YouTube:
// the quick pass follows the background feed refresh floor, while a complete
// history scan is expensive and barely changes within a day.
const AUTOMATIC_SYNC_COOLDOWN_MS: Record<ChannelSyncMode, number> = {
  recent: 10 * 60_000,
  full: 6 * 60 * 60_000,
};

async function automaticSyncIsOnCooldown(channelId: string, mode: ChannelSyncMode): Promise<boolean> {
  const row = await database.prepare(
    "SELECT last_refreshed_at, last_full_synced_at, full_sync_attempted_at FROM channels WHERE channel_id=?"
  ).get(channelId) as { last_refreshed_at: string | null; last_full_synced_at: string | null; full_sync_attempted_at: string | null } | null;
  if (!row) return false;
  // Deep scans back off on their attempt time, so a channel that keeps hitting
  // a rate limit is not rescanned on every visit.
  const lastRun = mode === "full" ? row.full_sync_attempted_at ?? row.last_full_synced_at : row.last_refreshed_at;
  return ageMs(lastRun) < AUTOMATIC_SYNC_COOLDOWN_MS[mode];
}

interface SingleChannelSyncRequest {
  mode: ChannelSyncMode;
  /** Set by the channel page itself, never by a button the viewer pressed. */
  automatic: boolean;
}

function readSingleChannelSyncRequest(body: unknown): SingleChannelSyncRequest | null {
  const payload = body && typeof body === "object" && !Array.isArray(body) ? body as { mode?: unknown; automatic?: unknown } : {};
  if ("mode" in payload && !isChannelSyncMode(payload.mode)) return null;
  return { mode: normalizeChannelSyncMode(payload.mode), automatic: payload.automatic === true };
}

export function registerChannelSyncRoutes(api: Api, currentUserId: (context: ApiContext) => number): void {
  // Full channel scans are intentionally asynchronous: even one channel can
  // visit dozens of playlist/video pages and exceed the HTTP idle timeout.
  api.get("/channels/sync", (c) => c.json({ job: getChannelSyncJob(currentUserId(c)), busy: channelSyncJobIsRunning() }));

  api.post("/channels/sync", async (c) => {
    const uid = currentUserId(c);
    const body = await c.req.json<{ channel_ids?: unknown }>().catch(() => null);
    if (!body || !Array.isArray(body.channel_ids)) return c.json({ error: "channel_ids must be an array" }, 400);
    if (body.channel_ids.some((channelId) => typeof channelId !== "string" || !channelId.trim())) {
      return c.json({ error: "channel_ids must contain non-empty strings" }, 400);
    }
    const channelIds = [...new Set(body.channel_ids.map((channelId) => (channelId as string).trim()))];
    if (channelIds.length === 0) return c.json({ error: "at least one channel is required" }, 400);

    // Revalidate the selection for the active profile. Channel data is shared
    // globally, but a profile may only bulk-sync its own current subscriptions.
    const followed = await database.prepare(`
      SELECT c.channel_id, COALESCE(c.custom_title, c.title, c.channel_id) AS title,
             c.manual_status, c.external
      FROM channels c
      JOIN user_channels uc ON uc.channel_id = c.channel_id
      WHERE uc.user_id = ? AND uc.followed = 1
    `).all(uid) as { channel_id: string; title: string; manual_status: string; external: number }[];
    const followedById = new Map(followed.map((channel) => [channel.channel_id, channel]));
    if (channelIds.some((channelId) => !followedById.has(channelId) || followedById.get(channelId)!.external !== 0)) {
      return c.json({ error: "all channels must be followed by the active profile" }, 400);
    }
    if (channelIds.some((channelId) => followedById.get(channelId)!.manual_status !== "active")) {
      return c.json({ error: "channel sync disabled" }, 409);
    }

    try {
      const job = startChannelSyncJob(uid, channelIds.map((channelId) => ({
        channelId,
        title: followedById.get(channelId)!.title || channelId,
      })), syncChannelByMode(uid));
      log.info("channel.sync_job_started", { jobId: job.id, userId: uid, channels: job.total });
      return c.json({ job }, 202);
    } catch (error) {
      log.error("channel.sync_job_start_failed", { userId: uid, error: error instanceof Error ? error.message : String(error) });
      return c.json({ error: "could not start channel sync" }, 500);
    }
  });

}

export function registerSingleChannelSyncRoute(api: Api, currentUserId: (context: ApiContext) => number): void {
  api.post("/channels/:id/sync", async (c) => {
    const channelId = c.req.param("id");
    const request = readSingleChannelSyncRequest(await c.req.json().catch(() => null));
    if (!request) return c.json({ error: "invalid sync mode" }, 400);
    // An automatic page-open sync reports what it decided instead of failing:
    // a disabled or recently synced channel is simply left alone.
    if (await channelSyncIsDisabled(channelId)) {
      return request.automatic ? c.json({ job: null, skipped: "disabled" }) : c.json({ error: "channel sync disabled" }, 409);
    }
    if (request.automatic && await automaticSyncIsOnCooldown(channelId, request.mode)) {
      return c.json({ job: null, skipped: "cooldown" });
    }
    try {
      const channel = await database.prepare("SELECT COALESCE(custom_title, title, channel_id) AS title FROM channels WHERE channel_id = ?").get(channelId) as { title: string } | null;
      const uid = currentUserId(c);
      const job = startChannelSyncJob(uid, [{ channelId, title: channel?.title || channelId, mode: request.mode }], syncChannelByMode(uid));
      log.info("channel.sync_job_started", { jobId: job.id, userId: uid, channels: 1, mode: request.mode, automatic: request.automatic });
      return c.json({ job }, 202);
    } catch (error) {
      log.error("channel.sync_job_start_failed", { channelId, error: error instanceof Error ? error.message : String(error) });
      return c.json({ error: "could not start channel sync" }, 500);
    }
  });
}
