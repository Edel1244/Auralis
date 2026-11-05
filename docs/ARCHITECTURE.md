# Architecture

## Overview

```
Browser ──► Next.js app (one process)
             ├─ React UI  (src/app/(app), (auth); client components)
             │    └─ PlayerProvider ─► AudioEngine (Web Audio)   ◄── persists across navigation
             └─ REST API  (src/app/api/v1/**/route.ts)
                  └─ server modules (src/server/modules/*)
                       ├─ PostgreSQL (Prisma)          metadata, users, playlists, events
                       ├─ Object storage (local | S3)  audio, artwork, avatars
                       ├─ Job queue (in-process)       upload processing
                       └─ Mail (SMTP | file outbox)
```

**Why one Next.js app?** Self-hosters get a single container to run, and the UI and API share validation schemas (`src/lib/validation.ts`) and types. The API is still a clean, versioned REST surface (`/api/v1`) that other clients (mobile apps, bots) can use. The UI renders on the client and calls the same API, which keeps the persistent audio player straightforward.

## Server layers

| Layer | Location | Responsibility |
|---|---|---|
| HTTP | `src/server/http.ts` | `route()` wrapper: Origin check, global write limit, uniform error JSON (Zod/Prisma/ApiError mapping), pagination helpers |
| Auth | `src/server/auth/*` | Argon2id passwords, hashed session tokens, one-time tokens (email verification, password reset), role ranks |
| Modules | `src/server/modules/*` | business logic per domain (tracks, playlists, albums, search, recommendations, moderation, themes, notifications, users) |
| Storage | `src/server/storage/*` | `StorageDriver` interface: local disk or S3-compatible; Range streaming |
| Media | `src/server/media/*` | streaming multipart parser, audio file-type checks by content, image re-encoding |
| Jobs | `src/server/jobs/queue.ts` | bounded in-process queue; work state lives in the database (`Track.status`), so `instrumentation.ts` re-queues interrupted jobs at boot |

### Upload pipeline

1. `POST /uploads`: busboy streams the file to a temp file while hashing it (SHA-256) and keeping its first bytes.
2. The content is identified by magic bytes, then checked for duplicates per user and against an atomic quota reservation (`UPDATE … WHERE used + size <= quota`).
3. The file is stored at `audio/<user>/<track>/original.<ext>` and a `PROCESSING` row is created with any browser-provided analysis.
4. A background job parses the full file with `music-metadata` (duration, codec, bitrate, sample rate, lossless, tags, embedded artwork, genre mapping), then sets `READY` or `FAILED` and notifies the owner.

**Waveform, loudness and BPM** are computed in the browser at upload time (`src/audio/analysis.ts`), because the browser can decode every supported format without server-side ffmpeg. The server validates and clamps these values. They are cosmetic or advisory: normalization gain is clamped to −12…+6 dB.

### Access control

Every track query goes through `canViewTrack` / `publicTrackWhere` / `listableTrackWhere` (`src/server/modules/tracks/access.ts`). Playlists use `canViewPlaylist` / `canEditPlaylist`. Staff actions go through `src/server/modules/moderation/service.ts`, which enforces rank rules and writes the audit log.

### Recommendations

`src/server/modules/recommendations/scoring.ts` is pure and unit-tested:
- **Listener profile:** genre, artist and tag affinities, built from 90 days of listens plus likes (likes weigh more).
- **Signals:** genre, artist, tags, popularity and freshness are weighted and summed.
- **Adjustments:** tracks the listener already knows are demoted, and the results are spread across artists.

To add a strategy (collaborative filtering, embeddings), add a `Signal`; the data layer (`engine.ts`) doesn't change.

## Audio

### Player engine (`src/audio/AudioEngine.ts`)

```
<audio A> ─ gain A ┐
                   ├─ preamp ─ 10× biquad EQ ─ bass shelf ─ treble shelf ─ stereo panner ─ master ─ analyser ─ out
<audio B> ─ gain B ┘
```

- Audio streams through `<audio>` elements (HTTP Range, so seeking doesn't download the whole file).
- The idle slot preloads the next track:
  - near-gapless: switches on `ended`;
  - crossfade: equal-power curves scheduled on the AudioContext clock.
- Per-slot gain also carries loudness normalization.
- The engine knows nothing about React or tracks.

### Queue and React bindings

- **Queue (`src/audio/queue.ts`):** pure and immutable, with play order kept separate from insertion order (supports shuffle), repeat modes, play-next and reordering.
- **PlayerProvider:** wires engine and queue to React, Media Session, keyboard shortcuts, persistence (localStorage plus account preferences) and listen reporting.

### Mixing Studio (`src/audio/studio`)

- **Deck:** `<audio>` → trim → 3-band EQ → DJ filter → pitch shifter → fader, with an echo send.
  - Key lock uses the browser's native time-stretch (`preservesPitch`).
  - Independent pitch comes from a dual-delay-line shifter built from standard Web Audio nodes, verified to within ±2 Hz on test tones.
- **Mixer:** equal-power crossfader, master analyser, `MediaRecorder` tap for mix export.
- **BPM detection:** onset-envelope autocorrelation (`estimateBpm`), unit-tested from 90 to 174 BPM.

## Frontend

- **Design tokens:** CSS variables (`--au-*`) are mapped into Tailwind v4 (`@theme inline`). The theme engine (`src/theme`) validates tokens with Zod and applies them to `<html>`, and a tiny inline script applies the cached theme before first paint.
- **i18n:** `en.ts` is the typed source; other languages must provide every key (compile-time check). There's a pluralization helper.
- **Navigation:** `src/components/layout/nav.ts` is the single source for sidebar and mobile navigation, with auth/role visibility. Pages also guard with `RequireAuth`; that's UX only, since the API enforces access.

## Data model

See `prisma/schema.prisma`. Highlights:
- Users have roles, a status (active, suspended until a date, banned), strikes, quotas and privacy flags.
- Tracks have a status, visibility, ownership/license and audio metadata; alternate encodings live in `TrackAsset`.
- Playlists use positioned entries, plus collaborators and followers.
- `PlayEvent` stores listening history and analytics; `SearchQuery` powers history and trending.
- Moderation: `Report`, `CopyrightClaim`, and an append-only `ModerationAction` audit log.
- `Theme` and `ThemeInstall`, `EqPreset`, and `Mix` (studio sessions).

## Scaling notes

The defaults target a single instance. To scale out:
- swap the in-memory rate limiter and job queue (`rate-limit.ts`, `jobs/queue.ts`) for Redis/BullMQ or pg-boss;
- use the S3 driver;
- move search to Postgres full-text or Meilisearch (`modules/search/service.ts`);
- serve media through a CDN using short-lived signed URLs (`signMediaToken` already exists).
