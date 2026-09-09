import { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TVEventControl,
  TVFocusGuideView,
  View,
  type FocusDestination,
  type ListRenderItemInfo,
} from "react-native";
import type { YtZeroApi } from "../api";
import type { Translate } from "../i18n";
import type { Profile } from "../types";
import { useVerticalFocusRedirect } from "../focus";
import { colors } from "../theme";
import { TvButton } from "./TvButton";
import { TvHorizontalList } from "./TvHorizontalList";
import { TvSwitch } from "./TvSwitch";

type Props = {
  active: Profile;
  api: YtZeroApi;
  canSwitch: boolean;
  childLockEnabled: boolean;
  contentFocusTarget?: FocusDestination;
  incognito: boolean;
  onIncognitoChange: (value: boolean) => void;
  onTriggerReady: (target: View | null) => void;
  onSwitch: (profileId: number, pin?: string, childLockPin?: string) => Promise<void>;
  preserveMenuKey: boolean;
  profiles: Profile[];
  t: Translate;
};

type MenuView = "menu" | "profiles";

export function TvProfileMenu({
  active,
  api,
  canSwitch,
  childLockEnabled,
  contentFocusTarget,
  incognito,
  onIncognitoChange,
  onTriggerReady,
  onSwitch,
  preserveMenuKey,
  profiles,
  t,
}: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<MenuView>("menu");
  const [triggerFocused, setTriggerFocused] = useState(false);
  const [focusedProfile, setFocusedProfile] = useState<number | null>(null);
  const [pickerBackTarget, setPickerBackTarget] = useState<View | null>(null);
  const [pinFor, setPinFor] = useState<Profile | null>(null);
  const [profilePin, setProfilePin] = useState("");
  const [childLockPin, setChildLockPin] = useState("");
  const [focusedPin, setFocusedPin] = useState<"profile" | "child" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const triggerRef = useRef<View>(null);
  const hadOverlay = useRef(false);
  const switchableProfiles = profiles.filter((profile) => profile.can_switch);
  const activeProfileIndex = switchableProfiles.findIndex((profile) => profile.active);
  const canChooseProfile = canSwitch && switchableProfiles.length > 1;
  const overlayVisible = open || pinFor !== null;
  const needsChildLock = Boolean(pinFor && pinFor.id !== active.id && active.is_child && childLockEnabled);
  const pinComplete = Boolean(
    pinFor
    && (!pinFor.has_pin || /^\d{6}$/.test(profilePin))
    && (!needsChildLock || /^\d{6}$/.test(childLockPin)),
  );
  useVerticalFocusRedirect(open && view === "profiles" && focusedProfile !== null, undefined, pickerBackTarget ?? undefined);
  useVerticalFocusRedirect(triggerFocused && !overlayVisible, undefined, contentFocusTarget);

  const setTriggerRef = useCallback((target: View | null) => {
    triggerRef.current = target;
    onTriggerReady(target);
  }, [onTriggerReady]);

  const clearPin = useCallback(() => {
    setPinFor(null);
    setProfilePin("");
    setChildLockPin("");
    setError(false);
  }, []);

  const close = useCallback(() => {
    if (busy) return;
    setOpen(false);
    setView("menu");
    clearPin();
  }, [busy, clearPin]);

  const returnToProfiles = useCallback(() => {
    if (busy) return;
    clearPin();
    setView("profiles");
    setOpen(true);
  }, [busy, clearPin]);

  useEffect(() => {
    if (overlayVisible) {
      hadOverlay.current = true;
      return;
    }
    if (!hadOverlay.current) return;
    hadOverlay.current = false;
    const frame = requestAnimationFrame(() => triggerRef.current?.requestTVFocus());
    return () => cancelAnimationFrame(frame);
  }, [overlayVisible]);

  useEffect(() => {
    if (!overlayVisible) return;
    TVEventControl.enableTVMenuKey();
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (pinFor) returnToProfiles();
      else if (view === "profiles") setView("menu");
      else close();
      return true;
    });
    return () => {
      subscription.remove();
      if (preserveMenuKey) TVEventControl.enableTVMenuKey();
      else TVEventControl.disableTVMenuKey();
    };
  }, [close, overlayVisible, pinFor, preserveMenuKey, returnToProfiles, view]);

  const openMenu = () => {
    setError(false);
    setView("menu");
    setOpen(true);
  };

  const choose = (profile: Profile) => {
    if (profile.active) return setView("menu");
    if (profile.pin_locked || busy) return;
    const childPinRequired = active.is_child && childLockEnabled;
    if (profile.has_pin || childPinRequired) {
      setOpen(false);
      setPinFor(profile);
      setProfilePin("");
      setChildLockPin("");
      setError(false);
      return;
    }
    void performSwitch(profile);
  };

  const performSwitch = async (requestedProfile?: Profile) => {
    const profile = requestedProfile ?? pinFor;
    if (!profile || busy) return;
    setBusy(true);
    setError(false);
    try {
      await onSwitch(profile.id, profilePin || undefined, childLockPin || undefined);
      setOpen(false);
      setView("menu");
      setPinFor(null);
      setProfilePin("");
      setChildLockPin("");
    } catch {
      setError(true);
      setProfilePin("");
      setChildLockPin("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <View style={styles.triggerWrap}>
        <Pressable
          ref={setTriggerRef}
          accessibilityRole="button"
          accessibilityLabel={`${t("currentProfile")}: ${active.name}. ${t("profiles")}`}
          nextFocusDown={contentFocusTarget}
          onBlur={() => setTriggerFocused(false)}
          onFocus={() => setTriggerFocused(true)}
          onPress={openMenu}
          style={({ pressed }) => [styles.trigger, triggerFocused && styles.triggerFocused, pressed && styles.pressed]}
          tvParallaxProperties={Platform.OS === "ios" ? { enabled: true, magnification: 1.04, pressMagnification: 0.98 } : undefined}
        >
          <View>
            <ProfileAvatar api={api} profile={active} size={48} />
            {incognito && <View style={styles.incognitoDot} />}
          </View>
          <Text numberOfLines={1} style={[styles.triggerName, triggerFocused && styles.triggerNameFocused]}>{active.name}</Text>
        </Pressable>
      </View>

      {open && (
        <TVFocusGuideView autoFocus trapFocusDown trapFocusLeft trapFocusRight trapFocusUp style={styles.overlay}>
          {view === "menu" ? (
            <View style={styles.menuPanel}>
              <View style={styles.hero}>
                <View>
                  <ProfileAvatar api={api} profile={active} size={112} />
                  {incognito && <View style={styles.heroIncognitoDot} />}
                </View>
                <Text numberOfLines={1} style={styles.heroName}>{active.name}</Text>
                <Text style={[styles.heroMeta, incognito && styles.heroMetaIncognito]}>
                  {incognito ? t("incognitoMode") : t("currentProfile")}
                </Text>
              </View>
              <View style={styles.menuActions}>
                <TvButton
                  disabled={!canChooseProfile}
                  focusScale={1.025}
                  label={t("switchProfile")}
                  preferredFocus={canChooseProfile}
                  style={styles.menuAction}
                  onPress={() => { setError(false); setView("profiles"); }}
                />
                {!active.is_child && (
                  <TvSwitch
                    description={t("incognitoModeHint")}
                    label={t("incognitoMode")}
                    onValueChange={onIncognitoChange}
                    preferredFocus={!canChooseProfile}
                    value={incognito}
                  />
                )}
              </View>
              <TvButton
                label={t("cancel")}
                preferredFocus={active.is_child && !canChooseProfile}
                variant="ghost"
                onPress={close}
              />
            </View>
          ) : (
            <View style={styles.pickerPanel}>
              <Text style={styles.pickerTitle}>{t("switchProfile")}</Text>
              <TvHorizontalList
                data={switchableProfiles}
                estimatedItemExtent={264}
                edgeShadows={false}
                initialScrollIndex={activeProfileIndex > 0 ? activeProfileIndex : undefined}
                itemExtent={264}
                keyExtractor={(profile) => String(profile.id)}
                persistentRenderIndices={activeProfileIndex >= 0 ? [activeProfileIndex] : []}
                renderItem={({ item: profile }: ListRenderItemInfo<Profile>) => {
                  const rowFocused = focusedProfile === profile.id;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={profile.pin_locked ? `${profile.name}. ${t("profileLocked")}` : profile.name}
                      disabled={profile.pin_locked || busy}
                      hasTVPreferredFocus={profile.active}
                      onBlur={() => setFocusedProfile((id) => id === profile.id ? null : id)}
                      onFocus={() => setFocusedProfile(profile.id)}
                      onPress={() => choose(profile)}
                      style={({ pressed }) => [
                        styles.profileCard,
                        profile.active && styles.profileCardActive,
                        rowFocused && styles.profileCardFocused,
                        profile.pin_locked && styles.profileCardDisabled,
                        pressed && styles.pressed,
                      ]}
                    >
                      <ProfileAvatar api={api} profile={profile} size={112} />
                      <Text numberOfLines={2} style={[styles.profileName, rowFocused && styles.profileNameFocused]}>{profile.name}</Text>
                      {(profile.active || profile.pin_locked) && (
                        <Text numberOfLines={1} style={[styles.profileMeta, rowFocused && styles.profileMetaFocused]}>
                          {profile.active ? t("currentProfile") : t("profileLocked")}
                        </Text>
                      )}
                      {profile.has_pin && <Text style={[styles.pinBadge, rowFocused && styles.pinBadgeFocused]}>PIN</Text>}
                    </Pressable>
                  );
                }}
                style={styles.profileList}
                contentContainerStyle={styles.profileListContent}
                wrapperStyle={styles.profileListWrap}
              />
              {error && <Text style={styles.error}>{t("actionFailed")}</Text>}
              <TvButton ref={setPickerBackTarget} label={t("back")} variant="ghost" onPress={() => { setError(false); setView("menu"); }} />
            </View>
          )}
        </TVFocusGuideView>
      )}

      {pinFor && (
        <TVFocusGuideView autoFocus trapFocusDown trapFocusLeft trapFocusRight trapFocusUp style={styles.overlay}>
          <View style={styles.pinCard}>
            <View style={styles.pinHeading}>
              <ProfileAvatar api={api} profile={pinFor} size={76} />
              <View style={styles.pinCopy}>
                <Text style={styles.pinEyebrow}>{t("switchProfile")}</Text>
                <Text numberOfLines={1} style={styles.pinTitle}>{pinFor.name}</Text>
              </View>
            </View>
            {needsChildLock && (
              <PinField
                label={t("enterChildLockPin")}
                preferredFocus
                focused={focusedPin === "child"}
                onBlur={() => setFocusedPin(null)}
                onFocus={() => setFocusedPin("child")}
                onSubmit={() => { if (pinComplete) void performSwitch(); }}
                onValue={(value) => { setChildLockPin(value); setError(false); }}
                value={childLockPin}
              />
            )}
            {pinFor.has_pin && (
              <PinField
                label={t("enterProfilePin")}
                preferredFocus={!needsChildLock}
                focused={focusedPin === "profile"}
                onBlur={() => setFocusedPin(null)}
                onFocus={() => setFocusedPin("profile")}
                onSubmit={() => { if (pinComplete) void performSwitch(); }}
                onValue={(value) => { setProfilePin(value); setError(false); }}
                value={profilePin}
              />
            )}
            {error && <Text style={styles.error}>{t("invalidPin")}</Text>}
            <View style={styles.pinActions}>
              <TvButton label={t("back")} variant="ghost" disabled={busy} onPress={returnToProfiles} />
              <TvButton label={busy ? t("switchingProfile") : t("switchProfile")} variant="primary" disabled={!pinComplete || busy} onPress={() => void performSwitch()} />
            </View>
          </View>
        </TVFocusGuideView>
      )}
    </View>
  );
}

function ProfileAvatar({ api, profile, size }: { api: YtZeroApi; profile: Profile; size: number }) {
  const initial = (profile.name.trim()[0] ?? "?").toLocaleUpperCase();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: profile.avatar ? colors.surfaceRaised : profile.avatar_color }]}>
      {profile.avatar ? (
        <Image source={api.avatarSource(profile.avatar)} style={{ width: size, height: size, borderRadius: size / 2 }} resizeMode="cover" />
      ) : (
        <Text style={[styles.avatarInitial, { fontSize: Math.round(size * 0.42) }]}>{initial}</Text>
      )}
    </View>
  );
}

function PinField({ focused, label, onBlur, onFocus, onSubmit, onValue, preferredFocus, value }: {
  focused: boolean;
  label: string;
  onBlur: () => void;
  onFocus: () => void;
  onSubmit: () => void;
  onValue: (value: string) => void;
  preferredFocus: boolean;
  value: string;
}) {
  return (
    <View style={styles.pinField}>
      <Text style={styles.pinLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCorrect={false}
        hasTVPreferredFocus={preferredFocus}
        keyboardType="number-pad"
        maxLength={6}
        onBlur={onBlur}
        onChangeText={(next) => onValue(next.replace(/\D/g, "").slice(0, 6))}
        onFocus={onFocus}
        onSubmitEditing={onSubmit}
        placeholder="••••••"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        style={[styles.pinInput, focused && styles.pinInputFocused]}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", zIndex: 90, top: 0, right: 0, bottom: 0, left: 0 },
  triggerWrap: { position: "absolute", top: 26, right: 52, padding: 12, overflow: "visible" },
  trigger: { minWidth: 150, maxWidth: 330, height: 64, paddingHorizontal: 9, paddingRight: 18, borderRadius: 32, backgroundColor: "transparent", flexDirection: "row", alignItems: "center", gap: 12, opacity: 0.82 },
  triggerFocused: { backgroundColor: colors.white, opacity: 1, transform: [{ scale: 1.055 }], shadowColor: colors.black, shadowOpacity: 0.62, shadowRadius: 22, shadowOffset: { width: 0, height: 11 } },
  triggerName: { flexShrink: 1, color: colors.text, fontSize: 20, fontWeight: "700" },
  triggerNameFocused: { color: colors.black },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  avatar: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarInitial: { color: colors.white, fontWeight: "800" },
  incognitoDot: { position: "absolute", right: -1, bottom: -1, width: 15, height: 15, borderRadius: 8, backgroundColor: colors.success },
  heroIncognitoDot: { position: "absolute", right: 3, bottom: 3, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.success },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 100, backgroundColor: "rgba(5,5,6,0.985)", alignItems: "center", justifyContent: "center", paddingHorizontal: 72, paddingVertical: 46 },
  menuPanel: { width: 790, alignItems: "center" },
  hero: { alignItems: "center", marginBottom: 34 },
  heroName: { maxWidth: 680, color: colors.text, fontSize: 42, lineHeight: 50, fontWeight: "800", letterSpacing: -1.1, marginTop: 18 },
  heroMeta: { color: colors.textMuted, fontSize: 18, lineHeight: 24, fontWeight: "600", marginTop: 5 },
  heroMetaIncognito: { color: colors.success },
  menuActions: { width: "100%", gap: 18, padding: 18, marginBottom: 4 },
  menuAction: { width: "100%", minHeight: 112, borderRadius: 28 },
  pickerPanel: { width: "100%", alignItems: "center" },
  pickerTitle: { color: colors.text, fontSize: 48, lineHeight: 56, fontWeight: "800", letterSpacing: -1.4, marginBottom: 22 },
  profileListWrap: { overflow: "visible" },
  profileList: { width: "100%", flexGrow: 0, overflow: "visible" },
  profileListContent: { minWidth: "100%", flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 100, paddingVertical: 30 },
  profileCard: { width: 236, minHeight: 270, marginHorizontal: 14, borderRadius: 30, paddingHorizontal: 22, paddingVertical: 24, alignItems: "center", justifyContent: "center", backgroundColor: "transparent" },
  profileCardActive: { backgroundColor: colors.surface },
  profileCardFocused: { backgroundColor: colors.white, transform: [{ scale: 1.055 }], shadowColor: colors.black, shadowOpacity: 0.65, shadowRadius: 26, shadowOffset: { width: 0, height: 14 } },
  profileCardDisabled: { opacity: 0.42 },
  profileName: { color: colors.text, fontSize: 24, lineHeight: 29, fontWeight: "700", textAlign: "center", marginTop: 17 },
  profileNameFocused: { color: colors.black },
  profileMeta: { color: colors.textMuted, fontSize: 15, lineHeight: 20, marginTop: 5 },
  profileMetaFocused: { color: "rgba(0,0,0,0.62)" },
  pinBadge: { color: colors.textMuted, fontSize: 12, fontWeight: "800", letterSpacing: 0.8, marginTop: 7 },
  pinBadgeFocused: { color: "rgba(0,0,0,0.62)" },
  pinCard: { width: 640, padding: 34, borderRadius: 34, backgroundColor: colors.surface, gap: 20 },
  pinHeading: { flexDirection: "row", alignItems: "center", gap: 20, marginBottom: 4 },
  pinCopy: { flex: 1 },
  pinEyebrow: { color: colors.textMuted, fontSize: 16, lineHeight: 21, fontWeight: "700" },
  pinTitle: { color: colors.text, fontSize: 32, lineHeight: 39, fontWeight: "800", marginTop: 3 },
  pinField: { gap: 9 },
  pinLabel: { color: colors.textMuted, fontSize: 17, fontWeight: "600" },
  pinInput: { height: 68, borderRadius: 17, paddingHorizontal: 20, backgroundColor: colors.surfaceSelected, color: colors.text, fontSize: 28, fontWeight: "800", letterSpacing: 10, textAlign: "center" },
  pinInputFocused: { backgroundColor: colors.white, color: colors.black, transform: [{ scale: 1.025 }] },
  error: { color: colors.danger, fontSize: 17, fontWeight: "700", marginBottom: 8 },
  pinActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 12, marginTop: 4 },
});
