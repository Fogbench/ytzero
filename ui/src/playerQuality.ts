/** One quality the server can stream directly (see `qualities.json`). */
export interface DirectQuality {
  /** Sent back as `?q=`, for example `1440-av01`. */
  id: string;
  width: number;
  height: number;
  fps: number;
  codec: "avc1" | "av01";
  hdr: boolean;
}

/** One audio track (language) the server can stream, from `qualities.json`. */
export interface DirectAudioTrack {
  /** Language code, sent back as `~<id>` in `?q=`. */
  id: string;
  label: string;
  original: boolean;
  /** The track a video starts with. */
  default: boolean;
}

export type QualityCodec = DirectQuality["codec"];

/** What the viewer picked: a height (or "auto" = tallest) and the codec to use where there is a choice. */
export interface QualityChoice {
  height: number | "auto";
  codec: QualityCodec;
}

export const QUALITY_HEIGHT_KEY = "ytzero.player.qualityHeight";
export const QUALITY_CODEC_KEY = "ytzero.player.qualityCodec";
export const DEFAULT_QUALITY_CHOICE: QualityChoice = { height: "auto", codec: "av01" };

export function codecName(codec: QualityCodec): string {
  return codec === "av01" ? "AV1" : "MP4";
}

/** `2160p60 4K`, `1080p60`, `720p`. */
export function heightLabel(quality: DirectQuality): string {
  // Like YouTube, name a portrait video (1080x1920) by its short side: 1080p.
  const side = Math.min(quality.width, quality.height);
  const parts = [`${side}p${quality.fps > 30 ? Math.round(quality.fps) : ""}`];
  if (side >= 2160) parts.push("4K");
  if (quality.hdr) parts.push("HDR");
  return parts.join(" ");
}

/** A representative codec string; enough to ask the browser whether it can decode this family. */
export function qualityContentType(quality: DirectQuality): string {
  const video = quality.codec === "av01"
    ? (quality.hdr ? "av01.0.13M.10" : "av01.0.13M.08")
    : "avc1.640028";
  return `video/mp4; codecs="${video},mp4a.40.2"`;
}

/** Tallest first within a codec; used so the same rule picks entries everywhere. */
function ofCodec(list: DirectQuality[], codec: QualityCodec): DirectQuality[] {
  return list.filter((entry) => entry.codec === codec);
}

/** What the browser says about decoding one quality (the fields we use from `mediaCapabilities.decodingInfo`). */
export interface DecodeInfo {
  supported: boolean;
  smooth: boolean;
}

/**
 * Turns the browser's answer into "can play" and "plays smoothly". Without an
 * answer (the API is missing or threw) we assume both, so nothing is hidden.
 */
export function decodeVerdict(info: DecodeInfo | null | undefined): DecodeInfo {
  if (!info) return { supported: true, smooth: true };
  return { supported: info.supported, smooth: info.supported && info.smooth };
}

/**
 * The entry that plays for a choice. `list` is best first and limited to what the
 * browser can play at all, and a specific height is always taken from it.
 * "auto" only considers `smoothIds` (what decodes smoothly), so a machine without
 * hardware AV1 does not get 4K software decoding. If nothing is smooth, auto
 * takes the lowest height. Without `smoothIds`, every entry counts as smooth.
 */
export function resolveQuality(
  choice: QualityChoice,
  list: DirectQuality[],
  smoothIds?: ReadonlySet<string>,
): DirectQuality | null {
  if (list.length === 0) return null;
  if (choice.height === "auto" && smoothIds) {
    const smooth = list.filter((entry) => smoothIds.has(entry.id));
    const lowest = Math.min(...list.map((entry) => entry.height));
    const pool = smooth.length > 0 ? smooth : list.filter((entry) => entry.height === lowest);
    return resolveQuality(choice, pool);
  }
  const preferred = ofCodec(list, choice.codec);
  const other = list.filter((entry) => entry.codec !== choice.codec);
  if (choice.height === "auto") return preferred[0] ?? other[0];
  const wanted = choice.height;
  return preferred.find((entry) => entry.height === wanted)
    ?? other.find((entry) => entry.height === wanted)
    ?? preferred.find((entry) => entry.height < wanted)
    ?? other.find((entry) => entry.height < wanted)
    ?? resolveQuality({ height: Math.min(...list.map((entry) => entry.height)), codec: choice.codec }, list);
}

/** One menu row per height, using the preferred codec where it has that height. */
export function qualityRows(codec: QualityCodec, list: DirectQuality[]): DirectQuality[] {
  const heights = [...new Set(list.map((entry) => entry.height))].sort((a, b) => b - a);
  return heights.flatMap((height) => {
    const entry = resolveQuality({ height, codec }, list);
    return entry ? [entry] : [];
  });
}

export function readQualityChoice(storage: Pick<Storage, "getItem">): QualityChoice {
  const rawHeight = storage.getItem(QUALITY_HEIGHT_KEY);
  const height = Number(rawHeight);
  const codec = storage.getItem(QUALITY_CODEC_KEY);
  return {
    height: rawHeight && Number.isInteger(height) && height > 0 ? height : "auto",
    codec: codec === "avc1" || codec === "av01" ? codec : DEFAULT_QUALITY_CHOICE.codec,
  };
}
