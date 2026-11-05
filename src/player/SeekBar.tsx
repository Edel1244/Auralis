"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";
import { useT } from "@/i18n/I18nProvider";
import { usePlaybackTime, usePlayer } from "./PlayerProvider";

export function SeekBar({ className, showTimes = true }: { className?: string; showTimes?: boolean }) {
  const { snapshot, seek, engine } = usePlayer();
  const t = useT();
  const time = usePlaybackTime();
  const [scrub, setScrub] = useState<number | null>(null);
  const duration = snapshot.duration || 0;
  const value = scrub ?? time;
  const pct = duration ? (value / duration) * 100 : 0;
  const buffered = duration && engine ? Math.min(100, (engine.bufferedEnd / duration) * 100) : 0;

  return (
    <div className={cn("flex w-full items-center gap-2.5 text-[11px] tabular-nums text-subtle", className)}>
      {showTimes && <span className="w-10 text-right">{formatDuration(value)}</span>}
      <div className="relative flex-1">
        <div
          className="pointer-events-none absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-fg/10"
          style={{ width: `${buffered}%` }}
        />
        <input
          type="range"
          className="au-range relative w-full"
          min={0}
          max={duration || 1}
          step={0.1}
          value={value}
          disabled={!duration}
          aria-label={t("player.seek")}
          aria-valuetext={`${formatDuration(value)} / ${formatDuration(duration)}`}
          style={{ ["--pct" as string]: `${pct}%` }}
          onChange={(e) => setScrub(Number(e.target.value))}
          onPointerUp={() => {
            if (scrub !== null) seek(scrub);
            setScrub(null);
          }}
          onKeyUp={() => {
            if (scrub !== null) seek(scrub);
            setScrub(null);
          }}
        />
      </div>
      {showTimes && <span className="w-10">{formatDuration(duration)}</span>}
    </div>
  );
}
