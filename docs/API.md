# AURALIS REST API (v1)

Base path: `/api/v1`. All bodies are JSON unless noted (`multipart/form-data` for uploads). The web UI uses this same API.

## Conventions

- **Auth:** the session cookie `auralis_session` (HttpOnly). Register or log in to receive it. Access levels below: `public`, `optional` (works logged out, richer when logged in), `user`, `moderator`, `admin`.
- **CSRF:** state-changing requests that carry an `Origin` header must come from the app's own origin.
- **Errors:** `{ "error": { "code": "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMITED" | "PAYLOAD_TOO_LARGE" | "UNSUPPORTED_MEDIA" | "QUOTA_EXCEEDED" | "SUSPENDED" | "BAD_REQUEST" | "INTERNAL", "message": "…", "details"?: … } }`, with the matching HTTP status (400/401/403/404/409/413/415/422/429/507/500). Validation errors list `details: [{ path, message }]`.
- **Pagination:** `?page=1&limit=20` (limit ≤ 50) → `{ items, page, limit, total, hasMore }`.
- **Rate limits:** per-endpoint limits (e.g. 10 logins per 15 min per account) plus a global 600 writes per 5 min per IP. Exceeding them returns `429` with `Retry-After`.
- **Visibility:** `PUBLIC` (listed), `UNLISTED` (link only), `PRIVATE` (owner, collaborators, staff).

## Health

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/health` | public | `{ status, db, dbLatencyMs, jobs }`; 503 when the database is unreachable |

## Auth & account

| Method | Path | Access | Body / notes |
|---|---|---|---|
| POST | `/auth/register` | public | `{ email, username, displayName, password, acceptTerms: true }`; first user becomes ADMIN |
| POST | `/auth/login` | public | `{ identifier (email or username), password }` |
| POST | `/auth/logout` | optional | |
| GET | `/auth/me` | optional | `{ user, preferences }` (`user: null` when logged out) |
| POST | `/auth/verify-email` | public | `{ token }` |
| POST | `/auth/resend-verification` | user | |
| POST | `/auth/forgot-password` | public | `{ email }`; always 200 (no account enumeration) |
| POST | `/auth/reset-password` | public | `{ token, password }`; signs out all sessions |
| PATCH | `/me/account` | user | `{ action: "password", currentPassword, newPassword }` or `{ action: "email", currentPassword, email }` |
| DELETE | `/me/account` | user | `{ password }`; deletes the account and all its content |
| GET / DELETE | `/me/sessions` | user | list sessions; revoke `{ id }` or `{ all: true }` (others) |
| PATCH | `/me/profile` | user | `{ displayName?, bio?, username?, isArtist? }` |
| POST / DELETE | `/me/images/{avatar\|banner}` | user | multipart `file` (JPEG/PNG/WebP/GIF ≤ 8 MB, re-encoded to WebP) |
| PATCH | `/me/preferences` | user | `{ appearance?, playback?, equalizer?, activeThemeId?, locale?, privacy?: { isPrivate?, showListening?, showStats?, showFollowing? } }` |

## Tracks, uploads & streaming

| Method | Path | Access | Body / notes |
|---|---|---|---|
| POST | `/uploads` | user | multipart: `audio` (MP3/WAV/FLAC/OGG/M4A/AAC), optional `artwork`, `meta` JSON (`title?, artistName?, description?, genreId?, tags?, mood?, releaseDate?, visibility, explicit, commentsEnabled, ownership, licenseNote, albumId?, trackNumber?, rightsConfirmed: true, analysis?: { waveform, loudnessDb, bpm }`) → `201 { track }` with `status: PROCESSING`. Errors: 409 duplicate, 415 not audio, 413 too large, 507 quota |
| GET | `/tracks/{id}` | optional | `{ track, canEdit }` |
| PATCH | `/tracks/{id}` | owner/moderator | track metadata (same fields as upload meta) |
| DELETE | `/tracks/{id}` | owner/admin | deletes the track and its stored files, and releases quota |
| POST | `/tracks/{id}/cover` | owner | multipart `file` |
| GET | `/tracks/{id}/stream` | optional | audio bytes with `Range` support (206); `?quality=` when alternate encodings exist; 404 if not permitted |
| POST / DELETE | `/tracks/{id}/like` | user | |
| POST | `/tracks/{id}/plays` | user | `{ msPlayed, completed, source? }`; counts toward plays at ≥ 30 s (or half of a short track) |
| GET / POST | `/tracks/{id}/comments` | optional / user | `{ body }` (≤ 1000 chars) |
| DELETE | `/comments/{id}` | author/track owner/moderator | soft delete |
| GET | `/me/tracks` | user | your uploads (all statuses) + `storage: { used, quota }`; `?q=` |
| GET | `/me/likes` · `/me/likes/ids` | user | liked tracks / all liked IDs |
| GET / DELETE | `/me/history` | user | listening history (paged) / clear it |
| GET | `/media/{key…}` | public | images only (unguessable keys, immutable cache) |

## Albums & playlists

| Method | Path | Access | Body / notes |
|---|---|---|---|
| GET | `/albums` | public | public albums |
| POST | `/albums` | user | multipart `meta` JSON `{ title, artistName, description?, genreId?, releaseDate?, visibility }` + optional `cover` |
| GET / PATCH / DELETE | `/albums/{id}` | optional / owner / owner, admin | GET returns `{ album, tracks }`; delete keeps the tracks as singles |
| POST / DELETE | `/albums/{id}/like` | user | save an album |
| GET | `/me/albums` | user | `{ own, saved }` |
| GET | `/playlists` | optional | featured public playlists |
| POST | `/playlists` | user | `{ title, description?, visibility? }` |
| GET | `/me/playlists` | user | owned + collaborating + followed |
| GET / PATCH / DELETE | `/playlists/{id}` | optional / editor (visibility & collaborative: owner) / owner, admin | GET → `{ playlist, entries[{ entryId, addedAt, addedBy, track }], collaborators }` |
| POST / DELETE / PUT | `/playlists/{id}/tracks` | editor | add `{ trackIds }` · remove `{ entryIds }` · reorder `{ entryIds }` (full order) |
| POST | `/playlists/{id}/duplicate` | user | private copy |
| POST / DELETE | `/playlists/{id}/follow` | user | |
| POST / DELETE | `/playlists/{id}/cover` | editor | multipart `file` |
| POST / DELETE | `/playlists/{id}/collaborators` | owner (or the collaborator leaving) | `{ username, role: EDITOR\|VIEWER }` / `{ userId }` |

## Discovery

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/feed/home` | optional | recently played, recommended, trending, new releases, community, artists, genres, featured playlists, albums |
| GET | `/genres` · `/genres/{slug}` | public | `?sort=popular\|new` |
| GET | `/search` | optional | `?q=&type=all\|tracks\|artists\|albums\|playlists\|users&genre=&year=&duration=short\|medium\|long&page=&record=1` |
| GET | `/search/suggest` | optional | `?q=` |
| GET / DELETE | `/search/history` | optional / user | `{ recent, trending }` / clear |

## Social

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/users/{username}` | optional | profile, follower counts, `isFollowing` (private profiles are restricted) |
| GET | `/users/{username}/content` | optional | uploads, popular, albums, playlists, totals, followers/following, listening stats, recently played (privacy-aware) |
| POST / DELETE | `/users/{username}/follow` | user | |
| GET / PATCH | `/notifications` | user | list / mark all read |
| GET | `/notifications/unread-count` | user | |

## Customization & studio

| Method | Path | Access | Notes |
|---|---|---|---|
| GET / POST / DELETE | `/me/eq-presets` | user | `{ name, gains[10] }` / `{ id }` |
| GET / POST | `/themes` | optional / user | gallery `?sort=popular\|new&q=` · create `{ name, description, tokens, isPublic }` |
| GET / PATCH / DELETE | `/themes/{id}` | optional / author / author, moderator | |
| POST | `/themes/{id}/install` | user | counts the install, sets the active theme |
| GET | `/me/themes` | user | `{ own, installed }` |
| GET / POST | `/mixes` | user | studio sessions `{ title, data }` |
| PATCH / DELETE | `/mixes/{id}` | owner | |
| GET | `/me/artist-stats` | user | aggregated creator analytics (no listener identities) |

## Moderation & copyright

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/reports` | user | `{ targetType: TRACK\|ALBUM\|PLAYLIST\|USER\|COMMENT\|THEME, targetId, reason: COPYRIGHT\|SPAM\|ABUSE\|EXPLICIT_UNLABELED\|IMPERSONATION\|OTHER, details }` |
| POST | `/copyright-claims` | public | `{ trackId, claimantName, claimantEmail, workDescription, evidenceUrl?, goodFaith: true }` |
| GET | `/mod/reports` | moderator | `?status=OPEN\|REVIEWING\|RESOLVED\|DISMISSED&reason=` |
| POST | `/mod/reports/{id}` | moderator | `{ action: review\|dismiss\|remove, note, strike }` |
| GET / POST | `/mod/claims` · `/mod/claims/{id}` | moderator | `{ action: uphold\|reject, note }`; uphold = takedown + strike |
| GET | `/mod/uploads` | moderator | `?status=recent\|PROCESSING\|FAILED\|REMOVED` |
| POST | `/mod/tracks/{id}` | moderator | `{ action: remove\|restore, reason, strike }` |
| GET | `/mod/audit` | moderator | `?action=prefix&targetId=` |

## Administration

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/admin/users` | moderator | `?q=&role=&status=` |
| POST | `/admin/users/{id}` | moderator (suspend/unsuspend) · admin (others) | `{ action: suspend, days, reason }`, `unsuspend`, `ban`, `unban`, `{ action: setRole, role }`, `{ action: setQuota, quotaMb }`, `clearStrikes` |
| GET | `/admin/stats` | admin | platform totals and 14-day series |
| GET / POST | `/admin/genres` | admin | `{ name, slug, color, active }` |
| PATCH | `/admin/genres/{id}` | admin | |
