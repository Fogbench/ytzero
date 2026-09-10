import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Translate } from "../i18n";
import { isCleartextInstance, normalizeInstanceUrl } from "../instanceUrl";
import { colors, typography } from "../theme";
import { TvButton } from "../components/TvButton";
import { TvListButton } from "../components/TvListButton";
import { TvSetupLayout } from "../components/TvSetupLayout";
import { TvTextField } from "../components/TvTextField";
import { TvScreenTransition } from "../components/TvScreenTransition";
import { useInstanceDiscovery } from "../useInstanceDiscovery";
import { useTvModalBack } from "../useTvModalBack";

type Props = { initialValue: string; t: Translate; onConnect: (instanceUrl: string) => Promise<void>; onBack?: () => void };

export function InstanceScreen({ initialValue, t, onConnect, onBack }: Props) {
  const [value, setValue] = useState(initialValue);
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"invalid" | "connection" | null>(null);
  const manualTarget = useRef<View>(null);
  const [connectTarget, setConnectTarget] = useState<View | null>(null);
  const discovery = useInstanceDiscovery();
  const normalized = useMemo(() => { try { return normalizeInstanceUrl(value); } catch { return null; } }, [value]);
  const connect = async (address = normalized) => {
    if (busy) return;
    if (!address) { setError("invalid"); return; }
    setBusy(true); setError(null);
    try { await onConnect(address); }
    catch { setError("connection"); }
    finally { setBusy(false); }
  };
  const leaveManual = () => { setManual(false); setError(null); requestAnimationFrame(() => manualTarget.current?.requestTVFocus()); };
  useTvModalBack(manual, () => { if (!busy) leaveManual(); }, Boolean(onBack));
  return <TvSetupLayout title={t("instanceTitle")} description={t("discoveryIntro")} t={t} onBack={busy ? undefined : manual ? leaveManual : onBack}>
    <TvScreenTransition key={manual ? "manual" : "discovered"} style={{ flex: 0 }}>
      <Text accessibilityRole="header" style={styles.heading}>{t(manual ? "manualAddress" : "nearbyInstances")}</Text>
      {manual ? <>
        <Text style={styles.label}>{t("addressLabel")}</Text>
        <TvTextField value={value} editable={!busy} accessibilityLabel={t("addressLabel")} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder={t("addressLabel")}
          nextFocusDown={connectTarget ?? undefined}
          onChangeText={(next) => { setValue(next); setError(null); }} onSubmitEditing={() => void connect()}
          onEndEditing={() => requestAnimationFrame(() => connectTarget?.requestTVFocus())} />
        <Text style={styles.hint}>{t("addressHint")}</Text>
        {normalized && isCleartextInstance(normalized) ? <Text style={styles.connectionNote}>{t("cleartextTitle")} · {t("cleartextHint")}</Text> : null}
        <View style={styles.actions}>
          <TvButton ref={setConnectTarget} label={busy ? t("connecting") : t("connect")} variant="primary" preferredFocus disabled={busy || !normalized} onPress={() => void connect()} />
        </View>
      </> : <>
        <ScrollView style={styles.instances} contentContainerStyle={styles.instanceList} showsVerticalScrollIndicator={false}>
          {discovery.instances.map((instance) => <TvListButton key={instance.id} label={instance.name.replace(/ [a-f0-9]{8}$/, "")} detail={instance.url}
            disabled={busy} onPress={() => { setValue(instance.url); void connect(instance.url); }} />)}
          {discovery.instances.length === 0 ? <View style={styles.empty}>
            {discovery.status === "searching" ? <ActivityIndicator color={colors.textMuted} /> : null}
            <Text style={styles.status}>{t(discovery.status === "searching" ? "searchingInstances" : discovery.status === "unavailable" ? "discoveryUnavailable" : "noInstancesFound")}</Text>
            <Text style={styles.hint}>{t("discoveryHint")}</Text>
          </View> : null}
        </ScrollView>
        <View style={styles.actions}>
          <TvButton ref={manualTarget} label={t("manualAddress")} preferredFocus disabled={busy} onPress={() => { setManual(true); setError(null); }} />
          {discovery.supported ? <TvButton label={t("scanAgain")} variant="ghost" disabled={busy} onPress={discovery.rescan} /> : null}
        </View>
      </>}
      {busy ? <View style={styles.busy}><ActivityIndicator color={colors.text} /><Text style={styles.hint}>{t("connecting")}</Text></View> : null}
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{t(error === "invalid" ? "invalidAddress" : "cannotConnect")}</Text> : null}
    </TvScreenTransition>
  </TvSetupLayout>;
}
const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 30, fontWeight: "600", marginBottom: 28 },
  label: { color: colors.textMuted, fontSize: typography.caption.fontSize, marginBottom: 12 },
  hint: { color: colors.textMuted, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, marginTop: 12 },
  connectionNote: { color: colors.textMuted, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, marginTop: 24 },
  actions: { flexDirection: "row", gap: 14, marginTop: 28, flexWrap: "wrap" },
  instances: { height: 280 }, instanceList: { gap: 14, padding: 10 },
  empty: { minHeight: 250, justifyContent: "center", paddingHorizontal: 20, gap: 8 },
  status: { color: colors.text, fontSize: 24, lineHeight: 32, fontWeight: "500" },
  error: { color: colors.danger, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, marginTop: 20 },
  busy: { flexDirection: "row", alignItems: "center", gap: 16 },
});
