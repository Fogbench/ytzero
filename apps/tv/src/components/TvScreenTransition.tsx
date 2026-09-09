import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import { motion, useReducedMotion } from "../motion";

export function TvScreenTransition({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { progress.setValue(1); return; }
    const animation = Animated.timing(progress, {
      toValue: 1, duration: motion.enter, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced]);
  return <Animated.View style={[styles.fill, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
