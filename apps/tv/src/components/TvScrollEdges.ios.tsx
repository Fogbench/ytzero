import { requireNativeViewManager } from "expo-modules-core";
import type { ViewProps } from "react-native";

export const TvScrollEdges = requireNativeViewManager<ViewProps & { enabled?: boolean }>("YtZeroPlayerControl", "YtZeroScrollEdgesView");
