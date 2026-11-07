import { syncRate } from "./math";

/**
 * Merging two tracks into one continuous file: track A plays from its start
 * to `aOut`; track B enters at `bIn` and overlaps A's last `overlap` seconds
 * with an equal-power crossfade (optionally swapping the bass halfway, as DJs
 * do, so two kick drums never pile up).
 */
export type MergeOptions = {
  /** Where A stops (seconds of A's own audio). */
  aOut: number;
  /** Where B starts (seconds of B's own audio). */
  bIn: number;
  /** Crossfade length in seconds (0 = hard cut). */
  overlap: number;
  /** Time-stretch B to A's tempo (changes B's pitch too, like a turntable). */
  syncTempo: boolean;
  /** Kill A's bass and bring in B's at the crossfade midpoint. */
  bassSwap: boolean;
};

export type MergeInput = { duration: number; bpm: number | null };

export type MergePlan = {
  aEnd: number;
  /** Timeline position where B begins (and the crossfade starts). */
  bStart: number;
  bOffset: number;
  bRate: number;
  fade: number;
  total: number;
};

/** Hard cap for rendered length: 18 min of 16-bit stereo WAV ≈ 190 MB, under the default 200 MB upload limit. */
export const MAX_MERGE_SECONDS = 18 * 60;

/** Turns user options into a timeline. Pure, so it is unit-tested. */
export function planMerge(a: MergeInput, b: MergeInput, o: MergeOptions): MergePlan {
  const aEnd = clamp(o.aOut, 0.5, a.duration);
  const bOffset = clamp(o.bIn, 0, Math.max(0, b.duration - 0.5));
  const bRate = o.syncTempo && a.bpm && b.bpm ? syncRate(a.bpm, 1, b.bpm) : 1;
  const bLen = (b.duration - bOffset) / bRate; // timeline seconds of B
  const fade = clamp(o.overlap, 0, Math.min(aEnd, bLen, 60));
  const bStart = aEnd - fade;
  const total = Math.min(MAX_MERGE_SECONDS, bStart + bLen);
  return { aEnd, bStart, bOffset, bRate, fade, total };
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));

/** Equal-power fade curves (out, in) with `steps` points. */
export function fadeCurves(steps = 64): [Float32Array, Float32Array] {
  const out = new Float32Array(steps);
  const inn = new Float32Array(steps);
  for (let i = 0; i < steps; i++) {
    const x = i / (steps - 1);
    out[i] = Math.cos((x * Math.PI) / 2);
    inn[i] = Math.sin((x * Math.PI) / 2);
  }
  return [out, inn];
}

/** Renders the merge offline (faster than real time, sample-accurate). Browser only. */
export async function renderMerge(bufA: AudioBuffer, bufB: AudioBuffer, a: MergeInput, b: MergeInput, opts: MergeOptions): Promise<AudioBuffer> {
  const plan = planMerge(a, b, opts);
  const sampleRate = bufA.sampleRate;
  const ctx = new OfflineAudioContext(2, Math.ceil(plan.total * sampleRate), sampleRate);

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -1;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.2;
  limiter.connect(ctx.destination);

  const chain = (buffer: AudioBuffer) => {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const low = ctx.createBiquadFilter();
    low.type = "lowshelf";
    low.frequency.value = 200;
    const gain = ctx.createGain();
    src.connect(low).connect(gain).connect(limiter);
    return { src, low, gain };
  };

  const A = chain(bufA);
  const B = chain(bufB);
  B.src.playbackRate.value = plan.bRate;
  const [out, inn] = fadeCurves();

  if (plan.fade > 0) {
    A.gain.gain.setValueAtTime(1, 0);
    A.gain.gain.setValueCurveAtTime(out, plan.bStart, plan.fade);
    B.gain.gain.setValueAtTime(0, 0);
    B.gain.gain.setValueCurveAtTime(inn, plan.bStart, plan.fade);
    if (opts.bassSwap) {
      const mid = plan.bStart + plan.fade / 2;
      B.low.gain.setValueAtTime(-24, 0);
      B.low.gain.setValueAtTime(-24, mid);
      B.low.gain.linearRampToValueAtTime(0, mid + 0.05);
      A.low.gain.setValueAtTime(0, mid);
      A.low.gain.linearRampToValueAtTime(-24, mid + 0.05);
    }
  }

  A.src.start(0, 0, plan.aEnd);
  A.src.stop(plan.aEnd);
  B.src.start(plan.bStart, plan.bOffset);
  return ctx.startRendering();
}
