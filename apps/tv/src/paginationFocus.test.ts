import { describe, expect, test } from "bun:test";
import { isPaginationEdge, PaginationFocus } from "./paginationFocus";

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
};

describe("pagination focus", () => {
  test("every bottom column reaches the footer, including an incomplete last row", () => {
    expect(Array.from({ length: 10 }, (_, i) => i).filter((i) => isPaginationEdge(i, 10, 4))).toEqual([6, 7, 8, 9]);
    expect(Array.from({ length: 12 }, (_, i) => i).filter((i) => isPaginationEdge(i, 12, 4))).toEqual([8, 9, 10, 11]);
    expect(isPaginationEdge(-1, 10, 4)).toBe(false);
    expect(isPaginationEdge(0, 0, 4)).toBe(false);
    expect(isPaginationEdge(10, 10, 4)).toBe(false);
  });

  test("returns to the originating column before append, without following the moving footer", async () => {
    const memory = new PaginationFocus<string>();
    const ids = ["a", "b", "c", "d"];
    ids.forEach((id) => memory.register(id, `view:${id}`));
    memory.remember("b");
    const focused = deferred();
    const events: string[] = [];
    const loading = memory.load(ids, async (view) => { events.push(view); await focused.promise; }, async (beforeAppend) => {
      await beforeAppend();
      events.push("append"); ids.push("e", "f", "g", "h");
    });
    expect(events).toEqual(["view:b"]);
    focused.resolve(); await loading;
    expect(events).toEqual(["view:b", "append"]);
  });

  test("resolves a remounted card after fetching and only before append", async () => {
    const memory = new PaginationFocus<string>();
    memory.register("a", "old"); memory.remember("a");
    const response = deferred();
    const events: string[] = [];
    const loading = memory.load(["a"], async (view) => { events.push(view); }, async (beforeAppend) => {
      await response.promise;
      await beforeAppend();
      events.push("append");
    });
    expect(events).toEqual([]);
    memory.register("a", null); memory.register("a", "remounted");
    response.resolve(); await loading;
    expect(events).toEqual(["remounted", "append"]);
  });

  test("coalesces rapid activation and releases the guard after a failed request", async () => {
    const memory = new PaginationFocus<string>();
    const response = deferred();
    let requests = 0;
    const load = () => { requests++; return response.promise; };
    const first = memory.load([], async () => {}, load);
    await memory.load([], async () => {}, load);
    expect(requests).toBe(1);
    response.resolve(); await first;
    await expect(memory.load([], async () => {}, async () => { throw new Error("offline"); })).rejects.toThrow("offline");
    await memory.load([], async () => {}, async () => { requests++; });
    expect(requests).toBe(2);
  });

  test("does not restore focus for an obsolete request after leaving the list", async () => {
    const memory = new PaginationFocus<string>();
    memory.register("a", "view:a"); memory.remember("a");
    const response = deferred();
    let focuses = 0;
    const loading = memory.load(["a"], async () => { focuses++; }, async (beforeAppend) => {
      await response.promise; await beforeAppend();
    });
    memory.cancel(); response.resolve(); await loading;
    expect(focuses).toBe(0);
  });
});
