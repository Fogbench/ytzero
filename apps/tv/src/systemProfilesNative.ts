export const systemProfilesNative = {
  available: false,
  canRemember: async () => false,
  readPreference: async (): Promise<string | null> => null,
  writePreference: async (_value: string | null): Promise<void> => {},
};
