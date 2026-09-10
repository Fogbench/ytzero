import { expect, test } from "bun:test";
import { waitForPlayerAttachment } from "./playerAttachment";

test("waits for the native player prop, not just a ready source", async () => {
  let checks = 0;
  expect(await waitForPlayerAttachment(async () => ++checks === 3, () => true, async () => {})).toBe(true);
  expect(checks).toBe(3);
});

test("closing or superseding a swap during its native acknowledgement prevents late activation", async () => {
  let current = true;
  let attached!: (value: boolean) => void;
  const pending = waitForPlayerAttachment(() => new Promise((resolve) => { attached = resolve; }), () => current);
  current = false;
  attached(true);
  expect(await pending).toBe(false);
});

test("a missing native view fails with bounded retries", async () => {
  let checks = 0;
  await expect(waitForPlayerAttachment(async () => { checks++; return false; }, () => true, async () => {})).rejects.toThrow("timed out");
  expect(checks).toBe(40);
});
