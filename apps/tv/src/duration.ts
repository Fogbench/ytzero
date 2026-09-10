import { playbackTime } from "./playback";

/** API durations may contain total minutes (68:10) or already include hours. */
export function formatVideoDuration(value: string | number | null | undefined): string {
  if (value == null || value === "") return "";
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? playbackTime(value) : "";
  const parts = value.trim().split(":");
  if (!parts.length || parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) return "";
  const seconds = parts.reduce((total, part) => total * 60 + Number(part), 0);
  return Number.isSafeInteger(seconds) ? playbackTime(seconds) : "";
}
