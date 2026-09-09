import { forwardRef, useEffect, useRef, useState } from "react";
import { Animated, Image, Platform, Pressable, StyleSheet, Text, View, type FocusDestination } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import type { Language, Video } from "../types";
import { colors } from "../theme";
import { formatVideoCardMetadata } from "../videoMetadata";

type ImageSource = { uri: string; headers?: Record<string, string> };

type Props = {
  video: Video;
  width: number;
  portraitSource: ImageSource;
  fallbackSource: ImageSource;
  language: Language;
  nextFocusUp?: FocusDestination;
  nextFocusDown?: FocusDestination;
  onFocusChange?: (focused: boolean) => void;
  onLongPress?: () => void;
  onPress: () => void;
  viewsLabel: string;
};

export const TvShortCard = forwardRef<View, Props>(function TvShortCard(
  { video, width, portraitSource, fallbackSource, language, nextFocusUp, nextFocusDown, onFocusChange, onLongPress, onPress, viewsLabel },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [portraitFailed, setPortraitFailed] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const longPressTriggered = useRef(false);
  const height = Math.round(width * 16 / 9);
  const metadata = formatVideoCardMetadata(video, language, viewsLabel);
  const progress = video.watch_position && video.watch_duration
    ? Math.max(0, Math.min(100, video.watch_position / video.watch_duration * 100))
    : 0;

  useEffect(() => setPortraitFailed(false), [video.video_id]);

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

  const source = portraitFailed ? fallbackSource : portraitSource;

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
        shiftDistanceX: 6,
        shiftDistanceY: 8,
        tiltAngle: 0.045,
        magnification: 1.018,
        pressMagnification: 0.97,
        pressDuration: 0.18,
      } : undefined}
      style={({ pressed }) => [styles.card, { width, height }, focused && styles.cardFocused, pressed && styles.cardPressed]}
    >
      <Animated.View style={[styles.lift, { transform: [{ scale }] }, focused && styles.liftFocused]}>
        {source.uri ? (
          <Image
            source={source}
            resizeMode="cover"
            style={[styles.image, video.watched === 1 && styles.imageWatched]}
            onError={!portraitFailed ? () => setPortraitFailed(true) : undefined}
          />
        ) : (
          <View style={[styles.image, styles.placeholder]}><Text style={styles.placeholderText}>YT Zero</Text></View>
        )}
        <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="short-shade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.38" stopColor={colors.black} stopOpacity="0" />
              <Stop offset="0.68" stopColor={colors.black} stopOpacity="0.38" />
              <Stop offset="1" stopColor={colors.black} stopOpacity="0.94" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#short-shade)" />
        </Svg>
        <View style={styles.copy}>
          <Text numberOfLines={3} style={styles.title}>{video.title}</Text>
          {metadata ? <Text numberOfLines={1} style={styles.meta}>{metadata}</Text> : null}
          <Text numberOfLines={1} style={styles.channel}>{video.channel_title}</Text>
        </View>
        {video.duration ? <View style={styles.duration}><Text style={styles.durationText}>{video.duration}</Text></View> : null}
        {progress > 0 && <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>}
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { marginBottom: 30, borderRadius: 24, backgroundColor: "transparent" },
  cardFocused: { zIndex: 10 },
  cardPressed: { opacity: 0.84 },
  lift: { width: "100%", height: "100%", borderRadius: 24, overflow: "hidden", backgroundColor: colors.surface, shadowColor: colors.black, shadowOpacity: 0.34, shadowRadius: 14, shadowOffset: { width: 0, height: 9 } },
  liftFocused: { shadowOpacity: 0.92, shadowRadius: 34, shadowOffset: { width: 0, height: 20 } },
  image: { width: "100%", height: "100%", backgroundColor: colors.surface },
  imageWatched: { opacity: 0.58 },
  placeholder: { alignItems: "center", justifyContent: "center" },
  placeholderText: { color: colors.textMuted, fontSize: 22, fontWeight: "800" },
  copy: { position: "absolute", left: 0, right: 0, bottom: 0, paddingLeft: 16, paddingRight: 82, paddingTop: 50, paddingBottom: 17 },
  title: { color: colors.white, fontSize: 18, lineHeight: 23, fontWeight: "700", textShadowColor: "rgba(0,0,0,0.7)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  meta: { color: "rgba(255,255,255,0.76)", fontSize: 14, lineHeight: 19, fontWeight: "600", marginTop: 6 },
  channel: { color: "rgba(255,255,255,0.72)", fontSize: 15, lineHeight: 20, fontWeight: "600", marginTop: 4 },
  duration: { position: "absolute", right: 10, bottom: 12, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.8)" },
  durationText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  progressTrack: { position: "absolute", left: 0, right: 0, bottom: 0, height: 6, backgroundColor: "rgba(255,255,255,0.2)" },
  progressFill: { height: "100%", backgroundColor: colors.accentStrong },
});
