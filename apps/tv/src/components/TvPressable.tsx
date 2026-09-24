import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Pressable, type PressableProps, type StyleProp, type View, type ViewStyle } from "react-native";
import { useTvScale } from "../motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type TvPressableState = { focused: boolean; pressed: boolean };
export type TvPressableProps = Omit<PressableProps, "children" | "style"> & {
  children?: ReactNode | ((state: TvPressableState) => ReactNode);
  /** Lets Select finish before an action removes this target or presents a new native surface. */
  deferPress?: boolean;
  focusScale?: number;
  style?: StyleProp<ViewStyle> | ((state: TvPressableState) => StyleProp<ViewStyle>);
};

/** Keeps layout and native focus intact while animating the focused surface. */
export const TvPressable = forwardRef<View, TvPressableProps>(function TvPressable(
  { children, deferPress = false, focusScale, style, onFocus, onBlur, onPressIn, onPressOut, onPress, ...props }, ref,
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
  const state = { focused, pressed };
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
        cancelActivation();
        if (!deferPress) {
          onPress?.(event);
          return;
        }
        // Allow Select's press-out to finish before an action changes the
        // native presentation or removes this focus target.
        event.persist();
        activationFrame.current = requestAnimationFrame(() => {
          activationFrame.current = null;
          onPress?.(event);
        });
      }}
      style={[typeof style === "function" ? style(state) : style, { transform: [{ scale }] }]}
    >
      {typeof children === "function" ? children(state) : children}
    </AnimatedPressable>
  );
});
