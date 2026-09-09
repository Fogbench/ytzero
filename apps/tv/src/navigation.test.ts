import { describe, expect, test } from "bun:test";
import { resolveTvNavigation } from "./navigation";

describe("TV navigation", () => {
  test("uses the supported browser-sidebar order", () => {
    const result = resolveTvNavigation(JSON.stringify([
      { key: "/settings", hidden: false },
      { key: "/", hidden: false },
    ]));

    expect(result.visible.map((item) => item.destination)).toEqual(["settings", "feed"]);
  });

  test("keeps a hidden feed behind More and omits a completely disabled feed", () => {
    expect(resolveTvNavigation(JSON.stringify([{ key: "/", hidden: true }])).hidden[0]?.destination).toBe("feed");
    expect(resolveTvNavigation(JSON.stringify([{ key: "/", hidden: false, disabled: true }])).hidden).toEqual([]);
  });

  test("always keeps local device settings reachable", () => {
    const result = resolveTvNavigation(JSON.stringify([{ key: "/settings", hidden: true, disabled: true }]));
    expect(result.visible.some((item) => item.destination === "settings")).toBe(true);
  });
});
