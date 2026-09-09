import type { Bucket, Channel, Tag, Video } from "./types";

const bucketOrder: Bucket[] = ["today", "tonight", "tomorrow", "tomorrow_evening", "weekend"];

function parseAppTimestamp(value: string): Date {
  const normalized = value.trim().replace(" ", "T");
  return new Date(/[zZ]|[+-]\d\d(?::?\d\d)?$/.test(normalized) ? normalized : `${normalized}Z`);
}

export function visibleFeedTags(tags: Tag[]): Tag[] {
  return tags.filter((tag) => !tag.hidden_from_filters);
}

/** The web feed uses ANY-tag matching for the watched-channel shelf. */
export function channelsForTags(topChannels: Channel[], channels: Channel[], selectedTags: number[]): Channel[] {
  if (selectedTags.length === 0) return topChannels;
  const selected = new Set(selectedTags);
  return channels.filter((channel) => channel.tags.some((tag) => selected.has(tag.id)));
}

export function dueScheduledVideos(videos: Video[], now = new Date()): Video[] {
  return videos
    .filter((video) => video.bucket && (!video.show_from || parseAppTimestamp(video.show_from) <= now))
    .sort((left, right) => {
      const bucketDifference = bucketOrder.indexOf(left.bucket!) - bucketOrder.indexOf(right.bucket!);
      if (bucketDifference !== 0) return bucketDifference;
      const leftTime = left.show_from ? parseAppTimestamp(left.show_from).getTime() : 0;
      const rightTime = right.show_from ? parseAppTimestamp(right.show_from).getTime() : 0;
      return leftTime - rightTime;
    });
}

export function withoutInProgress(videos: Video[], inProgress: Video[]): Video[] {
  const inProgressIds = new Set(inProgress.map((video) => video.video_id));
  return videos.filter((video) => !inProgressIds.has(video.video_id));
}
