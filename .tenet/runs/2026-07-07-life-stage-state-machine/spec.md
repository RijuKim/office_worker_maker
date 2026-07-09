---
delivery_mode: agile
---

# Spec: Life Stage State Machine

## Purpose

Replace the current fixed 15-event progression with a server-owned life-stage state machine that makes college, academic administration, career gates, and adult-life outcomes feel like connected story branches. The game should use accumulated stats, relationships, hidden state, academic route history, and destination processes to select events and produce AI-assisted results instead of generic or unsupported endings.

## Tech Stack

- Next.js 16.2.10 App Router with TypeScript route handlers under `app/api/**/route.ts`.
- React 19.2.7 client UI in `app/page.tsx`.
- Prisma 7.8.0 with PostgreSQL/Neon; existing schema in `prisma/schema.prisma`.
- NextAuth 4.24.14 through existing server session helpers in `lib/server/session.ts` and API route guards.
- OpenRouter via existing `lib/game/openrouter.ts`.
- Vercel production deployment, Node `>=20.9` from `package.json`.

## API Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/characters` | Required | List current user's characters; currently serializes through `serializeCharacterRun` in `lib/game/character-foundation.ts`. |
| POST | `/api/characters` | Required | Create a character with initial stats/hidden state; Slice 1 must initialize derived life-stage state without migrations. |
| GET | `/api/characters/[id]` | Required, owner scoped | Load character, active event, relationships, records summary. |
| POST | `/api/characters/[id]/events/next` | Required, owner scoped | Select/create next event; Slice 1 routes this through life-stage/event gates instead of fixed count arcs. |
| POST | `/api/characters/[id]/choices` | Required, owner scoped | Resolve choice, update stats/relationships/flags/history; Slice 1 persists validated life-stage transitions. |
| POST | `/api/characters/[id]/events/forced-check` | Required, owner scoped | Check forced events like burnout; Slice 1 may reuse for strong state branches if applicable. |
| GET | `/api/records` | Required | List account-scoped ending records; UI must not show route grades. |

## Database Schema

No Prisma migration in Slice 1.

| Entity | Column | Type | Constraints / Slice 1 Use |
| --- | --- | --- | --- |
| `CharacterRun` | `currentGradeYear` | `Int?` | Existing grade state, used for fallback derivation. |
| `CharacterRun` | `academicStatus` | `AcademicStatus` | Existing enum: `ENROLLED`, `LEAVE`, `DROPPED_OUT`, `GRADUATED`; Slice 1 may update for strong leave/dropout/graduation states. |
| `CharacterRun` | `lifeStatus` | `Json` | Existing JSON array; may mirror user-readable statuses. |
| `CharacterRun` | `coreEventCount` | `Int` | Still counts events for history and pacing, but must not be the visible primary progress model. |
| `HiddenState` | `eventFlags` | `Json` | Store `lifeStage`, `academicPlan`, `graduation`, `destinationCandidates`, `stageEventCount`, and validated branch state. |
| `HiddenState` | `burnoutRisk` | `Int` | 0-100 hidden risk, already used by `checkForcedEvent` in `lib/game/game-rules.ts`. |
| `EventHistory` | `flagDelta` | `Json` | Store transition evidence and gate outcomes. |
| `CareerEndingRecord` | `destinationName` | `String?` | Later slices may use only when prior destination gate exists. |

## Canonical Slice 1 State

Add `lib/game/life-stage.ts` with:

- `LifeStageId`: `college_early`, `college_mid`, `college_late`, `leave`, `dropout`, `post_graduation`.
- `AcademicTerm`: `{ gradeYear: 1|2|3|4, semester: 1|2, label: string }`.
- `AcademicPlan`: includes `major`, `majorChanged`, `doubleMajor`, `minor`, `interdisciplinaryTrack`, `retakePressure`, `scholarshipWarning`.
- `GraduationState`: `normal`, `requirements_pending`, `extra_semester`, `delayed`, `gate_ready`, `graduated`.
- `DestinationCandidate`: `{ id, kind, name, introducedBy, status: "introduced"|"applied"|"gate_passed"|"gate_failed" }`.

State is derived from existing columns plus `hiddenState.eventFlags`. Missing/corrupt state falls back to `currentGradeYear`, `academicStatus`, and `coreEventCount`.

## Transition Rules

- Semester advances after 2 resolved core events in the current semester unless state is `leave`, `dropout`, or a pending gate.
- Two semesters advance a grade year, capped at 4.
- `leave` forced check: `health <= 2`, `mental <= 2`, or `burnoutRisk >= 80`.
- `dropout` forced check: `reputation <= 1`, `health <= 1`, `mental <= 1`, or `riskDebt >= 8`.
- `extra_semester` check: grade 4 late stage with `academic <= 4`, `practical <= 4`, unresolved graduation requirement, failed thesis/capstone, or explicit academic-plan blocker.
- `graduation_gate` opens in grade 4 after at least 2 late-stage core events if not blocked.
- `post_graduation` requires passed graduation gate or explicit dropout alternate-route completion.
- AI branch suggestions are advisory; invalid suggestions are rejected or downgraded.

## Event Selection

`lib/game/event-engine.ts` currently selects by story arc, flags, stats, grade, residence, and recent titles. Slice 1 must extend `EventSelectionContext` with canonical `lifeStage`, `academicPlan`, `graduation`, and `destinationCandidates`.

Event pools should include and gate these domains:

- Overseas: exchange, working holiday, study abroad, overseas internship.
- Campus: clubs, student council, classes, coursework, group projects.
- Professors/labs: advising, recommendations, lab work, thesis/capstone.
- Graduate school: master's, PhD, research burnout, academia/industry split.
- Academic administration: transfer, double major, minor, interdisciplinary track, retakes, scholarship warning, extra semester, delayed graduation.
- Career: internships, named parody company process, public sector, professional exams, startup, self-employment.
- Life: family, money, health, mental, romance, cohabitation/marriage/childbirth/parenting in later slices.
- Risk: crime/risky money, gambling/debt, reputation collapse.

Choice diversity: non-forced ordinary events should prefer 3 choices with distinct tradeoff axes. Gate events must use strategy/attitude choices, not direct result choices.

## AI Branching

Slice 1 prepares the engine for AI branch suggestions but does not need full branch suggestion prompts. Code owns real transitions. Future AI responses may include a branch candidate, but the engine must validate it against canonical transition rules before persisting state.

## Endings And Destinations

The current ending path in `app/api/characters/[id]/choices/route.ts` creates endings from immediate collapse or `coreEventCount >= 14`. Slice 1 must not deepen this fixed-count dependency and should prepare gate-based finalization. Slice 2 will make endings fully synthesize:

- academic plan and administration state,
- destination candidates and prior processes,
- career/graduate-school gates,
- relationships and adult-life flags,
- hidden risk state,
- event history.

Named companies, public agencies, labs, graduate schools, accelerators, overseas destinations, marriage, childbirth, and parenting must not appear as concrete results unless introduced through prior process/gate state.

ABC grades and GOOD/MIXED/HARD route labels are deprecated and must not appear.

## Design Direction

Use `.tenet/project/design.md`: Korean text-adventure, compact side panels, narrative-first, no landing-page detour, restrained cards, mobile single-column behavior. Visual artifacts for this run:

- `.tenet/runs/2026-07-07-life-stage-state-machine/visuals/2026-07-07-00-architecture.html`
- `.tenet/runs/2026-07-07-life-stage-state-machine/visuals/2026-07-07-01-final-product.html`
- `.tenet/runs/2026-07-07-life-stage-state-machine/visuals/2026-07-07-02-slice-1-state-progression.html`
- `.tenet/runs/2026-07-07-life-stage-state-machine/visuals/2026-07-07-03-slice-2-ai-endings.html`

## Auth Flow

1. User signs up or logs in through current NextAuth credential flow.
2. Client loads account-scoped characters through `/api/characters`.
3. Every character API route calls `requireCurrentUserId()`.
4. Routes query with `{ id, userId }` before returning or mutating character state.
5. Invalid auth returns 401; wrong-owner/missing character returns 404.
6. AI output, client-submitted choice indices, and hidden-state JSON are never trusted without validation.

## Success Criteria

1. Main play UI no longer presents `0/15` or fixed-count progress as the primary model.
2. Existing characters without `eventFlags.lifeStage` load and display derived semester/life-stage labels.
3. At least six canonical states are representable and serializable.
4. Resolving enough events advances semester/year and persists this state.
5. Health/mental/reputation/risk thresholds can force leave/dropout/extra-semester/graduation-gate transitions.
6. Event selection uses canonical state to choose or block event categories.
7. Grade-4 blocked graduation routes to extra semester/delayed graduation instead of generic final ending.
8. Named destinations are only eligible after prior destination candidate/process state.
9. Record UI contains no A/B/C or GOOD/MIXED/HARD route labels.
10. Unit tests cover derivation, transition validation, event selection gates, and legacy-state fallback.

## Out of Scope

- Prisma schema migration in Slice 1.
- Full marriage/cohabitation/childbirth/parenting implementation in Slice 1.
- Real company names, real executives, or real-world allegations.
- Load testing beyond the documented MVP scale.
- Admin tooling.
- Native mobile/Unity clients.

## Slice plan

Total slices: 2

### Slice 1: State-Driven College Progression
- **Adds**: Canonical life-stage/academic state model, UI progress replacement, state-driven event selection, persisted semester/leave/dropout/extra-semester/graduation-gate transitions.
- **Bundled with**: Legacy-state derivation, no-migration JSON persistence, unit tests, and UI copy updates.
- **User can**: Continue or create a character and see progression as semester/life status rather than fixed event count, with events and branch states responding to academic/life state.
- **Out of slice**: Full AI branch suggestion prompts, adult family endings, final destination synthesis overhaul.

### Slice 2: AI Branches And Specific Life Results
- **Adds**: AI branch candidate proposal with code validation, destination candidate/gate synthesis, company/institution/graduate-school process gating, marriage/cohabitation/childbirth/parenting endings, stronger AI ending prompt and fallback diversity.
- **Bundled with**: Ending UI cleanup, unsupported destination stripping, additional scenario tests.
- **User can**: Reach results that name only earned destinations and produce varied AI-authored life records based on academic path, relationships, and adult-life gates.
- **Out of slice**: Native apps, external analytics, real-world company data.
