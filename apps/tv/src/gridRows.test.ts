import { expect, test } from "bun:test";
import { gridRows } from "./gridRows";

const key = (video: { id: string }) => video.id;
for (const columns of [3, 4, 5]) {
  for (let remainder = 1; remainder < columns; remainder++) {
    test(`appending preserves a focused partial row (${columns} columns, ${remainder} existing)`, () => {
      const videos = Array.from({ length: columns * 2 + remainder }, (_, i) => ({ id: String(i) }));
      const oldRows = gridRows(videos, columns, key);
      const appended = [...videos, ...Array.from({ length: columns * 2 }, (_, i) => ({ id: `new-${i}` }))];
      const nextRows = gridRows(appended, columns, key);
      expect(nextRows.slice(0, oldRows.length).map((row) => row.key)).toEqual(oldRows.map((row) => row.key));
      for (const { item, index } of oldRows.at(-1)!.items) {
        expect(nextRows[2]!.items.find((entry) => entry.index === index)?.item).toBe(item);
      }
      expect(nextRows.flatMap((row) => row.items.map((entry) => entry.item))).toEqual(appended);
    });
  }
}

test("empty grids and an appended full row have stable, unique keys", () => {
  expect(gridRows([], 4, key)).toEqual([]);
  const videos = Array.from({ length: 12 }, (_, i) => ({ id: String(i) }));
  expect(gridRows(videos, 4, key).map((row) => row.key)).toEqual(["0", "4", "8"]);
  expect(gridRows(videos, 4, key).flatMap((row) => row.items.map((entry) => entry.index))).toEqual(Array.from({ length: 12 }, (_, i) => i));
});
