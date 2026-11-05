import { pitchShiftSweep } from "./math";

const PERIOD = 0.1; // seconds per grain sweep

/**
 * Real-time pitch shifter built only from standard Web Audio nodes:
 * two modulated delay lines, half a period apart, cross-faded with
 * complementary sin² / cos² envelopes so the wrap-around clicks are hidden.
 * Changes pitch without changing tempo. Adds a constant PERIOD of latency,
 * so every deck carries one to stay aligned.
 */
export class PitchShifter {
  readonly input: GainNode;
  readonly output: GainNode;
  private mods: GainNode[] = [];
  private delays: DelayNode[] = [];
  private sources: AudioBufferSourceNode[] = [];

  constructor(private ctx: BaseAudioContext) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    const len = Math.round(PERIOD * ctx.sampleRate);
    const ramp = ctx.createBuffer(1, len, ctx.sampleRate);
    const fadeA = ctx.createBuffer(1, len, ctx.sampleRate);
    const fadeB = ctx.createBuffer(1, len, ctx.sampleRate);
    const r = ramp.getChannelData(0);
    const fa = fadeA.getChannelData(0);
    const fb = fadeB.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const x = i / len;
      r[i] = x;
      fa[i] = Math.sin(Math.PI * x) ** 2;
      fb[i] = Math.cos(Math.PI * x) ** 2;
    }
    // Line B's ramp is offset by half a period so its wrap happens mid-fade of line A.
    const rampB = ctx.createBuffer(1, len, ctx.sampleRate);
    const rb = rampB.getChannelData(0);
    for (let i = 0; i < len; i++) rb[i] = ((i / len + 0.5) % 1);

    const t0 = ctx.currentTime + 0.05;
    [
      [ramp, fadeA],
      [rampB, fadeB],
    ].forEach(([rampBuf, fadeBuf]) => {
      const delay = ctx.createDelay(PERIOD * 2.5);
      delay.delayTime.value = PERIOD;
      const mod = ctx.createGain();
      mod.gain.value = 0;
      const modSrc = ctx.createBufferSource();
      modSrc.buffer = rampBuf;
      modSrc.loop = true;
      modSrc.connect(mod).connect(delay.delayTime);
      const vca = ctx.createGain();
      vca.gain.value = 0;
      const fadeSrc = ctx.createBufferSource();
      fadeSrc.buffer = fadeBuf;
      fadeSrc.loop = true;
      fadeSrc.connect(vca.gain);
      this.input.connect(delay).connect(vca).connect(this.output);
      modSrc.start(t0);
      fadeSrc.start(t0);
      this.mods.push(mod);
      this.delays.push(delay);
      this.sources.push(modSrc, fadeSrc);
    });
  }

  /** Shifts pitch by semitones (−12…+12) without changing tempo. */
  setSemitones(semitones: number) {
    const { sweep } = pitchShiftSweep(semitones, PERIOD);
    const t = this.ctx.currentTime;
    for (const m of this.mods) m.gain.setTargetAtTime(sweep, t, 0.02);
  }

  dispose() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {}
    }
    this.input.disconnect();
    this.output.disconnect();
  }
}
