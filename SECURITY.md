# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report vulnerabilities privately through GitHub's **"Report a vulnerability"** (Security Advisories) on this repository. If that isn't available, email the maintainers at the address listed on the repository profile with the subject `AURALIS security`.

Please include:
- affected version/commit and configuration (storage driver, deployment type),
- steps to reproduce or a proof of concept,
- the impact you observed or expect.

We aim to acknowledge reports within **3 working days**, give a first assessment within **7 days**, and coordinate a disclosure date with you after a fix is available. We're happy to credit you unless you prefer to stay anonymous.

## Supported versions

Security fixes are made on the latest release and the `main` branch.

## Security design (summary)

- **Passwords:** Argon2id (19 MiB, 2 iterations). Login runs at the same speed whether or not the account exists. Rate limits apply per IP and per account.
- **Sessions:** random 256-bit tokens, stored only as SHA-256 hashes; `HttpOnly`, `SameSite=Lax`, `Secure` in production; sliding 30-day expiry; password changes and resets revoke other sessions; bans revoke all sessions.
- **CSRF:** SameSite cookies plus an `Origin` check on every state-changing request.
- **Authorization:** enforced on the server for every API route (owner checks and role ranks USER < MODERATOR < ADMIN). Staff can't act on themselves or on equal or higher ranks. Every privileged action is recorded in an audit log.
- **Input validation:** Zod schemas on every request body and query string. Theme tokens accept only strict hex colors, enums and ranges, so no CSS injection.
- **SQL:** Prisma queries and parameterized tagged-template raw queries only; no string-built SQL.
- **XSS:** React escapes all user content. The only raw HTML is a static first-paint theme script. A production Content-Security-Policy, `X-Frame-Options: DENY`, `nosniff` and a strict referrer policy are set.
- **Uploads:** streamed to disk with size limits; audio is identified by its bytes (magic numbers), not by extension or MIME type; images are fully decoded, stripped of metadata and re-encoded to WebP; per-user quotas; rate limits.
- **Media access:** private and removed audio is only reachable through `/api/v1/tracks/:id/stream`, which checks permissions; storage keys are validated against path traversal.
- **Secrets:** never committed. Configuration is validated at startup. Build output excludes `.data/`, `.env` and sources.

## Known limitations

- Rate limiting is in-memory (per process). Multi-instance deployments should put a shared limiter (for example Redis) behind `src/server/security/rate-limit.ts`.
- The CSP allows `'unsafe-inline'` scripts, which Next.js's inline bootstrap requires. A nonce-based policy is a planned hardening step.
- Image URLs (covers, avatars) contain unguessable random keys but are not access-controlled.
- The mix-export license check in the Mixing Studio runs in the browser (it's a policy aid, not DRM).
- Registration reveals whether an email or username is already taken, so the form can show a helpful error. Password reset doesn't reveal it.
