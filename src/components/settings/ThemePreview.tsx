"use client";

import { Heart, Play, SkipBack, SkipForward } from "lucide-react";
import type { ThemeTokens } from "@/theme/tokens";
import { useT } from "@/i18n/I18nProvider";

/**
 * Self-contained miniature of the AURALIS UI rendered from explicit tokens
 * (not the page's CSS variables), so gallery cards show each theme accurately.
 */
export function ThemePreview({ tokens, className }: { tokens: ThemeTokens; className?: string }) {
  const t = useT();
  const light = tokens.mode === "light";
  const bg = tokens.background ?? (light ? "#f4f7fb" : "#080B10");
  const surface = tokens.surface ?? (light ? "#ffffff" : "#111720");
  const text = light ? "#0b1220" : "#ffffff";
  const muted = light ? "#4c5a70" : "#9aa6b8";
  const r = `${tokens.radius}px`;
  return (
    <div
      className={className}
      style={{ background: bg, color: text, borderRadius: r, overflow: "hidden", border: `1px solid ${light ? "#dbe2ec" : "#222c3a"}` }}
      aria-hidden="true"
    >
      <div
        style={{
          padding: 14,
          background: tokens.gradient ? `radial-gradient(260px 120px at 10% -20%, ${tokens.primary}66, transparent 70%)` : undefined,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: `calc(${r} * .6)`, background: `linear-gradient(135deg, ${tokens.primary}, ${tokens.accent})` }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t("appearance.previewTrack")}</div>
            <div style={{ fontSize: 11, color: muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t("appearance.previewArtist")}</div>
          </div>
          <Heart size={16} color={tokens.primary} fill={tokens.primary} />
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
          {[0.9, 0.6, 0.75, 0.4].map((w, i) => (
            <div key={i} style={{ flex: 1, height: 6, borderRadius: 99, background: i === 0 ? tokens.primary : surface, opacity: i === 0 ? 1 : 0.9, transform: `scaleX(${w})` }} />
          ))}
        </div>
      </div>
      <div style={{ background: surface, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, height: 4, borderRadius: 99, background: `linear-gradient(to right, ${tokens.primary} 40%, ${light ? "#dbe2ec" : "#222c3a"} 40%)` }} />
        <SkipBack size={14} color={muted} />
        <span style={{ width: 26, height: 26, borderRadius: 99, background: text, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Play size={12} color={bg} fill={bg} />
        </span>
        <SkipForward size={14} color={muted} />
        <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 99, background: tokens.accent, color: "#080B10", fontWeight: 700 }}>LIVE</span>
      </div>
    </div>
  );
}
