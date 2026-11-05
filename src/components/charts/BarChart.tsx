"use client";

import { useState } from "react";

/**
 * Minimal accessible bar chart (SVG, no dependencies). Values are listed in a
 * visually hidden table for screen readers; hovering a bar shows its value.
 */
export function BarChart({ data, label, format = (n) => String(n) }: { data: { day: string; value: number }[]; label: string; format?: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / data.length;
  const h = hover !== null ? data[hover] : null;
  return (
    <figure className="space-y-2">
      <figcaption className="flex items-baseline justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums text-xs text-subtle">{h ? `${h.day}: ${format(h.value)}` : `max ${format(max)}`}</span>
      </figcaption>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-32 w-full" aria-hidden="true">
        <defs>
          <linearGradient id="barGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="var(--au-primary)" />
            <stop offset="1" stopColor="var(--au-accent)" />
          </linearGradient>
        </defs>
        {data.map((d, i) => {
          const bh = (d.value / max) * 38;
          return (
            <rect
              key={d.day}
              x={i * w + w * 0.15}
              y={40 - Math.max(bh, d.value ? 0.8 : 0.3)}
              width={w * 0.7}
              height={Math.max(bh, d.value ? 0.8 : 0.3)}
              rx={0.6}
              fill={d.value ? "url(#barGrad)" : "var(--au-border)"}
              opacity={hover === null || hover === i ? 1 : 0.45}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-subtle">
        <span>{data[0]?.day}</span>
        <span>{data[data.length - 1]?.day}</span>
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <th scope="row">{d.day}</th>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="font-display text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted">{label}</div>
      {sub && <div className="mt-1 text-[11px] text-subtle">{sub}</div>}
    </div>
  );
}
