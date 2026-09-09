import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, FlatList, Image, StyleSheet, Text, View, type FocusDestination, type ListRenderItemInfo } from "react-native";
import type { YtZeroApi } from "../api";
import { channelContentTabs, splitChannelVideos, type ChannelContentTab } from "../channelContent";
import { TvButton } from "../components/TvButton";
import { TvLoadingMark } from "../components/TvLoadingMark";
import { TvShortCard } from "../components/TvShortCard";
import { TvTabBar } from "../components/TvTabBar";
import { TvVideoShelf } from "../components/TvVideoShelf";
import type { VideoActionOptions } from "../components/TvVideoActionMenu";
import { VideoCard } from "../components/VideoCard";
import { useVerticalFocusRedirect } from "../focus";
import type { Translate } from "../i18n";
import { tvGridListPerformance } from "../listPerformance";
import { colors, screenPadding } from "../theme";
import type { Channel, ChannelAbout, Language, Video } from "../types";

type Props = {
  api: YtZeroApi;
  channelId: string;
  focusRequest: number;
  language: Language;
  onBack: () => void;
  onOpen: (video: Video) => void;
  onPrimaryFocusTarget: (target: View | null) => void;
  onVideoLongPress: (video: Video, onChange: (updated: Video) => void, options?: VideoActionOptions) => void;
  profileFocusTarget: FocusDestination;
  shortsEnabled: boolean;
  t: Translate;
  viewportHeight: number;
  viewportWidth: number;
};

export function ChannelScreen({ api, channelId, focusRequest, language, onBack, onOpen, onPrimaryFocusTarget, onVideoLongPress, profileFocusTarget, shortsEnabled, t, viewportHeight: height, viewportWidth: width }: Props) {
  const columns = width >= 1700 ? 5 : width >= 1220 ? 4 : 3;
  const contentWidth = Math.max(720, width - (screenPadding + 20) * 2);
  const cardWidth = Math.floor((contentWidth - (columns - 1) * 28) / columns);
  const shelfCardWidth = Math.min(380, Math.floor((contentWidth - 3 * 26) / 4));
  const [about, setAbout] = useState<ChannelAbout | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [liveVideos, setLiveVideos] = useState<Video[]>([]);
  const [tab, setTab] = useState<ChannelContentTab>("videos");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState(false);
  const [focusedVideoIndex, setFocusedVideoIndex] = useState<number | null>(null);
  const [backTarget, setBackTarget] = useState<View | null>(null);
  const [firstLiveTarget, setFirstLiveTarget] = useState<View | null>(null);
  const [firstTabTarget, setFirstTabTarget] = useState<View | null>(null);
  const [firstVideoTarget, setFirstVideoTarget] = useState<View | null>(null);
  const retryRef = useRef<View>(null);
  const emptyRef = useRef<View>(null);
  const requestId = useRef(0);
  const handledFocusRequest = useRef<number | null>(null);
  const reveal = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(false);
    setFollowError(false);
    setFirstLiveTarget(null);
    setFirstTabTarget(null);
    setFirstVideoTarget(null);
    const [channelResult, aboutResult, videosResult, liveResult] = await Promise.allSettled([
      api.channel(channelId),
      api.channelAbout(channelId),
      api.channelVideos(channelId),
      api.channelLive(channelId),
    ]);
    if (currentRequest !== requestId.current) return;
    if (channelResult.status === "rejected" && aboutResult.status === "rejected") {
      setError(true);
      setLoading(false);
      return;
    }
    const nextAbout = aboutResult.status === "fulfilled" ? aboutResult.value : null;
    const nextChannel = channelResult.status === "fulfilled" ? channelResult.value.channel : null;
    setAbout(nextAbout);
    setChannel(nextChannel ?? {
      channel_id: channelId,
      title: nextAbout?.title ?? channelId,
      thumbnail: nextAbout?.avatar ?? "",
      tags: [],
    });
    if (videosResult.status === "fulfilled") {
      setVideos(videosResult.value.videos);
      setPage(videosResult.value.page);
      setHasMore(videosResult.value.videos.length === videosResult.value.limit);
    } else {
      setVideos([]);
      setHasMore(false);
    }
    setLiveVideos(liveResult.status === "fulfilled" ? liveResult.value.videos : []);
    setLoading(false);
  }, [api, channelId]);

  useEffect(() => {
    setTab("videos");
    setAbout(null);
    setChannel(null);
    setVideos([]);
    setLiveVideos([]);
    void load();
    return () => { requestId.current += 1; };
  }, [load]);

  const split = useMemo(() => splitChannelVideos(videos), [videos]);
  const tabs = useMemo(
    () => channelContentTabs(videos, about?.counts, shortsEnabled).map((item) => ({
      ...item,
      label: item.value === "shorts" ? t("navShorts") : t("videos"),
    })),
    [about?.counts, shortsEnabled, t, videos],
  );
  const visibleVideos = tab === "shorts" ? split.shorts : split.videos;
  const gridPerformance = useMemo(() => tvGridListPerformance(columns), [columns]);

  useEffect(() => {
    if (!tabs.some((item) => item.value === tab)) setTab("videos");
  }, [tab, tabs]);

  useEffect(() => {
    if (loading) {
      reveal.setValue(0);
      return;
    }
    const animation = Animated.timing(reveal, { toValue: 1, duration: 190, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [loading, reveal]);

  useEffect(() => {
    if (loading) return;
    const target = firstTabTarget ?? firstVideoTarget ?? backTarget ?? (error ? retryRef.current : emptyRef.current);
    if (!target || handledFocusRequest.current === focusRequest) return;
    handledFocusRequest.current = focusRequest;
    const frame = requestAnimationFrame(() => target.requestTVFocus());
    return () => cancelAnimationFrame(frame);
  }, [backTarget, error, firstTabTarget, firstVideoTarget, focusRequest, loading]);

  useEffect(() => {
    if (loading) return;
    const target = firstTabTarget ?? firstVideoTarget ?? backTarget ?? (error ? retryRef.current : emptyRef.current);
    onPrimaryFocusTarget(target);
    return () => onPrimaryFocusTarget(null);
  }, [backTarget, error, firstTabTarget, firstVideoTarget, loading, onPrimaryFocusTarget]);

  useVerticalFocusRedirect(
    focusedVideoIndex !== null && focusedVideoIndex < columns,
    firstTabTarget ?? firstLiveTarget ?? backTarget ?? profileFocusTarget,
  );

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const result = await api.channelVideos(channelId, page + 1);
      setVideos((current) => [...current, ...result.videos]);
      setPage(result.page);
      setHasMore(result.videos.length === result.limit);
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleFollow = async () => {
    if (!channel || followBusy) return;
    const followed = channel.followed === 1;
    setFollowBusy(true);
    setFollowError(false);
    try {
      await api.followChannel(channel.channel_id, !followed);
      setChannel((current) => current ? { ...current, followed: followed ? 0 : 1 } : current);
    } catch {
      setFollowError(true);
    } finally {
      setFollowBusy(false);
    }
  };

  const applyVideoChange = useCallback((updated: Video) => {
    setVideos((current) => current.map((video) => video.video_id === updated.video_id ? updated : video));
    setLiveVideos((current) => current.map((video) => video.video_id === updated.video_id ? updated : video));
  }, []);

  const renderVideo = useCallback(({ item, index }: ListRenderItemInfo<Video>) => {
    const focusProps = {
      ref: index === 0 ? setFirstVideoTarget : undefined,
      nextFocusUp: index < columns ? firstTabTarget ?? firstLiveTarget ?? backTarget ?? profileFocusTarget : undefined,
      onFocusChange: (focused: boolean) => setFocusedVideoIndex(focused ? index : (current) => current === index ? null : current),
      onLongPress: () => onVideoLongPress(item, applyVideoChange),
      onPress: () => onOpen(item),
    };
    return tab === "shorts" ? (
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
  }, [api, applyVideoChange, backTarget, cardWidth, columns, firstLiveTarget, firstTabTarget, language, onOpen, onVideoLongPress, profileFocusTarget, t, tab]);

  if (loading) {
    return (
      <View style={[styles.loadingScreen, { width, height }]}>
        <TvLoadingMark accessibilityLabel={t("loadingChannel")} />
      </View>
    );
  }

  if (error || !channel) {
    return (
      <View style={[styles.errorScreen, { width, height }]}>
        <Text style={styles.errorTitle}>{t("channelLoadError")}</Text>
        <View style={styles.errorActions}>
          <TvButton ref={retryRef} label={t("refresh")} preferredFocus onPress={() => void load()} />
          <TvButton label={t("back")} variant="ghost" onPress={onBack} />
        </View>
      </View>
    );
  }

  const title = about?.title || channel.title;
  const avatar = about?.avatar || channel.thumbnail;
  const description = about?.description || channel.description || "";
  const handle = about?.handle || channel.handle || "";
  const subscriberCount = about?.subscriberCount || channel.subscriber_count || "";
  const followed = channel.followed === 1;
  const inactive = channel.manual_status && channel.manual_status !== "active";

  const header = (
    <View>
      <View style={styles.hero}>
        {about?.banner ? <Image source={api.thumbnailSource(about.banner)} resizeMode="cover" style={styles.banner} /> : null}
        <View style={styles.heroShade} />
        <View style={styles.heroContent}>
          <View style={styles.avatarFrame}>
            {avatar ? <Image source={api.thumbnailSource(avatar)} resizeMode="cover" style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarInitial}>{title.trim()[0]?.toLocaleUpperCase() ?? "?"}</Text></View>}
          </View>
          <View style={styles.heroCopy}>
            <Text numberOfLines={1} style={styles.title}>{title}</Text>
            {(handle || subscriberCount) && (
              <Text numberOfLines={1} style={styles.meta}>
                {[handle, subscriberCount ? `${subscriberCount} ${t("subscribers")}` : ""].filter(Boolean).join("  •  ")}
              </Text>
            )}
            {description ? <Text numberOfLines={2} style={styles.description}>{description}</Text> : null}
            {channel.tags.length > 0 && (
              <View style={styles.tags}>
                {channel.tags.slice(0, 6).map((tag) => <View key={tag.id} style={styles.tag}><Text numberOfLines={1} style={styles.tagLabel}>{tag.name}</Text></View>)}
              </View>
            )}
            {inactive && <Text style={styles.inactive}>{t("channelInactive")}</Text>}
            {followError && <Text style={styles.followError}>{t("channelFollowError")}</Text>}
          </View>
          <View style={styles.heroActions}>
            <TvButton ref={setBackTarget} label={t("back")} nextFocusUp={profileFocusTarget} nextFocusDown={firstLiveTarget ?? firstTabTarget ?? undefined} onPress={onBack} />
            <TvButton disabled={followBusy} label={followed ? t("unfollow") : t("follow")} variant={followed ? "default" : "primary"} nextFocusUp={profileFocusTarget} nextFocusDown={firstLiveTarget ?? firstTabTarget ?? undefined} onPress={() => void toggleFollow()} />
          </View>
        </View>
      </View>

      <TvVideoShelf
        title={t("liveBadge")}
        videos={liveVideos}
        cardWidth={shelfCardWidth}
        firstItemRef={setFirstLiveTarget}
        language={language}
        nextFocusUp={backTarget ?? profileFocusTarget}
        nextFocusDown={firstTabTarget ?? firstVideoTarget ?? undefined}
        thumbnailSource={api.thumbnailSource.bind(api)}
        onOpen={onOpen}
        onLongPress={(video) => onVideoLongPress(video, applyVideoChange)}
        viewsLabel={t("views")}
      />

      <TvTabBar
        value={tab}
        options={tabs}
        firstItemRef={setFirstTabTarget}
        nextFocusUp={firstLiveTarget ?? backTarget ?? profileFocusTarget}
        nextFocusDown={firstVideoTarget ?? undefined}
        onChange={(next) => {
          setFirstVideoTarget(null);
          setFocusedVideoIndex(null);
          setTab(next);
        }}
      />
    </View>
  );

  return (
    <Animated.View style={[styles.screen, { width, height, opacity: reveal }]}>
      <FlatList
        key={`channel-${columns}`}
        style={[styles.list, { width, height }]}
        contentContainerStyle={[styles.content, { minHeight: height }]}
        data={visibleVideos}
        numColumns={columns}
        columnWrapperStyle={styles.row}
        keyExtractor={(video) => video.video_id}
        ListHeaderComponent={header}
        ListEmptyComponent={(
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{tab === "shorts" ? t("channelShortsEmpty") : t("channelVideosEmpty")}</Text>
            <TvButton ref={emptyRef} label={t("refresh")} onPress={() => void load()} style={styles.emptyAction} />
          </View>
        )}
        ListFooterComponent={hasMore && visibleVideos.length > 0 ? (
          <View style={styles.footer}>
            <TvButton label={loadingMore ? t("loadingChannel") : t("loadMore")} disabled={loadingMore} onPress={() => void loadMore()} />
          </View>
        ) : null}
        renderItem={renderVideo}
        {...gridPerformance}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 0, flexShrink: 0, backgroundColor: colors.background },
  loadingScreen: { flexGrow: 0, flexShrink: 0, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  list: { flexGrow: 0, flexShrink: 0 },
  content: { paddingHorizontal: screenPadding + 20, paddingTop: 60, paddingBottom: 90 },
  hero: { minHeight: 286, marginBottom: 34, borderRadius: 30, overflow: "hidden", backgroundColor: colors.surface },
  banner: { ...StyleSheet.absoluteFill, width: "100%", height: "100%", opacity: 0.58 },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(5,5,6,0.52)" },
  heroContent: { minHeight: 286, paddingHorizontal: 34, paddingVertical: 30, paddingRight: 40, flexDirection: "row", alignItems: "center", gap: 28 },
  avatarFrame: { width: 148, height: 148, borderRadius: 74, overflow: "hidden", backgroundColor: colors.surfaceRaised, shadowColor: colors.black, shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  avatar: { width: "100%", height: "100%", backgroundColor: colors.surfaceRaised },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: colors.white, fontSize: 54, fontWeight: "800" },
  heroCopy: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 44, lineHeight: 51, fontWeight: "800", letterSpacing: -1.25 },
  meta: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: "600", marginTop: 6, opacity: 0.82 },
  description: { color: colors.text, fontSize: 17, lineHeight: 24, marginTop: 13, maxWidth: 740, opacity: 0.78 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  tag: { maxWidth: 170, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.12)" },
  tagLabel: { color: colors.text, fontSize: 14, lineHeight: 18, fontWeight: "700" },
  inactive: { color: colors.warning, fontSize: 15, fontWeight: "700", marginTop: 11 },
  followError: { color: colors.danger, fontSize: 15, fontWeight: "700", marginTop: 8 },
  heroActions: { alignItems: "stretch", gap: 12, minWidth: 170 },
  row: { gap: 28 },
  empty: { minHeight: 310, alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: colors.text, fontSize: 31, fontWeight: "800" },
  emptyAction: { marginTop: 22 },
  footer: { alignItems: "center", paddingTop: 12, paddingBottom: 30 },
  errorScreen: { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  errorTitle: { color: colors.text, fontSize: 34, lineHeight: 42, fontWeight: "800" },
  errorActions: { flexDirection: "row", gap: 14, marginTop: 26 },
});
