import { useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, Easing } from "react-native";
import { useReducedMotion } from "../motion";
import { swapLoadedContent } from "../contentSwap";

export function useContentSwap() {
  const translateY = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  const cancel = useCallback(() => { translateY.stopAnimation(); translateY.setValue(0); }, [translateY]);
  useEffect(() => cancel, [cancel]);
  const swap = useCallback((current: () => boolean, commit: () => void, settle: () => Promise<void>) => {
    const animate = (value: number, duration: number) => new Promise<void>((resolve) => {
      if (reduced) { resolve(); return; }
      Animated.timing(translateY, { toValue: value, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true, isInteraction: false }).start(() => resolve());
    });
    // The old content remains until its replacement is ready. Move it gently;
    // fading this ancestor would invalidate glass inside its controls.
    return swapLoadedContent({ current, commit, settle, hide: () => animate(8, 90), show: () => animate(0, 170) });
  }, [translateY, reduced]);
  return useMemo(() => ({ translateY, cancel, swap }), [cancel, translateY, swap]);
}
