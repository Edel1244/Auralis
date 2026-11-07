/** ISO-style 10-band graphic EQ center frequencies (Hz). */
export const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;
export const EQ_MIN_DB = -12;
export const EQ_MAX_DB = 12;

export type EqSettings = {
  enabled: boolean;
  gains: number[]; // 10 values in dB
  preamp: number; // dB
  bass: number; // extra low-shelf boost, 0..12 dB
  treble: number; // high-shelf, -12..12 dB
  balance: number; // -1 (left) .. 1 (right)
  /** Lower the input gain by the curve's peak boost so boosting never clips. */
  autoGain: boolean;
  presetId: string | null;
};

export const DEFAULT_EQ: EqSettings = {
  enabled: true,
  gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  preamp: 0,
  bass: 0,
  treble: 0,
  balance: 0,
  autoGain: true,
  presetId: "flat",
};

export const EQ_PRESETS: { id: string; name: string; gains: number[] }[] = [
  { id: "flat", name: "Flat", gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: "bass", name: "Bass Booster", gains: [6, 5, 4, 2.5, 1, 0, 0, 0, 0, 0] },
  { id: "treble", name: "Treble Booster", gains: [0, 0, 0, 0, 0, 1, 2.5, 4, 5, 6] },
  { id: "vocal", name: "Vocal", gains: [-2, -2, -1, 1, 3, 4, 3, 1.5, 0, -1] },
  { id: "electronic", name: "Electronic", gains: [5, 4, 1.5, 0, -2, 1.5, 1, 1.5, 4, 5] },
  { id: "rock", name: "Rock", gains: [5, 4, 3, 1.5, -0.5, -1, 0.5, 2.5, 3.5, 4.5] },
  { id: "hiphop", name: "Hip-Hop", gains: [5, 4.5, 1.5, 3, -1, -1, 1.5, -0.5, 2, 3] },
  { id: "jazz", name: "Jazz", gains: [4, 3, 1.5, 2, -1.5, -1.5, 0, 1.5, 3, 4] },
  { id: "classical", name: "Classical", gains: [4.5, 3.5, 3, 2.5, -1.5, -1.5, 0, 2, 3, 4] },
  { id: "acoustic", name: "Acoustic", gains: [4.5, 4.5, 3.5, 1, 2, 1.5, 3.5, 4, 3.5, 2] },
  { id: "loudness", name: "Loudness", gains: [6, 4, 0, 0, -2, 0, -1, -5, 5, 1] },
  { id: "night", name: "Late Night", gains: [3, 2.5, 1.5, 0.5, 0, -0.5, -1, -2, -3, -4] },
];

export function clampDb(v: number, min = EQ_MIN_DB, max = EQ_MAX_DB) {
  return Math.min(max, Math.max(min, Number.isFinite(v) ? v : 0));
}

export function normalizeEq(input: unknown): EqSettings {
  const i = (input ?? {}) as Partial<EqSettings>;
  const gains = Array.isArray(i.gains) && i.gains.length === 10 ? i.gains.map((g) => clampDb(Number(g))) : DEFAULT_EQ.gains;
  return {
    enabled: typeof i.enabled === "boolean" ? i.enabled : DEFAULT_EQ.enabled,
    gains,
    preamp: clampDb(Number(i.preamp ?? 0)),
    bass: clampDb(Number(i.bass ?? 0), 0, 12),
    treble: clampDb(Number(i.treble ?? 0)),
    balance: Math.min(1, Math.max(-1, Number(i.balance ?? 0) || 0)),
    autoGain: typeof i.autoGain === "boolean" ? i.autoGain : DEFAULT_EQ.autoGain,
    presetId: typeof i.presetId === "string" ? i.presetId : null,
  };
}

/** Converts dB to linear gain. */
export const dbToGain = (db: number) => Math.pow(10, db / 20);

/** Loudness normalization: target ≈ -14 dBFS RMS, clamped to avoid big boosts. */
export function normalizationGainDb(loudnessDb: number | null | undefined, target = -14) {
  if (loudnessDb == null || !Number.isFinite(loudnessDb)) return 0;
  return Math.min(6, Math.max(-12, target - loudnessDb));
}

// ───────────── frequency response (RBJ cookbook, same formulas as Web Audio BiquadFilterNode) ─────────────

type BiquadKind = "lowshelf" | "highshelf" | "peaking";

/** Magnitude (dB) of one Web Audio biquad at frequency `f`. */
export function biquadMagnitudeDb(kind: BiquadKind, f0: number, gainDb: number, q: number, f: number, sampleRate = 48000) {
  if (gainDb === 0) return 0;
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * f0) / sampleRate;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
  if (kind === "peaking") {
    const alpha = sin / (2 * q);
    b0 = 1 + alpha * A; b1 = -2 * cos; b2 = 1 - alpha * A;
    a0 = 1 + alpha / A; a1 = -2 * cos; a2 = 1 - alpha / A;
  } else {
    // Web Audio shelves use a fixed slope S = 1 (Q is ignored).
    const alpha = (sin / 2) * Math.sqrt(2);
    const s = 2 * Math.sqrt(A) * alpha;
    if (kind === "lowshelf") {
      b0 = A * (A + 1 - (A - 1) * cos + s); b1 = 2 * A * (A - 1 - (A + 1) * cos); b2 = A * (A + 1 - (A - 1) * cos - s);
      a0 = A + 1 + (A - 1) * cos + s; a1 = -2 * (A - 1 + (A + 1) * cos); a2 = A + 1 + (A - 1) * cos - s;
    } else {
      b0 = A * (A + 1 + (A - 1) * cos + s); b1 = -2 * A * (A - 1 + (A + 1) * cos); b2 = A * (A + 1 + (A - 1) * cos - s);
      a0 = A + 1 - (A - 1) * cos + s; a1 = 2 * (A - 1 - (A + 1) * cos); a2 = A + 1 - (A - 1) * cos - s;
    }
  }
  const w = (2 * Math.PI * f) / sampleRate;
  const c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
  const nr = b0 + b1 * c1 + b2 * c2, ni = -(b1 * s1 + b2 * s2);
  const dr = a0 + a1 * c1 + a2 * c2, di = -(a1 * s1 + a2 * s2);
  return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
}

export const EQ_Q = 1.1;
export const BASS_SHELF_HZ = 110;
export const TREBLE_SHELF_HZ = 7000;

/** Combined EQ curve (dB, excluding preamp) at frequency `f`, mirroring the engine's filter chain. */
export function eqResponseDb(eq: EqSettings, f: number, sampleRate = 48000) {
  if (!eq.enabled) return 0;
  let db = 0;
  EQ_BANDS.forEach((f0, i) => {
    const kind: BiquadKind = i === 0 ? "lowshelf" : i === EQ_BANDS.length - 1 ? "highshelf" : "peaking";
    db += biquadMagnitudeDb(kind, f0, eq.gains[i], EQ_Q, f, sampleRate);
  });
  db += biquadMagnitudeDb("lowshelf", BASS_SHELF_HZ, eq.bass, EQ_Q, f, sampleRate);
  db += biquadMagnitudeDb("highshelf", TREBLE_SHELF_HZ, eq.treble, EQ_Q, f, sampleRate);
  return db;
}

/** Log-spaced frequencies across the audible range, for curves and peak search. */
export function logFrequencies(n = 120, min = 20, max = 20000) {
  return Array.from({ length: n }, (_, i) => min * Math.pow(max / min, i / (n - 1)));
}

/**
 * Highest boost (dB) of the EQ curve across the audible range. Stacked boosts
 * push full-scale audio past 0 dBFS and clip; the engine lowers its input gain
 * by this amount ("auto headroom") so boosting never distorts.
 */
export function eqPeakDb(eq: EqSettings, sampleRate = 48000) {
  if (!eq.enabled) return 0;
  return Math.max(0, ...logFrequencies(160).map((f) => eqResponseDb(eq, f, sampleRate)));
}
