---
delivery_mode: autonomous
---

# Event Selection Stability Specification

## Purpose

Prevent generated event choices from being replaced while the player is deciding, make duplicate next-event requests converge on one authoritative event, diagnose frequent AI choice-generation failures, and reduce avoidable generation latency without weakening static fallback safety.

## Tech Stack

- Node.js >=24, TypeScript 6.0.3, Next.js 16.2.10 App Router, React 19.2.7 (`package.json`).
- Prisma/Client 7.8.0 with PostgreSQL via `pg` 8.16.3 (`package.json`, `prisma/schema.prisma`).
- Zod 4.4.3 for AI response validation (`package.json`, `lib/game/openrouter.ts`).
- Ollama-compatible primary endpoint and OpenRouter Chat Completions fallback using server-only API keys (`lib/game/openrouter.ts`).
- Vitest 3.2.4 and Playwright 1.55.1 (`package.json`).

## Existing Root Cause

1. Both next-event endpoints revalidate an existing `ACTIVE` event and may mark it `DISCARDED` while clearing `currentEventId`: `app/api/characters/[id]/events/next/route.ts` and `app/api/characters/[id]/events/next/stream/route.ts`. Once committed, an event must instead be returned unchanged.
2. Candidate event creation and `CharacterRun.currentEventId` assignment are separate writes with no compare-and-set or uniqueness guard, allowing concurrent requests to create multiple active events and overwrite the pointer (`prisma/schema.prisma`, both next-event routes).
3. The complete event and all choices share one Zod parse, collapsing choice-specific failures into `invalid_response` (`lib/game/openrouter.ts`).
4. Streaming failure and quality failure can each trigger full sequential regeneration, multiplying provider latency (`lib/game/openrouter.ts`, both next-event routes).
5. `fallbackUsed` is fixed to false and provider/total durations are not recorded accurately (both next-event routes, `lib/server/event-quality-log.ts`).

## State Contract

The authoritative lifecycle is:

1. `currentEventId = null`: generation may begin.
2. A candidate is produced by AI or, only after pre-commit AI failure, by validated static fallback.
3. Exactly one request atomically assigns its candidate as `currentEventId` and leaves one authoritative `ACTIVE` event.
4. Until a valid player choice submission consumes that event, every next-event request returns the exact same event ID/content/source/choices. No eligibility, timeout, retry, fallback, or late response may discard or replace it.
5. A losing concurrent request must not overwrite the winner. It returns the committed winner and cleans up or marks its own unused candidate non-active.
6. Only the authenticated choice endpoint may normally advance/clear the current event. Existing explicit run-ending behavior remains valid.

If database commit fails before authority is established, return the existing server error behavior and do not pretend fallback was committed. If fallback validation yields no valid candidate, return an internal error without corrupting current state. A choice submission racing with generation must either consume the already committed authoritative event or fail with the existing no-active-event response; a late generation request must never resurrect the consumed event.

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/characters/:id/events/next/stream` | Current user owns character | SSE generation; immediately returns an existing authoritative event, otherwise generates and atomically commits one candidate. |
| POST | `/api/characters/:id/events/next` | Current user owns character | JSON recovery/generation; same authority and commit semantics as streaming route. |
| GET | `/api/characters/:id` | Current user owns character | Returns the authoritative current event used by client recovery. |
| POST | `/api/characters/:id/choices` | Current user owns character | Consumes the authoritative current event and advances game state. |

No public payload adds debugging text or duplicate-request controls.

## Database Schema

No migration is required unless the implementation worker proves a database constraint is necessary. Prefer an atomic compare-and-set on the existing pointer and transactional cleanup.

### CharacterRun (existing relevant columns)

| Column | Type | Constraints |
|---|---|---|
| `id` | String/UUID | Primary key |
| `userId` | String | Ownership relation; cascade delete |
| `currentEventId` | String nullable | Authoritative event pointer; atomically set only from null |
| `updatedAt` | DateTime | Prisma updated timestamp |

### Event (existing relevant columns)

| Column | Type | Constraints |
|---|---|---|
| `id` | String/UUID | Primary key |
| `characterRunId` | String nullable | Character relation; cascade delete |
| `source` | EventSource | `STATIC`, `AI`, `FALLBACK`, or `FORCED` |
| `status` | EventStatus | Candidate becomes authoritative as `ACTIVE`; losing candidate must not remain active |
| `title`, `body` | String | Validated narrative |
| `choices`, `tags` | JSON | 2-4 validated player-agency choices and event tags |

## AI Generation and Failure Contract

- `OPENROUTER_TIMEOUT_MS` controls each provider-call timeout. Default: 30,000 ms. Accepted range: 5,000-120,000 ms. Missing, non-numeric, or out-of-range values use 30,000 ms.
- 10,000 ms is a slow-generation observation threshold, not a timeout or fallback trigger.
- Distinguish at least: missing key, provider timeout, rate limit, provider/API error, empty content, malformed JSON, narrative schema failure, choice count failure, choice field failure, choice stat-range failure, and post-parse quality failure.
- Log provider identity, provider elapsed time, total elapsed time, slow flag, stage/reason, retry use, fallback use, and final authoritative event ID. Never log API keys or full sensitive prompts.
- A choice failure must be diagnosable separately from narrative failure. Bounded repair or normalization may be used only if it preserves the 2-4 player-agency choice rules. Do not accept invalid choices.
- Remove avoidable full-event retry chains. Do not re-call a provider after an event has committed. Do not turn the 10-second observation threshold into a retry trigger.
- If generation fails before commit, return a validated static fallback with no player-visible error; record the internal reason/timing.
- OpenRouter SSE mid-stream errors may arrive in a 200 response event and must be classified rather than treated as normal content (research: `research/event-generation-lifecycle.md`).

## Design Direction

- Approved direction: `visuals/2026-07-20-03-mockup-minimal.html`.
- Behavior prototype: `visuals/2026-07-20-04-prototype-event-wait.html`.
- Architecture: `visuals/2026-07-20-00-architecture.html`.
- Follow `.tenet/project/design.md` and `.tenet/runs/2026-07-20-event-selection-stability/design.md`.
- Prototype-only duplicate-request explanatory text must not ship. Production UI remains visually unchanged except existing loading behavior may continue longer.

## Auth Flow

1. Existing Auth.js session resolves the current user.
2. Each endpoint queries the character using both character ID and current user ID.
3. Unauthorized requests remain 401; non-owned/missing characters remain indistinguishable under existing route behavior.
4. All generation, commit, fallback, and choice transitions remain server-owned.

## Success Criteria

1. Given an active event, repeated stream and JSON next-event requests return its exact ID/content/choices and perform no discard/create/generation call.
2. Given two or more concurrent generation requests, exactly one authoritative event is committed; every successful response resolves to that event and no losing event remains `ACTIVE`.
3. Waiting beyond 10 seconds or until just below configured provider timeout never replaces a committed event.
4. Provider timeout/failure before commit yields a validated fallback without a player-visible error and logs the failure reason and durations.
5. `OPENROUTER_TIMEOUT_MS` uses valid 5,000-120,000 ms values and otherwise defaults to 30,000 ms.
6. Choice-related invalid output is logged with a choice-specific reason/path instead of only `invalid_response`.
7. A valid first AI candidate is committed without a redundant full regeneration call.
8. Player choice submission remains the normal transition that clears/advances the current event.
9. Unit/integration tests reproduce the old active-event discard and concurrent overwrite behaviors and pass with the fix.
10. `npm run lint`, `npm run typecheck`, focused Vitest tests, and `npm run build` pass.

## Out of Scope

- Shipping prototype-only diagnostic copy or controls.
- Changing the visual design of the play screen.
- Changing player stats, story rules, life-stage eligibility for *new* candidates, authentication, or career ending behavior.
- Guaranteeing live third-party LLM responses within 10 seconds.
- Persisting raw prompts/responses or exposing internal AI errors to players.

