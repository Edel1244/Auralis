# Contributing to AURALIS

Thanks for helping build an independent music platform! This guide covers everything you need to send a good pull request.

## Ground rules

- Be kind and constructive. Everyone participating agrees to the [Code of Conduct](CODE_OF_CONDUCT.md).
- Discuss large changes in an issue first, so we agree on the approach before you invest time.
- Never commit secrets, real user data or copyrighted audio. Test audio should be generated (see `tests/analysis.test.ts`) or clearly licensed (CC0 / your own).
- Security problems go to [SECURITY.md](SECURITY.md), not public issues.

## Getting set up

Follow **Local development** in the [README](README.md). Then, before opening a PR:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

All four must pass.

## Project layout

```
src/
  app/            Next.js routes: (app) pages, (auth) pages, api/v1 REST handlers
  audio/          Framework-free audio engine, queue, DSP analysis, studio (decks/mixer)
  components/     UI kit (ui/), layout, music, studio, settings, admin
  i18n/           Typed translations (en.ts is the source of truth, tr.ts must match)
  player/         React bindings for the audio engine
  server/         Server-only code: env, db, http, auth, storage, media, jobs, modules/*
  state/          Client state providers (session, library)
  theme/          Theme tokens, validation and runtime application
prisma/           Schema, migrations, seed
tests/            Vitest unit tests
docs/             Architecture, API and brand documentation
```

## Conventions

- **TypeScript strict**, no `any` unless unavoidable (explain why in a comment).
- **API routes** are thin: wrap them in `route()` from `src/server/http.ts`, validate input with Zod (`readJson` / `readQuery`), enforce authorization with `requireAuth` / `requireRole` **on the server**, and keep business logic in `src/server/modules/*`.
- **Privileged actions** must be written to the audit log (`logModeration`).
- **Every UI string** goes through `t()`; add keys to `src/i18n/messages/en.ts`. TypeScript will then require the Turkish translation in `tr.ts` (use English temporarily and mention it in the PR if you can't translate).
- **Colors** come from theme tokens (`bg-primary`, `text-muted`, `var(--au-*)`), never hard-coded, so themes keep working.
- **Accessibility:** every interactive element needs an accessible name; dialogs use `Modal`; respect reduced motion.
- **No fake functionality:** don't add buttons or pages that don't do anything. If something is partial, document it in `DEVELOPMENT_PROGRESS.md`.
- **Tests:** pure logic (queue, DSP, scoring, validation) gets unit tests in `tests/`.

## Database changes

1. Edit `prisma/schema.prisma`.
2. Run `npx prisma migrate dev --name <short_description>`.
3. Commit the generated migration folder. Never edit migrations that have already been released.

## Adding a language

1. Add the code to `LOCALES` and `LOCALE_NAMES` in `src/i18n/config.ts`.
2. Create `src/i18n/messages/<code>.ts` typed as `typeof en`, and register it in `src/i18n/translate.ts`.

## Commit & PR style

- Use small, focused commits with imperative messages ("Add playlist folders").
- Describe **what** changed, **why**, and **how you tested it** in the PR.
- Add UI screenshots or short clips for visual changes.

By contributing, you agree that your contributions are licensed under the AGPL-3.0, like the rest of the project.
