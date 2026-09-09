import { useEffect, useRef } from "react";
import { ScrollView, StyleSheet, Text, TVFocusGuideView, View, type FocusDestination } from "react-native";
import type { Translate } from "../i18n";
import { colors, screenPadding } from "../theme";
import { TvButton } from "../components/TvButton";

type Props = {
  focusRequest: number;
  instanceUrl: string;
  profileFocusTarget: FocusDestination;
  onBack: () => void;
  onChangeInstance: () => Promise<void>;
  onSignOut: () => Promise<void>;
  t: Translate;
};

export function SettingsScreen({ focusRequest, instanceUrl, profileFocusTarget, onBack, onChangeInstance, onSignOut, t }: Props) {
  const firstActionRef = useRef<View>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => firstActionRef.current?.requestTVFocus());
    return () => cancelAnimationFrame(frame);
  }, [focusRequest]);

  return (
    <TVFocusGuideView autoFocus style={styles.focusGuide}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t("deviceSettingsTitle")}</Text>
        <Text style={styles.description}>{t("deviceSettingsDescription")}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("connection")}</Text>
          <View style={styles.row}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>{t("currentInstance")}</Text>
              <Text numberOfLines={1} style={styles.instance}>{instanceUrl}</Text>
              <Text style={styles.rowDescription}>{t("changeInstanceHint")}</Text>
            </View>
            <TvButton ref={firstActionRef} preferredFocus label={t("changeInstance")} nextFocusUp={profileFocusTarget} onPress={() => void onChangeInstance()} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("session")}</Text>
          <View style={styles.row}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>{t("signOut")}</Text>
              <Text style={styles.rowDescription}>{t("signOutHint")}</Text>
            </View>
            <TvButton label={t("signOut")} variant="danger" onPress={() => void onSignOut()} />
          </View>
        </View>

        <TvButton label={t("back")} variant="ghost" onPress={onBack} style={styles.back} />
      </ScrollView>
    </TVFocusGuideView>
  );
}

const styles = StyleSheet.create({
  focusGuide: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: screenPadding, paddingTop: 70, paddingBottom: 90 },
  title: { color: colors.text, fontSize: 54, lineHeight: 62, fontWeight: "700", letterSpacing: -1.8 },
  description: { color: colors.textMuted, fontSize: 21, lineHeight: 29, marginTop: 12, marginBottom: 44 },
  section: { maxWidth: 1180, marginBottom: 30 },
  sectionTitle: { color: colors.textMuted, fontSize: 17, fontWeight: "700", letterSpacing: 1.1, textTransform: "uppercase", marginLeft: 8, marginBottom: 13 },
  row: { minHeight: 154, paddingHorizontal: 30, paddingVertical: 25, borderRadius: 24, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 40 },
  rowCopy: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 25, fontWeight: "600" },
  instance: { color: colors.text, fontSize: 19, fontWeight: "500", marginTop: 9 },
  rowDescription: { color: colors.textMuted, fontSize: 18, lineHeight: 25, marginTop: 9, maxWidth: 760 },
  back: { alignSelf: "flex-start", marginTop: 6 },
});
