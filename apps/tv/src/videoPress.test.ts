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

test("finishes Select before presenting a modal and suppresses the corresponding short press", () => {
  const { press, events, flush } = fixture();
  press.pressIn(); press.longPress(); flush(); expect(events).toEqual([]);
  press.pressOut(); press.press(); expect(events).toEqual([]);
  flush(); expect(events).toEqual(["menu"]);
});

test("the same card can reopen its menu repeatedly and still play on a short press", () => {
  const { press, events, flush } = fixture();
  for (let i = 0; i < 3; i++) {
    press.pressIn(); press.longPress(); press.pressOut(); flush();
    press.cancel(); // Focus leaves for the modal, then returns to this card.
  }
  press.pressIn(); press.pressOut(); press.press(); flush();
  expect(events).toEqual(["menu", "menu", "menu", "play"]);
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
