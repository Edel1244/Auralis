/**
 * Publishes the rendered AURALIS Originals (.data/originals) to a running
 * AURALIS server through its public API: creates or signs in to the artist
 * account, creates the two albums, uploads every track with cover art and
 * analysis, and builds a public playlist. Safe to re-run: existing tracks
 * (same title by this account) are skipped.
 *
 *   ORIGINALS_EMAIL=… ORIGINALS_PASSWORD=… npx tsx scripts/originals/publish.ts [baseUrl]
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { analyzeChannels } from "../../src/audio/analysis";
import { ALBUMS, ARTIST, LICENSE, TRACKS } from "./tracks";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const API = `${BASE}/api/v1`;
const EMAIL = process.env.ORIGINALS_EMAIL;
const PASSWORD = process.env.ORIGINALS_PASSWORD;
const USERNAME = process.env.ORIGINALS_USERNAME ?? "auralis_originals";
const dir = path.resolve(".data/originals");
let cookie = "";

async function call<T = Record<string, unknown>>(p: string, init: { method?: string; body?: unknown; form?: FormData } = {}): Promise<{ status: number; json: T }> {
  const res = await fetch(API + p, {
    method: init.method ?? (init.body || init.form ? "POST" : "GET"),
    headers: { ...(cookie ? { cookie } : {}), ...(init.body ? { "content-type": "application/json" } : {}) },
    body: init.form ?? (init.body ? JSON.stringify(init.body) : undefined),
  });
  const set = res.headers.getSetCookie?.() ?? [];
  const session = set.find((c) => c.startsWith("auralis_session=") || c.includes("session"));
  if (session) cookie = session.split(";")[0];
  let json = {} as T;
  try {
    json = (await res.json()) as T;
  } catch {}
  return { status: res.status, json };
}

function fail(msg: string, detail?: unknown): never {
  console.error(msg, detail ?? "");
  process.exit(1);
}

/** Reads a 16-bit stereo WAV written by generate.ts into float channels. */
function readWav(file: string) {
  const b = readFileSync(file);
  const frames = (b.length - 44) / 4;
  const L = new Float32Array(frames);
  const R = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    L[i] = b.readInt16LE(44 + i * 4) / 32768;
    R[i] = b.readInt16LE(46 + i * 4) / 32768;
  }
  return { bytes: b, channels: [L, R], sampleRate: b.readUInt32LE(24) };
}

const file = (name: string, type: string) => new Blob([readFileSync(path.join(dir, name))], { type });

async function main() {
  if (!EMAIL || !PASSWORD) fail("Set ORIGINALS_EMAIL and ORIGINALS_PASSWORD (the artist account to publish as).");

  // Sign in, or create the account on first run.
  let login = await call("/auth/login", { body: { identifier: EMAIL, password: PASSWORD } });
  if (login.status !== 200) {
    const reg = await call("/auth/register", { body: { email: EMAIL, username: USERNAME, displayName: ARTIST, password: PASSWORD, acceptTerms: true } });
    if (reg.status !== 201) fail("Could not sign in or register:", reg.json);
    login = await call("/auth/login", { body: { identifier: EMAIL, password: PASSWORD } });
  }
  if (!cookie) fail("No session cookie received.");
  await call("/me/profile", {
    method: "PATCH",
    body: { displayName: ARTIST, isArtist: true, bio: "Sakin, özgün müzikler: piyano, keman ve yaylılar. Hepsi AURALIS için üretildi, CC BY 4.0. / Calm original music for piano, violin and strings, made for AURALIS (CC BY 4.0)." },
  });
  for (const kind of ["avatar", "banner"]) {
    const f = new FormData();
    f.append("file", file(`${kind}.png`, "image/png"), `${kind}.png`);
    await call(`/me/images/${kind}`, { form: f });
  }

  const genres = (await call<{ items: { id: string; slug: string }[] }>("/genres")).json.items ?? [];
  const genreId = (slug: string) => genres.find((g) => g.slug === slug)?.id ?? null;

  const mine = (await call<{ items: { id: string; title: string }[] }>("/me/tracks?limit=100")).json.items ?? [];
  const myAlbums = (await call<{ own: { id: string; title: string }[] }>("/me/albums")).json.own ?? [];

  const albumIds: Record<string, string> = {};
  for (const [key, a] of Object.entries(ALBUMS)) {
    const existing = myAlbums.find((x) => x.title === a.title);
    if (existing) {
      albumIds[key] = existing.id;
      continue;
    }
    const form = new FormData();
    form.append("meta", JSON.stringify({ title: a.title, artistName: ARTIST, description: a.description, genreId: genreId("classical"), visibility: "PUBLIC" }));
    form.append("cover", file(`album-${key}.png`, "image/png"), `album-${key}.png`);
    const r = await call<{ album: { id: string } }>("/albums", { form });
    if (r.status !== 201) fail(`Album "${a.title}" failed:`, r.json);
    albumIds[key] = r.json.album.id;
    console.log("album", a.title);
  }

  const trackIds: string[] = [];
  const numbers: Record<string, number> = { winter: 0, calm: 0 };
  for (const t of TRACKS) {
    numbers[t.album]++;
    const existing = mine.find((x) => x.title === t.title);
    if (existing) {
      trackIds.push(existing.id);
      console.log("skip (exists)", t.title);
      continue;
    }
    const wav = readWav(path.join(dir, `${t.spec.slug}.wav`));
    const analysis = { ...analyzeChannels(wav.channels, wav.sampleRate), bpm: t.spec.bpm };
    const form = new FormData();
    form.append(
      "meta",
      JSON.stringify({
        title: t.title,
        artistName: ARTIST,
        description: t.description,
        genreId: genreId(t.genre),
        tags: t.tags,
        mood: t.mood,
        visibility: "PUBLIC",
        ownership: "CREATIVE_COMMONS",
        licenseNote: LICENSE,
        albumId: albumIds[t.album],
        trackNumber: numbers[t.album],
        releaseDate: "2026-11-07",
        rightsConfirmed: true,
        analysis,
      }),
    );
    form.append("audio", new Blob([wav.bytes], { type: "audio/wav" }), `${t.spec.slug}.wav`);
    form.append("artwork", file(`${t.spec.slug}.png`, "image/png"), `${t.spec.slug}.png`);
    const r = await call<{ track: { id: string } }>("/uploads", { form });
    if (r.status !== 201) fail(`Upload "${t.title}" failed:`, r.json);
    trackIds.push(r.json.track.id);
    console.log("uploaded", t.title);
  }

  const playlists = (await call<{ items: { id: string; title: string }[] }>("/me/playlists")).json.items ?? [];
  const title = "Sakinleştirici Melodiler";
  if (!playlists.some((p) => p.title === title)) {
    const pl = await call<{ playlist: { id: string } }>("/playlists", {
      body: { title, description: "Piyano, keman ve kış esintili sakin parçalar: çalışırken, okurken ya da uyumadan önce. / Calm piano, violin and wintry pieces for focus, reading or sleep.", visibility: "PUBLIC" },
    });
    if (pl.status !== 201) fail("Playlist failed:", pl.json);
    await call(`/playlists/${pl.json.playlist.id}/tracks`, { body: { trackIds } });
    console.log("playlist", title);
  }
  console.log("done");
}

void main();
