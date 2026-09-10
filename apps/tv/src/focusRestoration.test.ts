import { describe, expect, test } from "bun:test";
import { restoreFocus } from "./focusRestoration";

function scheduler() {
  const pending = new Set<() => void>();
  return {
    schedule(run: () => void) { pending.add(run); return () => { pending.delete(run); }; },
    async tick() {
      const work = [...pending];
      pending.clear();
      work.forEach((run) => run());
      // Flush the native focus promise and its continuation.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    },
    get size() { return pending.size; },
  };
}

describe("return focus after playback", () => {
  test("waits for the native modal to dismiss and stops after success", async () => {
    const clock = scheduler();
    const calls: string[] = [];
    restoreFocus(() => "selected", async (view) => { calls.push(view); return calls.length === 3; }, undefined, clock.schedule);
    expect(calls).toEqual([]);
    for (let i = 0; i < 5; i++) await clock.tick();
    expect(calls).toEqual(["selected", "selected", "selected"]);
    expect(clock.size).toBe(0);
  });

  test("resolves the live card ref instead of retaining a recycled native view", async () => {
    const clock = scheduler();
    let target: string | null = "old view";
    const calls: string[] = [];
    restoreFocus(() => target, async (view) => { calls.push(view); return view === "new view"; }, undefined, clock.schedule);
    await clock.tick();
    target = null;
    await clock.tick();
    target = "new view";
    await clock.tick();
    expect(calls).toEqual(["old view", "new view"]);
    expect(clock.size).toBe(0);
  });

  test("uses a fallback only when the original card no longer exists", async () => {
    const clock = scheduler();
    const calls: string[] = [];
    restoreFocus<string>(() => null, async (view) => { calls.push(view); return true; }, () => "first remaining card", clock.schedule);
    for (let i = 0; i < 19; i++) await clock.tick();
    expect(calls).toEqual([]);
    await clock.tick();
    expect(calls).toEqual(["first remaining card"]);
    expect(clock.size).toBe(0);
  });

  test("user navigation cancels a pending retry, including an in-flight native call", async () => {
    const clock = scheduler();
    let finish: (focused: boolean) => void = () => {};
    const cancel = restoreFocus(() => "selected", () => new Promise<boolean>((resolve) => { finish = resolve; }), undefined, clock.schedule);
    await clock.tick();
    cancel();
    finish(false);
    await clock.tick();
    expect(clock.size).toBe(0);
    const cancelBeforeStart = restoreFocus(() => "selected", async () => { throw new Error("must not run"); }, undefined, clock.schedule);
    cancelBeforeStart();
    expect(clock.size).toBe(0);
  });

  test("native failures have bounded retries", async () => {
    const clock = scheduler();
    let calls = 0;
    restoreFocus(() => "selected", async () => { calls += 1; throw new Error("detached"); }, undefined, clock.schedule);
    for (let i = 0; i < 30; i++) await clock.tick();
    expect(calls).toBe(20);
    expect(clock.size).toBe(0);
  });
});
