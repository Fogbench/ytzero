import { describe, expect, test } from "bun:test";
import { captionPlayerVars, resolveWatchCaptions } from "./watchCaptions";

describe("watch caption defaults", () => {
  test("follows the profile preference when the channel inherits it", () => {
    expect(resolveWatchCaptions({ playerCc: "1", playerCcLang: "pl" })).toEqual({
      channelOff: false, defaultOn: true, language: "pl",
    });
    expect(resolveWatchCaptions({ playerCc: "0", playerCcLang: "pl" })).toEqual({
      channelOff: false, defaultOn: false, language: "pl",
    });
  });

  test("falls back to the player language and then to English", () => {
    expect(resolveWatchCaptions({ playerCc: "1", playerHl: "de" }).language).toBe("de");
    expect(resolveWatchCaptions({ playerCc: "1" }).language).toBe("en");
  });

  test("lets a channel force one caption language or turn captions off", () => {
    expect(resolveWatchCaptions({ channelMode: "language", channelLanguage: "uk", playerCc: "0" })).toEqual({
      channelOff: false, defaultOn: true, language: "uk",
    });
    expect(resolveWatchCaptions({ channelMode: "off", playerCc: "1" })).toEqual({
      channelOff: true, defaultOn: false, language: "en",
    });
  });
});

describe("caption player vars", () => {
  test("requests the preferred caption track when captions default on", () => {
    expect(captionPlayerVars(true, "pl")).toEqual({ cc_load_policy: 1, cc_lang_pref: "pl" });
  });

  test("always sends cc_load_policy=0 so the browser preference cannot re-enable captions", () => {
    expect(captionPlayerVars(false, "pl")).toEqual({ cc_load_policy: 0 });
  });
});
