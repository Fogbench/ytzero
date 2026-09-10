import { expect, test } from "bun:test";
import { colors } from "./theme";

function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

function contrast(foreground: string, background: string) {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

test("opaque reading surfaces keep primary, secondary and destructive copy readable", () => {
  for (const background of [colors.background, colors.surface, colors.surfaceRaised, colors.surfaceSelected]) {
    for (const foreground of [colors.text, colors.textMuted, colors.danger]) {
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test("Increase Contrast distinguishes focus without a border and keeps focused copy readable", () => {
  expect(contrast(colors.focusStrong, colors.surface)).toBeGreaterThanOrEqual(3);
  expect(contrast(colors.text, colors.focusStrong)).toBeGreaterThanOrEqual(4.5);
});

test("switch position stays visible in both states", () => {
  expect(contrast(colors.text, "#71717a")).toBeGreaterThanOrEqual(3);
  expect(contrast(colors.black, colors.success)).toBeGreaterThanOrEqual(3);
});
