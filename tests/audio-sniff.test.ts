import { describe, expect, it } from "vitest";
import { sanitizeAnalysis, sniffAudio } from "@/server/media/audio";
import { parseRange } from "@/server/storage";

const buf = (s: string | number[]) => (typeof s === "string" ? Buffer.from(s, "latin1") : Buffer.from(s));

describe("sniffAudio", () => {
  it("detects containers by magic bytes, not by extension", () => {
    expect(sniffAudio(buf("fLaC\0\0\0\x22"), "x.mp3")?.ext).toBe("flac");
    expect(sniffAudio(buf("RIFF\0\0\0\0WAVEfmt "), "x.flac")?.ext).toBe("wav");
    expect(sniffAudio(buf("OggS\0\x02"), "x.ogg")?.ext).toBe("ogg");
    expect(sniffAudio(buf("\0\0\0\x20ftypM4A "), "x.m4a")?.ext).toBe("m4a");
    expect(sniffAudio(buf("ID3\x04\0\0"), "song.mp3")?.ext).toBe("mp3");
    expect(sniffAudio(buf([0xff, 0xfb, 0x90, 0x64]), "song")?.ext).toBe("mp3");
    expect(sniffAudio(buf([0xff, 0xf1, 0x50, 0x80]), "song.aac")?.ext).toBe("aac");
  });
  it("rejects non-audio", () => {
    expect(sniffAudio(buf("%PDF-1.7"), "song.mp3")).toBeNull();
    expect(sniffAudio(buf("<html><script>"), "song.wav")).toBeNull();
    expect(sniffAudio(buf([0x89, 0x50, 0x4e, 0x47]), "a.flac")).toBeNull();
  });
  it("marks lossless formats", () => {
    expect(sniffAudio(buf("fLaC"), "a")?.lossless).toBe(true);
    expect(sniffAudio(buf("OggS"), "a")?.lossless).toBe(false);
  });
});

describe("sanitizeAnalysis", () => {
  it("clamps and validates client analysis", () => {
    const r = sanitizeAnalysis({ waveform: Array(20).fill(2), loudnessDb: -9.44, bpm: 128.04 });
    expect(r.waveform?.every((v) => v === 1)).toBe(true);
    expect(r.loudnessDb).toBe(-9.4);
    expect(r.bpm).toBe(128);
    expect(sanitizeAnalysis({ waveform: [1, 2], bpm: 999, loudnessDb: "x" })).toEqual({ waveform: null, loudnessDb: null, bpm: null });
  });
});

describe("parseRange", () => {
  it("parses standard byte ranges", () => {
    expect(parseRange("bytes=0-99", 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange("bytes=500-", 1000)).toEqual({ start: 500, end: 999 });
    expect(parseRange("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=900-5000", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange(null, 1000)).toBeNull();
  });
  it("rejects unsatisfiable ranges", () => {
    expect(parseRange("bytes=1000-", 1000)).toBe("invalid");
    expect(parseRange("bytes=50-10", 1000)).toBe("invalid");
    expect(parseRange("items=0-1", 1000)).toBe("invalid");
  });
});
