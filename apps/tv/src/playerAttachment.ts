/** React committing a player prop does not acknowledge AVKit attaching it. */
export async function waitForPlayerAttachment(
  attached: () => Promise<boolean>,
  current: () => boolean,
  delay: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 50)),
) {
  for (let attempt = 0; attempt < 40 && current(); attempt++) {
    const ready = await attached();
    if (!current()) return false;
    if (ready) return true;
    await delay();
  }
  if (!current()) return false;
  throw new Error("Native player attachment timed out");
}
