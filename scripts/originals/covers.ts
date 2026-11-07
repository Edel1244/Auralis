/**
 * Draws the AURALIS Originals cover art as SVG and renders 1200×1200 PNGs to
 * .data/originals/<slug>.png (and album covers). Deterministic per seed.
 *
 *   npx tsx scripts/originals/covers.ts
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { rng } from "./synth";
import { ALBUMS, ARTIST, TRACKS, type CoverTheme } from "./tracks";

const sharp = createRequire(path.resolve("package.json"))("sharp");
const S = 1200;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function snow(r: () => number, count: number, color = "#fff", maxR = 5, minOpacity = 0.35) {
  let out = "";
  for (let i = 0; i < count; i++) {
    const rad = 1 + r() * maxR;
    out += `<circle cx="${(r() * S).toFixed(0)}" cy="${(r() * S).toFixed(0)}" r="${rad.toFixed(1)}" fill="${color}" opacity="${(minOpacity + r() * (1 - minOpacity)).toFixed(2)}"/>`;
  }
  return out;
}

function stars(r: () => number, count: number) {
  let out = "";
  for (let i = 0; i < count; i++) out += `<circle cx="${(r() * S).toFixed(0)}" cy="${(r() * S * 0.6).toFixed(0)}" r="${(0.6 + r() * 1.6).toFixed(1)}" fill="#fff" opacity="${(0.3 + r() * 0.7).toFixed(2)}"/>`;
  return out;
}

/** Smooth ridge line across the canvas (hills / mountains). */
function ridge(r: () => number, baseY: number, amp: number, points: number, sharpness = 0.5) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= points; i++) pts.push([(i / points) * S, baseY - (r() * amp + (i % 2 ? amp * sharpness : 0))]);
  let d = `M0,${S} L0,${pts[0][1].toFixed(0)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const mx = (x0 + x1) / 2;
    d += ` Q${x0.toFixed(0)},${y0.toFixed(0)} ${mx.toFixed(0)},${((y0 + y1) / 2).toFixed(0)}`;
  }
  return d + ` L${S},${pts[pts.length - 1][1].toFixed(0)} L${S},${S} Z`;
}

/** Six-armed snow crystal. */
function crystal(cx: number, cy: number, size: number, opacity: number) {
  let arms = "";
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    const x = cx + Math.cos(a) * size;
    const y = cy + Math.sin(a) * size;
    arms += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
    for (const f of [0.45, 0.7]) {
      const bx = cx + Math.cos(a) * size * f;
      const by = cy + Math.sin(a) * size * f;
      for (const s of [-1, 1]) {
        const b = a + s * 0.7;
        arms += `<line x1="${bx.toFixed(1)}" y1="${by.toFixed(1)}" x2="${(bx + Math.cos(b) * size * 0.25).toFixed(1)}" y2="${(by + Math.sin(b) * size * 0.25).toFixed(1)}"/>`;
      }
    }
  }
  return `<g stroke="#fff" stroke-width="${Math.max(2, size / 30).toFixed(1)}" stroke-linecap="round" opacity="${opacity}">${arms}</g>`;
}

function art(theme: CoverTheme, seed: number): string {
  const r = rng(seed);
  switch (theme) {
    case "first-snow":
      return `
        <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B1E4A"/><stop offset="0.65" stop-color="#2D5BA8"/><stop offset="1" stop-color="#9CC7F2"/></linearGradient>
        <radialGradient id="glow" cx="0.72" cy="0.24" r="0.25"><stop offset="0" stop-color="#FFF6D8" stop-opacity="0.9"/><stop offset="1" stop-color="#FFF6D8" stop-opacity="0"/></radialGradient></defs>
        <rect width="${S}" height="${S}" fill="url(#sky)"/><rect width="${S}" height="${S}" fill="url(#glow)"/>
        <circle cx="${S * 0.72}" cy="${S * 0.24}" r="62" fill="#FFF8E6"/>
        <path d="${ridge(r, S * 0.78, 60, 6, 0.3)}" fill="#DDEBFA"/>
        <path d="${ridge(r, S * 0.86, 40, 5, 0.2)}" fill="#F4F9FF"/>
        ${snow(r, 260)}`;
    case "frost":
      return `
        <defs><radialGradient id="ice" cx="0.4" cy="0.35" r="0.85"><stop offset="0" stop-color="#E9FBFF"/><stop offset="0.5" stop-color="#7FD3F0"/><stop offset="1" stop-color="#0E4C77"/></radialGradient></defs>
        <rect width="${S}" height="${S}" fill="url(#ice)"/>
        ${Array.from({ length: 14 }, () => crystal(r() * S, r() * S, 40 + r() * 170, Number((0.25 + r() * 0.5).toFixed(2)))).join("")}
        <rect x="70" y="70" width="${S - 140}" height="${S - 140}" rx="18" fill="none" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="6"/>
        <line x1="${S / 2}" y1="70" x2="${S / 2}" y2="${S - 70}" stroke="#fff" stroke-opacity="0.3" stroke-width="6"/>
        <line x1="70" y1="${S / 2}" x2="${S - 70}" y2="${S / 2}" stroke="#fff" stroke-opacity="0.3" stroke-width="6"/>`;
    case "fireplace":
      return `
        <defs><radialGradient id="warm" cx="0.5" cy="0.78" r="0.8"><stop offset="0" stop-color="#FFC56B"/><stop offset="0.35" stop-color="#E0642A"/><stop offset="0.75" stop-color="#5A1E1A"/><stop offset="1" stop-color="#1E0B0C"/></radialGradient>
        <filter id="blur"><feGaussianBlur stdDeviation="28"/></filter></defs>
        <rect width="${S}" height="${S}" fill="url(#warm)"/>
        <g filter="url(#blur)">${Array.from({ length: 9 }, (_, i) => `<ellipse cx="${(S * 0.3 + r() * S * 0.4).toFixed(0)}" cy="${(S * 0.62 + r() * S * 0.2).toFixed(0)}" rx="${(60 + r() * 90).toFixed(0)}" ry="${(120 + r() * 140).toFixed(0)}" fill="${["#FFD27A", "#FF9A3D", "#FF6A2B"][i % 3]}" opacity="0.7"/>`).join("")}</g>
        ${Array.from({ length: 60 }, () => `<circle cx="${(S * 0.35 + r() * S * 0.3).toFixed(0)}" cy="${(S * 0.15 + r() * S * 0.55).toFixed(0)}" r="${(1.5 + r() * 3.5).toFixed(1)}" fill="#FFD9A0" opacity="${(0.3 + r() * 0.6).toFixed(2)}"/>`).join("")}
        <rect x="80" y="80" width="300" height="380" rx="14" fill="#0B1530" opacity="0.85"/>
        <g opacity="0.9">${snow(rng(seed + 1), 50, "#fff", 3.5).replace(/cx="(\d+)"/g, (_, x) => `cx="${80 + (Number(x) % 300)}"`).replace(/cy="(\d+)"/g, (_, y) => `cy="${80 + (Number(y) % 380)}"`)}</g>
        <rect x="80" y="80" width="300" height="380" rx="14" fill="none" stroke="#3B2216" stroke-width="16"/>
        <line x1="230" y1="80" x2="230" y2="460" stroke="#3B2216" stroke-width="12"/>`;
    case "aurora":
      return `
        <defs><linearGradient id="night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#030714"/><stop offset="1" stop-color="#0B1E35"/></linearGradient>
        <linearGradient id="a1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2EF2B5" stop-opacity="0"/><stop offset="0.5" stop-color="#2EF2B5"/><stop offset="1" stop-color="#3DF2FF" stop-opacity="0"/></linearGradient>
        <linearGradient id="a2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8B5CF6" stop-opacity="0"/><stop offset="0.5" stop-color="#7C9CFF"/><stop offset="1" stop-color="#008CFF" stop-opacity="0"/></linearGradient>
        <filter id="soft"><feGaussianBlur stdDeviation="22"/></filter></defs>
        <rect width="${S}" height="${S}" fill="url(#night)"/>${stars(r, 160)}
        <g filter="url(#soft)" opacity="0.85">
          <path d="M-100,${S * 0.42} C${S * 0.25},${S * 0.15} ${S * 0.55},${S * 0.55} ${S + 100},${S * 0.25}" stroke="url(#a1)" stroke-width="140" fill="none"/>
          <path d="M-100,${S * 0.3} C${S * 0.3},${S * 0.5} ${S * 0.6},${S * 0.05} ${S + 100},${S * 0.38}" stroke="url(#a2)" stroke-width="90" fill="none"/>
        </g>
        <path d="${ridge(r, S * 0.8, 170, 7, 0.9)}" fill="#07101F"/>
        <path d="${ridge(r, S * 0.9, 70, 6, 0.4)}" fill="#E6F0FA" opacity="0.92"/>`;
    case "mist":
      return `
        <defs><linearGradient id="dawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FBD3C2"/><stop offset="0.5" stop-color="#E8C4E8"/><stop offset="1" stop-color="#B9C6F0"/></linearGradient>
        <filter id="haze"><feGaussianBlur stdDeviation="10"/></filter></defs>
        <rect width="${S}" height="${S}" fill="url(#dawn)"/>
        <circle cx="${S * 0.3}" cy="${S * 0.36}" r="110" fill="#FFF3E6" opacity="0.9"/>
        <g filter="url(#haze)">
          <path d="${ridge(r, S * 0.62, 90, 5, 0.3)}" fill="#C7B3DE" opacity="0.7"/>
          <path d="${ridge(r, S * 0.72, 80, 5, 0.3)}" fill="#A99BD4" opacity="0.75"/>
          <path d="${ridge(r, S * 0.84, 60, 4, 0.2)}" fill="#7F7BBE" opacity="0.8"/>
        </g>`;
    case "lake":
      return `
        <defs><linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0F2E3D"/><stop offset="0.5" stop-color="#1F6E7A"/><stop offset="0.5" stop-color="#16505E"/><stop offset="1" stop-color="#082029"/></linearGradient></defs>
        <rect width="${S}" height="${S}" fill="url(#dusk)"/>${stars(r, 70)}
        <circle cx="${S * 0.62}" cy="${S * 0.3}" r="80" fill="#F2F7E9"/>
        <path d="${ridge(r, S * 0.5, 110, 6, 0.6)}" fill="#0A2530"/>
        <rect y="${S * 0.5}" width="${S}" height="${S * 0.5}" fill="#0C3440"/>
        ${Array.from({ length: 16 }, (_, i) => `<rect x="${(S * 0.62 - 70 + r() * 20 - i * 2).toFixed(0)}" y="${(S * 0.54 + i * 22).toFixed(0)}" width="${(140 - i * 5 + r() * 30).toFixed(0)}" height="5" rx="2.5" fill="#F2F7E9" opacity="${(0.65 - i * 0.035).toFixed(2)}"/>`).join("")}`;
    case "breath":
      return `
        <defs><radialGradient id="bg" cx="0.5" cy="0.5" r="0.75"><stop offset="0" stop-color="#2A2F6B"/><stop offset="1" stop-color="#0A0C1F"/></radialGradient>
        <radialGradient id="orb" cx="0.5" cy="0.45" r="0.5"><stop offset="0" stop-color="#C9F3FF"/><stop offset="0.45" stop-color="#7CC4FF"/><stop offset="1" stop-color="#7CC4FF" stop-opacity="0"/></radialGradient></defs>
        <rect width="${S}" height="${S}" fill="url(#bg)"/>
        ${[420, 340, 260].map((rad, i) => `<circle cx="${S / 2}" cy="${S * 0.45}" r="${rad}" fill="none" stroke="#9AD7FF" stroke-opacity="${0.12 + i * 0.08}" stroke-width="2"/>`).join("")}
        <circle cx="${S / 2}" cy="${S * 0.45}" r="230" fill="url(#orb)" opacity="0.9"/>`;
    case "waltz":
      return `
        <defs><linearGradient id="vio" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1B1036"/><stop offset="1" stop-color="#4A1F6E"/></linearGradient>
        <linearGradient id="rib" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FF8FD1"/><stop offset="1" stop-color="#9AA8FF"/></linearGradient></defs>
        <rect width="${S}" height="${S}" fill="url(#vio)"/>${snow(r, 180, "#fff", 4)}
        ${[0, 1, 2].map((k) => `<path d="M${-50},${S * (0.35 + k * 0.12)} C${S * 0.3},${S * (0.15 + k * 0.12)} ${S * 0.6},${S * (0.6 + k * 0.08)} ${S + 50},${S * (0.3 + k * 0.12)}" stroke="url(#rib)" stroke-width="${16 - k * 4}" fill="none" opacity="${0.75 - k * 0.2}"/>`).join("")}
        ${crystal(S * 0.78, S * 0.2, 70, 0.8)}`;
  }
}

function cover(theme: CoverTheme, seed: number, title: string, subtitle = ARTIST) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    ${art(theme, seed)}
    <defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></linearGradient></defs>
    <rect width="${S}" height="${S}" fill="url(#shade)"/>
    <text x="80" y="${S - 150}" font-family="Segoe UI, Arial, sans-serif" font-size="92" font-weight="700" fill="#fff">${esc(title)}</text>
    <text x="84" y="${S - 88}" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="600" letter-spacing="8" fill="#fff" fill-opacity="0.82">${esc(subtitle.toUpperCase())}</text>
  </svg>`;
}

async function main() {
const outDir = path.resolve(".data/originals");
mkdirSync(outDir, { recursive: true });
for (const t of TRACKS) {
  await sharp(Buffer.from(cover(t.cover, t.spec.seed, t.title))).png().toFile(path.join(outDir, `${t.spec.slug}.png`));
  console.log("cover", t.spec.slug);
}
for (const [key, a] of Object.entries(ALBUMS)) {
  await sharp(Buffer.from(cover(a.cover, key.length * 97, a.title, `${ARTIST} · Album`))).png().toFile(path.join(outDir, `album-${key}.png`));
  console.log("cover album", key);
}
  // Profile picture and banner: artwork only, no text.
  const plain = (theme: CoverTheme, seed: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${art(theme, seed)}</svg>`;
  await sharp(Buffer.from(plain("aurora", 4421))).resize(800, 800).png().toFile(path.join(outDir, "avatar.png"));
  await sharp(Buffer.from(plain("aurora", 4421))).extract({ left: 0, top: 180, width: S, height: 400 }).resize(1500, 500).png().toFile(path.join(outDir, "banner.png"));
  console.log("avatar + banner");
}

void main();
