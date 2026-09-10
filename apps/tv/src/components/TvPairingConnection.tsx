import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { useReducedMotion } from "../motion";
import { colors } from "../theme";
import { LogoMark } from "./Logo";

/** Decorative connection motif shared by the TV's pairing steps. */
export function TvPairingConnection() {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) { progress.setValue(1); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: 1200, useNativeDriver: true }),
      Animated.timing(progress, { toValue: 0, duration: 1200, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [progress, reduced]);
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.row}>
    <LogoMark size={82} />
    <View style={styles.signal}>{[0, 1, 2].map((index) => <Animated.View key={index} style={[styles.dot, { opacity: progress.interpolate({ inputRange: [0, .35, .7, 1], outputRange: index === 1 ? [.3, .6, 1, .6] : index === 0 ? [1, .6, .3, .6] : [.3, .3, .6, 1] }) }]} />)}</View>
    <Svg width={128} height={98} viewBox="0 0 128 98"><Rect x="3" y="3" width="122" height="78" rx="12" fill={colors.surface} stroke={colors.textMuted} strokeWidth="3" /><Path d="M64 82v11m-20 1h40" stroke={colors.textMuted} strokeWidth="3" strokeLinecap="round" /><Path d="m55 29 23 13-23 13z" fill={colors.accent} /></Svg>
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 28, marginBottom: 30 },
  signal: { flexDirection: "row", gap: 12 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
});
