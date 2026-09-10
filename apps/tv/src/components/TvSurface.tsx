import { createContext, useContext, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useIncreasedContrast, useReducedTransparency } from "../motion";
import { colors } from "../theme";
import { TvGlassSurface } from "./TvGlassSurface";

const Surface = createContext<"content" | "glass">("content");

/** A native modal is a new visual plane even though React preserves context. */
export function TvSurfaceRoot({ children }: { children: ReactNode }) {
  return <Surface.Provider value="content">{children}</Surface.Provider>;
}

/** Paints the owning view without adding a layout/focus container. Descendant
 * controls use thin fills, so a glass panel can never contain more glass. */
export function TvSurface({ children, radius = 36, material = "glass" }: {
  children: ReactNode; radius?: number; material?: "glass" | "content";
}) {
  const parent = useContext(Surface);
  const glass = material === "glass" && parent !== "glass";
  return <>
    {glass ? <TvGlassSurface radius={radius} /> : <View pointerEvents="none" accessible={false}
      style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: colors.surface }]} />}
    <Surface.Provider value={glass || parent === "glass" ? "glass" : "content"}>{children}</Surface.Provider>
  </>;
}

/** Floating navigation uses glass; content rows lift on focus. Descendants of
 * a glass panel share its material and only add a quiet interaction fill. */
export function TvControlSurface({ radius = 33, focused = false, filled = true, emphasized = false, floating = false }: {
  radius?: number; focused?: boolean; filled?: boolean; emphasized?: boolean; floating?: boolean;
}) {
  const parent = useContext(Surface);
  const contrast = useIncreasedContrast();
  const opaque = useReducedTransparency();
  const glass = (focused || floating) && parent === "content" && !contrast && !opaque;
  const backgroundColor = focused
    ? contrast || opaque ? colors.focusStrong : colors.focusFill
    : !filled ? "transparent"
    : glass ? "transparent"
    : contrast ? colors.surface
    : parent === "glass" && !contrast && !opaque ? colors.controlFill
    : emphasized ? colors.surfaceSelected : colors.surfaceRaised;
  return <>
    {glass ? <TvGlassSurface radius={radius} /> : null}
    <View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor }]} />
  </>;
}
