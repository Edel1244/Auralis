import { Deck } from "./Deck";
import { crossfadeGains, syncRate } from "./math";

/**
 * Two-deck mixer: crossfader, master volume, master analyser and a
 * MediaRecorder tap for recording/exporting the live mix.
 */
export class Mixer {
  readonly ctx: AudioContext;
  readonly a: Deck;
  readonly b: Deck;
  readonly analyser: AnalyserNode;
  private master: GainNode;
  private recordDest: MediaStreamAudioDestinationNode;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  crossfader = 0;

  constructor() {
    this.ctx = new AudioContext({ latencyHint: "interactive" });
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.recordDest = this.ctx.createMediaStreamDestination();
    this.a = new Deck(this.ctx);
    this.b = new Deck(this.ctx);
    this.a.out.connect(this.master);
    this.b.out.connect(this.master);
    this.master.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.master.connect(this.recordDest);
    this.setCrossfader(0);
  }

  setCrossfader(x: number) {
    this.crossfader = x;
    const [ga, gb] = crossfadeGains(x);
    const t = this.ctx.currentTime;
    this.a.out.gain.setTargetAtTime(ga, t, 0.005);
    this.b.out.gain.setTargetAtTime(gb, t, 0.005);
  }

  setMasterVolume(v: number) {
    this.master.gain.setTargetAtTime(v * v, this.ctx.currentTime, 0.01);
  }

  /** Matches `slave`'s tempo to `master`'s effective BPM. Returns false if either BPM is unknown. */
  sync(slave: "a" | "b") {
    const s = slave === "a" ? this.a : this.b;
    const m = slave === "a" ? this.b : this.a;
    if (!s.state.bpm || !m.state.bpm) return false;
    s.setTempo(syncRate(m.state.bpm, m.state.tempo, s.state.bpm));
    return true;
  }

  get recording() {
    return this.recorder?.state === "recording";
  }

  startRecording() {
    if (this.recording) return;
    const type = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
    this.chunks = [];
    this.recorder = new MediaRecorder(this.recordDest.stream, type ? { mimeType: type, audioBitsPerSecond: 192_000 } : undefined);
    this.recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.recorder.start(1000);
  }

  stopRecording(): Promise<Blob | null> {
    const r = this.recorder;
    if (!r || r.state !== "recording") return Promise.resolve(null);
    return new Promise((resolve) => {
      r.onstop = () => resolve(new Blob(this.chunks, { type: r.mimeType || "audio/webm" }));
      r.stop();
    });
  }

  dispose() {
    if (this.recording) this.recorder!.stop();
    this.a.dispose();
    this.b.dispose();
    void this.ctx.close();
  }
}
