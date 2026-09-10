import { requireNativeViewManager } from "expo-modules-core";
import type { ViewProps } from "react-native";

/** A UIKit focus environment for content presented outside the React root. */
export const TvFocusScope = requireNativeViewManager<ViewProps>("YtZeroPlayerControl", "YtZeroFocusScopeView");
