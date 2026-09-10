import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "../theme";
import { useReducedMotion } from "../motion";

type Props = {
  accessibilityLabel: string;
  /** Full size of the indicator, without an additional surrounding ring. */
  size?: number;
};

// Three sides of LogoMark's rounded play symbol. Only their light changes;
// keeping the shape still avoids a rotating play button pointing backwards.
const sides = [
  "M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998",
  "M20.005 10.27a2 2 0 0 1 .003 3.458l-12 7",
  "M8.008 20.728A2 2 0 0 1 5 19V5",
];
const lightLevels = [
  [1, 0.22, 0.22, 1],
  [0.22, 1, 0.22, 0.22],
  [0.22, 0.22, 1, 0.22],
];

export function TvLoadingMark({ accessibilityLabel, size = 44 }: Props) {
  const phase = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    phase.setValue(0);
    if (reduced) return;
    const animation = Animated.loop(Animated.timing(phase, {
      toValue: 1,
      duration: 1500,
      easing: Easing.linear,
      useNativeDriver: true,
      isInteraction: false,
    }));
    animation.start();
    return () => animation.stop();
  }, [reduced, phase]);

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      style={{ width: size, height: size }}
    >
      <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
        {sides.map((path, index) => (
          <Animated.View key={path} style={[StyleSheet.absoluteFill, {
            opacity: reduced ? 0.8 : phase.interpolate({
              inputRange: [0, 1 / 3, 2 / 3, 1],
              outputRange: lightLevels[index]!,
            }),
          }]}>
            <Svg width={size} height={size} viewBox="0 0 26 24">
              <Path d={path} fill="none" stroke={colors.accentStrong} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}
