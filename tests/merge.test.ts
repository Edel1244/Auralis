import { describe, expect, it } from "vitest";
import { fadeCurves, MAX_MERGE_SECONDS, planMerge } from "@/audio/studio/merge";
import { encodeWav } from "@/audio/wav";

const base = { aOut: 180, bIn: 0, overlap: 10, syncTempo: false, bassSwap: true };

describe("planMerge", () => {
  it("overlaps B with the end of A", () => {
    const p = planMerge({ duration: 200, bpm: null }, { duration: 150, bpm: null }, base);
    expect(p).toMatchObject({ aEnd: 180, bStart: 170, bOffset: 0, bRate: 1, fade: 10 });
    expect(p.total).toBeCloseTo(170 + 150);
  });

  it("starts B from its in-point and shortens the timeline accordingly", () => {
    const p = planMerge({ duration: 200, bpm: null }, { duration: 150, bpm: null }, { ...base, bIn: 30 });
    expect(p.bOffset).toBe(30);
    expect(p.total).toBeCloseTo(170 + 120);
  });

  it("time-stretches B to A's tempo only when both BPMs are known", () => {
    const synced = planMerge({ duration: 200, bpm: 128 }, { duration: 120, bpm: 120 }, { ...base, syncTempo: true });
    expect(synced.bRate).toBeCloseTo(128 / 120);
    expect(synced.total).toBeCloseTo(170 + 120 / (128 / 120));
    expect(planMerge({ duration: 200, bpm: 128 }, { duration: 120, bpm: null }, { ...base, syncTempo: true }).bRate).toBe(1);
  });

  it("clamps silly inputs", () => {
    const p = planMerge({ duration: 20, bpm: null }, { duration: 8, bpm: null }, { ...base, aOut: 999, bIn: -5, overlap: 99 });
    expect(p.aEnd).toBe(20);
    expect(p.bOffset).toBe(0);
    expect(p.fade).toBe(8); // never longer than B itself
    expect(p.bStart).toBe(12);
    const hardCut = planMerge({ duration: 20, bpm: null }, { duration: 8, bpm: null }, { ...base, overlap: 0 });
    expect(hardCut.bStart).toBe(20);
  });

  it("caps the rendered length", () => {
    const p = planMerge({ duration: 1200, bpm: null }, { duration: 1200, bpm: null }, { ...base, aOut: 1200 });
    expect(p.total).toBe(MAX_MERGE_SECONDS);
  });

  it("fade curves are equal-power", () => {
    const [o, i] = fadeCurves(16);
    expect(o[0]).toBeCloseTo(1);
    expect(i[15]).toBeCloseTo(1);
    for (let k = 0; k < 16; k++) expect(o[k] ** 2 + i[k] ** 2).toBeCloseTo(1);
  });
});

describe("encodeWav", () => {
  it("writes a valid 16-bit stereo header and clipped samples", () => {
    const left = new Float32Array([0, 1, -1, 2]);
    const right = new Float32Array([0.5, -0.5, 0, -2]);
    const wav = encodeWav({ numberOfChannels: 2, sampleRate: 44100, length: 4, getChannelData: (c) => (c ? right : left) });
    const v = new DataView(wav);
    const tag = (o: number) => String.fromCharCode(...new Uint8Array(wav, o, 4));
    expect([tag(0), tag(8), tag(12), tag(36)]).toEqual(["RIFF", "WAVE", "fmt ", "data"]);
    expect(v.getUint16(22, true)).toBe(2);
    expect(v.getUint32(24, true)).toBe(44100);
    expect(v.getUint32(40, true)).toBe(16);
    expect(wav.byteLength).toBe(44 + 16);
    expect(v.getInt16(46, true)).toBe(Math.round(0.5 * 0x7fff)); // frame 0, right
    expect(v.getInt16(48, true)).toBe(0x7fff); // frame 1, left = 1
    expect(v.getInt16(52, true)).toBe(-0x8000); // frame 2, left = -1
    expect(v.getInt16(56, true)).toBe(0x7fff); // frame 3, left = 2 → clipped
  });
});
