export const AUDIO_TYPES: Record<string, { mime: string; lossless: boolean }> = {
  mp3: { mime: "audio/mpeg", lossless: false },
  wav: { mime: "audio/wav", lossless: true },
  flac: { mime: "audio/flac", lossless: true },
  ogg: { mime: "audio/ogg", lossless: false },
  oga: { mime: "audio/ogg", lossless: false },
  m4a: { mime: "audio/mp4", lossless: false },
  aac: { mime: "audio/aac", lossless: false },
};

const IMAGE_TYPES: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

export function extOf(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function contentTypeForKey(key: string) {
  const ext = extOf(key);
  return AUDIO_TYPES[ext]?.mime ?? IMAGE_TYPES[ext] ?? "application/octet-stream";
}
