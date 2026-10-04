import { useCallback, useEffect, useRef, useState } from "react";

// The deadline lives outside React so the timer keeps running when autoplay
// moves to the next video and the player component is created again.
let deadline: number | null = null;

export const SLEEP_TIMER_MINUTES = [5, 10, 15, 30, 45, 60] as const;

/** Minutes left on the timer (rounded up), or null when it is off. */
export function sleepMinutesLeft(now = Date.now()): number | null {
  return deadline === null ? null : Math.max(1, Math.ceil((deadline - now) / 60_000));
}

/** Calls `onFire` once when the sleep timer runs out. `set(null)` turns it off. */
export function useSleepTimer(onFire: () => void) {
  const [version, setVersion] = useState(0);
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

  const set = useCallback((minutes: number | null) => {
    deadline = minutes === null ? null : Date.now() + minutes * 60_000;
    setVersion((current) => current + 1);
  }, []);

  return { minutesLeft: sleepMinutesLeft(), set };
}
