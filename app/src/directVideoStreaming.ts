import { createDownloadVideoDirectStreaming } from "./downloadVideoDirectStreaming";
import { YTDLP, dlSettings, downloadCookiesConfigured, downloadCookiesFile, ytdlpStatus } from "./downloadConfig";

// Deliberately has no download scheduler or ffmpeg dependency: opening a
// direct player only resolves metadata and relays requested media byte ranges.
export const directVideoStreaming = createDownloadVideoDirectStreaming({
  YTDLP,
  dlSettings,
  downloadCookiesConfigured,
  downloadCookiesFile,
  ytdlpStatus,
  resourcePath: "direct-hls",
});
