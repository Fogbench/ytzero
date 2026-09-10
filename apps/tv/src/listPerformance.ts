export function tvGridListPerformance(columns: number) {
  // TvGridList virtualizes rows rather than individual cards. Keep only a few
  // complete rows warm: multiplying these values by the column count caused
  // 32 video cards (and 50 Shorts) to mount during the first frame.
  const initialRows = columns >= 5 ? 2 : 3;
  return {
    initialNumToRender: initialRows,
    maxToRenderPerBatch: 2,
    updateCellsBatchingPeriod: 24,
    windowSize: 3,
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
