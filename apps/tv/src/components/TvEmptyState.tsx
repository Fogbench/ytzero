import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, typography } from "../theme";
import { SidebarIcon } from "./SidebarIcon";
import type { TvNavigationIcon } from "../navigation";
import { TvEmptyArt, type EmptyArtScene } from "./TvEmptyArt";

type Props = { title: string; description?: string; art?: EmptyArtScene; icon?: TvNavigationIcon; compact?: boolean; action?: ReactNode };
/** One non-focusable message, with an optional explicit remote action. */
export function TvEmptyState({ title, description, art, icon = "playlists", compact = false, action }: Props) {
  return <View style={[styles.container, compact && styles.compact]}>
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.visual}>
      {art ? <TvEmptyArt scene={art} /> : <View style={styles.icon}><SidebarIcon name={icon} size={42} color={colors.textMuted} /></View>}
    </View>
    <Text accessibilityRole="header" style={[styles.title, compact && styles.compactTitle]}>{title}</Text>
    {description ? <Text style={styles.description}>{description}</Text> : null}
    {action ? <View style={styles.action}>{action}</View> : null}
  </View>;
}
const styles = StyleSheet.create({
  container: { minHeight: 430, paddingVertical: 38, paddingHorizontal: 28, alignItems: "center", justifyContent: "center" },
  compact: { minHeight: 240, paddingVertical: 28 },
  visual: { marginBottom: 18 }, icon: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 34, lineHeight: 44, fontWeight: "600", textAlign: "center", maxWidth: 860 },
  compactTitle: { fontSize: 28, lineHeight: 36 },
  description: { color: colors.textMuted, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, maxWidth: 760, textAlign: "center", marginTop: 12 },
  action: { marginTop: 26 },
});
