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
  presetId: string | null;
};

export const DEFAULT_EQ: EqSettings = {
  enabled: true,
  gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  preamp: 0,
  bass: 0,
  treble: 0,
  balance: 0,
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
