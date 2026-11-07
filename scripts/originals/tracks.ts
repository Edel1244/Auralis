import type { TrackSpec } from "./compose";

export type TrackMeta = {
  spec: TrackSpec;
  title: string;
  description: string;
  genre: string; // genre slug
  mood: string;
  tags: string[];
  album: "winter" | "calm";
  cover: CoverTheme;
};

export type CoverTheme = "first-snow" | "frost" | "fireplace" | "aurora" | "mist" | "lake" | "breath" | "waltz";

export const ARTIST = "AURALIS Originals";

export const ALBUMS = {
  winter: {
    title: "Winter Tales",
    description: "Calm winter pieces: first snow, frosted windows, a warm fireplace and the northern lights.",
    cover: "aurora" as CoverTheme,
  },
  calm: {
    title: "Still Waters",
    description: "Soothing melodies for piano, violin and strings.",
    cover: "lake" as CoverTheme,
  },
};

const LICENSE = "Original music generated for AURALIS. Licensed CC BY 4.0: free to use, remix and share with credit to \"AURALIS Originals\".";
export { LICENSE };

export const TRACKS: TrackMeta[] = [
  {
    title: "First Snow",
    description: "Watching the first snowflakes fall: piano arpeggios, celesta and soft strings.",
    genre: "classical",
    mood: "calm",
    tags: ["piano", "celesta", "winter", "snow", "calm"],
    album: "winter",
    cover: "first-snow",
    spec: {
      slug: "first-snow",
      seed: 1101,
      key: "D",
      mode: "major",
      bpm: 70,
      meter: 4,
      brightness: 0.45,
      reverb: { room: 0.85, damp: 0.45, wet: 0.36 },
      sections: [
        { bars: 4, prog: ["Dmaj7", "Bm7", "Gmaj7", "A7sus4"], acc: "arp", pad: true, dyn: 0.45 },
        { bars: 8, prog: ["Dmaj7", "Bm7", "Gmaj7", "A7sus4", "Dmaj7", "F#m7", "Gmaj7", "A"], acc: "arp", lead: "celesta", range: [74, 88], density: "normal", pad: true, dyn: 0.55 },
        { bars: 8, prog: ["Gmaj7", "A", "F#m7", "Bm7", "Em7", "A", "Dmaj7", "A7sus4"], acc: "arp", lead: "piano", range: [69, 84], density: "flowing", pad: true, sparkle: "celesta", dyn: 0.62 },
        { bars: 8, prog: ["Dmaj7", "Bm7", "Gmaj7", "A7sus4", "Dmaj7", "F#m7", "Gmaj7", "A"], acc: "arp", lead: "celesta", range: [74, 88], density: "normal", pad: true, dyn: 0.55 },
        { bars: 4, prog: ["Gmaj7", "A7sus4", "Bm7", "Dmaj7"], acc: "arp-slow", pad: true, dyn: 0.4 },
      ],
    },
  },
  {
    title: "Frosted Window",
    description: "A fine violin line, delicate as frost crystals, over a wistful piano.",
    genre: "classical",
    mood: "melancholic",
    tags: ["violin", "piano", "winter", "frost", "melancholic"],
    album: "winter",
    cover: "frost",
    spec: {
      slug: "frosted-window",
      seed: 2207,
      key: "A",
      mode: "minor",
      bpm: 64,
      meter: 4,
      reverb: { room: 0.9, damp: 0.35, wet: 0.38 },
      sections: [
        { bars: 4, prog: ["Am9", "Fmaj7", "C", "G"], acc: "arp", pad: true, dyn: 0.42 },
        { bars: 8, prog: ["Am9", "Fmaj7", "C", "G", "Am9", "Dm7", "Esus4", "E"], acc: "arp", lead: "violin", range: [69, 86], density: "normal", pad: true, dyn: 0.55 },
        { bars: 8, prog: ["Fmaj7", "G", "Em7", "Am", "Dm7", "G", "Cmaj7", "E"], acc: "arp", lead: "violin", range: [72, 88], density: "flowing", pad: true, bass: "cello", dyn: 0.66 },
        { bars: 8, prog: ["Am9", "Fmaj7", "C", "G", "Am9", "Dm7", "Esus4", "Am"], acc: "arp", lead: "violin", range: [69, 86], density: "sparse", pad: true, dyn: 0.5 },
        { bars: 2, prog: ["Fmaj7", "Am"], acc: "arp-slow", pad: true, dyn: 0.38 },
      ],
    },
  },
  {
    title: "By the Fireplace",
    description: "A warm room while the snow falls outside: piano and a warm cello.",
    genre: "classical",
    mood: "cozy",
    tags: ["piano", "cello", "winter", "cozy", "fireplace"],
    album: "winter",
    cover: "fireplace",
    spec: {
      slug: "by-the-fireplace",
      seed: 3313,
      key: "F",
      mode: "major",
      bpm: 76,
      meter: 4,
      brightness: 0.4,
      reverb: { room: 0.6, damp: 0.6, wet: 0.26 },
      sections: [
        { bars: 4, prog: ["Fmaj7", "Dm7", "Bbmaj7", "C7sus4"], acc: "arp", dyn: 0.45 },
        { bars: 8, prog: ["Fmaj7", "Dm7", "Bbmaj7", "C7sus4", "Fmaj7", "Am7", "Bbmaj7", "C"], acc: "arp", lead: "piano", range: [65, 81], density: "normal", dyn: 0.55 },
        { bars: 8, prog: ["Bbmaj7", "C", "Am7", "Dm7", "Gm7", "C", "Fmaj7", "C7sus4"], acc: "arp", lead: "cello", range: [50, 64], density: "sparse", dyn: 0.62 },
        { bars: 8, prog: ["Fmaj7", "Dm7", "Bbmaj7", "C7sus4", "Fmaj7", "Am7", "Bbmaj7", "C"], acc: "arp", lead: "piano", range: [65, 81], density: "flowing", bass: "cello", dyn: 0.58 },
        { bars: 4, prog: ["Bbmaj7", "C7sus4", "Dm7", "Fmaj7"], acc: "arp-slow", dyn: 0.4 },
      ],
    },
  },
  {
    title: "Northern Lights",
    description: "Wide strings, glass bells and a distant violin, like lights rippling across the sky.",
    genre: "ambient",
    mood: "dreamy",
    tags: ["ambient", "strings", "bells", "winter", "aurora"],
    album: "winter",
    cover: "aurora",
    spec: {
      slug: "northern-lights",
      seed: 4421,
      key: "E",
      mode: "minor",
      bpm: 58,
      meter: 4,
      reverb: { room: 1, damp: 0.25, wet: 0.5 },
      sections: [
        { bars: 4, prog: ["Em9", "Cmaj7", "G", "D"], acc: "none", pad: true, sparkle: "bell", dyn: 0.5 },
        { bars: 8, prog: ["Em9", "Cmaj7", "G", "D", "Em9", "Am7", "Cmaj7", "Bsus4"], acc: "arp-slow", pad: true, sparkle: "bell", lead: "violin", range: [71, 88], density: "sparse", dyn: 0.55 },
        { bars: 8, prog: ["Cmaj7", "D", "Bm7", "Em9", "Am7", "D", "Gmaj7", "Bsus4"], acc: "none", pad: true, sparkle: "bell", lead: "viola", range: [60, 76], density: "sparse", bass: "cello", dyn: 0.6 },
        { bars: 6, prog: ["Em9", "Cmaj7", "G", "D", "Cmaj7", "Em9"], acc: "arp-slow", pad: true, sparkle: "bell", dyn: 0.45 },
      ],
    },
  },
  {
    title: "Morning Mist",
    description: "Gentle solo piano for a slow start to the day.",
    genre: "classical",
    mood: "peaceful",
    tags: ["piano", "solo piano", "morning", "calm", "relax"],
    album: "calm",
    cover: "mist",
    spec: {
      slug: "morning-mist",
      seed: 5531,
      key: "G",
      mode: "major",
      bpm: 66,
      meter: 4,
      brightness: 0.4,
      reverb: { room: 0.75, damp: 0.5, wet: 0.3 },
      sections: [
        { bars: 4, prog: ["Gmaj7", "Em7", "Cmaj7", "D"], acc: "arp", dyn: 0.4 },
        { bars: 8, prog: ["Gmaj7", "Em7", "Cmaj7", "D", "Bm7", "Em7", "Am7", "D7sus4"], acc: "arp", lead: "piano", range: [67, 83], density: "normal", dyn: 0.5 },
        { bars: 8, prog: ["Cmaj7", "D", "Bm7", "Em7", "Am7", "D", "Gmaj7", "D7sus4"], acc: "arp", lead: "piano", range: [69, 86], density: "flowing", dyn: 0.56 },
        { bars: 8, prog: ["Gmaj7", "Em7", "Cmaj7", "D", "Bm7", "Em7", "Am7", "G"], acc: "arp", lead: "piano", range: [67, 83], density: "sparse", dyn: 0.48 },
        { bars: 2, prog: ["Cmaj7", "Gmaj7"], acc: "arp-slow", dyn: 0.36 },
      ],
    },
  },
  {
    title: "Lakeside",
    description: "A quiet conversation between violin and piano by a still lake.",
    genre: "classical",
    mood: "romantic",
    tags: ["violin", "piano", "lake", "romantic", "calm"],
    album: "calm",
    cover: "lake",
    spec: {
      slug: "lakeside",
      seed: 6637,
      key: "C",
      mode: "major",
      bpm: 72,
      meter: 4,
      reverb: { room: 0.8, damp: 0.45, wet: 0.34 },
      sections: [
        { bars: 4, prog: ["Cmaj7", "Am7", "Fmaj7", "G7sus4"], acc: "arp", pad: true, dyn: 0.42 },
        { bars: 8, prog: ["Cmaj7", "Am7", "Fmaj7", "G7sus4", "Cmaj7", "Em7", "Fmaj7", "G"], acc: "arp", lead: "violin", range: [67, 84], density: "normal", pad: true, dyn: 0.55 },
        { bars: 8, prog: ["Fmaj7", "G", "Em7", "Am7", "Dm7", "G", "Cmaj7", "G7sus4"], acc: "arp", lead: "piano", range: [72, 86], density: "flowing", counter: "violin", pad: true, dyn: 0.6 },
        { bars: 8, prog: ["Cmaj7", "Am7", "Fmaj7", "G7sus4", "Cmaj7", "Em7", "Fmaj7", "C"], acc: "arp", lead: "violin", range: [67, 84], density: "normal", pad: true, bass: "cello", dyn: 0.56 },
        { bars: 2, prog: ["Fmaj7", "Cmaj7"], acc: "arp-slow", pad: true, dyn: 0.38 },
      ],
    },
  },
  {
    title: "Slow Breath",
    description: "Slow your breathing: wide layers of strings and sparse piano notes.",
    genre: "ambient",
    mood: "meditative",
    tags: ["ambient", "meditation", "sleep", "strings", "piano"],
    album: "calm",
    cover: "breath",
    spec: {
      slug: "slow-breath",
      seed: 7741,
      key: "Db",
      mode: "major",
      bpm: 54,
      meter: 4,
      brightness: 0.3,
      reverb: { room: 1, damp: 0.4, wet: 0.48 },
      sections: [
        { bars: 4, prog: ["Dbmaj7", "Bbm7", "Gbmaj7", "Ab"], acc: "none", pad: true, dyn: 0.5 },
        { bars: 8, prog: ["Dbmaj7", "Bbm7", "Gbmaj7", "Absus4", "Dbmaj7", "Fm7", "Gbmaj7", "Ab"], acc: "none", pad: true, lead: "piano", range: [68, 82], density: "sparse", dyn: 0.5 },
        { bars: 8, prog: ["Gbmaj7", "Ab", "Fm7", "Bbm7", "Ebm7", "Ab", "Dbmaj7", "Absus4"], acc: "arp-slow", pad: true, lead: "viola", range: [60, 75], density: "sparse", dyn: 0.55 },
        { bars: 6, prog: ["Dbmaj7", "Bbm7", "Gbmaj7", "Ab", "Gbmaj7", "Dbmaj7"], acc: "none", pad: true, lead: "piano", range: [68, 82], density: "sparse", dyn: 0.42 },
      ],
    },
  },
  {
    title: "Waltz Under the Snow",
    description: "A slow waltz under heavy snowfall: piano and violin.",
    genre: "classical",
    mood: "nostalgic",
    tags: ["waltz", "piano", "violin", "winter", "nostalgic"],
    album: "winter",
    cover: "waltz",
    spec: {
      slug: "waltz-under-the-snow",
      seed: 8849,
      key: "D",
      mode: "minor",
      bpm: 100,
      meter: 3,
      reverb: { room: 0.8, damp: 0.45, wet: 0.32 },
      sections: [
        { bars: 4, prog: ["Dm", "Gm", "A7", "Dm"], acc: "waltz", dyn: 0.45 },
        { bars: 16, prog: ["Dm", "Gm", "C", "F", "Bb", "Gm", "A7sus4", "A7", "Dm", "Gm", "C", "F", "Bb", "Gm", "A7", "Dm"], acc: "waltz", lead: "violin", range: [67, 84], density: "normal", dyn: 0.55 },
        { bars: 16, prog: ["F", "C", "Dm", "Am", "Bb", "F", "Gm", "A7", "F", "C", "Dm", "Am", "Bb", "Gm", "A7sus4", "A7"], acc: "waltz", lead: "piano", range: [69, 86], density: "flowing", pad: true, dyn: 0.6 },
        { bars: 16, prog: ["Dm", "Gm", "C", "F", "Bb", "Gm", "A7sus4", "A7", "Dm", "Gm", "C", "F", "Bb", "Gm", "A7", "Dm"], acc: "waltz", lead: "violin", range: [67, 84], density: "normal", counter: "cello", dyn: 0.56 },
        { bars: 4, prog: ["Bb", "Gm", "A7", "Dm"], acc: "waltz", pad: true, dyn: 0.4 },
      ],
    },
  },
];
