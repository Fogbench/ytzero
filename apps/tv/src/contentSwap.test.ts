import { expect, test } from "bun:test";
import { swapLoadedContent } from "./contentSwap";

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
};

test("keeps the old feed until the replacement is ready to commit and settles layout before showing it", async () => {
  let visible = "old feed";
  const fade = deferred();
  const layout = deferred();
  let revealed = false;
  const swap = swapLoadedContent({ current: () => true, hide: () => fade.promise,
    commit: () => { visible = "new feed"; }, settle: () => layout.promise, show: async () => { revealed = true; } });
  expect(visible).toBe("old feed");
  fade.resolve(); await Promise.resolve();
  expect(visible).toBe("new feed");
  expect(revealed).toBe(false);
  layout.resolve(); expect(await swap).toBe(true);
  expect(revealed).toBe(true);
});

test("a fast second tag selection prevents the older response from replacing the feed", async () => {
  let version = 1;
  let visible = "old feed";
  const fade = deferred();
  const first = swapLoadedContent({ current: () => version === 1, hide: () => fade.promise,
    commit: () => { visible = "stale tag"; }, settle: async () => {}, show: async () => {} });
  version = 2;
  await swapLoadedContent({ current: () => version === 2, hide: async () => {},
    commit: () => { visible = "latest tag"; }, settle: async () => {}, show: async () => {} });
  fade.resolve();
  expect(await first).toBe(false);
  expect(visible).toBe("latest tag");
});

test("leaving during layout settlement cannot reveal an obsolete transition", async () => {
  let current = true;
  let revealed = false;
  const layout = deferred();
  const pending = swapLoadedContent({ current: () => current, hide: async () => {}, commit: () => {},
    settle: () => layout.promise, show: async () => { revealed = true; } });
  await Promise.resolve(); current = false; layout.resolve();
  expect(await pending).toBe(false);
  expect(revealed).toBe(false);
});
