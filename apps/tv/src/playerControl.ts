import type { NativePlaybackDiagnostics } from "./playbackDiagnostics";
import type { VideoPlayer } from "expo-video";
export async function dismissPlayer(_player: VideoPlayer): Promise<boolean> { return false; }
export async function isPlayerAttached(_player: VideoPlayer): Promise<boolean> { return true; }
export async function unloadPlayer(player: VideoPlayer): Promise<void> { await player.replaceAsync(null); }
export async function focusView(_tag: number): Promise<boolean> { return false; }

export async function playPlayer(player: VideoPlayer): Promise<void> { player.play(); }
export async function pausePlayer(player: VideoPlayer): Promise<void> { player.pause(); }
export async function seekPlayer(player: VideoPlayer, seconds: number): Promise<void> { player.currentTime = seconds; }

export async function playerDiagnostics(_player: VideoPlayer): Promise<NativePlaybackDiagnostics | null> { return null; }
export async function setPlayerMetadata(_player: VideoPlayer, _title: string, _subtitle: string): Promise<boolean> { return false; }
