import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useIncreasedContrast } from "../motion";
import { colors } from "../theme";

/** Quiet full-screen artwork keeps profile selection separate from the feed. */
export const TvProfileBackdrop = memo(function TvProfileBackdrop({ accent = colors.accentStrong }: { accent?: string }) {
  const contrast = useIncreasedContrast();
  return <View accessible={false} pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}>
    {!contrast ? <Svg width="100%" height="100%">
      <Defs>
        <RadialGradient id="profile-glow" cx="50%" cy="48%" rx="65%" ry="80%">
          <Stop offset="0" stopColor={accent} stopOpacity="0.24" />
          <Stop offset="1" stopColor={colors.background} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="profile-corner" cx="85%" cy="100%" rx="70%" ry="80%">
          <Stop offset="0" stopColor="#46346b" stopOpacity="0.35" />
          <Stop offset="1" stopColor={colors.background} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#profile-glow)" />
      <Rect width="100%" height="100%" fill="url(#profile-corner)" />
    </Svg> : null}
  </View>;
});
