import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, FlatList, StyleSheet, Text, View, type FocusDestination, type ListRenderItemInfo } from "react-native";
import type { YtZeroApi } from "../api";
import { BookmarkRow } from "../components/BookmarkRow";
import { TvButton } from "../components/TvButton";
import { TvLoadingMark } from "../components/TvLoadingMark";
import type { VideoActionOptions } from "../components/TvVideoActionMenu";
import { useVerticalFocusRedirect } from "../focus";
import { localeTags, type Translate } from "../i18n";
import { tvVerticalListPerformance } from "../listPerformance";
import { colors, screenPadding } from "../theme";
import type { BookmarkVideo, Language, Video } from "../types";

type Props = {
  api: YtZeroApi;
  focusRequest: number;
  language: Language;
  profileFocusTarget: FocusDestination;
  onPrimaryFocusTarget: (target: View | null) => void;
  onOpen: (video: Video) => void;
  onVideoLongPress: (video: Video, onChange: (updated: Video) => void, options?: VideoActionOptions) => void;
  t: Translate;
  viewportHeight: number;
  viewportWidth: number;
};

export function BookmarksScreen({ api, focusRequest, language, profileFocusTarget, onPrimaryFocusTarget, onOpen, onVideoLongPress, t, viewportHeight: height, viewportWidth: width }: Props) {
  const [bookmarks, setBookmarks] = useState<BookmarkVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [firstBookmarkTarget, setFirstBookmarkTarget] = useState<View | null>(null);
  const handledFocusRequest = useRef<number | null>(null);
  const retryRef = useRef<View>(null);
  const emptyRef = useRef<View>(null);
  const reveal = useRef(new Animated.Value(0)).current;
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(localeTags[language], { dateStyle: "medium", timeStyle: "short" }),
    [language],
  );
  const formatDate = useCallback((value: string): string => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : dateFormatter.format(date);
  }, [dateFormatter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    setFirstBookmarkTarget(null);
    try {
      setBookmarks((await api.bookmarks()).bookmarks);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (loading) {
      reveal.setValue(0);
      return;
    }
    const animation = Animated.timing(reveal, { toValue: 1, duration: 170, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [loading, reveal]);

  useEffect(() => {
    if (loading) return;
    const target = firstBookmarkTarget ?? (error ? retryRef.current : emptyRef.current);
    if (!target || handledFocusRequest.current === focusRequest) return;
    handledFocusRequest.current = focusRequest;
    const frame = requestAnimationFrame(() => target.requestTVFocus());
    return () => cancelAnimationFrame(frame);
  }, [error, firstBookmarkTarget, focusRequest, loading]);

  useEffect(() => {
    if (loading) return;
    const target = firstBookmarkTarget ?? (error ? retryRef.current : emptyRef.current);
    onPrimaryFocusTarget(target);
    return () => onPrimaryFocusTarget(null);
  }, [error, firstBookmarkTarget, loading, onPrimaryFocusTarget]);

  useVerticalFocusRedirect(focusedIndex === 0, profileFocusTarget);

  const applyVideoChange = useCallback((updated: Video) => {
    setBookmarks((current) => current.map((bookmark) => bookmark.video_id === updated.video_id ? { ...bookmark, ...updated } : bookmark));
  }, []);

  const renderBookmark = useCallback(({ item, index }: ListRenderItemInfo<BookmarkVideo>) => (
    <BookmarkRow
      ref={index === 0 ? setFirstBookmarkTarget : undefined}
      bookmark={item}
      dateLabel={formatDate(item.bookmarked_at)}
      emptyDescriptionLabel={t("bookmarkSavedMoment")}
      thumbnailSource={api.thumbnailSource(item.thumbnail)}
      nextFocusUp={index === 0 ? profileFocusTarget : undefined}
      onFocusChange={(focused) => setFocusedIndex(focused ? index : (current) => current === index ? null : current)}
      onLongPress={() => onVideoLongPress(item, applyVideoChange)}
      onPress={() => onOpen(item)}
    />
  ), [api, applyVideoChange, formatDate, onOpen, onVideoLongPress, profileFocusTarget, t]);

  if (loading) {
    return (
      <View style={[styles.loadingScreen, { width, height }]}>
        <TvLoadingMark accessibilityLabel={t("loadingBookmarks")} />
      </View>
    );
  }

  return (
    <Animated.View style={[styles.screen, { width, height, opacity: reveal }]}>
      <FlatList
        style={[styles.list, { width, height }]}
        contentContainerStyle={[styles.content, { minHeight: height }]}
        data={bookmarks}
        keyExtractor={(bookmark) => bookmark.bookmark_id}
        ListHeaderComponent={(
          <View style={styles.heading}>
            <Text style={styles.title}>{t("navBookmarks")}</Text>
            <Text style={styles.description}>{t("bookmarksDescription")}</Text>
            {error && (
              <View style={styles.errorRow}>
                <Text style={styles.error}>{t("bookmarksLoadError")}</Text>
                <TvButton ref={retryRef} label={t("refresh")} nextFocusUp={profileFocusTarget} onPress={() => void load()} />
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={!error ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t("bookmarksEmpty")}</Text>
            <Text style={styles.emptyHint}>{t("bookmarksEmptyHint")}</Text>
            <TvButton ref={emptyRef} label={t("refresh")} nextFocusUp={profileFocusTarget} onPress={() => void load()} style={styles.emptyAction} />
          </View>
        ) : null}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={renderBookmark}
        {...tvVerticalListPerformance}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 0, flexShrink: 0, backgroundColor: colors.background },
  loadingScreen: { flexGrow: 0, flexShrink: 0, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  list: { flexGrow: 0, flexShrink: 0 },
  content: { paddingHorizontal: screenPadding + 20, paddingTop: 66, paddingBottom: 90 },
  heading: { marginBottom: 32 },
  title: { color: colors.text, fontSize: 54, lineHeight: 62, fontWeight: "700", letterSpacing: -1.8 },
  description: { color: colors.textMuted, fontSize: 21, lineHeight: 29, marginTop: 10, maxWidth: 920 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 22, marginTop: 24 },
  error: { color: colors.danger, fontSize: 20, fontWeight: "700" },
  separator: { height: 18 },
  empty: { minHeight: 480, alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: colors.text, fontSize: 34, fontWeight: "800" },
  emptyHint: { color: colors.textMuted, fontSize: 19, lineHeight: 27, marginTop: 10, maxWidth: 680, textAlign: "center" },
  emptyAction: { marginTop: 24 },
});
