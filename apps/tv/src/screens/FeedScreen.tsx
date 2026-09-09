import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import type { YtZeroApi } from "../api";
import type { Translate } from "../i18n";
import type { Video } from "../types";
import { TvButton } from "../components/TvButton";
import { VideoCard } from "../components/VideoCard";
import { colors, screenPadding } from "../theme";

type FeedSort = "published" | "arrival";

type Props = {
  api: YtZeroApi;
  t: Translate;
  onOpen: (video: Video) => void;
  viewportHeight: number;
  viewportWidth: number;
};

export function FeedScreen({ api, t, onOpen, viewportHeight: height, viewportWidth: width }: Props) {
  const columns = width >= 1700 ? 5 : width >= 1220 ? 4 : 3;
  const contentWidth = Math.max(720, width - screenPadding * 2);
  const cardWidth = Math.floor((contentWidth - (columns - 1) * 28) / columns);
  const [videos, setVideos] = useState<Video[]>([]);
  const [sort, setSort] = useState<FeedSort>("published");
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (__DEV__) console.info("[YT Zero TV] feed state", { width, height, columns, loading, error, videoCount: videos.length });
  }, [columns, error, height, loading, videos.length, width]);

  const load = useCallback(async (nextPage: number) => {
    nextPage === 0 ? setLoading(true) : setLoadingMore(true);
    setError(false);
    try {
      const result = await api.feed({ page: nextPage, showAll, sort });
      setVideos((current) => nextPage === 0 ? result.videos : [...current, ...result.videos]);
      setPage(nextPage);
      setHasMore(result.videos.length === result.limit);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [api, showAll, sort]);

  useEffect(() => { void load(0); }, [load]);

  const header = useMemo(() => (
    <View>
      <View style={styles.heading}>
        <Text style={styles.title}>{t("feedTitle")}</Text>
        <View style={styles.filters}>
          <TvButton label={t("published")} variant={sort === "published" ? "primary" : "default"} onPress={() => setSort("published")} />
          <TvButton label={t("arrival")} variant={sort === "arrival" ? "primary" : "default"} onPress={() => setSort("arrival")} />
          <TvButton label={showAll ? t("allVideos") : t("inboxOnly")} variant={showAll ? "primary" : "default"} onPress={() => setShowAll((value) => !value)} />
        </View>
      </View>
      {error && (
        <View style={styles.errorRow}>
          <Text style={styles.error}>{t("loadError")}</Text>
          <TvButton label={t("retry")} onPress={() => void load(0)} />
        </View>
      )}
    </View>
  ), [error, load, showAll, sort, t]);

  if (loading) {
    return <View style={styles.center} onLayout={traceLayout}><ActivityIndicator color={colors.accentStrong} size="large" /><Text style={styles.status}>{t("loadingFeed")}</Text></View>;
  }

  return (
    <FlatList
      key={`feed-${columns}`}
      style={[styles.screen, { width, height }]}
      onLayout={traceLayout}
      contentContainerStyle={[styles.content, { minHeight: height }]}
      data={videos}
      numColumns={columns}
      columnWrapperStyle={styles.row}
      keyExtractor={(video) => video.video_id}
      ListHeaderComponent={header}
      ListEmptyComponent={!error ? <View style={styles.empty}><Text style={styles.emptyTitle}>{t("emptyFeed")}</Text><Text style={styles.emptyHint}>{t("emptyFeedHint")}</Text></View> : null}
      ListFooterComponent={hasMore && videos.length > 0 ? (
        <View style={styles.footer}>
          <TvButton label={loadingMore ? t("loadingFeed") : t("loadMore")} disabled={loadingMore} onPress={() => void load(page + 1)} />
        </View>
      ) : null}
      renderItem={({ item, index }) => (
        <VideoCard
          video={item}
          width={cardWidth}
          thumbnailSource={api.thumbnailSource(item.thumbnail)}
          preferredFocus={index === 0}
          onPress={() => onOpen(item)}
        />
      )}
      extraData={{ cardWidth, error, hasMore, loadingMore }}
      removeClippedSubviews={false}
      initialNumToRender={columns * 3}
      windowSize={7}
    />
  );

  function traceLayout(event: LayoutChangeEvent) {
    if (__DEV__) console.info("[YT Zero TV] feed layout", event.nativeEvent.layout);
  }
}

const styles = StyleSheet.create({
  screen: { flexGrow: 0, flexShrink: 0, backgroundColor: colors.background },
  content: { paddingHorizontal: screenPadding, paddingTop: 48, paddingBottom: 80 },
  heading: { alignItems: "flex-start", marginTop: 18, marginBottom: 34 },
  title: { color: colors.text, fontSize: 54, lineHeight: 62, fontWeight: "700", letterSpacing: -1.8 },
  filters: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 25 },
  row: { gap: 28 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 20 },
  status: { color: colors.textMuted, fontSize: 21 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 22, marginBottom: 28 },
  error: { color: colors.danger, fontSize: 20, fontWeight: "700" },
  empty: { minHeight: 400, alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: colors.text, fontSize: 34, fontWeight: "800" },
  emptyHint: { color: colors.textMuted, fontSize: 19, lineHeight: 27, marginTop: 10, maxWidth: 620, textAlign: "center" },
  footer: { alignItems: "center", paddingTop: 14, paddingBottom: 30 },
});
