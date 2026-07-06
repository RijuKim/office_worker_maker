# Decomposition: College Career Sim

Delivery mode: autonomous  
Model tier: frontier

## ASCII DAG

```text
job-1 scaffold-and-tooling
        │
job-2 data-model-auth
        │
e2e-1 integration-auth-character-foundation
        │
        ├──────────────┬────────────────┐
        │              │                │
job-3 game-rules  job-4 ai-events  job-5 seed-careers
        │              │                │
        └──────────────┴──────┬─────────┘
                              │
                e2e-2 integration-rules-ai-data
                              │
                              ├──────────────┐
                              │              │
                    job-6 literary-ui  job-7 records-collection
                              │              │
                              └──────┬───────┘
                                     │
                    e2e-3 final-acceptance-sweep
```

## Job Details

### job-1: Scaffold And Tooling
- Type: `dev`
- Depends on: none
- Deliverables:
  - Next.js 16.2.10 App Router TypeScript project scaffold.
  - Tailwind CSS 4.3.2 integration following selected literary design direction.
  - Prisma 7.8.0 configured for PostgreSQL.
  - Playwright and unit test tooling wired to package scripts.
  - `.env.example` with required env var names but no secrets.
  - Local README notes for install, dev, migration, test, and mocked OpenRouter mode.
- Verification criteria:
  - `npm run lint`, `npm run typecheck`, and at least one unit-test command exist.
  - `npm run dev` starts the app.
  - No secrets are committed.

### job-2: Data Model, Auth, And Character Creation
- Type: `dev`
- Depends on: `job-1`
- Deliverables:
  - Prisma schema and migrations for User, CharacterRun, CharacterStats, HiddenState, Relationship, Event, EventHistory, CareerDestination, CareerEndingRecord, and AiUsage.
  - Email/password signup route with password hashing.
  - NextAuth credentials login/session integration.
  - Owner-scoped `/api/me`, `/api/characters`, and `/api/characters/:id` endpoints.
  - Character creation requiring user-entered name, age, starting grade/year, and major/department.
  - Initial stats, hidden state, starter relationships, and first event creation.
- Verification criteria:
  - Signup/login works locally.
  - Character creation persists user-entered fields and initialized state.
  - Ownership checks block unauthenticated or wrong-user character access.

### e2e-1: Integration: Auth And Character Foundation
- Type: `integration_test`
- Report only: true
- Depends on: `job-2`
- Deliverables:
  - Run focused acceptance coverage for signup, login, character creation, persistence after reload, and unauthorized access blocking.
- Verification criteria:
  - Report pass/fail for relevant tests in `tests/acceptance/college-career-sim.spec.ts`.
  - Report any blocking findings through Tenet rather than editing code.

### job-3: Server Game Rules And Event Progression
- Type: `dev`
- Depends on: `e2e-1`
- Deliverables:
  - Domain modules for stat bounds, stat deltas, relationship deltas, flag deltas, event schema validation, and event history persistence.
  - `/api/characters/:id/choices`, `/api/characters/:id/events/next`, and `/api/characters/:id/events/forced-check`.
  - Forced burnout trigger when `burnoutRisk >= 85`, stored with null choice id and followed by recovery choices.
  - Test-only helpers gated to non-production for acceptance setup if needed.
- Verification criteria:
  - Normal choices persist history and state changes.
  - Forced burnout event appears without initial choice and returns agency.
  - Public stats remain within 0-100.

### job-4: OpenRouter AI Event Pipeline
- Type: `dev`
- Depends on: `e2e-1`
- Deliverables:
  - Server-only OpenRouter client using `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`.
  - Structured event/ending JSON request and response validation.
  - 10-second timeout and 30 calls per account per day enforcement.
  - Static fallback when OpenRouter fails, times out, rate-limits, or returns invalid/unsafe content.
  - Tests/mocks that do not require live API spend.
- Verification criteria:
  - AI failure path returns playable fallback event.
  - API key is never exposed to browser.
  - Daily usage limit blocks further AI calls while preserving static gameplay.

### job-5: Career Destination Seed Data And Safety
- Type: `dev`
- Depends on: `e2e-1`
- Deliverables:
  - 40+ fictional career destinations covering parody companies, public-sector paths, licensed professions, entrepreneurship, and self-employment.
  - Job roles and salary bands for office roles such as marketing, HR, finance/accounting, engineering, sales, planning, design, and operations.
  - Central parody safety validator: no exact real company names, no real executives/incidents/controversies/allegations, no `inspiredBy`.
  - UI/API access for career destinations.
- Verification criteria:
  - Seed data passes safety validator.
  - Career destinations expose culture tags and preferred stat metadata.

### e2e-2: Integration: Rules, AI, And Career Data
- Type: `integration_test`
- Report only: true
- Depends on: `job-3`, `job-4`, `job-5`
- Deliverables:
  - Run acceptance coverage for normal event choice, AI fallback, forced burnout, and real-company anti-scenario.
- Verification criteria:
  - Report pass/fail and blocking findings only.

### job-6: Literary Game UI
- Type: `dev`
- Depends on: `e2e-2`
- Deliverables:
  - Literary text-adventure UI based on `.tenet/runs/2026-07-06-college-career-sim/visuals/2026-07-06-01-mockup-literary.html`.
  - Auth entry, signup/login forms, character creation form, play screen, state cards, relationship/memory cards, parody notice, and mobile single-column layout.
  - Display forced events distinctly from normal choices.
  - Korean user-facing copy and concise recoverable error messages.
- Verification criteria:
  - Desktop and mobile layouts are readable without text overlap.
  - User-entered character name and selected starting info appear in the play UI.
  - Event choices are usable and tap-sized.

### job-7: Career And Ending Records Collection
- Type: `dev`
- Depends on: `e2e-2`
- Deliverables:
  - `/api/characters/:id/records` generation endpoint with branch-point and 15-core-event eligibility checks.
  - Account-scoped `/api/records` list/filter endpoint.
  - Record creation with required fields, AI-drafted or fallback narrative, safety validation, and similarity grouping.
  - Collection UI using the term `커리어와 엔딩 기록`.
- Verification criteria:
  - Eligible runs can save records.
  - Records persist across logout/login.
  - Same destination can produce distinct records when context differs.
  - Near-duplicate records are grouped.

### e2e-3: Final Acceptance Sweep
- Type: `integration_test`
- Report only: true
- Depends on: `job-6`, `job-7`
- Deliverables:
  - Run all unit, integration, lint/typecheck, and Playwright acceptance tests.
  - Inspect mobile and desktop UI against selected visuals and design doctrine.
  - Verify OpenRouter can be mocked and optional live key path is documented.
- Verification criteria:
  - All acceptance scenarios pass or any blockers are reported.
  - No danger-zone files or secrets are committed.
  - Final report lists remaining risks and test gaps.

## Interface Contracts

### Character Creation Contract
- Input: `{ name: string, age: number, startGradeYear: 1|2|3|4, major: string }`
- Output: character id, entered profile fields, initialized stats, initialized hidden state, current event.
- Invariant: name is user-entered and required; system must not randomly assign it.

### Event Choice Contract
- Input: authenticated owner, character id, active event id, choice id.
- Output: updated event history, clamped stat deltas, relationship/flag changes, next event candidate.
- Invariant: client never commits canonical state directly.

### Forced Event Contract
- Input: authenticated owner and character id.
- Output: forced event when thresholds are crossed, otherwise no forced event.
- MVP trigger: burnout event when hidden `burnoutRisk >= 85`.
- Invariant: forced event is persisted and followed by player response choices.

### AI Event Contract
- Input to AI: minimized character state, recent event summaries, candidate tags, safety instruction.
- Output from AI: structured JSON event/record proposal.
- Invariant: AI output is untrusted until schema and safety validation pass.

### Record Contract
- Input: eligible character run with at least 15 core events and a career branch point.
- Output: `CareerEndingRecord` with required narrative, career/path, snapshot, relationship, event, score, tag, and similarity fields.
- Invariant: records are account-scoped and do not claim to decide the character's entire life.
