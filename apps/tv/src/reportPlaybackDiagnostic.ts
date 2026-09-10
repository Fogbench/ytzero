import type { VideoPlayer } from "expo-video";
import { playbackDiagnostic, type PlaybackStage } from "./playbackDiagnostics";
import { playerDiagnostics } from "./playerControl";

/** Read before teardown; a released native player must never break error reporting. */
export async function reportPlaybackDiagnostic(player: VideoPlayer, stage: PlaybackStage, cause?: unknown) {
  if (!__DEV__ && !cause) return;
  let native = null;
  try { native = await playerDiagnostics(player); } catch { /* Player may already be released. */ }
  console.info("[YT Zero TV] playback", JSON.stringify({
    ...playbackDiagnostic(stage, cause, native), severity: cause ? "error" : "info",
  }));
}
