# AURALIS: Development Progress

_Last updated: 2026-11-07. All seven phases complete; post-release fixes in progress._

Legend: ✅ implemented and verified · ☑️ implemented, verified indirectly (API/unit test or smoke test only) · 🟡 partial (see note) · 📋 planned

## Verification summary

| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | 0 errors |
| ESLint | 0 errors, 0 warnings |
| Unit tests (Vitest) | 45/45: queue, audio file-type detection, HTTP ranges, DSP/BPM, recommendations, studio math, theme validation, moderation rules, Docker/Compose config checks |
| End-to-end RBAC/moderation script | 37/37 (role denials, takedowns, strikes → auto-suspension, ban/unban, audit log) |
| Production build (`next build`, standalone) | Clean, no warnings. Tested: pages, login cookie flags, Range streaming, CSRF block, image processing, CSP with no violations, health endpoint |
| Browser testing | Every page renders; upload → processing → playback, navigation without interruption, EQ effect measured, studio flows, themes, settings, dashboards; no horizontal overflow at 375 px on 12 key pages |
| Dependency audit | `npm audit --omit=dev`: 0 vulnerabilities; 478 packages, all AGPL-compatible licenses |
| API smoke test (`scripts/smoke.mjs`) | 25/25 against the dev instance, and 25/25 against a production build on a **fresh** database configured only through environment variables (simulating the CI integration job) |
| CI (`.github/workflows/ci.yml`) | ✅ All three jobs pass on GitHub Actions (`Edel1244/Auralis`): checks, integration (PostgreSQL 17 + production build + smoke test), Docker |
| Docker | ✅ Image builds in CI; the Compose stack (PostgreSQL + app) starts, migrations apply, health checks pass, the smoke test passes against the container, and the image contains no secrets or local data. First-run fixes: route types generated before `tsc`, `prisma validate` given a placeholder URL at build time, and no required variables in the optional MinIO profile |
| Docker with S3 (`--profile s3`, MinIO) | 🟡 Not exercised in CI; the local storage driver is what's tested |
| Production server kit (`deploy/`) | ☑️ Caddy HTTPS override, `setup-server.sh`, `update.sh`, Turkish guide ([docs/DEPLOY.tr.md](docs/DEPLOY.tr.md)). Scripts pass `bash -n`; config covered by `tests/deploy-config.test.ts`. **Not yet run on a real server** |
| Admin bootstrap (`BOOTSTRAP_ADMIN_EMAIL`) | ✅ 8/8 on a fresh production build: an earlier sign-up isn't promoted; the configured address is promoted only after email verification (case-insensitive); later sign-ups stay regular |

## Requirements checklist

### 1. Brand & design
- ✅ Original logo (wave-crossbar "A" in an aura ring), app icon, favicon, Apple/PWA icons, wordmark, animated loading mark, splash screen ([docs/BRAND.md](docs/BRAND.md))
- ✅ Azure Blue `#008CFF` / Deep Black `#080B10` / Charcoal `#111720` / Cyan accent palette as runtime tokens
- ✅ Desktop-first and responsive, mobile mini-player and bottom nav, full-screen player, empty states, skeletons, hover effects, motion (respects reduced motion), accessible components (names checked; focus-trapped dialogs)
- ✅ Centralized, typed i18n: English + Turkish, switchable in settings and on the landing page, saved to the account
- 📋 Custom brand illustrations beyond the logo/hero graphics

### 2. Development philosophy
- ✅ Built in phases with tests after each; no fake buttons or pages. Limitations are listed below.

### 3. Authentication & accounts
- ✅ Registration, login/logout, email verification, password reset, Argon2id, hashed sessions with sliding expiry, unique usernames
- ✅ Account settings (password, email, sessions, delete account), profiles (avatar, banner, bio), public/private profiles, stats, follow/unfollow, followers/following lists, recently played, history, favorites, public playlists on profiles, personal library

### 4. Player
- ✅ Play/pause/prev/next/seek/volume/mute/shuffle/repeat one & all, queue (reorder/remove/play next/clear), recently played, history, persisted state, keyboard shortcuts, speed, gapless (near-gapless; see limitations), crossfade, mini, expanded and full-screen players, background playback via Media Session
- ✅ 10-band EQ, bass boost, treble, balance, normalization, crossfade duration, visualizer (3 modes), spectrum analyzer, waveform
- 🟡 Quality selection: the UI and API support alternate encodings, but no server-side transcoder is bundled (needs ffmpeg), so only originals exist and "High" falls back to the original
- ✅ The engine is independent of the UI (`src/audio`)

### 5. Uploads
- ✅ Single, multiple and album uploads; title, artist, album, artwork, description, genre, tags, release date, visibility; edit and delete; metadata and duration extraction; waveform; artwork thumbnails (WebP)
- ✅ Progress, size limits, quotas, file-type check by content, duplicate detection, background processing, secure file handling, permissions, rate limits
- ✅ Copyright: reports, moderation, takedown form, repeat-infringer policy (3 strikes), ownership/license records; public ≠ cleared

### 6. Discovery & search
- ✅ Search across songs, artists, albums, playlists, genres, profiles; instant results, suggestions, history, trending searches, filters (genre/year/duration)
- ✅ Home: recently played, recommended, trending, community uploads, new releases, artists, genres, featured playlists, albums; Explore and genre pages
- ✅ Modular recommendation engine (pluggable signals)

### 7. Playlists
- ✅ Create, rename, describe, cover, background, add/remove, drag-and-drop reorder (+ keyboard), sort, shuffle, duplicate, delete, visibility, share link, follow
- ✅ Collaborative playlists with contributors and permissions (editor/viewer); "Recently added" sort
- 🟡 Playlist folders: the field exists in the schema/API, but there's no folder UI yet
- 📋 Smart playlists and automatic genre playlists (schema fields `kind`/`smartRules` reserved)

### 8. Mixing Studio
- ✅ Two decks, independent transport and volume, crossfader, tempo, independent pitch, key lock, BPM detection, tempo sync, waveforms, loops, cue + hot cues, 3-band EQ, filter, echo, save sessions, record and export (only for own, public-domain or CC tracks)
- 🟡 Beat sync matches tempo only (no automatic phase alignment); nudge is provided

### 9. Profiles & social
- ✅ Customizable profiles, follow, like songs, follow/save playlists and albums, share links, comments (can be turned off per track), collaboration, discover users, privacy settings (private profile, stats, following, listening activity)
- ✅ Notifications (follows, likes, comments, playlist activity, upload ready/failed, removals, account status, report outcomes)

### 10. Customization
- ✅ Primary/accent/background/surface colors, light/dark/system, gradients, player style, sidebar, fonts, density, motion, corner radius, live preview, saved to the account and restored on login
- ✅ Community themes: create, export/import JSON, publish, gallery with preview, install and report

### 11. Pages
- ✅ All 25 requested sections exist and are functional: Landing, Login, Register, Home, Explore, Search, Library, Playlists (sidebar, library, `/playlist/:id`), Albums (`/album/:id`, library), Artists (artist profiles `/u/:username`), User profiles, Upload, Upload management, Mixing Studio, Equalizer, History, Favorites, Notifications, Account, Appearance, Privacy settings, Artist dashboard, Admin, Moderation, About
- ➕ Also: Track, Genre, Community Themes, Copyright request, verify email, password reset

### 12. Administration & moderation
- ✅ Roles USER/MODERATOR/ADMIN enforced on the server; user list and management, suspend/ban, report review, content removal, genre management, upload review, platform statistics, storage monitoring, copyright complaint review, audit log

### 13. Stack & architecture
- ✅ Next.js 16, TypeScript, Tailwind v4, Motion, Node.js, PostgreSQL + Prisma, Web Audio API + HTML5 audio, S3-compatible and local storage, Docker + Compose, environment configuration
- ✅ Modules, relations, indexes, validation, error handling, authorization, pagination, structured logging, caching headers; HTTP Range; private media protection
- 🟡 Media Source Extensions were not needed: progressive `<audio>` with Range covers streaming and seeking

### 14. Open source
- ✅ README, LICENSE (AGPL-3.0), CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, `.env.example`, Dockerfile, `docker-compose.yml`, migrations, API docs, architecture docs, THIRD_PARTY_LICENSES (generated), backup script, no hardcoded secrets

### 15. Signature features
- ✅ Artist Mode (dashboard), Community Themes, Advanced statistics (artist + admin + profile stats)
- 📋 AURALIS Wrapped, Listening Rooms (synchronized listening), AI/mood discovery (a `mood` field exists), offline mode (PWA manifest exists, no service worker yet), lyrics (no licensed source integrated)

### 16. Security & performance
- ✅ Everything in [SECURITY.md](SECURITY.md): rate limits (per endpoint + global writes), CSRF, CSP and security headers, upload hardening, privacy controls, safe errors, audit and structured logs, backups (`scripts/backup.sh`)
- ✅ Lazy image loading, WebP images, Range streaming, pagination, indexed queries, cached immutable images, rAF-isolated playhead re-renders

## Post-release fixes (2026-11-07)
- ✅ **Visibility clarity.** Private/unlisted tracks, albums and playlists now show a lock/link badge on cards and in the sidebar. Owners can switch their profile to **View as visitors** (`GET /users/:u/content?view=public`). Smoke tests prove private playlists are absent from anonymous and other-user search, from the public profile and from the visitor preview. Note: the server never leaked private items; the owner's own view simply looked identical to the public one.
- ✅ **Honest email status.** `/auth/me` reports `instance.emailDelivery` (`smtp` | `outbox`). Without `SMTP_URL`, the verify banner no longer claims "sent". In development it links to **/dev/mailbox** (`GET /api/v1/dev/mailbox`), which shows only the signed-in user's own outbox mail. That endpoint returns 404 in production or when SMTP is configured. The admin overview warns when outgoing email isn't configured. Unit tests: `tests/mail-outbox.test.ts`.

## Version 1.0.0 (2026-11-07)
- ✅ **Merge two songs** (Mixing Studio): offline, sample-accurate render of deck A → equal-power crossfade → deck B, with optional tempo match and bass swap. The result is previewed, downloaded as 16-bit WAV, or published as a new track (rights permitting, private by default). Capped at 18 minutes. Unit tests: `tests/merge.test.ts`; verified in the browser (56 s render, no clipping).
- ✅ **Auto transition**: starts the other deck and sweeps the crossfader over 4–32 s.
- ✅ **Equalizer fixes**: the filter chain worked, but stacked boosts clipped and distorted. It now has automatic headroom computed from the exact biquad response (RBJ formulas, as in Web Audio), a -1 dBFS limiter, a live response curve, the matching preset name, and server preferences applied only once per login (they used to snap sliders back after each save). Unit tests: `tests/eq.test.ts`.
- ✅ **Bug fixes**: playlist cover mosaics no longer use artwork from tracks the viewer can't see, and one long playlist no longer starves the others; the studio track picker starts with an empty search.
- ✅ **Desktop app** (`desktop/`, Electron): connects to a configurable server with a first-run setup screen, keeps navigation to that origin, update check via GitHub Releases, NSIS installer. Releases are built by `.github/workflows/desktop-release.yml` on `v*` tags.
- ✅ **Android app** (`android/`, native Java WebView): first-run server setup through an `auralis-setup://` scheme honoured only on the bundled page, origin-locked navigation, file chooser for uploads, DownloadManager downloads, edge-to-edge insets, update check against `android-v*` releases. Built and signed by `.github/workflows/android-release.yml` (key held in repository secrets). Releases are titled "(Android)" and "(Desktop)".

## Known limitations
- Single-instance defaults: in-memory rate limiter and job queue (swap points documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md))
- Gapless playback is near-gapless (HTMLAudio switch on `ended`); crossfade is sample-accurate
- No server-side transcoding or waveform generation for files uploaded through the raw API without browser analysis
- Search uses substring matching (fine for small and medium instances)
- The CSP allows inline scripts (required by Next.js); nonce-based CSP is planned
- Android: Mixing Studio WAV exports (blob URLs) can't be downloaded inside the app; playback continues in the background but without a media notification.
- The desktop installer is not code-signed (SmartScreen warns on first run). The update check needs the repository's Releases to be public.
- Dev database (PGlite): a single shared session, so `pgbouncer=true` is required and there are 20 connections max (`npm run db:start`). Production uses regular PostgreSQL.

## Planned next
1. Add a CI job for the S3 storage driver (Compose `--profile s3` with MinIO)
2. Wrapped (yearly stats) and smart/genre playlists
3. Optional ffmpeg worker for transcoding and server-side waveforms
4. Listening Rooms (WebSocket sync)
5. Service worker for offline playback of the user's own uploads
