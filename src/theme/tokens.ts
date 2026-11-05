import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a #RRGGBB color");

/** Everything a theme can customize. Validated on import, publish and save. */
export const themeTokensSchema = z.object({
  mode: z.enum(["dark", "light", "system"]).default("dark"),
  primary: hex.default("#008CFF"),
  accent: hex.default("#3DF2FF"),
  background: hex.nullable().default(null), // null = mode default
  surface: hex.nullable().default(null),
  gradient: z.boolean().default(true), // ambient hero gradients
  density: z.enum(["compact", "comfortable", "spacious"]).default("comfortable"),
  motion: z.enum(["system", "full", "reduced"]).default("system"),
  font: z.enum(["inter", "sora", "system", "serif"]).default("inter"),
  radius: z.number().min(0).max(28).default(14),
  playerStyle: z.enum(["glass", "solid", "minimal"]).default("glass"),
  sidebar: z.enum(["expanded", "collapsed"]).default("expanded"),
});

export type ThemeTokens = z.infer<typeof themeTokensSchema>;

export const DEFAULT_THEME: ThemeTokens = themeTokensSchema.parse({});

export const THEME_PRESETS: { id: string; name: string; tokens: Partial<ThemeTokens> }[] = [
  { id: "azure", name: "Azure (default)", tokens: {} },
  { id: "aurora", name: "Aurora", tokens: { primary: "#7C5CFF", accent: "#2EF2C2", background: "#07080F", surface: "#10121D" } },
  { id: "ember", name: "Ember", tokens: { primary: "#FF6A2B", accent: "#FFC247", background: "#0D0907", surface: "#18110D" } },
  { id: "rose", name: "Rosé", tokens: { primary: "#FF4F8B", accent: "#FFB3CF", background: "#0E080B", surface: "#1A1015" } },
  { id: "forest", name: "Forest", tokens: { primary: "#2FD18A", accent: "#B8F25C", background: "#060C09", surface: "#0F1914" } },
  { id: "mono", name: "Monochrome", tokens: { primary: "#E6E9EF", accent: "#9AA6B8", background: "#0A0A0B", surface: "#141416", gradient: false } },
  { id: "daylight", name: "Daylight", tokens: { mode: "light", primary: "#0070E0", accent: "#00A8C6" } },
];

export function normalizeTheme(input: unknown): ThemeTokens {
  const r = themeTokensSchema.safeParse(input ?? {});
  return r.success ? r.data : DEFAULT_THEME;
}

export const THEME_STORAGE_KEY = "auralis_theme";

const FONT_VARS: Record<ThemeTokens["font"], string> = {
  inter: "var(--font-inter)",
  sora: "var(--font-sora)",
  system: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
  serif: "ui-serif, Georgia, Cambria, serif",
};

/**
 * Applies tokens to <html>. Pure DOM manipulation, so it is shared by the
 * pre-hydration boot script and the React theme provider.
 */
export function applyTheme(t: ThemeTokens, root: HTMLElement = document.documentElement) {
  const prefersLight = typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: light)").matches;
  const mode = t.mode === "system" ? (prefersLight ? "light" : "dark") : t.mode;
  root.dataset.theme = mode;
  root.dataset.density = t.density;
  root.dataset.player = t.playerStyle;
  if (t.motion === "system") delete root.dataset.motion;
  else root.dataset.motion = t.motion;
  const s = root.style;
  s.setProperty("--au-primary", t.primary);
  s.setProperty("--au-primary-hover", `color-mix(in oklab, ${t.primary} 80%, white)`);
  s.setProperty("--au-accent", t.accent);
  s.setProperty("--radius-card", `${t.radius}px`);
  s.setProperty("--font-body", FONT_VARS[t.font]);
  const setOrClear = (name: string, value: string | null) =>
    value ? s.setProperty(name, value) : s.removeProperty(name);
  setOrClear("--au-bg", t.background);
  setOrClear("--au-surface", t.surface);
  if (t.surface) {
    const mixWith = mode === "light" ? "black" : "white";
    s.setProperty("--au-surface-2", `color-mix(in oklab, ${t.surface} 92%, ${mixWith})`);
    s.setProperty("--au-elevated", `color-mix(in oklab, ${t.surface} 85%, ${mixWith})`);
    s.setProperty("--au-border", `color-mix(in oklab, ${t.surface} 78%, ${mixWith})`);
  } else {
    ["--au-surface-2", "--au-elevated", "--au-border"].forEach((p) => s.removeProperty(p));
  }
  if (!t.gradient) s.setProperty("--gradient-hero", "none");
  else s.removeProperty("--gradient-hero");
}

/** Inline <head> script: applies the locally cached theme before first paint (no flash). */
export const themeBootScript = `(function(){try{var t=JSON.parse(localStorage.getItem("${THEME_STORAGE_KEY}")||"null");if(!t)return;var r=document.documentElement,s=r.style;var light=t.mode==="light"||(t.mode==="system"&&matchMedia("(prefers-color-scheme: light)").matches);r.dataset.theme=light?"light":"dark";if(t.density)r.dataset.density=t.density;if(t.motion&&t.motion!=="system")r.dataset.motion=t.motion;if(/^#[0-9a-f]{6}$/i.test(t.primary||""))s.setProperty("--au-primary",t.primary);if(/^#[0-9a-f]{6}$/i.test(t.accent||""))s.setProperty("--au-accent",t.accent);if(/^#[0-9a-f]{6}$/i.test(t.background||""))s.setProperty("--au-bg",t.background);if(/^#[0-9a-f]{6}$/i.test(t.surface||""))s.setProperty("--au-surface",t.surface);}catch(e){}})();`;
