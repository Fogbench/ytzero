import type { Channel, Video } from "./types";
export type YoutubeSearchVideo = {
  videoId: string; title: string; thumbnail: string; duration: string;
  channelId: string; channelTitle: string; channelAvatar: string | null;
  viewCount: number | null; watched: number; watch_position: number | null; watch_duration: number | null;
  bucket: Video["bucket"]; download_status: Video["download_status"]; downloads_enabled: boolean; downloads_allowed: boolean;
};
export type YoutubeSearchChannel = { channelId: string; title: string; thumbnail: string; handle: string; subscriberCount: string };
export function searchVideo(result: YoutubeSearchVideo): Video {
  return { video_id: result.videoId, title: result.title, thumbnail: result.thumbnail, duration: result.duration || null,
    description: "", channel_id: result.channelId, channel_title: result.channelTitle, channel_thumbnail: result.channelAvatar,
    views: result.viewCount, published_at: null, live_status: "none", status: "inbox", external: 1,
    watched: result.watched, watch_position: result.watch_position, watch_duration: result.watch_duration, bucket: result.bucket,
    download_status: result.download_status, downloads_enabled: result.downloads_enabled, downloads_allowed: result.downloads_allowed };
}
export function searchChannel(result: YoutubeSearchChannel): Channel {
  return { channel_id: result.channelId, title: result.title, thumbnail: result.thumbnail, handle: result.handle, subscriber_count: result.subscriberCount, tags: [] };
}
export function matchingChannels(channels: Channel[], query: string): Channel[] {
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const needle = normalize(query);
  return needle ? channels.filter((channel) => [channel.title, channel.channel_id, channel.handle ?? "", channel.description ?? ""].some((text) => normalize(text).includes(needle))) : [];
}
