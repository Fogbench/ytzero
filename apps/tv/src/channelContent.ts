import type { ChannelAbout, Video } from "./types";

export type ChannelContentTab = "videos" | "shorts";

export function splitChannelVideos(videos: Video[]): { videos: Video[]; shorts: Video[] } {
  return {
    videos: videos.filter((video) => video.is_short !== 1),
    shorts: videos.filter((video) => video.is_short === 1),
  };
}

export function channelContentTabs(
  videos: Video[],
  counts: ChannelAbout["counts"],
  shortsEnabled: boolean,
): Array<{ value: ChannelContentTab; count: number }> {
  const split = splitChannelVideos(videos);
  const tabs: Array<{ value: ChannelContentTab; count: number }> = [
    { value: "videos", count: counts?.videos ?? split.videos.length },
  ];
  const shortCount = counts?.shorts ?? split.shorts.length;
  if (shortsEnabled && shortCount > 0) tabs.push({ value: "shorts", count: shortCount });
  return tabs;
}
