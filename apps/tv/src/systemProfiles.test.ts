import { describe, expect, test } from "bun:test";
import { UI_LANGUAGES } from "../../../shared/uiLanguages";
import { systemProfileMessages } from "./systemProfileMessages";
import { loadSystemProfilesEnabled, parseProfilePreference, profilePreference, resolveSystemProfile, saveSystemProfilesEnabled, SYSTEM_PROFILES_KEY, type ProfileState } from "./systemProfiles";
import type { Profile } from "./types";

const alice: Profile = { id: 1, uuid: "alice-uuid", name: "Alice", avatar: "", avatar_color: "#ffffff", has_pin: false, active: true, is_child: false, pin_locked: false, can_switch: true };
const bob: Profile = { ...alice, id: 2, uuid: "bob-uuid", name: "Bob", active: false };
const state: ProfileState = { active: alice, profiles: [alice, bob], canSwitch: true, childLockEnabled: false };
const preference = parseProfilePreference(profilePreference("connection-a", bob), "connection-a");

describe("Apple TV profile selection", () => {
  test("restores the linked UUID, even after a server-side numeric ID change or rename", () => {
    const renamed = { ...bob, id: 45, name: "Robert" };
    expect(resolveSystemProfile(true, true, preference, { ...state, profiles: [alice, renamed] })).toEqual({ kind: "switch", profile: renamed });
    expect(resolveSystemProfile(true, true, preference, { ...state, active: bob })).toEqual({ kind: "ready" });
  });
  test("first-time and removed/recreated profiles require a choice instead of exposing the previous user's feed", () => {
    expect(resolveSystemProfile(true, true, null, state)).toEqual({ kind: "choose" });
    expect(resolveSystemProfile(true, true, preference, { ...state, profiles: [alice, { ...bob, uuid: "replacement-uuid" }] })).toEqual({ kind: "choose" });
  });
  test("PINs, child lock, locked profiles, and session permissions prevent automatic switch attempts", () => {
    for (const changes of [{ has_pin: true }, { pin_locked: true }, { can_switch: false }]) {
      expect(resolveSystemProfile(true, true, preference, { ...state, profiles: [alice, { ...bob, ...changes }] })).toEqual({ kind: "choose", preferredProfileId: bob.id });
    }
    expect(resolveSystemProfile(true, true, preference, { ...state, canSwitch: false })).toEqual({ kind: "choose", preferredProfileId: bob.id });
    expect(resolveSystemProfile(true, true, preference, { ...state, active: { ...alice, is_child: true }, childLockEnabled: true })).toEqual({ kind: "choose", preferredProfileId: bob.id });
    expect(resolveSystemProfile(true, true, preference, { ...state, active: { ...bob, pin_locked: true }, profiles: [{ ...bob, pin_locked: true }] }).kind).toBe("choose");
    expect(resolveSystemProfile(true, true, preference, { ...state, active: { ...bob, has_pin: true }, profiles: [{ ...bob, has_pin: true }] }).kind).toBe("choose");
  });
  test("disabled integration preserves manual selection; unavailable system identity requires a choice when enabled", () => {
    expect(resolveSystemProfile(false, true, preference, state)).toEqual({ kind: "ready" });
    expect(resolveSystemProfile(true, false, preference, state)).toEqual({ kind: "choose" });
  });
  test("local preference round-trip excludes names, tokens, PINs, and other instances", () => {
    const serialized = profilePreference("connection-a", bob);
    expect(JSON.parse(serialized)).toEqual({ version: 1, connectionId: "connection-a", profileUuid: "bob-uuid" });
    expect(parseProfilePreference(serialized, "connection-b")).toBeNull();
    for (const invalid of [null, "bad", "{}", '{"version":2,"connectionId":"connection-a","profileUuid":"bob-uuid"}']) {
      expect(parseProfilePreference(invalid, "connection-a")).toBeNull();
    }
    expect(() => profilePreference("", bob)).toThrow();
    expect(() => profilePreference("connection-a", { ...bob, uuid: undefined })).toThrow();
  });
  test("the device toggle defaults off and persists independently of per-user preferences", async () => {
    const values = new Map<string, string>();
    const store = { getItemAsync: async (key: string) => values.get(key) ?? null, setItemAsync: async (key: string, value: string) => { values.set(key, value); }, deleteItemAsync: async (key: string) => { values.delete(key); } };
    expect(await loadSystemProfilesEnabled(store)).toBe(false);
    await saveSystemProfilesEnabled(store, true);
    expect(await loadSystemProfilesEnabled(store)).toBe(true);
    await saveSystemProfilesEnabled(store, false);
    expect(await loadSystemProfilesEnabled(store)).toBe(false);
    expect([...values.keys()]).toEqual([SYSTEM_PROFILES_KEY]);
  });
  test("every supported language has complete profile-linking copy", () => {
    expect(Object.keys(systemProfileMessages).sort()).toEqual(Object.keys(UI_LANGUAGES).sort());
    for (const catalogue of Object.values(systemProfileMessages)) {
      expect(Object.keys(catalogue).sort()).toEqual(Object.keys(systemProfileMessages.en).sort());
      for (const message of Object.values(catalogue)) expect(message.trim().length).toBeGreaterThan(0);
    }
  });
});
