<p align="center">
  <img src="public/brand/auralis-mark.svg" width="96" height="96" alt="AURALIS logo" />
</p>

<h1 align="center">AURALIS</h1>
<p align="center"><strong>Music, amplified by its community.</strong><br/>
An open-source, self-hostable music platform: upload, stream, mix, and make it yours.</p>

---

AURALIS is an independent, community-driven music platform. People upload music they own or are licensed to share, build playlists, follow each other, mix tracks in a two-deck studio, and customize every pixel of the interface. It does not depend on any proprietary streaming service, and anyone can run their own instance.

> **Status:** feature-complete for its first release (all seven development phases are done; see [DEVELOPMENT_PROGRESS.md](DEVELOPMENT_PROGRESS.md) for what is verified and what is planned).

## Features

| Area | What you get |
|---|---|
| **Player** | Custom Web Audio engine: gapless playback and equal-power crossfade (0–12 s), queue with shuffle/repeat, loudness normalization, 0.5–2× speed, 10-band EQ + presets, bass/treble/balance, three real-time visualizers, waveform seeking, Media Session (lock screen/hardware keys), keyboard shortcuts, state restored after reload, playback continues across page navigation |
| **Uploads** | Drag & drop of single tracks or whole albums (MP3, WAV, FLAC, OGG, M4A, AAC). Streaming uploads to disk, file-type check by file contents (magic bytes), duplicate detection, storage quotas, background metadata extraction, embedded artwork, browser-side waveform/loudness/BPM analysis |
| **Streaming** | HTTP Range streaming with authorization; private audio is never publicly addressable |
| **Discovery** | Personalized home, a modular recommendation engine, trending, new releases, genres, instant search with suggestions/filters/history/trending queries |
| **Library** | Likes, listening history, albums, playlists (drag-and-drop reorder, sort, duplicate, cover, background, public/unlisted/private, follow, collaborative editing) |
| **Mixing Studio** | Two decks, crossfader, BPM detection + tempo sync, key lock, independent pitch shift, cue + 4 hot cues, beat loops, 3-band EQ, filter, echo, nudge, mix recording/export, saved sessions |
| **Social** | Profiles with banner/avatar/bio, follow, comments, sharing, notifications, privacy controls |
| **Customization** | Live theme editor (colors, light/dark/system, density, motion, fonts, radius, player style), import/export, community theme gallery |
| **Creators & staff** | Artist analytics, moderation queues, copyright takedown requests with a repeat-infringer policy, admin dashboard (users, roles, quotas, genres, statistics), audit log |
| **Languages** | English and Turkish (typed, centralized translations; easy to add more) |

## Quick start (Docker)

Requirements: Docker with Compose v2.

```bash
git clone <your-fork-url> auralis && cd auralis
cp .env.example .env
```

Edit `.env` and set at least `POSTGRES_PASSWORD`, `AUTH_SECRET` (≥ 32 random characters) and `APP_URL`. You can generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Then start the stack:

```bash
docker compose up -d --build
```

Open `http://localhost:3000` and register. **The first account becomes the administrator.** Migrations run automatically when the container starts, and `/api/v1/health` reports readiness.

To use S3-compatible storage with the bundled MinIO, set `STORAGE_DRIVER=s3`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` in `.env`, then run:

```bash
docker compose --profile s3 up -d --build
```

Put AURALIS behind a TLS-terminating reverse proxy (Caddy, nginx, Traefik) in production, and enable HSTS there.

## Local development (no Docker needed)

Requirements: Node.js 20+ (24 LTS recommended).

```bash
npm install
cp .env.example .env          # then set AUTH_SECRET
npm run db:start              # terminal 1: embedded PostgreSQL (PGlite) on :5433
npx prisma migrate dev        # terminal 2: create the schema
npm run dev                   # http://localhost:3000
```

Without SMTP configured, verification and password-reset emails are written to `.data/mail/` and their links are logged to the console.

> On Windows PowerShell with script execution disabled, use `npm.cmd` instead of `npm`.

### Useful scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Develop, build, run production |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` / `lint` | TypeScript and ESLint |
| `npm run db:start` | Embedded dev database (PGlite) |
| `npm run db:migrate` / `db:deploy` | Create / apply migrations |
| `npm run db:seed` | Seed the genre taxonomy (idempotent; AURALIS ships no fake content) |
| `npm run user:role -- <username> <USER\|MODERATOR\|ADMIN>` | Change a user's role from the CLI |
| `node scripts/licenses.mjs` | Regenerate [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) |
| `./scripts/backup.sh` | Back up the Compose database and media volume |
| `node scripts/smoke.mjs [url]` | End-to-end smoke test against a running instance (self-cleaning) |

### Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and on every pull request:

1. **checks:** typecheck, lint, unit tests, dependency license allow-list, `npm audit` (high and above).
2. **integration:** applies migrations to a PostgreSQL 17 service, runs the production build, checks that the build contains no local data, starts the standalone server and runs the smoke test.
3. **docker:** builds the image, starts the full Compose stack (waiting for health checks), runs the smoke test against the container, and checks that no secrets or data were baked into the image.

## Configuration

All configuration is through environment variables, validated at startup (`src/server/env.ts`). See [.env.example](.env.example) for the full annotated list. Key settings:

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | – | PostgreSQL connection string |
| `AUTH_SECRET` | – | ≥ 32 chars; signs short-lived media URLs |
| `APP_URL` | `http://localhost:3000` | Used in emails and share links |
| `STORAGE_DRIVER` | `local` | `local` (disk) or `s3` (any S3-compatible service) |
| `SMTP_URL` | empty | Without it, mail goes to `.data/mail` |
| `MAX_UPLOAD_MB` | `200` | Per-file upload limit |
| `DEFAULT_STORAGE_QUOTA_MB` | `2048` | Per-user quota (admins can change it per user) |
| `REQUIRE_VERIFIED_EMAIL_FOR_UPLOAD` | `false` | Recommended `true` on public instances |

## Architecture at a glance

- **Next.js 16 (App Router) + TypeScript + Tailwind CSS v4** in a single deployable app.
- **REST API** under `/api/v1`. The UI uses the same API, so any client can too ([docs/API.md](docs/API.md)).
- **PostgreSQL via Prisma**; audio and images live in object storage and are never stored in the database.
- **Audio engine** (`src/audio`) is framework-independent and unit-tested; React only orchestrates it.
- **Modular server** (`src/server/modules/*`): auth, users, tracks, playlists, albums, search, recommendations, moderation, themes, notifications.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details and [docs/BRAND.md](docs/BRAND.md) for the visual identity.

## Copyright & content policy

AURALIS is designed for original, licensed, public-domain or Creative Commons audio. Uploaders must confirm their rights, and public visibility never implies that AURALIS has cleared a work. Anyone can file a takedown request at `/copyright`. Upheld claims remove the track and add a strike to the uploader; three strikes suspend the account (repeat-infringer policy). Instance operators are responsible for their own legal compliance.

## Contributing & security

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## License

AURALIS is free software under the **GNU Affero General Public License v3.0** ([LICENSE](LICENSE)). If you run a modified version for others over a network, you must offer them its source code. Third-party components and their licenses are listed in [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
