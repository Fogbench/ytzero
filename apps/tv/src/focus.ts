import { createContext, useCallback, useContext, useEffect, useRef, useState, type ForwardedRef } from "react";
import { findNodeHandle, Platform, TVEventHandler, useTVEventHandler, type FocusDestination, type View } from "react-native";
import { focusView } from "./playerControl";
import { focusOnEntry, isFocusInteraction } from "./focusEntry";

/** UIKit can focus native modal content that is outside React's root view. */
export async function requestTvFocus(target: View | null | undefined, stillActive: () => boolean = () => true): Promise<boolean> {
  if (!target || !stillActive()) return false;
  if (Platform.OS === "ios" && Platform.isTV) {
    const tag = findNodeHandle(target);
    if (tag === null) return false;
    const handled = await focusView(tag).catch(() => false);
    if (!stillActive()) return false;
    // A failed UIKit attempt means the target is not ready. Do not install a
    // persistent React-root preference that can pull later navigation back.
    return handled;
  }
  target.requestTVFocus();
  return true;
}

/** Retry entry focus until ready, unless the user has already taken control. */
export function focusWhenReady(target: View, onSettled: () => void) {
  return focusOnEntry(target, requestTvFocus, onSettled, (stop) => {
    const subscription = TVEventHandler.addListener((event) => {
      if (isFocusInteraction(event)) stop();
    });
    return () => subscription?.remove();
  });
}

let modalDepth = 0;
/** Modal and AVKit focus belongs to their own native focus environment. */
export function suspendBackgroundFocusRedirects() {
  modalDepth += 1;
  let released = false;
  return () => { if (!released) { released = true; modalDepth -= 1; } };
}

export const TvContentFocusRequests = createContext(true);
export const useContentFocusAllowed = () => useContext(TvContentFocusRequests);

/** Keep chrome out of UIKit's fallback search until the new content owns focus. */
export function useTvShellFocus(context: object, active: boolean) {
  const [settled, setSettled] = useState<object | null>(null);
  const [manualNavigation, setManualNavigation] = useState<object | null>(null);
  const [sidebarRequest, setSidebarRequest] = useState(0);
  const pending = active && settled !== context;
  const onContentFocus = useCallback(() => {
    if (active && modalDepth === 0) setSettled(context);
  }, [active, context]);
  useTVEventHandler((event) => {
    // Loading must not prevent an intentional return to navigation, including
    // when the destination is slow or unavailable.
    if (!pending || modalDepth > 0 || event.eventKeyAction === 1 || event.eventType !== "left") return;
    setSettled(context);
    setManualNavigation(context);
    setSidebarRequest((request) => request + 1);
  });
  return { pending, onContentFocus, sidebarRequest, contentFocusAllowed: active && manualNavigation !== context };
}

let activatedVideoTarget: { current: View | null } | null = null;
// Capture this handle at activation, not a recycled native View or a getter
// for the next card activated inside the details/queue screen.
export const lastActivatedVideoTarget = () => activatedVideoTarget;

/** Remember the actual native card, including its row and horizontal position. */
export function useVideoFocusMemory(forwarded: ForwardedRef<View>) {
  const target = useRef<View | null>(null);
  const ref = useCallback((value: View | null) => {
    target.current = value;
    if (typeof forwarded === "function") forwarded(value);
    else if (forwarded) forwarded.current = value;
  }, [forwarded]);
  return { ref, remember: () => { activatedVideoTarget = target; } };
}
