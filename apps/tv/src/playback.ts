export type PlaybackPosition = { position: number; duration: number };
export type PlaybackResult = PlaybackPosition & { completed: boolean; saveFailed: boolean; showDetails?: boolean };

export function resumePosition(position: number | null | undefined, duration: number | null | undefined, watched?: number | null): number {
  if (watched === 1 || !Number.isFinite(position) || (position ?? 0) < 5) return 0;
  if (Number.isFinite(duration) && (duration ?? 0) > 0 && position! >= duration! - 5) return 0;
  return Math.max(0, position!);
}

export function validPlaybackPosition(value: PlaybackPosition): boolean {
  return Number.isFinite(value.position) && Number.isFinite(value.duration) && value.duration > 0 && value.position >= 0 && value.position <= value.duration + 1;
}

export function playbackTime(seconds: number): string {
  const total = Math.floor(Math.max(0, Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total / 60) % 60;
  return `${hours ? `${hours}:${String(minutes).padStart(2, "0")}` : minutes}:${String(total % 60).padStart(2, "0")}`;
}

/** Serialize writes so a slow heartbeat cannot overwrite the final position. */
export class PlaybackProgress {
  private queue = Promise.resolve();
  private pending: PlaybackPosition | null = null;
  private writing = false;
  private ended = false;
  private failed = false;
  constructor(private readonly enabled: boolean, private readonly save: (value: PlaybackPosition) => Promise<unknown>, private readonly complete: () => Promise<unknown>) {}

  private enqueue(value: PlaybackPosition) {
    if (!this.enabled || !validPlaybackPosition(value)) return;
    this.pending = value;
    if (this.writing) return;
    this.writing = true;
    this.queue = (async () => {
      // Keep only the newest heartbeat while a slow connection is busy.
      while (this.pending) {
        const next = this.pending;
        this.pending = null;
        try { await this.save(next); this.failed = false; }
        catch { this.failed = true; }
      }
      this.writing = false;
    })();
  }

  update(value: PlaybackPosition) {
    if (!this.ended) this.enqueue({ ...value });
  }

  async finish(value: PlaybackPosition, completed: boolean): Promise<boolean> {
    if (!this.ended) {
      this.ended = true;
      this.enqueue({ ...value });
      if (this.enabled && completed) this.queue = this.queue.then(async () => {
        try { await this.complete(); }
        catch { this.failed = true; }
      });
    }
    await this.queue;
    return this.failed;
  }
}
