import { restoreFocus } from "./focusRestoration";

export function isFocusInteraction(event: { eventType: string; eventKeyAction?: number }) {
  if (["select", "longSelect", "menu"].includes(event.eventType)) return true;
  return event.eventKeyAction !== 1 && [
    "up", "down", "left", "right", "longUp", "longDown", "longLeft", "longRight",
    "swipeUp", "swipeDown", "swipeLeft", "swipeRight", "pan",
  ].includes(event.eventType);
}

/** Initial focus yields permanently to the user's next navigation gesture. */
export function focusOnEntry<T>(
  target: T,
  focus: (target: T, stillActive: () => boolean) => Promise<boolean>,
  onSettled: () => void,
  onInteraction: (stop: () => void) => () => void,
  schedule?: (run: () => void) => () => void,
) {
  let active = true;
  let unsubscribe = () => {};
  const cancelRetry = restoreFocus(() => target, async (view) => {
    const focused = await focus(view, () => active);
    if (focused) settle();
    return focused;
  }, undefined, schedule);
  function cancel() {
    if (!active) return;
    active = false;
    cancelRetry();
    unsubscribe();
  }
  function settle() {
    if (!active) return;
    cancel();
    onSettled();
  }
  unsubscribe = onInteraction(settle);
  return cancel;
}
