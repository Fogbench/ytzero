import { AccessibilityInfo } from "react-native";

export const getIncreasedContrast = () => AccessibilityInfo.isHighTextContrastEnabled();
export const observeIncreasedContrast = (changed: (value: boolean) => void) =>
  AccessibilityInfo.addEventListener("highTextContrastChanged", changed);
