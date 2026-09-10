/** Device-only preferences; never sent to the instance or included in its backups. */
export const OPEN_DETAILS_KEY = "ytzero.tv.open-details";
type Store = { getItemAsync(key: string): Promise<string | null>; setItemAsync(key: string, value: string): Promise<void> };
export const loadOpenDetails = async (store: Store, legacy?: Store): Promise<boolean> => {
  let value = await store.getItemAsync(OPEN_DETAILS_KEY);
  if (value === null && legacy) {
    value = await legacy.getItemAsync(OPEN_DETAILS_KEY);
    if (value === "true" || value === "false") await store.setItemAsync(OPEN_DETAILS_KEY, value);
  }
  return value === "true";
};
export const saveOpenDetails = (store: Store, value: boolean): Promise<void> => store.setItemAsync(OPEN_DETAILS_KEY, String(value));
export const shouldPlayVideo = (openDetails: boolean, explicit?: boolean): boolean => explicit ?? !openDetails;
