import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated } from "react-native";

export const motion = {
  focus: { damping: 24, stiffness: 300, mass: 0.8 },
  enter: 220,
  exit: 160,
  cardScale: 1.045,
  buttonScale: 1.045,
};

const ReducedMotion = createContext(true);

/** One system subscription for every focus target and transition in the app. */
export function TvMotionProvider({ children }: { children: ReactNode }) {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    let changed = false;
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      changed = true;
      setReduced(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active && !changed) setReduced(value);
    }).catch(() => {});
    return () => { active = false; listener.remove(); };
  }, []);
  return <ReducedMotion.Provider value={reduced}>{children}</ReducedMotion.Provider>;
}

export const useReducedMotion = () => useContext(ReducedMotion);

export function useTvScale(focused: boolean, pressed = false, focusScale = motion.buttonScale) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    scale.stopAnimation();
    if (reduced) { scale.setValue(1); return; }
    const animation = Animated.spring(scale, {
      toValue: pressed ? 0.985 : focused ? focusScale : 1,
      ...motion.focus,
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [focusScale, focused, pressed, reduced, scale]);
  return scale;
}
