import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import type { Translate } from "../i18n";
import { resolveTvNavigation, type TvDestination, type TvNavigationItem } from "../navigation";
import { colors, sidebarExpandedWidth, sidebarRailWidth } from "../theme";
import { Logo } from "./Logo";
import { SidebarIcon } from "./SidebarIcon";

type Props = {
  current: TvDestination;
  navConfig: string;
  onNavigate: (destination: TvDestination) => void;
  t: Translate;
};

export function TvSidebar({ current, navConfig, onNavigate, t }: Props) {
  const navigation = useMemo(() => resolveTvNavigation(navConfig), [navConfig]);
  const [expanded, setExpanded] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const width = useRef(new Animated.Value(sidebarRailWidth)).current;
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.spring(width, {
      toValue: expanded ? sidebarExpandedWidth : sidebarRailWidth,
      damping: 24,
      stiffness: 220,
      mass: 0.9,
      isInteraction: false,
      useNativeDriver: false,
    }).start();
  }, [expanded, width]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const open = (key: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setFocusedKey(key);
    setExpanded(true);
  };
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => {
      setFocusedKey(null);
      setExpanded(false);
    }, 90);
  };
  const labelOpacity = width.interpolate({
    inputRange: [sidebarRailWidth, sidebarExpandedWidth],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const renderItem = (item: TvNavigationItem) => {
    const focused = focusedKey === item.key;
    const active = current === item.destination;
    const foreground = focused ? colors.black : active ? colors.text : colors.textMuted;
    return (
      <Pressable
        key={item.key}
        accessibilityRole="button"
        accessibilityLabel={t(item.labelKey)}
        onFocus={() => open(item.key)}
        onBlur={scheduleClose}
        onPress={() => onNavigate(item.destination)}
        style={[styles.item, active && styles.itemActive, focused && styles.itemFocused]}
      >
        <View style={styles.iconSlot}><SidebarIcon name={item.icon} color={foreground} /></View>
        <Animated.Text numberOfLines={1} style={[styles.label, { color: foreground, opacity: labelOpacity }]}>
          {t(item.labelKey)}
        </Animated.Text>
      </Pressable>
    );
  };

  const moreFocused = focusedKey === "more";
  const moreForeground = moreFocused ? colors.black : colors.textMuted;

  return (
    <Animated.View style={[styles.sidebar, { width }]}>
      <View style={styles.brand}><Logo compact /></View>
      <View style={styles.navigation}>
        {navigation.visible.map(renderItem)}
        {navigation.hidden.length > 0 && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showHidden ? t("less") : t("more")}
              onFocus={() => open("more")}
              onBlur={scheduleClose}
              onPress={() => setShowHidden((value) => !value)}
              style={[styles.item, moreFocused && styles.itemFocused]}
            >
              <View style={styles.iconSlot}><SidebarIcon name="more" color={moreForeground} /></View>
              <Animated.Text numberOfLines={1} style={[styles.label, { color: moreForeground, opacity: labelOpacity }]}>
                {showHidden ? t("less") : t("more")}
              </Animated.Text>
            </Pressable>
            {showHidden && navigation.hidden.map(renderItem)}
          </>
        )}
      </View>
    </Animated.View>
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
    borderRightWidth: 1,
    borderRightColor: colors.border,
    shadowColor: colors.black,
    shadowOpacity: 0.58,
    shadowRadius: 30,
    shadowOffset: { width: 16, height: 0 },
  },
  brand: { width: sidebarExpandedWidth, height: 126, paddingLeft: 38, justifyContent: "center" },
  navigation: { width: sidebarExpandedWidth, paddingHorizontal: 18, gap: 8 },
  item: { height: 66, borderRadius: 18, flexDirection: "row", alignItems: "center" },
  itemActive: { backgroundColor: colors.surfaceRaised },
  itemFocused: { backgroundColor: colors.white },
  iconSlot: { width: 79, alignItems: "center", justifyContent: "center" },
  label: { flex: 1, paddingRight: 24, fontSize: 22, fontWeight: "600" },
});
