import { useState } from "react";
import { Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "../theme";

type Variant = "default" | "primary" | "danger" | "ghost";

type Props = Omit<PressableProps, "children" | "style"> & {
  label: string;
  variant?: Variant;
  preferredFocus?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function TvButton({ label, variant = "default", preferredFocus = false, disabled, style, onFocus, onBlur, ...props }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      {...props}
      disabled={disabled}
      hasTVPreferredFocus={preferredFocus}
      onFocus={(event) => { setFocused(true); onFocus?.(event); }}
      onBlur={(event) => { setFocused(false); onBlur?.(event); }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        focused && styles.focused,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.label, labelStyles[variant], focused && styles.focusedLabel, disabled && styles.disabledLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 52, paddingHorizontal: 23, borderRadius: 26, borderWidth: 0, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center" },
  default: {},
  primary: { backgroundColor: colors.surfaceSelected },
  danger: { backgroundColor: colors.surfaceRaised },
  ghost: { backgroundColor: "transparent" },
  focused: { backgroundColor: colors.white, transform: [{ scale: 1.08 }], shadowColor: colors.black, shadowOpacity: 0.62, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.42 },
  label: { color: colors.text, fontSize: 19, fontWeight: "600" },
  defaultLabel: { color: colors.text },
  primaryLabel: { color: colors.text },
  dangerLabel: { color: colors.text },
  ghostLabel: { color: colors.textMuted },
  focusedLabel: { color: colors.black },
  disabledLabel: { color: colors.textMuted },
});

const labelStyles: Record<Variant, object> = {
  default: styles.defaultLabel,
  primary: styles.primaryLabel,
  danger: styles.dangerLabel,
  ghost: styles.ghostLabel,
};
