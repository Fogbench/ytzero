import { useEffect, useMemo, useRef, useState } from "react";
import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { AppState, Modal, StyleSheet, Text, View } from "react-native";
import { ApiError, type YtZeroApi } from "../api";
import type { Translate } from "../i18n";
import { useReducedMotion } from "../motion";
import { PlaybackProgress, validPlaybackPosition, type PlaybackResult } from "../playback";
import type { PlaybackTicket, Video } from "../types";
import { colors, screenPadding } from "../theme";
import { TvButton } from "./TvButton";
import { TvLoadingMark } from "./TvLoadingMark";

type Props = {
  api: YtZeroApi;
  video: Video;
  startPosition: number;
  incognito: boolean;
  isChild: boolean;
  t: Translate;
  onClose: (result: PlaybackResult) => void;
};
type Failure = "playbackError" | "playbackUnavailable" | "playbackRestricted" | "playbackSessionExpired";

/** The only expo-video boundary. AVPlayer owns tvOS controls, scrubbing and Menu. */
export function TvNativePlayer({ api, video, startPosition, incognito, isChild, t, onClose }: Props) {
  const reduced = useReducedMotion();
  const view = useRef<VideoView>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<Failure | null>(null);
  const failure = useRef<Failure | null>(null);
  const closing = useRef(false);
  const fullscreen = useRef(false);
  const completed = useRef(false);
  const didPlay = useRef(false);
  const position = useRef({ position: startPosition, duration: 0 });
  const ticket = useRef<PlaybackTicket | null>(null);
  const initialSeek = useRef(startPosition);
  const player = useVideoPlayer(null, (instance) => {
    instance.timeUpdateEventInterval = 1;
    instance.staysActiveInBackground = false;
    instance.audioMixingMode = "doNotMix";
    const speed = Number(video.channel_playback_speed ?? 1);
    instance.playbackRate = Number.isFinite(speed) && speed >= 0.25 && speed <= 2 ? speed : 1;
  });
  const progress = useMemo(() => new PlaybackProgress(!incognito || isChild,
    (value) => api.savePlaybackProgress(video.video_id, value),
    () => api.markWatched(video.video_id),
  ), [api, incognito, isChild, video.video_id]);
  const closeCallback = useRef(onClose);
  closeCallback.current = onClose;

  const close = async () => {
    if (closing.current) return;
    closing.current = true;
    player.pause();
    // Do not replace an existing resume point when loading failed before play.
    const value = didPlay.current ? position.current : { position: startPosition, duration: 0 };
    const saveFailed = await progress.finish(value, completed.current);
    closeCallback.current({ ...value, completed: completed.current, saveFailed });
  };

  const fail = (reason: Failure) => {
    if (closing.current || failure.current) return;
    failure.current = reason;
    setError(reason);
    player.pause();
    if (fullscreen.current) void view.current?.exitFullscreen().catch(() => {});
  };

  useEventListener(player, "statusChange", ({ status }) => {
    if (status === "error") fail("playbackError");
  });
  useEventListener(player, "sourceLoad", ({ duration, availableSubtitleTracks }) => {
    if (closing.current || failure.current) return;
    position.current.duration = duration;
    if (initialSeek.current > 0 && Number.isFinite(duration) && duration > 0) {
      player.currentTime = Math.min(initialSeek.current, Math.max(0, duration - 1));
    }
    initialSeek.current = 0;
    if (video.channel_caption_mode === "off") player.subtitleTrack = null;
    else if (video.channel_caption_language) {
      const preferred = availableSubtitleTracks.find((track) => track.language === video.channel_caption_language);
      if (preferred) player.subtitleTrack = preferred;
    }
    if (!fullscreen.current) {
      fullscreen.current = true;
      void view.current?.enterFullscreen().then(() => {
        if (!closing.current && !failure.current) player.play();
      }).catch(() => fail("playbackError"));
    }
  });
  useEventListener(player, "timeUpdate", ({ currentTime }) => {
    if (player.playing && currentTime > 0) didPlay.current = true;
    position.current = { position: currentTime, duration: player.duration };
  });
  useEventListener(player, "playingChange", ({ isPlaying }) => {
    if (!isPlaying && didPlay.current && !closing.current) progress.update(position.current);
  });
  useEventListener(player, "playToEnd", () => {
    completed.current = true;
    if (fullscreen.current) void view.current?.exitFullscreen();
    else void close();
  });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let renewTimer: ReturnType<typeof setInterval> | undefined;
    const loadingTimeout = setTimeout(() => {
      controller.abort();
      fail("playbackError");
    }, 60_000);
    const ready = player.addListener("sourceLoad", () => clearTimeout(loadingTimeout));
    failure.current = null;
    setError(null);
    initialSeek.current = position.current.position;
    void (async () => {
      try {
        const authorization = await api.playbackTicket(video.video_id, controller.signal);
        if (!active) { void api.releasePlaybackTicket(video.video_id, authorization.ticket).catch(() => {}); return; }
        ticket.current = authorization;
        const source = api.playbackSource(authorization);
        await player.replaceAsync({ ...source, metadata: { title: video.title, artist: video.channel_title } });
        if (!active) return;
        renewTimer = setInterval(() => {
          void api.renewPlaybackTicket(video.video_id, authorization.ticket).catch((cause) => {
            if (active) fail(cause instanceof ApiError && cause.status === 403 ? "playbackRestricted" : "playbackSessionExpired");
          });
        }, Math.max(10_000, authorization.expires_in * 1000 / 3));
      } catch (cause) {
        if (!active) return;
        clearTimeout(loadingTimeout);
        fail(cause instanceof ApiError ? cause.status === 403 ? "playbackRestricted" : cause.status === 401 ? "playbackSessionExpired" : [404, 409, 503].includes(cause.status) ? "playbackUnavailable" : "playbackError" : "playbackError");
      }
    })();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(loadingTimeout);
      clearInterval(renewTimer);
      ready.remove();
      const authorization = ticket.current;
      ticket.current = null;
      if (authorization) void api.releasePlaybackTicket(video.video_id, authorization.ticket).catch(() => {});
    };
  }, [api, attempt, player, video.video_id]);

  useEffect(() => {
    let active = true;
    let checking = false;
    const interval = setInterval(() => {
      if (closing.current || failure.current) return;
      if (player.playing && didPlay.current && validPlaybackPosition(position.current)) progress.update(position.current);
      if (isChild && !checking) {
        checking = true;
        void api.playbackRestriction().then((status) => {
          if (active && status.locked) fail("playbackRestricted");
        }).catch(() => { if (active) fail("playbackRestricted"); }).finally(() => { checking = false; });
      }
    }, 5000);
    const state = AppState.addEventListener("change", (value) => {
      if (value === "background") {
        player.pause();
        if (didPlay.current) progress.update(position.current);
      }
    });
    return () => {
      active = false;
      clearInterval(interval);
      state.remove();
      void progress.finish(didPlay.current ? position.current : { position: 0, duration: 0 }, completed.current);
    };
  }, [api, isChild, player, progress]);

  return (
    <Modal visible animationType={reduced ? "none" : "fade"} onRequestClose={() => void close()}>
      <View style={styles.screen}>
        <VideoView ref={view} player={player} style={StyleSheet.absoluteFill} nativeControls contentFit="contain"
          fullscreenOptions={{ enable: true }} allowsPictureInPicture={false}
          onFullscreenExit={() => {
            fullscreen.current = false;
            // AVKit completes its dismissal before the React modal is removed.
            if (!failure.current) void close();
          }}
        />
        <View style={styles.panel}>
          {!error ? <TvLoadingMark accessibilityLabel={t("preparingPlayback")} size={48} /> : null}
          <Text style={styles.eyebrow}>{error ? t("playbackErrorTitle") : t("preparingPlayback")}</Text>
          <Text numberOfLines={3} style={styles.title}>{video.title}</Text>
          <Text style={styles.description}>{error ? t(error) : video.channel_title}</Text>
          <View style={styles.actions}>
            {error && error !== "playbackRestricted" ? <TvButton label={t("tryAgain")} preferredFocus variant="primary" onPress={() => setAttempt((value) => value + 1)} /> : null}
            <TvButton label={t("back")} preferredFocus={!error || error === "playbackRestricted"} onPress={() => void close()} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  panel: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: screenPadding, gap: 20 },
  eyebrow: { color: colors.textMuted, fontSize: 20, lineHeight: 28, fontWeight: "600" },
  title: { maxWidth: 1060, textAlign: "center", color: colors.text, fontSize: 38, lineHeight: 48, fontWeight: "700" },
  description: { maxWidth: 960, color: colors.textMuted, fontSize: 22, lineHeight: 32, textAlign: "center" },
  actions: { flexDirection: "row", gap: 20, marginTop: 16 },
});
