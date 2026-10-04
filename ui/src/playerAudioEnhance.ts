// Stable volume and Voice boost, done with the browser's Web Audio API.
// The video's sound is routed through a small chain of filters:
//   video -> voice filters -> compressor (evens out loud and quiet parts) -> makeup gain -> speakers
// "Off" for a filter means it is set to do nothing, so the chain stays in place.
// A video element can be wired into Web Audio only once, so the chain is kept per element.

export interface AudioEnhanceMode {
  stableVolume: boolean;
  voiceBoost: boolean;
}

interface Chain {
  context: AudioContext;
  highpass: BiquadFilterNode;
  presence: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  makeup: GainNode;
}

const chains = new WeakMap<HTMLMediaElement, Chain>();

function buildChain(video: HTMLMediaElement): Chain | null {
  const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  const context = new Context();
  const source = context.createMediaElementSource(video);
  const highpass = context.createBiquadFilter();
  highpass.type = "highpass";
  const presence = context.createBiquadFilter();
  presence.type = "peaking";
  presence.frequency.value = 2800;
  presence.Q.value = 0.8;
  const compressor = context.createDynamicsCompressor();
  const makeup = context.createGain();
  source.connect(highpass).connect(presence).connect(compressor).connect(makeup).connect(context.destination);
  return { context, highpass, presence, compressor, makeup };
}

/** Apply the mode to a video. Does nothing (and touches nothing) until a filter is first switched on. */
export function applyAudioEnhance(video: HTMLMediaElement, mode: AudioEnhanceMode): void {
  let chain = chains.get(video) ?? null;
  if (!chain) {
    if (!mode.stableVolume && !mode.voiceBoost) return;
    try { chain = buildChain(video); } catch { return; }
    if (!chain) return;
    chains.set(video, chain);
  }
  const { context, highpass, presence, compressor, makeup } = chain;
  const now = context.currentTime;
  // Voice boost: cut rumble below 150 Hz and lift the range where speech is clearest.
  highpass.frequency.setValueAtTime(mode.voiceBoost ? 150 : 10, now);
  presence.gain.setValueAtTime(mode.voiceBoost ? 9 : 0, now);
  // Stable volume: ratio 1 leaves the sound unchanged, a high ratio squeezes loud parts down.
  compressor.threshold.setValueAtTime(mode.stableVolume ? -32 : 0, now);
  compressor.knee.setValueAtTime(mode.stableVolume ? 24 : 0, now);
  compressor.ratio.setValueAtTime(mode.stableVolume ? 6 : 1, now);
  compressor.attack.setValueAtTime(0.01, now);
  compressor.release.setValueAtTime(0.3, now);
  // The compressor lowers the loud parts, so lift everything back up a little.
  makeup.gain.setValueAtTime(mode.stableVolume ? 1.8 : 1, now);
  // Browsers start audio contexts paused until the viewer has interacted with the page.
  if (context.state === "suspended") void context.resume().catch(() => {});
}

/** Call from a click/key/play event: resumes a context the browser left suspended. */
export function resumeAudioEnhance(video: HTMLMediaElement): void {
  const chain = chains.get(video);
  if (chain && chain.context.state === "suspended") void chain.context.resume().catch(() => {});
}
