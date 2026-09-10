import { NativeModule, requireNativeModule } from "expo";

declare class Appearance extends NativeModule<{ contrastChanged: (event: { enabled: boolean }) => void }> {
  getIncreasedContrast?(): Promise<boolean>;
}
const appearance = requireNativeModule<Appearance>("YtZeroPlayerControl");
export const getIncreasedContrast = () => appearance.getIncreasedContrast?.() ?? Promise.resolve(false);
export const observeIncreasedContrast = (changed: (value: boolean) => void) => {
  if (!appearance.getIncreasedContrast) return { remove() {} };
  return appearance.addListener("contrastChanged", ({ enabled }) => changed(enabled));
};
