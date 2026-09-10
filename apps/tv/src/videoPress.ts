/** Finish the remote gesture before presenting another native focus environment.
 * Opening a modal while Select is held can strand UIKit's select recognizer. */
export function createVideoPress(
  play: () => void,
  menu: () => void,
  schedule: (run: () => void) => () => void,
) {
  let pressing = false;
  let long = false;
  let cancelled = false;
  let cancelPending: (() => void) | undefined;
  let generation = 0;
  const cancel = () => {
    generation++;
    pressing = false;
    cancelled = true;
    cancelPending?.();
    cancelPending = undefined;
  };
  return {
    pressIn: () => { cancel(); pressing = true; long = false; cancelled = false; },
    longPress: () => { if (pressing) long = true; },
    pressOut: () => {
      if (!pressing) return;
      pressing = false;
      if (!long) return;
      const request = generation;
      cancelPending = schedule(() => {
        if (request !== generation) return;
        cancelPending = undefined;
        menu();
      });
    },
    press: () => { if (!long && !cancelled) play(); },
    cancel,
  };
}
