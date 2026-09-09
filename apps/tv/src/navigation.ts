import type { TranslationKey } from "./i18n";

export type TvDestination = "feed" | "settings";
export type TvNavigationIcon = "home" | "settings";

export type TvNavigationItem = {
  key: "/" | "/settings";
  destination: TvDestination;
  labelKey: TranslationKey;
  icon: TvNavigationIcon;
};

const items: TvNavigationItem[] = [
  { key: "/", destination: "feed", labelKey: "feedTitle", icon: "home" },
  { key: "/settings", destination: "settings", labelKey: "deviceSettingsTitle", icon: "settings" },
];

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
/**
 * Applies the same persisted order/hidden/disabled model as the browser
 * sidebar, then narrows it to destinations implemented by the TV client.
 * Device settings always remain visible because they contain the only local
 * sign-out and instance-switching controls.
 */
export function resolveTvNavigation(raw: string | null | undefined): {
  visible: TvNavigationItem[];
  hidden: TvNavigationItem[];
} {
  const byKey = new Map(items.map((item) => [item.key, item] as const));
  const ordered: StoredEntry[] = [];
  const seen = new Set<string>();

  for (const entry of parseStoredEntries(raw)) {
    if (!byKey.has(entry.key as TvNavigationItem["key"]) || seen.has(entry.key)) continue;
    seen.add(entry.key);
    ordered.push(entry);
  }
  for (const item of items) {
    if (!seen.has(item.key)) ordered.push({ key: item.key, hidden: false });
  }

  const visible: TvNavigationItem[] = [];
  const hidden: TvNavigationItem[] = [];
  for (const entry of ordered) {
    const item = byKey.get(entry.key as TvNavigationItem["key"]);
    if (!item) continue;
    if (item.destination === "settings") {
      visible.push(item);
    } else if (!entry.disabled) {
      (entry.hidden ? hidden : visible).push(item);
    }
  }
  return { visible, hidden };
}
