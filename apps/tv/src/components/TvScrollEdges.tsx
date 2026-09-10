import { View, type ViewProps } from "react-native";

// Other platforms use their own scroll rendering, without painted edge shadows.
export function TvScrollEdges({ enabled: _enabled, ...props }: ViewProps & { enabled?: boolean }) {
  return <View {...props} />;
}
