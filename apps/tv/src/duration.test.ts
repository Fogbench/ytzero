import { expect, test } from "bun:test";
import { formatVideoDuration } from "./duration";

test("normalizes API total minutes to a clock with hours only when needed", () => {
  expect(formatVideoDuration("68:10")).toBe("1:08:10");
  expect(formatVideoDuration("2751:12")).toBe("45:51:12");
  expect(formatVideoDuration("01:08:10")).toBe("1:08:10");
  expect(formatVideoDuration("00:12:05")).toBe("12:05");
  expect(formatVideoDuration("0:26")).toBe("0:26");
  expect(formatVideoDuration("60:00")).toBe("1:00:00");
  expect(formatVideoDuration(3661.9)).toBe("1:01:01");
  expect(formatVideoDuration(0)).toBe("0:00");
});

test("missing and invalid durations never render NaN or an invented length", () => {
  for (const input of [null, undefined, "", " ", "LIVE", "-1:20", "1::20", "1:2:3:4", Infinity, NaN, -1]) expect(formatVideoDuration(input)).toBe("");
});
