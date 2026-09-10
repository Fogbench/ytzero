import { randomBytes } from "node:crypto";
import { createDownloadLiveAudioStreaming } from "./downloadLiveAudioStreaming";
import { YTDLP, dlSettings, downloadCookiesConfigured, downloadCookiesFile, ytdlpStatus } from "./downloadConfig";

export function liveVideoFormat(quality: string): string {
  const height = Number(quality);
  const cap = Number.isFinite(height) && height > 0 ? `[height<=${Math.floor(height)}]` : "";
  return `bestvideo[protocol*=m3u8][vcodec^=avc1]${cap}`;
}

// YouTube's HLS audio renditions (233/234) may omit acodec in yt-dlp metadata.
export const LIVE_VIDEO_AUDIO_FORMAT = "bestaudio[protocol*=m3u8][ext=mp4]";

// A separate process-local cache from radio; no download jobs or media files.
const shared = {
  YTDLP, downloadCookiesConfigured, downloadCookiesFile, ytdlpStatus,
  // A stalled upstream request must not hold a native player indefinitely.
  fetchImpl: ((input, init) => fetch(input, { ...init, signal: AbortSignal.any([
    ...(init?.signal ? [init.signal] : []), AbortSignal.timeout(30_000),
  ]) })) as typeof fetch,
};
const video = createDownloadLiveAudioStreaming({
  ...shared,
  formatSelector: async (userId) => liveVideoFormat((await dlSettings(userId)).quality),
  resourceTokenPrefix: () => `rv${randomBytes(8).toString("hex")}_`,
});
const audio = createDownloadLiveAudioStreaming({
  ...shared,
  formatSelector: async () => LIVE_VIDEO_AUDIO_FORMAT,
  resourceTokenPrefix: () => `ra${randomBytes(8).toString("hex")}_`,
});

export const liveVideoStreaming = {
  async playlist(userId: number, videoId: string, file: "index.m3u8" | "video.m3u8" | "audio.m3u8", signal?: AbortSignal): Promise<string | null> {
    if (file === "index.m3u8") return '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Audio",DEFAULT=YES,AUTOSELECT=YES,URI="audio.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=12000000,AUDIO="audio"\nvideo.m3u8\n';
    return (file === "audio.m3u8" ? audio : video).getLiveAudioPlaylist(userId, videoId, signal);
  },
  resource(userId: number, videoId: string, token: string, range: string | null, signal?: AbortSignal) {
    return (token.startsWith("ra") ? audio : video).getLiveAudioResource(userId, videoId, token, range, signal);
  },
};
