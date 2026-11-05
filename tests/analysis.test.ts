import { describe, expect, it } from "vitest";
import { computePeaks, estimateBpm, mixToMono, rmsDb } from "@/audio/analysis";

const SR = 22050;

/** Synthetic click track: short decaying noise bursts on every beat. */
function clickTrack(bpm: number, seconds: number) {
  const out = new Float32Array(SR * seconds);
  const period = Math.round((60 / bpm) * SR);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let start = 0; start < out.length; start += period) {
    for (let i = 0; i < 600 && start + i < out.length; i++) out[start + i] = rnd() * Math.exp(-i / 120);
  }
  return out;
}

describe("audio analysis", () => {
  it.each([90, 120, 128, 140, 174])("estimates %d BPM within ±2", (bpm) => {
    const est = estimateBpm(clickTrack(bpm, 30), SR);
    expect(est).not.toBeNull();
    expect(Math.abs(est! - bpm)).toBeLessThanOrEqual(2);
  });

  it("computes normalized peaks", () => {
    const s = new Float32Array(1000);
    s[100] = 0.5;
    s[900] = -1;
    const p = computePeaks(s, 10);
    expect(p).toHaveLength(10);
    expect(Math.max(...p)).toBe(1);
    expect(p[1]).toBe(0.5);
  });

  it("measures RMS in dBFS and ignores silence", () => {
    const sine = new Float32Array(SR).map((_, i) => Math.sin((2 * Math.PI * 440 * i) / SR));
    expect(rmsDb(sine)).toBeCloseTo(-3.01, 1);
    expect(rmsDb(new Float32Array(SR))).toBe(-70);
  });

  it("mixes channels to mono", () => {
    expect(Array.from(mixToMono([new Float32Array([1, 0]), new Float32Array([0, 1])]))).toEqual([0.5, 0.5]);
  });
});
