import { forwardRef, useRef, useState } from "react";
import { Animated, Image, Platform, Pressable, StyleSheet, Text, View, type FocusDestination } from "react-native";
import { formatBookmarkTime } from "../bookmarkTime";
import type { BookmarkVideo } from "../types";
import { colors } from "../theme";
import { SidebarIcon } from "./SidebarIcon";

type Props = {
  bookmark: BookmarkVideo;
  dateLabel: string;
  emptyDescriptionLabel: string;
  thumbnailSource: { uri: string; headers?: Record<string, string> };
  nextFocusUp?: FocusDestination;
  onFocusChange?: (focused: boolean) => void;
  onLongPress?: () => void;
  onPress: () => void;
};

export const BookmarkRow = forwardRef<View, Props>(function BookmarkRow(
  { bookmark, dateLabel, emptyDescriptionLabel, thumbnailSource, nextFocusUp, onFocusChange, onLongPress, onPress },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const longPressTriggered = useRef(false);
  const time = formatBookmarkTime(bookmark.position_seconds);
  const description = bookmark.bookmark_description.trim() || emptyDescriptionLabel;

  const changeFocus = (next: boolean) => {
    setFocused(next);
    onFocusChange?.(next);
    scale.stopAnimation();
    Animated.spring(scale, {
      toValue: next ? 1.018 : 1,
      damping: 20,
      stiffness: 250,
      mass: 0.68,
      isInteraction: false,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[styles.lift, { transform: [{ scale }] }, focused && styles.liftFocused]}>
      <Pressable
        ref={ref}
        accessibilityLabel={`${time}. ${description}. ${bookmark.title}. ${bookmark.channel_title}`}
        accessibilityRole="button"
        nextFocusUp={nextFocusUp}
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
          shiftDistanceX: 4,
          shiftDistanceY: 3,
          tiltAngle: 0.025,
          magnification: 1.005,
          pressMagnification: 0.985,
          pressDuration: 0.16,
        } : undefined}
        style={({ pressed }) => [styles.row, focused && styles.rowFocused, pressed && styles.rowPressed]}
      >
        <View style={[styles.moment, focused && styles.momentFocused]}>
          <SidebarIcon name="bookmarks" color={focused ? colors.black : colors.accentStrong} size={29} />
          <Text style={[styles.time, focused && styles.textFocused]}>{time}</Text>
        </View>

        <View style={styles.copy}>
          <Text numberOfLines={2} style={[styles.description, focused && styles.textFocused]}>{description}</Text>
          <Text numberOfLines={1} style={[styles.videoTitle, focused && styles.secondaryFocused]}>{bookmark.title}</Text>
          <Text numberOfLines={1} style={[styles.meta, focused && styles.secondaryFocused]}>
            {[bookmark.channel_title, dateLabel].filter(Boolean).join("  •  ")}
          </Text>
        </View>

        <View style={styles.thumbnailFrame}>
          {thumbnailSource.uri ? (
            <Image source={thumbnailSource} resizeMode="cover" style={styles.thumbnail} />
          ) : (
            <View style={[styles.thumbnail, styles.placeholder]}><Text style={styles.placeholderText}>YT Zero</Text></View>
          )}
          {bookmark.duration ? <View style={styles.duration}><Text style={styles.durationText}>{bookmark.duration}</Text></View> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  lift: { borderRadius: 28 },
  liftFocused: { zIndex: 10, shadowColor: colors.black, shadowOpacity: 0.7, shadowRadius: 26, shadowOffset: { width: 0, height: 15 } },
  row: { minHeight: 166, padding: 14, borderRadius: 28, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 24 },
  rowFocused: { backgroundColor: colors.white },
  rowPressed: { opacity: 0.8 },
  moment: { width: 142, alignSelf: "stretch", borderRadius: 20, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center", gap: 9 },
  momentFocused: { backgroundColor: "rgba(0,0,0,0.08)" },
  time: { color: colors.text, fontSize: 26, lineHeight: 31, fontWeight: "800", fontVariant: ["tabular-nums"] },
  copy: { flex: 1, minWidth: 0, paddingVertical: 8 },
  description: { color: colors.text, fontSize: 27, lineHeight: 33, fontWeight: "700", letterSpacing: -0.35 },
  videoTitle: { color: colors.textMuted, fontSize: 19, lineHeight: 25, fontWeight: "600", marginTop: 10 },
  meta: { color: colors.textMuted, fontSize: 16, lineHeight: 21, marginTop: 5 },
  textFocused: { color: colors.black },
  secondaryFocused: { color: "rgba(0,0,0,0.58)" },
  thumbnailFrame: { width: 246, aspectRatio: 16 / 9, borderRadius: 18, overflow: "hidden", backgroundColor: colors.surfaceRaised },
  thumbnail: { width: "100%", height: "100%", backgroundColor: colors.surfaceRaised },
  placeholder: { alignItems: "center", justifyContent: "center" },
  placeholderText: { color: colors.textMuted, fontSize: 19, fontWeight: "800" },
  duration: { position: "absolute", right: 9, bottom: 9, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.8)" },
  durationText: { color: colors.white, fontSize: 13, fontWeight: "800" },
});
