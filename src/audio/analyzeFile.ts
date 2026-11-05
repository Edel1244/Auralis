"use client";

import { analyzeChannels, type AudioAnalysis } from "./analysis";

const MAX_ANALYZE_BYTES = 150 * 1024 * 1024;

/** Decodes an audio File in the browser and analyzes it. Returns null when not decodable. */
export async function analyzeFile(file: File): Promise<AudioAnalysis | null> {
  if (file.size > MAX_ANALYZE_BYTES) return null;
  const Ctx = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!Ctx) return null;
  try {
    const buf = await file.arrayBuffer();
    // A 1-sample offline context is enough to access decodeAudioData without audio output.
    const ctx = new Ctx(1, 1, 44100);
    const audio = await ctx.decodeAudioData(buf);
    const channels = Array.from({ length: Math.min(2, audio.numberOfChannels) }, (_, i) => audio.getChannelData(i));
    // Yield to the UI thread before heavy work.
    await new Promise((r) => setTimeout(r, 0));
    return analyzeChannels(channels, audio.sampleRate);
  } catch {
    return null;
  }
}

/** Decodes a remote audio URL (used by the Mixing Studio). */
export async function decodeUrl(ctx: BaseAudioContext, url: string, signal?: AbortSignal) {
  const res = await fetch(url, { credentials: "same-origin", signal });
  if (!res.ok) throw new Error(`Failed to load audio (${res.status})`);
  return ctx.decodeAudioData(await res.arrayBuffer());
}
