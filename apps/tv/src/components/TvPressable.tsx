import { forwardRef, useEffect, useRef, useState } from "react";
import { Animated, Pressable, type PressableProps, type View } from "react-native";
import { useTvScale } from "../motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Keeps layout and native focus intact while animating the focused surface. */
export const TvPressable = forwardRef<View, PressableProps & { focusScale?: number }>(function TvPressable(
  { focusScale, style, onFocus, onBlur, onPressIn, onPressOut, onPress, ...props }, ref,
) {
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);
  const activationFrame = useRef<number | null>(null);
  const cancelActivation = () => {
    if (activationFrame.current !== null) cancelAnimationFrame(activationFrame.current);
    activationFrame.current = null;
  };
  useEffect(() => cancelActivation, []);
  const scale = useTvScale(focused, pressed, focusScale);
  return (
    <AnimatedPressable
      {...props}
      ref={ref}
      focusable={props.disabled ? false : props.focusable}
      tvParallaxProperties={{ enabled: false }}
      onFocus={(event) => { setFocused(true); onFocus?.(event); }}
      onBlur={(event) => { cancelActivation(); setFocused(false); setPressed(false); onBlur?.(event); }}
      onPressIn={(event) => { setPressed(true); onPressIn?.(event); }}
      onPressOut={(event) => { setPressed(false); onPressOut?.(event); }}
      onPress={(event) => {
        // Allow Select's press-out to finish before an action changes the
        // native presentation or removes this focus target.
        event.persist();
        cancelActivation();
        activationFrame.current = requestAnimationFrame(() => {
          activationFrame.current = null;
          onPress?.(event);
        });
      }}
      style={[typeof style === "function" ? style({ pressed, focused }) : style, { transform: [{ scale }] }]}
    />
  );
});
