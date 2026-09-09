import { forwardRef, useCallback, useState, type Ref } from "react";
import { Pressable, StyleSheet, Text, View, type FocusDestination, type ListRenderItemInfo } from "react-native";
import { useVerticalFocusRedirect } from "../focus";
import { colors } from "../theme";
import { TvHorizontalList } from "./TvHorizontalList";

export type TvTabOption<Value extends string> = {
  value: Value;
  label: string;
  count?: number;
};

type Props<Value extends string> = {
  value: Value;
  options: Array<TvTabOption<Value>>;
  firstItemRef?: Ref<View>;
  nextFocusUp?: FocusDestination;
  nextFocusDown?: FocusDestination;
  onChange: (value: Value) => void;
};

export function TvTabBar<Value extends string>({ value, options, firstItemRef, nextFocusUp, nextFocusDown, onChange }: Props<Value>) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  useVerticalFocusRedirect(focusedIndex !== null, nextFocusUp, nextFocusDown);
  const renderOption = useCallback(({ item: option, index }: ListRenderItemInfo<TvTabOption<Value>>) => (
    <TabButton
      ref={index === 0 ? firstItemRef : undefined}
      active={option.value === value}
      label={option.label}
      count={option.count}
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      onFocusChange={(focused) => setFocusedIndex(focused ? index : (current) => current === index ? null : current)}
      onPress={() => onChange(option.value)}
    />
  ), [firstItemRef, nextFocusDown, nextFocusUp, onChange, value]);

  return (
    <TvHorizontalList
      data={options}
      initialNumToRender={6}
      contentContainerStyle={styles.row}
      keyExtractor={(option) => option.value}
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
  onFocusChange: (focused: boolean) => void;
  onPress: () => void;
}>(function TabButton({ active, label, count, nextFocusUp, nextFocusDown, onFocusChange, onPress }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      ref={ref}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      onFocus={() => { setFocused(true); onFocusChange(true); }}
      onBlur={() => { setFocused(false); onFocusChange(false); }}
      onPress={onPress}
      style={({ pressed }) => [styles.tab, active && styles.tabActive, focused && styles.tabFocused, pressed && styles.tabPressed]}
    >
      <Text style={[styles.label, focused && styles.labelFocused]}>{label}</Text>
      {typeof count === "number" && (
        <View style={[styles.count, focused && styles.countFocused]}>
          <Text style={[styles.countLabel, focused && styles.countLabelFocused]}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  scrollerWrap: { width: "100%", overflow: "hidden", marginTop: 14, marginBottom: 28 },
  row: { gap: 12, paddingHorizontal: 20, paddingVertical: 10 },
  tab: { minHeight: 56, paddingLeft: 22, paddingRight: 13, borderRadius: 18, backgroundColor: colors.surfaceRaised, flexDirection: "row", alignItems: "center", gap: 11 },
  tabActive: { backgroundColor: colors.surfaceSelected },
  tabFocused: { backgroundColor: colors.white, transform: [{ scale: 1.065 }], shadowColor: colors.black, shadowOpacity: 0.6, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  tabPressed: { opacity: 0.74, transform: [{ scale: 0.98 }] },
  label: { color: colors.text, fontSize: 19, lineHeight: 24, fontWeight: "700" },
  labelFocused: { color: colors.black },
  count: { minWidth: 30, height: 30, borderRadius: 15, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)" },
  countFocused: { backgroundColor: "rgba(0,0,0,0.1)" },
  countLabel: { color: colors.textMuted, fontSize: 14, fontWeight: "800", fontVariant: ["tabular-nums"] },
  countLabelFocused: { color: colors.black },
});
