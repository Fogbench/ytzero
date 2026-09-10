import { describe, expect, test } from "bun:test";
import { connectionStorage, PERSONAL_CONNECTION_KEY, SHARED_CONNECTION_KEY } from "./connectionStorage";

function keyStore() {
  const values = new Map<string, string>();
  return { values, getItemAsync: async (key: string) => values.get(key) ?? null, setItemAsync: async (key: string, value: string) => { values.set(key, value); }, deleteItemAsync: async (key: string) => { values.delete(key); } };
}
function setup() {
  const shared = keyStore(), localA = keyStore(), localB = keyStore();
  let nextId = 0;
  const createId = () => `connection-${++nextId}`;
  return { shared, localA, localB, a: connectionStorage(localA, shared, createId), b: connectionStorage(localB, shared, createId) };
}
const url = "https://ytzero.example";

describe("tvOS connection isolation", () => {
  test("account pairing is shared once, while personal tokens never leave their user's Keychain", async () => {
    const { a, b, shared, localA } = setup();
    await a.save(url, "household-session", "account");
    expect((await b.load()).accessToken).toBe("household-session");
    expect(localA.values.has(PERSONAL_CONNECTION_KEY)).toBe(false);
    await a.save(url, "alice-private-session", "profile");
    expect((await a.load()).accessToken).toBe("alice-private-session");
    expect(await b.load()).toMatchObject({ instanceUrl: url, accessToken: null });
    expect(JSON.stringify([...shared.values])).not.toContain("alice-private-session");
    await b.save(url, "bob-private-session", "profile");
    expect((await a.load()).accessToken).toBe("alice-private-session");
    expect((await b.load()).accessToken).toBe("bob-private-session");
  });
  test("legacy token migration requires scope verification, then removes the old keys", async () => {
    const { a, b, shared, localA } = setup();
    localA.values.set("ytzero.tv.instance-url", url);
    localA.values.set("ytzero.tv.access-token", "legacy-session");
    expect(await a.load()).toEqual({ instanceUrl: url, accessToken: "legacy-session", connectionId: "" });
    expect((await b.load()).accessToken).toBeNull();
    expect(shared.values.size).toBe(0);
    await a.save(url, "legacy-session");
    expect(JSON.stringify([...shared.values])).not.toContain("legacy-session");
    expect(localA.values.has("ytzero.tv.access-token")).toBe(false);
    expect(localA.values.has("ytzero.tv.instance-url")).toBe(false);
  });
  test("instance changes invalidate preferences and cannot reuse another instance's personal token", async () => {
    const { a, b } = setup();
    const firstId = await a.save(url, "private", "profile");
    await b.save("https://another.example", "other-account", "account");
    expect(await a.load()).toMatchObject({ instanceUrl: "https://another.example", accessToken: "other-account" });
    const thirdId = await b.save(url, "new-account", "account");
    expect(thirdId).not.toBe(firstId);
    expect((await a.load()).accessToken).toBe("new-account");
  });
  test("legacy device-wide data is marked for scope validation and removed after migration", async () => {
    const shared = keyStore(), local = keyStore(), legacy = keyStore();
    legacy.values.set("ytzero.tv.instance-url", url);
    legacy.values.set("ytzero.tv.access-token", "unverified-legacy");
    const storage = connectionStorage(local, shared, () => "new-context", legacy);
    expect(await storage.load()).toEqual({ instanceUrl: url, accessToken: "unverified-legacy", connectionId: "", legacyShared: true });
    expect(shared.values.size).toBe(0);
    await storage.save(url, "verified-account", "account");
    expect(legacy.values.size).toBe(0);
    expect(await storage.load()).toEqual({ instanceUrl: url, accessToken: "verified-account", connectionId: "new-context" });
  });
  test("personal sign-out preserves other users, shared account sign-out removes the household token", async () => {
    const { a, b } = setup();
    await a.save(url, "alice", "profile");
    await b.save(url, "bob", "profile");
    await a.clearToken();
    expect((await a.load()).accessToken).toBeNull();
    expect((await b.load()).accessToken).toBe("bob");
    await b.save(url, "household", "account");
    await b.clearToken();
    expect((await a.load()).accessToken).toBeNull();
    expect((await b.load()).accessToken).toBeNull();
  });
  test("corrupt or older state is not treated as authorization and failed saves propagate", async () => {
    const { a, shared } = setup();
    shared.values.set(SHARED_CONNECTION_KEY, '{"version":2,"id":"old","instanceUrl":"https://ytzero.example","accessToken":"invalid"}');
    expect((await a.load()).accessToken).toBeNull();
    const failed = connectionStorage(keyStore(), { ...keyStore(), setItemAsync: async () => { throw new Error("locked keychain"); } }, () => "new");
    await expect(failed.save(url, "token", "account")).rejects.toThrow("locked keychain");
  });
});
