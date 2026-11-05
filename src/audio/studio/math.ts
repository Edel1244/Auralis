/** Pure DJ math shared by the studio engine and UI (see tests/studio.test.ts). */

/** Equal-power crossfade. x: -1 (full A) … 0 (both) … 1 (full B). */
export function crossfadeGains(x: number): [number, number] {
  const p = (Math.min(1, Math.max(-1, x)) + 1) / 2; // 0..1
  return [Math.cos((p * Math.PI) / 2), Math.sin((p * Math.PI) / 2)];
}

/** Playback rate that makes `bpm` match the master's effective tempo. */
export function syncRate(masterBpm: number, masterRate: number, bpm: number, min = 0.5, max = 2) {
  if (!masterBpm || !bpm) return 1;
  return Math.min(max, Math.max(min, (masterBpm * masterRate) / bpm));
}

export const semitoneRatio = (semitones: number) => Math.pow(2, semitones / 12);

/** Beat-quantized loop region starting at the current position (track-time seconds). */
export function loopRegion(position: number, bpm: number, beats: number, duration: number) {
  const beat = 60 / bpm;
  const start = Math.max(0, position);
  const end = Math.min(duration, start + beat * beats);
  return { start, end };
}

/** Wraps a position into an active loop. */
export function wrapLoop(position: number, loop: { start: number; end: number } | null) {
  if (!loop || loop.end <= loop.start || position < loop.end) return position;
  const len = loop.end - loop.start;
  return loop.start + ((position - loop.start) % len);
}

/**
 * Delay-line pitch shifter parameters. A delay sweeping linearly by `g`
 * seconds per period `T` changes pitch by ratio r = 1 - g/T, so g = (1 - r)·T.
 * The base delay keeps the swept delay ≥ 0 for r ≤ 2.
 */
export function pitchShiftSweep(semitones: number, period: number) {
  const r = semitoneRatio(Math.max(-12, Math.min(12, semitones)));
  return { ratio: r, sweep: (1 - r) * period, base: period };
}

/** Effective BPM shown on the deck display. */
export const effectiveBpm = (bpm: number | null, rate: number) => (bpm ? Math.round(bpm * rate * 10) / 10 : null);
