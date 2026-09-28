/**
 * Caption defaults come from two layers: the profile preference ("auto-enable
 * captions") and an optional per-channel override that either forces one
 * language or turns captions off for that channel entirely.
 */
export interface WatchCaptionSources {
  channelMode?: "off" | "language" | null;
  channelLanguage?: string | null;
  playerCc?: string;
  playerCcLang?: string;
  playerHl?: string;
}

export interface WatchCaptions {
  /** Show a caption track as soon as playback starts. */
  defaultOn: boolean;
  language: string;
  /** The channel bans captions outright, rather than merely not auto-enabling them. */
  channelOff: boolean;
}

export function resolveWatchCaptions(sources: WatchCaptionSources): WatchCaptions {
  const channelOff = sources.channelMode === "off";
  const channelLanguage = sources.channelMode === "language" ? sources.channelLanguage || null : null;
  return {
    channelOff,
    defaultOn: !channelOff && (Boolean(channelLanguage) || sources.playerCc === "1"),
    language: channelLanguage || sources.playerCcLang || sources.playerHl || "en",
  };
}

/**
 * Never omit cc_load_policy: an embed created without it restores the caption
 * track stored in the browser's YouTube preference, so captions would come back
 * even though the profile keeps them off.
 */
export function captionPlayerVars(defaultOn: boolean, language: string): { cc_load_policy: number; cc_lang_pref?: string } {
  return defaultOn ? { cc_load_policy: 1, cc_lang_pref: language } : { cc_load_policy: 0 };
}
