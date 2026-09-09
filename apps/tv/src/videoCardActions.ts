import type { Video } from "./types";

// The TV Metro bundle is isolated to apps/tv, so this dependency-free contract
// stays local. videoCardActions.test.ts verifies parity with the canonical copy.
export const TV_VIDEO_CARD_ACTION_IDS = ["schedule", "sessionQueue", "playlist", "download", "archive", "watched", "restore", "remove", "otherPlaybackMode"] as const;
type VideoCardActionId = (typeof TV_VIDEO_CARD_ACTION_IDS)[number];
export type VideoCardActionConfig = { version: 1; actions: Array<{ id: VideoCardActionId; hidden: boolean }> };

export const DEFAULT_TV_VIDEO_CARD_ACTION_CONFIG: VideoCardActionConfig = {
  version: 1,
  actions: TV_VIDEO_CARD_ACTION_IDS.map((id) => ({ id, hidden: id === "playlist" || id === "download" || id === "otherPlaybackMode" })),
};

const lockedActionIds = new Set<VideoCardActionId>(["restore", "remove"]);

function parseVideoCardActionConfig(value: unknown): VideoCardActionConfig | null {
  if (typeof value === "string") {
    try { return parseVideoCardActionConfig(JSON.parse(value)); } catch { return null; }
  }
  if (!value || typeof value !== "object") return null;
  const config = value as { version?: unknown; actions?: unknown };
  if (config.version !== 1 || !Array.isArray(config.actions)) return null;
  const seen = new Set<string>();
  const actions: VideoCardActionConfig["actions"] = [];
  for (const entry of config.actions) {
    if (!entry || typeof entry !== "object") return null;
    const { id, hidden } = entry as { id?: unknown; hidden?: unknown };
    if (typeof id !== "string" || !(TV_VIDEO_CARD_ACTION_IDS as readonly string[]).includes(id) || typeof hidden !== "boolean" || seen.has(id)) return null;
    seen.add(id);
    actions.push({ id: id as VideoCardActionId, hidden: lockedActionIds.has(id as VideoCardActionId) ? false : hidden });
  }
  for (const action of DEFAULT_TV_VIDEO_CARD_ACTION_CONFIG.actions) if (!seen.has(action.id)) {
    const missing = { ...action };
    if (missing.id === "sessionQueue") actions.splice(Math.max(1, actions.findIndex((entry) => entry.id === "schedule") + 1), 0, missing);
    else actions.push(missing);
  }
  return { version: 1, actions: [actions.find((action) => action.id === "schedule")!, ...actions.filter((action) => action.id !== "schedule")] };
}

export type TvVideoCardActionId = Extract<VideoCardActionId, "schedule" | "playlist" | "download" | "archive" | "watched" | "restore" | "remove">;

export function tvVideoCardActionConfig(value: unknown): VideoCardActionConfig {
  return parseVideoCardActionConfig(value) ?? DEFAULT_TV_VIDEO_CARD_ACTION_CONFIG;
}

export function visibleTvVideoCardActions(config: VideoCardActionConfig, video: Video, showRemove = false): TvVideoCardActionId[] {
  return config.actions.flatMap(({ id, hidden }) => {
    if (hidden) return [];
    switch (id) {
      case "schedule":
        return video.status === "archived" ? [] : [id];
      case "playlist":
        return [id];
      case "download": {
        const active = video.download_status === "queued" || video.download_status === "downloading";
        const available = video.is_private !== 1
          && video.live_status !== "live"
          && video.live_status !== "upcoming"
          && (video.downloads_enabled === true || video.downloads_allowed === true)
          && video.download_status !== "done";
        return active || available ? [id] : [];
      }
      case "archive":
        return video.status === "archived" ? [] : [id];
      case "watched":
        return video.watched === 1 || video.status !== "archived" ? [id] : [];
      case "restore":
        return video.status === "archived" ? [id] : [];
      case "remove":
        return showRemove ? [id] : [];
      default:
        return [];
    }
  });
}
