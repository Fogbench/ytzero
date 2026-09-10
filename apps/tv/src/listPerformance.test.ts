import { expect, test } from "bun:test";
import { tvGridListPerformance } from "./listPerformance";

test("grid rendering budgets count virtualized rows rather than individual cards", () => {
  for (const columns of [3, 4, 5]) {
    const performance = tvGridListPerformance(columns);
    expect(performance.initialNumToRender * columns).toBeLessThanOrEqual(12);
    expect(performance.maxToRenderPerBatch * columns).toBeLessThanOrEqual(10);
  }
});
