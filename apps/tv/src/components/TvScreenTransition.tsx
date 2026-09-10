import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { motion, useReducedMotion } from "../motion";
import { TvSurface } from "./TvSurface";

const Entering = createContext(false);
export const useTvTransition = () => useContext(Entering);

export function TvScreenTransition({ children, style, active = true, fade = false, surface, radius }: { children: ReactNode; style?: StyleProp<ViewStyle>; active?: boolean; fade?: boolean; surface?: "glass" | "content"; radius?: number }) {
  const reduced = useReducedMotion();
  const parentEntering = useTvTransition();
  const [entering, setEntering] = useState(!reduced);
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { progress.setValue(1); setEntering(false); return; }
    if (!active) { progress.setValue(0); setEntering(true); return; }
    const animation = Animated.timing(progress, {
      toValue: 1, duration: motion.enter, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    animation.start(({ finished }) => { if (finished) setEntering(false); });
    return () => animation.stop();
  }, [active, progress, reduced]);
  // Keep native glass outside parent opacity animations. Text-only transitions
  // may opt into a fade; controls retain a stable material while entering.
  return <Entering.Provider value={entering || parentEntering}><Animated.View style={[styles.fill, style, {
    opacity: fade && !surface && entering ? progress : 1,
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
  }]}>{surface ? <TvSurface material={surface} radius={radius}>{children}</TvSurface> : children}</Animated.View></Entering.Provider>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
