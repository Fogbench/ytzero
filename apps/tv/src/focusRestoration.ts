/** Resolve the current mounted view on each attempt, after native dismissal. */
export function restoreFocus<T>(
  target: () => T | null,
  focus: (target: T) => Promise<boolean>,
  fallback: () => T | null = () => null,
  schedule: (run: () => void) => () => void = (run) => {
    const timer = setTimeout(run, 50);
    return () => clearTimeout(timer);
  },
) {
  let cancelled = false;
  let cancelScheduled: (() => void) | undefined;
  let remaining = 20;
  const attempt = async () => {
    if (cancelled) return;
    remaining -= 1;
    const view = target() ?? (remaining === 0 ? fallback() : null);
    const focused = view !== null && await focus(view).catch(() => false);
    if (!cancelled && !focused && remaining > 0) cancelScheduled = schedule(() => { void attempt(); });
  };
  cancelScheduled = schedule(() => { void attempt(); });
  return () => { cancelled = true; cancelScheduled?.(); };
}
