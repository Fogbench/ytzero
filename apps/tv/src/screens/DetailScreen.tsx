import { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import type { YtZeroApi } from "../api";
import type { Translate } from "../i18n";
import type { Language, Video } from "../types";
import { localeTags } from "../i18n";
import { colors, screenPadding } from "../theme";
import { TvButton } from "../components/TvButton";

type Props = {
  api: YtZeroApi;
  language: Language;
  t: Translate;
  video: Video;
  onBack: () => void;
  onRemoved: (videoId: string) => void;
};

export function DetailScreen({ api, language, t, video, onBack, onRemoved }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const mutate = async (action: "watched" | "reject") => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      action === "watched" ? await api.markWatched(video.video_id) : await api.reject(video.video_id);
      onRemoved(video.video_id);
      onBack();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const published = video.published_at
    ? new Intl.DateTimeFormat(localeTags[language], { dateStyle: "medium" }).format(new Date(video.published_at))
    : "";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.imageFrame}>
          {video.thumbnail ? <Image source={api.thumbnailSource(video.thumbnail)} resizeMode="cover" style={styles.image} /> : null}
        </View>
        <View style={styles.copy}>
          <Text style={styles.channel}>{video.channel_title}</Text>
          <Text style={styles.title}>{video.title}</Text>
          <Text style={styles.meta}>{[published, video.duration].filter(Boolean).join("  •  ")}</Text>
          <View style={styles.actions}>
            <TvButton label={t("back")} preferredFocus onPress={onBack} />
            <TvButton label={t("markWatched")} variant="primary" disabled={busy} onPress={() => void mutate("watched")} />
            <TvButton label={t("reject")} variant="danger" disabled={busy} onPress={() => void mutate("reject")} />
          </View>
          {error && <Text style={styles.error}>{t("actionFailed")}</Text>}
        </View>
      </View>
      <Text style={styles.description}>{video.description || t("noDescription")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: screenPadding, paddingBottom: 100 },
  hero: { flexDirection: "row", gap: 54 },
  imageFrame: { width: "47%", aspectRatio: 16 / 9, backgroundColor: colors.surface, borderRadius: 28, overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  copy: { flex: 1, paddingTop: 10 },
  channel: { color: colors.textMuted, fontSize: 20, fontWeight: "600" },
  title: { color: colors.text, fontSize: 44, lineHeight: 51, fontWeight: "700", letterSpacing: -1.2, marginTop: 10 },
  meta: { color: colors.textMuted, fontSize: 18, marginTop: 14 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 36 },
  error: { color: colors.danger, fontSize: 18, fontWeight: "700", marginTop: 18 },
  description: { color: colors.textMuted, fontSize: 20, lineHeight: 30, marginTop: 48, maxWidth: 1300 },
});
