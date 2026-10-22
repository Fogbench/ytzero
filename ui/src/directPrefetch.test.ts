import { describe, expect, test } from "bun:test";
import { createDirectPrefetcher } from "./directPrefetch";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function harness() {
  const sent: string[] = [];
  const pending: Array<() => void> = [];
  const prefetcher = createDirectPrefetcher((id) => {
    sent.push(id);
    return new Promise<void>((resolve) => pending.push(resolve));
  }, { hoverDelayMs: 20, repeatAfterMs: 60_000 });
  return { sent, pending, prefetcher };
}

describe("direct player prefetch", () => {
  test("opening the watch page warms the lookup at once, once per video", async () => {
    const { sent, pending, prefetcher } = harness();
    prefetcher.now("a");
    prefetcher.now("a");
    expect(sent).toEqual(["a"]);
    pending[0]();
    await sleep(0);
    prefetcher.now("a");
    expect(sent).toEqual(["a"]);
  });

  test("hover waits for the debounce and a pointer that leaves early sends nothing", async () => {
    const { sent, prefetcher } = harness();
    prefetcher.hover("a");
    prefetcher.cancelHover("a");
    await sleep(40);
    expect(sent).toEqual([]);
    prefetcher.hover("b");
    await sleep(40);
    expect(sent).toEqual(["b"]);
  });

  test("hovering across cards keeps at most one hover request in flight", async () => {
    const { sent, pending, prefetcher } = harness();
    prefetcher.hover("a");
    await sleep(40);
    prefetcher.hover("b");
    await sleep(40);
    expect(sent).toEqual(["a"]);
    pending[0]();
    await sleep(0);
    prefetcher.hover("c");
    await sleep(40);
    expect(sent).toEqual(["a", "c"]);
  });

  test("a failed request is not remembered", async () => {
    let calls = 0;
    const prefetcher = createDirectPrefetcher(async () => { calls++; throw new Error("offline"); }, { hoverDelayMs: 1, repeatAfterMs: 60_000 });
    prefetcher.now("a");
    await sleep(0);
    prefetcher.now("a");
    expect(calls).toBe(2);
  });
});
