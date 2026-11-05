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

### Implemented, not yet browser-tested
- [~] Phase 3 server: streaming upload, magic-byte validation, duplicate detection, quota checks, background metadata extraction, streaming with Range support, likes, listening history and play counts, playlists (CRUD, ordering, duplicate, follow, cover, collaborators), albums, genres, search, suggestions, search history, trending, modular recommendations, home feed, profile content
- [~] Player UI: player bar, mini-player, full-screen player with 3 visualizers and waveform, queue panel, Media Session controls, keyboard shortcuts, persisted state
- [~] Pages: Landing, Login, Register, Forgot/Reset password, Verify email, Home, Explore, Genre, Upload, About

### Not built yet: these sidebar links currently lead to 404 pages
- [ ] Pages: Search, Library, Favorites, History, Uploads (management), Track, Playlist, Album, User profile (`/u/[username]`), Equalizer, Settings (account/privacy/appearance), Notifications, Artist dashboard, Admin, Moderation, Mixing Studio, Community themes
- [ ] APIs: `/reports` (the report dialog calls it), `/notifications`, admin/moderation endpoints, copyright claims, themes gallery, mixes
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
