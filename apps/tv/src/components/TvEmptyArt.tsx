// Scene geometry adapted from ui/src/components/illustrations/EmptyArt.tsx.
// Metro isolates the TV workspace, so these paths use react-native-svg directly.
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";
import { colors } from "../theme";
const line = { fill: "none", stroke: colors.textMuted, strokeWidth: 2.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const base = { ...line, fill: colors.surfaceRaised };
export type EmptyArtScene =
  | "inboxZero"
  | "scheduleClear"
  | "offAir"
  | "noDownloads"
  | "archiveEmpty"
  | "nothingLiked"
  | "noHistory"
  | "noShorts"
  | "playlistEmpty"
  | "noSubscriptions"
  | "noDiscovery"
  | "noInsights"
  | "socialEmpty";

/** Badge glyphs, authored around the fixed badge centre (110, 58). */
const GLYPH: Record<EmptyArtScene, string> = {
  inboxZero: "M102 58.5 L107.5 64 L118.5 52",
  scheduleClear: "M110 50.5 V58.5 H116",
  // The centre dot is what stops the two arcs from reading as parentheses.
  offAir: "M104 64 A9 9 0 0 1 104 52 M116 64 A9 9 0 0 1 116 52 M110 58 h0.01",
  noDownloads: "M110 50 V62 M104.5 56.5 L110 62 L115.5 56.5",
  archiveEmpty: "M103 53.5 H117 M105.5 53.5 V64 H114.5 V53.5",
  nothingLiked: "M110 65.5 C110 65.5 101.5 59.5 101.5 55.2 A4.3 4.3 0 0 1 110 53.2 A4.3 4.3 0 0 1 118.5 55.2 C118.5 59.5 110 65.5 110 65.5 Z",
  noHistory: "M102.5 57.5 A7.5 7.5 0 1 0 105 52 M102 47.5 V53.5 H108",
  noShorts: "M106 51.5 L117.5 58 L106 64.5 Z",
  playlistEmpty: "M102 52.5 H118 M102 58 H118 M102 63.5 H111",
  noSubscriptions: "M110 56 a4.2 4.2 0 1 0 0-8.4 a4.2 4.2 0 0 0 0 8.4 M101.5 66.5 a8.5 8.5 0 0 1 17 0",
  noDiscovery: "M110 48.5 L112.9 55.1 L119.5 58 L112.9 60.9 L110 67.5 L107.1 60.9 L100.5 58 L107.1 55.1 Z",
  noInsights: "M103 64.5 V57 M110 64.5 V50 M117 64.5 V60",
  socialEmpty: "M102 51.5 H118 V61 H111 L106 65 V61 H102 Z",
};

function Subject({ scene }: { scene: EmptyArtScene }) {
  switch (scene) {
    case "inboxZero":
      return <>
        <Path {...base} d="M58.5 84.5 L44 111 V125 A9 9 0 0 0 53 134 H167 A9 9 0 0 0 176 125 V111 L161.5 84.5 Z" />
        <Path {...line} d="M44 111 H84 L92 122 H128 L136 111 H176" />
      </>;
    case "scheduleClear":
      return <>
        <Path {...line} d="M84 88 V81 M136 88 V81" />
        <Rect {...base} x="62" y="88" width="96" height="46" rx="10" />
        <Path {...line} d="M62 103 H158" />
        <Circle fill={colors.textMuted} cx="82" cy="118" r="3.4" />
        <Circle fill={colors.textMuted} cx="110" cy="118" r="3.4" />
        <Circle fill={colors.textMuted} cx="138" cy="118" r="3.4" />
      </>;
    case "offAir":
      return <>
        <Rect {...base} x="60" y="84" width="100" height="44" rx="9" />
        <Path {...line} d="M110 128 V134 M96 135 H124" />
      </>;
    case "noDownloads":
      return <>
        <Rect {...base} x="70" y="86" width="80" height="12" rx="6" opacity=".55" />
        <Rect {...base} x="58" y="98" width="104" height="36" rx="9" />
        <Path {...line} d="M74 116 H104" />
        <Circle fill={colors.textMuted} cx="146" cy="116" r="3.6" />
      </>;
    case "archiveEmpty":
      return <>
        <Rect {...base} x="52" y="86" width="116" height="17" rx="5" />
        <Path {...base} d="M60 103 H160 V126 A8 8 0 0 1 152 134 H68 A8 8 0 0 1 60 126 Z" />
        <Path {...line} d="M98 117 H122" />
      </>;
    case "nothingLiked":
      return <>
        <Rect {...base} x="78" y="84" width="72" height="40" rx="8" opacity=".5" transform="rotate(-7 114 104)" />
        <Rect {...base} x="66" y="94" width="88" height="40" rx="9" />
      </>;
    case "noHistory":
      return <>
        <Rect {...base} x="52" y="94" width="116" height="40" rx="10" />
        <Path {...line} d="M68 106 H120" opacity=".5" />
        <Path {...line} d="M68 120 H152" />
        <Circle fill={colors.textMuted} cx="86" cy="120" r="4.5" />
        <Circle fill={colors.textMuted} cx="110" cy="120" r="4.5" />
        <Circle fill={colors.textMuted} cx="134" cy="120" r="4.5" />
      </>;
    case "noShorts":
      return <>
        <Rect {...base} x="58" y="94" width="30" height="40" rx="8" opacity=".5" />
        <Rect {...base} x="132" y="94" width="30" height="40" rx="8" opacity=".5" />
        <Rect {...base} x="95" y="84" width="30" height="50" rx="8" />
      </>;
    case "playlistEmpty":
      return <>
        <Rect {...base} x="56" y="90" width="108" height="44" rx="10" />
        <Rect {...base} x="68" y="100" width="32" height="24" rx="5" opacity=".6" />
        <Path {...line} d="M110 107 H150" />
        <Path {...line} d="M110 118 H136" opacity=".6" />
      </>;
    case "noSubscriptions":
      return <>
        <Circle {...base} cx="68" cy="113" r="15" opacity=".55" />
        <Circle {...base} cx="152" cy="113" r="15" opacity=".55" />
        <Circle {...base} cx="110" cy="110" r="19" />
      </>;
    case "noDiscovery":
      return <>
        <Rect {...base} x="62" y="92" width="96" height="42" rx="10" />
        <Path {...line} d="M102 105 L118 113 L102 121 Z" />
      </>;
    case "noInsights":
      return <>
        <Path {...line} d="M54 132 H166" />
        <Rect {...base} x="72" y="108" width="18" height="24" rx="4" />
        <Rect {...base} x="101" y="94" width="18" height="38" rx="4" />
        <Rect {...base} x="130" y="116" width="18" height="16" rx="4" />
      </>;
    case "socialEmpty":
      return <>
        <Rect {...base} x="52" y="96" width="116" height="38" rx="9" />
        <Rect {...base} x="64" y="105" width="40" height="20" rx="5" opacity=".6" />
        <Path {...line} d="M79 110 L89 115 L79 120 Z" />
        <Path {...line} d="M116 108 H154 M116 119 H141" opacity=".65" />
        <Path {...base} d="M121 83 H163 A7 7 0 0 1 170 90 V103 A7 7 0 0 1 163 110 H145 L136 117 V110 H121 A7 7 0 0 1 114 103 V90 A7 7 0 0 1 121 83 Z" />
        <Path {...line} d="M126 94 H158 M126 101 H149" opacity=".65" />
      </>;
  }
}


export function TvEmptyArt({ scene }: { scene: EmptyArtScene }) {
  return <Svg width={300} height={205} viewBox="0 0 220 150" accessible={false}>
    <Ellipse cx="110" cy="112" rx="88" ry="28" fill={colors.accent} opacity=".055" />
    <G fill="none" stroke={colors.accent} opacity=".3" strokeWidth="2" strokeLinecap="round">
      <Path d="M30 68h12m-6-6v12M182 72h10m-5-5v10" />
      <Rect x="51" y="28" width="36" height="24" rx="6" transform="rotate(-10 69 40)" />
      <Rect x="135" y="25" width="34" height="23" rx="6" transform="rotate(9 152 36)" opacity=".65" />
    </G>
    <Circle cx="110" cy="58" r="18" fill={colors.accent} fillOpacity=".16" stroke={colors.accent} strokeOpacity=".55" strokeWidth="2.4" />
    <Path d={GLYPH[scene]} fill="none" stroke={colors.accent} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    <Subject scene={scene} />
  </Svg>;
}
