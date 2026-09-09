import { forwardRef, useState } from "react";
import { Animated, Pressable, type PressableProps, type View } from "react-native";
import { useTvScale } from "../motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Keeps layout and native focus intact while animating the focused surface. */
export const TvPressable = forwardRef<View, PressableProps & { focusScale?: number }>(function TvPressable(
  { focusScale, style, onFocus, onBlur, onPressIn, onPressOut, ...props }, ref,
) {
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);
  const scale = useTvScale(focused, pressed, focusScale);
  return (
    <AnimatedPressable
      {...props}
      ref={ref}
      tvParallaxProperties={{ enabled: false }}
      onFocus={(event) => { setFocused(true); onFocus?.(event); }}
      onBlur={(event) => { setFocused(false); setPressed(false); onBlur?.(event); }}
      onPressIn={(event) => { setPressed(true); onPressIn?.(event); }}
      onPressOut={(event) => { setPressed(false); onPressOut?.(event); }}
      style={(state) => [typeof style === "function" ? style(state) : style, { transform: [{ scale }] }]}
    />
  );
});
