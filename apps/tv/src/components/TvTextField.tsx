import { forwardRef, useState } from "react";
import { findNodeHandle, Platform, StyleSheet, TextInput, View, type FocusDestination, type TextInputProps } from "react-native";
import { colors } from "../theme";
import { TvControlSurface } from "./TvSurface";

export const TvTextField = forwardRef<TextInput, TextInputProps>(function TvTextField({ onFocus, onBlur, style, nextFocusUp, nextFocusDown, nextFocusLeft, nextFocusRight, nextFocusForward, ...props }, ref) {
  const [focused, setFocused] = useState(false);
  // TextInput does not resolve TV destinations like Pressable does. Passing a
  // mounted React view to its native prop causes a cyclic serialization error.
  const handle = (target?: FocusDestination) => typeof target === "number" ? target : target ? findNodeHandle(target) ?? undefined : undefined;
  const destinations = { nextFocusUp: handle(nextFocusUp), nextFocusDown: handle(nextFocusDown), nextFocusLeft: handle(nextFocusLeft), nextFocusRight: handle(nextFocusRight), nextFocusForward: handle(nextFocusForward) };
  // tvOS already paints and focuses its native text field. A second surface
  // underneath it creates overlapping rounded rectangles and focus outlines.
  if (Platform.OS === "ios" && Platform.isTV) {
    return <TextInput {...props} {...destinations} ref={ref} onFocus={onFocus} onBlur={onBlur}
      placeholderTextColor={colors.textMuted} style={[styles.nativeInput, style]} />;
  }
  return <View style={styles.frame}>
    <TvControlSurface radius={24} focused={focused} />
    <TextInput {...props} {...destinations} ref={ref} placeholderTextColor={colors.textMuted}
      onFocus={(event) => { setFocused(true); onFocus?.(event); }} onBlur={(event) => { setFocused(false); onBlur?.(event); }}
      style={[styles.input, focused && styles.focused, style]} />
  </View>;
});
const styles = StyleSheet.create({
  nativeInput: { height: 80, color: colors.text, fontSize: 24 },
  frame: { borderRadius: 24 },
  input: { height: 80, borderRadius: 24, borderWidth: 2, borderColor: "transparent", color: colors.text, fontSize: 24, paddingHorizontal: 24 },
  focused: { borderColor: colors.white },
});
