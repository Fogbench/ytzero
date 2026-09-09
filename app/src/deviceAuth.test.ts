import { describe, expect, test } from "bun:test";
import { normalizeDeviceUserCode, sanitizeDeviceName } from "./deviceAuthInput";

describe("TV device authorization input", () => {
  test("normalizes codes copied with spaces or lowercase", () => {
    expect(normalizeDeviceUserCode("abcd efgh")).toBe("ABCD-EFGH");
    expect(normalizeDeviceUserCode("ABCD-EFGH")).toBe("ABCD-EFGH");
  });

  test("rejects incomplete codes", () => {
    expect(normalizeDeviceUserCode("ABC-123")).toBe("");
    expect(normalizeDeviceUserCode(null)).toBe("");
  });

  test("sanitizes the label shown on the approval screen", () => {
    expect(sanitizeDeviceName("  Living\nRoom\u0000 TV  ")).toBe("Living Room TV");
    expect(sanitizeDeviceName(" ")).toBe("YT Zero TV");
    expect(sanitizeDeviceName("x".repeat(100))).toHaveLength(80);
  });
});
