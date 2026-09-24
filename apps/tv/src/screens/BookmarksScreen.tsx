import { TvEmptyState } from "../components/TvEmptyState";
import { TvPageHeading } from "../components/TvPageHeading";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, View, type FocusDestination, type ListRenderItemInfo } from "react-native";
import type { YtZeroApi } from "../api";
import { BookmarkRow } from "../components/BookmarkRow";
import { applyBookmarkVideoUpdate } from "../bookmarkUpdates";
import { TvButton } from "../components/TvButton";
import { TvLoadingMark } from "../components/TvLoadingMark";
import type { VideoActionOptions } from "../components/TvVideoActionMenu";
import { sessionContext, type OpenVideo } from "../playbackQueue";
import { focusWhenReady, useContentFocusAllowed } from "../focus";
import { localeTags, type Translate } from "../i18n";
import { tvVerticalListPerformance } from "../listPerformance";
import { colors, typography, screenPadding } from "../theme";
import type { BookmarkVideo, Language, Video } from "../types";

type Props = {
  api: YtZeroApi;
  videoUpdate: Video | null;
  focusRequest: number;
  language: Language;
  profileFocusTarget: FocusDestination;
  onPrimaryFocusTarget: (target: View | null) => void;
  onOpen: OpenVideo;
  onVideoLongPress: (video: Video, onChange: (updated: Video) => void, options?: VideoActionOptions) => void;
  t: Translate;
  viewportHeight: number;
  viewportWidth: number;
};

const bookmarkKey = (bookmark: BookmarkVideo) => bookmark.bookmark_id;
const renderSeparator = () => <View style={styles.separator} />;

export function BookmarksScreen({ api, videoUpdate, focusRequest, language, profileFocusTarget, onPrimaryFocusTarget, onOpen, onVideoLongPress, t, viewportHeight: height, viewportWidth: width }: Props) {
  const contentFocusAllowed = useContentFocusAllowed();
  const [bookmarks, setBookmarks] = useState<BookmarkVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [firstBookmarkTarget, setFirstBookmarkTarget] = useState<View | null>(null);
  const bookmarksRef = useRef(bookmarks);
  bookmarksRef.current = bookmarks;
  const handledFocusRequest = useRef<number | null>(null);
  const retryRef = useRef<View>(null);
  const emptyRef = useRef<View>(null);
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
    if (loading || !contentFocusAllowed) return;
    const target = firstBookmarkTarget ?? (error ? retryRef.current : emptyRef.current);
    if (!target || handledFocusRequest.current === focusRequest) return;
    return focusWhenReady(target, () => { handledFocusRequest.current = focusRequest; });
  }, [contentFocusAllowed, error, firstBookmarkTarget, focusRequest, loading]);

  useEffect(() => {
    if (loading) return;
    const target = firstBookmarkTarget ?? (error ? retryRef.current : emptyRef.current);
    onPrimaryFocusTarget(target);
    return () => onPrimaryFocusTarget(null);
  }, [error, firstBookmarkTarget, loading, onPrimaryFocusTarget]);


  const applyVideoChange = useCallback((updated: Video) => {
    setBookmarks((current) => applyBookmarkVideoUpdate(current, updated));
  }, []);

  useEffect(() => { if (videoUpdate) applyVideoChange(videoUpdate); }, [applyVideoChange, videoUpdate]);

  const openBookmark = useCallback((bookmark: BookmarkVideo) => {
    onOpen(bookmark, sessionContext(bookmarksRef.current), undefined, bookmark.position_seconds);
  }, [onOpen]);
  const openBookmarkActions = useCallback((bookmark: BookmarkVideo) => {
    onVideoLongPress(bookmark, applyVideoChange);
  }, [applyVideoChange, onVideoLongPress]);
  const renderBookmark = useCallback(({ item, index }: ListRenderItemInfo<BookmarkVideo>) => (
    <BookmarkRow
      ref={index === 0 ? setFirstBookmarkTarget : undefined}
      bookmark={item}
      dateLabel={formatDate(item.bookmarked_at)}
      emptyDescriptionLabel={t("bookmarkSavedMoment")}
      actionsLabel={t("videoActions")}
      thumbnailSource={api.thumbnailSource(item.thumbnail)}
      nextFocusUp={index === 0 ? profileFocusTarget : undefined}

      onLongPress={() => openBookmarkActions(item)}
      onPress={() => openBookmark(item)}
    />
  ), [api, formatDate, openBookmark, openBookmarkActions, profileFocusTarget, t]);

  if (loading) {
    return (
      <View style={[styles.loadingScreen, { width, height }]}>
        <TvLoadingMark accessibilityLabel={t("loadingBookmarks")} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { width, height }]}>
      <FlatList
        style={[styles.list, { width, height }]}
        contentContainerStyle={[styles.content, { minHeight: height }]}
        data={bookmarks}
        keyExtractor={bookmarkKey}
        ListHeaderComponent={(
          <View style={styles.heading}>
            <TvPageHeading title={t("navBookmarks")} />
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
          <TvEmptyState icon="bookmarks" title={t("bookmarksEmpty")} description={t("bookmarksEmptyHint")}
            action={<TvButton ref={emptyRef} label={t("refresh")} nextFocusUp={profileFocusTarget} onPress={() => void load()} />} />
        ) : null}
        ItemSeparatorComponent={renderSeparator}
        renderItem={renderBookmark}
        {...tvVerticalListPerformance}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 0, flexShrink: 0, backgroundColor: colors.background },
  loadingScreen: { flexGrow: 0, flexShrink: 0, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  list: { flexGrow: 0, flexShrink: 0 },
  content: { paddingHorizontal: screenPadding + 20, paddingTop: 132, paddingBottom: 90 },
  heading: { marginBottom: 32 },
  description: { color: colors.textMuted, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, marginTop: 10, maxWidth: 920 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 22, marginTop: 24 },
  error: { color: colors.danger, fontSize: typography.caption.fontSize, fontWeight: "700" },
  separator: { height: 18 },
});
