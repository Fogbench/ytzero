import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { createContext, useContext, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useIncreasedContrast, useReducedTransparency } from "../motion";
import { colors } from "../theme";

const nativeGlass = isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
const MaterialVisible = createContext(true);
export function TvGlassVisibility({ visible, children }: { visible: boolean; children: ReactNode }) {
  const parentVisible = useContext(MaterialVisible);
  return <MaterialVisible.Provider value={visible && parentVisible}>{children}</MaterialVisible.Provider>;
}

/** A material behind controls, never another focus target. */
export function TvGlassSurface({ radius = 30, emphasized = false }: { radius?: number; emphasized?: boolean }) {
  const opaque = useReducedTransparency();
  const contrast = useIncreasedContrast();
  const visible = useContext(MaterialVisible);
  const useFallback = opaque || contrast;
  const fallback = { borderRadius: radius, backgroundColor: contrast ? colors.surface : emphasized ? "#414b60" : "#24262c" };
  // UIKit can lose a glass effect permanently when an ancestor reaches alpha 0.
  // Retain content/focus targets, but recreate their material when shown again.
  if (!visible) return null;
  // Transitions animate position, not this material. Keep the effect active
  // throughout presentation instead of flashing an opaque placeholder first.
  return <View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, { borderRadius: radius }]}>
    {nativeGlass ? <GlassView pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      glassEffectStyle={useFallback ? "none" : "regular"} colorScheme="dark"
      tintColor={emphasized ? "rgba(65,75,96,0.35)" : undefined} /> : null}
    {useFallback || !nativeGlass ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, fallback]} /> : null}
  </View>;
}
