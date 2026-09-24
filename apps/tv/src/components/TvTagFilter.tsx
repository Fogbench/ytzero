import { forwardRef, useCallback, useMemo, useRef, type Ref } from "react";
import { StyleSheet, Text, TVFocusGuideView, View, type FocusDestination, type ListRenderItemInfo } from "react-native";
import { requestTvFocus } from "../focus";
import type { Tag } from "../types";
import { colors } from "../theme";
import { TvHorizontalList } from "./TvHorizontalList";
import { TvPressable } from "./TvPressable";
import { TvControlSurface } from "./TvSurface";

type Props = {
  tags: Tag[];
  selected: number[];
  profileFocusTarget: FocusDestination;
  nextFocusDown?: FocusDestination;
  firstTagRef?: Ref<View>;
  onToggle: (tagId: number) => void;
  onClear: () => void;
  clearLabel: string;
  onFocusChange?: (focused: boolean) => void;
};

const tagKey = (tag: Tag) => String(tag.id);

export function TvTagFilter({ tags, selected, profileFocusTarget, nextFocusDown, firstTagRef, onToggle, onClear, clearLabel, onFocusChange }: Props) {
  const firstChipRef = useRef<View>(null);
  const clear = useCallback(async () => {
    // Move off the Clear button before clearing selection removes that button.
    await requestTvFocus(firstChipRef.current);
    onClear();
  }, [onClear]);
  const changeFocus = useCallback((focused: boolean) => { onFocusChange?.(focused); }, [onFocusChange]);
  const setRootRef = useCallback((target: View | null) => {
    if (typeof firstTagRef === "function") firstTagRef(target);
    else if (firstTagRef) firstTagRef.current = target;
  }, [firstTagRef]);
  const selectedTags = useMemo(() => new Set(selected), [selected]);
  const renderTag = useCallback(({ item: tag, index }: ListRenderItemInfo<Tag>) => (
    <TagChip
      ref={index === 0 ? firstChipRef : undefined}
      tag={tag}
      selected={selectedTags.has(tag.id)}
      nextFocusUp={profileFocusTarget}
      nextFocusDown={nextFocusDown}
      onFocusChange={changeFocus}
      onPress={() => onToggle(tag.id)}
    />
  ), [changeFocus, nextFocusDown, onToggle, profileFocusTarget, selectedTags]);
  if (tags.length === 0) return null;
  return (
    <TVFocusGuideView ref={setRootRef} autoFocus style={styles.row}>
      <TvHorizontalList
        data={tags}
        initialNumToRender={8}
        contentContainerStyle={styles.scroller}
        footer={selected.length > 0 ? (
          <ClearChip
            label={clearLabel}
            nextFocusUp={profileFocusTarget}
            nextFocusDown={nextFocusDown}
            onFocusChange={changeFocus}
            onPress={clear}
          />
        ) : null}
        keyExtractor={tagKey}
        renderItem={renderTag}
        wrapperStyle={styles.scrollerWrap}
      />
    </TVFocusGuideView>
  );
}

const TagChip = forwardRef<View, { tag: Tag; selected: boolean; nextFocusUp?: FocusDestination; nextFocusDown?: FocusDestination; onFocusChange: (focused: boolean) => void; onPress: () => void }>(function TagChip(
  { tag, selected, nextFocusUp, nextFocusDown, onFocusChange, onPress },
  ref,
) {
  return (
    <TvPressable
      ref={ref}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      onFocus={() => onFocusChange(true)}
      onBlur={() => onFocusChange(false)}
      onPress={onPress}
      style={({ focused, pressed }) => [styles.chip, focused && styles.chipFocused, pressed && styles.pressed]}
    >
      {({ focused }) => <>
        <TvControlSurface radius={33} focused={focused} emphasized={selected} />
        {selected ? <Text accessible={false} style={styles.label}>✓</Text> : null}
        <Text style={[styles.label, focused && styles.labelFocused]}>{tag.name}</Text>
      </>}
    </TvPressable>
  );
});

function ClearChip({ label, nextFocusUp, nextFocusDown, onFocusChange, onPress }: {
  label: string;
  nextFocusUp?: FocusDestination;
  nextFocusDown?: FocusDestination;
  onFocusChange: (focused: boolean) => void;
  onPress: () => void;
}) {
  return (
    <TvPressable
      accessibilityRole="button"
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      onFocus={() => onFocusChange(true)}
      onBlur={() => onFocusChange(false)}
      onPress={onPress}
      style={({ focused, pressed }) => [styles.chip, styles.clearChip, focused && styles.chipFocused, pressed && styles.pressed]}
    >
      {({ focused }) => <>
        <TvControlSurface radius={33} focused={focused} filled={false} />
        <Text accessible={false} style={[styles.clearIcon, focused && styles.labelFocused]}>×</Text>
        <Text style={[styles.label, styles.clearLabel, focused && styles.labelFocused]}>{label}</Text>
      </>}
    </TvPressable>
  );
}

const styles = StyleSheet.create({
  row: { width: "100%", height: 90, marginTop: 20 },
  scrollerWrap: { flex: 1, minWidth: 0, overflow: "hidden" },
  scroller: { alignItems: "center", gap: 12, paddingVertical: 8, paddingHorizontal: 20 },
  chip: { minHeight: 66, paddingHorizontal: 22, borderRadius: 33, flexDirection: "row", alignItems: "center", gap: 10 },
  chipFocused: { shadowColor: colors.black, shadowOpacity: 0.58, shadowRadius: 17, shadowOffset: { width: 0, height: 9 } },
  pressed: { opacity: 0.72 },
  label: { color: colors.text, fontSize: 23, fontWeight: "600" },
  labelFocused: { color: colors.text },
  clearChip: { backgroundColor: "transparent" },
  clearIcon: { color: colors.textMuted, fontSize: 28, lineHeight: 28, marginTop: -2 },
  clearLabel: { color: colors.textMuted },
});
