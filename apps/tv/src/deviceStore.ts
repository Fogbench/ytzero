import * as SecureStore from "expo-secure-store";
import { systemProfilesNative } from "./systemProfilesNative";

// The tracked expo-secure-store patch adds this tvOS-only query option.
// Availability also protects development clients built before the native module.
type TvSecureStoreOptions = SecureStore.SecureStoreOptions & { useUserIndependentKeychain?: boolean };
const options: TvSecureStoreOptions = systemProfilesNative.available ? { useUserIndependentKeychain: true, keychainService: "ytzero.tv.shared" } : {};
export const deviceStore = {
  getItemAsync: (key: string) => SecureStore.getItemAsync(key, options),
  setItemAsync: (key: string, value: string) => SecureStore.setItemAsync(key, value, options),
  deleteItemAsync: (key: string) => SecureStore.deleteItemAsync(key, options),
};

// Before Runs as Current User, the app's default Keychain was device-wide.
// Read it only for migration; unknown-scope tokens still need server validation.
const legacyOptions: TvSecureStoreOptions = systemProfilesNative.available ? { useUserIndependentKeychain: true } : {};
export const legacyDeviceStore = {
  getItemAsync: (key: string) => SecureStore.getItemAsync(key, legacyOptions),
  setItemAsync: (key: string, value: string) => SecureStore.setItemAsync(key, value, legacyOptions),
  deleteItemAsync: (key: string) => SecureStore.deleteItemAsync(key, legacyOptions),
};
