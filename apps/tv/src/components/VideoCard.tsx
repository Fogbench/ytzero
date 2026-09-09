import { useRef, useState } from "react";
import { Animated, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { Video } from "../types";
import { colors } from "../theme";

type Props = {
  video: Video;
  width: number;
  thumbnailSource: { uri: string; headers?: Record<string, string> };
  preferredFocus?: boolean;
  onPress: () => void;
};

export function VideoCard({ video, width, thumbnailSource, preferredFocus = false, onPress }: Props) {
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const imageHeight = Math.round(width * 9 / 16);

  const changeFocus = (next: boolean) => {
    setFocused(next);
    scale.stopAnimation();
    Animated.spring(scale, {
      toValue: next ? 1.045 : 1,
      damping: 18,
      stiffness: 230,
      mass: 0.72,
      isInteraction: false,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={[styles.card, { width }, focused && styles.cardFocused]}>
      <Animated.View style={[styles.thumbnailLift, { width, height: imageHeight, transform: [{ scale }] }, focused && styles.thumbnailLiftFocused]}>
        <Pressable
          accessibilityLabel={`${video.title}. ${video.channel_title}`}
          accessibilityRole="button"
          hasTVPreferredFocus={preferredFocus}
          onFocus={() => changeFocus(true)}
          onBlur={() => changeFocus(false)}
          onPress={onPress}
          tvParallaxProperties={Platform.OS === "ios" ? {
            enabled: true,
            shiftDistanceX: 7,
            shiftDistanceY: 7,
            tiltAngle: 0.055,
            magnification: 1.018,
            pressMagnification: 0.97,
            pressDuration: 0.18,
          } : undefined}
          style={({ pressed }) => [styles.imageFrame, focused && styles.imageFrameFocused, pressed && styles.imageFramePressed]}
        >
          {thumbnailSource.uri ? (
            <Image source={thumbnailSource} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.placeholder]}><Text style={styles.placeholderText}>YT Zero</Text></View>
          )}
          {video.duration && <View style={styles.duration}><Text style={styles.durationText}>{video.duration}</Text></View>}
        </Pressable>
      </Animated.View>
      <View style={styles.copy}>
        <Text numberOfLines={2} style={styles.title}>{video.title}</Text>
        <Text numberOfLines={1} style={styles.channel}>{video.channel_title}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 32, backgroundColor: "transparent", borderRadius: 20 },
  cardFocused: { zIndex: 10 },
  thumbnailLift: { borderRadius: 20, shadowColor: colors.black, shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } },
  thumbnailLiftFocused: { shadowOpacity: 0.82, shadowRadius: 27, shadowOffset: { width: 0, height: 16 } },
  imageFrame: { width: "100%", height: "100%", borderRadius: 20, borderWidth: 4, borderColor: "transparent", overflow: "hidden", backgroundColor: colors.surface },
  imageFrameFocused: { borderColor: colors.white },
  imageFramePressed: { opacity: 0.84 },
  image: { width: "100%", height: "100%", backgroundColor: colors.surface },
  placeholder: { alignItems: "center", justifyContent: "center" },
  placeholderText: { color: colors.textMuted, fontSize: 24, fontWeight: "800" },
  copy: { minHeight: 86, paddingHorizontal: 5, paddingTop: 14, paddingBottom: 4 },
  title: { color: colors.text, fontSize: 19, lineHeight: 24, fontWeight: "600" },
  channel: { color: colors.textMuted, fontSize: 16, marginTop: 6 },
  duration: { position: "absolute", right: 8, top: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.78)" },
  durationText: { color: colors.white, fontSize: 14, fontWeight: "700" },
});
