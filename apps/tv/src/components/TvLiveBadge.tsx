import { colors } from "../theme";
import { StyleSheet, Text, View } from "react-native";
import { translator } from "../i18n";
import type { Language } from "../types";
type Props = ({ language: Language; label?: never } | { label: string; language?: never }) & {
  placement?: "thumbnail" | "avatar";
};

export function TvLiveBadge({ language, label, placement = "thumbnail" }: Props) {
  return <View pointerEvents="none" style={placement === "avatar" ? styles.avatarPlacement : styles.thumbnailPlacement}>
    <View style={styles.badge}>
      <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[styles.label, placement === "avatar" && styles.avatarLabel]}>
        {label ?? translator(language!)("liveBadge")}
      </Text>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  thumbnailPlacement: { position: "absolute", left: 12, bottom: 12, maxWidth: "90%" },
  avatarPlacement: { position: "absolute", left: -20, right: -20, bottom: -2, alignItems: "center" },
  badge: { backgroundColor: "#b91c30", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, maxWidth: "100%" },
  label: { color: colors.white, fontSize: 18, lineHeight: 22, fontWeight: "700" },
  avatarLabel: { fontSize: 16, lineHeight: 20 },
});
