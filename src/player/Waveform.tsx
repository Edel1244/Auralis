"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";
import { usePlaybackTime, usePlayer } from "./PlayerProvider";

/** Clickable waveform of the current track (peaks computed server-side at upload). */
export function Waveform({ peaks, className }: { peaks: number[]; className?: string }) {
  const { snapshot, seek } = usePlayer();
  const time = usePlaybackTime();
  const ref = useRef<HTMLDivElement>(null);
  const progress = snapshot.duration ? time / snapshot.duration : 0;
  const bars = peaks.length;
  return (
    <div
      ref={ref}
      className={cn("flex cursor-pointer items-center gap-[2px]", className)}
      onClick={(e) => {
        const r = ref.current!.getBoundingClientRect();
        seek(((e.clientX - r.left) / r.width) * snapshot.duration);
      }}
      aria-hidden="true"
    >
      {peaks.map((v, i) => (
        <span
          key={i}
          className={cn("flex-1 rounded-full transition-colors", i / bars < progress ? "bg-primary" : "bg-fg/20")}
          style={{ height: `${Math.max(6, v * 100)}%` }}
        />
      ))}
    </div>
  );
}
