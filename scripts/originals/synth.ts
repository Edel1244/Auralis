/**
 * Tiny offline synthesizer for the "AURALIS Originals" catalog.
 * Pure TypeScript, no dependencies: additive piano, bowed strings, string pad,
 * celesta/bell, Freeverb-style reverb and a gentle master stage.
 * Everything is deterministic for a given seed.
 */

export const SR = 44100;

export type Stereo = { L: Float32Array; R: Float32Array };

export const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export function stereo(seconds: number): Stereo {
  const n = Math.ceil(seconds * SR);
  return { L: new Float32Array(n), R: new Float32Array(n) };
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Equal-power pan gains, pan in [-1, 1]. */
const panGains = (pan: number): [number, number] => {
  const p = (Math.max(-1, Math.min(1, pan)) + 1) * (Math.PI / 4);
  return [Math.cos(p), Math.sin(p)];
};

/**
 * Adds a fixed-frequency sine partial with an envelope function using a
 * rotating phasor (no Math.sin per sample).
 */
function addPartial(out: Stereo, start: number, len: number, freq: number, amp: number, gl: number, gr: number, env: (i: number) => number) {
  if (freq >= SR / 2 - 200 || amp <= 0) return;
  const w = (2 * Math.PI * freq) / SR;
  const c = Math.cos(w);
  const s = Math.sin(w);
  let x = 1; // phase 0 (deterministic)
  let y = 0;
  const end = Math.min(out.L.length, start + len);
  for (let i = Math.max(0, start); i < end; i++) {
    const k = i - start;
    const v = y * amp * env(k);
    out.L[i] += v * gl;
    out.R[i] += v * gr;
    const nx = x * c - y * s;
    y = x * s + y * c;
    x = nx;
    // Renormalize occasionally to stop amplitude drift.
    if ((k & 1023) === 0) {
      const m = 1 / Math.sqrt(x * x + y * y);
      x *= m;
      y *= m;
    }
  }
}

export type Note = { t: number; dur: number; midi: number; vel: number };

/** Felt-ish grand piano: inharmonic partials, two detuned strings, pitch-dependent decay, damper release. */
export function piano(out: Stereo, n: Note, pan = 0, brightness = 0.5) {
  const f0 = mtof(n.midi);
  const [gl, gr] = panGains(pan + (n.midi - 60) / 80); // low notes left, high right, like a real piano
  const start = Math.round(n.t * SR);
  const t60 = Math.max(1.2, 9 * Math.pow(2, -(n.midi - 45) / 16)); // low notes ring longer
  const release = 0.18 + Math.max(0, (60 - n.midi) / 200);
  const ring = Math.min(n.dur + release * 4, t60);
  const len = Math.round(ring * SR);
  const offAt = Math.round(n.dur * SR);
  const B = 0.00012 + Math.max(0, n.midi - 60) * 0.000006;
  const strike = 0.12;
  const tilt = 1.6 - 0.7 * brightness * n.vel;
  const vel = Math.pow(n.vel, 1.4) * 0.22;
  for (let k = 1; k <= 16; k++) {
    const fk = k * f0 * Math.sqrt(1 + B * k * k);
    if (fk > 11000) break;
    const comb = Math.abs(Math.sin(Math.PI * k * strike)) / Math.sin(Math.PI * strike);
    const a = (vel * comb) / Math.pow(k, tilt);
    const tauK = t60 / 6.9 / (1 + 0.45 * (k - 1));
    const tauFast = tauK * 0.25;
    const relTau = release * SR;
    const env = (i: number) => {
      const t = i / SR;
      const attack = i < 132 ? i / 132 : 1; // ~3 ms
      let e = attack * (0.55 * Math.exp(-t / tauFast) + 0.45 * Math.exp(-t / tauK));
      if (i > offAt) e *= Math.exp(-(i - offAt) / relTau);
      return e;
    };
    // Two unison strings ±0.7 cent give the slow piano "bloom".
    addPartial(out, start, len, fk * 1.0004, a * 0.5, gl, gr, env);
    addPartial(out, start, len, fk * 0.9996, a * 0.5, gl, gr, env);
  }
}

/** Gaussian bump on a log-frequency axis (body resonance). */
const bump = (f: number, center: number, width: number) => Math.exp(-Math.pow(Math.log2(f / center) / width, 2));

export type StringVoice = "violin" | "cello" | "viola";

/** Expressive bowed string: harmonic-rich tone shaped by body resonances, delayed vibrato, bow swell. */
export function bowed(out: Stereo, n: Note, voice: StringVoice, pan: number, r: () => number) {
  const f0 = mtof(n.midi);
  const [gl, gr] = panGains(pan);
  const start = Math.round(n.t * SR);
  const attack = voice === "cello" ? 0.22 : 0.16;
  const release = 0.35;
  const len = Math.round((n.dur + release) * SR);
  const res =
    voice === "violin" ? [[290, 0.5, 0.8], [520, 0.6, 0.6], [1250, 0.7, 0.7], [2800, 0.8, 0.9]] :
    voice === "viola" ? [[230, 0.5, 0.8], [420, 0.6, 0.7], [1000, 0.7, 0.6], [2300, 0.8, 0.6]] :
    [[110, 0.5, 0.9], [220, 0.6, 0.8], [600, 0.7, 0.6], [1500, 0.8, 0.5]];
  const partials: { k: number; a: number }[] = [];
  for (let k = 1; k <= 24; k++) {
    const f = k * f0;
    if (f > 9000) break;
    let body = 0.25;
    for (const [c, w, g] of res) body += g * bump(f, c, w);
    partials.push({ k, a: (body / Math.pow(k, 0.95)) * (f > 4000 ? Math.pow(4000 / f, 2) : 1) });
  }
  const norm = 0.11 * n.vel / Math.sqrt(partials.reduce((s, p) => s + p.a * p.a, 0));
  const vibRate = 5.0 + r() * 0.8;
  const vibDepth = voice === "cello" ? 0.0035 : 0.005; // ~6–9 cents
  const vibPhase0 = r() * Math.PI * 2;
  const phases = new Float64Array(partials.length);
  const end = Math.min(out.L.length, start + len);
  const offAt = n.dur * SR;
  for (let i = Math.max(0, start); i < end; i++) {
    const k = i - start;
    const t = k / SR;
    const vibOn = Math.min(1, Math.max(0, (t - 0.25) / 0.4));
    const f = f0 * (1 + vibDepth * vibOn * Math.sin(vibPhase0 + 2 * Math.PI * vibRate * t));
    // Bow: soft attack, slight swell to the middle of the note, release tail.
    let e = Math.min(1, t / attack);
    e *= 0.85 + 0.15 * Math.sin(Math.PI * Math.min(1, t / Math.max(0.3, n.dur)));
    if (k > offAt) e *= Math.exp(-(k - offAt) / (release * SR * 0.35));
    let v = 0;
    const dphi = (2 * Math.PI * f) / SR;
    for (let p = 0; p < partials.length; p++) {
      phases[p] += dphi * partials[p].k;
      v += partials[p].a * Math.sin(phases[p]);
    }
    v *= e * norm;
    out.L[i] += v * gl;
    out.R[i] += v * gr;
  }
}

/** Warm string-ensemble pad: three detuned voices, slow attack and release. */
export function pad(out: Stereo, n: Note, pan = 0, warmth = 1.7) {
  const f0 = mtof(n.midi);
  const start = Math.round(n.t * SR);
  const atk = 1.4 * SR;
  const rel = 1.8 * SR;
  const len = Math.round(n.dur * SR + rel);
  const offAt = n.dur * SR;
  const env = (i: number) => {
    let e = i < atk ? 0.5 - 0.5 * Math.cos((Math.PI * i) / atk) : 1;
    if (i > offAt) e *= Math.exp(-(i - offAt) / (rel * 0.3));
    return e;
  };
  const voices: [number, number][] = [[1, pan], [1.0035, pan - 0.5], [0.9965, pan + 0.5]];
  for (const [det, p] of voices) {
    const [gl, gr] = panGains(p);
    for (let k = 1; k <= 10; k++) {
      const f = k * f0 * det;
      if (f > 6000) break;
      addPartial(out, start, len, f, (0.018 * n.vel) / Math.pow(k, warmth), gl, gr, env);
    }
  }
}

/** Celesta / music-box tone: bright, quick decay, gently inharmonic upper partials. */
export function celesta(out: Stereo, n: Note, pan = 0) {
  const f0 = mtof(n.midi);
  const [gl, gr] = panGains(pan);
  const start = Math.round(n.t * SR);
  const len = Math.round(3.2 * SR);
  const parts: [number, number, number][] = [[1, 1, 1.4], [2, 0.32, 0.7], [3.01, 0.12, 0.45], [4.16, 0.07, 0.3], [5.43, 0.03, 0.2]];
  for (const [ratio, amp, tau] of parts) {
    const env = (i: number) => (i < 44 ? i / 44 : 1) * Math.exp(-i / (tau * SR));
    addPartial(out, start, len, f0 * ratio, 0.07 * n.vel * amp, gl, gr, env);
  }
}

/** Soft glass/bell shimmer for ambient pieces. */
export function bell(out: Stereo, n: Note, pan = 0) {
  const f0 = mtof(n.midi);
  const [gl, gr] = panGains(pan);
  const start = Math.round(n.t * SR);
  const len = Math.round(6 * SR);
  const parts: [number, number, number][] = [[1, 1, 3.5], [2.0, 0.5, 2.4], [2.76, 0.25, 1.6], [5.4, 0.1, 0.9], [8.93, 0.04, 0.5]];
  for (const [ratio, amp, tau] of parts) {
    const env = (i: number) => (i < 220 ? i / 220 : 1) * Math.exp(-i / (tau * SR));
    addPartial(out, start, len, f0 * ratio, 0.045 * n.vel * amp, gl, gr, env);
  }
}

// ───────────── reverb (Freeverb) ─────────────

class Comb {
  private buf: Float32Array;
  private idx = 0;
  private store = 0;
  constructor(size: number, private feedback: number, private damp: number) {
    this.buf = new Float32Array(size);
  }
  process(x: number) {
    const y = this.buf[this.idx];
    this.store = y * (1 - this.damp) + this.store * this.damp;
    this.buf[this.idx] = x + this.store * this.feedback;
    if (++this.idx >= this.buf.length) this.idx = 0;
    return y;
  }
}

class Allpass {
  private buf: Float32Array;
  private idx = 0;
  constructor(size: number) {
    this.buf = new Float32Array(size);
  }
  process(x: number) {
    const b = this.buf[this.idx];
    const y = -x + b;
    this.buf[this.idx] = x + b * 0.5;
    if (++this.idx >= this.buf.length) this.idx = 0;
    return y;
  }
}

/** Stereo Freeverb. room 0..1 (size), damp 0..1, wet/dry mix. Pre-delay in seconds. */
export function reverb(dry: Stereo, opts: { room?: number; damp?: number; wet?: number; predelay?: number } = {}): Stereo {
  const room = 0.7 + 0.28 * (opts.room ?? 0.8);
  const damp = 0.4 * (opts.damp ?? 0.5);
  const wet = opts.wet ?? 0.32;
  const pre = Math.round((opts.predelay ?? 0.02) * SR);
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const aps = [556, 441, 341, 225];
  const spread = 23;
  const cl = combs.map((s) => new Comb(s, room, damp));
  const cr = combs.map((s) => new Comb(s + spread, room, damp));
  const al = aps.map((s) => new Allpass(s));
  const ar = aps.map((s) => new Allpass(s + spread));
  const n = dry.L.length;
  const out = { L: new Float32Array(n), R: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    const j = i - pre;
    const x = j >= 0 ? (dry.L[j] + dry.R[j]) * 0.015 : 0;
    let l = 0;
    let r = 0;
    for (let c = 0; c < 8; c++) {
      l += cl[c].process(x);
      r += cr[c].process(x);
    }
    for (let a = 0; a < 4; a++) {
      l = al[a].process(l);
      r = ar[a].process(r);
    }
    out.L[i] = dry.L[i] * (1 - wet * 0.5) + l * wet * 3;
    out.R[i] = dry.R[i] * (1 - wet * 0.5) + r * wet * 3;
  }
  return out;
}

/** Master: DC-safe gain to a target RMS, soft limiting, fades. */
export function master(buf: Stereo, opts: { targetRmsDb?: number; fadeIn?: number; fadeOut?: number } = {}) {
  const n = buf.L.length;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += buf.L[i] * buf.L[i] + buf.R[i] * buf.R[i];
  const rms = Math.sqrt(sum / (2 * n)) || 1e-9;
  const gain = Math.pow(10, (opts.targetRmsDb ?? -19) / 20) / rms;
  const fi = (opts.fadeIn ?? 1.5) * SR;
  const fo = (opts.fadeOut ?? 5) * SR;
  const soft = (x: number) => (Math.abs(x) < 0.7 ? x : Math.sign(x) * (0.7 + 0.29 * Math.tanh((Math.abs(x) - 0.7) / 0.29)));
  for (let i = 0; i < n; i++) {
    let g = gain;
    if (i < fi) g *= i / fi;
    if (i > n - fo) g *= Math.max(0, (n - i) / fo);
    buf.L[i] = soft(buf.L[i] * g);
    buf.R[i] = soft(buf.R[i] * g);
  }
  return buf;
}
