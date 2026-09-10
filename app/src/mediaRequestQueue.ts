/** Bound upstream media buffers without rejecting ordinary player preloading. */
export class MediaRequestQueue {
  private profiles = new Map<number, { active: number; waiting: Set<(cancel?: boolean) => void> }>();
  constructor(private concurrency: number, private maxWaiting: number) {}

  acquire(profile: number, signal: AbortSignal): Promise<(() => void) | null> {
    if (signal.aborted) return Promise.resolve(null);
    let state = this.profiles.get(profile);
    if (!state) { state = { active: 0, waiting: new Set() }; this.profiles.set(profile, state); }
    const current = state;
    const cleanup = () => {
      if (!current.active && !current.waiting.size) this.profiles.delete(profile);
    };
    const lease = () => {
      current.active++;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        current.active--;
        current.waiting.values().next().value?.();
        cleanup();
      };
    };
    if (current.active < this.concurrency) return Promise.resolve(lease());
    if (current.waiting.size >= this.maxWaiting) return Promise.resolve(null);
    return new Promise((resolve) => {
      const abort = () => done(true);
      const done = (cancel = false) => {
        current.waiting.delete(done);
        signal.removeEventListener("abort", abort);
        resolve(cancel || signal.aborted ? null : lease());
        cleanup();
      };
      current.waiting.add(done);
      signal.addEventListener("abort", abort, { once: true });
    });
  }

  cancelPending() {
    for (const state of this.profiles.values()) for (const done of [...state.waiting]) done(true);
  }
}
