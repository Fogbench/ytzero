import { useEffect, useRef } from "react";
import { Platform, useTVEventHandler, type FocusDestination } from "react-native";

type FocusTarget = { requestTVFocus?: () => void };

export function useVerticalFocusRedirect(active: boolean, up?: FocusDestination, down?: FocusDestination) {
  const frame = useRef<number | null>(null);

  useTVEventHandler((event) => {
    if (Platform.OS !== "ios" || !active || (event.eventType !== "up" && event.eventType !== "down")) return;
    const destination = (event.eventType === "up" ? up : down) as FocusTarget | null | undefined;
    if (!destination?.requestTVFocus) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      destination.requestTVFocus?.();
    });
  });

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);
}
