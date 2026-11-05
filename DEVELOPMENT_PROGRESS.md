# AURALIS: Development Progress

_Last updated: 2026-11-06. All seven phases complete._

Legend: ✅ implemented and verified · ☑️ implemented, verified indirectly (API/unit test or smoke test only) · 🟡 partial (see note) · 📋 planned

## Verification summary

| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | 0 errors |
| ESLint | 0 errors, 0 warnings |
| Unit tests (Vitest) | 38/38: queue, audio file-type detection, HTTP ranges, DSP/BPM, recommendations, studio math, theme validation, moderation rules |
| End-to-end RBAC/moderation script | 37/37 (role denials, takedowns, strikes → auto-suspension, ban/unban, audit log) |
| Production build (`next build`, standalone) | Clean, no warnings. Tested: pages, login cookie flags, Range streaming, CSRF block, image processing, CSP with no violations, health endpoint |
| Browser testing | Every page renders; upload → processing → playback, navigation without interruption, EQ effect measured, studio flows, themes, settings, dashboards; no horizontal overflow at 375 px on 12 key pages |
| Dependency audit | `npm audit --omit=dev`: 0 vulnerabilities; 478 packages, all AGPL-compatible licenses |
| API smoke test (`scripts/smoke.mjs`) | 25/25 against the dev instance, and 25/25 against a production build on a **fresh** database configured only through environment variables (simulating the CI integration job) |
| CI (`.github/workflows/ci.yml`) | 🟡 Written; YAML validated; the `checks` and `integration` steps were reproduced locally. It has **not run on GitHub yet**: the repository has no remote |
| Docker | 🟡 `Dockerfile`, `docker-compose.yml` and entrypoint are written. The standalone runtime and the migration tooling they use were validated locally, but **the images were not built**, because Docker isn't installed on the development machine. The CI `docker` job builds and smoke-tests them on the first push |

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

## Known limitations
- Single-instance defaults: in-memory rate limiter and job queue (swap points documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md))
- Gapless playback is near-gapless (HTMLAudio switch on `ended`); crossfade is sample-accurate
- No server-side transcoding or waveform generation for files uploaded through the raw API without browser analysis
- Search uses substring matching (fine for small and medium instances)
- The CSP allows inline scripts (required by Next.js); nonce-based CSP is planned
- Dev database (PGlite): a single shared session, so `pgbouncer=true` is required and there are 20 connections max (`npm run db:start`). Production uses regular PostgreSQL.

## Planned next
1. Push to GitHub so the CI workflow runs (this is the first real Docker build) and fix anything it reports
2. Wrapped (yearly stats) and smart/genre playlists
3. Optional ffmpeg worker for transcoding and server-side waveforms
4. Listening Rooms (WebSocket sync)
5. Service worker for offline playback of the user's own uploads
