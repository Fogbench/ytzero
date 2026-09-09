import { forwardRef, useRef, useState } from "react";
import { Animated, Image, Platform, Pressable, StyleSheet, Text, View, type FocusDestination } from "react-native";
import type { Language, Video } from "../types";
import { colors } from "../theme";
import { formatVideoCardMetadata } from "../videoMetadata";

type Props = {
  video: Video;
  width: number;
  thumbnailSource: { uri: string; headers?: Record<string, string> };
  nextFocusUp?: FocusDestination;
  nextFocusDown?: FocusDestination;
  language: Language;
  onFocusChange?: (focused: boolean) => void;
  onLongPress?: () => void;
  onPress: () => void;
  viewsLabel: string;
};

export const VideoCard = forwardRef<View, Props>(function VideoCard(
  { video, width, thumbnailSource, nextFocusUp, nextFocusDown, language, onFocusChange, onLongPress, onPress, viewsLabel },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const longPressTriggered = useRef(false);
  const imageHeight = Math.round(width * 9 / 16);
  const metadata = formatVideoCardMetadata(video, language, viewsLabel);
  const progress = video.watch_position && video.watch_duration
    ? Math.max(0, Math.min(100, video.watch_position / video.watch_duration * 100))
    : 0;

  const changeFocus = (next: boolean) => {
    setFocused(next);
    onFocusChange?.(next);
    scale.stopAnimation();
    Animated.spring(scale, {
      toValue: next ? 1.075 : 1,
      damping: 17,
      stiffness: 220,
      mass: 0.74,
      isInteraction: false,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      ref={ref}
      accessibilityLabel={`${video.title}. ${video.channel_title}`}
      accessibilityRole="button"
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      delayLongPress={520}
      onFocus={() => changeFocus(true)}
      onBlur={() => changeFocus(false)}
      onLongPress={() => {
        longPressTriggered.current = true;
        onLongPress?.();
      }}
      onPressIn={() => { longPressTriggered.current = false; }}
      onPress={() => { if (!longPressTriggered.current) onPress(); }}
      tvParallaxProperties={Platform.OS === "ios" ? {
        enabled: true,
        shiftDistanceX: 7,
        shiftDistanceY: 7,
        tiltAngle: 0.055,
        magnification: 1.018,
        pressMagnification: 0.97,
        pressDuration: 0.18,
      } : undefined}
      style={({ pressed }) => [styles.card, { width }, focused && styles.cardFocused, pressed && styles.cardPressed]}
    >
      <Animated.View style={[styles.thumbnailLift, { width, height: imageHeight, transform: [{ scale }] }, focused && styles.thumbnailLiftFocused]}>
        <View style={styles.imageFrame}>
          {thumbnailSource.uri ? (
            <Image source={thumbnailSource} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.placeholder]}><Text style={styles.placeholderText}>YT Zero</Text></View>
          )}
          {video.duration && <View style={styles.duration}><Text style={styles.durationText}>{video.duration}</Text></View>}
          {progress > 0 && <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>}
        </View>
      </Animated.View>
      <View style={styles.copy}>
        <Text numberOfLines={2} style={styles.title}>{video.title}</Text>
        {metadata ? <Text numberOfLines={1} style={styles.meta}>{metadata}</Text> : null}
        <Text numberOfLines={1} style={styles.channel}>{video.channel_title}</Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { marginBottom: 32, backgroundColor: "transparent", borderRadius: 20 },
  cardFocused: { zIndex: 10 },
  cardPressed: { opacity: 0.84 },
  thumbnailLift: { borderRadius: 20, shadowColor: colors.black, shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } },
  thumbnailLiftFocused: { shadowOpacity: 0.9, shadowRadius: 32, shadowOffset: { width: 0, height: 18 } },
  imageFrame: { width: "100%", height: "100%", borderRadius: 20, overflow: "hidden", backgroundColor: colors.surface },
  image: { width: "100%", height: "100%", backgroundColor: colors.surface },
  placeholder: { alignItems: "center", justifyContent: "center" },
  placeholderText: { color: colors.textMuted, fontSize: 24, fontWeight: "800" },
  copy: { minHeight: 110, paddingHorizontal: 5, paddingTop: 14, paddingBottom: 4 },
  title: { color: colors.text, fontSize: 19, lineHeight: 24, fontWeight: "600" },
  meta: { color: colors.textMuted, fontSize: 15, lineHeight: 20, marginTop: 6 },
  channel: { color: colors.textMuted, fontSize: 16, marginTop: 4 },
  duration: { position: "absolute", right: 9, bottom: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.78)" },
  durationText: { color: colors.white, fontSize: 14, fontWeight: "700" },
  progressTrack: { position: "absolute", left: 0, right: 0, bottom: 0, height: 6, backgroundColor: "rgba(255,255,255,0.24)" },
  progressFill: { height: "100%", backgroundColor: colors.accentStrong },
});
