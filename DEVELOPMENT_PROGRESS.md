# AURALIS: Development Progress

_Last updated: 2026-11-05_

## Stack and decisions
- **Next.js 16 (App Router) + TypeScript + Tailwind v4**: a single app with a versioned REST API under `/api/v1` and modular server code in `src/server/modules/*`.
- **PostgreSQL + Prisma 6.** Local development uses embedded Postgres (PGlite): `npm run db:start` serves it on port 5433, so Docker isn't needed.
- **Auth:** argon2id password hashing, opaque session tokens stored as SHA-256 hashes, httpOnly SameSite=Lax cookies, plus an Origin check on every mutating request.
- **Storage:** a pluggable driver (local disk or any S3-compatible service). Audio is only reachable through `/api/v1/tracks/:id/stream`, which checks authorization and supports HTTP Range requests.
- **Audio engine** (`src/audio`): independent of React. It uses two `<audio>` slots feeding a Web Audio graph (10-band EQ, bass and treble shelves, stereo balance, analyser) and supports equal-power crossfade and near-gapless playback.
- **i18n:** a central typed dictionary in English and Turkish. The Turkish dictionary must cover every key, and the TypeScript compiler enforces this.
- **License:** AGPL-3.0 (planned; the LICENSE file is not written yet).

## Status

### Implemented and verified
- [x] Phase 1: project scaffold, folder structure, full database schema plus initial migration, design tokens, original logo/app icon/favicon/PWA manifest, splash screen, app shell (sidebar, top bar, mobile nav)
- [x] Phase 2: register, login, logout, email verification, password reset, sessions, profile/avatar/banner/privacy/preferences/account APIs, follow API, rate limiting, mail outbox. In the browser, registration (first user becomes admin) and email verification were tested end to end.
- [x] Unit tests (26, all passing): queue logic, audio file-type detection, HTTP Range parsing, recommendation scoring, BPM/peaks/RMS analysis

- [x] Phase 3 (verified 2026-11-06):
  - Upload pipeline (API tested with a generated WAV): 201 → background processing → READY with duration/codec; duplicate → 409; spoofed `.mp3` → 415
  - Streaming: HTTP 206 range responses; private audio returns 404 to anonymous users and 206 to the owner
  - In the browser: uploaded audio plays, playback continues across page navigation, Media Session metadata is set, the listen is recorded in history (24 s, completed), and the queue/position is restored after reload
  - APIs: comments, playlist create/add (dedupes, ignores invalid IDs)/visibility/background, likes, reports, search
  - Pages rendered and checked: Home, Explore, Genre, Track, Playlist, Profile, Search, History, Uploads (edit dialog)
- [~] Built but only smoke-tested (route loads without error): Album, Library, Favorites, Notifications pages; drag-and-drop playlist reorder, collaborators dialog and profile editing UI not yet clicked through
- [~] Browser-side upload UI (drag & drop + client waveform/loudness/BPM analysis) not yet clicked through; the API it calls is verified

### Not built yet: these sidebar links currently lead to 404 pages
- [ ] Pages: Equalizer, Mixing Studio, Settings (account/privacy/appearance), Artist dashboard, Admin, Moderation, Community themes
- [ ] APIs: admin/moderation endpoints (reports are collected but there's no review UI yet), copyright takedown claims, themes gallery, mixes

### Known limitations
- BPM, waveform and loudness come from the browser at upload time; files uploaded via the raw API without `analysis` have no waveform/BPM (no server-side decoder without ffmpeg)
- Search uses case-insensitive substring matching; swap in Postgres full-text or Meilisearch for large instances (`src/server/modules/search/service.ts`)
- Rate limiting and the job queue are in-process (single-instance deployment)
- [ ] Phase 4: Equalizer page (engine support exists), Mixing Studio
- [ ] Phase 5: theme editor UI (the theme engine exists), community themes, comments
- [ ] Phase 6: artist dashboard, moderation/admin dashboards, notifications UI
- [ ] Phase 7: full audit; end-to-end check that an uploaded file actually plays
- [ ] Open-source files: LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, Dockerfile, docker-compose.yml, API docs, README rewrite

## Running locally
```
npm install
npm run db:start      # terminal 1 (embedded Postgres)
npx prisma migrate dev
npm run dev           # terminal 2 → http://localhost:3000
npm test
```
On Windows PowerShell with script execution disabled, use `npm.cmd` instead of `npm`.
