import { forwardRef, type ReactNode } from "react";
import { StyleSheet, Text, View, type PressableProps } from "react-native";
import { TvPressable } from "./TvPressable";
import { TvControlSurface } from "./TvSurface";
import { colors, typography } from "../theme";

/** A large remote-friendly choice with a secondary line of context. */
export const TvListButton = forwardRef<View, Omit<PressableProps, "children"> & {
  deferPress?: boolean;
  label: string;
  detail?: string;
  leading?: ReactNode;
  indicator?: "chevron" | "check" | null;
  surface?: "filled" | "plain";
  labelLines?: number;
  destructive?: boolean;
}>(function TvListButton(
  { label, detail, leading, indicator = "chevron", surface = "filled", labelLines = 1, destructive = false, disabled, onFocus, onBlur, style, ...props }, ref,
) {
  return (
    <TvPressable {...props} ref={ref} disabled={disabled} accessibilityRole={props.accessibilityRole ?? "button"} accessibilityState={{ ...props.accessibilityState, disabled: Boolean(disabled) }}
      focusScale={1.025}
      onFocus={onFocus}
      onBlur={onBlur}
      style={(state) => [styles.row, !detail && styles.compact, typeof style === "function" ? style(state) : style]}>
      {({ focused }) => <>
        <TvControlSurface radius={detail ? 24 : 20} focused={focused} filled={surface === "filled"} />
        {leading}
        <View style={styles.text}>
          <Text numberOfLines={labelLines} style={[styles.label, destructive && styles.destructive, focused && styles.focused, disabled && styles.disabled]}>{label}</Text>
          {detail ? <Text numberOfLines={1} style={[styles.detail, focused && styles.focused]}>{detail}</Text> : null}
        </View>
        {indicator ? <Text accessible={false} style={[styles.chevron, focused && styles.focused]}>{indicator === "check" ? "✓" : "›"}</Text> : null}
      </>}
    </TvPressable>
  );
});
const styles = StyleSheet.create({
  row: { minHeight: 100, borderRadius: 24, paddingHorizontal: 26, paddingVertical: 19, flexDirection: "row", alignItems: "center", gap: 20 },
  compact: { minHeight: 66, paddingVertical: 14, borderRadius: 20 },
  text: { flex: 1 },
  label: { color: colors.text, fontSize: 25, fontWeight: "600" },
  detail: { color: colors.textMuted, fontSize: typography.caption.fontSize, marginTop: 6 },
  chevron: { color: colors.textMuted, fontSize: 36 },
  focused: { color: colors.text },
  disabled: { color: colors.textMuted },
  destructive: { color: colors.danger },
});
