import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, typography } from "../theme";
import { TvSurface } from "./TvSurface";

export function TvSettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return <View style={styles.section}><Text accessibilityRole="header" style={styles.heading}>{title}</Text>{children}</View>;
}
export function TvSettingRow({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return <View style={styles.row}><TvSurface material="content" radius={28}><View style={styles.copy}><Text accessibilityRole="header" style={styles.title}>{title}</Text><Text style={styles.detail}>{detail}</Text></View>{children}</TvSurface></View>;
}
const styles = StyleSheet.create({
  section: { width: "100%", maxWidth: 1280, marginBottom: 32 },
  heading: { color: colors.textMuted, fontSize: typography.caption.fontSize, fontWeight: "600", marginLeft: 12, marginBottom: 16 },
  row: { minHeight: 148, padding: 30, borderRadius: 28, flexDirection: "row", alignItems: "center", gap: 40 },
  copy: { flex: 1 }, title: { color: colors.text, fontSize: 26, fontWeight: "600" },
  detail: { color: colors.textMuted, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, marginTop: 12 },
});
