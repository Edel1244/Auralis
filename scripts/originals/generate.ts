/**
 * Renders the AURALIS Originals catalog to .data/originals/<slug>.wav
 * (16-bit stereo, 44.1 kHz). Deterministic: same code → same audio.
 *
 *   npx tsx scripts/originals/generate.ts [slug…]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderTrack } from "./compose";
import { SR } from "./synth";
import { TRACKS } from "./tracks";
import { encodeWav } from "../../src/audio/wav";

const outDir = path.resolve(".data/originals");
mkdirSync(outDir, { recursive: true });
const only = process.argv.slice(2);

for (const track of TRACKS) {
  if (only.length && !only.includes(track.spec.slug)) continue;
  const started = Date.now();
  const buf = renderTrack(track.spec);
  const wav = encodeWav({ numberOfChannels: 2, sampleRate: SR, length: buf.L.length, getChannelData: (c) => (c ? buf.R : buf.L) });
  writeFileSync(path.join(outDir, `${track.spec.slug}.wav`), Buffer.from(wav));
  let peak = 0;
  for (let i = 0; i < buf.L.length; i++) peak = Math.max(peak, Math.abs(buf.L[i]), Math.abs(buf.R[i]));
  console.log(`${track.spec.slug.padEnd(18)} ${(buf.L.length / SR).toFixed(1)}s  peak ${peak.toFixed(2)}  ${((Date.now() - started) / 1000).toFixed(1)}s`);
}
