import { useCallback, useState, type Ref } from "react";
import { StyleSheet, Text, View, type FocusDestination, type ListRenderItemInfo } from "react-native";
import { useVerticalFocusRedirect } from "../focus";
import type { Language, Video } from "../types";
import { colors } from "../theme";
import { VideoCard } from "./VideoCard";
import { TvHorizontalList } from "./TvHorizontalList";

type Props = {
  title: string;
  videos: Video[];
  cardWidth: number;
  firstItemRef?: Ref<View>;
  language: Language;
  nextFocusUp?: FocusDestination;
  nextFocusDown?: FocusDestination;
  thumbnailSource: (thumbnail: string) => { uri: string; headers?: Record<string, string> };
  onOpen: (video: Video) => void;
  onLongPress: (video: Video) => void;
  viewsLabel: string;
};

export function TvVideoShelf({ title, videos, cardWidth, firstItemRef, language, nextFocusUp, nextFocusDown, thumbnailSource, onOpen, onLongPress, viewsLabel }: Props) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  useVerticalFocusRedirect(focusedIndex !== null, nextFocusUp, nextFocusDown);
  const renderVideo = useCallback(({ item: video, index }: ListRenderItemInfo<Video>) => (
    <VideoCard
      ref={index === 0 ? firstItemRef : undefined}
      video={video}
      width={cardWidth}
      language={language}
      thumbnailSource={thumbnailSource(video.thumbnail)}
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      onFocusChange={(focused) => setFocusedIndex(focused ? index : (current) => current === index ? null : current)}
      onLongPress={() => onLongPress(video)}
      onPress={() => onOpen(video)}
      viewsLabel={viewsLabel}
    />
  ), [cardWidth, firstItemRef, language, nextFocusDown, nextFocusUp, onLongPress, onOpen, thumbnailSource, viewsLabel]);
  if (videos.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{title}</Text>
      <TvHorizontalList
        data={videos}
        estimatedItemExtent={cardWidth + 26}
        contentContainerStyle={styles.row}
        keyExtractor={(video) => video.video_id}
        renderItem={renderVideo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 20 },
  heading: { color: colors.text, fontSize: 27, lineHeight: 34, fontWeight: "700", marginBottom: 17, marginHorizontal: 20 },
  row: { gap: 26, paddingHorizontal: 20, paddingTop: 7, paddingBottom: 2 },
});
