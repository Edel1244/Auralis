/** Anything shaped like an AudioBuffer (lets the encoder run in unit tests). */
export type PcmSource = { numberOfChannels: number; sampleRate: number; length: number; getChannelData(ch: number): Float32Array };

/** Encodes PCM audio as a 16-bit little-endian WAV file (samples are clipped to [-1, 1]). */
export function encodeWav(buf: PcmSource): ArrayBuffer {
  const channels = Math.min(2, buf.numberOfChannels);
  const frames = buf.length;
  const bytesPerFrame = channels * 2;
  const dataBytes = frames * bytesPerFrame;
  const out = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(out);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + dataBytes, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true); // PCM chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, channels, true);
  v.setUint32(24, buf.sampleRate, true);
  v.setUint32(28, buf.sampleRate * bytesPerFrame, true);
  v.setUint16(32, bytesPerFrame, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, dataBytes, true);
  const data = Array.from({ length: channels }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i]));
      v.setInt16(o, s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff), true);
      o += 2;
    }
  }
  return out;
}
