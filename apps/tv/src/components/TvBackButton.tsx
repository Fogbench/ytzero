import { forwardRef, type ComponentProps } from "react";
import type { View } from "react-native";
import type { Translate } from "../i18n";
import { TvButton } from "./TvButton";

export const TvBackButton = forwardRef<View, Omit<ComponentProps<typeof TvButton>, "label" | "icon"> & { t: Translate }>(function TvBackButton({ t, style, ...props }, ref) {
  return <TvButton {...props} ref={ref} deferPress label="" icon="left" accessibilityLabel={t("back")} style={[style, { width: 66, paddingHorizontal: 0, alignSelf: "flex-start" }]} />;
});
