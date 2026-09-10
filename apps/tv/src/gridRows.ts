/** The row key must survive filling a partially populated final row. */
export function gridRows<T>(items: readonly T[], columns: number, key: (item: T, index: number) => string) {
  const rows: Array<{ key: string; items: Array<{ item: T; index: number }> }> = [];
  const width = Math.max(1, Math.floor(columns));
  for (let index = 0; index < items.length; index += width) {
    rows.push({
      key: key(items[index]!, index),
      items: items.slice(index, index + width).map((item, offset) => ({ item, index: index + offset })),
    });
  }
  return rows;
}
