import { Emitter } from "./emitter";
import { BASS_SHELF_HZ, dbToGain, DEFAULT_EQ, EQ_BANDS, EQ_Q, eqPeakDb, normalizeEq, TREBLE_SHELF_HZ, type EqSettings } from "./eq";

/**
 * AURALIS playback engine.
 *
 * Framework-agnostic: it knows nothing about React, tracks or queues — only
 * sources. Two HTMLAudioElement "slots" stream audio via HTTP Range requests;
 * both feed a Web Audio graph:
 *
 *   slotA ─ gainA ┐
 *                 ├─ preamp ─ 10×EQ ─ bass shelf ─ treble shelf ─ balance ─ limiter ─ master ─ analyser ─ out
 *   slotB ─ gainB ┘
 *
 * The idle slot preloads the next source, enabling near-gapless transitions
 * and equal-power crossfades. Per-slot gain also carries loudness normalization.
 * The preamp subtracts the EQ curve's peak boost (auto headroom) and a brickwall-ish
 * limiter catches what is left, so EQ boosts never clip into distortion.
 */

export type EngineStatus = "idle" | "loading" | "playing" | "paused" | "error";

export type EngineSnapshot = {
  status: EngineStatus;
  trackId: string | null;
  duration: number;
  volume: number;
  muted: boolean;
  rate: number;
};

type EngineEvents = {
  state: EngineSnapshot;
  /** The engine moved on to the preloaded next source (gapless or crossfade). */
  advance: { trackId: string | null };
  /** The current source finished and nothing was queued. */
  ended: { trackId: string | null };
  error: { trackId: string | null; message: string };
};

type Slot = {
  el: HTMLAudioElement;
  source: MediaElementAudioSourceNode | null;
  gain: GainNode | null;
  trackId: string | null;
  src: string | null;
  baseGain: number;
};

type NextSource = { src: string; trackId: string; gainDb: number };

export class AudioEngine {
  readonly events = new Emitter<EngineEvents>();

  private ctx: AudioContext | null = null;
  private slots: [Slot, Slot];
  private active = 0;
  private next: NextSource | null = null;
  private transitioning = false;
  private transitionTimer: ReturnType<typeof setTimeout> | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;

  private preamp: GainNode | null = null;
  private filters: BiquadFilterNode[] = [];
  private bassShelf: BiquadFilterNode | null = null;
  private trebleShelf: BiquadFilterNode | null = null;
  private panner: StereoPannerNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  private status: EngineStatus = "idle";
  private volume = 0.8;
  private muted = false;
  private rate = 1;
  private crossfadeSec = 0;
  private eq: EqSettings = DEFAULT_EQ;

  constructor() {
    this.slots = [this.createSlot(0), this.createSlot(1)];
  }

  // ───────────── setup ─────────────

  private createSlot(index: number): Slot {
    const el = new Audio();
    el.preload = "auto";
    el.crossOrigin = "use-credentials";
    const slot: Slot = { el, source: null, gain: null, trackId: null, src: null, baseGain: 1 };
    const isActive = () => this.active === index;
    el.addEventListener("playing", () => isActive() && this.setStatus("playing"));
    el.addEventListener("waiting", () => isActive() && this.setStatus("loading"));
    el.addEventListener("pause", () => {
      if (isActive() && !this.transitioning && !el.ended) this.setStatus("paused");
    });
    el.addEventListener("loadedmetadata", () => isActive() && this.emitState());
    el.addEventListener("durationchange", () => isActive() && this.emitState());
    el.addEventListener("ended", () => isActive() && this.onEnded());
    el.addEventListener("error", () => {
      if (!isActive() || !slot.src) return;
      this.setStatus("error");
      this.events.emit("error", { trackId: slot.trackId, message: el.error?.message || "Playback failed" });
    });
    return slot;
  }

  /** Lazily builds the Web Audio graph. Must run inside a user gesture the first time. */
  private ensureGraph() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx({ latencyHint: "playback" });
    this.ctx = ctx;

    this.preamp = ctx.createGain();
    this.filters = EQ_BANDS.map((freq, i) => {
      const f = ctx.createBiquadFilter();
      f.type = i === 0 ? "lowshelf" : i === EQ_BANDS.length - 1 ? "highshelf" : "peaking";
      f.frequency.value = freq;
      f.Q.value = EQ_Q;
      return f;
    });
    this.bassShelf = ctx.createBiquadFilter();
    this.bassShelf.type = "lowshelf";
    this.bassShelf.frequency.value = BASS_SHELF_HZ;
    this.trebleShelf = ctx.createBiquadFilter();
    this.trebleShelf.type = "highshelf";
    this.trebleShelf.frequency.value = TREBLE_SHELF_HZ;
    this.panner = ctx.createStereoPanner();
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.2;
    this.master = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    const chain: AudioNode[] = [this.preamp, ...this.filters, this.bassShelf, this.trebleShelf, this.panner, this.limiter, this.master, this.analyser];
    chain.reduce((a, b) => (a.connect(b), b));
    this.analyser.connect(ctx.destination);

    for (const slot of this.slots) {
      slot.source = ctx.createMediaElementSource(slot.el);
      slot.gain = ctx.createGain();
      slot.gain.gain.value = slot === this.slots[this.active] ? slot.baseGain : 0;
      slot.source.connect(slot.gain).connect(this.preamp);
    }
    this.applyEq();
    this.applyVolume();
  }

  // ───────────── transport ─────────────

  private get cur() {
    return this.slots[this.active];
  }
  private get idle() {
    return this.slots[1 - this.active];
  }

  /** Loads a source into the active slot, cancelling any transition in progress. */
  load(src: string, trackId: string, opts: { autoplay?: boolean; startAt?: number; gainDb?: number } = {}) {
    this.cancelTransition();
    const slot = this.cur;
    slot.trackId = trackId;
    slot.src = src;
    slot.baseGain = dbToGain(opts.gainDb ?? 0);
    if (slot.gain && this.ctx) slot.gain.gain.setValueAtTime(slot.baseGain, this.ctx.currentTime);
    slot.el.src = src;
    slot.el.playbackRate = this.rate;
    slot.el.preservesPitch = true;
    if (opts.startAt && opts.startAt > 0) {
      const t = opts.startAt;
      slot.el.addEventListener("loadedmetadata", () => (slot.el.currentTime = Math.min(t, slot.el.duration || t)), { once: true });
    }
    this.setStatus(opts.autoplay ? "loading" : "paused");
    if (opts.autoplay) void this.play();
    else this.emitState();
  }

  async play() {
    if (!this.cur.src) return;
    this.ensureGraph();
    try {
      await this.cur.el.play();
      this.startTicker();
    } catch (e) {
      if ((e as Error).name === "NotAllowedError") this.setStatus("paused");
      else if ((e as Error).name !== "AbortError") {
        this.setStatus("error");
        this.events.emit("error", { trackId: this.cur.trackId, message: (e as Error).message });
      }
    }
  }

  pause() {
    if (this.transitioning) this.finishTransition();
    this.cur.el.pause();
    this.stopTicker();
  }

  toggle() {
    if (this.cur.el.paused) void this.play();
    else this.pause();
  }

  seek(seconds: number) {
    if (this.transitioning) this.finishTransition();
    const el = this.cur.el;
    if (!Number.isFinite(el.duration)) return;
    el.currentTime = Math.max(0, Math.min(seconds, el.duration - 0.05));
  }

  stop() {
    this.cancelTransition();
    for (const s of this.slots) {
      s.el.pause();
      s.el.removeAttribute("src");
      s.el.load();
      s.src = null;
      s.trackId = null;
    }
    this.next = null;
    this.stopTicker();
    this.setStatus("idle");
  }

  get currentTime() {
    return this.cur.el.currentTime || 0;
  }
  get duration() {
    const d = this.cur.el.duration;
    return Number.isFinite(d) ? d : 0;
  }
  /** Seconds buffered ahead of the playhead's range end, for the seek bar. */
  get bufferedEnd() {
    const b = this.cur.el.buffered;
    const t = this.cur.el.currentTime;
    for (let i = 0; i < b.length; i++) if (b.start(i) <= t && b.end(i) >= t) return b.end(i);
    return b.length ? b.end(b.length - 1) : 0;
  }
  get paused() {
    return this.cur.el.paused;
  }

  // ───────────── next / gapless / crossfade ─────────────

  /** Declares what plays after the current source; preloads it into the idle slot. */
  setNext(next: NextSource | null) {
    if (this.transitioning) return; // the provider re-calls after "advance"
    this.next = next;
    const idle = this.idle;
    if (!next) return;
    if (idle.src !== next.src) {
      idle.el.src = next.src;
      idle.src = next.src;
      idle.el.preload = "auto";
      idle.el.load();
    }
    idle.trackId = next.trackId;
    idle.baseGain = dbToGain(next.gainDb);
  }

  setCrossfade(seconds: number) {
    this.crossfadeSec = Math.max(0, Math.min(12, seconds));
  }

  private onEnded() {
    if (this.transitioning) return;
    if (this.next) this.startTransition(0);
    else {
      this.stopTicker();
      this.setStatus("paused");
      this.events.emit("ended", { trackId: this.cur.trackId });
    }
  }

  private startTicker() {
    if (this.ticker) return;
    this.ticker = setInterval(() => {
      const el = this.cur.el;
      if (el.paused || this.transitioning || !this.next || this.crossfadeSec <= 0) return;
      const d = el.duration;
      if (!Number.isFinite(d) || d < this.crossfadeSec * 2 + 1) return;
      if (d - el.currentTime <= this.crossfadeSec) this.startTransition(this.crossfadeSec / this.rate);
    }, 100);
  }

  private stopTicker() {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
  }

  private startTransition(fadeSec: number) {
    const next = this.next;
    if (!next || !this.ctx) return;
    const from = this.cur;
    const to = this.idle;
    if (to.src !== next.src) {
      to.el.src = next.src;
      to.src = next.src;
    }
    to.trackId = next.trackId;
    to.baseGain = dbToGain(next.gainDb);
    to.el.currentTime = 0;
    to.el.playbackRate = this.rate;
    to.el.preservesPitch = true;
    this.next = null;

    const now = this.ctx.currentTime;
    if (fadeSec > 0) {
      this.transitioning = true;
      // Equal-power curves keep perceived loudness constant through the fade.
      const steps = 32;
      const outCurve = new Float32Array(steps);
      const inCurve = new Float32Array(steps);
      for (let i = 0; i < steps; i++) {
        const x = i / (steps - 1);
        outCurve[i] = Math.cos((x * Math.PI) / 2) * from.baseGain;
        inCurve[i] = Math.sin((x * Math.PI) / 2) * to.baseGain;
      }
      from.gain!.gain.cancelScheduledValues(now);
      to.gain!.gain.cancelScheduledValues(now);
      from.gain!.gain.setValueCurveAtTime(outCurve, now, fadeSec);
      to.gain!.gain.setValueCurveAtTime(inCurve, now, fadeSec);
      this.transitionTimer = setTimeout(() => this.finishTransition(), fadeSec * 1000 + 50);
    } else {
      from.gain!.gain.setValueAtTime(0, now);
      to.gain!.gain.setValueAtTime(to.baseGain, now);
      from.el.pause();
    }
    this.active = 1 - this.active;
    void to.el.play().catch(() => {});
    this.events.emit("advance", { trackId: to.trackId });
    this.emitState();
  }

  private finishTransition() {
    if (!this.transitioning) return;
    if (this.transitionTimer) clearTimeout(this.transitionTimer);
    this.transitionTimer = null;
    this.transitioning = false;
    const old = this.idle;
    old.el.pause();
    if (this.ctx) {
      const now = this.ctx.currentTime;
      old.gain?.gain.cancelScheduledValues(now);
      old.gain?.gain.setValueAtTime(0, now);
      this.cur.gain?.gain.cancelScheduledValues(now);
      this.cur.gain?.gain.setValueAtTime(this.cur.baseGain, now);
    }
  }

  private cancelTransition() {
    if (this.transitioning) this.finishTransition();
    const idle = this.idle;
    idle.el.pause();
    if (this.ctx && idle.gain) idle.gain.gain.setValueAtTime(0, this.ctx.currentTime);
  }

  // ───────────── sound shaping ─────────────

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyVolume();
    this.emitState();
  }
  setMuted(m: boolean) {
    this.muted = m;
    this.applyVolume();
    this.emitState();
  }
  private applyVolume() {
    // Perceptual (quadratic) volume curve.
    const g = this.muted ? 0 : this.volume * this.volume;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(g, this.ctx.currentTime, 0.015);
  }

  setRate(rate: number) {
    this.rate = Math.max(0.5, Math.min(2, rate));
    for (const s of this.slots) {
      s.el.playbackRate = this.rate;
      s.el.preservesPitch = true;
    }
    this.emitState();
  }

  /** Changes the normalization gain of the current source (e.g. toggled in settings). */
  setCurrentGainDb(db: number) {
    this.cur.baseGain = dbToGain(db);
    if (this.cur.gain && this.ctx && !this.transitioning) this.cur.gain.gain.setTargetAtTime(this.cur.baseGain, this.ctx.currentTime, 0.05);
  }

  setEq(settings: Partial<EqSettings>) {
    this.eq = normalizeEq({ ...this.eq, ...settings });
    this.applyEq();
  }
  getEq() {
    return this.eq;
  }
  private applyEq() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const on = this.eq.enabled;
    this.filters.forEach((f, i) => f.gain.setTargetAtTime(on ? this.eq.gains[i] : 0, t, 0.02));
    const headroom = on && this.eq.autoGain ? eqPeakDb(this.eq, this.ctx.sampleRate) : 0;
    this.preamp!.gain.setTargetAtTime(dbToGain(on ? this.eq.preamp - headroom : 0), t, 0.02);
    this.bassShelf!.gain.setTargetAtTime(on ? this.eq.bass : 0, t, 0.02);
    this.trebleShelf!.gain.setTargetAtTime(on ? this.eq.treble : 0, t, 0.02);
    this.panner!.pan.setTargetAtTime(this.eq.balance, t, 0.02);
  }

  /** Analyser for visualizers / spectrum analyzers (null until first playback). */
  getAnalyser() {
    return this.analyser;
  }

  // ───────────── state ─────────────

  private setStatus(s: EngineStatus) {
    if (this.status === s) return;
    this.status = s;
    this.emitState();
  }

  snapshot(): EngineSnapshot {
    return {
      status: this.status,
      trackId: this.cur.trackId,
      duration: this.duration,
      volume: this.volume,
      muted: this.muted,
      rate: this.rate,
    };
  }

  private emitState() {
    this.events.emit("state", this.snapshot());
  }

  destroy() {
    this.stop();
    this.events.clear();
    void this.ctx?.close();
  }
}
