// Renders the brand mark (src/app/icon.svg) to desktop/build/icon.png (512×512).
// electron-builder turns that PNG into the Windows .ico. Uses the web app's
// `sharp`, so run it from the repository root: node desktop/scripts/make-icon.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const sharp = createRequire(path.join(root, "package.json"))("sharp");
const svg = readFileSync(path.join(root, "src", "app", "icon.svg"));
await sharp(svg, { density: 1024 }).resize(512, 512).png().toFile(path.join(here, "..", "build", "icon.png"));
console.log("wrote desktop/build/icon.png");
