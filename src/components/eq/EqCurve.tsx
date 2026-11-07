"use client";

import { useMemo } from "react";
import { EQ_BANDS, EQ_MAX_DB, EQ_MIN_DB, eqResponseDb, logFrequencies, type EqSettings } from "@/audio/eq";

const W = 600;
const H = 160;
const RANGE = Math.max(EQ_MAX_DB, -EQ_MIN_DB) + 6; // room for stacked boosts
const x = (f: number) => (Math.log(f / 20) / Math.log(20000 / 20)) * W;
const y = (db: number) => H / 2 - (Math.max(-RANGE, Math.min(RANGE, db)) / RANGE) * (H / 2);

/** Live plot of the EQ's combined frequency response (same math as the audio graph). */
export function EqCurve({ eq, label }: { eq: EqSettings; label: string }) {
  const path = useMemo(() => {
    const pts = logFrequencies(140).map((f) => `${x(f).toFixed(1)},${y(eqResponseDb(eq, f)).toFixed(1)}`);
    return `M${pts.join(" L")}`;
  }, [eq]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" role="img" aria-label={label} preserveAspectRatio="none">
      <defs>
        <linearGradient id="eq-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--au-primary)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--au-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[-12, -6, 0, 6, 12].map((db) => (
        <line key={db} x1={0} x2={W} y1={y(db)} y2={y(db)} stroke="currentColor" strokeOpacity={db === 0 ? 0.25 : 0.08} vectorEffect="non-scaling-stroke" />
      ))}
      {EQ_BANDS.map((f) => (
        <line key={f} x1={x(f)} x2={x(f)} y1={0} y2={H} stroke="currentColor" strokeOpacity={0.06} vectorEffect="non-scaling-stroke" />
      ))}
      <path d={`${path} L${W},${H / 2} L0,${H / 2} Z`} fill="url(#eq-fill)" />
      <path d={path} fill="none" stroke="var(--au-primary)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
