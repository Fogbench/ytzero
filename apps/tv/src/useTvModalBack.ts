import { useEffect, useRef } from "react";
import { BackHandler, TVEventControl } from "react-native";
import { suspendBackgroundFocusRedirects } from "./focus";

/** tvOS delivers Menu through BackHandler even for a React Native Modal. */
export function useTvModalBack(visible: boolean, onClose: () => void, preserveMenuKey: boolean) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!visible) return;
    const restoreRedirects = suspendBackgroundFocusRedirects();
    TVEventControl.enableTVMenuKey();
    const listener = BackHandler.addEventListener("hardwareBackPress", () => { close.current(); return true; });
    return () => {
      listener.remove();
      restoreRedirects();
      if (!preserveMenuKey) TVEventControl.disableTVMenuKey();
    };
  }, [preserveMenuKey, visible]);
}
