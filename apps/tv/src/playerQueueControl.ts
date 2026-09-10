import type { VideoPlayer } from "expo-video";
export type PlayerQueue = { currentId: string; nextId: string; previousId: string; navigationEnabled: boolean; shorts: { nextId: string; previousId: string }; items: Array<{ id: string; title: string }>; labels: { details: string; queue: string; next: string; previous: string } };
export async function updatePlayerQueue(_player: VideoPlayer, _queue: PlayerQueue): Promise<boolean> { return false; }
export async function clearPlayerQueue(_player: VideoPlayer): Promise<void> {}
export function subscribePlayerQueue(_callback: (event: { videoId: string; currentId: string; action?: "details" }) => void) { return { remove() {} }; }
