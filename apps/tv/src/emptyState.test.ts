import { expect, test } from "bun:test";
import { browseEmptyState } from "./emptyState";
test("empty filtered feeds offer filter guidance without a completion illustration", () => {
  expect(browseEmptyState("/", true, true, false)).toMatchObject({ title: "tvEmptyFeedEmptyNoTagMatchTitle", icon: "search" });
  expect(browseEmptyState("/", true, true, false).art).toBeUndefined();
});
test("unknown subscription state never claims the profile follows nobody", () => {
  expect(browseEmptyState("/", false, null, false).art).toBe("inboxZero");
  expect(browseEmptyState("/", false, false, false).art).toBe("noSubscriptions");
});
test("empty subsections alongside content stay quiet", () => {
  expect(browseEmptyState("/", false, true, true).art).toBeUndefined();
  expect(browseEmptyState("/downloads", false, true, false).art).toBe("noDownloads");
  expect(browseEmptyState("/history", false, true, false).title).toBe("tvEmptyHistoryEmpty");
});
