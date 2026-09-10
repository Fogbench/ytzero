import type { NativePlaybackDiagnostics } from "./playbackDiagnostics";
import { NativeModule, requireNativeModule } from "expo";
import type { VideoPlayer } from "expo-video";

declare class PlayerControl extends NativeModule {
  diagnostics(player: VideoPlayer): Promise<NativePlaybackDiagnostics>;
  setMetadata(player: VideoPlayer, title: string, subtitle: string): Promise<boolean>;
  play(player: VideoPlayer): Promise<void>;
  pause(player: VideoPlayer): Promise<void>;
  seek(player: VideoPlayer, seconds: number): Promise<void>;
  dismiss(player: VideoPlayer): Promise<boolean>;
  isAttached?(player: VideoPlayer): Promise<boolean>;
  unload?(player: VideoPlayer): Promise<void>;
  focusView(tag: number): Promise<boolean>;
}
const control = requireNativeModule<PlayerControl>("YtZeroPlayerControl");
export const playPlayer = (player: VideoPlayer) => control.play(player);
export const pausePlayer = (player: VideoPlayer) => control.pause(player);
export const seekPlayer = (player: VideoPlayer, seconds: number) => control.seek(player, seconds);
export const dismissPlayer = (player: VideoPlayer) => control.dismiss(player);
export const isPlayerAttached = (player: VideoPlayer) => control.isAttached?.(player) ?? Promise.resolve(true);
export const unloadPlayer = (player: VideoPlayer) => control.unload?.(player) ?? player.replaceAsync(null);
export const focusView = (tag: number) => control.focusView?.(tag) ?? Promise.resolve(false);

export const playerDiagnostics = (player: VideoPlayer) => control.diagnostics?.(player) ?? Promise.resolve(null);
export const setPlayerMetadata = (player: VideoPlayer, title: string, subtitle: string) => control.setMetadata?.(player, title, subtitle) ?? Promise.resolve(false);
