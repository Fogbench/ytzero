/** Commit only a still-current, fully loaded result between the two fades. */
export async function swapLoadedContent({ current, hide, commit, settle, show }: {
  current: () => boolean; hide: () => Promise<void>; commit: () => void; settle: () => Promise<void>; show: () => Promise<void>;
}) {
  if (!current()) return false;
  await hide();
  if (!current()) return false;
  commit();
  await settle();
  if (!current()) return false;
  await show();
  return current();
}
