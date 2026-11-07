import { Emitter } from "../emitter";
import { computePeaks, estimateBpm, mixToMono } from "../analysis";
import { PitchShifter } from "./PitchShifter";
import { loopRegion } from "./math";

export type DeckTrack = { id: string; title: string; artistName: string; streamUrl: string; bpm: number | null; coverUrl: string | null };

export type DeckState = {
  track: DeckTrack | null;
  loading: boolean;
  error: string | null;
  playing: boolean;
  duration: number;
  bpm: number | null; // detected/original BPM
  tempo: number; // playback rate
  keyLock: boolean;
  pitch: number; // semitones
  volume: number; // channel fader 0..1
  trim: number; // dB
  eq: { low: number; mid: number; high: number }; // dB (-24 kill … +6)
  filter: number; // -1 low-pass … 0 off … 1 high-pass
  echo: number; // 0..1 wet
  cue: number; // seconds
  hotCues: (number | null)[];
  loop: { start: number; end: number; beats: number } | null;
  peaks: number[] | null;
};

/**
 * One DJ deck. Audio streams through an <audio> element (HTTP Range,
 * native time-stretching for key-lock), then through:
 * trim → 3-band EQ → filter → pitch shifter → fader → (crossfader, set by Mixer).
 * An echo send taps after the filter.
 */
export class Deck {
  readonly events = new Emitter<{ state: DeckState }>();
  readonly el: HTMLAudioElement;
  readonly out: GainNode; // to crossfader gain (owned by Mixer)
  private trimNode: GainNode;
  private low: BiquadFilterNode;
  private mid: BiquadFilterNode;
  private high: BiquadFilterNode;
  private filterNode: BiquadFilterNode;
  private shifter: PitchShifter;
  private fader: GainNode;
  private echoDelay: DelayNode;
  private echoFeedback: GainNode;
  private echoWet: GainNode;
  private loopTimer = 0;
  /** Fully decoded audio (for waveform, BPM and offline merge rendering). */
  buffer: AudioBuffer | null = null;
  private abort: AbortController | null = null;

  state: DeckState = {
    track: null,
    loading: false,
    error: null,
    playing: false,
    duration: 0,
    bpm: null,
    tempo: 1,
    keyLock: true,
    pitch: 0,
    volume: 0.85,
    trim: 0,
    eq: { low: 0, mid: 0, high: 0 },
    filter: 0,
    echo: 0,
    cue: 0,
    hotCues: [null, null, null, null],
    loop: null,
    peaks: null,
  };

  constructor(private ctx: AudioContext) {
    this.el = new Audio();
    this.el.preload = "auto";
    this.el.crossOrigin = "use-credentials";
    const src = ctx.createMediaElementSource(this.el);
    this.trimNode = ctx.createGain();
    this.low = Object.assign(ctx.createBiquadFilter(), { type: "lowshelf" as BiquadFilterType });
    this.low.frequency.value = 250;
    this.mid = Object.assign(ctx.createBiquadFilter(), { type: "peaking" as BiquadFilterType });
    this.mid.frequency.value = 1000;
    this.mid.Q.value = 0.8;
    this.high = Object.assign(ctx.createBiquadFilter(), { type: "highshelf" as BiquadFilterType });
    this.high.frequency.value = 4000;
    this.filterNode = ctx.createBiquadFilter();
    this.filterNode.type = "allpass";
    this.shifter = new PitchShifter(ctx);
    this.fader = ctx.createGain();
    this.out = ctx.createGain();
    this.echoDelay = ctx.createDelay(4);
    this.echoFeedback = ctx.createGain();
    this.echoWet = ctx.createGain();
    this.echoWet.gain.value = 0;
    this.echoFeedback.gain.value = 0.45;

    src.connect(this.trimNode).connect(this.low).connect(this.mid).connect(this.high).connect(this.filterNode).connect(this.shifter.input);
    this.shifter.output.connect(this.fader).connect(this.out);
    // Echo send (post-filter, pre-fader so it follows the channel fader below)
    this.filterNode.connect(this.echoDelay);
    this.echoDelay.connect(this.echoFeedback).connect(this.echoDelay);
    this.echoDelay.connect(this.echoWet).connect(this.shifter.input);

    this.fader.gain.value = this.state.volume;
    this.el.addEventListener("ended", () => this.patch({ playing: false }));
    this.el.addEventListener("pause", () => this.patch({ playing: false }));
    this.el.addEventListener("play", () => this.patch({ playing: true }));
    this.el.addEventListener("loadedmetadata", () => this.patch({ duration: this.el.duration || 0 }));
    this.el.addEventListener("error", () => this.state.track && this.patch({ error: "Could not load audio", loading: false }));
  }

  private patch(p: Partial<DeckState>) {
    this.state = { ...this.state, ...p };
    this.events.emit("state", this.state);
  }

  get position() {
    return this.el.currentTime || 0;
  }

  /** Loads a track; decodes it in the background for a detailed waveform and BPM. */
  async load(track: DeckTrack) {
    this.abort?.abort();
    this.abort = new AbortController();
    this.el.pause();
    this.buffer = null;
    this.patch({ track, loading: true, error: null, peaks: null, bpm: track.bpm, cue: 0, loop: null, hotCues: [null, null, null, null], duration: 0 });
    this.el.src = track.streamUrl;
    this.el.preservesPitch = this.state.keyLock;
    this.el.playbackRate = this.state.tempo;
    try {
      const res = await fetch(track.streamUrl, { credentials: "same-origin", signal: this.abort.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const audio = await this.ctx.decodeAudioData(await res.arrayBuffer());
      this.buffer = audio;
      const ch = Array.from({ length: Math.min(2, audio.numberOfChannels) }, (_, i) => audio.getChannelData(i));
      const mono = mixToMono(ch);
      const bpm = track.bpm ?? estimateBpm(mono, audio.sampleRate);
      this.patch({ peaks: computePeaks(mono, 600), bpm, duration: audio.duration, loading: false });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      // Playback can still work through the element even if analysis failed.
      this.patch({ loading: false });
    }
  }

  async play() {
    if (!this.state.track) return;
    if (this.ctx.state === "suspended") await this.ctx.resume();
    await this.el.play().catch((e) => this.patch({ error: (e as Error).message }));
    this.watchLoop();
  }
  pause() {
    this.el.pause();
  }
  toggle() {
    return this.el.paused ? this.play() : this.pause();
  }
  seek(t: number) {
    this.el.currentTime = Math.max(0, Math.min(t, (this.state.duration || this.el.duration || 0) - 0.01));
  }

  /** CDJ-style cue: when paused, sets the cue at the playhead; when playing, returns to it and pauses. */
  cue() {
    if (this.el.paused) this.patch({ cue: this.position });
    else {
      this.pause();
      this.seek(this.state.cue);
    }
  }
  setHotCue(i: number) {
    const hc = [...this.state.hotCues];
    if (hc[i] === null) {
      hc[i] = this.position;
      this.patch({ hotCues: hc });
    } else this.seek(hc[i]!);
  }
  clearHotCue(i: number) {
    const hc = [...this.state.hotCues];
    hc[i] = null;
    this.patch({ hotCues: hc });
  }

  /** Beat loop from the playhead (needs a BPM); null exits the loop. */
  setLoop(beats: number | null) {
    if (!beats || !this.state.bpm) return this.patch({ loop: null });
    const r = loopRegion(this.position, this.state.bpm, beats, this.state.duration || this.el.duration);
    this.patch({ loop: { ...r, beats } });
    this.watchLoop();
  }

  private watchLoop() {
    cancelAnimationFrame(this.loopTimer);
    const tick = () => {
      const l = this.state.loop;
      if (l && this.el.currentTime >= l.end) this.el.currentTime = l.start + (this.el.currentTime - l.end);
      if (!this.el.paused && this.state.loop) this.loopTimer = requestAnimationFrame(tick);
    };
    this.loopTimer = requestAnimationFrame(tick);
  }

  setTempo(rate: number) {
    const r = Math.max(0.5, Math.min(2, rate));
    this.el.playbackRate = r;
    this.patch({ tempo: r });
  }
  /** Temporary pitch-bend for manual beat matching (nudge). */
  nudge(amount: number) {
    this.el.playbackRate = this.state.tempo * (1 + amount);
  }
  releaseNudge() {
    this.el.playbackRate = this.state.tempo;
  }
  setKeyLock(on: boolean) {
    this.el.preservesPitch = on;
    this.patch({ keyLock: on });
  }
  setPitch(semitones: number) {
    const s = Math.max(-12, Math.min(12, Math.round(semitones)));
    this.shifter.setSemitones(s);
    this.patch({ pitch: s });
  }
  /** Relative pitch change based on the deck's current state (safe for rapid clicks). */
  shiftPitch(delta: number) {
    this.setPitch(this.state.pitch + delta);
  }
  setVolume(v: number) {
    this.fader.gain.setTargetAtTime(v * v, this.ctx.currentTime, 0.01);
    this.patch({ volume: v });
  }
  setTrim(db: number) {
    this.trimNode.gain.setTargetAtTime(Math.pow(10, db / 20), this.ctx.currentTime, 0.01);
    this.patch({ trim: db });
  }
  setEq(band: "low" | "mid" | "high", db: number) {
    const node = band === "low" ? this.low : band === "mid" ? this.mid : this.high;
    node.gain.setTargetAtTime(db, this.ctx.currentTime, 0.01);
    this.patch({ eq: { ...this.state.eq, [band]: db } });
  }
  /** One-knob DJ filter: left = low-pass sweep, right = high-pass sweep. */
  setFilter(v: number) {
    const f = this.filterNode;
    const t = this.ctx.currentTime;
    if (Math.abs(v) < 0.02) f.type = "allpass";
    else if (v < 0) {
      f.type = "lowpass";
      f.frequency.setTargetAtTime(20000 * Math.pow(200 / 20000, -v), t, 0.01);
      f.Q.value = 1;
    } else {
      f.type = "highpass";
      f.frequency.setTargetAtTime(20 * Math.pow(6000 / 20, v), t, 0.01);
      f.Q.value = 1;
    }
    this.patch({ filter: v });
  }
  /** Beat-synced echo (3/4 beat delay when BPM is known). */
  setEcho(wet: number) {
    const beat = this.state.bpm ? 60 / (this.state.bpm * this.state.tempo) : 0.375;
    this.echoDelay.delayTime.setTargetAtTime(Math.min(3.9, beat * 0.75), this.ctx.currentTime, 0.02);
    this.echoWet.gain.setTargetAtTime(wet * 0.8, this.ctx.currentTime, 0.02);
    this.patch({ echo: wet });
  }

  /** Restores a saved deck setup (mix sessions). */
  applySettings(s: Partial<Pick<DeckState, "tempo" | "keyLock" | "pitch" | "volume" | "trim" | "eq" | "filter" | "echo" | "cue" | "hotCues">>) {
    if (s.tempo !== undefined) this.setTempo(s.tempo);
    if (s.keyLock !== undefined) this.setKeyLock(s.keyLock);
    if (s.pitch !== undefined) this.setPitch(s.pitch);
    if (s.volume !== undefined) this.setVolume(s.volume);
    if (s.trim !== undefined) this.setTrim(s.trim);
    if (s.eq) (["low", "mid", "high"] as const).forEach((b) => this.setEq(b, s.eq![b]));
    if (s.filter !== undefined) this.setFilter(s.filter);
    if (s.echo !== undefined) this.setEcho(s.echo);
    if (s.cue !== undefined) this.patch({ cue: s.cue });
    if (s.hotCues) this.patch({ hotCues: s.hotCues });
  }

  dispose() {
    this.abort?.abort();
    this.buffer = null;
    cancelAnimationFrame(this.loopTimer);
    this.el.pause();
    this.el.removeAttribute("src");
    this.shifter.dispose();
    this.events.clear();
  }
}
