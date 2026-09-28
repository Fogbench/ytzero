// Download requests from child profiles. A child restricted to downloaded
// videos cannot start a download themselves, so they ask instead: the request
// shows up for parent profiles, who approve or deny it. Per-child rules can
// settle a request on the spot, and every request — including the ones a rule
// approved — stays readable as history.
//
// Approving claims the file for the child profile as well, because download
// visibility is per profile: without that ownership row the approved video
// would keep playing as "ask a parent" on the child's screen.
import { database } from "./database";
import { getUserSetting } from "./db";
import { publishAppEvent } from "./appEvents";
import { isChildUser } from "./childTime";
import { enqueueDownload } from "./downloader";
import { profileDownloadsEnabled } from "./downloadSettingsStore";
import { createNotification } from "./notifications";
import { log } from "./logger";

/** How a child profile's download requests are handled before a parent sees them. */
export type ChildDownloadApproval = "off" | "subscribed" | "all";
export const CHILD_DOWNLOAD_APPROVALS: readonly ChildDownloadApproval[] = ["off", "subscribed", "all"];

export function isChildDownloadApproval(value: unknown): value is ChildDownloadApproval {
  return typeof value === "string" && (CHILD_DOWNLOAD_APPROVALS as readonly string[]).includes(value);
}

export interface ChildDownloadRequestRow {
  id: number;
  user_id: number;
  video_id: string;
  status: "pending" | "approved" | "denied";
  auto: number;
  created_at: string;
  resolved_at: string | null;
  name: string;
  avatar: string;
  avatar_color: string;
  title: string | null;
  thumbnail: string | null;
  channel_title: string | null;
  channel_thumbnail: string | null;
  download_status: string | null;
}

// Resolved requests are a review aid, not an archive: three months is long
// enough to answer "what did they ask for" without growing without bound.
const HISTORY_RETENTION_DAYS = 90;

export function childDownloadRequestsAllowed(userId: number): boolean {
  return getUserSetting(userId, "child_download_requests") !== "0";
}

export function childDownloadApproval(userId: number): ChildDownloadApproval {
  const value = getUserSetting(userId, "child_download_auto_approve");
  return isChildDownloadApproval(value) ? value : "off";
}

/**
 * The profile a granted download is queued for. Downloads are enabled per
 * profile, so an approval falls back to any adult profile that has them on —
 * otherwise the request could be approved into a queue nobody processes.
 */
async function downloadOwner(preferredUserId: number | null): Promise<number | null> {
  if (preferredUserId && !await isChildUser(preferredUserId) && await profileDownloadsEnabled(preferredUserId)) {
    return preferredUserId;
  }
  const candidates = await database.prepare(
    "SELECT id FROM users WHERE COALESCE(is_child, 0) = 0 ORDER BY is_admin DESC, sort_order, id",
  ).all<{ id: number }>();
  for (const candidate of candidates) {
    if (await profileDownloadsEnabled(candidate.id)) return candidate.id;
  }
  return null;
}

async function autoApproves(childId: number, videoId: string, mode: ChildDownloadApproval): Promise<boolean> {
  if (mode === "all") return true;
  if (mode !== "subscribed") return false;
  const row = await database.prepare(`
    SELECT 1 FROM videos v
    JOIN user_channels uc ON uc.channel_id = v.channel_id
    WHERE v.video_id = ? AND uc.user_id = ? AND uc.followed = 1
  `).get(videoId, childId);
  return Boolean(row);
}

/** Why a granted download could not be started. */
export type GrantFailure = "downloads-disabled" | "video-unavailable";

/** Queue the video and make it visible to the child profile that asked. */
async function grantDownload(childId: number, videoId: string, approverId: number | null): Promise<GrantFailure | null> {
  const ownerId = await downloadOwner(approverId);
  if (!ownerId) return "downloads-disabled";
  await enqueueDownload(ownerId, videoId, "manual");
  // A video that went private or unavailable since the request is refused by
  // the queue and never gets a download row — and ownership is a foreign key
  // to exactly that row, so it has to be checked before claiming.
  if (!await database.prepare("SELECT 1 FROM downloads WHERE video_id = ?").get(videoId)) return "video-unavailable";
  // The file may already exist (another profile downloaded it); claiming it is
  // what actually unblocks playback for the child either way.
  await database.prepare(`
    INSERT INTO download_owners (user_id, video_id, source, created_at)
    VALUES (?, ?, 'manual', datetime('now'))
    ON CONFLICT(user_id, video_id) DO NOTHING
  `).run(childId, videoId);
  return null;
}

async function notifyParents(request: { id: number; childId: number }, videoId: string): Promise<void> {
  const child = await database.prepare("SELECT name FROM users WHERE id = ?").get<{ name: string }>(request.childId);
  const video = await database.prepare(`
    SELECT v.title, v.thumbnail, COALESCE(NULLIF(c.custom_title, ''), c.title) AS channel_title
    FROM videos v LEFT JOIN channels c ON c.channel_id = v.channel_id
    WHERE v.video_id = ?
  `).get<{ title: string; thumbnail: string; channel_title: string | null }>(videoId);
  const parents = await database.prepare("SELECT id FROM users WHERE COALESCE(is_child, 0) = 0").all<{ id: number }>();
  const payload = {
    requestId: request.id,
    childId: request.childId,
    childName: child?.name ?? "",
    videoId,
    videoTitle: video?.title ?? "",
    thumbnail: video?.thumbnail ?? "",
    channelTitle: video?.channel_title ?? "",
  };
  for (const parent of parents) {
    // Parents who keep the child-activity shortcut visible already see pending
    // requests there; the bell (and any forwarding provider) is the fallback
    // for those who turned that shortcut off.
    if (getUserSetting(parent.id, "child_watching_monitor_enabled") !== "0") continue;
    await createNotification(parent.id, "child_request", `child_request:${request.id}`, payload, "/");
  }
}

export interface CreatedChildDownloadRequest {
  id: number;
  status: "pending" | "approved";
}

/**
 * Record a child's request for one video. A pending request for the same video
 * is reused so repeated taps cannot flood the parent's list.
 */
export async function createChildDownloadRequest(childId: number, videoId: string): Promise<CreatedChildDownloadRequest> {
  await database.prepare(
    `DELETE FROM child_download_requests WHERE status != 'pending' AND created_at < datetime('now', '-${HISTORY_RETENTION_DAYS} days')`,
  ).run();
  const existing = await database.prepare(
    "SELECT id FROM child_download_requests WHERE user_id = ? AND video_id = ? AND status = 'pending'",
  ).get<{ id: number }>(childId, videoId);
  if (existing) return { id: Number(existing.id), status: "pending" };

  // A rule may only settle the request once the download is really under way.
  // If nothing could be queued the request waits for a parent instead of
  // telling the child it was approved while no file is coming.
  const mode = childDownloadApproval(childId);
  const ruleMatches = await autoApproves(childId, videoId, mode);
  const failure = ruleMatches ? await grantDownload(childId, videoId, null) : null;
  const auto = ruleMatches && !failure;
  const row = auto
    ? await database.prepare(
      "INSERT INTO child_download_requests (user_id, video_id, status, auto, resolved_at) VALUES (?, ?, 'approved', 1, datetime('now')) RETURNING id",
    ).get<{ id: number }>(childId, videoId)
    : await database.prepare(
      "INSERT INTO child_download_requests (user_id, video_id, status, auto) VALUES (?, ?, 'pending', 0) RETURNING id",
    ).get<{ id: number }>(childId, videoId);
  const id = Number(row!.id);

  if (auto) {
    publishAppEvent("downloads");
    log.info("child.download_auto_approved", { user_id: childId, video_id: videoId, mode });
  } else {
    await notifyParents({ id, childId }, videoId);
    log.info("child.download_requested", { user_id: childId, video_id: videoId, rule_blocked: failure });
  }
  publishAppEvent("child-requests");
  return { id, status: auto ? "approved" : "pending" };
}

/** The most recent request for one video, whatever its outcome. */
export async function latestChildDownloadRequest(childId: number, videoId: string) {
  return await database.prepare(
    "SELECT id, status, created_at FROM child_download_requests WHERE user_id = ? AND video_id = ? ORDER BY id DESC LIMIT 1",
  ).get<{ id: number; status: string; created_at: string }>(childId, videoId);
}

const REQUEST_COLUMNS = `
  SELECT r.id, r.user_id, r.video_id, r.status, r.auto, r.created_at, r.resolved_at,
         u.name, u.avatar, u.avatar_color,
         v.title, v.thumbnail,
         COALESCE(NULLIF(c.custom_title, ''), c.title) AS channel_title,
         c.thumbnail AS channel_thumbnail,
         (SELECT d.status FROM downloads d WHERE d.video_id = r.video_id) AS download_status
  FROM child_download_requests r
  JOIN users u ON u.id = r.user_id
  LEFT JOIN videos v ON v.video_id = r.video_id
  LEFT JOIN channels c ON c.channel_id = v.channel_id
`;

export async function listChildDownloadRequests(status: "pending" | "resolved", limit = 20): Promise<ChildDownloadRequestRow[]> {
  const condition = status === "pending" ? "r.status = 'pending'" : "r.status != 'pending'";
  return await database.prepare(`${REQUEST_COLUMNS} WHERE ${condition} ORDER BY r.created_at DESC, r.id DESC LIMIT ?`)
    .all<ChildDownloadRequestRow>(limit);
}

export interface ResolveResult {
  ok: boolean;
  /** Set when an approval could not start the download after all. */
  error?: GrantFailure;
}

export async function resolveChildDownloadRequest(
  requestId: number,
  action: "approve" | "deny",
  approverId: number,
): Promise<ResolveResult> {
  const request = await database.prepare(
    "SELECT id, user_id, video_id FROM child_download_requests WHERE id = ? AND status = 'pending'",
  ).get<{ id: number; user_id: number; video_id: string }>(requestId);
  if (!request) return { ok: false };
  // Two parents can answer the same request at once, so the decision is
  // claimed first and only the parent who won it starts the download.
  const claimed = await database.prepare(
    "UPDATE child_download_requests SET status = ?, resolved_by = ?, resolved_at = datetime('now') WHERE id = ? AND status = 'pending'",
  ).run(action === "approve" ? "approved" : "denied", approverId, requestId);
  if (!claimed.changes) return { ok: false };
  if (action === "approve") {
    const failure = await grantDownload(Number(request.user_id), request.video_id, approverId);
    if (failure) {
      // Nothing is downloading, so the request stays open for another try.
      await database.prepare(
        "UPDATE child_download_requests SET status = 'pending', resolved_by = NULL, resolved_at = NULL WHERE id = ?",
      ).run(requestId);
      return { ok: false, error: failure };
    }
  }
  await database.prepare("UPDATE notifications SET read_at = datetime('now') WHERE kind = 'child_request' AND dedupe_key = ? AND read_at IS NULL")
    .run(`child_request:${requestId}`);
  publishAppEvent("child-requests");
  publishAppEvent("notifications");
  publishAppEvent("downloads");
  log.info(action === "approve" ? "child.download_approved" : "child.download_denied", {
    user_id: request.user_id, video_id: request.video_id, by_user_id: approverId,
  });
  return { ok: true };
}
