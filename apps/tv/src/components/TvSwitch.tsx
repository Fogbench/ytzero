import { forwardRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

type Props = {
  description?: string;
  disabled?: boolean;
  label: string;
  onValueChange: (value: boolean) => void;
  preferredFocus?: boolean;
  value: boolean;
};

export const TvSwitch = forwardRef<View, Props>(function TvSwitch(
  { description, disabled = false, label, onValueChange, preferredFocus = false, value },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      ref={ref}
      accessibilityLabel={label}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hasTVPreferredFocus={preferredFocus}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={() => onValueChange(!value)}
      style={({ pressed }) => [
        styles.row,
        focused && styles.rowFocused,
        pressed && styles.rowPressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.copy}>
        <Text style={[styles.label, focused && styles.labelFocused]}>{label}</Text>
        {description && <Text style={[styles.description, focused && styles.descriptionFocused]}>{description}</Text>}
      </View>
      <View style={[styles.track, value && styles.trackChecked, focused && !value && styles.trackFocused]}>
        <View style={[styles.thumb, value && styles.thumbChecked, focused && styles.thumbFocused]} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    width: "100%",
    minHeight: 112,
    paddingHorizontal: 28,
    paddingVertical: 20,
    borderRadius: 28,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  rowFocused: {
    backgroundColor: colors.white,
    transform: [{ scale: 1.025 }],
    shadowColor: colors.black,
    shadowOpacity: 0.62,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  rowPressed: { opacity: 0.75, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.42 },
  copy: { flex: 1 },
  label: { color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: "700" },
  labelFocused: { color: colors.black },
  description: { color: colors.textMuted, fontSize: 17, lineHeight: 23, marginTop: 5 },
  descriptionFocused: { color: "rgba(0,0,0,0.62)" },
  track: {
    width: 76,
    height: 44,
    padding: 4,
    borderRadius: 22,
    backgroundColor: colors.surfaceRaised,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  trackChecked: { backgroundColor: colors.success, alignItems: "flex-end" },
  trackFocused: { backgroundColor: "rgba(0,0,0,0.24)" },
  thumb: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.textMuted },
  thumbChecked: { backgroundColor: colors.black },
  thumbFocused: { backgroundColor: colors.black },
});
