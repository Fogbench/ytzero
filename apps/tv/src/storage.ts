import * as SecureStore from "expo-secure-store";
import { deviceStore, legacyDeviceStore } from "./deviceStore";
import { connectionStorage } from "./connectionStorage";
import { systemProfilesNative } from "./systemProfilesNative";
export type { StoredConnection } from "./connectionStorage";

// An installation-local preference namespace, never an authentication secret.
const storage = connectionStorage(SecureStore, deviceStore, () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, systemProfilesNative.available ? legacyDeviceStore : undefined);
export const loadConnection = storage.load;
export const saveConnection = storage.save;
export const clearAccessToken = storage.clearToken;
