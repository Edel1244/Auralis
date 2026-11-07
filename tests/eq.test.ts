import { describe, expect, it } from "vitest";
import { biquadMagnitudeDb, DEFAULT_EQ, eqPeakDb, eqResponseDb, normalizeEq } from "@/audio/eq";

const eq = (patch: Partial<typeof DEFAULT_EQ>) => normalizeEq({ ...DEFAULT_EQ, ...patch });

describe("EQ frequency response", () => {
  it("a peaking band hits its gain at the center and fades away from it", () => {
    expect(biquadMagnitudeDb("peaking", 1000, 6, 1.1, 1000)).toBeCloseTo(6, 1);
    expect(Math.abs(biquadMagnitudeDb("peaking", 1000, 6, 1.1, 50))).toBeLessThan(0.2);
  });

  it("shelves reach full gain in their pass region", () => {
    expect(biquadMagnitudeDb("lowshelf", 110, 9, 1, 20)).toBeCloseTo(9, 0);
    expect(biquadMagnitudeDb("highshelf", 7000, -6, 1, 18000)).toBeCloseTo(-6, 0);
    expect(Math.abs(biquadMagnitudeDb("lowshelf", 110, 9, 1, 5000))).toBeLessThan(0.2);
  });

  it("flat or disabled EQ needs no headroom", () => {
    expect(eqPeakDb(DEFAULT_EQ)).toBe(0);
    expect(eqPeakDb(eq({ enabled: false, gains: Array(10).fill(12) }))).toBe(0);
    expect(eqResponseDb(eq({ enabled: false, gains: Array(10).fill(12) }), 1000)).toBe(0);
  });

  it("stacked neighbouring boosts exceed a single band's gain", () => {
    const single = eqPeakDb(eq({ gains: [0, 0, 0, 0, 0, 6, 0, 0, 0, 0] }));
    const stacked = eqPeakDb(eq({ gains: [0, 0, 0, 0, 6, 6, 6, 0, 0, 0] }));
    expect(single).toBeCloseTo(6, 0);
    expect(stacked).toBeGreaterThan(single + 1);
  });

  it("cuts never require headroom", () => {
    expect(eqPeakDb(eq({ gains: Array(10).fill(-12), treble: -12 }))).toBe(0);
  });

  it("normalizes autoGain with a safe default", () => {
    expect(normalizeEq({}).autoGain).toBe(true);
    expect(normalizeEq({ autoGain: false }).autoGain).toBe(false);
  });
});
