import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
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
};

export function PairScreen({ api, pairing, t, onAuthorized, onRetry, onChangeInstance }: Props) {
  const [expired, setExpired] = useState(false);
  const [networkError, setNetworkError] = useState(false);

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
    <View style={styles.screen}>
      <View style={styles.header}><Logo compact /></View>
      <View style={styles.content}>
        <View style={styles.qrPanel}>
          <View style={styles.qr}><QRCode value={pairing.verificationUriComplete} size={270} backgroundColor={colors.white} color={colors.black} /></View>
          <Text style={styles.uri}>{pairing.verificationUri}</Text>
        </View>
        <View style={styles.instructions}>
          <Text style={styles.title}>{t("pairTitle")}</Text>
          <Text style={styles.description}>{t("pairDescription")}</Text>
          <Text style={styles.codeLabel}>{t("enterCode")}</Text>
          <Text style={styles.code}>{pairing.userCode}</Text>
          {!expired ? (
            <View style={styles.waiting}>
              <ActivityIndicator color={colors.textMuted} size="small" />
              <Text style={styles.waitingText}>{networkError ? t("cannotConnect") : t("waiting")}</Text>
            </View>
          ) : (
            <View style={styles.expired}>
              <Text style={styles.error}>{t("pairExpired")}</Text>
              <TvButton label={t("retry")} variant="primary" onPress={() => void onRetry()} />
            </View>
          )}
          <TvButton label={t("changeInstance")} variant="ghost" onPress={onChangeInstance} style={styles.changeButton} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: screenPadding },
  header: { height: 52, justifyContent: "center" },
  content: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 76 },
  qrPanel: { width: 380, alignItems: "center" },
  qr: { backgroundColor: colors.white, borderRadius: 24, padding: 22 },
  uri: { color: colors.textMuted, fontSize: 16, marginTop: 18, textAlign: "center" },
  instructions: { width: 700 },
  title: { color: colors.text, fontSize: 50, lineHeight: 58, fontWeight: "800", letterSpacing: -1.5 },
  description: { color: colors.textMuted, fontSize: 22, lineHeight: 31, marginTop: 14, maxWidth: 680 },
  codeLabel: { color: colors.textMuted, fontSize: 18, fontWeight: "700", marginTop: 38, textTransform: "uppercase", letterSpacing: 1.5 },
  code: { color: colors.text, fontSize: 58, lineHeight: 70, fontWeight: "800", letterSpacing: 8, marginTop: 4 },
  waiting: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 24 },
  waitingText: { color: colors.textMuted, fontSize: 19 },
  expired: { alignItems: "flex-start", gap: 18, marginTop: 22 },
  error: { color: colors.danger, fontSize: 19, fontWeight: "700" },
  changeButton: { alignSelf: "flex-start", marginTop: 26 },
});
