import { normalizeInstanceUrl } from "./instanceUrl";

export type KeyStore = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};
export const SHARED_CONNECTION_KEY = "ytzero.tv.connection.v1";
export const PERSONAL_CONNECTION_KEY = "ytzero.tv.personal-connection.v1";
const LEGACY_URL = "ytzero.tv.instance-url";
const LEGACY_TOKEN = "ytzero.tv.access-token";
type Connection = { version: 1; id: string; instanceUrl: string; accessToken: string | null };
export type StoredConnection = { instanceUrl: string; accessToken: string | null; connectionId: string; legacyShared?: boolean };

function parse(value: string | null): Connection | null {
  try {
    const record = JSON.parse(value ?? "null");
    if (record?.version !== 1 || typeof record.id !== "string" || !record.id
      || typeof record.instanceUrl !== "string" || normalizeInstanceUrl(record.instanceUrl) !== record.instanceUrl
      || !(record.accessToken === null || typeof record.accessToken === "string")) return null;
    return record;
  } catch { return null; }
}

/** Only account-scoped pairing is shared. Profile-scoped credentials stay in
 * the current tvOS user's SecureStore; preference IDs confer no authority. */
export function connectionStorage(local: KeyStore, shared: KeyStore, newId: () => string, legacyShared?: KeyStore) {
  const readShared = async () => parse(await shared.getItemAsync(SHARED_CONNECTION_KEY));
  const forgetLegacy = async () => {
    await local.deleteItemAsync(LEGACY_TOKEN);
    await local.deleteItemAsync(LEGACY_URL);
    // A distinct migration store is supplied only on tvOS. It uses the old
    // device-wide service, never the modern shared or current user's service.
    if (legacyShared) {
      for (const key of [LEGACY_TOKEN, LEGACY_URL, SHARED_CONNECTION_KEY, PERSONAL_CONNECTION_KEY]) await legacyShared.deleteItemAsync(key);
    }
  };
  const load = async (): Promise<StoredConnection> => {
    const connection = await readShared();
    if (connection) {
      const personal = parse(await local.getItemAsync(PERSONAL_CONNECTION_KEY));
      return {
        instanceUrl: connection.instanceUrl, connectionId: connection.id,
        accessToken: personal?.id === connection.id && personal.instanceUrl === connection.instanceUrl
          ? personal.accessToken : connection.accessToken,
      };
    }
    // Scope is unknown until auth/status: never share a migrated legacy token.
    const instanceUrl = await local.getItemAsync(LEGACY_URL);
    const accessToken = await local.getItemAsync(LEGACY_TOKEN);
    if (!instanceUrl && legacyShared) {
      // Includes development builds that migrated before acquiring the native
      // entitlement. Only auth/status may be called with this unknown token.
      const previous = parse(await legacyShared.getItemAsync(SHARED_CONNECTION_KEY));
      const previousPersonal = parse(await legacyShared.getItemAsync(PERSONAL_CONNECTION_KEY));
      const oldUrl = previous?.instanceUrl ?? await legacyShared.getItemAsync(LEGACY_URL);
      const oldToken = previous
        ? previousPersonal?.id === previous.id ? previousPersonal.accessToken : previous.accessToken
        : await legacyShared.getItemAsync(LEGACY_TOKEN);
      if (oldUrl) return { instanceUrl: normalizeInstanceUrl(oldUrl), accessToken: oldToken, connectionId: "", legacyShared: true };
    }
    return { instanceUrl: instanceUrl ? normalizeInstanceUrl(instanceUrl) : "", accessToken, connectionId: "" };
  };
  const save = async (instanceUrl: string, accessToken: string | null, scope: "account" | "profile" = "profile"): Promise<string> => {
    instanceUrl = normalizeInstanceUrl(instanceUrl);
    const previous = await readShared();
    const id = previous?.instanceUrl === instanceUrl ? previous.id : newId();
    const connection: Connection = { version: 1, id, instanceUrl, accessToken: scope === "account" ? accessToken : null };
    // Personal state first: an interrupted save cannot expose a profile token.
    if (scope === "account") await local.deleteItemAsync(PERSONAL_CONNECTION_KEY);
    else await local.setItemAsync(PERSONAL_CONNECTION_KEY, JSON.stringify({ ...connection, accessToken }));
    await shared.setItemAsync(SHARED_CONNECTION_KEY, JSON.stringify(connection));
    await forgetLegacy();
    return id;
  };
  const clearToken = async () => {
    const connection = await readShared();
    if (connection) {
      await local.setItemAsync(PERSONAL_CONNECTION_KEY, JSON.stringify({ ...connection, accessToken: null }));
      if (connection.accessToken) await shared.setItemAsync(SHARED_CONNECTION_KEY, JSON.stringify({ ...connection, accessToken: null }));
    }
    await forgetLegacy();
  };
  return { load, save, clearToken };
}
