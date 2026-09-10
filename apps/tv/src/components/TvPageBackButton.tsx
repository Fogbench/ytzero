import { forwardRef, type ComponentProps } from "react";
import { StyleSheet, type View } from "react-native";
import { TvBackButton } from "./TvBackButton";
import { topBarMetrics } from "../theme";

/** Pinned navigation, aligned with the queue and profile controls. */
export const TvPageBackButton = forwardRef<View, ComponentProps<typeof TvBackButton>>(function TvPageBackButton({ style, ...props }, ref) {
  return <TvBackButton {...props} ref={ref} style={[styles.back, style]} />;
});
const styles = StyleSheet.create({ back: { position: "absolute", top: topBarMetrics.top, left: topBarMetrics.leading, zIndex: 92 } });
