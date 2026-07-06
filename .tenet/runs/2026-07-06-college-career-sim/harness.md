# Harness: College Career Sim

## Formatting & Linting

- Use TypeScript strict mode.
- Use ESLint through the generated Next.js configuration.
- Use Prettier if introduced by the scaffold; otherwise keep formatting consistent with the scaffold.
- Use Prisma formatting for `prisma/schema.prisma`.

## Testing

- Unit tests: use Vitest or the scaffold's chosen test runner for pure game logic, validators, record grouping, AI fallback, and safety checks.
- Integration tests: cover API route handlers with database-backed test data where practical.
- Browser/UI verification: Playwright is required for the core auth/create/play/record happy path after the app exists.
- AI tests: mock OpenRouter for automated tests. Live OpenRouter may be used manually when `OPENROUTER_API_KEY` is supplied, but tests must not require spending API calls.

Coverage priorities:
- Event schema validation.
- Stat delta and bounds validation.
- Forced burnout event trigger.
- Character creation validation.
- Account ownership checks.
- Daily AI usage limit.
- Static fallback when AI fails.
- Parody company safety rules.
- `커리어와 엔딩 기록` required fields and grouping.

## Architecture Rules

- Server APIs own game state, event validation, stat changes, relationship changes, flag changes, career branch eligibility, and record generation.
- Client components must not commit canonical game state directly.
- OpenRouter calls must happen only in server-side code.
- `OPENROUTER_API_KEY` must never be exposed to the browser, committed, logged, or written into Tenet artifacts.
- AI output is untrusted input and must pass Zod/schema validation and safety checks before use.
- Character names, age, starting grade/year, and major/department come from user input during character creation.
- Forced events are allowed, but must be explicit server-owned transitions and must be persisted in event history.

## Code Principles

- Prefer small domain modules for game rules over embedding all logic in route handlers.
- Keep parody/safety validation centralized and reusable.
- Seed data should be fictional only.
- Use clear Korean user-facing copy for game UI and concise Korean error messages.
- Keep future Unity/mobile compatibility by exposing clean server API contracts.

## Danger Zones

- Do not edit `.tenet/project/**` during normal implementation jobs.
- Do not commit `.tenet/.state/tenet.db`, `.tenet/.state/tenet.db-wal`, or `.tenet/.state/tenet.db-shm`.
- Do not commit `.env`, `.env.local`, OpenRouter keys, auth secrets, database passwords, or generated secrets.
- Do not introduce exact real company names into seed data, fixtures, screenshots, or tests.
- Do not add an `inspiredBy` field or similar real-company reference to the database.

## Iron Laws

- Passwords must be hashed before storage.
- Every character and record API must enforce account ownership.
- Every AI response must be treated as untrusted.
- The game must remain playable when OpenRouter is unavailable.
- `커리어와 엔딩 기록` must be account-scoped and persisted.
- Public stats must stay within 0-100.
- Normal events must present 2-4 choices unless they are server-marked forced transitions.
- Forced events must return agency through follow-up choices.
- Companies, people, and events must be presented as fictional/parody.

## Environment And Runtime

Expected local commands after implementation:
- Install: package manager install command chosen by scaffold.
- Database: PostgreSQL available through `DATABASE_URL`.
- Migrate: Prisma migration command.
- Dev server: Next.js dev command, expected local port 3000 unless occupied.
- Test: unit/integration test command added by implementation.
- Browser verification: Playwright against the running dev server.

Required env vars for full local run:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `OPENROUTER_API_KEY` for live AI; tests must support mocked AI without it.
- `OPENROUTER_MODEL` optional.

## Project Doctrine Boundary

Normal implementation jobs must not edit `.tenet/project/**`. Proposed doctrine updates belong in `.tenet/runs/2026-07-06-college-career-sim/journal/`.
