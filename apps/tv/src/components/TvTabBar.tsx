import { forwardRef, useCallback, type Ref } from "react";
import { StyleSheet, Text, View, type FocusDestination, type ListRenderItemInfo } from "react-native";
import { colors, typography } from "../theme";
import { TvPressable } from "./TvPressable";
import { TvHorizontalList } from "./TvHorizontalList";
import { TvControlSurface } from "./TvSurface";

export type TvTabOption<Value extends string> = {
  value: Value;
  label: string;
  count?: number;
};

const optionKey = (option: TvTabOption<string>) => option.value;

type Props<Value extends string> = {
  value: Value;
  options: Array<TvTabOption<Value>>;
  firstItemRef?: Ref<View>;
  nextFocusUp?: FocusDestination;
  nextFocusDown?: FocusDestination;
  onChange: (value: Value) => void;
};

export function TvTabBar<Value extends string>({ value, options, firstItemRef, nextFocusUp, nextFocusDown, onChange }: Props<Value>) {
  const renderOption = useCallback(({ item: option, index }: ListRenderItemInfo<TvTabOption<Value>>) => (
    <TabButton
      ref={index === 0 ? firstItemRef : undefined}
      active={option.value === value}
      label={option.label}
      count={option.count}
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}

      onPress={() => onChange(option.value)}
    />
  ), [firstItemRef, nextFocusDown, nextFocusUp, onChange, value]);

  return (
    <TvHorizontalList
      data={options}
      initialNumToRender={6}
      contentContainerStyle={styles.row}
      keyExtractor={optionKey}
      renderItem={renderOption}
      wrapperStyle={styles.scrollerWrap}
    />
  );
}

const TabButton = forwardRef<View, {
  active: boolean;
  label: string;
  count?: number;
  nextFocusUp?: FocusDestination;
  nextFocusDown?: FocusDestination;
  onPress: () => void;
}>(function TabButton({ active, label, count, nextFocusUp, nextFocusDown, onPress }, ref) {
  return (
    <TvPressable
      ref={ref}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      onPress={onPress}
      style={({ focused, pressed }) => [styles.tab, focused && styles.tabFocused, pressed && styles.tabPressed]}
    >
      {({ focused }) => <>
        <TvControlSurface radius={33} focused={focused} emphasized={active} />
        {active ? <Text accessible={false} style={styles.label}>✓</Text> : null}
        <Text style={[styles.label, focused && styles.labelFocused]}>{label}</Text>
        {typeof count === "number" && (
          <View style={[styles.count, focused && styles.countFocused]}>
            <Text style={[styles.countLabel, focused && styles.countLabelFocused]}>{count}</Text>
          </View>
        )}
      </>}
    </TvPressable>
  );
});

const styles = StyleSheet.create({
  scrollerWrap: { width: "100%", overflow: "hidden", marginTop: 14, marginBottom: 28 },
  row: { gap: 12, paddingHorizontal: 20, paddingVertical: 10 },
  tab: { minHeight: 66, paddingLeft: 22, paddingRight: 22, borderRadius: 33, flexDirection: "row", alignItems: "center", gap: 11 },
  tabFocused: { shadowColor: colors.black, shadowOpacity: 0.6, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  tabPressed: { opacity: 0.74,  },
  label: { color: colors.text, fontSize: 23, lineHeight: 29, fontWeight: "700" },
  labelFocused: { color: colors.text },
  count: { minWidth: 30, height: 30, borderRadius: 15, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)" },
  countFocused: { backgroundColor: "rgba(0,0,0,0.1)" },
  countLabel: { color: colors.textMuted, fontSize: typography.caption.fontSize, fontWeight: "800", fontVariant: ["tabular-nums"] },
  countLabelFocused: { color: colors.text },
});
