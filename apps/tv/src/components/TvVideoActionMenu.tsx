import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TVEventControl,
  TVFocusGuideView,
  View,
  type ListRenderItemInfo,
} from "react-native";
import type { YtZeroApi } from "../api";
import type { Translate } from "../i18n";
import { tvVerticalListPerformance } from "../listPerformance";
import { colors } from "../theme";
import type { Bucket, UserPlaylist, Video } from "../types";
import { visibleTvVideoCardActions, type TvVideoCardActionId, type VideoCardActionConfig } from "../videoCardActions";
import { TvButton } from "./TvButton";
import { TvLoadingMark } from "./TvLoadingMark";
import { TvSwitch } from "./TvSwitch";

type MenuView = "actions" | "schedule" | "playlists";

export type VideoActionOptions = {
  onRemove?: () => Promise<void>;
};

type Props = {
  api: YtZeroApi;
  actionConfig: VideoCardActionConfig;
  onClose: () => void;
  onOpenChannel: (channelId: string) => void;
  onRemove?: () => Promise<void>;
  onVideoChange: (video: Video) => void;
  preserveMenuKey: boolean;
  t: Translate;
  video: Video | null;
};

const scheduleBuckets: Array<{ bucket: Bucket; label: "scheduleToday" | "scheduleTonight" | "scheduleTomorrow" | "scheduleTomorrowEvening" | "scheduleWeekend" }> = [
  { bucket: "today", label: "scheduleToday" },
  { bucket: "tonight", label: "scheduleTonight" },
  { bucket: "tomorrow", label: "scheduleTomorrow" },
  { bucket: "tomorrow_evening", label: "scheduleTomorrowEvening" },
  { bucket: "weekend", label: "scheduleWeekend" },
];

export function TvVideoActionMenu({ api, actionConfig, onClose, onOpenChannel, onRemove, onVideoChange, preserveMenuKey, t, video }: Props) {
  const [view, setView] = useState<MenuView>("actions");
  const [currentVideo, setCurrentVideo] = useState<Video | null>(video);
  const [playlists, setPlaylists] = useState<UserPlaylist[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const visible = video !== null;

  useEffect(() => {
    setCurrentVideo(video);
    setView("actions");
    setPlaylists(null);
    setBusy(null);
    setError(false);
  }, [video]);

  const close = useCallback(() => {
    if (busy) return;
    onClose();
  }, [busy, onClose]);

  const goBack = useCallback(() => {
    if (busy) return;
    if (view === "actions") close();
    else {
      setError(false);
      setView("actions");
    }
  }, [busy, close, view]);

  useEffect(() => {
    if (!visible) return;
    TVEventControl.enableTVMenuKey();
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      goBack();
      return true;
    });
    return () => {
      subscription.remove();
      if (preserveMenuKey) TVEventControl.enableTVMenuKey();
      else TVEventControl.disableTVMenuKey();
    };
  }, [goBack, preserveMenuKey, visible]);

  const actions = useMemo(
    () => currentVideo ? visibleTvVideoCardActions(actionConfig, currentVideo, Boolean(onRemove)) : [],
    [actionConfig, currentVideo, onRemove],
  );

  const updateVideo = useCallback((next: Video) => {
    setCurrentVideo(next);
    onVideoChange(next);
  }, [onVideoChange]);

  const run = useCallback(async (id: string, action: () => Promise<void>, closeAfter = true) => {
    if (busy) return;
    setBusy(id);
    setError(false);
    try {
      await action();
      if (closeAfter) onClose();
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  }, [busy, onClose]);

  const openPlaylists = useCallback(() => {
    if (!currentVideo || busy) return;
    setView("playlists");
    setPlaylists(null);
    setError(false);
    void api.userPlaylists(currentVideo.video_id)
      .then((result) => setPlaylists(result.playlists))
      .catch(() => {
        setPlaylists([]);
        setError(true);
      });
  }, [api, busy, currentVideo]);

  const selectAction = useCallback((id: TvVideoCardActionId) => {
    if (!currentVideo || busy) return;
    if (id === "schedule") {
      setError(false);
      setView("schedule");
      return;
    }
    if (id === "playlist") return openPlaylists();
    if (id === "download") {
      const active = currentVideo.download_status === "queued" || currentVideo.download_status === "downloading";
      void run(id, async () => {
        if (active) await api.cancelVideoDownload(currentVideo.video_id);
        else await api.downloadVideo(currentVideo.video_id);
        updateVideo({ ...currentVideo, download_status: active ? null : "queued" });
      });
      return;
    }
    if (id === "archive") {
      void run(id, async () => {
        await api.reject(currentVideo.video_id);
        updateVideo({ ...currentVideo, status: "archived", bucket: null });
      });
      return;
    }
    if (id === "restore") {
      void run(id, async () => {
        await api.restore(currentVideo.video_id);
        updateVideo({ ...currentVideo, status: "inbox", bucket: null });
      });
      return;
    }
    if (id === "remove" && onRemove) {
      void run(id, onRemove);
      return;
    }
    const watched = currentVideo.watched === 1;
    void run(id, async () => {
      if (watched) {
        await api.markUnwatched(currentVideo.video_id);
        updateVideo({ ...currentVideo, watched: 0 });
      } else {
        await api.markWatched(currentVideo.video_id);
        await api.reject(currentVideo.video_id);
        updateVideo({ ...currentVideo, watched: 1, status: "archived", bucket: null });
      }
    });
  }, [api, busy, currentVideo, onRemove, openPlaylists, run, updateVideo]);

  const chooseSchedule = useCallback((bucket: Bucket) => {
    if (!currentVideo || busy) return;
    const remove = currentVideo.status === "queued" && currentVideo.bucket === bucket;
    void run(`schedule-${bucket}`, async () => {
      if (remove) await api.dequeue(currentVideo.video_id);
      else await api.queue(currentVideo.video_id, bucket);
      updateVideo({
        ...currentVideo,
        status: remove ? "inbox" : "queued",
        bucket: remove ? null : bucket,
      });
    });
  }, [api, busy, currentVideo, run, updateVideo]);

  const togglePlaylist = useCallback((playlist: UserPlaylist, value: boolean) => {
    if (!currentVideo || busy) return;
    void run(`playlist-${playlist.id}`, async () => {
      if (value) await api.addVideoToUserPlaylist(playlist.id, currentVideo.video_id);
      else await api.removeVideoFromUserPlaylist(playlist.id, currentVideo.video_id);
      setPlaylists((items) => items?.map((item) => item.id === playlist.id ? {
        ...item,
        has_video: value ? 1 : 0,
        video_count: Math.max(0, item.video_count + (value ? 1 : -1)),
      } : item) ?? items);
    }, false);
  }, [api, busy, currentVideo, run]);

  if (!currentVideo) return null;

  const actionLabel = (id: TvVideoCardActionId): string => {
    switch (id) {
      case "schedule": return t("scheduleVideo");
      case "playlist": return t("addToPlaylist");
      case "download": return currentVideo.download_status === "queued" || currentVideo.download_status === "downloading" ? t("cancelDownload") : t("downloadVideo");
      case "archive": return t("reject");
      case "watched": return currentVideo.watched === 1 ? t("markUnwatched") : t("markWatched");
      case "restore": return t("restoreVideo");
      case "remove": return t("removeFromHistory");
    }
  };
  const mainItems: Array<"channel" | "cancel" | TvVideoCardActionId> = [
    ...(currentVideo.channel_id ? ["channel" as const] : []),
    ...actions,
    "cancel",
  ];
  const scheduleItems: Array<Bucket | "back"> = [...scheduleBuckets.map(({ bucket }) => bucket), "back"];

  return (
    <Modal animationType="fade" onRequestClose={goBack} transparent visible={visible}>
      <TVFocusGuideView autoFocus trapFocusDown trapFocusLeft trapFocusRight trapFocusUp style={styles.overlay}>
        <View style={styles.panel}>
          <View style={styles.videoSummary}>
            <View style={styles.thumbnailFrame}>
              {currentVideo.thumbnail ? <Image source={api.thumbnailSource(currentVideo.thumbnail)} resizeMode="cover" style={styles.thumbnail} /> : null}
              {currentVideo.duration ? <View style={styles.duration}><Text style={styles.durationText}>{currentVideo.duration}</Text></View> : null}
            </View>
            <Text numberOfLines={3} style={styles.videoTitle}>{currentVideo.title}</Text>
            <Text numberOfLines={1} style={styles.channel}>{currentVideo.channel_title}</Text>
          </View>

          <View style={styles.menuPanel}>
            <Text style={styles.eyebrow}>{view === "actions" ? t("videoActions") : view === "schedule" ? t("scheduleVideo") : t("addToPlaylist")}</Text>
            {view === "actions" ? (
              <FlatList
                data={mainItems}
                contentContainerStyle={styles.actionList}
                keyExtractor={(item) => item}
                renderItem={({ item, index }) => item === "channel" ? (
                  <TvButton
                    focusScale={1.025}
                    label={t("goToChannel")}
                    preferredFocus
                    style={styles.action}
                    onPress={() => {
                      onClose();
                      onOpenChannel(currentVideo.channel_id!);
                    }}
                  />
                ) : item === "cancel" ? (
                  <TvButton focusScale={1.025} label={t("cancel")} preferredFocus={index === 0} style={styles.action} variant="ghost" onPress={close} />
                ) : (
                  <TvButton
                    focusScale={1.025}
                    label={actionLabel(item)}
                    preferredFocus={!currentVideo.channel_id && index === 0}
                    style={styles.action}
                    variant={item === "archive" ? "danger" : item === "schedule" ? "primary" : "default"}
                    onPress={() => selectAction(item)}
                  />
                )}
                ItemSeparatorComponent={() => <View style={styles.actionSeparator} />}
                {...tvVerticalListPerformance}
              />
            ) : view === "schedule" ? (
              <FlatList
                data={scheduleItems}
                contentContainerStyle={styles.actionList}
                keyExtractor={(item) => item}
                renderItem={({ item, index }) => {
                  if (item === "back") return <TvButton focusScale={1.025} label={t("back")} style={styles.action} variant="ghost" onPress={goBack} />;
                  const option = scheduleBuckets.find(({ bucket }) => bucket === item)!;
                  const selected = currentVideo.status === "queued" && currentVideo.bucket === item;
                  return (
                    <TvButton
                      focusScale={1.025}
                      label={selected ? `${t(option.label)} · ${t("removeSchedule")}` : t(option.label)}
                      preferredFocus={selected || (currentVideo.status !== "queued" && index === 0)}
                      style={styles.action}
                      variant={selected ? "primary" : "default"}
                      onPress={() => chooseSchedule(item)}
                    />
                  );
                }}
                ItemSeparatorComponent={() => <View style={styles.actionSeparator} />}
                {...tvVerticalListPerformance}
              />
            ) : playlists === null ? (
              <View style={styles.loading}>
                <TvLoadingMark accessibilityLabel={t("loadingPlaylists")} />
                <TvButton label={t("back")} preferredFocus variant="ghost" onPress={goBack} />
              </View>
            ) : playlists.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>{t("playlistsEmpty")}</Text>
                <TvButton label={t("back")} preferredFocus variant="ghost" onPress={goBack} />
              </View>
            ) : (
              <FlatList
                data={playlists}
                contentContainerStyle={styles.playlistList}
                keyExtractor={(playlist) => String(playlist.id)}
                renderItem={({ item, index }: ListRenderItemInfo<UserPlaylist>) => (
                  <TvSwitch
                    label={`${item.icon ? `${item.icon} ` : ""}${item.name}`}
                    onValueChange={(value) => togglePlaylist(item, value)}
                    preferredFocus={index === 0}
                    value={item.has_video === 1}
                  />
                )}
                ListFooterComponent={<TvButton label={t("back")} style={styles.playlistBack} variant="ghost" onPress={goBack} />}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                {...tvVerticalListPerformance}
              />
            )}
            {busy ? <View style={styles.busy}><TvLoadingMark accessibilityLabel={t("savingAction")} size={28} /></View> : null}
            {error ? <Text style={styles.error}>{t("actionFailed")}</Text> : null}
          </View>
        </View>
      </TVFocusGuideView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.78)", alignItems: "center", justifyContent: "center", padding: 64 },
  panel: { width: "88%", height: "88%", maxWidth: 1380, padding: 34, borderRadius: 36, backgroundColor: "rgba(26,27,30,0.98)", flexDirection: "row", gap: 44, shadowColor: colors.black, shadowOpacity: 0.8, shadowRadius: 45, shadowOffset: { width: 0, height: 24 } },
  videoSummary: { width: "41%", minWidth: 380 },
  thumbnailFrame: { width: "100%", aspectRatio: 16 / 9, borderRadius: 24, overflow: "hidden", backgroundColor: colors.surfaceRaised },
  thumbnail: { width: "100%", height: "100%", backgroundColor: colors.surfaceRaised },
  duration: { position: "absolute", right: 12, bottom: 12, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, backgroundColor: "rgba(0,0,0,0.8)" },
  durationText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  videoTitle: { color: colors.text, fontSize: 28, lineHeight: 35, fontWeight: "800", marginTop: 22 },
  channel: { color: colors.textMuted, fontSize: 18, lineHeight: 24, marginTop: 9 },
  menuPanel: { flex: 1, minWidth: 0, minHeight: 0 },
  eyebrow: { color: colors.text, fontSize: 35, lineHeight: 42, fontWeight: "800", marginBottom: 22 },
  actionList: { paddingBottom: 6 },
  actionSeparator: { height: 11 },
  action: { width: "100%", minHeight: 58, borderRadius: 20, justifyContent: "center" },
  loading: { minHeight: 360, alignItems: "center", justifyContent: "center", gap: 24 },
  empty: { minHeight: 340, alignItems: "center", justifyContent: "center", gap: 22 },
  emptyText: { color: colors.textMuted, fontSize: 22, lineHeight: 29, textAlign: "center" },
  playlistList: { paddingBottom: 10 },
  playlistBack: { marginTop: 15 },
  separator: { height: 11 },
  busy: { position: "absolute", top: 5, right: 4 },
  error: { color: colors.danger, fontSize: 17, lineHeight: 23, fontWeight: "700", marginTop: 14 },
});
