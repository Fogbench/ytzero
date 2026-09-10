import { forwardRef, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View, type FocusDestination } from "react-native";
import { colors, typography } from "../theme";
import { motion, useReducedMotion } from "../motion";
import { TvPressable } from "./TvPressable";
import { TvControlSurface } from "./TvSurface";

type Props = {
  nextFocusUp?: FocusDestination;
  nextFocusDown?: FocusDestination;
  description?: string;
  disabled?: boolean;
  busy?: boolean;
  label: string;
  onValueChange: (value: boolean) => void;
  preferredFocus?: boolean;
  value: boolean;
};

export const TvSwitch = forwardRef<View, Props>(function TvSwitch(
  { nextFocusUp, nextFocusDown, description, disabled = false, busy = false, label, onValueChange, preferredFocus = false, value },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const reduced = useReducedMotion();
  const offset = useRef(new Animated.Value(value ? 32 : 0)).current;
  useEffect(() => {
    if (reduced) { offset.setValue(value ? 32 : 0); return; }
    const animation = Animated.spring(offset, { toValue: value ? 32 : 0, ...motion.focus, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [offset, reduced, value]);
  return (
    <TvPressable
      ref={ref}
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      focusScale={1.025}
      accessibilityLabel={label}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled, busy }}
      disabled={disabled}
      hasTVPreferredFocus={preferredFocus}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={() => { if (!busy) onValueChange(!value); }}
      style={[
        styles.row,
        focused && styles.rowFocused,
        disabled && styles.disabled,
      ]}
    >
      <TvControlSurface radius={28} focused={focused} />
      <View style={styles.copy}>
        <Text style={[styles.label, focused && styles.labelFocused]}>{label}</Text>
        {description && <Text style={[styles.description, focused && styles.descriptionFocused]}>{description}</Text>}
      </View>
      <View style={[styles.track, value && styles.trackChecked]}>
        <Animated.View style={[styles.thumb, value && styles.thumbChecked, { transform: [{ translateX: offset }] }]} />
      </View>
    </TvPressable>
  );
});

const styles = StyleSheet.create({
  row: {
    width: "100%",
    minHeight: 112,
    paddingHorizontal: 28,
    paddingVertical: 20,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  rowFocused: {
    shadowColor: colors.black,
    shadowOpacity: 0.62,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  disabled: { opacity: 0.42 },
  copy: { flex: 1 },
  label: { color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: "700" },
  labelFocused: { color: colors.text },
  description: { color: colors.textMuted, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, marginTop: 5 },
  descriptionFocused: { color: colors.text },
  track: {
    width: 76,
    height: 44,
    padding: 4,
    borderRadius: 22,
    backgroundColor: "#71717a",
    justifyContent: "center",
    alignItems: "flex-start",
  },
  trackChecked: { backgroundColor: colors.success },
  thumb: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.text },
  thumbChecked: { backgroundColor: colors.black },
});
