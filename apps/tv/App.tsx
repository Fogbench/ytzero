import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, BackHandler, StyleSheet, Text, TVEventControl, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";
import { YtZeroApi } from "./src/api";
import { deviceLanguage, normalizeLanguage, translator } from "./src/i18n";
import { InstanceScreen } from "./src/screens/InstanceScreen";
import { PairScreen } from "./src/screens/PairScreen";
import { FeedScreen } from "./src/screens/FeedScreen";
import { DetailScreen } from "./src/screens/DetailScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { TvSidebar } from "./src/components/TvSidebar";
import { clearAccessToken, clearConnection, loadConnection, saveAccessToken, saveInstanceUrl } from "./src/storage";
import type { Language, PairingAuthorization, Video } from "./src/types";
import { colors, sidebarRailWidth } from "./src/theme";

type Screen = "boot" | "instance" | "pair" | "feed" | "detail" | "settings";

export default function App() {
  const { width, height } = useWindowDimensions();
  const [screen, setScreen] = useState<Screen>("boot");
  const [instanceUrl, setInstanceUrl] = useState("");
  const [accessToken, setAccessToken] = useState<string | undefined>();
  const [pairing, setPairing] = useState<PairingAuthorization | null>(null);
  const [language, setLanguage] = useState<Language>(deviceLanguage);
  const [sidebarNav, setSidebarNav] = useState("");
  const [selected, setSelected] = useState<Video | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());
  const t = useMemo(() => translator(language), [language]);
  const api = useMemo(() => instanceUrl ? new YtZeroApi(instanceUrl, accessToken) : null, [accessToken, instanceUrl]);

  useEffect(() => {
    if (__DEV__) console.info("[YT Zero TV] navigation", { screen, connected: Boolean(instanceUrl), authenticated: Boolean(accessToken) });
  }, [accessToken, instanceUrl, screen]);

  useEffect(() => {
    if (screen !== "detail" && screen !== "settings") {
      TVEventControl.disableTVMenuKey();
      return;
    }
    TVEventControl.enableTVMenuKey();
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (screen === "detail") setSelected(null);
      setScreen("feed");
      return true;
    });
    return () => {
      subscription.remove();
      TVEventControl.disableTVMenuKey();
    };
  }, [screen]);

  const readProfileSettings = useCallback(async (client: YtZeroApi) => {
    try {
      const result = await client.settings();
      setLanguage(normalizeLanguage(result.settings.language));
      setSidebarNav(typeof result.settings.sidebar_nav === "string" ? result.settings.sidebar_nav : "");
    } catch {
      // Device locale remains the safe fallback when this profile cannot read settings.
    }
  }, []);

  const beginPairing = useCallback(async (url: string) => {
    const anonymous = new YtZeroApi(url);
    await anonymous.health();
    await saveInstanceUrl(url);
    setInstanceUrl(url);
    setAccessToken(undefined);
    setPairing(await anonymous.beginPairing());
    setScreen("pair");
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const stored = await loadConnection();
      if (!active) return;
      if (!stored.instanceUrl) return setScreen("instance");
      setInstanceUrl(stored.instanceUrl);
      if (!stored.accessToken) {
        try { await beginPairing(stored.instanceUrl); } catch { if (active) setScreen("instance"); }
        return;
      }
      const restored = new YtZeroApi(stored.instanceUrl, stored.accessToken);
      try {
        if (!await restored.authStatus()) throw new Error("expired session");
        if (!active) return;
        setAccessToken(stored.accessToken);
        await readProfileSettings(restored);
        if (active) setScreen("feed");
      } catch {
        await clearAccessToken();
        if (!active) return;
        try { await beginPairing(stored.instanceUrl); } catch { if (active) setScreen("instance"); }
      }
    })();
    return () => { active = false; };
  }, [beginPairing, readProfileSettings]);

  const authorize = useCallback(async (token: string) => {
    await saveAccessToken(token);
    setAccessToken(token);
    const authenticated = new YtZeroApi(instanceUrl, token);
    await readProfileSettings(authenticated);
    setPairing(null);
    setScreen("feed");
  }, [instanceUrl, readProfileSettings]);

  const retryPairing = useCallback(async () => { await beginPairing(instanceUrl); }, [beginPairing, instanceUrl]);

  const signOut = useCallback(async () => {
    try { await api?.logout(); } catch { /* Local cleanup still signs this television out. */ }
    await clearAccessToken();
    setAccessToken(undefined);
    await beginPairing(instanceUrl);
  }, [api, beginPairing, instanceUrl]);

  const changeInstance = useCallback(async () => {
    await clearConnection();
    setAccessToken(undefined);
    setPairing(null);
    setSelected(null);
    setRemovedIds(new Set());
    setSidebarNav("");
    setScreen("instance");
  }, []);

  let content;
  if (screen === "boot") {
    content = <View style={styles.boot}><ActivityIndicator size="large" color={colors.textMuted} /><Text style={styles.bootText}>{t("booting")}</Text></View>;
  } else if (screen === "instance") {
    content = <InstanceScreen initialValue={instanceUrl} t={t} onConnect={beginPairing} />;
  } else if (screen === "pair" && api && pairing) {
    content = <PairScreen api={api} pairing={pairing} t={t} onAuthorized={(token) => void authorize(token)} onRetry={retryPairing} onChangeInstance={() => void changeInstance()} />;
  } else if (screen === "detail" && api && selected) {
    content = <DetailScreen api={api} language={language} t={t} video={selected} onBack={() => setScreen("feed")} onRemoved={(id) => setRemovedIds((ids) => new Set(ids).add(id))} />;
  } else if (screen === "settings" && api) {
    content = <SettingsScreen instanceUrl={instanceUrl} t={t} onBack={() => setScreen("feed")} onSignOut={signOut} onChangeInstance={changeInstance} />;
  } else if (api) {
    content = <FeedScreen key={[instanceUrl, accessToken, ...removedIds].join(":")} api={api} t={t} viewportWidth={width - sidebarRailWidth} viewportHeight={height} onOpen={(video) => { setSelected(video); setScreen("detail"); }} />;
  } else {
    content = <View style={styles.boot}><Text style={styles.bootText}>{t("booting")}</Text></View>;
  }

  const traceRootLayout = (event: LayoutChangeEvent) => {
    if (__DEV__) console.info("[YT Zero TV] root layout", event.nativeEvent.layout);
  };

  const inShell = Boolean(api) && (screen === "feed" || screen === "settings");
  return (
    <View style={styles.root} onLayout={traceRootLayout}>
      {inShell && (
        <TvSidebar
          current={screen === "settings" ? "settings" : "feed"}
          navConfig={sidebarNav}
          onNavigate={setScreen}
          t={t}
        />
      )}
      <View style={[styles.content, inShell && styles.contentWithSidebar]}>{content}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: "100%", height: "100%", backgroundColor: colors.background },
  content: { flex: 1 },
  contentWithSidebar: { marginLeft: sidebarRailWidth },
  boot: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 20 },
  bootText: { color: colors.textMuted, fontSize: 21 },
});
