import type { TranslationKey } from "./i18n";

export type TvDestination =
  | "/search"
  | "/"
  | "/recommendations"
  | "/shorts"
  | "/live"
  | "/watchlist"
  | "/followed-playlists"
  | "/downloads"
  | "/liked"
  | "/history"
  | "/bookmarks"
  | "/archive"
  | "/settings";
export type TvBrowseDestination = Exclude<TvDestination, "/settings">;
export type TvNavigationIcon = "search" | "home" | "recommendations" | "shorts" | "live" | "watchlist" | "playlists" | "downloads" | "liked" | "history" | "bookmarks" | "archive" | "settings";

export type TvNavigationItem = {
  key: TvDestination;
  destination: TvDestination;
  labelKey: TranslationKey;
  icon: TvNavigationIcon;
};

const items: TvNavigationItem[] = [
  { key: "/search", destination: "/search", labelKey: "searchTitle", icon: "search" },
  { key: "/", destination: "/", labelKey: "navToday", icon: "home" },
  { key: "/recommendations", destination: "/recommendations", labelKey: "navRecommendations", icon: "recommendations" },
  { key: "/shorts", destination: "/shorts", labelKey: "navShorts", icon: "shorts" },
  { key: "/live", destination: "/live", labelKey: "navLive", icon: "live" },
  { key: "/watchlist", destination: "/watchlist", labelKey: "navWatchlist", icon: "watchlist" },
  { key: "/followed-playlists", destination: "/followed-playlists", labelKey: "navFollowedPlaylists", icon: "playlists" },
  { key: "/downloads", destination: "/downloads", labelKey: "navDownloads", icon: "downloads" },
  { key: "/liked", destination: "/liked", labelKey: "navLiked", icon: "liked" },
  { key: "/history", destination: "/history", labelKey: "navHistory", icon: "history" },
  { key: "/bookmarks", destination: "/bookmarks", labelKey: "navBookmarks", icon: "bookmarks" },
  { key: "/archive", destination: "/archive", labelKey: "navArchive", icon: "archive" },
  { key: "/settings", destination: "/settings", labelKey: "navSettings", icon: "settings" },
];

const browseDestinations = new Set<TvDestination>(items.filter((item) => item.destination !== "/settings").map((item) => item.destination));
const hiddenByDefault = new Set<TvDestination>(["/recommendations", "/shorts", "/followed-playlists"]);

type StoredEntry = { key: string; hidden: boolean; disabled?: boolean };

function parseStoredEntries(raw: string | null | undefined): StoredEntry[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && typeof entry.key === "string")
      .map((entry) => ({
        key: entry.key === "/discovery" ? "/recommendations" : entry.key as string,
        hidden: Boolean(entry.hidden),
        ...(entry.disabled ? { disabled: true } : {}),
      }));
  } catch {
    return [];
  }
}

/** Mirrors the browser sidebar order and visibility, excluding Social and Pulse. */
export function resolveTvNavigation(raw: string | null | undefined): {
  visible: TvNavigationItem[];
  hidden: TvNavigationItem[];
} {
  const byKey = new Map(items.map((item) => [item.key, item] as const));
  // Search is a TV utility; web keeps it in the top bar rather than sidebar settings.
  const ordered: StoredEntry[] = [{ key: "/search", hidden: false }];
  const seen = new Set<string>(["/search"]);

  for (const entry of parseStoredEntries(raw)) {
    if (!byKey.has(entry.key as TvDestination) || seen.has(entry.key)) continue;
    seen.add(entry.key);
    ordered.push(entry);
  }
  for (const item of items) {
    if (!seen.has(item.key)) ordered.push({ key: item.key, hidden: hiddenByDefault.has(item.key) });
  }

  const visible: TvNavigationItem[] = [];
  const hidden: TvNavigationItem[] = [];
  for (const entry of ordered) {
    const item = byKey.get(entry.key as TvDestination);
    if (!item) continue;
    if (item.destination === "/settings") visible.push(item);
    else if (!entry.disabled) (entry.hidden ? hidden : visible).push(item);
  }
  return { visible, hidden };
}

export function isTvBrowseDestination(value: string): value is TvBrowseDestination {
  return browseDestinations.has(value as TvDestination);
}

export function navigationLabelKey(destination: TvDestination): TranslationKey {
  return items.find((item) => item.destination === destination)?.labelKey ?? "navToday";
}
