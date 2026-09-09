import { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler, StyleSheet, TVEventControl, useWindowDimensions, View, type FocusDestination, type LayoutChangeEvent } from "react-native";
import { YtZeroApi } from "./src/api";
import { deviceLanguage, normalizeLanguage, translator } from "./src/i18n";
import { InstanceScreen } from "./src/screens/InstanceScreen";
import { PairScreen } from "./src/screens/PairScreen";
import { FeedScreen } from "./src/screens/FeedScreen";
import { BookmarksScreen } from "./src/screens/BookmarksScreen";
import { ChannelScreen } from "./src/screens/ChannelScreen";
import { WatchScreen } from "./src/screens/WatchScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { TvSidebar } from "./src/components/TvSidebar";
import { TvProfileMenu } from "./src/components/TvProfileMenu";
import { TvLoadingMark } from "./src/components/TvLoadingMark";
import { TvScreenTransition } from "./src/components/TvScreenTransition";
import { TvMotionProvider } from "./src/motion";
import { TvVideoActionMenu, type VideoActionOptions } from "./src/components/TvVideoActionMenu";
import { isTvBrowseDestination, type TvBrowseDestination, type TvDestination } from "./src/navigation";
import { clearAccessToken, loadConnection, saveAccessToken, saveInstanceUrl } from "./src/storage";
import type { AuthStatus, Language, PairingAuthorization, Profile, Video } from "./src/types";
import { colors, sidebarRailWidth } from "./src/theme";
import { tvVideoCardActionConfig, type VideoCardActionConfig } from "./src/videoCardActions";

type Screen = "boot" | "instance" | "pair" | "channel" | "detail" | TvDestination;
type DetailReturnScreen = "channel" | TvBrowseDestination;
type ProfileState = { active: Profile; profiles: Profile[]; canSwitch: boolean; childLockEnabled: boolean };
type VideoActionRequest = { video: Video; onChange: (updated: Video) => void; options?: VideoActionOptions };

export default function App() {
  return <TvMotionProvider><TvApp /></TvMotionProvider>;
}

function TvApp() {
  const { width, height } = useWindowDimensions();
  const [screen, setScreen] = useState<Screen>("boot");
  const [instanceUrl, setInstanceUrl] = useState("");
  const [accessToken, setAccessToken] = useState<string | undefined>();
  const [pairing, setPairing] = useState<PairingAuthorization | null>(null);
  const [pairingInstanceUrl, setPairingInstanceUrl] = useState("");
  const [pairingFromSettings, setPairingFromSettings] = useState(false);
  const [language, setLanguage] = useState<Language>(deviceLanguage);
  const [sidebarNav, setSidebarNav] = useState("");
  const [feedSort, setFeedSort] = useState<"published" | "arrival">("published");
  const [showTopChannels, setShowTopChannels] = useState(true);
  const [shortsEnabled, setShortsEnabled] = useState(true);
  const [videoActionConfig, setVideoActionConfig] = useState<VideoCardActionConfig>(() => tvVideoCardActionConfig(null));
  const [videoActionRequest, setVideoActionRequest] = useState<VideoActionRequest | null>(null);
  const [profileState, setProfileState] = useState<ProfileState | null>(null);
  const [incognito, setIncognito] = useState(false);
  const [profileFocusTarget, setProfileFocusTarget] = useState<View | null>(null);
  const [contentFocusTarget, setContentFocusTarget] = useState<FocusDestination | null>(null);
  const [returnDestination, setReturnDestination] = useState<TvBrowseDestination>("/");
  const [detailReturnScreen, setDetailReturnScreen] = useState<DetailReturnScreen>("/");
  const [contentFocusRequest, setContentFocusRequest] = useState(0);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Video | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());
  const t = useMemo(() => translator(language), [language]);
  const api = useMemo(() => instanceUrl ? new YtZeroApi(instanceUrl, accessToken) : null, [accessToken, instanceUrl]);
  const pairingApi = useMemo(() => pairingInstanceUrl ? new YtZeroApi(pairingInstanceUrl) : null, [pairingInstanceUrl]);

  useEffect(() => {
    if (profileState?.active.is_child) setIncognito(false);
  }, [profileState?.active.is_child]);

  useEffect(() => {
    if (__DEV__) console.info("[YT Zero TV] navigation", { screen, connected: Boolean(instanceUrl), authenticated: Boolean(accessToken) });
  }, [accessToken, instanceUrl, screen]);

  useEffect(() => {
    const canCancelConnectionFlow = pairingFromSettings && (screen === "instance" || screen === "pair");
    if (screen !== "channel" && screen !== "detail" && screen !== "/settings" && !canCancelConnectionFlow) {
      TVEventControl.disableTVMenuKey();
      return;
    }
    TVEventControl.enableTVMenuKey();
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canCancelConnectionFlow) {
        setPairing(null);
        setPairingInstanceUrl("");
        setPairingFromSettings(false);
        setContentFocusTarget(null);
        setContentFocusRequest((request) => request + 1);
        setScreen("/settings");
        return true;
      }
      if (screen === "detail") {
        setSelected(null);
        setScreen(detailReturnScreen);
        return true;
      }
      if (screen === "channel") {
        setSelectedChannelId(null);
        setContentFocusTarget(null);
        setContentFocusRequest((request) => request + 1);
      }
      setScreen(returnDestination);
      return true;
    });
    return () => {
      subscription.remove();
      TVEventControl.disableTVMenuKey();
    };
  }, [detailReturnScreen, pairingFromSettings, returnDestination, screen]);

  const navigate = useCallback((destination: TvDestination) => {
    setSelectedChannelId(null);
    setContentFocusTarget(null);
    if (isTvBrowseDestination(destination)) setReturnDestination(destination);
    setContentFocusRequest((request) => request + 1);
    setScreen(destination);
  }, []);

  const readProfileSettings = useCallback(async (client: YtZeroApi) => {
    try {
      const result = await client.settings();
      setLanguage(normalizeLanguage(result.settings.language));
      setSidebarNav(typeof result.settings.sidebar_nav === "string" ? result.settings.sidebar_nav : "");
      setFeedSort(result.settings.feed_sort === "arrival" ? "arrival" : "published");
      setShowTopChannels(result.settings.show_top_channels !== "0");
      setShortsEnabled(result.settings.show_shorts !== "disabled");
      setVideoActionConfig(tvVideoCardActionConfig(result.settings.video_card_action_buttons));
    } catch {
      // Device locale remains the safe fallback when this profile cannot read settings.
    }
  }, []);

  const readProfileState = useCallback(async (client: YtZeroApi, knownAuth?: AuthStatus) => {
    try {
      const [auth, profilesResult, childLockResult] = await Promise.all([
        knownAuth ? Promise.resolve(knownAuth) : client.authStatus(),
        client.profiles(),
        client.childLock().catch(() => ({ child_lock: { enabled: false, locked: false } })),
      ]);
      const active = profilesResult.profiles.find((profile) => profile.id === profilesResult.active_id || profile.active);
      if (!active) return setProfileState(null);
      const canSwitch = auth.can_switch && !auth.hide_other_profiles;
      setProfileState({
        active,
        profiles: canSwitch ? profilesResult.profiles : [active],
        canSwitch,
        childLockEnabled: childLockResult.child_lock.enabled,
      });
    } catch {
      setProfileState(null);
    }
  }, []);

  const createPairing = useCallback(async (url: string, replaceCurrentConnection: boolean) => {
    const anonymous = new YtZeroApi(url);
    await anonymous.health();
    const authorization = await anonymous.beginPairing();
    if (replaceCurrentConnection) {
      await Promise.all([saveInstanceUrl(url), clearAccessToken()]);
      setInstanceUrl(url);
      setAccessToken(undefined);
      setProfileState(null);
    }
    setPairingInstanceUrl(url);
    setPairing(authorization);
    setScreen("pair");
  }, []);

  const beginPairing = useCallback(async (url: string) => {
    await createPairing(url, true);
  }, [createPairing]);

  const beginSettingsPairing = useCallback(async (url: string) => {
    await createPairing(url, false);
  }, [createPairing]);

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
        const auth = await restored.authStatus();
        if (!auth.authenticated) throw new Error("expired session");
        if (!active) return;
        setAccessToken(stored.accessToken);
        await Promise.all([readProfileSettings(restored), readProfileState(restored, auth)]);
        if (active) setScreen("/");
      } catch {
        await clearAccessToken();
        if (!active) return;
        try { await beginPairing(stored.instanceUrl); } catch { if (active) setScreen("instance"); }
      }
    })();
    return () => { active = false; };
  }, [beginPairing, readProfileSettings, readProfileState]);

  const authorize = useCallback(async (token: string) => {
    const authorizedInstanceUrl = pairingInstanceUrl || instanceUrl;
    const authenticated = new YtZeroApi(authorizedInstanceUrl, token);
    const auth = await authenticated.authStatus();
    await Promise.all([readProfileSettings(authenticated), readProfileState(authenticated, auth)]);
    await Promise.all([saveInstanceUrl(authorizedInstanceUrl), saveAccessToken(token)]);
    setInstanceUrl(authorizedInstanceUrl);
    setAccessToken(token);
    setIncognito(false);
    setPairing(null);
    setPairingInstanceUrl("");
    setPairingFromSettings(false);
    setSelected(null);
    setSelectedChannelId(null);
    setRemovedIds(new Set());
    setReturnDestination("/");
    setScreen("/");
  }, [instanceUrl, pairingInstanceUrl, readProfileSettings, readProfileState]);

  const retryPairing = useCallback(async () => {
    await createPairing(pairingInstanceUrl || instanceUrl, !pairingFromSettings);
  }, [createPairing, instanceUrl, pairingFromSettings, pairingInstanceUrl]);

  const signOut = useCallback(async () => {
    try { await api?.logout(); } catch { /* Local cleanup still signs this television out. */ }
    await clearAccessToken();
    setAccessToken(undefined);
    setProfileState(null);
    setIncognito(false);
    setSelected(null);
    setSelectedChannelId(null);
    setPairingFromSettings(false);
    await beginPairing(instanceUrl);
  }, [api, beginPairing, instanceUrl]);

  const startInstanceChange = useCallback(async () => {
    setPairingFromSettings(true);
    setPairingInstanceUrl(instanceUrl);
    setPairing(null);
    setSelected(null);
    setSelectedChannelId(null);
    setContentFocusTarget(null);
    setScreen("instance");
  }, [instanceUrl]);

  const editPairingInstance = useCallback(() => {
    setPairing(null);
    setScreen("instance");
  }, []);

  const cancelInstanceChange = useCallback(() => {
    setPairing(null);
    setPairingInstanceUrl("");
    setPairingFromSettings(false);
    setContentFocusTarget(null);
    setContentFocusRequest((request) => request + 1);
    setScreen("/settings");
  }, []);

  const switchProfile = useCallback(async (profileId: number, pin?: string, childLockPin?: string) => {
    if (!api) throw new Error("not connected");
    await api.switchProfile(profileId, pin, childLockPin);
    setIncognito(false);
    setSelected(null);
    setRemovedIds(new Set());
    await Promise.all([readProfileSettings(api), readProfileState(api)]);
    setContentFocusRequest((request) => request + 1);
  }, [api, readProfileSettings, readProfileState]);

  const openChannel = useCallback((channelId: string) => {
    setVideoActionRequest(null);
    setSelected(null);
    setSelectedChannelId(channelId);
    setContentFocusTarget(null);
    setContentFocusRequest((request) => request + 1);
    setScreen("channel");
  }, []);

  const openVideoActions = useCallback((video: Video, onChange: (updated: Video) => void, options?: VideoActionOptions) => {
    setVideoActionRequest({ video, onChange, options });
  }, []);

  const closeChannel = useCallback(() => {
    setSelectedChannelId(null);
    setContentFocusTarget(null);
    setContentFocusRequest((request) => request + 1);
    setScreen(returnDestination);
  }, [returnDestination]);

  let content;
  if (screen === "boot") {
    content = <View style={styles.boot}><TvLoadingMark accessibilityLabel={t("booting")} size={64} /></View>;
  } else if (screen === "instance") {
    content = (
      <InstanceScreen
        initialValue={pairingInstanceUrl || instanceUrl}
        t={t}
        onConnect={pairingFromSettings ? beginSettingsPairing : beginPairing}
        onBack={pairingFromSettings ? cancelInstanceChange : undefined}
      />
    );
  } else if (screen === "pair" && pairingApi && pairing) {
    content = (
      <PairScreen
        api={pairingApi}
        pairing={pairing}
        t={t}
        onAuthorized={(token) => void authorize(token)}
        onRetry={retryPairing}
        onChangeInstance={editPairingInstance}
        onBack={pairingFromSettings ? cancelInstanceChange : undefined}
      />
    );
  } else if (screen === "detail" && api && selected) {
    content = (
      <WatchScreen
        api={api}
        incognito={incognito}
        isChild={profileState?.active.is_child ?? false}
        language={language}
        t={t}
        video={selected}
        onBack={() => setScreen(detailReturnScreen)}
        onOpenChannel={openChannel}
        onOpenVideo={setSelected}
        onSourceVisibilityChange={(id, hidden) => setRemovedIds((ids) => {
          const next = new Set(ids);
          if (hidden) next.add(id);
          else next.delete(id);
          return next;
        })}
        onVideoLongPress={openVideoActions}
      />
    );
  } else if (screen === "channel" && api && selectedChannelId) {
    content = (
      <ChannelScreen
        key={[instanceUrl, accessToken, profileState?.active.id, selectedChannelId, ...removedIds].join(":")}
        api={api}
        channelId={selectedChannelId}
        focusRequest={contentFocusRequest}
        language={language}
        profileFocusTarget={profileFocusTarget}
        shortsEnabled={shortsEnabled}
        onBack={closeChannel}
        onPrimaryFocusTarget={setContentFocusTarget}
        onVideoLongPress={openVideoActions}
        t={t}
        viewportWidth={width - sidebarRailWidth}
        viewportHeight={height}
        onOpen={(video) => {
          setDetailReturnScreen("channel");
          setSelected(video);
          setScreen("detail");
        }}
      />
    );
  } else if (screen === "/settings" && api) {
    content = <SettingsScreen focusRequest={contentFocusRequest} instanceUrl={instanceUrl} profileFocusTarget={profileFocusTarget} t={t} onBack={() => setScreen(returnDestination)} onSignOut={signOut} onChangeInstance={startInstanceChange} />;
  } else if (screen === "/bookmarks" && api) {
    content = (
      <BookmarksScreen
        key={[instanceUrl, accessToken, profileState?.active.id, screen, ...removedIds].join(":")}
        api={api}
        focusRequest={contentFocusRequest}
        language={language}
        profileFocusTarget={profileFocusTarget}
        onPrimaryFocusTarget={setContentFocusTarget}
        onVideoLongPress={openVideoActions}
        t={t}
        viewportWidth={width - sidebarRailWidth}
        viewportHeight={height}
        onOpen={(video) => {
          setDetailReturnScreen(screen);
          setReturnDestination(screen);
          setSelected(video);
          setScreen("detail");
        }}
      />
    );
  } else if (api && isTvBrowseDestination(screen)) {
    content = (
      <FeedScreen
        key={[instanceUrl, accessToken, profileState?.active.id, screen, ...removedIds].join(":")}
        api={api}
        destination={screen}
        focusRequest={contentFocusRequest}
        feedSort={feedSort}
        language={language}
        profileFocusTarget={profileFocusTarget}
        showTopChannels={showTopChannels}
        onPrimaryFocusTarget={setContentFocusTarget}
        onVideoLongPress={openVideoActions}
        t={t}
        viewportWidth={width - sidebarRailWidth}
        viewportHeight={height}
        onOpenChannel={(channel) => openChannel(channel.channel_id)}
        onOpen={(video) => {
          setDetailReturnScreen(screen);
          setReturnDestination(screen);
          setSelected(video);
          setScreen("detail");
        }}
      />
    );
  } else {
    content = <View style={styles.boot}><TvLoadingMark accessibilityLabel={t("booting")} size={64} /></View>;
  }

  const traceRootLayout = (event: LayoutChangeEvent) => {
    if (__DEV__) console.info("[YT Zero TV] root layout", event.nativeEvent.layout);
  };

  const shellDestination: TvDestination | null = screen === "channel" ? returnDestination : screen === "/settings" || isTvBrowseDestination(screen) ? screen : null;
  const inShell = Boolean(api) && shellDestination !== null;
  return (
    <View style={styles.root} onLayout={traceRootLayout}>
      {inShell && shellDestination && (
        <TvSidebar
          current={shellDestination}
          navConfig={sidebarNav}
          contentFocusTarget={contentFocusTarget ?? undefined}
          onNavigate={navigate}
          t={t}
        />
      )}
      {inShell && profileState && api && (
        <TvProfileMenu
          api={api}
          active={profileState.active}
          profiles={profileState.profiles}
          canSwitch={profileState.canSwitch}
          childLockEnabled={profileState.childLockEnabled}
          contentFocusTarget={contentFocusTarget ?? undefined}
          incognito={incognito}
          onIncognitoChange={setIncognito}
          onTriggerReady={setProfileFocusTarget}
          onSwitch={switchProfile}
          preserveMenuKey={screen === "channel" || shellDestination === "/settings"}
          t={t}
        />
      )}
      <View style={[styles.content, inShell && styles.contentWithSidebar]}>
        <TvScreenTransition key={screen === "detail" ? `${screen}:${selected?.video_id ?? ""}` : screen}>{content}</TvScreenTransition>
      </View>
      {api ? (
        <TvVideoActionMenu
          actionConfig={videoActionConfig}
          api={api}
          onClose={() => setVideoActionRequest(null)}
          onOpenChannel={openChannel}
          onRemove={videoActionRequest?.options?.onRemove}
          onVideoChange={(updated) => {
            videoActionRequest?.onChange(updated);
            setVideoActionRequest((current) => current ? { ...current, video: updated } : null);
            setSelected((current) => current?.video_id === updated.video_id ? updated : current);
          }}
          preserveMenuKey={screen === "channel" || screen === "detail"}
          t={t}
          video={videoActionRequest?.video ?? null}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: "100%", height: "100%", backgroundColor: colors.background },
  content: { flex: 1 },
  contentWithSidebar: { marginLeft: sidebarRailWidth },
  boot: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
});
