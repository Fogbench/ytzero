import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, findNodeHandle, Pressable, ScrollView, StyleSheet, TVFocusGuideView, View, type FocusDestination } from "react-native";
import type { Translate } from "../i18n";
import { resolveTvNavigation, type TvDestination, type TvNavigationItem } from "../navigation";
import { colors, sidebarExpandedWidth, sidebarRailWidth } from "../theme";
import { LogoMark } from "./Logo";
import { SidebarIcon } from "./SidebarIcon";
import { motion, useReducedMotion } from "../motion";

type Props = {
  current: TvDestination;
  navConfig: string;
  contentFocusTarget?: FocusDestination;
  onNavigate: (destination: TvDestination) => void;
  t: Translate;
};

export function TvSidebar({ current, navConfig, contentFocusTarget, onNavigate, t }: Props) {
  const navigation = useMemo(() => resolveTvNavigation(navConfig), [navConfig]);
  const [expanded, setExpanded] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const contentFocusHandle = typeof contentFocusTarget === "number"
    ? contentFocusTarget
    : contentFocusTarget ? findNodeHandle(contentFocusTarget) ?? undefined : undefined;
  const width = useRef(new Animated.Value(sidebarRailWidth)).current;
  const reduced = useReducedMotion();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (reduced) { width.setValue(expanded ? sidebarExpandedWidth : sidebarRailWidth); return; }
    const animation = Animated.spring(width, {
      toValue: expanded ? sidebarExpandedWidth : sidebarRailWidth,
      ...motion.focus,
      isInteraction: false,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [expanded, reduced, width]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const open = (key: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setFocusedKey(key);
    setExpanded(true);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setFocusedKey(null);
      setExpanded(false);
    }, 120);
  };
  const navigate = (destination: TvDestination) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setFocusedKey(null);
    setExpanded(false);
    onNavigate(destination);
  };
  const labelOpacity = width.interpolate({
    inputRange: [sidebarRailWidth, sidebarExpandedWidth],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const labelTranslateX = width.interpolate({
    inputRange: [sidebarRailWidth, sidebarExpandedWidth],
    outputRange: [-10, 0],
    extrapolate: "clamp",
  });

  const renderItem = (item: TvNavigationItem) => {
    const focused = focusedKey === item.key;
    const active = current === item.destination;
    const iconColor = focused ? colors.black : active ? colors.text : colors.textMuted;
    const labelColor = focused || active ? colors.text : colors.textMuted;
    return (
      <Pressable
        key={item.key}
        accessibilityRole="button"
        accessibilityLabel={t(item.labelKey)}
        nextFocusRight={contentFocusHandle}
        onFocus={() => open(item.key)}
        onBlur={scheduleClose}
        onPress={() => navigate(item.destination)}
        style={styles.item}
      >
        <View style={styles.iconSlot}>
          <View style={[styles.iconTile, active && styles.iconTileActive, focused && styles.iconTileFocused]}>
            <SidebarIcon name={item.icon} color={iconColor} />
          </View>
        </View>
        <Animated.Text numberOfLines={1} style={[styles.label, { color: labelColor, opacity: labelOpacity, transform: [{ translateX: labelTranslateX }] }]}>
          {t(item.labelKey)}
        </Animated.Text>
      </Pressable>
    );
  };

  const moreFocused = focusedKey === "more";
  const moreIconColor = moreFocused ? colors.black : colors.textMuted;

  return (
    <>
      <Animated.View style={[styles.sidebar, { width }]}>
        <TVFocusGuideView autoFocus trapFocusLeft style={styles.focusGuide}>
          <View style={styles.brand}>
            <View style={styles.iconSlot}><LogoMark size={38} accessibilityLabel="YT Zero" /></View>
            <Animated.Text numberOfLines={1} style={[styles.brandName, { opacity: labelOpacity, transform: [{ translateX: labelTranslateX }] }]}>YT Zero</Animated.Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.navigation}>
            {navigation.visible.map(renderItem)}
            {navigation.hidden.length > 0 && (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showHidden ? t("less") : t("more")}
                  nextFocusRight={contentFocusHandle}
                  onFocus={() => open("more")}
                  onBlur={scheduleClose}
                  onPress={() => setShowHidden((value) => !value)}
                  style={styles.item}
                >
                  <View style={styles.iconSlot}>
                    <View style={[styles.iconTile, moreFocused && styles.iconTileFocused]}>
                      <SidebarIcon name="more" color={moreIconColor} />
                    </View>
                  </View>
                  <Animated.Text numberOfLines={1} style={[styles.label, { color: colors.textMuted, opacity: labelOpacity, transform: [{ translateX: labelTranslateX }] }]}>
                    {showHidden ? t("less") : t("more")}
                  </Animated.Text>
                </Pressable>
                {showHidden && navigation.hidden.map(renderItem)}
              </>
            )}
          </ScrollView>
        </TVFocusGuideView>
      </Animated.View>
      {expanded && contentFocusTarget && (
        <TVFocusGuideView destinations={[contentFocusTarget]} style={styles.contentFocusBridge} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    position: "absolute",
    zIndex: 100,
    left: 0,
    top: 0,
    bottom: 0,
    overflow: "hidden",
    backgroundColor: "rgba(17,17,19,0.98)",
    shadowColor: colors.black,
    shadowOpacity: 0.58,
    shadowRadius: 30,
    shadowOffset: { width: 16, height: 0 },
  },
  contentFocusBridge: { position: "absolute", zIndex: 101, left: sidebarExpandedWidth, top: 0, bottom: 0, width: 240 },
  focusGuide: { flex: 1, width: sidebarExpandedWidth },
  brand: { width: sidebarExpandedWidth, height: 108, paddingHorizontal: 18, flexDirection: "row", alignItems: "center" },
  brandName: { flex: 1, paddingRight: 24, color: colors.text, fontSize: 26, fontWeight: "700", letterSpacing: -0.8 },
  navigation: { width: sidebarExpandedWidth, paddingHorizontal: 18, paddingBottom: 30, gap: 6 },
  item: { height: 58, borderRadius: 14, flexDirection: "row", alignItems: "center", overflow: "hidden" },
  iconSlot: { width: 79, alignItems: "center", justifyContent: "center" },
  iconTile: { width: 50, height: 50, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  iconTileActive: { backgroundColor: colors.surfaceSelected },
  iconTileFocused: { backgroundColor: colors.white, transform: [{ scale: 1.1 }], shadowColor: colors.black, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  label: { flex: 1, paddingRight: 24, fontSize: 22, fontWeight: "600" },
});
