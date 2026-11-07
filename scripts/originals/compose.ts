/**
 * Rule-based composer: chord progressions → voiced accompaniment (arpeggios,
 * waltz, block chords, pads, bass) and motif-based melodies that lean on chord
 * tones on strong beats and move by step elsewhere. Deterministic per seed.
 */
import { bell, bowed, celesta, pad, piano, reverb, master, rng, stereo, type Note, type Stereo, type StringVoice } from "./synth";

const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUALITY: Record<string, number[]> = {
  "": [0, 4, 7],
  m: [0, 3, 7],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  "7": [0, 4, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  "7sus4": [0, 5, 7, 10],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  m9: [0, 3, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  "6": [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
};

export type Chord = { root: number; tones: number[]; bass: number };

/** Parses "F#m7", "Cmaj7/E", "Bbadd9" → pitch classes. */
export function parseChord(sym: string): Chord {
  const m = /^([A-G])([#b]?)([a-z0-9]*)(?:\/([A-G])([#b]?))?$/.exec(sym);
  if (!m || !(m[3] in QUALITY)) throw new Error(`Unknown chord ${sym}`);
  const acc = (a: string) => (a === "#" ? 1 : a === "b" ? -1 : 0);
  const root = (NOTE[m[1]] + acc(m[2]) + 12) % 12;
  const tones = QUALITY[m[3]].map((i) => (root + i) % 12);
  const bass = m[4] ? (NOTE[m[4]] + acc(m[5]) + 12) % 12 : root;
  return { root, tones: [...new Set(tones)], bass };
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

export type Accomp = "arp" | "arp-slow" | "waltz" | "block" | "pulse" | "none";
export type Lead = "piano" | "violin" | "cello" | "viola" | "celesta";

export type Section = {
  bars: number;
  prog: string[];
  acc: Accomp;
  lead?: Lead;
  /** Lead register: lowest/highest MIDI note. */
  range?: [number, number];
  density?: "sparse" | "normal" | "flowing";
  pad?: boolean;
  bass?: "piano" | "cello" | null;
  sparkle?: "celesta" | "bell" | null;
  counter?: Lead | null;
  /** 0..1 loudness of the section. */
  dyn?: number;
};

export type TrackSpec = {
  slug: string;
  seed: number;
  key: string; // tonic, e.g. "D"
  mode: "major" | "minor";
  bpm: number;
  meter: 3 | 4;
  sections: Section[];
  reverb: { room: number; damp: number; wet: number };
  brightness?: number;
};

/** Picks the voicing (4 notes in [lo, hi]) closest to the previous one: smooth voice leading. */
function voice(chord: Chord, prev: number[] | null, lo = 52, hi = 72): number[] {
  const candidates: number[][] = [];
  const pcs = chord.tones.slice(0, 4);
  for (let base = lo - 12; base <= hi; base++) {
    if (base % 12 !== pcs[0]) continue;
    for (let inv = 0; inv < pcs.length; inv++) {
      const order = [...pcs.slice(inv), ...pcs.slice(0, inv)];
      const notes: number[] = [];
      let cur = base - 1;
      for (const pc of order) {
        let n = cur + 1;
        while (n % 12 !== pc) n++;
        notes.push(n);
        cur = n;
      }
      if (notes[0] >= lo && notes[notes.length - 1] <= hi) candidates.push(notes);
    }
  }
  if (!candidates.length) return pcs.map((pc) => 60 + pc);
  if (!prev) return candidates.sort((a, b) => Math.abs(avg(a) - 62) - Math.abs(avg(b) - 62))[0];
  const cost = (c: number[]) => c.reduce((s, n) => s + Math.min(...prev.map((p) => Math.abs(p - n))), 0);
  return candidates.sort((a, b) => cost(a) - cost(b))[0];
}
const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;

const RHYTHMS: Record<3 | 4, Record<string, number[][]>> = {
  4: {
    sparse: [[4], [3, 1], [2, 2], [2, 1, 1]],
    normal: [[2, 1, 1], [1, 1, 2], [1.5, 0.5, 2], [3, 1], [2, 2], [1, 0.5, 0.5, 2]],
    flowing: [[1, 1, 1, 1], [0.5, 0.5, 1, 2], [1, 0.5, 0.5, 1, 1], [1.5, 0.5, 1, 1], [2, 1, 1]],
  },
  3: {
    sparse: [[3], [2, 1]],
    normal: [[2, 1], [1, 1, 1], [1.5, 0.5, 1], [1, 2]],
    flowing: [[1, 1, 1], [0.5, 0.5, 1, 1], [1, 0.5, 0.5, 1]],
  },
};

type Ev = { beat: number; len: number; deg: number };

/**
 * Melody in scale degrees for `bars` bars (chords per bar), built from 4-bar
 * phrases: A, A' (repeats A's first half, new cadence), B, A''.
 */
function melody(spec: TrackSpec, sec: Section, chords: Chord[], r: () => number): Ev[] {
  const scale = spec.mode === "major" ? MAJOR : MINOR;
  const tonic = NOTE[spec.key[0]] + (spec.key[1] === "#" ? 1 : spec.key[1] === "b" ? -1 : 0);
  const [lo, hi] = sec.range ?? [64, 81];
  const degToMidi = (d: number) => {
    const oct = Math.floor(d / 7);
    return 12 + tonic + 12 * oct + scale[((d % 7) + 7) % 7];
  };
  const midiToDeg = (m: number) => {
    let best = 0;
    let bestDist = 1e9;
    for (let d = 0; d < 7 * 10; d++) {
      const dist = Math.abs(degToMidi(d) - m);
      if (dist < bestDist) [best, bestDist] = [d, dist];
    }
    return best;
  };
  const loD = midiToDeg(lo);
  const hiD = midiToDeg(hi);
  const isChordTone = (d: number, c: Chord) => c.tones.includes(((degToMidi(d) % 12) + 12) % 12);
  const nearestChordTone = (d: number, c: Chord) => {
    for (let off = 0; off < 4; off++) {
      if (d + off <= hiD && isChordTone(d + off, c)) return d + off;
      if (d - off >= loD && isChordTone(d - off, c)) return d - off;
    }
    return d;
  };
  const beatsPerBar = spec.meter;
  const pool = RHYTHMS[spec.meter][sec.density ?? "normal"];
  const sparse = RHYTHMS[spec.meter].sparse;

  const phrase = (startDeg: number, chordsOf: Chord[], cadence: boolean, reuse?: Ev[]): Ev[] => {
    const evs: Ev[] = [];
    let d = startDeg;
    for (let b = 0; b < chordsOf.length; b++) {
      const c = chordsOf[b];
      const reused = reuse?.filter((e) => Math.floor(e.beat / beatsPerBar) === b);
      if (reused && reused.length && b < 2) {
        for (const e of reused) {
          // Same rhythm and contour, re-fitted to this bar's chord on strong beats.
          const strong = e.beat % beatsPerBar === 0;
          evs.push({ ...e, deg: strong ? nearestChordTone(e.deg, c) : e.deg });
          d = e.deg;
        }
        continue;
      }
      const last = b === chordsOf.length - 1;
      const rhythm = last ? sparse[Math.floor(r() * sparse.length)] : pool[Math.floor(r() * pool.length)];
      let beat = 0;
      for (let i = 0; i < rhythm.length; i++) {
        const strong = beat === 0 || (beatsPerBar === 4 && beat === 2);
        if (i > 0 || b > 0) {
          const x = r();
          const step = x < 0.38 ? 1 : x < 0.76 ? -1 : x < 0.86 ? 2 : x < 0.96 ? -2 : r() < 0.5 ? 3 : -3;
          d += step;
        }
        // Gravity toward the middle of the range keeps lines singable.
        const mid = (loD + hiD) / 2;
        if (d > hiD - 1 || (d > mid + 3 && r() < 0.3)) d -= 2;
        if (d < loD + 1 || (d < mid - 3 && r() < 0.3)) d += 2;
        if (strong && r() < 0.8) d = nearestChordTone(d, c);
        if (cadence && last && i === rhythm.length - 1) d = nearestTonic(d);
        evs.push({ beat: b * beatsPerBar + beat, len: rhythm[i], deg: d });
        beat += rhythm[i];
      }
    }
    return evs;
  };
  const nearestTonic = (d: number) => {
    const down = d - (((d % 7) + 7) % 7);
    return Math.abs(down - d) <= 3 && down >= loD ? down : down + 7 <= hiD ? down + 7 : down;
  };

  const out: Ev[] = [];
  const startDeg = nearestChordTone(Math.round((loD + hiD) / 2), chords[0]);
  let A: Ev[] | null = null;
  for (let p = 0; p * 4 < chords.length; p++) {
    const cs = chords.slice(p * 4, p * 4 + 4);
    const kind = p % 4; // A, A', B, A''
    const lastPhrase = (p + 1) * 4 >= chords.length;
    let evs: Ev[];
    if (kind === 0 || !A) {
      evs = phrase(startDeg, cs, lastPhrase);
      A = evs;
    } else if (kind === 2) {
      evs = phrase(nearestChordTone(startDeg + 2, cs[0]), cs, lastPhrase);
    } else {
      evs = phrase(startDeg, cs, kind === 1 || lastPhrase, A);
    }
    for (const e of evs) out.push({ ...e, beat: e.beat + p * 4 * beatsPerBar });
  }
  return out.map((e) => ({ ...e, deg: degToMidi(e.deg) })); // deg now holds MIDI
}

/** Renders a full track to a mastered stereo buffer. */
export function renderTrack(spec: TrackSpec): Stereo {
  const r = rng(spec.seed);
  const beat = 60 / spec.bpm;
  const bar = beat * spec.meter;
  const totalBars = spec.sections.reduce((s, x) => s + x.bars, 0);
  const tail = 7;
  const out = stereo(totalBars * bar + tail);
  const hum = (t: number) => Math.max(0, t + (r() - 0.5) * 0.014);
  const v = (x: number) => Math.min(1, Math.max(0.05, x * (0.9 + r() * 0.2)));
  const lead = (inst: Lead, n: Note, pan: number) => {
    if (inst === "piano") piano(out, n, pan, spec.brightness ?? 0.5);
    else if (inst === "celesta") celesta(out, n, pan);
    else bowed(out, n, inst as StringVoice, pan, r);
  };

  let t0 = 0;
  let prevVoicing: number[] | null = null;
  for (let si = 0; si < spec.sections.length; si++) {
    const sec = spec.sections[si];
    const dyn = sec.dyn ?? 0.6;
    const chords = Array.from({ length: sec.bars }, (_, i) => parseChord(sec.prog[i % sec.prog.length]));
    const isLastSection = si === spec.sections.length - 1;

    for (let b = 0; b < sec.bars; b++) {
      const c = chords[b];
      const tb = t0 + b * bar;
      const voicing = voice(c, prevVoicing);
      prevVoicing = voicing;
      const bassNote = 36 + ((c.bass - 0 + 12) % 12) + (c.bass < 4 ? 12 : 0); // E1..D#3 region
      const finalBar = isLastSection && b === sec.bars - 1;

      // Accompaniment
      if (sec.acc === "arp" || sec.acc === "arp-slow") {
        const notes = [bassNote, bassNote + 7, ...voicing.slice(0, 3).map((n) => (n < bassNote + 12 ? n + 12 : n))];
        const pattern = spec.meter === 4 ? [0, 1, 2, 3, 4, 3, 2, 1] : [0, 1, 2, 3, 4, 3];
        const step = sec.acc === "arp" ? beat / 2 : beat;
        const count = sec.acc === "arp" ? pattern.length : spec.meter;
        for (let i = 0; i < (finalBar ? 1 : count); i++) {
          const t = tb + i * step;
          const pedalEnd = tb + (i < count / 2 ? bar / 2 : bar) + 0.05; // pedal changes at half bar
          piano(out, { t: hum(t), dur: finalBar ? bar * 2 : pedalEnd - t, midi: notes[pattern[i]], vel: v(dyn * (i === 0 ? 0.62 : 0.45)) }, -0.1, spec.brightness ?? 0.45);
        }
        if (finalBar) for (const n of voicing) piano(out, { t: hum(tb + 0.02), dur: bar * 2, midi: n, vel: v(dyn * 0.4) }, 0, 0.4);
      } else if (sec.acc === "waltz") {
        piano(out, { t: hum(tb), dur: bar, midi: bassNote, vel: v(dyn * 0.6) }, -0.2, 0.45);
        if (!finalBar) {
          for (const k of [1, 2]) for (const n of voicing.slice(0, 3)) piano(out, { t: hum(tb + k * beat), dur: beat * 0.9, midi: n, vel: v(dyn * 0.36) }, 0.1, 0.4);
        } else for (const n of voicing) piano(out, { t: hum(tb + beat * 0.02), dur: bar * 2, midi: n, vel: v(dyn * 0.4) }, 0, 0.4);
      } else if (sec.acc === "block") {
        for (const n of [bassNote, ...voicing]) piano(out, { t: hum(tb), dur: finalBar ? bar * 2 : bar, midi: n, vel: v(dyn * 0.42) }, 0, 0.35);
      } else if (sec.acc === "pulse") {
        for (let k = 0; k < spec.meter; k++) for (const n of voicing.slice(0, 3)) piano(out, { t: hum(tb + k * beat), dur: beat * 0.95, midi: n, vel: v(dyn * (k === 0 ? 0.4 : 0.3)) }, 0, 0.35);
      }

      if (sec.pad) for (const n of voicing) pad(out, { t: tb, dur: finalBar ? bar * 2 : bar + 0.05, midi: n, vel: dyn }, 0);
      if (sec.bass === "cello") bowed(out, { t: hum(tb), dur: finalBar ? bar * 2 : bar - 0.05, midi: bassNote + (bassNote < 40 ? 12 : 0), vel: v(dyn * 0.7) }, "cello", -0.35, r);
      if (sec.bass === "piano" && sec.acc !== "arp" && sec.acc !== "waltz") piano(out, { t: hum(tb), dur: bar, midi: bassNote, vel: v(dyn * 0.55) }, -0.2, 0.4);

      if (sec.sparkle && r() < 0.7) {
        const hits = sec.sparkle === "bell" ? 1 + Math.floor(r() * 2) : 2 + Math.floor(r() * 3);
        for (let h = 0; h < hits; h++) {
          const n = voicing[Math.floor(r() * voicing.length)] + 24;
          const at = tb + Math.floor(r() * spec.meter * 2) * (beat / 2);
          (sec.sparkle === "bell" ? bell : celesta)(out, { t: at, dur: 1, midi: n, vel: v(dyn * 0.5) }, (r() - 0.5) * 1.4);
        }
      }
    }

    // Lead melody
    if (sec.lead) {
      const evs = melody(spec, sec, chords, r);
      const legato = sec.lead === "violin" || sec.lead === "cello" || sec.lead === "viola";
      for (let i = 0; i < evs.length; i++) {
        const e = evs[i];
        const t = t0 + e.beat * beat;
        const dur = e.len * beat * (legato ? 1.04 : 1.6);
        const accent = e.beat % spec.meter === 0 ? 1 : 0.85;
        lead(sec.lead, { t: legato ? t : hum(t), dur, midi: e.deg, vel: v(dyn * 0.8 * accent) }, legato ? 0.15 : 0.05);
      }
      if (sec.counter) {
        // A slower counter-line a sixth below the lead, on long notes only.
        for (const e of evs) {
          if (e.len < 2) continue;
          const c = chords[Math.min(chords.length - 1, Math.floor(e.beat / spec.meter))];
          // Chord tone roughly a sixth below the lead.
          let m = e.deg - 7;
          while (!c.tones.includes(((m % 12) + 12) % 12) && m > e.deg - 12) m--;
          lead(sec.counter, { t: t0 + e.beat * beat + 0.03, dur: e.len * beat * 1.02, midi: m, vel: v(dyn * 0.45) }, -0.25);
        }
      }
    }
    t0 += sec.bars * bar;
  }

  const wet = reverb(out, spec.reverb);
  return master(wet, { targetRmsDb: -19, fadeIn: 0.6, fadeOut: 6 });
}
