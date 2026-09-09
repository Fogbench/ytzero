import * as SecureStore from "expo-secure-store";

const INSTANCE_URL_KEY = "ytzero.tv.instance-url";
const ACCESS_TOKEN_KEY = "ytzero.tv.access-token";

export type StoredConnection = { instanceUrl: string; accessToken: string | null };

export async function loadConnection(): Promise<StoredConnection> {
  const [instanceUrl, accessToken] = await Promise.all([
    SecureStore.getItemAsync(INSTANCE_URL_KEY),
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
  ]);
  return { instanceUrl: instanceUrl ?? "", accessToken };
}

export async function saveInstanceUrl(instanceUrl: string): Promise<void> {
  await SecureStore.setItemAsync(INSTANCE_URL_KEY, instanceUrl);
}

export async function saveAccessToken(accessToken: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
}

export async function clearAccessToken(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}

export async function clearConnection(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(INSTANCE_URL_KEY),
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
  ]);
}
