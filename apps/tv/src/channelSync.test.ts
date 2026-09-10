import { expect, test } from "bun:test";
import { observeChannelSync, sameChannelSyncSnapshot } from "./channelSync";
import type { ChannelSyncSnapshot } from "./types";

const snapshot = (id: string, running = true, channelId = "channel", failed = false): ChannelSyncSnapshot => ({
  busy: running, job: { id, status: running ? "running" : "completed", channels: [{ channelId, status: running ? "running" : failed ? "failed" : "completed", added: 3 }] },
});
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };
test("refreshes once on completion, ignores old terminal jobs and other channels", async () => {
  let current = snapshot("old", false);
  const outcomes: boolean[] = [];
  const watch = observeChannelSync(async () => current, "channel", () => {}, (ok) => outcomes.push(ok), () => () => {});
  await tick(); expect(outcomes).toEqual([]);
  current = snapshot("new"); watch.refresh(); await tick();
  current = snapshot("new", false); watch.refresh(); await tick(); watch.refresh(); await tick();
  expect(outcomes).toEqual([true]);
  current = snapshot("other", false, "elsewhere"); watch.refresh(); await tick();
  expect(outcomes).toEqual([true]); watch.dispose();
});
test("a stale status request cannot overwrite a just-started job; polls do not overlap", async () => {
  const requests: Array<(value: ChannelSyncSnapshot) => void> = [];
  const seen: ChannelSyncSnapshot[] = [];
  const outcomes: boolean[] = [];
  const watch = observeChannelSync(() => new Promise((resolve) => requests.push(resolve)), "channel", (value) => { if (value) seen.push(value); }, (ok) => outcomes.push(ok), () => () => {});
  watch.refresh(); watch.refresh(); expect(requests.length).toBe(1);
  watch.started(snapshot("new"));
  requests[0]!(snapshot("old", false)); await tick();
  expect(seen.map((value) => value.job?.id)).toEqual(["new"]);
  expect(requests.length).toBe(2);
  requests[1]!(snapshot("new", false)); await tick();
  expect(outcomes).toEqual([true]); watch.dispose();
});
test("retries failed reads, reports a lost job, and discards requests after leaving", async () => {
  let fail = false;
  let current = snapshot("new");
  const seen: Array<ChannelSyncSnapshot | null> = [], outcomes: boolean[] = [];
  const watch = observeChannelSync(async () => { if (fail) throw Error("offline"); return current; }, "channel", (value) => seen.push(value), (ok) => outcomes.push(ok), () => () => {});
  await tick(); fail = true; watch.refresh(); await tick(); expect(seen.at(-1)).toBeNull(); expect(outcomes).toEqual([]);
  fail = false; current = { job: null, busy: false }; watch.refresh(); await tick(); expect(outcomes).toEqual([false]);
  const count = seen.length; watch.refresh(); watch.dispose(); await tick(); expect(seen.length).toBe(count);
});
test("compares only state that can change the current channel controls", () => {
  const current = snapshot("job", true, "channel");
  expect(sameChannelSyncSnapshot(current, { ...current }, "channel")).toBe(true);
  expect(sameChannelSyncSnapshot(current, snapshot("job", false, "channel"), "channel")).toBe(false);
  const unrelated = { ...current, job: { ...current.job!, channels: [...current.job!.channels, { channelId: "other", status: "completed" as const, added: 8 }] } };
  expect(sameChannelSyncSnapshot(current, unrelated, "channel")).toBe(true);
});
test("polls quickly while synchronization is busy and backs off while idle", async () => {
  let current: ChannelSyncSnapshot = { job: null, busy: false };
  const delays: number[] = [];
  const watch = observeChannelSync(async () => current, "channel", () => {}, () => {}, (_run, delay) => {
    delays.push(delay);
    return () => {};
  });
  await tick();
  expect(delays.at(-1)).toBe(15_000);
  current = snapshot("active");
  watch.refresh();
  await tick();
  expect(delays.at(-1)).toBe(2_000);
  watch.dispose();
});
