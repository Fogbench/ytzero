import { usePaginationFocus } from "../usePaginationFocus";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, TVFocusGuideView, StyleSheet, Text, View, type FocusDestination, type ListRenderItemInfo } from "react-native";
import type { YtZeroApi } from "../api";
import type { Translate } from "../i18n";
import type { Channel, Language, Video } from "../types";
import type { OpenVideo } from "../playbackQueue";
import { sessionContext } from "../playbackQueue";
import { focusWhenReady, useContentFocusAllowed } from "../focus";
import { colors, screenPadding } from "../theme";
import { TvEmptyState } from "../components/TvEmptyState";
import { TvTextField } from "../components/TvTextField";
import { TvButton } from "../components/TvButton";
import { TvPageHeading } from "../components/TvPageHeading";
import { TvChannelShelf } from "../components/TvChannelShelf";
import { VideoCard } from "../components/VideoCard";
import type { VideoActionOptions } from "../components/TvVideoActionMenu";
import { gridRows } from "../gridRows";
import { tvVerticalListPerformance } from "../listPerformance";

type Results = { videos: Video[]; channels: Channel[] };
const empty: Results = { videos: [], channels: [] };
const videoKey = (video: Video) => video.video_id;
type ResultSource = "local" | "youtube";
type SearchRow =
  | { key: string; kind: "title"; label: string }
  | { key: string; kind: "channels"; channels: Channel[] }
  | { key: string; kind: "videos"; source: ResultSource; items: Array<{ item: Video; index: number }> }
  | { key: string; kind: "busy" }
  | { key: string; kind: "error" }
  | { key: string; kind: "more" }
  | { key: string; kind: "empty"; started: boolean };
type Props = {
  api: YtZeroApi; t: Translate; language: Language; focusRequest: number; profileFocusTarget: FocusDestination;
  viewportWidth: number; viewportHeight: number; onPrimaryFocusTarget: (target: View | null) => void;
  onOpen: OpenVideo; onOpenChannel: (channel: Channel) => void; videoUpdate: Video | null;
  onVideoLongPress: (video: Video, onChange: (video: Video) => void, options?: VideoActionOptions) => void;
};
export function SearchScreen({ api, t, language, focusRequest, profileFocusTarget, viewportWidth: width, viewportHeight: height, onPrimaryFocusTarget, onOpen, onOpenChannel, onVideoLongPress, videoUpdate }: Props) {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [local, setLocal] = useState<Results>(empty);
  const [youtube, setYoutube] = useState<Results>(empty);
  const [localBusy, setLocalBusy] = useState(false);
  const [youtubeBusy, setYoutubeBusy] = useState(false);
  const [localError, setLocalError] = useState(false);
  const [youtubeError, setYoutubeError] = useState(false);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [searchTarget, setSearchTarget] = useState<View | null>(null);
  const request = useRef(0);
  const openRequest = useRef(0);
  const openingRef = useRef(false);
  const resultsRef = useRef({ local, youtube });
  const focusHandled = useRef<number | null>(null);
  const allowed = useContentFocusAllowed();
  const list = useRef<FlatList<SearchRow>>(null);
  const columns = width >= 1400 ? 4 : 3;
  const localVideoIds = useMemo(() => local.videos.map(videoKey), [local.videos]);
  const pagination = usePaginationFocus(localVideoIds, columns, hasMore, query);
  const cardWidth = Math.floor((width - screenPadding * 2 - (columns - 1) * 28) / columns);
  resultsRef.current = { local, youtube };

  useEffect(() => () => { request.current++; openRequest.current++; }, []);
  useEffect(() => { onPrimaryFocusTarget(searchTarget); return () => onPrimaryFocusTarget(null); }, [onPrimaryFocusTarget, searchTarget]);
  useEffect(() => {
    if (!allowed || !searchTarget || focusHandled.current === focusRequest) return;
    return focusWhenReady(searchTarget, () => { focusHandled.current = focusRequest; });
  }, [allowed, focusRequest, searchTarget]);

  const runSearch = useCallback((candidate: string) => {
    const q = candidate.trim();
    if (!q || openingRef.current) return;
    const id = ++request.current;
    setQuery(q); setLocalBusy(true); setYoutubeBusy(true); setLocalError(false); setYoutubeError(false); setOpenError(false);
    setLocal(empty); setYoutube(empty); setHasMore(false); setPage(0);
    list.current?.scrollToOffset({ offset: 0, animated: false });
    void api.searchLocal(q).then((result) => {
      if (id !== request.current) return;
      setLocal(result); setHasMore(result.hasMore);
    }).catch(() => { if (id === request.current) setLocalError(true); })
      .finally(() => { if (id === request.current) setLocalBusy(false); });
    void api.searchYoutube(q).then((result) => { if (id === request.current) setYoutube(result); })
      .catch(() => { if (id === request.current) setYoutubeError(true); })
      .finally(() => { if (id === request.current) setYoutubeBusy(false); });
  }, [api]);
  const search = useCallback((candidate = text) => runSearch(candidate), [runSearch, text]);
  const more = async (beforeAppend?: () => Promise<void>) => {
    if (localBusy || !hasMore) return;
    const id = request.current;
    setLocalBusy(true); setLocalError(false);
    try {
      const result = await api.searchLocal(query, page + 1);
      if (id !== request.current) return;
      await beforeAppend?.();
      if (id !== request.current) return;
      setLocal((current) => ({ ...current, videos: [...new Map([...current.videos, ...result.videos].map((video) => [video.video_id, video])).values()] }));
      setPage((current) => current + 1); setHasMore(result.hasMore);
    } catch { if (id === request.current) setLocalError(true); }
    finally { if (id === request.current) setLocalBusy(false); }
  };
  const updateVideo = useCallback((updated: Video) => {
    const update = (current: Results) => ({ ...current, videos: current.videos.map((video) => video.video_id === updated.video_id ? { ...video, ...updated } : video) });
    setLocal(update); setYoutube(update);
  }, []);
  useEffect(() => { if (videoUpdate) updateVideo(videoUpdate); }, [videoUpdate, updateVideo]);
  const open = useCallback(async (video: Video, actions = false) => {
    if (openingRef.current) return;
    const id = ++openRequest.current;
    setOpenError(false);
    if (video.external) {
      openingRef.current = true;
      setOpening(true);
    }
    try {
      const ready = video.external ? (await api.video(video.video_id)).video : video;
      if (id !== openRequest.current) return;
      if (actions) onVideoLongPress(ready, updateVideo);
      else onOpen(ready, sessionContext([...resultsRef.current.local.videos, ...resultsRef.current.youtube.videos]));
    } catch { if (id === openRequest.current) setOpenError(true); }
    finally {
      if (id === openRequest.current) {
        openingRef.current = false;
        setOpening(false);
      }
    }
  }, [api, onOpen, onVideoLongPress, updateVideo]);

  const remote = useMemo(() => {
    const localIds = new Set(local.videos.map(videoKey));
    const localChannelIds = new Set(local.channels.map((channel) => channel.channel_id));
    return {
      videos: youtube.videos.filter((video) => !localIds.has(video.video_id)),
      channels: youtube.channels.filter((channel) => !localChannelIds.has(channel.channel_id)),
    };
  }, [local.channels, local.videos, youtube.channels, youtube.videos]);
  const rows = useMemo(() => {
    if (!query) return [{ key: "empty:start", kind: "empty", started: false } satisfies SearchRow];
    const result: SearchRow[] = [];
    const appendSection = (source: ResultSource, label: string, data: Results, busy: boolean, error: boolean) => {
      if (!busy && !error && data.videos.length === 0 && data.channels.length === 0) return;
      result.push({ key: `${source}:title`, kind: "title", label });
      if (data.channels.length > 0) result.push({ key: `${source}:channels`, kind: "channels", channels: data.channels });
      for (const row of gridRows(data.videos, columns, videoKey)) {
        result.push({ key: `${source}:videos:${row.key}`, kind: "videos", source, items: row.items });
      }
      if (busy && !(source === "local" && hasMore)) result.push({ key: `${source}:busy`, kind: "busy" });
      if (error) result.push({ key: `${source}:error`, kind: "error" });
    };
    appendSection("local", t("searchLibrary"), local, localBusy, localError);
    if (hasMore) result.push({ key: "local:more", kind: "more" });
    appendSection("youtube", t("searchYoutube"), remote, youtubeBusy, youtubeError);
    if (!localBusy && !youtubeBusy && !localError && !youtubeError
      && local.videos.length === 0 && local.channels.length === 0
      && remote.videos.length === 0 && remote.channels.length === 0) {
      result.push({ key: "empty:results", kind: "empty", started: true });
    }
    return result;
  }, [columns, hasMore, local, localBusy, localError, query, remote, t, youtubeBusy, youtubeError]);
  const thumbnailSource = useCallback((thumbnail: string) => api.thumbnailSource(thumbnail), [api]);
  const clear = useCallback(() => {
    request.current++;
    openRequest.current++;
    openingRef.current = false;
    setText(""); setQuery(""); setLocal(empty); setYoutube(empty);
    setLocalBusy(false); setYoutubeBusy(false); setOpening(false); setOpenError(false);
    setLocalError(false); setYoutubeError(false); setHasMore(false); setPage(0);
    list.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);
  const header = useMemo(() => <>
    <TvPageHeading title={t("searchTitle")} />
    <View style={styles.searchRow}>
      <View style={styles.field}><TvTextField value={text} accessibilityLabel={t("searchHint")} placeholder={t("searchHint")} returnKeyType="search" autoCorrect={false}
        nextFocusUp={profileFocusTarget} nextFocusDown={searchTarget ?? undefined} onChangeText={setText} onSubmitEditing={(event) => runSearch(event.nativeEvent.text)} /></View>
      <TvButton ref={setSearchTarget} label="" icon="search" accessibilityLabel={t("searchTitle")} nextFocusUp={profileFocusTarget} onPress={() => search()} />
      {text ? <TvButton label={t("searchClear")} variant="ghost" onPress={clear} /> : null}
    </View>
    {opening ? <View style={styles.status}><ActivityIndicator size="small" color={colors.textMuted} /><Text style={styles.hint}>{t("loadingVideo")}</Text></View> : null}
    {openError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{t("searchError")}</Text> : null}
  </>, [clear, openError, opening, profileFocusTarget, runSearch, search, searchTarget, t, text]);
  const renderRow = useCallback(({ item: row }: ListRenderItemInfo<SearchRow>) => {
    if (row.kind === "title") return <Text accessibilityRole="header" style={styles.sectionTitle}>{row.label}</Text>;
    if (row.kind === "channels") return <TvChannelShelf title={t("searchChannels")} liveLabel={t("liveBadge")} channels={row.channels}
      thumbnailSource={thumbnailSource} onOpen={onOpenChannel} nextFocusUp={searchTarget ?? undefined} />;
    if (row.kind === "videos") return <View style={styles.gridRow}>{row.items.map(({ item: video, index }) => {
      const localResult = row.source === "local";
      return <VideoCard key={video.video_id}
        ref={localResult ? pagination.itemRef(video.video_id) : undefined}
        nextFocusDown={localResult ? pagination.down(index) : undefined}
        onFocusChange={localResult ? (focused) => pagination.onItemFocus(video.video_id, focused) : undefined}
        video={video} width={cardWidth} language={language}
        thumbnailSource={thumbnailSource(video.thumbnail)} channelSource={video.channel_thumbnail ? thumbnailSource(video.channel_thumbnail) : undefined}
        viewsLabel={t("views")} onPress={() => void open(video)} onLongPress={() => void open(video, true)} />;
    })}</View>;
    if (row.kind === "busy") return <View style={styles.status}><ActivityIndicator size="small" color={colors.textMuted} /><Text style={styles.hint}>{t("searchLoading")}</Text></View>;
    if (row.kind === "error") return <View style={styles.status}><Text accessibilityLiveRegion="polite" style={styles.error}>{t("searchError")}</Text><TvButton label={t("tryAgain")} onPress={() => runSearch(query)} /></View>;
    if (row.kind === "more") return <TVFocusGuideView destinations={pagination.destinations}><TvButton ref={pagination.buttonRef}
      onFocus={pagination.onButtonFocus} onBlur={pagination.onButtonBlur} nextFocusUp={pagination.up}
      label={localBusy ? t("searchLoading") : t("loadMore")} accessibilityState={{ busy: localBusy }}
      onPress={() => { if (!localBusy) void pagination.load(more); }} style={styles.more} /></TVFocusGuideView>;
    return <TvEmptyState icon="search" title={t(row.started ? "searchEmpty" : "searchStartTitle")}
      description={t(row.started ? "searchEmptyHint" : "searchStartHint")} />;
  }, [cardWidth, language, localBusy, more, onOpenChannel, open, pagination, query, runSearch, searchTarget, t, thumbnailSource]);
  const rowKey = useCallback((row: SearchRow) => row.key, []);
  return <FlatList ref={list} data={rows} keyExtractor={rowKey} renderItem={renderRow}
    style={{ width, height }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
    ListHeaderComponent={header} {...tvVerticalListPerformance} />;
}
const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, paddingTop: 156, paddingBottom: 100 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 24, marginBottom: 30 },
  field: { flex: 1 }, sectionTitle: { color: colors.text, fontSize: 30, fontWeight: "600", marginTop: 26, marginBottom: 24 },
  gridRow: { flexDirection: "row", columnGap: 28 },
  hint: { color: colors.textMuted, fontSize: 23, lineHeight: 32 }, error: { color: colors.danger, fontSize: 23, lineHeight: 32 },
  status: { flexDirection: "row", alignItems: "center", gap: 20, marginVertical: 24 }, more: { alignSelf: "flex-start", marginTop: 24 },
});
