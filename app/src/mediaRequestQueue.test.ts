import { expect, test } from "bun:test";
import { MediaRequestQueue } from "./mediaRequestQueue";

test("queues HLS preload bursts with bounded active buffers and FIFO admission", async () => {
  const queue = new MediaRequestQueue(4, 32);
  const signal = new AbortController().signal;
  const active = await Promise.all(Array.from({ length: 4 }, () => queue.acquire(1, signal)));
  const admitted: number[] = [];
  const waiting = [0, 1, 2].map((id) => queue.acquire(1, signal).then((release) => { admitted.push(id); return release; }));
  await Promise.resolve();
  expect(admitted).toEqual([]);
  active[0]!(); active[0]!();
  const first = await waiting[0]!;
  expect(admitted).toEqual([0]);
  first!(); (await waiting[1])!(); (await waiting[2])!();
  active.slice(1).forEach((release) => release!());
  expect(admitted).toEqual([0, 1, 2]);
});

test("cancelled obsolete Shorts leave the queue without consuming capacity", async () => {
  const queue = new MediaRequestQueue(1, 2);
  const signal = new AbortController().signal;
  const release = await queue.acquire(1, signal);
  const obsolete = new AbortController();
  const first = queue.acquire(1, obsolete.signal);
  const second = queue.acquire(1, signal);
  expect(await queue.acquire(1, signal)).toBeNull();
  // Another profile is independent of this one's buffers and waiting limit.
  const other = await queue.acquire(2, signal);
  expect(other).toBeFunction();
  other!();
  obsolete.abort();
  expect(await first).toBeNull();
  expect(await queue.acquire(1, obsolete.signal)).toBeNull();
  release!(); (await second)!();
  (await queue.acquire(1, signal))!();
});

test("timeout and session reset cancel waiting work without losing active capacity", async () => {
  const queue = new MediaRequestQueue(1, 2);
  const signal = new AbortController().signal;
  const release = await queue.acquire(1, signal);
  expect(await queue.acquire(1, AbortSignal.timeout(5))).toBeNull();
  const obsolete = queue.acquire(1, signal);
  queue.cancelPending();
  expect(await obsolete).toBeNull();
  let admitted = false;
  const next = queue.acquire(1, signal).then((value) => { admitted = true; return value; });
  await Promise.resolve();
  expect(admitted).toBe(false);
  release!();
  (await next)!();
});
