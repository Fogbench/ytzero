/** Keep pagination anchored to an existing item before its footer moves. */
export class PaginationFocus<T> {
  private targets = new Map<string, T>();
  private lastId: string | null = null;
  private pending = false;
  private generation = 0;

  register(id: string, target: T | null) {
    if (target === null) this.targets.delete(id);
    else this.targets.set(id, target);
  }

  remember(id: string) { this.lastId = id; }

  target(ids: readonly string[]) {
    const id = this.lastId && ids.includes(this.lastId) ? this.lastId : ids.at(-1);
    return id ? this.targets.get(id) ?? null : null;
  }

  cancel() { this.generation++; this.pending = false; }

  async load(ids: readonly string[], focus: (target: T) => Promise<unknown>, load: (beforeAppend: () => Promise<void>) => Promise<void>) {
    if (this.pending) return;
    this.pending = true;
    const generation = this.generation;
    try {
      await load(async () => {
        // Move focus before the footer moves, only if this is still its request.
        const target = this.target(ids);
        if (target && generation === this.generation) await focus(target);
      });
    } finally {
      if (generation === this.generation) this.pending = false;
    }
  }
}

/** Includes the bottom item of every column when the final row is incomplete. */
export function isPaginationEdge(index: number, count: number, columns: number) {
  return index >= 0 && index < count && index + Math.max(1, columns) >= count;
}
