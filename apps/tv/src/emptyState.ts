import type { TvBrowseDestination, TvNavigationIcon } from "./navigation";
import type { TranslationKey } from "./i18n";
import type { EmptyArtScene } from "./components/TvEmptyArt";
type Presentation = { title: TranslationKey; description: TranslationKey; art?: EmptyArtScene; icon: TvNavigationIcon };
const feed: Presentation = { title: "tvEmptyFeedEmptyCaughtUpTitle", description: "tvEmptyFeedEmptyCaughtUpDescription", art: "inboxZero", icon: "home" };
const destinations: Partial<Record<TvBrowseDestination, Presentation>> = {
  "/watchlist": { title: "tvEmptyWatchlistEmpty", description: "tvEmptyWatchlistEmptyHint", art: "scheduleClear", icon: "watchlist" },
  "/downloads": { title: "tvEmptyDownloadsEmptyTitle", description: "tvEmptyDownloadsEmpty", art: "noDownloads", icon: "downloads" },
  "/live": { title: "tvEmptyLiveEmpty", description: "tvEmptyLiveEmptyHint", art: "offAir", icon: "live" },
  "/liked": { title: "tvEmptyLikedEmpty", description: "tvEmptyLikedEmptyHint", art: "nothingLiked", icon: "liked" },
  "/history": { title: "tvEmptyHistoryEmpty", description: "tvEmptyHistoryEmptyHint", art: "noHistory", icon: "history" },
  "/archive": { title: "tvEmptyArchiveEmpty", description: "tvEmptyArchiveEmptyHint", art: "archiveEmpty", icon: "archive" },
  "/shorts": { title: "tvEmptyShortsEmpty", description: "tvEmptyShortsEmptyHint", art: "noShorts", icon: "shorts" },
  "/recommendations": { title: "tvEmptyRecommendationsEmptyTitle", description: "tvEmptyRecommendationsEmptyDescription", art: "noDiscovery", icon: "recommendations" },
};
export function browseEmptyState(destination: TvBrowseDestination, filtered: boolean, hasSubscriptions: boolean | null, hasOtherContent: boolean): Presentation {
  if (destination === "/" && filtered) return { title: "tvEmptyFeedEmptyNoTagMatchTitle", description: "tvEmptyFeedEmptyNoTagMatchDescription", icon: "search" };
  if (destination === "/" && hasSubscriptions === false && !hasOtherContent) return { title: "tvEmptyFeedEmptyNotFollowingTitle", description: "tvEmptyFeedEmptyNotFollowingDescription", art: "noSubscriptions", icon: "home" };
  const presentation = destinations[destination] ?? feed;
  return hasOtherContent ? { ...presentation, art: undefined } : presentation;
}
