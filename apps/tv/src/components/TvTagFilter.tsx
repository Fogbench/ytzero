import { forwardRef, useCallback, useMemo, useState, type Ref } from "react";
import { Pressable, StyleSheet, Text, TVFocusGuideView, View, type FocusDestination, type ListRenderItemInfo } from "react-native";
import { useVerticalFocusRedirect } from "../focus";
import type { Tag } from "../types";
import { colors } from "../theme";
import { TvHorizontalList } from "./TvHorizontalList";

type Props = {
  tags: Tag[];
  selected: number[];
  profileFocusTarget: FocusDestination;
  nextFocusDown?: FocusDestination;
  firstTagRef?: Ref<View>;
  onToggle: (tagId: number) => void;
  onClear: () => void;
  clearLabel: string;
};

export function TvTagFilter({ tags, selected, profileFocusTarget, nextFocusDown, firstTagRef, onToggle, onClear, clearLabel }: Props) {
  const [tagFocused, setTagFocused] = useState(false);
  const selectedTags = useMemo(() => new Set(selected), [selected]);
  useVerticalFocusRedirect(tagFocused, profileFocusTarget, nextFocusDown);
  const renderTag = useCallback(({ item: tag, index }: ListRenderItemInfo<Tag>) => (
    <TagChip
      ref={index === 0 ? firstTagRef : undefined}
      tag={tag}
      selected={selectedTags.has(tag.id)}
      nextFocusUp={profileFocusTarget}
      nextFocusDown={nextFocusDown}
      onFocusChange={setTagFocused}
      onPress={() => onToggle(tag.id)}
    />
  ), [firstTagRef, nextFocusDown, onToggle, profileFocusTarget, selectedTags]);
  if (tags.length === 0) return null;
  return (
    <View style={styles.row}>
      <TvHorizontalList
        data={tags}
        initialNumToRender={8}
        contentContainerStyle={styles.scroller}
        footer={selected.length > 0 ? (
          <ClearChip
            label={clearLabel}
            nextFocusUp={profileFocusTarget}
            nextFocusDown={nextFocusDown}
            onFocusChange={setTagFocused}
            onPress={onClear}
          />
        ) : null}
        keyExtractor={(tag) => String(tag.id)}
        renderItem={renderTag}
        wrapperStyle={styles.scrollerWrap}
      />
      <TVFocusGuideView destinations={[profileFocusTarget]} style={styles.profileBridge} />
    </View>
  );
}

const TagChip = forwardRef<View, { tag: Tag; selected: boolean; nextFocusUp?: FocusDestination; nextFocusDown?: FocusDestination; onFocusChange: (focused: boolean) => void; onPress: () => void }>(function TagChip(
  { tag, selected, nextFocusUp, nextFocusDown, onFocusChange, onPress },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      onFocus={() => { setFocused(true); onFocusChange(true); }}
      onBlur={() => { setFocused(false); onFocusChange(false); }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, focused && styles.chipFocused, pressed && styles.pressed]}
    >
      <Text style={[styles.label, focused && styles.labelFocused]}>{tag.name}</Text>
    </Pressable>
  );
});

function ClearChip({ label, nextFocusUp, nextFocusDown, onFocusChange, onPress }: {
  label: string;
  nextFocusUp?: FocusDestination;
  nextFocusDown?: FocusDestination;
  onFocusChange: (focused: boolean) => void;
  onPress: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      onFocus={() => { setFocused(true); onFocusChange(true); }}
      onBlur={() => { setFocused(false); onFocusChange(false); }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, styles.clearChip, focused && styles.chipFocused, pressed && styles.pressed]}
    >
      <Text style={[styles.clearIcon, focused && styles.labelFocused]}>×</Text>
      <Text style={[styles.label, styles.clearLabel, focused && styles.labelFocused]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { width: "100%", flexDirection: "row", alignItems: "center", marginTop: 25 },
  scrollerWrap: { flex: 1, minWidth: 0, overflow: "hidden" },
  scroller: { alignItems: "center", gap: 12, paddingVertical: 8, paddingHorizontal: 20 },
  profileBridge: { width: 80, height: 62 },
  chip: { minHeight: 50, paddingHorizontal: 19, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surfaceRaised },
  chipSelected: { backgroundColor: colors.surfaceSelected },
  chipFocused: { backgroundColor: colors.white, transform: [{ scale: 1.07 }], shadowColor: colors.black, shadowOpacity: 0.58, shadowRadius: 17, shadowOffset: { width: 0, height: 9 } },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  label: { color: colors.text, fontSize: 18, fontWeight: "600" },
  labelFocused: { color: colors.black },
  clearChip: { backgroundColor: "transparent" },
  clearIcon: { color: colors.textMuted, fontSize: 28, lineHeight: 28, marginTop: -2 },
  clearLabel: { color: colors.textMuted },
});
