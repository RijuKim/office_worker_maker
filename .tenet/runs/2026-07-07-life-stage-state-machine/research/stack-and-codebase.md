# Research: Stack And Codebase Constraints

Confidence: [scanned-not-verified]

## What Was Researched

- Existing project doctrine in `.tenet/project/overview.md`, `.tenet/project/architecture.md`, `.tenet/project/product.md`, `.tenet/project/testing.md`, and `.tenet/project/design.md`.
- Current code paths for game state, event selection, choices, AI, UI, and persistence.
- Official framework docs for:
  - Next.js App Router Route Handlers: https://nextjs.org/docs/app/getting-started/route-handlers
  - Prisma JSON fields: https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields
  - NextAuth Next.js configuration: https://next-auth.js.org/configuration/nextjs

## Key Findings

- The app already uses Next.js App Router API route handlers in `app/api/**/route.ts`; Next's docs confirm route handlers are the App Router request primitive and support HTTP methods such as `GET` and `POST`.
- Prisma schema already has JSON surfaces suitable for additive Slice 1 state without migrations: `CharacterRun.lifeStatus` and `HiddenState.eventFlags` in `prisma/schema.prisma`.
- The current server-owned game logic lives in:
  - `lib/game/game-rules.ts` for public stat bounds, stat deltas, relationship deltas, forced-event checks.
  - `lib/game/event-engine.ts` for static/conditional event selection and story arcs.
  - `app/api/characters/[id]/events/next/route.ts` for active-event retrieval, next-event creation, AI event attempt, and `coreEventCount` increment.
  - `app/api/characters/[id]/choices/route.ts` for choice validation, stat/relationship/flag updates, event history persistence, and ending creation.
  - `lib/game/openrouter.ts` for AI event/ending prompts, response schemas, validation, and fallback.
  - `app/page.tsx` for the single-page UI, progress display, choice handling, record display, and sidebar stats.
- Existing auth scoping pattern requires `requireCurrentUserId()` and `findFirst({ where: { id, userId } })` before reading/updating a character, as seen in `app/api/characters/[id]/events/next/route.ts` and `app/api/characters/[id]/choices/route.ts`.
- Current UI still derives main progress from `coreEventCount / 15` in `app/page.tsx`; Slice 1 must replace that visible model.
- Current event selection still accepts `coreEventCount` and `gradeYear`, but not a canonical life-stage/academic-plan state; Slice 1 should introduce a derived state helper rather than scattering logic in API routes.
- Current endings are created in `app/api/characters/[id]/choices/route.ts` when immediate bad ending occurs or when `coreEventCount >= 14`; Slice 1 should stop hardcoding finalization only to a fixed count and prepare gate-based finalization.

## Limitations

- Slice 1 intentionally avoids Prisma migrations. JSON state is flexible but less type-safe than explicit columns.
- PostgreSQL JSON querying is not central for Slice 1 because state is loaded by character ID and updated as a whole. If future analytics/filtering require JSON path queries, later slices may need schema/index work.
- AI branch suggestions are not implemented yet; Slice 1 can define validated state fields and event gating hooks, while full AI branch proposal handling can be expanded in a later slice.

## Recommended Approach

- Add a dedicated `lib/game/life-stage.ts` module that derives and validates canonical progression state from existing columns plus `hiddenState.eventFlags`.
- Store additive state under `hiddenState.eventFlags.lifeStage`, `academicPlan`, `graduation`, and `destinationCandidates`; do not add migrations in Slice 1.
- Route all event selection and choice transition logic through this helper so UI, APIs, tests, and AI prompts share the same stage vocabulary.
- Keep auth/user scoping unchanged.
- Add unit tests for derivation/transition validation and focused UI/API tests for replacing the fixed `0/15` progress display.
