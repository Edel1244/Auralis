/**
 * Pure DSP helpers (no DOM): waveform peaks, RMS loudness and tempo estimation.
 * Used at upload time (browser decodes any format it supports) and by the
 * Mixing Studio. Covered by tests/analysis.test.ts.
 */

export function mixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const n = channels[0].length;
  const out = new Float32Array(n);
  for (const ch of channels) for (let i = 0; i < n; i++) out[i] += ch[i] / channels.length;
  return out;
}

/** Peak envelope in `buckets` bins, normalized so the loudest bin is 1. */
export function computePeaks(samples: Float32Array, buckets = 120): number[] {
  const size = Math.max(1, Math.floor(samples.length / buckets));
  const peaks: number[] = [];
  let max = 0;
  for (let b = 0; b < buckets; b++) {
    let peak = 0;
    const end = Math.min(samples.length, (b + 1) * size);
    for (let i = b * size; i < end; i++) {
      const v = Math.abs(samples[i]);
      if (v > peak) peak = v;
    }
    peaks.push(peak);
    if (peak > max) max = peak;
  }
  return peaks.map((p) => (max > 0 ? Math.round((p / max) * 1000) / 1000 : 0));
}

/** Overall RMS level in dBFS (gated: silence below -60 dBFS is ignored). */
export function rmsDb(samples: Float32Array, block = 4096): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < samples.length; i += block) {
    let s = 0;
    const end = Math.min(samples.length, i + block);
    for (let j = i; j < end; j++) s += samples[j] * samples[j];
    const ms = s / (end - i);
    if (ms > 1e-6) {
      sum += ms;
      count++;
    }
  }
  if (!count) return -70;
  return 10 * Math.log10(sum / count);
}

/**
 * Tempo estimation: onset-strength envelope (spectral-flux-like energy
 * differences) → autocorrelation over 60–200 BPM → best lag, octave-folded
 * into a musical range. Analyzes at most `maxSeconds` from the middle.
 */
export function estimateBpm(samples: Float32Array, sampleRate: number, maxSeconds = 60): number | null {
  const len = Math.min(samples.length, Math.floor(maxSeconds * sampleRate));
  const start = Math.max(0, Math.floor((samples.length - len) / 2));
  const hop = 512;
  const frames = Math.floor(len / hop);
  if (frames < 64) return null;
  const env = new Float32Array(frames);
  let prev = 0;
  for (let f = 0; f < frames; f++) {
    let e = 0;
    const off = start + f * hop;
    for (let i = 0; i < hop; i++) {
      const v = samples[off + i] ?? 0;
      e += v * v;
    }
    e = Math.sqrt(e / hop);
    env[f] = Math.max(0, e - prev);
    prev = e;
  }
  // Remove DC
  const mean = env.reduce((a, b) => a + b, 0) / frames;
  for (let f = 0; f < frames; f++) env[f] -= mean;

  const fps = sampleRate / hop;
  const minLag = Math.floor((60 / 200) * fps);
  const maxLag = Math.ceil((60 / 60) * fps);
  let bestLag = 0;
  let best = -Infinity;
  const scores: number[] = [];
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let f = 0; f + lag < frames; f++) s += env[f] * env[f + lag];
    s /= frames - lag;
    scores[lag] = s;
    if (s > best) {
      best = s;
      bestLag = lag;
    }
  }
  if (!bestLag || best <= 0) return null;
  // Parabolic interpolation for sub-frame precision.
  const a = scores[bestLag - 1] ?? best;
  const c = scores[bestLag + 1] ?? best;
  const denom = a - 2 * best + c;
  const shift = denom ? (0.5 * (a - c)) / denom : 0;
  let bpm = (60 * fps) / (bestLag + shift);
  while (bpm < 70) bpm *= 2;
  while (bpm > 180) bpm /= 2;
  return Math.round(bpm * 10) / 10;
}

export type AudioAnalysis = { waveform: number[]; loudnessDb: number; bpm: number | null; duration: number };

export function analyzeChannels(channels: Float32Array[], sampleRate: number): AudioAnalysis {
  const mono = mixToMono(channels);
  return {
    waveform: computePeaks(mono, 120),
    loudnessDb: Math.round(rmsDb(mono) * 10) / 10,
    bpm: estimateBpm(mono, sampleRate),
    duration: mono.length / sampleRate,
  };
}
