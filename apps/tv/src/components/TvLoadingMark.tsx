import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { colors } from "../theme";
import { LogoMark } from "./Logo";
import { useReducedMotion } from "../motion";

type Props = {
  accessibilityLabel: string;
  size?: number;
};

export function TvLoadingMark({ accessibilityLabel, size = 58 }: Props) {
  const rotation = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  const ringSize = size + 32;

  useEffect(() => {
    if (reduced) { rotation.setValue(0); return; }
    const animation = Animated.loop(Animated.timing(rotation, {
      toValue: 1,
      duration: 1400,
      easing: Easing.linear,
      useNativeDriver: true,
    }));
    animation.start();
    return () => animation.stop();
  }, [reduced, rotation]);

  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      style={[styles.frame, { width: ringSize, height: ringSize }]}
    >
      <View style={styles.mark}><LogoMark size={size} /></View>
      <Animated.View
        style={[
          styles.ring,
          { width: ringSize, height: ringSize, borderRadius: ringSize / 2, transform: [{ rotate }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: "center", justifyContent: "center" },
  mark: { opacity: 0.72 },
  ring: {
    position: "absolute",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.09)",
    borderTopColor: colors.white,
    borderRightColor: "rgba(255,255,255,0.42)",
  },
});
