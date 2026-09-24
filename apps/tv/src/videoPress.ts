/** Present actions when the hold threshold is reached, consuming the gesture
 * so releasing Select cannot also start playback. */
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
    longPress: () => {
      if (!pressing || long) return;
      long = true;
      const request = generation;
      cancelPending = schedule(() => {
        if (request !== generation) return;
        cancelPending = undefined;
        menu();
      });
    },
    pressOut: () => { pressing = false; },
    press: () => { if (!long && !cancelled) play(); },
    cancel,
  };
}
