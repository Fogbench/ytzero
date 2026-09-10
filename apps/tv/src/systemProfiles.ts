import type { KeyStore } from "./connectionStorage";
import type { Profile } from "./types";

export const SYSTEM_PROFILES_KEY = "ytzero.tv.system-profiles-enabled.v1";
export type ProfilePreference = { version: 1; connectionId: string; profileUuid: string };
export type ProfileState = { active: Profile; profiles: Profile[]; canSwitch: boolean; childLockEnabled: boolean };
export function parseProfilePreference(value: string | null, connectionId: string): ProfilePreference | null {
  try {
    const record = JSON.parse(value ?? "null");
    return record?.version === 1 && record.connectionId === connectionId && connectionId
      && typeof record.profileUuid === "string" && record.profileUuid ? record : null;
  } catch { return null; }
}
export function profilePreference(connectionId: string, profile: Profile): string {
  if (!connectionId || !profile.uuid) throw new Error("profile identity unavailable");
  return JSON.stringify({ version: 1, connectionId, profileUuid: profile.uuid } satisfies ProfilePreference);
}
export const loadSystemProfilesEnabled = async (store: KeyStore) => (await store.getItemAsync(SYSTEM_PROFILES_KEY)) === "true";
export const saveSystemProfilesEnabled = (store: KeyStore, enabled: boolean) => store.setItemAsync(SYSTEM_PROFILES_KEY, String(enabled));

export type ProfileResolution = { kind: "ready" } | { kind: "switch"; profile: Profile } | { kind: "choose"; preferredProfileId?: number };
export function resolveSystemProfile(enabled: boolean, canRemember: boolean, preference: ProfilePreference | null, state: ProfileState): ProfileResolution {
  if (!enabled) return { kind: "ready" };
  // If the system stops offering a stable per-user context, require a choice
  // for this session instead of falling back to the last person's feed.
  if (!canRemember) return { kind: "choose" };
  const target = state.profiles.find((profile) => profile.uuid && profile.uuid === preference?.profileUuid);
  if (!target) return { kind: "choose" };
  if (target.id === state.active.id && !target.has_pin && !target.pin_locked) return { kind: "ready" };
  if (!state.canSwitch || !target.can_switch || target.has_pin || target.pin_locked || (state.active.is_child && state.childLockEnabled)) {
    return { kind: "choose", preferredProfileId: target.id };
  }
  return { kind: "switch", profile: target };
}
