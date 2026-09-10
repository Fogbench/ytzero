import { useEffect, useMemo, useRef } from "react";
import { createVideoPress } from "./videoPress";

export function useVideoPress(onPress: () => void, onLongPress?: () => void) {
  const callbacks = useRef({ onPress, onLongPress });
  callbacks.current = { onPress, onLongPress };
  const interaction = useMemo(() => createVideoPress(
    () => callbacks.current.onPress(),
    () => callbacks.current.onLongPress?.(),
    (run) => { const frame = requestAnimationFrame(run); return () => cancelAnimationFrame(frame); },
  ), []);
  useEffect(() => interaction.cancel, [interaction]);
  return {
    cancel: interaction.cancel,
    handlers: {
      onPressIn: interaction.pressIn,
      onPressOut: interaction.pressOut,
      onPress: interaction.press,
      onLongPress: onLongPress ? interaction.longPress : undefined,
    },
  };
}
