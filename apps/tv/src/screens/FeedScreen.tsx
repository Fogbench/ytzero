import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, FlatList, StyleSheet, Text, TVFocusGuideView, View, type FocusDestination, type LayoutChangeEvent, type ListRenderItemInfo } from "react-native";
import type { YtZeroApi } from "../api";
import type { Translate } from "../i18n";
import { navigationLabelKey, type TvBrowseDestination } from "../navigation";
import type { Channel, Language, Tag, Video } from "../types";
import { TvButton } from "../components/TvButton";
import { TvChannelShelf } from "../components/TvChannelShelf";
import { TvLoadingMark } from "../components/TvLoadingMark";
import { TvShortCard } from "../components/TvShortCard";
import { TvTagFilter } from "../components/TvTagFilter";
import { TvVideoShelf } from "../components/TvVideoShelf";
import type { VideoActionOptions } from "../components/TvVideoActionMenu";
import { VideoCard } from "../components/VideoCard";
import { channelsForTags, dueScheduledVideos, visibleFeedTags, withoutInProgress } from "../feedSections";
import { useVerticalFocusRedirect } from "../focus";
import { colors, screenPadding } from "../theme";
import { tvGridListPerformance } from "../listPerformance";

type FeedSort = "published" | "arrival";

type Props = {
  api: YtZeroApi;
  destination: TvBrowseDestination;
  feedSort: FeedSort;
  focusRequest: number;
  language: Language;
  profileFocusTarget: FocusDestination;
  showTopChannels: boolean;
  onPrimaryFocusTarget: (target: View | null) => void;
  t: Translate;
  onOpenChannel: (channel: Channel) => void;
  onOpen: (video: Video) => void;
  onVideoLongPress: (video: Video, onChange: (updated: Video) => void, options?: VideoActionOptions) => void;
  viewportHeight: number;
  viewportWidth: number;
};

export function FeedScreen({ api, destination, feedSort, focusRequest, language, profileFocusTarget, showTopChannels, onPrimaryFocusTarget, t, onOpenChannel, onOpen, onVideoLongPress, viewportHeight: height, viewportWidth: width }: Props) {
  const home = destination === "/";
  const shortsView = destination === "/shorts";
  const columns = shortsView
    ? width >= 1700 ? 7 : width >= 1220 ? 6 : 4
    : width >= 1700 ? 5 : width >= 1220 ? 4 : 3;
  const contentWidth = Math.max(720, width - screenPadding * 2);
  const columnGap = shortsView ? 24 : 28;
  const cardWidth = Math.floor((contentWidth - (columns - 1) * columnGap) / columns);
  const shelfCardWidth = Math.min(380, Math.floor((contentWidth - 3 * 26) / 4));
  const [videos, setVideos] = useState<Video[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [inProgress, setInProgress] = useState<Video[]>([]);
  const [scheduled, setScheduled] = useState<Video[]>([]);
  const [topChannels, setTopChannels] = useState<Channel[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialFeedLoaded, setInitialFeedLoaded] = useState(false);
  const [preludeLoading, setPreludeLoading] = useState(home);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [focusedVideoIndex, setFocusedVideoIndex] = useState<number | null>(null);
  const feedRequestId = useRef(0);
  const handledFocusRequest = useRef<number | null>(null);
  const [firstVideoTarget, setFirstVideoTarget] = useState<View | null>(null);
  const [firstContinueTarget, setFirstContinueTarget] = useState<View | null>(null);
  const [firstScheduledTarget, setFirstScheduledTarget] = useState<View | null>(null);
  const [firstTagTarget, setFirstTagTarget] = useState<View | null>(null);
  const [firstChannelTarget, setFirstChannelTarget] = useState<View | null>(null);
  const retryRef = useRef<View>(null);
  const emptyRef = useRef<View>(null);
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (__DEV__) console.info("[YT Zero TV] browse state", { destination, width, height, columns, loading, error, videoCount: videos.length });
  }, [columns, destination, error, height, loading, videos.length, width]);

  const load = useCallback(async (nextPage: number) => {
    const requestId = ++feedRequestId.current;
    nextPage === 0 ? setLoading(true) : setLoadingMore(true);
    setError(false);
    try {
      const result = home
        ? await api.feed({ page: nextPage, sort: feedSort, tags: selectedTags }).then((feed) => ({
            videos: feed.videos,
            page: feed.page,
            hasMore: feed.videos.length === feed.limit,
          }))
        : await api.browse(destination, { page: nextPage, showAll: false, sort: feedSort });
      if (requestId !== feedRequestId.current) return;
      setVideos((current) => nextPage === 0 ? result.videos : [...current, ...result.videos]);
      setPage(result.page);
      setHasMore(result.hasMore);
    } catch {
      if (requestId === feedRequestId.current) {
        setError(true);
      }
    } finally {
      if (requestId === feedRequestId.current) {
        if (nextPage === 0) setInitialFeedLoaded(true);
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [api, destination, feedSort, home, selectedTags]);

  useEffect(() => { void load(0); }, [load]);

  useEffect(() => {
    if (!home) return;
    setPreludeLoading(true);
    void Promise.allSettled([
      api.tags().then((result) => setTags(result.tags)),
      api.inProgress().then((result) => setInProgress(result.videos.filter((video) => video.is_short === 0))),
      api.watchlist().then((result) => setScheduled(result.videos)),
      showTopChannels ? api.topChannels().then((result) => setTopChannels(result.channels)) : Promise.resolve(),
      showTopChannels ? api.channels().then((result) => setChannels(result.channels)) : Promise.resolve(),
    ]).then(() => setPreludeLoading(false));
  }, [api, home, showTopChannels]);

  const screenLoading = !initialFeedLoaded || preludeLoading;

  useEffect(() => {
    if (screenLoading) {
      reveal.setValue(0);
      return;
    }
    const animation = Animated.timing(reveal, { toValue: 1, duration: 170, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [reveal, screenLoading]);

  useEffect(() => {
    if (screenLoading) return;
    const target = home
      ? firstContinueTarget ?? firstScheduledTarget ?? firstTagTarget ?? firstChannelTarget ?? firstVideoTarget
      : firstVideoTarget;
    const destinationTarget = target ?? (error ? retryRef.current : emptyRef.current);
    if (!destinationTarget || handledFocusRequest.current === focusRequest) return;
    handledFocusRequest.current = focusRequest;
    const frame = requestAnimationFrame(() => destinationTarget.requestTVFocus());
    return () => cancelAnimationFrame(frame);
  }, [destination, error, firstChannelTarget, firstContinueTarget, firstScheduledTarget, firstTagTarget, firstVideoTarget, focusRequest, home, screenLoading]);

  const visibleTags = useMemo(() => visibleFeedTags(tags), [tags]);
  const dueScheduled = useMemo(() => dueScheduledVideos(scheduled), [scheduled]);
  const feedVideos = useMemo(() => home ? withoutInProgress(videos, inProgress) : videos, [home, inProgress, videos]);
  const visibleChannels = useMemo(
    () => channelsForTags(topChannels, channels, selectedTags),
    [channels, selectedTags, topChannels],
  );
  const gridPerformance = useMemo(() => tvGridListPerformance(columns), [columns]);
  const gridFocusUpTarget = home
    ? firstChannelTarget ?? firstScheduledTarget ?? firstContinueTarget ?? firstTagTarget ?? undefined
    : profileFocusTarget;
  useVerticalFocusRedirect(focusedVideoIndex !== null && focusedVideoIndex < columns, gridFocusUpTarget);

  useEffect(() => {
    const primaryTarget = home
      ? firstContinueTarget ?? firstScheduledTarget ?? firstTagTarget ?? firstChannelTarget ?? firstVideoTarget
      : firstVideoTarget;
    onPrimaryFocusTarget(primaryTarget);
    return () => onPrimaryFocusTarget(null);
  }, [firstChannelTarget, firstContinueTarget, firstScheduledTarget, firstTagTarget, firstVideoTarget, home, onPrimaryFocusTarget]);

  const toggleTag = useCallback((tagId: number) => {
    setSelectedTags((current) => current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId]);
  }, []);

  const clearTags = useCallback(() => {
    setSelectedTags([]);
  }, []);

  const applyVideoChange = useCallback((updated: Video) => {
    setVideos((current) => current
      .map((video) => video.video_id === updated.video_id ? updated : video)
      .filter((video) => {
        if (video.video_id !== updated.video_id) return true;
        if (destination === "/archive") return updated.status === "archived";
        if (destination === "/watchlist") return updated.status === "queued";
        return updated.status !== "archived";
      }));
    setInProgress((current) => current
      .map((video) => video.video_id === updated.video_id ? updated : video)
      .filter((video) => video.video_id !== updated.video_id || (updated.status !== "archived" && updated.watched !== 1)));
    setScheduled((current) => {
      const withoutVideo = current.filter((video) => video.video_id !== updated.video_id);
      return updated.status === "queued" ? [...withoutVideo, updated] : withoutVideo;
    });
  }, [destination]);

  const removeFromHistory = useCallback(async (video: Video) => {
    if (video.history_id == null) return;
    await api.removeFromHistory(video.history_id);
    setVideos((current) => current.filter((item) => item.video_id !== video.video_id));
  }, [api]);

  const header = useMemo(() => (
    <View>
      <View style={styles.heading}>
        <Text style={styles.title}>{t(navigationLabelKey(destination))}</Text>
        {home && <TvTagFilter tags={visibleTags} selected={selectedTags} profileFocusTarget={profileFocusTarget} nextFocusDown={firstContinueTarget ?? firstScheduledTarget ?? firstChannelTarget ?? firstVideoTarget ?? undefined} firstTagRef={setFirstTagTarget} onToggle={toggleTag} onClear={clearTags} clearLabel={t("clearFilters")} />}
      </View>
      {error && (
        <View style={styles.errorRow}>
          <Text style={styles.error}>{t("loadError")}</Text>
          <TvButton ref={retryRef} label={t("refresh")} onPress={() => void load(0)} />
        </View>
      )}
      {home && (
        <>
          <TvVideoShelf title={t("continueWatching")} videos={inProgress} cardWidth={shelfCardWidth} firstItemRef={setFirstContinueTarget} language={language} nextFocusUp={firstTagTarget ?? undefined} nextFocusDown={firstScheduledTarget ?? firstChannelTarget ?? firstVideoTarget ?? undefined} thumbnailSource={api.thumbnailSource.bind(api)} onOpen={onOpen} onLongPress={(video) => onVideoLongPress(video, applyVideoChange)} viewsLabel={t("views")} />
          {firstContinueTarget && (firstScheduledTarget ?? firstChannelTarget ?? firstVideoTarget) && <TVFocusGuideView destinations={[(firstScheduledTarget ?? firstChannelTarget ?? firstVideoTarget)!]} style={[styles.focusBridge, { width: shelfCardWidth }]} />}
          {selectedTags.length === 0 && <TvVideoShelf title={t("navWatchlist")} videos={dueScheduled} cardWidth={shelfCardWidth} firstItemRef={setFirstScheduledTarget} language={language} nextFocusUp={firstContinueTarget ?? firstTagTarget ?? undefined} nextFocusDown={firstChannelTarget ?? firstVideoTarget ?? undefined} thumbnailSource={api.thumbnailSource.bind(api)} onOpen={onOpen} onLongPress={(video) => onVideoLongPress(video, applyVideoChange)} viewsLabel={t("views")} />}
          {firstScheduledTarget && (firstChannelTarget ?? firstVideoTarget) && <TVFocusGuideView destinations={[(firstChannelTarget ?? firstVideoTarget)!]} style={[styles.focusBridge, { width: shelfCardWidth }]} />}
          {showTopChannels && <TvChannelShelf title={t("watchedChannels")} liveLabel={t("liveBadge")} channels={visibleChannels} firstItemRef={setFirstChannelTarget} nextFocusUp={firstScheduledTarget ?? firstContinueTarget ?? firstTagTarget ?? undefined} nextFocusDown={firstVideoTarget ?? undefined} thumbnailSource={api.thumbnailSource.bind(api)} onOpen={onOpenChannel} />}
          {firstChannelTarget && firstVideoTarget && <TVFocusGuideView destinations={[firstVideoTarget]} style={[styles.focusBridge, styles.channelFocusBridge]} />}
        </>
      )}
    </View>
  ), [api, applyVideoChange, clearTags, destination, dueScheduled, error, firstChannelTarget, firstContinueTarget, firstScheduledTarget, firstTagTarget, firstVideoTarget, home, inProgress, language, load, onOpen, onOpenChannel, onVideoLongPress, profileFocusTarget, selectedTags, shelfCardWidth, showTopChannels, t, toggleTag, visibleChannels, visibleTags]);

  const renderVideo = useCallback(({ item, index }: ListRenderItemInfo<Video>) => {
    const focusProps = {
      ref: index === 0 ? setFirstVideoTarget : undefined,
      nextFocusUp: index < columns ? gridFocusUpTarget : undefined,
      onFocusChange: (focused: boolean) => setFocusedVideoIndex(focused ? index : (current) => current === index ? null : current),
      onLongPress: () => onVideoLongPress(
        item,
        applyVideoChange,
        destination === "/history" && item.history_id != null ? { onRemove: () => removeFromHistory(item) } : undefined,
      ),
      onPress: () => onOpen(item),
    };
    return shortsView ? (
      <TvShortCard
        {...focusProps}
        video={item}
        width={cardWidth}
        language={language}
        portraitSource={api.shortThumbnailSource(item.video_id)}
        fallbackSource={api.thumbnailSource(item.thumbnail)}
        viewsLabel={t("views")}
      />
    ) : (
      <VideoCard
        {...focusProps}
        video={item}
        width={cardWidth}
        language={language}
        thumbnailSource={api.thumbnailSource(item.thumbnail)}
        viewsLabel={t("views")}
      />
    );
  }, [api, applyVideoChange, cardWidth, columns, destination, gridFocusUpTarget, language, onOpen, onVideoLongPress, removeFromHistory, shortsView, t]);

  if (screenLoading) {
    return (
      <View style={[styles.loadingScreen, { width, height }]}>
        <TvLoadingMark accessibilityLabel={t("loadingFeed")} />
      </View>
    );
  }

  return (
    <Animated.View
      style={[styles.screen, { width, height, opacity: reveal }]}
      onLayout={traceLayout}
    >
      <FlatList
        key={`${destination}-${columns}`}
        style={[styles.list, { width, height }]}
        contentContainerStyle={[styles.content, { minHeight: height }]}
        data={feedVideos}
        numColumns={columns}
        columnWrapperStyle={[styles.row, shortsView && styles.shortRow]}
        keyExtractor={(video) => video.video_id}
        ListHeaderComponent={header}
        ListEmptyComponent={!error ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t("emptyFeed")}</Text>
            <Text style={styles.emptyHint}>{t("emptyFeedHint")}</Text>
            <TvButton ref={emptyRef} label={t("refresh")} onPress={() => void load(0)} style={styles.emptyAction} />
          </View>
        ) : null}
        ListFooterComponent={hasMore && feedVideos.length > 0 ? (
          <View style={styles.footer}>
            <TvButton label={loadingMore ? t("loadingFeed") : t("loadMore")} disabled={loadingMore} onPress={() => void load(page + 1)} />
          </View>
        ) : null}
        renderItem={renderVideo}
        {...gridPerformance}
      />
    </Animated.View>
  );

  function traceLayout(event: LayoutChangeEvent) {
    if (__DEV__) console.info("[YT Zero TV] feed layout", event.nativeEvent.layout);
  }
}

const styles = StyleSheet.create({
  screen: { flexGrow: 0, flexShrink: 0, backgroundColor: colors.background },
  loadingScreen: { flexGrow: 0, flexShrink: 0, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  // Fabric on react-native-tvos can collapse a multi-column FlatList to one
  // pixel when only flex sizing is used, so keep both dimensions explicit.
  list: { flexGrow: 0, flexShrink: 0 },
  content: { paddingHorizontal: screenPadding, paddingTop: 48, paddingBottom: 80 },
  heading: { alignItems: "flex-start", marginTop: 18, marginBottom: 34 },
  title: { color: colors.text, fontSize: 54, lineHeight: 62, fontWeight: "700", letterSpacing: -1.8, marginHorizontal: 20 },
  focusBridge: { height: 20, marginLeft: 20, marginTop: -20 },
  channelFocusBridge: { width: 160, marginTop: -38 },
  row: { gap: 28 },
  shortRow: { gap: 24 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 22, marginBottom: 28 },
  error: { color: colors.danger, fontSize: 20, fontWeight: "700" },
  empty: { minHeight: 400, alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: colors.text, fontSize: 34, fontWeight: "800" },
  emptyHint: { color: colors.textMuted, fontSize: 19, lineHeight: 27, marginTop: 10, maxWidth: 620, textAlign: "center" },
  emptyAction: { marginTop: 24 },
  footer: { alignItems: "center", paddingTop: 14, paddingBottom: 30 },
});
