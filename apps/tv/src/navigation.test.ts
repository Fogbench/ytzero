import { describe, expect, test } from "bun:test";
import { resolveTvNavigation } from "./navigation";

describe("TV navigation", () => {
  test("inherits browser order while excluding Social and Pulse", () => {
    const result = resolveTvNavigation(JSON.stringify([
      { key: "/settings", hidden: false },
      { key: "/social", hidden: false },
      { key: "/history", hidden: false },
      { key: "/insights", hidden: false },
      { key: "/", hidden: false },
    ]));

    expect(result.visible.slice(0, 3).map((item) => item.destination)).toEqual(["/settings", "/history", "/"]);
    const keys: string[] = [...result.visible, ...result.hidden].map((item) => item.key);
    expect(keys.some((key) => key === "/social" || key === "/insights")).toBe(false);
  });

  test("inherits hidden and disabled states", () => {
    const navigation = resolveTvNavigation(JSON.stringify([
      { key: "/", hidden: true },
      { key: "/history", hidden: false, disabled: true },
    ]));
    expect(navigation.hidden[0]?.destination).toBe("/");
    expect([...navigation.visible, ...navigation.hidden].some((item) => item.destination === "/history")).toBe(false);
  });

  test("always keeps local device settings reachable", () => {
    const result = resolveTvNavigation(JSON.stringify([{ key: "/settings", hidden: true, disabled: true }]));
    expect(result.visible.some((item) => item.destination === "/settings")).toBe(true);
  });

  test("uses the browser defaults for missing entries", () => {
    const result = resolveTvNavigation(null);
    expect(result.visible.map((item) => item.destination)).toEqual([
      "/", "/live", "/watchlist", "/downloads", "/liked", "/history", "/bookmarks", "/archive", "/settings",
    ]);
    expect(result.hidden.map((item) => item.destination)).toEqual(["/recommendations", "/shorts", "/followed-playlists"]);
  });
});
