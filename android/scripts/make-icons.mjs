// Renders the brand mark (src/app/icon.svg) into Android launcher icons.
// Uses the web app's `sharp`; run from the repository root: node android/scripts/make-icons.mjs
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const sharp = createRequire(path.join(root, "package.json"))("sharp");
const svg = readFileSync(path.join(root, "src", "app", "icon.svg"));
const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [density, size] of Object.entries(sizes)) {
  const dir = path.join(here, "..", "app", "src", "main", "res", `mipmap-${density}`);
  mkdirSync(dir, { recursive: true });
  await sharp(svg, { density: 1024 }).resize(size, size).png().toFile(path.join(dir, "ic_launcher.png"));
}
console.log("wrote mipmap-*/ic_launcher.png");
