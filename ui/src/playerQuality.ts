/** One quality the server can stream directly (see `qualities.json`). */
export interface DirectQuality {
  /** Sent back as `?q=`, for example `1440-av01`. */
  id: string;
  height: number;
  fps: number;
  codec: "avc1" | "av01";
  hdr: boolean;
}

/** `auto` = best the browser plays, `auto-mp4` = best H.264 up to 1080p, otherwise a quality id. */
export type QualityMode = "auto" | "auto-mp4" | string;

export const QUALITY_MODE_KEY = "ytzero.player.quality";
export const AUTO_MP4_MAX_HEIGHT = 1080;

/** `2160p60 4K HDR AV1`, `1080p60 mp4`, `720p mp4`. */
export function qualityLabel(quality: DirectQuality): string {
  const parts = [`${quality.height}p${quality.fps > 30 ? Math.round(quality.fps) : ""}`];
  if (quality.height >= 2160) parts.push("4K");
  if (quality.hdr) parts.push("HDR");
  parts.push(quality.codec === "av01" ? "AV1" : "mp4");
  return parts.join(" ");
}

/** A representative codec string; enough to ask the browser whether it can decode this family. */
export function qualityContentType(quality: DirectQuality): string {
  const video = quality.codec === "av01"
    ? (quality.hdr ? "av01.0.13M.10" : "av01.0.13M.08")
    : "avc1.640028";
  return `video/mp4; codecs="${video},mp4a.40.2"`;
}

/**
 * Which entry plays for the chosen mode. `list` is best first and already
 * limited to what the browser can play. A saved specific choice that this
 * video lacks falls back to the tallest entry not above that height.
 */
export function resolveQuality(mode: QualityMode, list: DirectQuality[]): DirectQuality | null {
  if (list.length === 0) return null;
  if (mode === "auto") return list[0];
  if (mode === "auto-mp4") {
    return list.find((entry) => entry.codec === "avc1" && entry.height <= AUTO_MP4_MAX_HEIGHT) ?? list[list.length - 1];
  }
  const exact = list.find((entry) => entry.id === mode);
  if (exact) return exact;
  const wanted = Number.parseInt(mode, 10);
  if (!Number.isFinite(wanted)) return list[0];
  return list.find((entry) => entry.height <= wanted) ?? list[list.length - 1];
}
