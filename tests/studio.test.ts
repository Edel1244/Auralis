import { describe, expect, it } from "vitest";
import { crossfadeGains, effectiveBpm, loopRegion, pitchShiftSweep, semitoneRatio, syncRate, wrapLoop } from "@/audio/studio/math";

describe("studio math", () => {
  it("crossfade is equal-power and hits the ends", () => {
    expect(crossfadeGains(-1)[0]).toBeCloseTo(1);
    expect(crossfadeGains(-1)[1]).toBeCloseTo(0);
    expect(crossfadeGains(1)[1]).toBeCloseTo(1);
    for (const x of [-0.7, 0, 0.3]) {
      const [a, b] = crossfadeGains(x);
      expect(a * a + b * b).toBeCloseTo(1);
    }
  });

  it("syncs tempo to the master deck", () => {
    expect(syncRate(128, 1, 120)).toBeCloseTo(128 / 120);
    expect(effectiveBpm(120, syncRate(128, 1.02, 120))).toBeCloseTo(130.6, 1);
    expect(syncRate(200, 1, 60)).toBe(2); // clamped
    expect(syncRate(0, 1, 120)).toBe(1);
  });

  it("builds beat-length loops and wraps positions", () => {
    const l = loopRegion(10, 120, 4, 300); // 4 beats at 120 BPM = 2 s
    expect(l).toEqual({ start: 10, end: 12 });
    expect(wrapLoop(12.5, l)).toBeCloseTo(10.5);
    expect(wrapLoop(11, l)).toBe(11);
    expect(loopRegion(299, 120, 8, 300).end).toBe(300);
  });

  it("pitch shifter sweep produces the requested ratio", () => {
    expect(semitoneRatio(12)).toBeCloseTo(2);
    const up = pitchShiftSweep(12, 0.1);
    expect(1 - up.sweep / 0.1).toBeCloseTo(2);
    expect(up.base + up.sweep).toBeGreaterThanOrEqual(-1e-9); // delay never negative
    const down = pitchShiftSweep(-5, 0.1);
    expect(1 - down.sweep / 0.1).toBeCloseTo(semitoneRatio(-5));
    expect(pitchShiftSweep(0, 0.1).sweep).toBe(0);
  });
});
