import { forwardRef } from "react";
import { StyleSheet, Text, type PressableProps, type StyleProp, type View, type ViewStyle } from "react-native";
import { colors } from "../theme";
import { TvPressable } from "./TvPressable";
import { TvControlSurface } from "./TvSurface";
import Svg, { Path } from "react-native-svg";

type Variant = "default" | "primary" | "danger" | "ghost";

type Props = Omit<PressableProps, "children" | "style"> & {
  label: string;
  deferPress?: boolean;
  variant?: Variant;
  preferredFocus?: boolean;
  focusScale?: number;
  icon?: "search" | "play" | "more" | "queue" | "previous" | "next" | "left" | "right" | "up" | "down" | "remove";
  style?: StyleProp<ViewStyle>;
};

export const TvButton = forwardRef<View, Props>(function TvButton(
  { label, deferPress, variant = "default", preferredFocus = false, focusScale, icon, disabled, style, onFocus, onBlur, ...props },
  ref,
) {
  const radius = StyleSheet.flatten(style)?.borderRadius;
  return (
    <TvPressable
      {...props}
      ref={ref}
      disabled={disabled}
      deferPress={deferPress}
      accessibilityRole="button"
      accessibilityState={{ ...props.accessibilityState, disabled: Boolean(disabled) }}
      focusScale={focusScale}
      hasTVPreferredFocus={preferredFocus}
      onFocus={onFocus}
      onBlur={onBlur}
      style={({ focused, pressed }) => [
        styles.base,
        !label && styles.iconOnly,
        styles[variant],
        focused && styles.focused,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {({ focused }) => <>
        <TvControlSurface radius={typeof radius === "number" ? radius : 33} focused={focused} filled={variant !== "ghost"} floating={variant !== "ghost"} emphasized={variant === "primary"} />
        {icon ? <Svg accessible={false} width={26} height={26} viewBox="0 0 24 24"><Path fill={variant === "danger" && !focused ? colors.danger : colors.text} d={icons[icon]} /></Svg> : null}
        {label ? <Text style={[styles.label, labelStyles[variant], focused && styles.focusedLabel, disabled && styles.disabledLabel]}>{label}</Text> : null}
      </>}
    </TvPressable>
  );
});

const styles = StyleSheet.create({
  base: { minHeight: 66, minWidth: 66, paddingHorizontal: 28, borderRadius: 33, borderWidth: 0, flexDirection: "row", gap: 12, alignItems: "center", justifyContent: "center" },
  default: {},
  iconOnly: { width: 66, paddingHorizontal: 0 },
  primary: {},
  danger: {},
  ghost: { backgroundColor: "transparent" },
  focused: { shadowColor: colors.black, shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  pressed: {},
  disabled: { opacity: 0.45 },
  label: { color: colors.text, fontSize: 23, fontWeight: "600", flexShrink: 1, textAlign: "center" },
  defaultLabel: { color: colors.text },
  primaryLabel: { color: colors.text },
  dangerLabel: { color: colors.danger },
  ghostLabel: { color: colors.textMuted },
  focusedLabel: { color: colors.text },
  disabledLabel: { color: colors.textMuted },
});

const icons = {
  search: "M10 2a8 8 0 1 0 4.9 14.3l5.7 5.7 1.4-1.4-5.7-5.7A8 8 0 0 0 10 2m0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12",
  play: "M6 3.5v17L21 12z",
  more: "M4 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4m8 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4m8 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4",
  queue: "M3 4h18v2H3zm0 6h12v2H3zm0 6h9v2H3zm13-2 7 4-7 4z",
  previous: "M4 4h3v16H4zm16 0L8 12l12 8z",
  next: "M17 4h3v16h-3zM4 4v16l12-8z",
  left: "m6 12 9-9 2 2-7 7 7 7-2 2z",
  right: "m18 12-9 9-2-2 7-7-7-7 2-2z",
  up: "m12 5-9 9 2 2 7-7 7 7 2-2z",
  down: "m12 19 9-9-2-2-7 7-7-7-2 2z",
  remove: "m6 4-2 2 6 6-6 6 2 2 6-6 6 6 2-2-6-6 6-6-2-2-6 6z",
};

const labelStyles: Record<Variant, object> = {
  default: styles.defaultLabel,
  primary: styles.primaryLabel,
  danger: styles.dangerLabel,
  ghost: styles.ghostLabel,
};
