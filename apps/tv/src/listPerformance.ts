export function tvGridListPerformance(columns: number) {
  const row = Math.max(1, columns);
  return {
    initialNumToRender: row * 2,
    maxToRenderPerBatch: row * 2,
    updateCellsBatchingPeriod: 48,
    windowSize: 5,
    removeClippedSubviews: false,
  } as const;
}

export const tvVerticalListPerformance = {
  initialNumToRender: 5,
  maxToRenderPerBatch: 5,
  updateCellsBatchingPeriod: 48,
  windowSize: 5,
  removeClippedSubviews: false,
} as const;
