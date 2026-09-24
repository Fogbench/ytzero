import { expect, test } from "bun:test";
import { createVideoPress } from "./videoPress";

function fixture() {
  const events: string[] = [];
  const frames: Array<() => void> = [];
  const press = createVideoPress(() => events.push("play"), () => events.push("menu"), (run) => {
    frames.push(run);
    // Keep cancelled callbacks queued as well, to exercise the stale-event guard.
    return () => {};
  });
  return { press, events, flush: () => { while (frames.length) frames.shift()!(); } };
}

test("presents the menu at the hold threshold before release and suppresses playback", () => {
  const { press, events, flush } = fixture();
  press.pressIn(); press.longPress(); flush(); expect(events).toEqual(["menu"]);
  press.pressOut(); press.press();
  flush(); expect(events).toEqual(["menu"]);
});

test("the same card can reopen its menu repeatedly and still play on a short press", () => {
  const { press, events, flush } = fixture();
  for (let i = 0; i < 3; i++) {
    press.pressIn(); press.longPress(); flush();
    press.cancel(); // Focus leaves for the modal while Select is still held.
    press.pressOut(); press.press();
  }
  press.pressIn(); press.pressOut(); press.press(); flush();
  expect(events).toEqual(["menu", "menu", "menu", "play"]);
});

test("repeated hold events open only one menu, including after it takes focus", () => {
  const { press, events, flush } = fixture();
  press.pressIn(); press.longPress(); press.longPress(); flush();
  press.longPress(); flush();
  press.cancel(); press.longPress(); press.pressOut(); press.press(); flush();
  expect(events).toEqual(["menu"]);
});

test("release immediately after the threshold still opens the menu only once", () => {
  const { press, events, flush } = fixture();
  press.pressIn(); press.longPress(); press.pressOut(); press.press(); flush();
  expect(events).toEqual(["menu"]);
});

test("leaving a card while held or before presentation cancels pending actions", () => {
  const { press, events, flush } = fixture();
  press.pressIn(); press.longPress(); press.cancel(); press.pressOut(); press.press(); flush();
  press.pressIn(); press.longPress(); press.pressOut(); press.cancel(); flush();
  press.pressIn(); press.cancel(); press.pressOut(); press.press(); flush();
  expect(events).toEqual([]);
});

test("a new gesture supersedes a stale scheduled menu without swallowing playback", () => {
  const { press, events, flush } = fixture();
  press.pressIn(); press.longPress(); press.pressOut();
  press.pressIn(); press.pressOut(); press.press(); flush();
  expect(events).toEqual(["play"]);
});
