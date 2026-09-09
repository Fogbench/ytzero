import { forwardRef, useState } from "react";
import { StyleSheet, Text, type PressableProps, type StyleProp, type View, type ViewStyle } from "react-native";
import { colors } from "../theme";
import { TvPressable } from "./TvPressable";

type Variant = "default" | "primary" | "danger" | "ghost";

type Props = Omit<PressableProps, "children" | "style"> & {
  label: string;
  variant?: Variant;
  preferredFocus?: boolean;
  focusScale?: number;
  style?: StyleProp<ViewStyle>;
};

export const TvButton = forwardRef<View, Props>(function TvButton(
  { label, variant = "default", preferredFocus = false, focusScale, disabled, style, onFocus, onBlur, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <TvPressable
      {...props}
      ref={ref}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ ...props.accessibilityState, disabled: Boolean(disabled) }}
      focusScale={focusScale}
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
    </TvPressable>
  );
});

const styles = StyleSheet.create({
  base: { minHeight: 58, paddingHorizontal: 26, borderRadius: 29, borderWidth: 0, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center" },
  default: {},
  primary: { backgroundColor: colors.accent },
  danger: { backgroundColor: colors.surfaceRaised },
  ghost: { backgroundColor: "transparent" },
  focused: { backgroundColor: colors.white, shadowColor: colors.black, shadowOpacity: 0.62, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.42 },
  label: { color: colors.text, fontSize: 19, fontWeight: "600" },
  defaultLabel: { color: colors.text },
  primaryLabel: { color: colors.text },
  dangerLabel: { color: colors.danger },
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
