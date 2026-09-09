import Svg, { Circle, Path } from "react-native-svg";
import type { TvNavigationIcon } from "../navigation";

type Props = {
  color: string;
  name: TvNavigationIcon | "more";
  size?: number;
};

export function SidebarIcon({ color, name, size = 29 }: Props) {
  if (name === "home") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="m3 10.8 9-7.5 9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }
  if (name === "settings") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M4 7h5M15 7h5M4 17h9M19 17h1" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <Circle cx="12" cy="7" r="3" stroke={color} strokeWidth="1.8" />
        <Circle cx="16" cy="17" r="3" stroke={color} strokeWidth="1.8" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m6 9 6 6 6-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

