"use client";

import { useEffect, useRef } from "react";
import { usePlayer } from "./PlayerProvider";

export type VisualizerMode = "bars" | "radial" | "wave";

/**
 * Real-time visualizer/spectrum analyzer driven by the engine's AnalyserNode.
 * Colors follow the active theme tokens. Pauses drawing when nothing plays.
 */
export function Visualizer({ mode = "bars", className, bars = 64 }: { mode?: VisualizerMode; className?: string; bars?: number }) {
  const { engine, snapshot } = usePlayer();
  const canvas = useRef<HTMLCanvasElement>(null);
  const playing = snapshot.status === "playing";

  useEffect(() => {
    const c = canvas.current;
    const analyser = engine?.getAnalyser();
    if (!c || !analyser) return;
    const ctx = c.getContext("2d")!;
    const freq = new Uint8Array(analyser.frequencyBinCount);
    const wave = new Uint8Array(analyser.fftSize);
    const styles = getComputedStyle(document.documentElement);
    const primary = styles.getPropertyValue("--au-primary").trim() || "#008CFF";
    const accent = styles.getPropertyValue("--au-accent").trim() || "#3DF2FF";
    let raf = 0;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== w * dpr || c.height !== h * dpr) {
        c.width = w * dpr;
        c.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const grad = ctx.createLinearGradient(0, h, w, 0);
      grad.addColorStop(0, primary);
      grad.addColorStop(1, accent);

      if (mode === "wave") {
        analyser.getByteTimeDomainData(wave);
        ctx.lineWidth = 2;
        ctx.strokeStyle = grad;
        ctx.beginPath();
        for (let i = 0; i < wave.length; i++) {
          const x = (i / (wave.length - 1)) * w;
          const y = (wave[i] / 255) * h;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else {
        analyser.getByteFrequencyData(freq);
        // Log-spaced bins: low frequencies get more resolution, like the ear.
        const minBin = 2;
        const maxBin = Math.floor(freq.length * 0.75);
        const values: number[] = [];
        for (let i = 0; i < bars; i++) {
          const a = Math.floor(minBin * Math.pow(maxBin / minBin, i / bars));
          const b = Math.max(a + 1, Math.floor(minBin * Math.pow(maxBin / minBin, (i + 1) / bars)));
          let sum = 0;
          for (let j = a; j < b; j++) sum += freq[j];
          values.push(sum / (b - a) / 255);
        }
        if (mode === "radial") {
          const cx = w / 2;
          const cy = h / 2;
          const r = Math.min(w, h) * 0.28;
          ctx.strokeStyle = grad;
          ctx.lineCap = "round";
          ctx.lineWidth = Math.max(2, (2 * Math.PI * r) / bars / 2.2);
          values.forEach((v, i) => {
            const ang = (i / bars) * Math.PI * 2 - Math.PI / 2;
            const len = r * 0.12 + v * r * 0.9;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
            ctx.lineTo(cx + Math.cos(ang) * (r + len), cy + Math.sin(ang) * (r + len));
            ctx.stroke();
          });
        } else {
          const gap = 3;
          const bw = (w - gap * (bars - 1)) / bars;
          ctx.fillStyle = grad;
          values.forEach((v, i) => {
            const bh = Math.max(2, v * h);
            const x = i * (bw + gap);
            ctx.beginPath();
            ctx.roundRect(x, h - bh, bw, bh, Math.min(3, bw / 2));
            ctx.fill();
          });
        }
      }
      if (playing) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [engine, playing, mode, bars]);

  return <canvas ref={canvas} className={className} aria-hidden="true" />;
}
