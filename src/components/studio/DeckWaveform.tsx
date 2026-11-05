"use client";

import { useEffect, useRef } from "react";
import type { DeckState } from "@/audio/studio/Deck";

/** Canvas waveform with playhead, cue, hot cues and loop region. Click/drag to seek. */
export function DeckWaveform({
  state,
  position,
  color,
  onSeek,
}: {
  state: DeckState;
  position: number;
  color: string;
  onSeek: (t: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const dur = state.duration || 1;

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    c.width = w * dpr;
    c.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const x = (t: number) => (t / dur) * w;

    if (state.loop) {
      ctx.fillStyle = "rgba(61,242,255,0.15)";
      ctx.fillRect(x(state.loop.start), 0, Math.max(2, x(state.loop.end) - x(state.loop.start)), h);
    }
    const peaks = state.peaks;
    if (peaks) {
      const bw = w / peaks.length;
      const played = position / dur;
      peaks.forEach((p, i) => {
        const bh = Math.max(1, p * (h - 6));
        ctx.fillStyle = i / peaks.length < played ? color : "rgba(255,255,255,0.28)";
        ctx.fillRect(i * bw, (h - bh) / 2, Math.max(1, bw - 0.5), bh);
      });
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(0, h / 2 - 1, w, 2);
    }
    // Beat grid (from first beat assumed at 0) when BPM known
    if (state.bpm && state.duration) {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      const beat = 60 / state.bpm;
      if (w / (dur / beat) > 3) for (let t = 0; t < dur; t += beat) ctx.fillRect(x(t), 0, 1, h);
    }
    ctx.fillStyle = "#FFB547";
    ctx.fillRect(x(state.cue) - 1, 0, 2, h);
    state.hotCues.forEach((hc, i) => {
      if (hc === null) return;
      ctx.fillStyle = ["#FF4F8B", "#2FD18A", "#7C5CFF", "#FF6A2B"][i];
      ctx.beginPath();
      ctx.moveTo(x(hc) - 5, 0);
      ctx.lineTo(x(hc) + 5, 0);
      ctx.lineTo(x(hc), 7);
      ctx.fill();
    });
    ctx.fillStyle = "#fff";
    ctx.fillRect(x(position) - 1, 0, 2, h);
  }, [state, position, dur, color]);

  return (
    <canvas
      ref={canvas}
      className="h-24 w-full cursor-pointer rounded-xl bg-black/30"
      role="slider"
      aria-label="Waveform"
      aria-valuemin={0}
      aria-valuemax={Math.round(dur)}
      aria-valuenow={Math.round(position)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") onSeek(position + 1);
        if (e.key === "ArrowLeft") onSeek(position - 1);
      }}
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onSeek(((e.clientX - r.left) / r.width) * dur);
      }}
    />
  );
}
