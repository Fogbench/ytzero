import { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TVFocusGuideView, View } from "react-native";
import type { Translate } from "../i18n";
import { isCleartextInstance, normalizeInstanceUrl } from "../instanceUrl";
import { colors, screenPadding } from "../theme";
import { Logo } from "../components/Logo";
import { TvButton } from "../components/TvButton";

type Props = {
  initialValue: string;
  t: Translate;
  onConnect: (instanceUrl: string) => Promise<void>;
  onBack?: () => void;
};

export function InstanceScreen({ initialValue, t, onConnect, onBack }: Props) {
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<"invalid" | "connection" | null>(null);
  const normalized = useMemo(() => {
    try { return normalizeInstanceUrl(value); } catch { return null; }
  }, [value]);

  const connect = async () => {
    if (!normalized || busy) {
      setError("invalid");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConnect(normalized);
    } catch {
      setError("connection");
    } finally {
      setBusy(false);
    }
  };

  return (
    <TVFocusGuideView autoFocus style={styles.screen}>
      <View style={styles.panel}>
        <View style={styles.header}>
          {onBack && <TvButton label={t("back")} variant="ghost" onPress={onBack} />}
          <Logo />
        </View>
        <View style={styles.heading}>
          <Text style={styles.title}>{t("instanceTitle")}</Text>
          <Text style={styles.description}>{t("instanceDescription")}</Text>
        </View>
        <View>
          <Text style={styles.label}>{t("addressLabel")}</Text>
          <TextInput
            value={value}
            onChangeText={(next) => { setValue(next); setError(null); }}
            onSubmitEditing={() => void connect()}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, focused && styles.inputFocused]}
          />
          <Text style={styles.hint}>{t("addressHint")}</Text>
          {normalized && isCleartextInstance(normalized) && (
            <View style={styles.warning}>
              <Text style={styles.warningTitle}>{t("cleartextTitle")}</Text>
              <Text style={styles.warningText}>{t("cleartextHint")}</Text>
            </View>
          )}
          {error && <Text style={styles.error}>{t(error === "invalid" ? "invalidAddress" : "cannotConnect")}</Text>}
        </View>
        <View style={styles.actions}>
          <TvButton label={busy ? t("connecting") : t("connect")} variant="primary" disabled={busy || !normalized} onPress={() => void connect()} />
          {busy && <ActivityIndicator color={colors.white} size="small" />}
        </View>
      </View>
    </TVFocusGuideView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: screenPadding, alignItems: "center", justifyContent: "center" },
  panel: { width: "64%", maxWidth: 920 },
  header: { flexDirection: "row", alignItems: "center", gap: 28 },
  heading: { marginTop: 48, marginBottom: 34 },
  title: { color: colors.text, fontSize: 48, lineHeight: 56, fontWeight: "800", letterSpacing: -1.4 },
  description: { color: colors.textMuted, fontSize: 22, lineHeight: 31, marginTop: 12, maxWidth: 760 },
  label: { color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: 10 },
  input: { height: 68, borderRadius: 14, borderWidth: 3, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, fontSize: 23, paddingHorizontal: 20 },
  inputFocused: { borderColor: colors.white, backgroundColor: colors.surfaceRaised },
  hint: { color: colors.textMuted, fontSize: 16, marginTop: 10 },
  warning: { marginTop: 18, borderLeftWidth: 4, borderLeftColor: colors.warning, paddingLeft: 16, maxWidth: 760 },
  warningTitle: { color: colors.warning, fontSize: 17, fontWeight: "800" },
  warningText: { color: colors.textMuted, fontSize: 16, lineHeight: 23, marginTop: 4 },
  error: { color: colors.danger, fontSize: 18, fontWeight: "700", marginTop: 16 },
  actions: { flexDirection: "row", alignItems: "center", gap: 20, marginTop: 30 },
});
