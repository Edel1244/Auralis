import "server-only";
import { AUDIO_TYPES, extOf } from "../storage/mime";

/**
 * Identifies an audio container from its first bytes. The file extension is
 * only a hint; content that doesn't match a supported signature is rejected.
 */
export function sniffAudio(head: Buffer, filename: string): { ext: string; mime: string; lossless: boolean } | null {
  const ascii = (start: number, len: number) => head.subarray(start, start + len).toString("latin1");
  let ext: string | null = null;
  if (ascii(0, 4) === "fLaC") ext = "flac";
  else if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE") ext = "wav";
  else if (ascii(0, 4) === "OggS") ext = "ogg";
  else if (ascii(4, 4) === "ftyp") ext = "m4a";
  else if (ascii(0, 3) === "ID3") ext = extOf(filename) === "aac" ? "aac" : "mp3";
  else if (head[0] === 0xff && (head[1] & 0xf6) === 0xf0) ext = "aac"; // ADTS
  else if (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) ext = "mp3"; // MPEG audio frame sync
  if (!ext) return null;
  const t = AUDIO_TYPES[ext];
  return { ext, mime: t.mime, lossless: t.lossless };
}

export const SUPPORTED_AUDIO_EXTENSIONS = ["mp3", "wav", "flac", "ogg", "oga", "m4a", "aac"];

/** Client-computed analysis (waveform, loudness, BPM) — validated and clamped. */
export function sanitizeAnalysis(raw: unknown): { waveform: number[] | null; loudnessDb: number | null; bpm: number | null } {
  const a = (raw ?? {}) as { waveform?: unknown; loudnessDb?: unknown; bpm?: unknown };
  const waveform =
    Array.isArray(a.waveform) && a.waveform.length >= 16 && a.waveform.length <= 400
      ? a.waveform.map((v) => Math.round(Math.min(1, Math.max(0, Number(v) || 0)) * 1000) / 1000)
      : null;
  const loud = Number(a.loudnessDb);
  const bpm = Number(a.bpm);
  return {
    waveform,
    loudnessDb: Number.isFinite(loud) && loud > -70 && loud < 3 ? Math.round(loud * 10) / 10 : null,
    bpm: Number.isFinite(bpm) && bpm >= 40 && bpm <= 240 ? Math.round(bpm * 10) / 10 : null,
  };
}
