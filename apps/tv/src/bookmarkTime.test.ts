import { describe, expect, test } from "bun:test";
import { formatBookmarkTime } from "./bookmarkTime";

describe("formatBookmarkTime", () => {
  test("formats short saved moments", () => {
    expect(formatBookmarkTime(0)).toBe("0:00");
    expect(formatBookmarkTime(65.9)).toBe("1:05");
  });

  test("includes hours for long videos", () => {
    expect(formatBookmarkTime(3661)).toBe("1:01:01");
  });

  test("keeps invalid values safe", () => {
    expect(formatBookmarkTime(-10)).toBe("0:00");
    expect(formatBookmarkTime(Number.NaN)).toBe("0:00");
  });
});
