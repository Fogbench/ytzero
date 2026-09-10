import { Platform } from "react-native";
import { NativeModule, requireOptionalNativeModule } from "expo";

declare class SystemProfiles extends NativeModule {
  canRemember(): Promise<boolean>;
  readPreference(): Promise<string | null>;
  writePreference(value: string | null): Promise<void>;
}
const native = Platform.isTV ? requireOptionalNativeModule<SystemProfiles>("YtZeroSystemProfiles") : null;
export const systemProfilesNative = {
  available: native !== null,
  canRemember: () => native?.canRemember() ?? Promise.resolve(false),
  readPreference: () => native?.readPreference() ?? Promise.resolve(null),
  writePreference: (value: string | null) => native?.writePreference(value) ?? Promise.resolve(),
};
