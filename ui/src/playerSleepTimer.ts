import { useCallback, useEffect, useRef, useState } from "react";

// The deadline lives outside React so the timer keeps running when autoplay
// moves to the next video and the player component is created again.
let deadline: number | null = null;
// "End of video": no clock, just a flag that the watch page checks when the
// video ends. It is cleared the moment it is used.
let stopAtEnd = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Called when a video ends. True (once) when the timer was set to "End of video". */
export function consumeStopAtEnd(): boolean {
  if (!stopAtEnd) return false;
  stopAtEnd = false;
  notify();
  return true;
}

export const SLEEP_TIMER_MINUTES = [5, 10, 15, 30, 45, 60] as const;

/** Minutes left on the timer (rounded up), or null when it is off. */
export function sleepMinutesLeft(now = Date.now()): number | null {
  return deadline === null ? null : Math.max(1, Math.ceil((deadline - now) / 60_000));
}

/** Calls `onFire` once when the sleep timer runs out. `set(null)` turns it off. */
export function useSleepTimer(onFire: () => void) {
  const [version, setVersion] = useState(0);
  // Re-render when the flag changes outside this hook (the video ended).
  useEffect(() => {
    const refresh = () => setVersion((current) => current + 1);
    listeners.add(refresh);
    return () => { listeners.delete(refresh); };
  }, []);
  const onFireRef = useRef(onFire);
  onFireRef.current = onFire;

  useEffect(() => {
    if (deadline === null) return;
    const fire = () => {
      deadline = null;
      setVersion((current) => current + 1);
      onFireRef.current();
    };
    const wait = deadline - Date.now();
    if (wait <= 0) { fire(); return; }
    const timer = window.setTimeout(fire, wait);
    return () => window.clearTimeout(timer);
  }, [version]);

  /** A number of minutes, "end" for the end of the video, or null for off. */
  const set = useCallback((value: number | "end" | null) => {
    stopAtEnd = value === "end";
    deadline = typeof value === "number" ? Date.now() + value * 60_000 : null;
    setVersion((current) => current + 1);
  }, []);

  return { minutesLeft: sleepMinutesLeft(), atEnd: stopAtEnd, set };
}
