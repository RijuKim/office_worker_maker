# Harness: 스펙 시스템 (Credential/Spec System)

## Formatting & Linting

- Use TypeScript strict mode (existing `tsconfig.json`).
- Use ESLint through the existing Next.js configuration (`eslint.config.mjs`).
- Use Prisma formatting for `prisma/schema.prisma`.

## Testing

- Unit tests: Vitest for pure game logic (spec score calculation, job application stage logic, career path eligibility, narrative prepending).
- Integration tests: cover new API route handlers with database-backed test data.
- Browser/UI verification: Playwright for core spec/job/career flow after implementation.

Coverage priorities:
- Spec creation and completion logic.
- Job application stage advancement and pass/fail calculation.
- Career path eligibility checks.
- Event narrative prepending (previous choice summary → next event body).
- Owner-scoped access on all new API routes.
- Korean job-seeking reality mechanics (fatigue, blind hiring, spec-overcoming).

## Architecture Rules

- Server APIs own all spec/job/career state changes.
- Client components must not commit canonical game state directly.
- Spec score is calculated server-side from completed Spec records.
- Job application stage advancement is server-owned, triggered by event resolution.
- Career path success/failure is determined by stats + event choices, not random.

## Code Principles

- Prefer small domain modules for spec/job/career logic over embedding in route handlers.
- Keep spec score calculation centralized and reusable.
- Use clear Korean user-facing copy for all new UI elements.
- Follow existing patterns in `lib/game/` for new domain modules.

## Danger Zones

- Do not edit `.tenet/project/**` during normal implementation jobs.
- Do not commit `.tenet/.state/tenet.db`, `.tenet/.state/tenet.db-wal`, or `.tenet/.state/tenet.db-shm`.
- Do not commit `.env`, `.env.local`, OpenRouter keys, auth secrets, database passwords, or generated secrets.
- Do not introduce real company names or real exam score systems.
- Do not remove existing stat delta display from choice response.

## Iron Laws

- Every new API route must enforce account ownership.
- Spec score must be calculated from actual completed Spec records, not hardcoded.
- Job application stages must follow company-type-specific stage lists.
- Career path eligibility must check stat requirements.
- Choice response must still show stat delta labels.
- All new Prisma models must have proper migrations.

## Project Doctrine Boundary

Normal implementation jobs must not edit `.tenet/project/**`. Proposed doctrine updates belong in `.tenet/runs/2026-07-07-spec-system/journal/`.
