import { expect, test } from "bun:test";
import { focusOnEntry, isFocusInteraction } from "./focusEntry";

function harness(focus: (target: string, stillActive: () => boolean) => Promise<boolean>) {
  const pending = new Set<() => void>();
  let interaction: (() => void) | undefined;
  let settled = 0;
  const cancel = focusOnEntry("first card", focus, () => { settled++; }, (stop) => {
    interaction = stop;
    return () => { interaction = undefined; };
  }, (run) => { pending.add(run); return () => { pending.delete(run); }; });
  return {
    cancel,
    interact: () => interaction?.(),
    get settled() { return settled; },
    get pending() { return pending.size; },
    get listening() { return Boolean(interaction); },
    async tick() {
      const work = [...pending]; pending.clear(); work.forEach((run) => run());
      for (let i = 0; i < 5; i++) await Promise.resolve();
    },
  };
}

test("navigation cancels entry focus before it can pull the user up the list", async () => {
  let calls = 0;
  const h = harness(async () => { calls++; return true; });
  h.interact(); await h.tick();
  expect(calls).toBe(0);
  expect(h.settled).toBe(1);
  expect(h.listening).toBe(false);
});

test("a delayed native failure cannot refocus after rapid navigation and selection", async () => {
  let finish!: (value: boolean) => void;
  let calls = 0;
  const h = harness(() => { calls++; return new Promise((resolve) => { finish = resolve; }); });
  await h.tick(); h.interact(); h.interact(); finish(false);
  await h.tick(); await h.tick();
  expect(calls).toBe(1);
  expect(h.pending).toBe(0);
  expect(h.settled).toBe(1);
});

test("successful focus releases the listener and does not repeat after browsing", async () => {
  const h = harness(async () => true);
  await h.tick(); h.interact(); await h.tick();
  expect(h.settled).toBe(1);
  expect(h.pending).toBe(0);
  expect(h.listening).toBe(false);
});

test("unmount cancels entry without marking another screen as focused", async () => {
  const h = harness(async () => true);
  h.cancel(); await h.tick();
  expect(h.settled).toBe(0);
  expect(h.listening).toBe(false);
});

test("remote selection on key-up and swipes also take ownership of focus", () => {
  expect(isFocusInteraction({ eventType: "select", eventKeyAction: 1 })).toBe(true);
  expect(isFocusInteraction({ eventType: "longSelect", eventKeyAction: 1 })).toBe(true);
  expect(isFocusInteraction({ eventType: "swipeDown" })).toBe(true);
  expect(isFocusInteraction({ eventType: "longUp", eventKeyAction: 0 })).toBe(true);
  expect(isFocusInteraction({ eventType: "down", eventKeyAction: 1 })).toBe(false);
  expect(isFocusInteraction({ eventType: "focus" })).toBe(false);
  expect(isFocusInteraction({ eventType: "blur" })).toBe(false);
});

test("an in-flight focus operation sees cancellation before issuing a fallback", async () => {
  let finish!: () => void;
  let fallbacks = 0;
  const h = harness(async (_target, stillActive) => {
    await new Promise<void>((resolve) => { finish = resolve; });
    if (stillActive()) fallbacks++;
    return false;
  });
  await h.tick(); h.interact(); finish(); await h.tick();
  expect(fallbacks).toBe(0);
  expect(h.pending).toBe(0);
});
