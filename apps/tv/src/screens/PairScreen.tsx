import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TVFocusGuideView, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import type { YtZeroApi } from "../api";
import type { Translate } from "../i18n";
import type { PairingAuthorization } from "../types";
import { colors, screenPadding } from "../theme";
import { Logo } from "../components/Logo";
import { TvButton } from "../components/TvButton";

type Props = {
  api: YtZeroApi;
  pairing: PairingAuthorization;
  t: Translate;
  onAuthorized: (accessToken: string) => void;
  onRetry: () => Promise<void>;
  onChangeInstance: () => void;
  onBack?: () => void;
};

export function PairScreen({ api, pairing, t, onAuthorized, onRetry, onChangeInstance, onBack }: Props) {
  const [expired, setExpired] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const displayCode = pairing.userCode.split("-").join("  ");

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const expiresAt = Date.now() + pairing.expiresIn * 1000;
    const poll = async () => {
      if (cancelled) return;
      if (Date.now() >= expiresAt) {
        setExpired(true);
        return;
      }
      try {
        const result = await api.pollPairing(pairing.deviceCode);
        if (cancelled) return;
        setNetworkError(false);
        if (result.kind === "authorized") return onAuthorized(result.accessToken);
        if (result.kind === "expired") return setExpired(true);
      } catch {
        if (!cancelled) setNetworkError(true);
      }
      timeout = setTimeout(poll, Math.max(2, pairing.interval) * 1000);
    };
    timeout = setTimeout(poll, pairing.interval * 1000);
    return () => { cancelled = true; if (timeout) clearTimeout(timeout); };
  }, [api, onAuthorized, pairing]);

  return (
    <TVFocusGuideView autoFocus style={styles.screen}>
      <View style={styles.header}>
        {onBack && <TvButton label={t("back")} variant="ghost" onPress={onBack} />}
        <Logo compact />
      </View>
      <View style={styles.content}>
        <View style={styles.instructions}>
          <Text style={styles.title}>{t("pairTitle")}</Text>
          <Text style={styles.description}>{t("pairDescription")}</Text>
          <View style={styles.codePanel}>
            <Text style={styles.codeLabel}>{t("enterCode")}</Text>
            <Text style={styles.code} numberOfLines={1}>{displayCode}</Text>
          </View>
          {!expired ? (
            <View style={styles.waiting}>
              <ActivityIndicator color={networkError ? colors.danger : colors.textMuted} size="small" />
              <Text style={[styles.waitingText, networkError && styles.error]}>{networkError ? t("cannotConnect") : t("waiting")}</Text>
            </View>
          ) : (
            <View style={styles.expired}>
              <Text style={styles.error}>{t("pairExpired")}</Text>
              <TvButton label={t("retry")} variant="primary" onPress={() => void onRetry()} />
            </View>
          )}
          <TvButton label={t("changeInstance")} variant="ghost" onPress={onChangeInstance} style={styles.changeButton} />
        </View>
        <View style={styles.qrPanel}>
          <View style={styles.qrFrame}>
            <View style={styles.qr}>
              <QRCode value={pairing.verificationUriComplete} size={286} backgroundColor={colors.white} color={colors.black} />
            </View>
          </View>
          <Text style={styles.uri} numberOfLines={1}>{pairing.verificationUri}</Text>
        </View>
      </View>
    </TVFocusGuideView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: screenPadding + 20, paddingVertical: 52 },
  header: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 28 },
  content: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 76, paddingBottom: 18 },
  instructions: { flex: 1, maxWidth: 790 },
  title: { color: colors.text, fontSize: 56, lineHeight: 64, fontWeight: "800", letterSpacing: -1.8 },
  description: { color: colors.textMuted, fontSize: 22, lineHeight: 31, marginTop: 16, maxWidth: 720 },
  codePanel: { alignSelf: "flex-start", minWidth: 560, backgroundColor: colors.surface, borderRadius: 26, paddingHorizontal: 30, paddingVertical: 23, marginTop: 34 },
  codeLabel: { color: colors.textMuted, fontSize: 15, lineHeight: 20, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.7 },
  code: { color: colors.text, fontSize: 52, lineHeight: 64, fontWeight: "800", letterSpacing: 6, marginTop: 2 },
  waiting: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: colors.surface, borderRadius: 24, paddingHorizontal: 18, minHeight: 46, marginTop: 20 },
  waitingText: { color: colors.textMuted, fontSize: 19 },
  expired: { flexDirection: "row", alignItems: "center", gap: 22, marginTop: 20 },
  error: { color: colors.danger, fontSize: 19, fontWeight: "700" },
  changeButton: { alignSelf: "flex-start", marginTop: 14 },
  qrPanel: { width: 430, alignItems: "center" },
  qrFrame: { backgroundColor: colors.surface, borderRadius: 40, padding: 18, shadowColor: colors.black, shadowOpacity: 0.7, shadowRadius: 34, shadowOffset: { width: 0, height: 18 } },
  qr: { backgroundColor: colors.white, borderRadius: 27, padding: 25, overflow: "hidden" },
  uri: { color: colors.textMuted, fontSize: 17, lineHeight: 23, fontWeight: "600", marginTop: 20, textAlign: "center", maxWidth: 420 },
});
