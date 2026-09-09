import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, TVFocusGuideView, useWindowDimensions, View, type FocusDestination, type ListRenderItemInfo } from "react-native";
import type { YtZeroApi } from "../api";
import { TvButton } from "../components/TvButton";
import { TvLoadingMark } from "../components/TvLoadingMark";
import { TvVideoShelf } from "../components/TvVideoShelf";
import type { VideoActionOptions } from "../components/TvVideoActionMenu";
import { useVerticalFocusRedirect } from "../focus";
import { localeTags, type Translate } from "../i18n";
import { tvVerticalListPerformance } from "../listPerformance";
import { colors, screenPadding } from "../theme";
import type { Language, TvProfileSettings, Video, VideoComment } from "../types";

type Props = {
  api: YtZeroApi;
  language: Language;
  t: Translate;
  video: Video;
  onBack: () => void;
  onOpenChannel?: (channelId: string) => void;
  onOpenVideo: (video: Video) => void;
  onSourceVisibilityChange: (videoId: string, hidden: boolean) => void;
  onVideoLongPress: (video: Video, onChange: (updated: Video) => void, options?: VideoActionOptions) => void;
};

type Mutation = "watched" | "liked" | "scheduled" | "archived";
type CommentsMode = "disabled" | "scroll" | "auto";
type FocusArea = "back" | "channel" | "actions" | "comments";

function commentsMode(value: TvProfileSettings["watch_show_comments"]): CommentsMode {
  if (value === "auto") return "auto";
  if (value === "1" || value === "scroll") return "scroll";
  return "disabled";
}

function validDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

export function WatchScreen({ api, language, t, video: preview, onBack, onOpenChannel, onOpenVideo, onSourceVisibilityChange, onVideoLongPress }: Props) {
  const { width } = useWindowDimensions();
  const [video, setVideo] = useState(preview);
  const [related, setRelated] = useState<Video[]>([]);
  const [settings, setSettings] = useState<TvProfileSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState<Mutation | null>(null);
  const [actionError, setActionError] = useState(false);
  const [portraitFailed, setPortraitFailed] = useState(false);
  const [comments, setComments] = useState<VideoComment[] | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState(false);
  const [backTarget, setBackTarget] = useState<View | null>(null);
  const [channelTarget, setChannelTarget] = useState<View | null>(null);
  const [firstActionTarget, setFirstActionTarget] = useState<View | null>(null);
  const [relatedTarget, setRelatedTarget] = useState<View | null>(null);
  const [commentsTarget, setCommentsTarget] = useState<View | null>(null);
  const [focusArea, setFocusArea] = useState<FocusArea | null>(null);

  useVerticalFocusRedirect(focusArea === "back", undefined, channelTarget ?? firstActionTarget ?? relatedTarget ?? commentsTarget ?? undefined);
  useVerticalFocusRedirect(focusArea === "channel", backTarget ?? undefined, firstActionTarget ?? relatedTarget ?? commentsTarget ?? undefined);
  useVerticalFocusRedirect(focusArea === "actions", channelTarget ?? backTarget ?? undefined, relatedTarget ?? commentsTarget ?? undefined);
  useVerticalFocusRedirect(focusArea === "comments", relatedTarget ?? firstActionTarget ?? channelTarget ?? backTarget ?? undefined, undefined);

  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    setCommentsError(false);
    try {
      const result = await api.videoComments(preview.video_id);
      setComments(result.comments.slice(0, 18));
    } catch {
      setCommentsError(true);
    } finally {
      setCommentsLoading(false);
    }
  }, [api, preview.video_id]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setActionError(false);
    try {
      const [page, settingsResult] = await Promise.all([
        api.video(preview.video_id),
        api.settings().catch(() => null),
      ]);
      setVideo(page.video);
      setRelated(page.related);
      setSettings(settingsResult?.settings ?? null);
      if (commentsMode(settingsResult?.settings.watch_show_comments) === "auto") {
        void loadComments();
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [api, loadComments, preview.video_id]);

  useEffect(() => {
    setVideo(preview);
    setRelated([]);
    setSettings(null);
    setComments(null);
    setCommentsError(false);
    setPortraitFailed(false);
    void load();
  }, [load, preview]);

  const mutate = async (action: Mutation) => {
    if (busy) return;
    setBusy(action);
    setActionError(false);
    try {
      if (action === "watched") {
        const watched = video.watched !== 1;
        if (watched) await api.markWatched(video.video_id);
        else await api.markUnwatched(video.video_id);
        setVideo((current) => ({ ...current, watched: watched ? 1 : 0 }));
        onSourceVisibilityChange(video.video_id, watched);
      } else if (action === "liked") {
        const liked = video.liked !== 1;
        await api.likeVideo(video.video_id, liked);
        setVideo((current) => ({ ...current, liked: liked ? 1 : 0 }));
      } else if (action === "scheduled") {
        const scheduled = video.status === "queued";
        if (scheduled) await api.dequeue(video.video_id);
        else await api.queue(video.video_id, "today");
        setVideo((current) => ({ ...current, status: scheduled ? "inbox" : "queued", bucket: scheduled ? null : "today" }));
      } else {
        const archived = video.status === "archived";
        if (archived) await api.restore(video.video_id);
        else await api.reject(video.video_id);
        setVideo((current) => ({ ...current, status: archived ? "inbox" : "archived", bucket: null }));
        onSourceVisibilityChange(video.video_id, !archived);
      }
    } catch {
      setActionError(true);
    } finally {
      setBusy(null);
    }
  };

  const locale = localeTags[language];
  const publishedAt = validDate(video.published_at);
  const published = publishedAt ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(publishedAt) : "";
  const views = typeof video.views === "number"
    ? `${new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(video.views)} ${t("views")}`
    : "";
  const metadata = [published, views, video.duration].filter(Boolean);
  const progress = video.watch_position && video.watch_duration
    ? Math.max(0, Math.min(100, video.watch_position / video.watch_duration * 100))
    : 0;
  const mode = commentsMode(settings?.watch_show_comments);
  const showRelated = settings?.watch_show_related !== "0";
  const short = video.is_short === 1;
  const cardWidth = useMemo(() => Math.max(300, Math.min(390, (width - screenPadding * 2 - 78) / 4)), [width]);
  const visibleComments = mode === "disabled" ? [] : comments ?? [];
  const renderComment = useCallback(({ item }: ListRenderItemInfo<VideoComment>) => (
    <CommentCard api={api} comment={item} t={t} />
  ), [api, t]);
  const applyRelatedVideoChange = useCallback((updated: Video) => {
    setRelated((current) => current
      .map((item) => item.video_id === updated.video_id ? updated : item)
      .filter((item) => item.video_id !== updated.video_id || updated.status !== "archived"));
  }, []);

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      data={visibleComments}
      keyExtractor={(comment) => comment.id}
      renderItem={renderComment}
      {...tvVerticalListPerformance}
      ListHeaderComponent={(
        <>
      <View style={styles.topBar}>
        <TvButton
          ref={setBackTarget}
          label={t("back")}
          variant="ghost"
          preferredFocus
          nextFocusDown={channelTarget ?? firstActionTarget ?? relatedTarget ?? commentsTarget ?? undefined}
          onFocus={() => setFocusArea("back")}
          onBlur={() => setFocusArea((current) => current === "back" ? null : current)}
          onPress={onBack}
        />
        {loading ? <TvLoadingMark accessibilityLabel={t("loadingVideo")} size={28} /> : null}
      </View>

      {loadError ? (
        <View style={styles.errorPanel}>
          <Text style={styles.errorText}>{t("videoLoadError")}</Text>
          <TvButton label={t("tryAgain")} onPress={() => void load()} />
        </View>
      ) : null}

      <View style={[styles.hero, short && styles.shortHero]}>
        <View style={[styles.imageFrame, short && styles.shortImageFrame]}>
          {video.thumbnail ? (
            <Image
              source={short && !portraitFailed ? api.shortThumbnailSource(video.video_id) : api.thumbnailSource(video.thumbnail)}
              resizeMode="cover"
              style={styles.image}
              onError={short && !portraitFailed ? () => setPortraitFailed(true) : undefined}
            />
          ) : (
            <View style={styles.imagePlaceholder}><Text style={styles.imagePlaceholderText}>YT Zero</Text></View>
          )}
          <View style={styles.posterShade} />
          {video.duration ? <View style={styles.duration}><Text style={styles.durationText}>{video.duration}</Text></View> : null}
          {progress > 0 ? <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View> : null}
        </View>

        <View style={styles.copy}>
          <View style={styles.badges}>
            {video.live_status === "live" ? <MetaBadge label={t("liveBadge")} strong /> : null}
            {video.members_only === 1 ? <MetaBadge label={t("membersOnly")} /> : null}
            {video.is_private === 1 ? <MetaBadge label={t("privateVideo")} /> : null}
            {video.tags?.filter((tag) => tag.filter_only !== 1).slice(0, 3).map((tag) => <MetaBadge key={tag.id} label={tag.name} />)}
          </View>
          <Text style={styles.title}>{video.title}</Text>
          {metadata.length > 0 ? <Text style={styles.meta}>{metadata.join("  •  ")}</Text> : null}

          {video.channel_id && onOpenChannel ? (
            <ChannelButton
              onTargetReady={setChannelTarget}
              api={api}
              video={video}
              nextFocusUp={backTarget ?? undefined}
              nextFocusDown={firstActionTarget ?? relatedTarget ?? commentsTarget ?? undefined}
              onFocusChange={(focused) => setFocusArea((current) => focused ? "channel" : current === "channel" ? null : current)}
              onPress={() => onOpenChannel(video.channel_id!)}
            />
          ) : (
            <Text style={styles.channelName}>{video.channel_title}</Text>
          )}

          <View style={styles.actions}>
            {video.status !== "archived" ? (
              <TvButton
                ref={setFirstActionTarget}
                label={video.status === "queued" ? t("removeSchedule") : t("scheduleToday")}
                variant="primary"
                disabled={busy !== null}
                nextFocusUp={channelTarget ?? backTarget ?? undefined}
                nextFocusDown={relatedTarget ?? commentsTarget ?? undefined}
                onFocus={() => setFocusArea("actions")}
                onBlur={() => setFocusArea((current) => current === "actions" ? null : current)}
                onPress={() => void mutate("scheduled")}
              />
            ) : null}
            <TvButton
              ref={video.status === "archived" ? setFirstActionTarget : undefined}
              label={video.watched === 1 ? t("markUnwatched") : t("markWatched")}
              disabled={busy !== null}
              nextFocusUp={channelTarget ?? backTarget ?? undefined}
              nextFocusDown={relatedTarget ?? commentsTarget ?? undefined}
              onFocus={() => setFocusArea("actions")}
              onBlur={() => setFocusArea((current) => current === "actions" ? null : current)}
              onPress={() => void mutate("watched")}
            />
            <TvButton
              label={video.liked === 1 ? t("unlike") : t("like")}
              disabled={busy !== null}
              nextFocusUp={channelTarget ?? backTarget ?? undefined}
              nextFocusDown={relatedTarget ?? commentsTarget ?? undefined}
              onFocus={() => setFocusArea("actions")}
              onBlur={() => setFocusArea((current) => current === "actions" ? null : current)}
              onPress={() => void mutate("liked")}
            />
            <TvButton
              label={video.status === "archived" ? t("restoreVideo") : t("reject")}
              variant={video.status === "archived" ? "default" : "danger"}
              disabled={busy !== null}
              nextFocusUp={channelTarget ?? backTarget ?? undefined}
              nextFocusDown={relatedTarget ?? commentsTarget ?? undefined}
              onFocus={() => setFocusArea("actions")}
              onBlur={() => setFocusArea((current) => current === "actions" ? null : current)}
              onPress={() => void mutate("archived")}
            />
          </View>
          {actionError ? <Text style={styles.actionError}>{t("actionFailed")}</Text> : null}
        </View>
      </View>

      {showRelated && relatedTarget ? <TVFocusGuideView destinations={[relatedTarget]} style={styles.heroFocusBridge} /> : null}

      <View style={styles.descriptionSection}>
        <Text style={styles.sectionTitle}>{t("descriptionTitle")}</Text>
        <Text style={styles.description}>{video.description || t("noDescription")}</Text>
      </View>

      {showRelated ? (
        <>
          <TvVideoShelf
            title={t("relatedVideos")}
            videos={related}
            cardWidth={cardWidth}
            firstItemRef={setRelatedTarget}
            language={language}
            nextFocusUp={firstActionTarget ?? channelTarget ?? backTarget ?? undefined}
            nextFocusDown={commentsTarget ?? undefined}
            thumbnailSource={api.thumbnailSource.bind(api)}
            onOpen={onOpenVideo}
            onLongPress={(relatedVideo) => onVideoLongPress(relatedVideo, applyRelatedVideoChange)}
            viewsLabel={t("views")}
          />
          {relatedTarget && commentsTarget ? <TVFocusGuideView destinations={[commentsTarget]} style={styles.shelfFocusBridge} /> : null}
        </>
      ) : null}

      {mode !== "disabled" ? (
        <View style={styles.commentsSection}>
          <Text style={styles.sectionTitle}>{t("commentsTitle")}</Text>
          <View style={styles.commentsToolbar}>
            <TvButton
              ref={setCommentsTarget}
              label={commentsLoading ? t("loadingComments") : commentsError ? t("tryAgain") : comments === null ? t("loadComments") : t("refresh")}
              style={styles.inlineButton}
              nextFocusUp={relatedTarget ?? firstActionTarget ?? channelTarget ?? backTarget ?? undefined}
              onFocus={() => {
                setFocusArea("comments");
                if (mode === "scroll" && comments === null && !commentsLoading && !commentsError) void loadComments();
              }}
              onBlur={() => setFocusArea((current) => current === "comments" ? null : current)}
              onPress={() => { if (!commentsLoading) void loadComments(); }}
            />
            {commentsLoading ? <TvLoadingMark accessibilityLabel={t("loadingComments")} size={27} /> : null}
          </View>
          {commentsError ? <Text style={styles.commentsStatus}>{t("commentsLoadError")}</Text> : null}
          {comments?.length === 0 ? <Text style={styles.commentsStatus}>{t("commentsEmpty")}</Text> : null}
        </View>
      ) : null}
        </>
      )}
    />
  );
}

function MetaBadge({ label, strong = false }: { label: string; strong?: boolean }) {
  return <View style={[styles.badge, strong && styles.badgeStrong]}><Text style={[styles.badgeText, strong && styles.badgeStrongText]}>{label}</Text></View>;
}

function ChannelButton({ api, video, nextFocusUp, nextFocusDown, onTargetReady, onFocusChange, onPress }: { api: YtZeroApi; video: Video; nextFocusUp?: FocusDestination; nextFocusDown?: FocusDestination; onTargetReady: (target: View | null) => void; onFocusChange: (focused: boolean) => void; onPress: () => void }) {
  const [focused, setFocused] = useState(false);
  const avatar = video.channel_thumbnail ? api.thumbnailSource(video.channel_thumbnail) : null;
  return (
    <Pressable
      ref={onTargetReady}
      accessibilityRole="button"
      accessibilityLabel={video.channel_title}
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      onFocus={() => { setFocused(true); onFocusChange(true); }}
      onBlur={() => { setFocused(false); onFocusChange(false); }}
      onPress={onPress}
      style={({ pressed }) => [styles.channelButton, focused && styles.channelButtonFocused, pressed && styles.channelButtonPressed]}
    >
      {avatar?.uri ? <Image source={avatar} style={styles.channelAvatar} /> : <View style={[styles.channelAvatar, styles.channelAvatarPlaceholder]} />}
      <View style={styles.channelCopy}>
        <Text numberOfLines={1} style={[styles.channelTitle, focused && styles.channelTextFocused]}>{video.channel_title}</Text>
        {video.channel_subscriber_count ? <Text style={[styles.channelSubscribers, focused && styles.channelSubTextFocused]}>{video.channel_subscriber_count}</Text> : null}
      </View>
    </Pressable>
  );
}

function CommentCard({ api, comment, t }: { api: YtZeroApi; comment: VideoComment; t: Translate }) {
  const avatar = comment.authorThumbnail ? api.thumbnailSource(comment.authorThumbnail) : null;
  const flags = [comment.isPinned ? t("pinnedComment") : "", comment.authorIsUploader ? t("creatorComment") : "", comment.timeText ?? ""].filter(Boolean);
  return (
    <View style={styles.commentCard}>
      {avatar?.uri ? <Image source={avatar} style={styles.commentAvatar} /> : <View style={[styles.commentAvatar, styles.channelAvatarPlaceholder]} />}
      <View style={styles.commentCopy}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentAuthor}>{comment.author}</Text>
          {flags.length > 0 ? <Text style={styles.commentMeta}>{flags.join("  •  ")}</Text> : null}
          {comment.likeCount > 0 ? <Text style={styles.commentMeta}>♥ {comment.likeCount}</Text> : null}
        </View>
        <Text numberOfLines={6} style={styles.commentText}>{comment.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: screenPadding, paddingTop: 44, paddingBottom: 110 },
  topBar: { minHeight: 72, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 22 },
  errorPanel: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 24, paddingVertical: 18, paddingHorizontal: 22, marginBottom: 24, borderRadius: 22, backgroundColor: "rgba(255,159,154,0.12)" },
  errorText: { flex: 1, color: colors.danger, fontSize: 19, lineHeight: 25, fontWeight: "700" },
  hero: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 54 },
  shortHero: { alignItems: "center" },
  imageFrame: { width: "57%", aspectRatio: 16 / 9, borderRadius: 30, overflow: "hidden", backgroundColor: colors.surface, shadowColor: colors.black, shadowOpacity: 0.62, shadowRadius: 34, shadowOffset: { width: 0, height: 18 } },
  shortImageFrame: { width: 410, aspectRatio: 9 / 16 },
  image: { width: "100%", height: "100%", backgroundColor: colors.surface },
  imagePlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  imagePlaceholderText: { color: colors.textMuted, fontSize: 34, fontWeight: "800" },
  posterShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "30%", backgroundColor: "rgba(0,0,0,0.12)" },
  duration: { position: "absolute", right: 16, bottom: 18, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.78)" },
  durationText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  progressTrack: { position: "absolute", left: 0, right: 0, bottom: 0, height: 8, backgroundColor: "rgba(255,255,255,0.24)" },
  progressFill: { height: "100%", backgroundColor: colors.accentStrong },
  copy: { flex: 1, minWidth: 0, paddingTop: 10 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 9, minHeight: 28 },
  badge: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 12, backgroundColor: colors.surfaceRaised },
  badgeStrong: { backgroundColor: colors.danger },
  badgeText: { color: colors.textMuted, fontSize: 14, lineHeight: 18, fontWeight: "700" },
  badgeStrongText: { color: colors.black, fontWeight: "900" },
  title: { color: colors.text, fontSize: 43, lineHeight: 50, fontWeight: "700", letterSpacing: -1.1, marginTop: 13 },
  meta: { color: colors.textMuted, fontSize: 18, lineHeight: 25, marginTop: 14 },
  channelName: { color: colors.text, fontSize: 21, fontWeight: "700", marginTop: 24 },
  channelButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", minWidth: 280, maxWidth: "100%", minHeight: 78, paddingVertical: 8, paddingHorizontal: 10, marginTop: 24, borderRadius: 39, backgroundColor: "transparent" },
  channelButtonFocused: { backgroundColor: colors.white, transform: [{ scale: 1.04 }], shadowColor: colors.black, shadowOpacity: 0.68, shadowRadius: 20, shadowOffset: { width: 0, height: 11 } },
  channelButtonPressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  channelAvatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.surfaceRaised },
  channelAvatarPlaceholder: { backgroundColor: colors.surfaceRaised },
  channelCopy: { flex: 1, minWidth: 0, paddingHorizontal: 14 },
  channelTitle: { color: colors.text, fontSize: 21, lineHeight: 27, fontWeight: "700" },
  channelSubscribers: { color: colors.textMuted, fontSize: 15, marginTop: 3 },
  channelTextFocused: { color: colors.black },
  channelSubTextFocused: { color: "rgba(0,0,0,0.6)" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 13, marginTop: 28 },
  actionError: { color: colors.danger, fontSize: 18, lineHeight: 24, fontWeight: "700", marginTop: 16 },
  heroFocusBridge: { width: 500, height: 20, marginTop: -20 },
  descriptionSection: { maxWidth: 1420, marginTop: 62, marginBottom: 56, padding: 28, borderRadius: 26, backgroundColor: colors.surface },
  sectionTitle: { color: colors.text, fontSize: 27, lineHeight: 34, fontWeight: "700", marginBottom: 18 },
  description: { color: colors.textMuted, fontSize: 20, lineHeight: 31 },
  commentsSection: { maxWidth: 1420, marginTop: 42 },
  shelfFocusBridge: { width: 390, height: 20, marginTop: -34 },
  inlineButton: { alignSelf: "flex-start" },
  commentsToolbar: { flexDirection: "row", alignItems: "center", gap: 22, marginBottom: 18 },
  commentsStatus: { color: colors.textMuted, fontSize: 19, lineHeight: 26 },
  commentCard: { maxWidth: 1420, flexDirection: "row", gap: 18, padding: 22, marginBottom: 14, borderRadius: 24, backgroundColor: colors.surface },
  commentAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.surfaceRaised },
  commentCopy: { flex: 1, minWidth: 0 },
  commentHeader: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 9 },
  commentAuthor: { color: colors.text, fontSize: 18, lineHeight: 23, fontWeight: "700" },
  commentMeta: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  commentText: { color: colors.text, fontSize: 18, lineHeight: 27 },
});
