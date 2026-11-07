#!/usr/bin/env node
/**
 * End-to-end smoke test against a running AURALIS instance.
 * Self-contained and self-cleaning: it registers a throwaway account, uploads a
 * generated tone (no copyrighted audio), waits for processing, streams it with a
 * byte range, searches for it, checks security behavior, then deletes the account.
 *
 *   node scripts/smoke.mjs [baseUrl]        (default http://localhost:3000)
 *
 * Exit code 0 = all checks passed. Used by CI against the Docker Compose stack.
 */
import { randomBytes } from "node:crypto";

const BASE = (process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const API = `${BASE}/api/v1`;
const results = [];
let failed = 0;

function check(name, ok, detail = "") {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
}

async function call(path, { method = "GET", cookie, body, headers = {} } = {}) {
  const isForm = body instanceof FormData;
  const res = await fetch(API + path, {
    method,
    headers: { ...(cookie ? { cookie } : {}), ...(body && !isForm ? { "content-type": "application/json" } : {}), ...headers },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  let json = null;
  try {
    json = await res.clone().json();
  } catch {}
  return { status: res.status, json, res };
}

/** 8-second 440 Hz sine as 16-bit mono WAV, with a random amplitude so each run is unique. */
function toneWav() {
  const sr = 22050, n = sr * 8, buf = Buffer.alloc(44 + n * 2);
  const amp = 6000 + Math.floor(Math.random() * 6000);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / sr) * amp), 44 + i * 2);
  return buf;
}

async function waitForHealth(timeoutMs = 120_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const r = await call("/health");
      if (r.status === 200 && r.json?.db === "ok") return r.json;
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

const health = await waitForHealth();
check("health endpoint reports db ok", Boolean(health), health ? `db ${health.dbLatencyMs} ms` : "timed out");
if (!health) finish();

// Pages and headers
const home = await fetch(`${BASE}/`);
check("landing page renders", home.status === 200);
check("security headers present", home.headers.get("x-frame-options") === "DENY" && home.headers.get("x-content-type-options") === "nosniff");
check("no x-powered-by header", !home.headers.get("x-powered-by"));

// Account
const suffix = randomBytes(4).toString("hex");
const username = `smoke_${suffix}`;
const password = `Smoke-${randomBytes(9).toString("base64url")}1`;
const reg = await call("/auth/register", {
  method: "POST",
  body: { email: `${username}@smoke.test`, username, displayName: "Smoke Test", password, acceptTerms: true },
});
check("register", reg.status === 201, `status ${reg.status}`);
const cookie = reg.res.headers.get("set-cookie")?.split(";")[0];
check("session cookie is HttpOnly + SameSite", /HttpOnly/i.test(reg.res.headers.get("set-cookie") ?? "") && /SameSite=lax/i.test(reg.res.headers.get("set-cookie") ?? ""));
check("weak password rejected", (await call("/auth/register", { method: "POST", body: { email: `x${suffix}@smoke.test`, username: `x${suffix}`, displayName: "X", password: "short", acceptTerms: true } })).status === 422);

// On a fresh instance the first account becomes ADMIN, so authorization checks use a second, regular account.
const otherName = `smoke2_${suffix}`;
const reg2 = await call("/auth/register", {
  method: "POST",
  body: { email: `${otherName}@smoke.test`, username: otherName, displayName: "Smoke Other", password, acceptTerms: true },
});
const otherCookie = reg2.res.headers.get("set-cookie")?.split(";")[0];
check("second account is a regular user", reg2.status === 201 && reg2.json?.user?.role === "USER", `role ${reg2.json?.user?.role}`);
if (reg.json?.user?.role === "ADMIN") results.push("INFO  fresh instance: the first smoke account became the administrator");

// Upload → processing → stream
const form = new FormData();
form.append("meta", JSON.stringify({ title: `Smoke Tone ${suffix}`, visibility: "PUBLIC", rightsConfirmed: true }));
form.append("audio", new Blob([toneWav()], { type: "audio/wav" }), "smoke.wav");
const up = await call("/uploads", { method: "POST", cookie, body: form });
check("upload accepted", up.status === 201, `status ${up.status}`);
const trackId = up.json?.track?.id;

const bad = new FormData();
bad.append("meta", JSON.stringify({ rightsConfirmed: true }));
bad.append("audio", new Blob(["<html>not audio</html>"]), "fake.mp3");
check("non-audio upload rejected (415)", (await call("/uploads", { method: "POST", cookie, body: bad })).status === 415);

let status = up.json?.track?.status;
for (let i = 0; i < 30 && status === "PROCESSING"; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  status = (await call(`/tracks/${trackId}`, { cookie })).json?.track?.status;
}
check("background processing → READY", status === "READY", status);

const track = (await call(`/tracks/${trackId}`)).json?.track;
check("duration extracted", Math.abs((track?.durationMs ?? 0) - 8000) < 200, `${track?.durationMs} ms`);
const range = await fetch(`${API}/tracks/${trackId}/stream`, { headers: { range: "bytes=0-1023" } });
check("range streaming (206)", range.status === 206 && (await range.arrayBuffer()).byteLength === 1024, range.headers.get("content-range") ?? "");

const search = await call(`/search?q=${encodeURIComponent(`Smoke Tone ${suffix}`)}&type=tracks`);
check("search finds the upload", search.json?.items?.some((t) => t.id === trackId));

// Privacy & authorization
await call(`/tracks/${trackId}`, { method: "PATCH", cookie, body: { visibility: "PRIVATE" } });
check("private track hidden from anonymous stream", (await fetch(`${API}/tracks/${trackId}/stream`)).status === 404);
check("owner can still stream private track", (await fetch(`${API}/tracks/${trackId}/stream`, { headers: { cookie, range: "bytes=0-9" } })).status === 206);
check("anonymous blocked from moderation API (401)", (await call("/mod/reports")).status === 401);
check("regular user blocked from admin API (403)", (await call("/admin/stats", { cookie: otherCookie })).status === 403);
check("other user can't stream the private track", (await fetch(`${API}/tracks/${trackId}/stream`, { headers: { cookie: otherCookie } })).status === 404);
check("other user can't edit the track (404/403)", [403, 404].includes((await call(`/tracks/${trackId}`, { method: "PATCH", cookie: otherCookie, body: { title: "hijack" } })).status));
check("cross-origin write blocked (403)", (await call("/auth/logout", { method: "POST", headers: { origin: "https://evil.example" } })).status === 403);

// Playlist round-trip
const pl = await call("/playlists", { method: "POST", cookie, body: { title: "Smoke playlist" } });
const added = await call(`/playlists/${pl.json?.playlist?.id}/tracks`, { method: "POST", cookie, body: { trackIds: [trackId] } });
check("playlist create + add", pl.status === 201 && added.json?.added === 1);

// A private playlist must never reach anyone but its owner (search, profile, visitor preview).
const secretTitle = `Secret list ${suffix}`;
const secret = (await call("/playlists", { method: "POST", cookie, body: { title: secretTitle, visibility: "PRIVATE" } })).json?.playlist;
const hasSecret = (items) => (items ?? []).some((p) => p.id === secret?.id);
check("private playlist created", secret?.visibility === "PRIVATE");
check("private playlist hidden from anonymous search", !hasSecret((await call(`/search?q=${encodeURIComponent(secretTitle)}&type=playlists`)).json?.items));
check("private playlist hidden from other user's search", !hasSecret((await call(`/search?q=${encodeURIComponent(secretTitle)}&type=playlists`, { cookie: otherCookie })).json?.items));
check("private playlist hidden on public profile", !hasSecret((await call(`/users/${username}/content`)).json?.playlists));
check("private playlist hidden in owner's visitor preview", !hasSecret((await call(`/users/${username}/content?view=public`, { cookie })).json?.playlists));
check("owner still sees private playlist on own profile", hasSecret((await call(`/users/${username}/content`, { cookie })).json?.playlists));
check("private playlist 404 for other user", (await call(`/playlists/${secret?.id}`, { cookie: otherCookie })).status === 404);

// Cleanup: deleting the account removes the track, playlist and stored files.
const del = await call("/me/account", { method: "DELETE", cookie, body: { password } });
check("account deletion (cleanup)", del.status === 200);
check("deleted track is gone", (await call(`/tracks/${trackId}`)).status === 404);
check("second account deleted (cleanup)", (await call("/me/account", { method: "DELETE", cookie: otherCookie, body: { password } })).status === 200);

finish();

function finish() {
  console.log(`AURALIS smoke test against ${BASE}\n`);
  console.log(results.join("\n"));
  const checks = results.filter((r) => !r.startsWith("INFO"));
  console.log(`\n${checks.length - failed}/${checks.length} passed`);
  process.exit(failed ? 1 : 0);
}
