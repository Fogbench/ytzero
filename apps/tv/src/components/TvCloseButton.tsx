import { forwardRef, type ComponentProps } from "react";
import type { View } from "react-native";
import type { Translate } from "../i18n";
import { TvButton } from "./TvButton";

export const TvCloseButton = forwardRef<View, Omit<ComponentProps<typeof TvButton>, "label" | "icon"> & { t: Translate }>(function TvCloseButton({ t, style, ...props }, ref) {
  return <TvButton {...props} ref={ref} deferPress label="" icon="remove" accessibilityLabel={t("close")} style={[style, { width: 66, paddingHorizontal: 0, alignSelf: "flex-start" }]} />;
});
