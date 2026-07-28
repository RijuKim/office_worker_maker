---
delivery_mode: autonomous
---

# Replay Balance Specification

## Purpose

Reduce a complete run to roughly 20–24 core events and shorten each decision screen so players can finish and replay more readily. Preserve causal narrative, server authority, and the existing post-choice result summaries.

## Tech Stack

- Next.js 16.2.10 and React 19.2.7 (`package.json`)
- TypeScript 6.0.3 (`package.json`)
- Prisma/PostgreSQL persistence, unchanged (`prisma/schema.prisma`)
- Vitest 3.2.4 and Playwright 1.55.1 (`package.json`)
- Existing OpenRouter-compatible event generation, unchanged except structured output limits (`lib/game/openrouter.ts`)

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/characters/[id]/choices` | Account session and run ownership | Apply a selected choice, progress the academic term, and create an ending when eligible (`app/api/characters/[id]/choices/route.ts`). |
| POST | `/api/characters/[id]/events/next` | Account session and run ownership | Return an AI or static event whose body and choice count meet the compact contract (`app/api/characters/[id]/events/next/route.ts`). |
| POST | `/api/characters/[id]/events/forced-check` | Account session and run ownership | Return forced recovery/progression events under the same 2–3 choice contract (`app/api/characters/[id]/events/forced-check/route.ts`). |

No endpoint shape changes are allowed.

## Database Schema

No migration or schema change is required. Existing entities remain authoritative.

| Entity | Relevant columns | Type | Constraints |
|---|---|---|---|
| `CharacterRun` | `coreEventCount`, `currentGradeYear`, `academicStatus`, `hiddenState` | Existing Prisma fields | Persist compact progression using existing flags and counters (`prisma/schema.prisma`). |
| `EventHistory` | event title, body/summary and deltas | Existing Prisma fields | Existing result-summary persistence remains unchanged (`prisma/schema.prisma`). |
| `CareerEndingRecord` | ending narrative and snapshots | Existing Prisma fields | Created between the normal threshold and hard cap without field changes (`prisma/schema.prisma`). |

## Design Direction

Use the approved balanced-density mockup at `visuals/2026-07-28-01-compact-balanced.html`, the click flow at `visuals/2026-07-28-04-prototype-event-flow.html`, and `.tenet/project/design.md`. Existing layout, palette, components, and responsive behavior remain unchanged; only narrative density and available choice count change. Run-local decisions are recorded in `design.md`.

## Auth Flow

1. Existing email/password authentication establishes the account session.
2. Existing ownership checks load the requested character run.
3. The server validates the selected choice against the active event.
4. The server applies state changes, progression, and ending judgment transactionally.
5. No authentication, authorization, credential, or cross-account behavior changes.

## Behavioral Contract

- `CORE_EVENTS_PER_SEMESTER` is 3, producing 24 normal events over eight semesters from first-year entry.
- A normal final ending becomes eligible at event 20 when graduation/post-graduation state is satisfied; a hard fallback ending occurs by event 24 for a run beyond college-early state.
- Immediate collapse endings remain unchanged.
- Ability-score extra-semester pressure occurs only when both academic and practical are 4 or lower. A single score of 4 with the other at 5 or higher does not trigger it. Explicit requirement-blocker flags continue to require an extra semester regardless of scores.
- AI event bodies target 200–350 Korean characters, 3–5 sentences, normally in two short paragraphs.
- Every delivered playable event contains 2 or 3 choices. No valid event may expose 4 choices.
- Existing choice result summaries retain their current wording and length. Static-event edits must not rewrite `choice.summary` values.
- AI output outside schema limits follows the existing validation/retry/fallback policy; gameplay must not block.
- Static prose must be shortened at sentence boundaries, not truncated mid-sentence.

## Success Criteria

1. A first-year run advances one semester after every three committed core choices and reaches the eight-semester boundary in approximately 24 events.
2. A graduation-ready run can create a final ending at event 20, while any eligible non-early run creates one no later than event 24.
3. Academic/practical values of 5 or higher do not independently force an extra semester; both values at 4 or lower do.
4. Explicit graduation blockers still force the existing extra-semester behavior regardless of the relaxed score boundary.
5. AI event validation accepts only 2–3 choices and the generation prompt requests 200–350 Korean characters and 3–5 sentences.
6. All static, contextual, forced, and fallback events exposed by the engine contain 2–3 choices.
7. Choice summaries touched by the implementation remain identical to their pre-change values.
8. Unit tests, typecheck, lint for changed files, and relevant Playwright interaction checks pass.

## Out of Scope

- Rewriting ending narratives or choice result summaries
- UI layout, art, animation, sound, authentication, API response, or database schema changes
- Production deployment or migration
- Analytics instrumentation or a quantified replay-rate experiment
- Changing immediate collapse-ending thresholds
