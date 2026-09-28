/**
 * Canonical channel-sync depth contract shared by the browser and the server.
 *
 * Keep this module dependency-free: both independently built applications
 * import it, and deployment packaging copies it alongside their source trees.
 */

/** How deep a single channel sync digs. */
export const CHANNEL_SYNC_MODES = ["full", "recent"] as const;

export type ChannelSyncMode = (typeof CHANNEL_SYNC_MODES)[number];

export function isChannelSyncMode(value: unknown): value is ChannelSyncMode {
  return typeof value === "string" && (CHANNEL_SYNC_MODES as readonly string[]).includes(value);
}

/** Unknown/missing values keep the historical deep scan. */
export function normalizeChannelSyncMode(value: unknown): ChannelSyncMode {
  return isChannelSyncMode(value) ? value : "full";
}

/**
 * What opening a channel page does on its own: nothing (the historical
 * behaviour), a quick pass over the channel's latest uploads, or the same deep
 * history scan as the manual sync button.
 */
export const CHANNEL_OPEN_SYNC_MODES = ["off", "recent", "full"] as const;

export type ChannelOpenSyncMode = (typeof CHANNEL_OPEN_SYNC_MODES)[number];

export function isChannelOpenSyncMode(value: unknown): value is ChannelOpenSyncMode {
  return typeof value === "string" && (CHANNEL_OPEN_SYNC_MODES as readonly string[]).includes(value);
}

/** Unknown/missing values leave channel pages passive. */
export function normalizeChannelOpenSyncMode(value: unknown): ChannelOpenSyncMode {
  return isChannelOpenSyncMode(value) ? value : "off";
}
