import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, normalizeTheme, themeTokensSchema, THEME_PRESETS } from "@/theme/tokens";

describe("theme tokens", () => {
  it("defaults to Azure Blue on Deep Black", () => {
    expect(DEFAULT_THEME.primary).toBe("#008CFF");
    expect(DEFAULT_THEME.mode).toBe("dark");
  });

  it("rejects anything that isn't a strict hex color (no CSS injection)", () => {
    for (const bad of ["red;}body{display:none", "url(javascript:x)", "#fff", "#00000g", "var(--x)"]) {
      expect(themeTokensSchema.safeParse({ primary: bad }).success).toBe(false);
    }
    expect(themeTokensSchema.safeParse({ radius: 999 }).success).toBe(false);
    expect(themeTokensSchema.safeParse({ font: "Comic Sans" }).success).toBe(false);
  });

  it("normalizes unknown or broken input to defaults", () => {
    expect(normalizeTheme(null)).toEqual(DEFAULT_THEME);
    expect(normalizeTheme({ primary: "nope" })).toEqual(DEFAULT_THEME);
    expect(normalizeTheme({ primary: "#7C5CFF" }).primary).toBe("#7C5CFF");
  });

  it("all built-in presets are valid", () => {
    for (const p of THEME_PRESETS) expect(themeTokensSchema.safeParse({ ...DEFAULT_THEME, ...p.tokens }).success).toBe(true);
  });
});
