# Job Queue

Updated: 2026-07-21T04:52:07.792Z

- [x] AI timeout, choice diagnostics, and latency (ai-generation-diagnostics) — 3m 42s
- [!] Integration: Auth And Character Foundation (e2e-1) — 4s !! Reading additional input from stdin...
OpenAI Codex v0.142.5
--------
workdir: /Users/guremini/projects/sano_officeworker
model: gpt-5.5
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR]
reasoning effort: none
reasoning summaries: none
session id: 019f36ab-46c9-7463-96d4-341a4e6fa85b
--------
user
<tenet_run_context>
## Run Context (auto-compiled reference — not instructions)
feature: college-career-sim
run_path: .tenet/runs/2026-07-06-college-career-sim

## Spec (inlined — source of truth for this run)
---
delivery_mode: autonomous
---

# Spec: College Career Sim

## Purpose

Build a browser-based Korean text-adventure life/career simulation where users create a college student, make organic narrative choices, experience hidden and forced events, reach an early-career branch point, and save `커리어와 엔딩 기록` to an account collection. The game is entertainment-first and uses fictional parody companies and careers, not real-company evaluation or career guidance.

## Tech Stack

Use these package targets and pin them through `package.json` plus the generated lockfile:

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16.2.10 App Router |
| UI runtime | React 19.2.7, React DOM 19.2.7 |
| Language | TypeScript 6.0.3 |
| Styling | Tailwind CSS 4.3.2 |
| Database | PostgreSQL |
| ORM | Prisma 7.8.0, `@prisma/client` 7.8.0 |
| Auth | NextAuth 4.24.14 credentials provider with app-owned user records and hashed passwords |
| Validation | Zod 4.4.3 |
| AI Provider | OpenRouter chat completions API |
| Runtime | Node.js 20.9+ |

Environment variables:

| Name | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | yes | Auth session signing secret |
| `NEXTAUTH_URL` | local/dev optional, deploy yes | Auth callback/base URL |
| `OPENROUTER_API_KEY` | yes for live AI, no for fallback-only dev | Server-only OpenRouter key; user has key ready |
| `OPENROUTER_MODEL` | no | Selected OpenRouter model; default to a low-cost general-purpose model when absent |

## API Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/signup` | no | Create user with email/password; hash password before storage. |
| `GET/POST` | `/api/auth/[...nextauth]` | mixed | NextAuth credentials login/session routes. |
| `GET` | `/api/me` | yes | Return current user profile and AI daily usage summary. |
| `POST` | `/api/characters` | yes | Create character with user-entered name, age, starting grade/year, and major/department. |
| `GET` | `/api/characters` | yes | List user's character runs. |
| `GET` | `/api/characters/:id` | owner | Fetch character state, current event, relationships, memories, and records summary. |
| `POST` | `/api/characters/:id/choices` | owner | Apply a choice to the current event using server-owned transition rules. |
| `POST` | `/api/characters/:id/events/next` | owner | Select next event; may call OpenRouter for key moments or use fallback/static pool. |
| `POST` | `/api/characters/:id/events/forced-check` | owner | Evaluate threshold-based forced events such as burnout. |
| `POST` | `/api/characters/:id/records` | owner | Generate and save a `커리어와 엔딩 기록` when progression thresholds are met. |
| `GET` | `/api/records` | yes | List account-level saved records with filters. |
| `GET` | `/api/career-destinations` | yes | Return parody companies, public-sector paths, licensed professions, entrepreneurship, and self-employment destinations. |

## Database Schema

### `User`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | string/uuid | primary key |
| `email` | string | unique, required, normalized lowercase |
| `passwordHash` | string | required |
| `createdAt` | datetime | required |
| `updatedAt` | datetime | required |

### `CharacterRun`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | string/uuid | primary key |
| `userId` | string/uuid | required, owner FK |
| `name` | string | required, user-entered, 1-24 chars |
| `age` | integer | required, 18-35 MVP bound |
| `startGradeYear` | integer | required, 1-4 |
| `currentGradeYear` | integer nullable | 1-4 when enrolled |
| `major` | string | required, 1-40 chars |
| `academicStatus` | enum | `ENROLLED`, `LEAVE`, `DROPPED_OUT`, `GRADUATED` |
| `lifeStatus` | string array/json | flags such as `PART_TIME_JOB`, `INTERNSHIP`, `EXAM_PREP`, `STARTUP_PREP` |
| `majorEventCount` | integer | default 0 |
| `coreEventCount` | integer | default 0 |
| `currentEventId` | string nullable | FK or active generated event id |
| `createdAt` | datetime | required |
| `updatedAt` | datetime | required |

### `CharacterStats`

| Column | Type | Constraints |
| --- | --- | --- |
| `characterRunId` | string/uuid | primary/unique FK |
| `academic` | integer | 0-100 |
| `practical` | integer | 0-100 |
| `communication` | integer | 0-100 |
| `creativity` | integer | 0-100 |
| `health` | integer | 0-100 |
| `mental` | integer | 0-100 |
| `network` | integer | 0-100 |
| `wealth` | integer | 0-100 |
| `reputation` | integer | 0-100 |
| `charm` | integer | 0-100 |

### `HiddenState`

| Column | Type | Constraints |
| --- | --- | --- |
| `characterRunId` | string/uuid | primary/unique FK |
| `majorFit` | integer | 0-100 |
| `burnoutRisk` | integer | 0-100; forced burnout candidate at 85+ |
| `romanceState` | json | required default object |
| `familyState` | json | required default object |
| `friendState` | json | required default object |
| `careerInterests` | string array/json | required default empty |
| `companyRolePreferences` | string array/json | required default empty |
| `imageFit` | json | required default object |
| `selfCareCondition` | json | required default object |
| `eventFlags` | json | required default object |

### `Relationship`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | string/uuid | primary key |
| `characterRunId` | string/uuid | required FK |
| `name` | string | required |
| `role` | string | required, e.g. senior, friend, manager |
| `trust` | integer | 0-100 |
| `tags` | string array/json | required default empty |
| `createdAt` | datetime | required |

### `Event`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | string/uuid | primary key |
| `characterRunId` | string/uuid nullable | null for reusable static templates |
| `source` | enum | `STATIC`, `AI`, `FALLBACK`, `FORCED` |
| `status` | enum | `ACTIVE`, `RESOLVED`, `DISCARDED` |
| `title` | string | required |
| `body` | text | required |
| `choices` | json | 2-4 choices unless forced transition is pre-choice |
| `tags` | string array/json | required default empty |
| `safetyChecked` | boolean | required |
| `createdAt` | datetime | required |

### `EventHistory`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | string/uuid | primary key |
| `characterRunId` | string/uuid | required FK |
| `eventId` | string/uuid | required FK |
| `choiceId` | string nullable | null for forced event trigger |
| `summary` | string | required |
| `statDelta` | json | server-validated deltas |
| `relationshipDelta` | json | server-validated deltas |
| `flagDelta` | json | server-validated deltas |
| `createdAt` | datetime | required |

### `CareerDestination`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | string/uuid | primary key |
| `displayName` | string | required fictional/parody name |
| `destinationType` | enum | `PARODY_COMPANY`, `PUBLIC_SECTOR`, `LICENSED_PROFESSION`, `ENTREPRENEURSHIP`, `SELF_EMPLOYMENT` |
| `industry` | string | required |
| `roles` | string array/json | required |
| `salaryBand` | string | required |
| `cultureTags` | string array/json | fictional descriptors only |
| `hiringDifficulty` | integer | 1-5 |
| `preferredStats` | json | required |
| `eventTone` | string array/json | required |

No `inspiredBy` or exact real-company reference column is allowed.

### `CareerEndingRecord`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | string/uuid | primary key |
| `userId` | string/uuid | required FK |
| `characterRunId` | string/uuid | required FK |
| `title` | string | required |
| `summary` | string | required |
| `longNarrative` | text | required |
| `careerPath` | string | required |
| `jobRole` | string nullable | optional |
| `destinationName` | string nullable | snapshot fictional name |
| `salaryBand` | string nullable | snapshot |
| `workplaceTone` | string array/json | required |
| `statSnapshot` | json | required |
| `keyRelationships` | json | required |
| `majorEvents` | json | 3-7 summaries |
| `satisfaction` | integer | 0-100 |
| `growthPotential` | integer | 0-100 |
| `workLifeBalance` | integer | 0-100 |
| `healthState` | string | required |
| `relationshipState` | string | required |
| `tags` | string array/json | required |
| `similarityKey` | string | required for grouping |
| `createdAt` | datetime | required |

### `AiUsage`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | string/uuid | primary key |
| `userId` | string/uuid | required FK |
| `date` | string | `YYYY-MM-DD`, unique with user |
| `count` | integer | 0-30 MVP limit |
| `updatedAt` | datetime | required |

## Event And Validation Rules

- Public stats are bounded 0-100.
- A single normal choice can change an individual public stat by at most 15 points unless a server-owned forced event explicitly allows a larger one-time effect.
- Events must include title, body, source, tags, and either 2-4 choices or a forced-transition marker.
- AI can propose narrative text, choices, result descriptions, and candidate deltas. The server clamps or rejects deltas and owns canonical persistence.
- Forced events can trigger before player choice when thresholds are crossed. MVP forced trigger: `burnoutRisk >= 85` produces a burnout crisis/recovery event.
- After a forced event, the player must receive recovery or response choices in the next screen.
- Discard any AI output that misses required fields, exceeds choice count, contains real-company claims, names exact real companies, references real executives/incidents/controversies, or includes unsafe targeted insults.
- If AI is unavailable, invalid, over daily limit, or over 10 seconds, use a static fallback event with matching tags.

## Design Direction

Use the selected literary mockup as the primary design reference: `.tenet/runs/2026-07-06-college-career-sim/visuals/2026-07-06-01-mockup-literary.html`.

Also use:
- Architecture diagram: `.tenet/runs/2026-07-06-college-career-sim/visuals/2026-07-06-00-architecture.html`
- Prototype: `.tenet/runs/2026-07-06-college-career-sim/visuals/2026-07-06-04-prototype-core-flow.html`
- Run design decisions: `.tenet/runs/2026-07-06-college-career-sim/design.md`
- Project doctrine: `.tenet/project/design.md`

The core UI is a Korean text-adventure reading surface with supporting cards. At 768px and below, collapse to a single-column layout with narrative before supporting cards.

## Auth Flow

1. User opens the app and sees login/signup entry.
2. User signs up with email/password through `/api/auth/signup`.
3. Server validates email/password, hashes the password, creates the user, and returns a success response.
4. User logs in through NextAuth credentials.
5. Server creates an authenticated session/JWT.
6. Authenticated pages and APIs require the session and enforce user ownership on characters and records.
7. Invalid credentials show concise recoverable feedback without revealing whether an email exists.
8. Logout ends the session and returns the user to auth entry.

## Character Creation Flow

1. Authenticated user clicks create character.
2. User enters a name and chooses starting age, starting grade/year, and major/department.
3. Server validates name length, age range, grade range, and major text.
4. Server creates `CharacterRun`, `CharacterStats`, `HiddenState`, starter relationships, and first event.
5. User lands on the literary play surface with the entered name visible.

## Success Criteria

1. A user can sign up, log in, create a character with user-entered name/age/grade/major, and see the play UI within normal local development latency.
2. A character starts with all 10 public stats and hidden state initialized in the database.
3. A current event displays readable Korean narrative and 2-4 choices unless it is an automatic forced trigger.
4. Choosing an event option persists event history, applies server-validated stat/relationship/flag changes, and displays the next event.
5. When `burnoutRisk >= 85`, the server can produce a forced burnout event without requiring an initial player choice, then returns the player to recovery choices.
6. OpenRouter generation is called only server-side, respects 30 calls per account per day, times out at 10 seconds, and falls back to static content on failure.
7. A character with at least 15 core events and a career branch point can generate a `커리어와 엔딩 기록`.
8. Saved records are account-scoped, include required record fields, and remain visible after logout/login.
9. Same company/job records can coexist when narrative context differs; near duplicates are grouped by approximate 80% overlap.
10. Parody company data never stores exact real-company names, `inspiredBy`, real executives, real controversies, or real allegations.
11. Desktop literary layout and mobile 768px single-column layout are both usable without text overlap.

## Out of Scope

- Social login.
- Payments.
- Admin/content management tools.
- Unity or native mobile clients.
- Real-company factual profiles, rankings, or claims.
- Real career guidance or assessment claims.
- Production-scale load testing beyond MVP target assumptions.
- User-authored arbitrary prompts.
- Full illustration or animation system.


## Scenarios (inlined — success/failure shapes for this run)
# Scenarios: College Career Sim

## Scenarios (Success)

1. Signup, login, and character creation
   - User opens the app.
   - User signs up with `player@example.com` and a valid password.
   - User logs in.
   - User creates a character by entering name `한서윤`, selecting age `21`, starting grade/year `2`, and major `사회학과`.
   - Expected outcome: the play screen shows `한서윤`, the selected starting details, initialized public stats, and a first event.
   - Expected persistence: `User`, `CharacterRun`, `CharacterStats`, `HiddenState`, and first `Event` records exist and belong to that account.

2. Normal event choice updates state
   - Authenticated user views a current event with 2-4 choices.
   - User selects a choice about asking a club senior for internship details.
   - Expected outcome: UI advances to a next situation or updated event.
   - Expected persistence: `EventHistory` stores the choice; stat deltas are clamped to allowed bounds; relationship trust or flags update server-side.

3. OpenRouter failure falls back without blocking play
   - User reaches a key event where AI generation is attempted.
   - OpenRouter mock returns timeout, invalid JSON, or rate-limit.
   - Expected outcome: user sees a static fallback event with matching tags and can continue.
   - Expected persistence: AI usage/failure metadata is recorded as appropriate, but no invalid AI event is committed as canonical state.

4. Forced burnout event
   - Character hidden `burnoutRisk` reaches 85 or higher after repeated overwork choices.
   - Server evaluates forced-event thresholds.
   - Expected outcome: a burnout crisis/recovery event appears without requiring the user to pick an initial event choice.
   - Expected persistence: forced event is stored in event history with null choice id, and the next screen offers recovery/response choices.

5. Career and ending record generation
   - Character has at least 15 core events and reaches a branch point such as employment, entrepreneurship, graduation, extended leave, dropout, public-sector entry, or licensed-profession entry.
   - User triggers record generation.
   - Expected outcome: `커리어와 엔딩 기록` is saved and appears in the collection.
   - Expected persistence: record includes title, summary, long narrative, career path, salary band, workplace tone, stat snapshot, key relationships, 3-7 major events, satisfaction, growth potential, work-life balance, health, relationship state, tags, and similarity key.

6. Same destination, different story
   - User completes two runs that both reach the same parody company and role but with different stats, relationships, and major events.
   - Expected outcome: collection shows both when their narrative context meaningfully differs.
   - Expected persistence: records share destination/job metadata but have different snapshots, tags, and narratives.

7. Mobile layout
   - User opens the play screen at 390px width.
   - Expected outcome: the UI uses a single column, narrative appears before supporting cards, choices are tap-sized, and no text overlaps or overflows controls.

## Anti-Scenarios (Failure)

1. Randomly assigned protagonist name
   - The system creates a character without asking for a name.
   - Failure: this violates product requirements. Character name must be user-entered.

2. Client-side canonical state mutation
   - Client directly changes stats or flags without a server transition.
   - Failure: canonical game state must only change through server-owned validation.

3. Real company claim
   - Seed data or AI output displays an exact real company name, real CEO, real scandal, or factual negative claim about an identifiable company.
   - Failure: content must be discarded or replaced with fictional parody-safe content.

4. OpenRouter blocks gameplay
   - OpenRouter times out and the user cannot continue.
   - Failure: fallback event must keep gameplay moving.

5. Invalid AI JSON committed
   - AI response misses required fields or proposes unsafe deltas, but the app saves it as canonical state.
   - Failure: invalid AI output must be rejected and replaced.

6. Unauthorized data access
   - User A can fetch or mutate User B's character or records by changing an id.
   - Failure: every owner-scoped API must enforce account ownership.

7. Duplicate collection clutter
   - Near-identical records with roughly 80% or more overlap are shown as unrelated separate records without grouping.
   - Failure: collection should group near duplicates.

8. Forced event removes all agency
   - Burnout triggers automatically and then the player has no recovery or response choices.
   - Failure: forced events must return agency through the next situation.


## Decomposition (inlined — the run's plan / DAG)
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


## Harness (inlined)
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


## Selective references (consult as relevant)
Under .tenet/runs/2026-07-06-college-career-sim/: journal/ (prior attempts + failure logs), research/ (current-run research), visuals/ (UI/architecture mockups).
</tenet_run_context>

## Report-Only Scope

You are in REPORT-ONLY mode. You MUST NOT edit project files (other than writing your final report).

If verification reveals a blocking finding that must be resolved before this report can be trustworthy:

1. Call `tenet_report_blocking_finding({ job_id: "e40d8e02-1c6c-4df0-ab84-a078a7869148", finding, why_it_blocks_report, recommended_followup, suspected_files })`.
2. Your job will be paused (status: blocked_on_finding).
3. A linked child dev job will investigate/resolve the finding and pass its own evals.
4. Your job will auto-resume with fresh context once the finding is resolved.

Do NOT edit files yourself. Do NOT silently work around the bug. Do NOT abandon the report.

## Integration Test Checkpoint

You are running an integration test checkpoint. Your job is to verify that
the implemented features actually work together end-to-end.

### What to do:
1. Read the project's acceptance tests (tests/acceptance/, e2e/, or similar)
2. Install test dependencies if needed (e.g. `npx playwright install`)
3. Start the application server in the background
4. Run the acceptance/e2e test suite
5. If no acceptance tests exist, perform manual smoke testing:
   - Start the server
   - Hit each API endpoint and verify responses
   - For frontend: navigate to each page, verify rendering
   - Test user flows: signup → login → use feature → verify result
6. Report results clearly: which tests passed, which failed, and why

### Output format:
```
INTEGRATION TEST RESULTS
========================
Feature: [feature name]

PASSED:
- [test/flow description]

FAILED:
- [test/flow description]: [error/reason]

OVERALL: PASS / FAIL
```

Do NOT fix code yourself. Report failures accurately so fix jobs can be created.

## Test Scope

Run focused acceptance tests for signup, login, character creation, persistence after reload, and unauthorized access blocking using tests/acceptance/college-career-sim.spec.ts. Start the dev server and test database as documented. Report pass/fail and any blocking findings only; do not edit code.
ERROR: You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at 7:59 PM.
ERROR: You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at 7:59 PM.

- [-] Integration: Spec system E2E (e2e-1-spec-integration) !! cancelled by user
- [-] Integration: Rules, AI, And Career Data (e2e-2) !! cancelled by user
- [-] Final Acceptance Sweep (e2e-3) !! cancelled by user
- [x] Authoritative event lifecycle and concurrency (event-authority) — 3m 33s
- [F] Integration: event selection stability (integration-event-stability) — 1262m 54s
- [x] Integration: production verification (integration-postdeploy) — 4m 13s
- [-] Integration: predeployment UI and age gates (integration-predeploy) — 3m 3s !! cancelled by user
- [x] Scaffold And Tooling (job-1) — 5m 17s
- [x] Life-stage core model and transitions (job-1-life-stage-core) — 4m 32s
- [-] Prisma schema migration for spec system (job-1-spec-db-migration) !! cancelled by user
- [x] Data Model, Auth, And Character Creation (job-2) — 6m 33s
- [x] API and event engine life-stage integration (job-2-api-event-integration) — 6m 59s
- [-] Spec system domain logic (job-2-spec-domain-logic) !! cancelled by user
- [-] Server Game Rules And Event Progression (job-3) !! cancelled by user
- [-] Event engine changes for spec system (job-3-event-engine-changes) !! cancelled by user
- [x] Life-stage progress UI and record cleanup (job-3-ui-progress-and-records) — 4m 26s
- [-] OpenRouter AI Event Pipeline (job-4) !! cancelled by user
- [-] Slice 1 verification sweep (job-4-slice-1-verification) — 33m 48s !! cancelled by user
- [-] Spec system API routes (job-4-spec-api-routes) !! cancelled by user
- [-] Career Destination Seed Data And Safety (job-5) !! cancelled by user
- [-] Choice response change (job-5-choice-response-change) !! cancelled by user
- [-] Literary Game UI (job-6) !! cancelled by user
- [-] Spec system UI panels (job-6-spec-ui) !! cancelled by user
- [-] Career And Ending Records Collection (job-7) !! cancelled by user
- [x] Main app onboarding and combined menu (main-onboarding-and-menu) — 3m 46s
- [x] Production deployment (production-deploy) — 4m 57s
- [x] Integration: slice 1 event quality (slice-1-e2e) — 32s
- [x] Next-event route integration and quality logs (slice-1-route-integration) — 5m 45s
- [x] Event thread lifecycle core (slice-1-thread-lifecycle-core) — 3m 11s
- [x] Event validator and diversity scorecard (slice-1-validator-scorecard) — 5m 28s
- [!] AI Branch Proposal + Destination Synthesis (slice-2-ai-branch-proposal) — 3s !! Reading additional input from stdin...
OpenAI Codex v0.142.5
--------
workdir: /Users/guremini/projects/sano_officeworker
model: gpt-5.5
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR]
reasoning effort: none
reasoning summaries: none
session id: 019f3b3c-2908-7910-869a-d637a7890922
--------
user
<tenet_run_context>
## Run Context (auto-compiled reference — not instructions)
feature: life-stage-state-machine
run_path: .tenet/runs/2026-07-07-life-stage-state-machine

## Spec (inlined — source of truth for this run)
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


## Scenarios (inlined — success/failure shapes for this run)
# Scenarios: Life Stage State Machine

## Scenarios (Success)

1. Existing save fallback
   - Given a character created before Slice 1 with no `eventFlags.lifeStage`
   - When the player opens the play screen
   - Then the sidebar shows a semester/life-stage label such as `1학년 1학기` and does not show `0/15` as the primary progress model.

2. Semester advancement
   - Given an enrolled 1st-year 1st-semester character with valid state
   - When the player resolves enough core events for advancement
   - Then `eventFlags.lifeStage`/term state persists the next semester or grade, and UI reflects the new label after reload.

3. Forced leave risk
   - Given a character with `mental <= 2` or `health <= 2`
   - When the next event is requested
   - Then ordinary career progression is blocked or deprioritized and a leave/crisis/recovery branch is selected or state-marked.

4. Extra semester
   - Given a 4th-year late-stage character with unresolved graduation requirements or low academic/practical stats
   - When the player would otherwise reach finalization
   - Then the system moves to extra-semester/delayed-graduation state instead of creating a generic final record.

5. Destination gate integrity
   - Given no destination candidate/process exists
   - When an ending or late-stage result is generated
   - Then no concrete company, graduate school, agency, or accelerator name is granted.

6. Record UI grade removal
   - Given any saved record
   - When records are displayed
   - Then the UI does not show A/B/C, GOOD ROUTE, MIXED ROUTE, or HARD ROUTE.

## Anti-Scenarios (Failure)

1. Fixed counter regression
   - The play UI still presents `0/15`, `14/15`, or similar as the main progress model.

2. Unsupported AI transition
   - AI suggests dropout, graduation, marriage, childbirth, or named company success and the server persists it without passing code validation.

3. Existing save crash
   - A character without Slice 1 JSON state fails to load or cannot request the next event.

4. Direct result choices
   - A gate event presents choices like `시험을 통과한다` or `면접에서 떨어진다` instead of strategy/attitude choices.

5. Unsupported named ending
   - An ending names a company, graduate school, lab, agency, overseas destination, spouse, or child that has no prior process/gate/history.

6. Weak consequence branch
   - Severe stat/risk thresholds only change flavor text and do not alter life-stage, event pool, or finalization eligibility.


## Decomposition (inlined — the run's plan / DAG)
# Decomposition: Life Stage State Machine

Run slug: `2026-07-07-life-stage-state-machine`
Delivery mode: `agile`
Active slice: `Slice 1: State-Driven College Progression`

## Acceptance Tests Added First

- `tests/acceptance/life-stage-state-machine.spec.ts`
  - Fixed `x/15` progress must disappear from the play UI.
  - Semester/life-stage labels such as `1학년 1학기`, `휴학`, `자퇴`, `졸업`, `추가학기`, or `졸업 유예` must be visible.
  - Low health/mental/burnout state must be able to route to leave/recovery before normal career finalization.
  - Gate choices must be strategy choices, not direct pass/fail commands.
  - Record UI must not expose A/B/C or GOOD/MIXED/HARD route labels.

These tests may fail before implementation and are intended to define the Slice 1 behavior.

## DAG

```text
job-1-life-stage-core
  -> job-2-api-event-integration
      -> job-3-ui-progress-and-records
          -> job-4-slice-1-verification
```

## Jobs

### job-1-life-stage-core

Type: `dev`

Goal: Add the canonical no-migration state model and deterministic transition helpers.

Expected files:

- `lib/game/life-stage.ts`
- `tests/unit/api/life-stage.test.ts`

Scope:

- Define `LifeStageId`, `AcademicTerm`, `AcademicPlan`, `GraduationState`, and `DestinationCandidate`.
- Parse and sanitize `HiddenState.eventFlags` into a canonical state.
- Derive fallback state from `currentGradeYear`, `academicStatus`, and `coreEventCount` when JSON is missing or corrupt.
- Implement transition calculation:
  - semester advances after 2 resolved core events in the term,
  - grade advances after 2 semesters, capped at 4,
  - leave for `health <= 2`, `mental <= 2`, or `burnoutRisk >= 80`,
  - dropout for `reputation <= 1`, `health <= 1`, `mental <= 1`, or `riskDebt >= 8`,
  - extra semester for blocked grade-4 graduation state,
  - graduation gate only from eligible late-stage state.
- Return persistence-safe flag deltas without trusting AI/client-supplied branch state.

Out of scope:

- UI changes.
- OpenRouter prompt changes.
- Prisma migration.

Verification:

- Unit tests for derivation, corrupt JSON fallback, semester/year advancement, leave/dropout, extra semester, and graduation gate readiness.

### job-2-api-event-integration

Type: `dev`
Depends on: `job-1-life-stage-core`

Goal: Wire canonical state into character creation, next-event selection, and choice resolution.

Expected files:

- `app/api/characters/route.ts`
- `app/api/characters/[id]/route.ts`
- `app/api/characters/[id]/events/next/route.ts`
- `app/api/characters/[id]/choices/route.ts`
- `app/api/characters/[id]/events/forced-check/route.ts`
- `lib/game/event-engine.ts`
- Relevant unit tests under `tests/unit/api/**`

Scope:

- Initialize life-stage flags for new characters.
- Serialize current life-stage summary in character API responses.
- Advance canonical state after resolved choices.
- Keep `coreEventCount` as pacing/history data, but do not use it as the primary finalization trigger.
- Extend event selection context with life stage, academic plan, graduation state, and destination candidates.
- Gate event categories:
  - overseas/exchange/working holiday/study abroad,
  - clubs/student orgs,
  - classes/coursework/group projects,
  - professor/lab/recommendation/thesis/capstone,
  - graduate school master's/PhD,
  - academic administration: transfer, double major, minor, interdisciplinary track, retakes, scholarship warning, extra semester, delayed graduation,
  - career/internship/company process/public-sector/professional exam/startup,
  - family/romance/risky money.
- Prefer 3 ordinary choices with distinct tradeoffs where event templates allow it.
- Keep gate choices as strategy/attitude choices.
- Reject or ignore invalid AI/client branch suggestions.

Out of scope:

- Full adult-family ending synthesis.
- Full AI branch suggestion prompt protocol.

Verification:

- Unit tests for event selection gates and choice-driven state persistence.
- Build must still pass.

### job-3-ui-progress-and-records

Type: `dev`
Depends on: `job-2-api-event-integration`

Goal: Replace fixed-count progress UI with life-stage progress and keep record UI free of route grades.

Expected files:

- `app/page.tsx`
- `app/globals.css` if layout adjustments are needed
- `tests/unit/home-page.test.tsx` if useful
- `tests/acceptance/life-stage-state-machine.spec.ts` only if selectors need small stabilization

Scope:

- Display semester/life-stage label as the primary progress model.
- Remove visible `x/15` and fixed 15-event progress bar from play and character detail surfaces.
- Show concise academic status: e.g. `2학년 1학기`, `휴학`, `자퇴`, `4학년 2학기 · 졸업요건 점검`, `추가학기`.
- Keep “새로 시작”, records, relationships, and stat update flow working.
- Ensure records/final result UI has no A/B/C or GOOD/MIXED/HARD labels.
- Preserve mobile single-column readability.

Out of scope:

- New landing page.
- Large visual redesign.

Verification:

- Unit/component tests where practical.
- Manual or Playwright check for desktop/mobile if app can run locally.

### job-4-slice-1-verification

Type: `integration_test`
Depends on:

- `job-1-life-stage-core`
- `job-2-api-event-integration`
- `job-3-ui-progress-and-records`

Goal: Report whether Slice 1 is ready to ship.

Scope:

- Run:
  - `npm run test`
  - `npm run build`
  - `npm run test:acceptance -- tests/acceptance/life-stage-state-machine.spec.ts` if local test environment is available.
- Check no visible primary `x/15` progress remains.
- Check no route grades appear in record UI.
- Check legacy characters without life-stage flags still load.
- Check named destination results remain gated by prior candidate/process state.

Report-only:

- This job must not edit product files.
- If it finds a blocking issue, it should report the finding and recommend a dev follow-up.

## Slice 2: AI Branches And Specific Life Results

Delivery mode: `agile`
Active slice: `Slice 2: AI Branches And Specific Life Results`

### DAG

```text
job-1-ai-branch-proposal
  ├── job-2-multi-stage-process-gating
  ├── job-3-marriage-childbirth-endings
  └── job-4-enhanced-ai-prompts-ui
      └── job-5-slice-2-verification
```

### job-1-ai-branch-proposal

Type: `dev`

Goal: Add AI branch candidate proposal mechanism and destination synthesis engine.

Expected files:
- `lib/game/openrouter.ts` (add `generateAiBranchProposals()`)
- `lib/game/life-stage.ts` (extend DestinationCandidate lifecycle)
- `lib/game/destination-synthesis.ts` (new file)
- `tests/unit/api/destination-synthesis.test.ts`

Scope:
- Add `generateAiBranchProposals()` function in openrouter.ts that takes current character state + destinationCandidates + storyArc and outputs 2-4 branch options with destination synthesis suggestions.
- Each branch proposal includes: `{ id, label, summary, suggestedDestinationKind, statRequirements, relationshipRequirements }`.
- Extend `DestinationCandidate` lifecycle to support AI-introduced candidates (new `introducedBy` source: `"ai_branch"`).
- Add `synthesizeDestination()` function in new `lib/game/destination-synthesis.ts` that:
  - Takes passed destination candidates, stats, relationships, event history.
  - Matches against `career-data.ts` seed data via `findBestMatchingDestination()`.
  - Generates a synthesized destination name, role, salary band from matched seed.
  - Falls back to stat-based career path if no destination candidate passed.
- Add `getDestinationCandidatesForEnding()` that collects all gate_passed candidates and synthesizes the final outcome.
- Add unit tests for branch proposal parsing, destination synthesis, and candidate lifecycle.

Out of scope:
- UI changes.
- New static events.
- Prisma migration.

Verification:
- Unit tests pass for branch proposal, destination synthesis, candidate lifecycle.

### job-2-multi-stage-process-gating

Type: `dev`
Depends on: `job-1-ai-branch-proposal`

Goal: Add multi-stage application process tracking and events for company/institution/graduate-school processes.

Expected files:
- `lib/game/result-gating.ts` (extend with multi-stage process tracking)
- `lib/game/event-engine.ts` (add process-stage events)
- `lib/game/life-stage.ts` (extend DestinationCandidate with processStage)
- `tests/unit/api/result-gating.test.ts` (extend)

Scope:
- Extend `DestinationCandidate` with optional `processStage: "initial" | "screening" | "interview" | "result" | "accepted" | "rejected"`.
- Add `advanceProcessStage()` function that moves a candidate through process stages.
- Add process-stage conditional events in event-engine.ts:
  - 서류 합격/불합격 통보 (screening result)
  - 면접 준비와 실전 (interview stage)
  - 최종 결과 통보 (final result)
  - 대학원 연구실 면담 (graduate school process)
  - 추가 서류 제출 (additional documents)
- Gate these events by current processStage of relevant destination candidates.
- Update `resolveCareerGateFlagDelta()` to support multi-stage scoring (each stage has its own threshold).
- Add `getProcessStageLabel()` for UI display.
- Extend unit tests for multi-stage process flow.

Out of scope:
- UI changes for process stage display.
- AI branch proposal integration (handled in job-1).

Verification:
- Unit tests pass for multi-stage process gating and stage advancement.

### job-3-marriage-childbirth-endings

Type: `dev`
Depends on: `job-1-ai-branch-proposal`

Goal: Add marriage/cohabitation/childbirth/parenting ending types and state tracking.

Expected files:
- `lib/game/life-stage.ts` (extend with relationship life state)
- `app/api/characters/[id]/choices/route.ts` (extend ending creation)
- `lib/game/openrouter.ts` (extend ending prompt context)
- `tests/unit/api/life-stage.test.ts` (extend)

Scope:
- Add `RelationshipLifeState` type: `"single" | "dating" | "cohabitation" | "married" | "divorced" | "widowed"`.
- Add `ParentingState` type: `{ hasChildren: boolean; childCount: number; parentingStage: "none" | "expecting" | "newborn" | "toddler" | "school_age" }`.
- Store relationship life state in `hiddenState.eventFlags.relationshipLife`.
- Add `deriveRelationshipLifeState()` that reads from event flags.
- Add `getRelationshipEndingType()` that determines ending type based on relationship state + stats.
- Extend `buildFinalEndingRecord()` in choices/route.ts to handle:
  - Marriage ending (high trust with romantic partner, stable stats).
  - Cohabitation ending (moderate trust, practical arrangement).
  - Single/independent ending (low relationship investment, high career focus).
  - Parenting ending (relationship + parenting flags set).
  - Divorce/separation ending (negative relationship trajectory).
- Add `relationshipLife` context to AI ending generation so AI can write appropriate narratives.
- Add unit tests for relationship life state derivation and ending type selection.

Out of scope:
- New static events for dating/marriage/parenting (existing events already cover romance).
- UI changes for relationship life state display.

Verification:
- Unit tests pass for relationship life state and ending type selection.

### job-4-enhanced-ai-prompts-ui

Type: `dev`
Depends on:
- `job-1-ai-branch-proposal`
- `job-3-marriage-childbirth-endings`

Goal: Enhance AI ending prompts for romance/marriage/family outcomes and clean up ending UI.

Expected files:
- `lib/game/openrouter.ts` (enhance ending system prompt)
- `app/page.tsx` (UI cleanup)
- `tests/unit/home-page.test.tsx` (if useful)

Scope:
- Update ending system prompt in openrouter.ts to:
  - Explicitly handle romance/marriage/cohabitation/solitude outcomes.
  - Include relationship life state in the prompt context.
  - Add parenting/family outcome guidance.
  - Require at least one relationship or past event to be mentioned in the narrative.
  - Add fallback diversity for non-career paths (marriage, solitude, parenting, etc.).
- Update `buildUserPrompt()` for ending generation to include `relationshipLife` and `parentingState`.
- Update `buildFallbackLongEnding()` to generate diverse fallbacks for relationship-based endings.
- UI cleanup in app/page.tsx:
  - Ensure record UI has no A/B/C or GOOD/MIXED/HARD route labels (already done, verify).
  - Ensure destination names only appear when earned through process gates.
  - Clean up any remaining fixed-count progress references.
  - Ensure mobile single-column readability is preserved.
- Add `stripUnsupportedDestinations()` helper that removes any destination names not backed by gate_passed candidates.

Out of scope:
- New static events.
- Large visual redesign.

Verification:
- Build passes.
- Manual or Playwright check for desktop/mobile if app can run locally.

### job-5-slice-2-verification

Type: `integration_test`
Depends on:
- `job-1-ai-branch-proposal`
- `job-2-multi-stage-process-gating`
- `job-3-marriage-childbirth-endings`
- `job-4-enhanced-ai-prompts-ui`

Goal: Report whether Slice 2 is ready to ship.

Scope:
- Run:
  - `npm run test`
  - `npm run build`
- Check no visible route grades in record UI.
- Check destination names only appear when backed by gate_passed candidates.
- Check AI branch proposal mechanism works (unit tests pass).
- Check multi-stage process gating works (unit tests pass).
- Check marriage/childbirth ending types work (unit tests pass).
- Check legacy characters without Slice 2 flags still load.

Report-only:
- This job must not edit product files.
- If it finds a blocking issue, it should report the finding and recommend a dev follow-up.

## Shared Constraints

- Public stats remain `1-10`; hidden risk values such as `burnoutRisk` remain `0-100`.
- Do not add a Prisma migration in Slice 1.
- Do not introduce real company names, executives, or allegations.
- Do not show ABC grades or GOOD/MIXED/HARD route labels.
- Do not make AI output authoritative for state transitions.
- Do not revert unrelated user changes.


## Harness (inlined)
# Harness: Life Stage State Machine

## Formatting & Linting

- TypeScript/React code must pass `npm run build`.
- Existing lint config remains available as `npm run lint`; use when touching broad UI/code style.
- Use ASCII for new code unless existing Korean narrative/copy requires Korean text.

## Testing

- Unit tests: `npm test -- --run tests/unit/api/game-rules.test.ts tests/unit/api/event-engine.test.ts tests/unit/home-page.test.tsx`.
- Add focused unit tests for `lib/game/life-stage.ts` when introduced.
- Add or update event-engine tests for state-gated event selection.
- Add UI test coverage when progress labels/record labels change.
- Browser e2e is useful but optional for Slice 1 if unit/build coverage verifies the public surface; interaction critic may inspect UI with Playwright if available.

## Architecture Rules

- Server owns game state. Client renders and submits choice indices only.
- New Slice 1 state must route through a dedicated helper module, expected path `lib/game/life-stage.ts`.
- No Prisma migration in Slice 1; use existing JSON fields.
- Do not scatter transition rules directly across UI and API files.
- AI may suggest but never authorizes state transitions.
- All character reads/mutations remain current-user scoped.

## Code Principles

- Prefer additive compatibility for existing saves.
- Prefer explicit typed helpers over ad hoc JSON access.
- Keep event choices as strategy/attitude choices; avoid direct result labels for gates.
- Fallback behavior must remain playable if OpenRouter fails.
- Keep Korean UI copy concise and story-forward.

## Danger Zones

- Do not edit `.tenet/project/**`.
- Do not commit `.tenet/.state/**`.
- Do not expose `.env.local` or server-only OpenRouter credentials.
- Do not use real company names or real-world allegations.
- Do not introduce destructive database migrations in Slice 1.

## Iron Laws

- Auth-required character APIs must call `requireCurrentUserId()` and scope by `userId`.
- Public stats remain 1-10.
- `burnoutRisk` remains hidden 0-100.
- Named destination endings require prior destination/process state.
- Record UI must not display A/B/C, GOOD ROUTE, MIXED ROUTE, or HARD ROUTE.
- Invalid or corrupt life-stage JSON must fall back to derived state, not crash gameplay.

## Project Doctrine Boundary

Normal implementation jobs must not edit `.tenet/project/**`. Proposed doctrine updates belong in `.tenet/runs/2026-07-07-life-stage-state-machine/journal/`.


## Selective references (consult as relevant)
Under .tenet/runs/2026-07-07-life-stage-state-machine/: journal/ (prior attempts + failure logs), research/ (current-run research), visuals/ (UI/architecture mockups).
</tenet_run_context>

## Deliverable Requirements

You are a worker agent executing a development job. You MUST produce concrete deliverables:
If a <tenet_run_context> block appears above, read it first — it is the source of truth for this job; do not work blind from the task text alone.
- Write or modify source code files that implement the described feature
- Ensure the code compiles/passes type-checking
- Run existing tests to verify no regressions
- If acceptance tests exist (tests/acceptance/ or similar), run them and fix any failures related to your work
- Write BEHAVIORAL tests that verify observable outcomes (e.g., "login returns session cookie and redirects to dashboard")
- Do NOT write tests that only check absence of errors or internal state — a separate test critic will reject them
- Every new endpoint, page, or feature MUST have at least one test that verifies it works correctly
- Do NOT just explore, research, or describe what could be done — actually implement it
- Do NOT edit `.tenet/project/**`. If you discover project doctrine (`.tenet/project/**`) is missing, stale, or wrong, record a **doctrine-drift note** — do NOT patch doctrine directly.
- Write the drift note to the run journal via `tenet_update_knowledge(type="journal", title="doctrine drift: <file>", findings={"doctrine_file": "<e.g. project/architecture.md>", "current_claim": "<what doctrine currently says>", "observed_reality": "<what the code or run actually shows>", "proposed_change": "<the specific edit that brings doctrine back in line>"})`.
- ALSO drop a `### doctrine-drift: <file>` marker at the spot in the run doc (e.g. `design.md`) where you note the drift inline, so the run-end review finds it even when written freeform. One note per affected doctrine file; the review dedupes by `doctrine_file`.

## Smoke Check (mandatory before exiting)
- If this is a server/API feature: start the server, verify your endpoints respond (non-5xx)
- If this is a frontend feature: start the dev server, verify pages render without errors
- If smoke check fails, fix the issue before exiting

## Git Commit (mandatory before exiting, if .git/ exists)
- Stage all files you changed, including relevant `.tenet` documents you created or edited (use `git add` with specific paths, NOT `git add -A`)
- Commit with message: `tenet({job-name}): {short description of what was done}`
- Include the commit SHA in your final output
- If you cannot commit, explain why in your final output and leave the changes in the working tree
- Do NOT push — only commit locally
- If there are no file changes, something is wrong — you must produce deliverables

If the task is unclear, make reasonable assumptions and implement. Do not exit without producing code.
This is retry #1. The previous attempt failed.
BEFORE starting work, check .tenet/runs/2026-07-07-life-stage-state-machine/journal/ for failure logs matching this job.
Look for files like: *-ai-branch-proposal-+-destination-synthesis*trial*.md
Or search for: *-life-stage-state-machine*trial*.md
Read them to understand what was tried and why it failed. Do NOT repeat the same approach.
## Task

Implement AI branch candidate proposal mechanism and destination synthesis engine. Previous attempt failed due to OpenAI Codex usage limit - retrying with fresh context.

## Context
Slice 1 implemented the life-stage state machine with career gate events. Slice 2 needs to add AI-powered branch proposals and destination synthesis.

## Files to read first
- lib/game/openrouter.ts - current AI event/ending generation
- lib/game/life-stage.ts - DestinationCandidate type and lifecycle
- lib/game/result-gating.ts - current result gating
- lib/game/career-data.ts - seed destination data
- lib/game/event-engine.ts - event selection context
- app/api/characters/[id]/choices/route.ts - ending creation flow

## What to implement

### 1. Add generateAiBranchProposals() in openrouter.ts
- New function that takes character state + destinationCandidates + storyArc
- Returns 2-4 branch options with: { id, label, summary, suggestedDestinationKind, statRequirements, relationshipRequirements }
- Each branch is a possible future direction (career, relationship, academic, etc.)
- Use a new system prompt focused on branch proposals, not event generation
- Follow existing patterns: extractJson, normalize, Zod validation

### 2. Extend DestinationCandidate lifecycle in life-stage.ts
- Add `processStage` field: "initial" | "screening" | "interview" | "result" | "accepted" | "rejected"
- Update sanitizeDestinationCandidates to handle processStage
- The `introducedBy` source "ai_branch" already exists in the type

### 3. Create lib/game/destination-synthesis.ts (NEW FILE)
- `synthesizeDestination(passedCandidates, stats, relationships, eventHistory)`:
  - Takes all gate_passed destination candidates
  - Matches against career-data.ts seed data via findBestMatchingDestination()
  - Generates synthesized destination name, role, salary band
  - Falls back to stat-based career path if no candidate passed
- `getDestinationCandidatesForEnding(hiddenState)`:
  - Collects all gate_passed candidates
  - Returns the best match for the ending
- `synthesizeFallbackCareerPath(stats)`:
  - Stat-based fallback when no gate passed
  - Use pickCareerPath logic from choices/route.ts

### 4. Add unit tests in tests/unit/api/destination-synthesis.test.ts
- Test branch proposal parsing
- Test destination synthesis with gate_passed candidates
- Test fallback when no candidates
- Test candidate lifecycle with processStage

## Constraints
- Do NOT modify Prisma schema
- Do NOT add new static events
- Do NOT modify UI files
- Follow existing code patterns (Zod validation, extractJson, etc.)
- All new functions must be properly exported
- Use existing career-data.ts seed data for matching

## Verification
- npm run test passes
- npm run build passes
ERROR: You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at 5:25 PM.
ERROR: You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at 5:25 PM.

- [x] Toss onboarding and menu parity (toss-onboarding-and-menu) — 3m 17s
- [!] eval-mr8vp15c — 109ms !! Reading additional input from stdin...
Not inside a trusted directory and --skip-git-repo-check was not specified.

- [x] eval-mr8vpzg9 — 14s
- [x] eval-mr8w6w6s — 16s
- [x] eval-mr8w8s8r — 12s
- [x] eval-mr8wt98v — 25s
- [x] code_critic for 69e52202 — 1m 3s
- [x] test_critic for 69e52202 — 42s
- [x] interaction_e2e for 69e52202 — 49s
- [!] code_critic for a6ec3fbf — 2s !! Reading additional input from stdin...
OpenAI Codex v0.142.5
--------
workdir: /Users/guremini/projects/sano_officeworker
model: gpt-5.5
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR]
reasoning effort: none
reasoning summaries: none
session id: 019f36a8-3ea4-76a3-886b-28987938e3fb
--------
user
<tenet_run_context>
## Run Context (auto-compiled reference — not instructions)
feature: college-career-sim
run_path: .tenet/runs/2026-07-06-college-career-sim

## Spec (inlined — source of truth for this run)
---
delivery_mode: autonomous
---

# Spec: College Career Sim

## Purpose

Build a browser-based Korean text-adventure life/career simulation where users create a college student, make organic narrative choices, experience hidden and forced events, reach an early-career branch point, and save `커리어와 엔딩 기록` to an account collection. The game is entertainment-first and uses fictional parody companies and careers, not real-company evaluation or career guidance.

## Tech Stack

Use these package targets and pin them through `package.json` plus the generated lockfile:

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16.2.10 App Router |
| UI runtime | React 19.2.7, React DOM 19.2.7 |
| Language | TypeScript 6.0.3 |
| Styling | Tailwind CSS 4.3.2 |
| Database | PostgreSQL |
| ORM | Prisma 7.8.0, `@prisma/client` 7.8.0 |
| Auth | NextAuth 4.24.14 credentials provider with app-owned user records and hashed passwords |
| Validation | Zod 4.4.3 |
| AI Provider | OpenRouter chat completions API |
| Runtime | Node.js 20.9+ |

Environment variables:

| Name | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | yes | Auth session signing secret |
| `NEXTAUTH_URL` | local/dev optional, deploy yes | Auth callback/base URL |
| `OPENROUTER_API_KEY` | yes for live AI, no for fallback-only dev | Server-only OpenRouter key; user has key ready |
| `OPENROUTER_MODEL` | no | Selected OpenRouter model; default to a low-cost general-purpose model when absent |

## API Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/signup` | no | Create user with email/password; hash password before storage. |
| `GET/POST` | `/api/auth/[...nextauth]` | mixed | NextAuth credentials login/session routes. |
| `GET` | `/api/me` | yes | Return current user profile and AI daily usage summary. |
| `POST` | `/api/characters` | yes | Create character with user-entered name, age, starting grade/year, and major/department. |
| `GET` | `/api/characters` | yes | List user's character runs. |
| `GET` | `/api/characters/:id` | owner | Fetch character state, current event, relationships, memories, and records summary. |
| `POST` | `/api/characters/:id/choices` | owner | Apply a choice to the current event using server-owned transition rules. |
| `POST` | `/api/characters/:id/events/next` | owner | Select next event; may call OpenRouter for key moments or use fallback/static pool. |
| `POST` | `/api/characters/:id/events/forced-check` | owner | Evaluate threshold-based forced events such as burnout. |
| `POST` | `/api/characters/:id/records` | owner | Generate and save a `커리어와 엔딩 기록` when progression thresholds are met. |
| `GET` | `/api/records` | yes | List account-level saved records with filters. |
| `GET` | `/api/career-destinations` | yes | Return parody companies, public-sector paths, licensed professions, entrepreneurship, and self-employment destinations. |

## Database Schema

### `User`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | string/uuid | primary key |
| `email` | string | unique, required, normalized lowercase |
| `passwordHash` | string | required |
| `createdAt` | datetime | required |
| `updatedAt` | datetime | required |

### `CharacterRun`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | string/uuid | primary key |
| `userId` | string/uuid | required, owner FK |
| `name` | string | required, user-entered, 1-24 chars |
| `age` | integer | required, 18-35 MVP bound |
| `startGradeYear` | integer | required, 1-4 |
| `currentGradeYear` | integer nullable | 1-4 when enrolled |
| `major` | string | required, 1-40 chars |
| `academicStatus` | enum | `ENROLLED`, `LEAVE`, `DROPPED_OUT`, `GRADUATED` |
| `lifeStatus` | string array/json | flags such as `PART_TIME_JOB`, `INTERNSHIP`, `EXAM_PREP`, `STARTUP_PREP` |
| `majorEventCount` | integer | default 0 |
| `coreEventCount` | integer | default 0 |
| `currentEventId` | string nullable | FK or active generated event id |
| `createdAt` | datetime | required |
| `updatedAt` | datetime | required |

### `CharacterStats`

| Column | Type | Constraints |
| --- | --- | --- |
| `characterRunId` | string/uuid | primary/unique FK |
| `academic` | integer | 0-100 |
| `practical` | integer | 0-100 |
| `communication` | integer | 0-100 |
| `creativity` | integer | 0-100 |
| `health` | integer | 0-100 |
| `mental` | integer | 0-100 |
| `network` | integer | 0-100 |
| `wealth` | integer | 0-100 |
| `reputation` | integer | 0-100 |
| `charm` | integer | 0-100 |

### `HiddenState`

| Column | Type | Constraints |
| --- | --- | --- |
| `characterRunId` | string/uuid | primary/unique FK |
| `majorFit` | integer | 0-100 |
| `burnoutRisk` | integer | 0-100; forced burnout candidate at 85+ |
| `romanceState` | json | required default object |
| `familyState` | json | required default object |
| `friendState` | json | required default object |
| `careerInterests` | string array/json | required default empty |
| `companyRolePreferences` | string array/json | required default empty |
| `imageFit` | json | required default object |
| `selfCareCondition` | json | required default object |
| `eventFlags` | json | required default object |

### `Relationship`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | string/uuid | primary key |
| `characterRunId` | string/uuid | required FK |
| `name` | string | required |
| `role` | string | required, e.g. senior, friend, manager |
| `trust` | integer | 0-100 |
| `tags` | string array/json | required default empty |
| `createdAt` | datetime | required |

### `Event`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | string/uuid | primary key |
| `characterRunId` | string/uuid nullable | null for reusable static templates |
| `source` | enum | `STATIC`, `AI`, `FALLBACK`, `FORCED` |
| `status` | enum | `ACTIVE`, `RESOLVED`, `DISCARDED` |
| `title` | string | required |
| `body` | text | required |
| `choices` | json | 2-4 choices unless forced transition is pre-choice |
| `tags` | string array/json | required default empty |
| `safetyChecked` | boolean | required |
| `createdAt` | datetime | required |

### `EventHistory`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | string/uuid | primary key |
| `characterRunId` | string/uuid | required FK |
| `eventId` | string/uuid | required FK |
| `choiceId` | string nullable | null for forced event trigger |
| `summary` | string | required |
| `statDelta` | json | server-validated deltas |
| `relationshipDelta` | json | server-validated deltas |
| `flagDelta` | json | server-validated deltas |
| `createdAt` | datetime | required |

### `CareerDestination`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | string/uuid | primary key |
| `displayName` | string | required fictional/parody name |
| `destinationType` | enum | `PARODY_COMPANY`, `PUBLIC_SECTOR`, `LICENSED_PROFESSION`, `ENTREPRENEURSHIP`, `SELF_EMPLOYMENT` |
| `industry` | string | required |
| `roles` | string array/json | required |
| `salaryBand` | string | required |
| `cultureTags` | string array/json | fictional descriptors only |
| `hiringDifficulty` | integer | 1-5 |
| `preferredStats` | json | required |
| `eventTone` | string array/json | required |

No `inspiredBy` or exact real-company reference column is allowed.

### `CareerEndingRecord`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | string/uuid | primary key |
| `userId` | string/uuid | required FK |
| `characterRunId` | string/uuid | required FK |
| `title` | string | required |
| `summary` | string | required |
| `longNarrative` | text | required |
| `careerPath` | string | required |
| `jobRole` | string nullable | optional |
| `destinationName` | string nullable | snapshot fictional name |
| `salaryBand` | string nullable | snapshot |
| `workplaceTone` | string array/json | required |
| `statSnapshot` | json | required |
| `keyRelationships` | json | required |
| `majorEvents` | json | 3-7 summaries |
| `satisfaction` | integer | 0-100 |
| `growthPotential` | integer | 0-100 |
| `workLifeBalance` | integer | 0-100 |
| `healthState` | string | required |
| `relationshipState` | string | required |
| `tags` | string array/json | required |
| `similarityKey` | string | required for grouping |
| `createdAt` | datetime | required |

### `AiUsage`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | string/uuid | primary key |
| `userId` | string/uuid | required FK |
| `date` | string | `YYYY-MM-DD`, unique with user |
| `count` | integer | 0-30 MVP limit |
| `updatedAt` | datetime | required |

## Event And Validation Rules

- Public stats are bounded 0-100.
- A single normal choice can change an individual public stat by at most 15 points unless a server-owned forced event explicitly allows a larger one-time effect.
- Events must include title, body, source, tags, and either 2-4 choices or a forced-transition marker.
- AI can propose narrative text, choices, result descriptions, and candidate deltas. The server clamps or rejects deltas and owns canonical persistence.
- Forced events can trigger before player choice when thresholds are crossed. MVP forced trigger: `burnoutRisk >= 85` produces a burnout crisis/recovery event.
- After a forced event, the player must receive recovery or response choices in the next screen.
- Discard any AI output that misses required fields, exceeds choice count, contains real-company claims, names exact real companies, references real executives/incidents/controversies, or includes unsafe targeted insults.
- If AI is unavailable, invalid, over daily limit, or over 10 seconds, use a static fallback event with matching tags.

## Design Direction

Use the selected literary mockup as the primary design reference: `.tenet/runs/2026-07-06-college-career-sim/visuals/2026-07-06-01-mockup-literary.html`.

Also use:
- Architecture diagram: `.tenet/runs/2026-07-06-college-career-sim/visuals/2026-07-06-00-architecture.html`
- Prototype: `.tenet/runs/2026-07-06-college-career-sim/visuals/2026-07-06-04-prototype-core-flow.html`
- Run design decisions: `.tenet/runs/2026-07-06-college-career-sim/design.md`
- Project doctrine: `.tenet/project/design.md`

The core UI is a Korean text-adventure reading surface with supporting cards. At 768px and below, collapse to a single-column layout with narrative before supporting cards.

## Auth Flow

1. User opens the app and sees login/signup entry.
2. User signs up with email/password through `/api/auth/signup`.
3. Server validates email/password, hashes the password, creates the user, and returns a success response.
4. User logs in through NextAuth credentials.
5. Server creates an authenticated session/JWT.
6. Authenticated pages and APIs require the session and enforce user ownership on characters and records.
7. Invalid credentials show concise recoverable feedback without revealing whether an email exists.
8. Logout ends the session and returns the user to auth entry.

## Character Creation Flow

1. Authenticated user clicks create character.
2. User enters a name and chooses starting age, starting grade/year, and major/department.
3. Server validates name length, age range, grade range, and major text.
4. Server creates `CharacterRun`, `CharacterStats`, `HiddenState`, starter relationships, and first event.
5. User lands on the literary play surface with the entered name visible.

## Success Criteria

1. A user can sign up, log in, create a character with user-entered name/age/grade/major, and see the play UI within normal local development latency.
2. A character starts with all 10 public stats and hidden state initialized in the database.
3. A current event displays readable Korean narrative and 2-4 choices unless it is an automatic forced trigger.
4. Choosing an event option persists event history, applies server-validated stat/relationship/flag changes, and displays the next event.
5. When `burnoutRisk >= 85`, the server can produce a forced burnout event without requiring an initial player choice, then returns the player to recovery choices.
6. OpenRouter generation is called only server-side, respects 30 calls per account per day, times out at 10 seconds, and falls back to static content on failure.
7. A character with at least 15 core events and a career branch point can generate a `커리어와 엔딩 기록`.
8. Saved records are account-scoped, include required record fields, and remain visible after logout/login.
9. Same company/job records can coexist when narrative context differs; near duplicates are grouped by approximate 80% overlap.
10. Parody company data never stores exact real-company names, `inspiredBy`, real executives, real controversies, or real allegations.
11. Desktop literary layout and mobile 768px single-column layout are both usable without text overlap.

## Out of Scope

- Social login.
- Payments.
- Admin/content management tools.
- Unity or native mobile clients.
- Real-company factual profiles, rankings, or claims.
- Real career guidance or assessment claims.
- Production-scale load testing beyond MVP target assumptions.
- User-authored arbitrary prompts.
- Full illustration or animation system.


## Scenarios (inlined — success/failure shapes for this run)
# Scenarios: College Career Sim

## Scenarios (Success)

1. Signup, login, and character creation
   - User opens the app.
   - User signs up with `player@example.com` and a valid password.
   - User logs in.
   - User creates a character by entering name `한서윤`, selecting age `21`, starting grade/year `2`, and major `사회학과`.
   - Expected outcome: the play screen shows `한서윤`, the selected starting details, initialized public stats, and a first event.
   - Expected persistence: `User`, `CharacterRun`, `CharacterStats`, `HiddenState`, and first `Event` records exist and belong to that account.

2. Normal event choice updates state
   - Authenticated user views a current event with 2-4 choices.
   - User selects a choice about asking a club senior for internship details.
   - Expected outcome: UI advances to a next situation or updated event.
   - Expected persistence: `EventHistory` stores the choice; stat deltas are clamped to allowed bounds; relationship trust or flags update server-side.

3. OpenRouter failure falls back without blocking play
   - User reaches a key event where AI generation is attempted.
   - OpenRouter mock returns timeout, invalid JSON, or rate-limit.
   - Expected outcome: user sees a static fallback event with matching tags and can continue.
   - Expected persistence: AI usage/failure metadata is recorded as appropriate, but no invalid AI event is committed as canonical state.

4. Forced burnout event
   - Character hidden `burnoutRisk` reaches 85 or higher after repeated overwork choices.
   - Server evaluates forced-event thresholds.
   - Expected outcome: a burnout crisis/recovery event appears without requiring the user to pick an initial event choice.
   - Expected persistence: forced event is stored in event history with null choice id, and the next screen offers recovery/response choices.

5. Career and ending record generation
   - Character has at least 15 core events and reaches a branch point such as employment, entrepreneurship, graduation, extended leave, dropout, public-sector entry, or licensed-profession entry.
   - User triggers record generation.
   - Expected outcome: `커리어와 엔딩 기록` is saved and appears in the collection.
   - Expected persistence: record includes title, summary, long narrative, career path, salary band, workplace tone, stat snapshot, key relationships, 3-7 major events, satisfaction, growth potential, work-life balance, health, relationship state, tags, and similarity key.

6. Same destination, different story
   - User completes two runs that both reach the same parody company and role but with different stats, relationships, and major events.
   - Expected outcome: collection shows both when their narrative context meaningfully differs.
   - Expected persistence: records share destination/job metadata but have different snapshots, tags, and narratives.

7. Mobile layout
   - User opens the play screen at 390px width.
   - Expected outcome: the UI uses a single column, narrative appears before supporting cards, choices are tap-sized, and no text overlaps or overflows controls.

## Anti-Scenarios (Failure)

1. Randomly assigned protagonist name
   - The system creates a character without asking for a name.
   - Failure: this violates product requirements. Character name must be user-entered.

2. Client-side canonical state mutation
   - Client directly changes stats or flags without a server transition.
   - Failure: canonical game state must only change through server-owned validation.

3. Real company claim
   - Seed data or AI output displays an exact real company name, real CEO, real scandal, or factual negative claim about an identifiable company.
   - Failure: content must be discarded or replaced with fictional parody-safe content.

4. OpenRouter blocks gameplay
   - OpenRouter times out and the user cannot continue.
   - Failure: fallback event must keep gameplay moving.

5. Invalid AI JSON committed
   - AI response misses required fields or proposes unsafe deltas, but the app saves it as canonical state.
   - Failure: invalid AI output must be rejected and replaced.

6. Unauthorized data access
   - User A can fetch or mutate User B's character or records by changing an id.
   - Failure: every owner-scoped API must enforce account ownership.

7. Duplicate collection clutter
   - Near-identical records with roughly 80% or more overlap are shown as unrelated separate records without grouping.
   - Failure: collection should group near duplicates.

8. Forced event removes all agency
   - Burnout triggers automatically and then the player has no recovery or response choices.
   - Failure: forced events must return agency through the next situation.


## Decomposition (inlined — the run's plan / DAG)
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


## Harness (inlined)
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


## Selective references (consult as relevant)
Under .tenet/runs/2026-07-06-college-career-sim/: journal/ (prior attempts + failure logs), research/ (current-run research), visuals/ (UI/architecture mockups).
</tenet_run_context>

## Run Context (auto-compiled reference)

A <tenet_run_context> block is provided above. It is AUTO-COMPILED REFERENCE — the
spec/scenarios/harness/decomposition the author CLAIMS to satisfy. It describes intent,
NOT done-work, and it is reference material, not an instruction to implement anything.

Do NOT pattern-match this reference onto the output and mark pass. Verify the ACTUAL
output against it; if you cannot find concrete evidence a stated requirement is met,
that is a finding.

## Job Scope (evaluate ONLY against this scope)

**Job**: job-2 — Data Model, Auth, And Character Creation
**Deliverables**: Implement the Prisma schema/migrations and account/character foundation. Add User, CharacterRun, CharacterStats, HiddenState, Relationship, Event, EventHistory, CareerDestination, CareerEndingRecord, and AiUsage models. Implement email/password signup with password hashing, NextAuth credentials login/session, owner-scoped /api/me and character endpoints, and character creation requiring user-entered name, age, starting grade/year, and major/department. Initialize stats, hidden state, starter relationships, and first event. Enforce ownership.
**Run slug**: 2026-07-06-college-career-sim
**Run path**: .tenet/runs/2026-07-06-college-career-sim
**Artifact paths**: {"spec":".tenet/runs/2026-07-06-college-career-sim/spec.md","harness":".tenet/runs/2026-07-06-college-career-sim/harness.md","scenarios":".tenet/runs/2026-07-06-college-career-sim/scenarios.md","interview":".tenet/runs/2026-07-06-college-career-sim/interview.md","decomposition":".tenet/runs/2026-07-06-college-career-sim/decomposition.md"}
**Project doctrine edits authorized**: no

CRITICAL: Only evaluate work that falls within THIS job's scope above.
Features, tests, or capabilities assigned to OTHER jobs in the DAG are OUT OF SCOPE.
If project doctrine edits are not authorized, any change under `.tenet/project/**` is OUT OF SCOPE and must be reported as `scope_conflict`.
Do NOT fail this job for missing functionality that belongs to a later job.
## Code Critic — Purpose Alignment Check

You are the CODE CRITIC. You have NO access to the author's reasoning or conversation.
The worker's output for this job is under ## Worker Output below.

Check independently:
- Does the implementation match the spec's intent FOR THIS JOB'S SCOPE?
- Are any anti-scenarios violated?
- Are there obvious gaps or missing edge cases WITHIN THIS JOB'S SCOPE?

ZERO-FINDINGS RULE: If you find nothing wrong, you MUST re-analyze from an alternate
attack angle (security, performance, concurrency, error handling). Zero findings on
first pass triggers a mandatory second pass.

Then perform structured self-questioning:
- Edge cases: empty input, max values, unicode?
- Error paths: dependency failures, timeouts?
- Integration: does this break upstream/downstream?
- Security: input validation, secret exposure, injection?
- Performance: N+1 queries, unbounded loops, memory leaks?

SEVERITY RULE: There is no "minor" or "non-blocking" category. ALL findings are blocking.
If you find an issue — no matter how small (missing CASCADE, unused import, inconsistent
naming) — the job FAILS. There is no human to catch deferred issues. Fix everything now.
A "pass with minor findings" is a FAIL.

### Finding categories (required)
Each finding MUST include a "category" so the orchestrator can route follow-up work correctly:
- "product_bug": implementation does not match spec intent
- "test_bug": test asserts the wrong thing, would pass when it should fail
- "harness_bug": build/lint/test infra itself is broken
- "evidence_mismatch": report claims numbers that fresh commands contradict
- "contention": failure looks like sibling eval stepping on shared state
- "scope_conflict": work violates declared job scope (e.g. report-only job edited files)
  Also use "scope_conflict" when project doctrine edits are not authorized and the job changed `.tenet/project/**`.

End with: {"passed": true/false, "stage": "code_critic", "findings": [{"category": "product_bug", "detail": "..."}, ...]}
## Worker Output

{
  "summary": "Data model, auth, and character creation foundation implemented. Fallback commit created by orchestrator: e33a27a. Verified npm run lint, npm run typecheck, npm test pass locally. Acceptance/build browser server binding blocked by sandbox EPERM as worker reported.",
  "commit": "e33a27a",
  "verification": [
    "npm run lint passed",
    "npm run typecheck passed",
    "npm test passed: 8 tests"
  ],
  "known_limits": [
    "npm run test:acceptance cannot bind dev server port in sandbox",
    "npm run build hit Turbopack port-binding EPERM per worker"
  ]
}
ERROR: You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at 7:59 PM.
ERROR: You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at 7:59 PM.

- [-] test_critic for a6ec3fbf !! cancelled by user
- [-] interaction_e2e for a6ec3fbf !! cancelled by user
- [x] eval-mr9y7xiv — 14s
- [x] eval-mra537q8 — 21s
- [x] eval-mra5dgk6 — 15s
- [x] eval-mra5eiar — 14s
- [x] eval-mra5kkno — 19s
- [!] blocking finding follow-up for Slice 1 verification sweep — 3s !! Reading additional input from stdin...
OpenAI Codex v0.142.5
--------
workdir: /Users/guremini/projects/sano_officeworker
model: gpt-5.5
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR]
reasoning effort: none
reasoning summaries: none
session id: 019f3aff-5184-7380-bf8e-a8886e7e9b10
--------
user
## Deliverable Requirements

You are a worker agent executing a development job. You MUST produce concrete deliverables:
If a <tenet_run_context> block appears above, read it first — it is the source of truth for this job; do not work blind from the task text alone.
- Write or modify source code files that implement the described feature
- Ensure the code compiles/passes type-checking
- Run existing tests to verify no regressions
- If acceptance tests exist (tests/acceptance/ or similar), run them and fix any failures related to your work
- Write BEHAVIORAL tests that verify observable outcomes (e.g., "login returns session cookie and redirects to dashboard")
- Do NOT write tests that only check absence of errors or internal state — a separate test critic will reject them
- Every new endpoint, page, or feature MUST have at least one test that verifies it works correctly
- Do NOT just explore, research, or describe what could be done — actually implement it
- Do NOT edit `.tenet/project/**`. If you discover project doctrine (`.tenet/project/**`) is missing, stale, or wrong, record a **doctrine-drift note** — do NOT patch doctrine directly.
- Write the drift note to the run journal via `tenet_update_knowledge(type="journal", title="doctrine drift: <file>", findings={"doctrine_file": "<e.g. project/architecture.md>", "current_claim": "<what doctrine currently says>", "observed_reality": "<what the code or run actually shows>", "proposed_change": "<the specific edit that brings doctrine back in line>"})`.
- ALSO drop a `### doctrine-drift: <file>` marker at the spot in the run doc (e.g. `design.md`) where you note the drift inline, so the run-end review finds it even when written freeform. One note per affected doctrine file; the review dedupes by `doctrine_file`.

## Smoke Check (mandatory before exiting)
- If this is a server/API feature: start the server, verify your endpoints respond (non-5xx)
- If this is a frontend feature: start the dev server, verify pages render without errors
- If smoke check fails, fix the issue before exiting

## Git Commit (mandatory before exiting, if .git/ exists)
- Stage all files you changed, including relevant `.tenet` documents you created or edited (use `git add` with specific paths, NOT `git add -A`)
- Commit with message: `tenet({job-name}): {short description of what was done}`
- Include the commit SHA in your final output
- If you cannot commit, explain why in your final output and leave the changes in the working tree
- Do NOT push — only commit locally
- If there are no file changes, something is wrong — you must produce deliverables

If the task is unclear, make reasonable assumptions and implement. Do not exit without producing code.
This is retry #2. The previous attempt failed.
BEFORE starting work, check .tenet/journal/ for failure logs matching this job.
Look for files like: *-blocking-finding-follow-up-for-slice-1-verification-sweep*trial*.md
Or search for: *-life-stage-state-machine*trial*.md
Read them to understand what was tried and why it failed. Do NOT repeat the same approach.
## Task

The blocking finding has already been manually fixed and committed (commit 4814f36). The fix adds lib/game/result-gating.ts (gateConcreteResultFields function), tests/unit/api/result-gating.test.ts (4 tests), and updates app/api/characters/[id]/choices/route.ts to use gateConcreteResultFields in both buildImmediateBadEndingRecord and buildFinalEndingRecord. All 53 tests pass including the new result-gating tests. You only need to: 1) verify the fix is correct by reading the files 2) run npm test to confirm 3) confirm the finding is resolved. No code changes needed - the work is already done.
ERROR: You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at 5:25 PM.
ERROR: You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at 5:25 PM.

- [!] eval-mrakrj21 — 3s !! Reading additional input from stdin...
OpenAI Codex v0.142.5
--------
workdir: /Users/guremini/projects/sano_officeworker
model: gpt-5.5
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR]
reasoning effort: none
reasoning summaries: none
session id: 019f3c5e-c5ce-7173-bf29-2da928969721
--------
user
Score this interview transcript on three dimensions. Be RIGOROUS — a perfect 1.0 on any dimension is extremely rare and requires exhaustive coverage. Use ONLY the transcript content — do not infer answers that were not explicitly given.

## Scoring Dimensions (use 0.1 increments)

### Goal Clarity (weight 0.4)
- 0.9-0.95: User confirmed acceptance criteria with concrete, testable examples AND edge cases are addressed AND success metrics are quantified.
- 0.8: User confirmed acceptance criteria with concrete examples but some edge cases or metrics are missing.
- 0.6-0.7: User gave general goals with some concrete criteria but gaps remain.
- 0.5: User gave general goals but no concrete criteria.
- 0.0-0.3: Goals unclear or contradictory.
- 1.0 is reserved for: EVERY acceptance criterion is testable, EVERY edge case is addressed, EVERY success metric is quantified with specific numbers. This almost never happens.

### Constraint Clarity (weight 0.3)
- 0.9-0.95: Tech stack, deployment, security, performance targets, and scaling requirements all confirmed with specific versions/numbers.
- 0.8: Tech stack and deployment confirmed, security discussed, but some constraints are implicit.
- 0.6-0.7: Most constraints known but some are assumed by the agent without user confirmation.
- 0.5: Some constraints known, others assumed by the agent.
- 0.0-0.3: No constraints discussed.
- 1.0 is reserved for: EVERY technical constraint is explicit, EVERY version is pinned, EVERY performance target has a number, EVERY security requirement is documented. This almost never happens.

### Success Criteria Clarity (weight 0.3)
- 0.9-0.95: Measurable scenarios defined with exact expected behavior ("user clicks X, sees Y within Z seconds") AND failure scenarios are defined.
- 0.8: Measurable scenarios defined but some are vague on expected outcomes or timing.
- 0.6-0.7: Mix of measurable and vague criteria.
- 0.5: Vague criteria ("it should work well").
- 0.0-0.3: No criteria discussed.
- 1.0 is reserved for: EVERY scenario has exact expected behavior, timing, and error handling defined. EVERY failure mode has a defined response. This almost never happens.

## Scoring Rules
- Be skeptical. If the transcript says "we discussed auth" but doesn't show the actual auth requirements, score it as if auth was NOT discussed.
- Do NOT round up. Use precise values like 0.75, 0.85, etc.
- A score of 0.95 means "nearly perfect, only trivial gaps remain."
- A score of 1.0 means "I cannot identify a single additional question that would improve clarity." Almost never give this.
- ALWAYS include at least one gap, even for high scores. There is always something that could be clarified further.

## Full-mode Delivery Mode Gate

If the transcript declares "Mode: Full", it MUST include "## Delivery Mode Decision" with:
- "Prompt shown"
- "User response"
- "Selected delivery_mode: autonomous|agile"
- "Selection basis: explicit_user_choice|defaulted_after_explicit_choice_prompt|yolo_agent_decision"

For non-YOLO Full mode, the decision must come from a standalone delivery-mode question that presented both "autonomous" and "agile". A bundled defaults question, unrelated "okay", or pre-execution confirmation does NOT satisfy this gate. If this gate fails, set "passed" to false regardless of the numeric clarity score and include the gate failure in "gaps".

## Output Format
Respond with ONLY this JSON (no markdown, no explanation):
{"goal": <number>, "constraints": <number>, "success_criteria": <number>, "clarity": <number>, "passed": <boolean>, "gaps": ["<missing item 1>", "<missing item 2>"]}

Where clarity = (goal * 0.4) + (constraints * 0.3) + (success_criteria * 0.3), and passed = clarity >= 0.8 AND no hard gate fails.
List specific gaps that would need additional interview questions — at minimum 1 gap even for high-scoring transcripts.

---

# Interview Transcript

# Interview: 스펙 시스템 (Credential/Spec System)

Date: 2026-07-07
Mode: Full
Rounds: 1

## Mode Selection
- Prompt shown: Full mode recommended - this is a major new game system (스펙/취준) that touches Prisma schema, event engine, game rules, UI, and career paths. Multiple modules involved, significant scope.
- User response: confirmed (계속 진행해줘)
- Selected mode: full
- Selection basis: explicit_user_choice

## Round 1

### Questions Asked
1. 스펙 시스템의 적용 시점은 언제인가요?
   > 3~4학년부터

2. 취준 프로세스를 어느 정도로 현실적으로 구현할까요?
   > 상세 구현 (서류→인적성→코테→1차면접→2차면접→최종합격, 회사 유형별 다른 전형)

3. 4학년 큰 사건들은 기존 DestinationCandidate 시스템과 어떻게 연결되나요?
   > 진로 트랙으로 연결 (워홀, 임용, 회계사, 로스쿨, 변리사, 메디컬 편입 등)

4. 데이터 저장 방식은?
   > 새 Prisma 모델 (마이그레이션 필요)

5. 전형 단계 세분화?
   > 6단계 상세 (서류→인적성→코테→1차면접→2차면접→최종합격)

6. 스펙 이벤트 시퀀스?
   > 2단계 이벤트 시퀀스 (접수/선택 → 다음 이벤트에 결과가 자연스럽게 녹아들음)

7. 선택 결과 전달 방식?
   > 선택 결과가 별도로 나오는 게 아니라 다음 이벤트 서두에 자연스럽게 녹아들어야 함 (이것은 기존 모든 이벤트 시스템에도 동일 적용)

8. 취준 비판 요소?
   > 모두 포함 (스펙 초월 합격, 블라인드 채용, 우울증/번아웃, 피로도, 자산 부담)

### Decisions Made
- 스펙 시스템은 3~4학년부터 본격적으로 활성화
- 취준 전형은 6단계 상세 구현, 회사 유형별 차별화
- 4학년 큰 사건은 진로 트랙으로 연결
- 새 Prisma 모델 추가 (Spec, SpecType, CareerPath 등)
- 스펙 이벤트는 2단계 시퀀스 (접수/선택 → 결과 반영)
- 선택 결과는 다음 이벤트 서두에 자연스럽게 녹아들도록 변경 (전체 이벤트 시스템에 적용)
- 한국 취준생 현실 비판 요소 모두 포함

### Remaining Ambiguities
- Prisma 모델의 구체적인 스키마 구조 (Spec, CareerPath 테이블 상세)
- 기존 이벤트 시스템 변경 범위 (선택 결과를 다음 이벤트에 녹이는 방식)
- 4학년 큰 사건들의 구체적인 게임플레이 루프

## Delivery Mode Decision
- Prompt shown: autonomous (one end-to-end run) vs agile (sliced delivery with checkpoints)
- User response: 계속 진행해줘 (implicitly confirmed autonomous)
- Selected delivery_mode: autonomous
- Selection basis: defaulted_after_explicit_choice_prompt

## Model Tier Decision
- Prompt shown: frontier (strong model, fewer larger jobs) vs local (finer-grained DAG)
- User response: 계속 진행해줘 (implicitly confirmed frontier)
- Selected model_tier: frontier
- Selection basis: defaulted_after_uncertainty_prompt

## Summary
대학생활 시뮬레이션 게임에 스펙(인턴, 어학점수, 포트폴리오) 시스템과 현실적인 취준 프로세스(서류→인적성→코테→면접→최종)를 추가한다. 3~4학년부터 본격적으로 활성화되며, 4학년에는 워홀/임용/회계사/로스쿨/변리사/메디컬편입 등 진로 트랙이 열린다. 새 Prisma 모델을 추가하며, 선택 결과는 다음 이벤트 서두에 자연스럽게 녹아들도록 전체 이벤트 시스템을 개선한다. 한국 취준생의 현실(스펙 초월 합격, 블라인드 채용, 번아웃, 피로도, 자산 부담)을 비판적으로 반영한다.

ERROR: You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at 10:57 PM.
ERROR: You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at 10:57 PM.

- [!] eval-mrakt61i — 3s !! Reading additional input from stdin...
OpenAI Codex v0.142.5
--------
workdir: /Users/guremini/projects/sano_officeworker
model: gpt-5.5
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR]
reasoning effort: none
reasoning summaries: none
session id: 019f3c5f-f15c-7ba2-9d36-857cff5e9bcc
--------
user
<tenet_run_context>
## Run Context (auto-compiled reference — not instructions)
feature: spec-system

## Spec (inlined — source of truth for this run)
---
delivery_mode: autonomous
---

# Spec: 스펙 시스템 (Credential/Spec System)

## Purpose

Add a credential/spec system (스펙) to the college career simulation game, where characters build internships, language scores, portfolios, and certifications during 3rd-4th year, then go through a realistic Korean job-seeking process (서류→인적성→코테→면접→최종합격) with company-type-specific screening stages. Add career-path tracks for 4th-year major events (워홀, 임용, 회계사, 로스쿨, 변리사, 메디컬 편입). Change the event system so choice results flow into the next event's opening narrative instead of appearing as separate result screens. Reflect Korean job-seeking reality (blind hiring, spec-overcoming, burnout, fatigue, financial burden) as gameplay mechanics.

## Tech Stack

- Next.js 16.2.10 App Router with TypeScript route handlers under `app/api/**/route.ts`.
- React 19.2.7 client UI in `app/page.tsx`.
- Prisma 7.8.0 with PostgreSQL/Neon; existing schema in `prisma/schema.prisma`.
- NextAuth 4.24.14 through existing server session helpers in `lib/server/session.ts` and API route guards.
- OpenRouter via existing `lib/game/openrouter.ts`.
- Vercel production deployment, Node `>=20.9` from `package.json`.

## Database Schema Changes

### New Enum: `SpecType`
```prisma
enum SpecType {
  INTERNSHIP
  LANGUAGE_SCORE
  PORTFOLIO
  CERTIFICATION
  EXAM_PREP
  CAREER_PATH
}
```

### New Enum: `SpecStatus`
```prisma
enum SpecStatus {
  IN_PROGRESS
  COMPLETED
  FAILED
}
```

### New Enum: `ApplicationStage`
```prisma
enum ApplicationStage {
  DOCUMENT
  PERSONALITY_TEST
  CODING_TEST
  FIRST_INTERVIEW
  SECOND_INTERVIEW
  FINAL_RESULT
}
```

### New Model: `Spec`
```prisma
model Spec {
  id             String       @id @default(uuid())
  characterRunId String
  specType       SpecType
  specName       String       // e.g. "TOEIC", "인턴 (6개월)", "공모전 수상"
  status         SpecStatus   @default(IN_PROGRESS)
  score          String?      // e.g. "900", "합격", "6개월"
  startedAt      DateTime     @default(now())
  completedAt    DateTime?
  eventFlags     Json         @default("{}")  // spec-specific flags
  characterRun   CharacterRun @relation(fields: [characterRunId], references: [id], onDelete: Cascade)
}
```

### New Model: `JobApplication`
```prisma
model JobApplication {
  id                String            @id @default(uuid())
  characterRunId    String
  companyName       String            // fictional parody company name
  companyType       String            // "대기업" | "스타트업" | "공기업" | "전문직" | "외국계"
  currentStage      ApplicationStage  @default(DOCUMENT)
  stageResults      Json              @default("[]")  // [{stage, passed, note}]
  specScore         Int               @default(0)     // calculated from specs
  documentPassed    Boolean?
  personalityPassed Boolean?
  codingTestPassed  Boolean?
  firstInterviewPassed Boolean?
  secondInterviewPassed Boolean?
  finalResult       Boolean?          // true=합격, false=불합격
  isActive          Boolean           @default(true)
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  characterRun      CharacterRun      @relation(fields: [characterRunId], references: [id], onDelete: Cascade)
}
```

### New Model: `CareerPath`
```prisma
model CareerPath {
  id                String       @id @default(uuid())
  characterRunId    String
  pathType          String       // "WORKING_HOLIDAY" | "TEACHER_EXAM" | "CPA" | "LAW_SCHOOL" | "PATENT_ATTORNEY" | "MEDICAL_TRANSFER"
  pathName          String       // e.g. "워킹홀리데이", "임용고시", "회계사", "로스쿨", "변리사", "메디컬 편입"
  status            String       // "PREPARING" | "IN_PROGRESS" | "PASSED" | "FAILED" | "ABANDONED"
  startedAt         DateTime     @default(now())
  completedAt       DateTime?
  eventFlags        Json         @default("{}")
  characterRun      CharacterRun @relation(fields: [characterRunId], references: [id], onDelete: Cascade)
}
```

### CharacterRun Changes
Add field:
```
specScore        Int      @default(0)  // aggregate spec score for job applications
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/characters/:id/specs` | owner | Start a new spec (e.g. "TOEIC 준비 시작") |
| GET | `/api/characters/:id/specs` | owner | List character's specs |
| POST | `/api/characters/:id/specs/:specId/complete` | owner | Complete/fail a spec (triggered by event resolution) |
| POST | `/api/characters/:id/job-applications` | owner | Apply to a company (creates JobApplication) |
| GET | `/api/characters/:id/job-applications` | owner | List job applications with stage status |
| POST | `/api/characters/:id/job-applications/:appId/advance` | owner | Advance to next stage (triggered by event) |
| POST | `/api/characters/:id/career-paths` | owner | Start a career path (워홀/임용/회계사 등) |
| GET | `/api/characters/:id/career-paths` | owner | List career paths |

## Event System Change: Choice Result Integration

**Current behavior**: When a player makes a choice, the response shows `summary` (narrative text) + stat delta labels, then the next event loads separately.

**New behavior**: When a player makes a choice:
1. The choice is persisted (stat/relationship/flag deltas applied).
2. The response returns stat delta labels (e.g. `{ statDelta: { academic: 5, mental: -2 } }`) — **these stat change labels are KEPT visible** so the player can see what changed.
3. The narrative `summary` text is **removed** from the choice response — it no longer appears as a separate result screen.
4. Instead, the next event's `body` (narrative text) **begins with a natural narrative reference to the previous choice's outcome**.
5. The event engine (`lib/game/event-engine.ts`) must be extended so that `selectNextEvent` can optionally prepend a "previous choice consequence" paragraph to the event body.

This applies to ALL events, not just spec-related ones. The `EventSelectionContext` gains a `previousChoiceSummary` field.

### Implementation approach:
- In `app/api/characters/[id]/choices/route.ts`: keep `statDelta` in the response, but **remove `summary`** from the response. Return `{ eventResolved: true, statDelta, endingTriggered, resultType, lifeStage }`.
- In `app/api/characters/[id]/events/next/route.ts`: when selecting the next event, read the most recent `EventHistory` entry and pass its `summary` to the event engine.
- In `lib/game/event-engine.ts`: add a `previousChoiceSummary` field to `EventSelectionContext`. When present, the selected event's body gets a prepended paragraph like: `"지난 선택의 결과, {summary}. 그리고..."` (AI-generated events will naturally incorporate this; static events get a prepended narrative bridge).
- The `selectNextEvent` function returns the event with the prepended narrative.

## Spec System Details

### Spec Types and Examples
- **INTERNSHIP**: "스타트업 인턴 (3개월)", "대기업 인턴 (6개월)" - requires application event
- **LANGUAGE_SCORE**: "TOEIC 900", "TOEFL 100", "HSK 5급", "JLPT N1" - requires exam event sequence (2-step: 접수 → 결과)
- **PORTFOLIO**: "공모전 수상", "동아리 프로젝트", "학회 논문" - requires activity event
- **CERTIFICATION**: "정보처리기사", "한국사 1급", "MOS Master" - requires study event
- **EXAM_PREP**: "고시 준비", "공기업 필기" - ongoing prep event
- **CAREER_PATH**: "워홀 준비", "임용 준비" - major 4th-year track

### Spec Event Flow (2-step)
1. **Step 1 - Initiation**: Player encounters a spec-related event choice (e.g. "토익 시험 접수하기"). Choosing it creates a `Spec` record with `IN_PROGRESS` status.
2. **Step 2 - Resolution**: The next event's narrative naturally incorporates the spec outcome (e.g. "접수했던 토익 시험 결과가 나왔다..."). The event's flagDelta triggers `Spec` completion with score.

### Spec Score Calculation
Each completed spec contributes to the character's aggregate `specScore`:
- INTERNSHIP: +10-30 (duration-based)
- LANGUAGE_SCORE: +5-25 (score-based, e.g. TOEIC 900=+20)
- PORTFOLIO: +5-20 (quality-based)
- CERTIFICATION: +5-15 (difficulty-based)
- EXAM_PREP: +3-10 (progress-based)

## Job Application Process (6-Stage)

### Company Types and Their Stages
| Company Type | Stages | Notes |
|---|---|---|
| **대기업** | 서류 → 인적성(GSAT) → 코딩테스트 → 1차면접(실무) → 2차면접(임원) → 최종합격 | Full 6 stages |
| **스타트업** | 서류 → 1차면접 → 2차면접 → 최종합격 | 4 stages, no 인적성/코테 |
| **공기업** | 서류 → NCS필기 → 1차면접 → 2차면접 → 최종합격 | 5 stages, NCS instead of 코테 |
| **전문직** | 서류 → 1차면접 → 최종합격 | 3 stages |
| **외국계** | 서류 → 영어면접 → 코딩테스트 → 최종면접 → 최종합격 | 5 stages |

### Stage Mechanics
- **서류 (Document)**: Pass rate based on `specScore` + `academic` stat + `practical` stat. Higher spec score = higher pass rate.
- **인적성 (Personality Test)**: Based on `mental` + `reputation` stats. Random element included (blind hiring element).
- **코딩테스트 (Coding Test)**: Based on `practical` + `academic` stats.
- **1차면접 (First Interview)**: Based on `communication` + `charm` + `practical` stats.
- **2차면접 (Second Interview)**: Based on `reputation` + `mental` + `charm` stats.
- **최종합격 (Final Result)**: Aggregate score + random factor (spec-overcoming luck element).

### Korean Job-Seeking Reality Mechanics
- **Spec Fatigue**: Each job application attempt increases `burnoutRisk`. Multiple rejections add `riskDebt`.
- **Blind Hiring**: Some stages have a hidden random factor that can override stat-based pass/fail (representing blind hiring's unpredictability).
- **Spec-Overcoming**: Low spec score but high relevant stats can still pass (representing "스펙 초월 합격").
- **Financial Burden**: Application fees, exam prep costs reduce `wealth`.
- **Mental Health**: Repeated failures trigger mental stat checks; low mental can force a break/career path change.

## Career Paths (4th Year Major Events)

| Path | Requirements | Gameplay |
|---|---|---|
| **워킹홀리데이** | `wealth >= 4`, `mental >= 4` | Series of events: 준비 → 출국 → 생활 → 귀국/정착 |
| **임용고시** | `academic >= 6`, major must be 교육학과 | Events: 교생실습 → 필기시험 → 면접 → 합격/불합격 |
| **회계사(CPA)** | `academic >= 7`, `mental >= 6` | Events: 수험준비 → 1차시험 → 2차시험 → 합격/불합격 |
| **로스쿨** | `academic >= 7`, `communication >= 5` | Events: LEET준비 → LEET응시 → 로스쿨진학 → 변호사시험 |
| **변리사** | `academic >= 7`, `practical >= 5` | Events: 시험준비 → 1차 → 2차 → 합격/불합격 |
| **메디컬 편입** | `academic >= 8`, `health >= 6`, `wealth >= 5` | Events: 편입준비 → 필기 → 면접 → 합격/불합격 |

Each career path is a series of 3-5 events. Success/failure is determined by stats + choices made during the path events. Success creates a `CareerEndingRecord` with the path name. Failure routes back to general job-seeking.

## Event Engine Changes

### New Event Selection Context Fields
```typescript
interface EventSelectionContext {
  // ... existing fields
  previousChoiceSummary?: string;  // NEW: summary of the most recent choice
  specs?: { specType: string; specName: string; status: string; score?: string }[];  // NEW
  jobApplications?: { companyName: string; currentStage: string; isActive: boolean }[];  // NEW
  careerPaths?: { pathType: string; status: string }[];  // NEW
}
```

### New Static Events
Add 15+ new static events for:
- Spec initiation events (TOEIC 접수, 인턴 지원, 공모전 참가)
- Spec resolution events (시험 결과, 인턴 종료, 공모전 결과)
- Job application stage events (서류 합격/불합격, 인적성, 코테, 면접)
- Career path events (워홀 준비, 임용 시험, 회계사 시험)
- Korean job-seeking reality events (취준 우울, 스펙 초월 합격, 블라인드 채용 반전)

### Conditional Events for Spec/Job/Career
Add conditional events that trigger based on:
- `requiredSpecs`: character has certain specs
- `requiredApplicationStage`: job application at specific stage
- `requiredCareerPath`: character started a career path
- `specScoreBelow/Above`: spec score thresholds

## Design Direction

Use existing `.tenet/project/design.md`: Korean text-adventure, compact side panels, narrative-first, restrained cards, mobile single-column behavior.

New UI elements:
- **Spec Panel**: Shows current specs with progress status, accessible from character sidebar
- **Job Application Panel**: Shows active applications with stage progress bars
- **Career Path Panel**: Shows active career path with step indicators
- **Spec Score Display**: Aggregate spec score shown in character stats area

## Auth Flow

Same as existing: NextAuth credentials, `requireCurrentUserId()` guard on all new API routes, owner-scoped queries.

## Success Criteria

1. Player can start a spec (e.g. "TOEIC 접수") through an event choice, and a `Spec` record is created.
2. After 1-2 events, the spec resolves (e.g. "TOEIC 결과 900점") and the score is recorded.
3. Player can apply to companies; a `JobApplication` is created with company-type-specific stages.
4. Job application stages advance through events; each stage has stat-based pass/fail logic.
5. Player can start a career path (워홀/임용/회계사/로스쿨/변리사/메디컬편입) in 4th year.
6. Career path success creates an ending record; failure routes back to job-seeking.
7. Choice results show stat delta labels (e.g. `+5 학업, -2 멘탈`) but the narrative summary text no longer appears as a separate screen — it flows into the next event's opening narrative.
8. Korean job-seeking reality mechanics (spec fatigue, blind hiring, spec-overcoming, financial burden, mental health) are implemented as gameplay systems.
9. Spec score affects job application document pass rates.
10. All new Prisma models have migrations and are owner-scoped.
11. Unit tests cover spec score calculation, job application stage logic, career path eligibility, and event narrative prepending.

## Out of Scope

- Real company names or real exam score systems (all fictional/parody).
- Social login.
- Payments.
- Admin tools.
- Native mobile/Unity clients.
- Full illustration system.


## Scenarios (inlined — success/failure shapes for this run)
# Scenarios: 스펙 시스템 (Credential/Spec System)

## Scenarios (Success)

1. **Spec initiation and completion (2-step flow)**
   - Given a 3rd-year character with active event
   - When the player chooses "토익 시험 접수하기"
   - Then a `Spec` record is created with type `LANGUAGE_SCORE`, name "TOEIC", status `IN_PROGRESS`
   - When the player advances to the next event
   - Then the next event's body begins with a narrative reference to the TOEIC registration
   - When the player resolves the next event
   - Then the `Spec` status changes to `COMPLETED` with score (e.g. "900")
   - And the character's `specScore` increases by the appropriate amount

2. **Job application with full 6-stage process (대기업)**
   - Given a 4th-year character with completed specs
   - When the player applies to a 대기업 company
   - Then a `JobApplication` is created with `currentStage: DOCUMENT`
   - When the document stage resolves with pass
   - Then `currentStage` advances to `PERSONALITY_TEST`
   - When personality test passes → `CODING_TEST`
   - When coding test passes → `FIRST_INTERVIEW`
   - When first interview passes → `SECOND_INTERVIEW`
   - When second interview passes → `FINAL_RESULT`
   - When final result is positive → `finalResult: true`, `isActive: false`
   - And a career ending record is created

3. **Job application failure and spec fatigue**
   - Given a character with low spec score applying to a competitive company
   - When the document stage resolves with fail
   - Then `currentStage` stays at `DOCUMENT` with `documentPassed: false`
   - And `burnoutRisk` increases
   - And the character can re-apply or try a different company

4. **Career path: 워킹홀리데이**
   - Given a 4th-year character with `wealth >= 4` and `mental >= 4`
   - When the player starts the 워킹홀리데이 career path
   - Then a `CareerPath` record is created with `pathType: "WORKING_HOLIDAY"`
   - When the player progresses through the path events (준비 → 출국 → 생활 → 귀국/정착)
   - Then the path resolves with `PASSED` or `FAILED` based on choices and stats

5. **Career path: 임용고시 (education major only)**
   - Given a 4th-year character with major "교육학과" and `academic >= 6`
   - When the player starts the 임용고시 career path
   - Then a `CareerPath` record is created with `pathType: "TEACHER_EXAM"`
   - When the player progresses through 교생실습 → 필기시험 → 면접 events
   - Then the path resolves with `PASSED` or `FAILED`

6. **Choice result: stat delta visible, summary flows into next event**
   - Given a character with an active event
   - When the player makes a choice
   - Then the response includes `statDelta` with the stat changes
   - And the response does NOT include `summary` text
   - When the next event is loaded
   - Then the event body begins with a narrative reference to the previous choice

7. **Spec-overcoming (low spec, high stats still pass)**
   - Given a character with low spec score but high `practical` and `communication` stats
   - When applying to a 스타트업 company
   - Then the document stage has a chance to pass despite low spec score
   - And the interview stages benefit from high stats

8. **Blind hiring random factor**
   - Given a character with moderate stats applying to any company
   - When any stage resolves
   - Then there is a small random factor that can override the stat-based result
   - This represents blind hiring's unpredictability

## Anti-Scenarios (Failure)

1. **Choice summary still shown as separate screen**
   - After making a choice, the response still includes `summary` text
   - Failure: summary must be removed from choice response; only stat delta labels remain

2. **Spec created without event trigger**
   - A `Spec` record is created directly by API without going through an event choice
   - Failure: specs must only be created through event choices

3. **Job application stage skipped**
   - A job application advances from DOCUMENT directly to FINAL_RESULT without going through intermediate stages
   - Failure: stages must follow the company-type-specific order

4. **Career path started without stat requirements**
   - A character with `academic < 6` starts 임용고시 path
   - Failure: career path eligibility must check stat requirements

5. **Real company name in job application**
   - A job application contains a real Korean company name (e.g. "삼성", "카카오")
   - Failure: all company names must be fictional/parody

6. **Spec score not affecting document pass rate**
   - A character with zero specs has the same document pass rate as one with many specs
   - Failure: spec score must meaningfully affect document stage outcomes

7. **Career path failure doesn't route back**
   - A failed career path leaves the character stuck with no way to continue
   - Failure: failed career paths must route back to general job-seeking or alternative paths


## Harness (inlined)
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

</tenet_run_context>

Score this feature's IMPLEMENTATION READINESS. You are reading the spec + harness (+ optional interview) and deciding whether the agent has enough information to BUILD AND VERIFY the feature.

This is NOT a clarity check on user requirements — that already happened upstream. You are checking whether the *implementation prerequisites* are known. Missing prerequisites here cause late-stage failures at execution or eval time.

## Hard gates before scoring

- If the optional interview declares "Mode: Full", the spec's front-matter "delivery_mode" must match the interview's "## Delivery Mode Decision".
- A Full-mode interview without "## Delivery Mode Decision", "Prompt shown", "User response", a valid "Selected delivery_mode", or a valid "Selection basis" is blocked.
- A bundled defaults question, unrelated "okay", or pre-execution confirmation does not satisfy Full-mode delivery-mode selection.
- If the spec declares "delivery_mode: agile", it must include "## Slice plan".
- If any hard gate fails, set "spec_sufficiency" to "blocked", set "passed" to false, and list the issue in "blockers".

## Scope — score each of the 8 categories independently

For each category, assign one of: "ready", "partial", "blocked".
- "ready": no information gaps that would prevent build/verification.
- "partial": some gaps, but work can start; note them in missing_info.
- "blocked": a gap that MUST be resolved before decomposition (credentials, key decisions, API contracts, etc.).

### 1. Spec sufficiency
- Are the acceptance criteria concrete enough to write tests against?
- Are error-handling policies, rate-limit behavior, and edge cases specified?
- Ambiguities that survived the clarity gate but only matter at build time (e.g., "what happens on 429?", "what's the retry policy?").
- Are factual claims about the existing codebase (file paths, current behavior, existing modules/APIs) grounded in real files cited in the spec, not assumed or invented? An un-cited or fabricated codebase claim is a blocker — the spec must reflect the actual project (greenfield runs have no existing code to cite; this applies only to claims about code that should already exist).

### 2. Research & prior art
- If the approach uses a specific library, algorithm, or protocol — has it been decided and investigated?
- Are known gotchas / compatibility notes captured in the spec or referenced knowledge?
- Has the agent done enough reading to use third-party APIs correctly?

### 3. Interface contracts
- Internal: API shapes, event schemas, DB tables — pinned or still drifting?
- External: third-party API contracts (endpoints, auth flow, rate limits, error codes) understood before calling?

### 4. External service access
- Credentials for services the agent CALLS BUT DOES NOT BUILD: LLM API keys, payment sandbox keys (e.g. Stripe test mode), webhook signing secrets, vendor sandbox accounts.
- IMPORTANT: this category is NOT about services the feature itself implements. If the feature IS an OAuth provider, OAuth credentials are not a blocker — they are the work.
- Each external service call should have a named source of truth (env var, secret manager, user-provided).

### 5. Environment & runtime
- App start command, required env vars, local services/containers, ports.
- Health-check / smoke path.
- Anything needed to boot the app for e2e testing.

### 6. Test data & fixtures
- Seed users/records the agent can't synthesize (production-shaped data, real PDFs, real audio samples).
- Sandbox accounts on external services.
- Fixtures that require specific setup commands.

### 7. Test strategy (incl. non-UI verification)
- Per layer (unit / integration / e2e): declared as live, sandboxed, mocked, or skipped — WITH reason.
- E2E surface is declared: browser UI, visual/canvas/game, CLI, API, library, or not applicable.
- Browser/visual Playwright Layer 2 is declared as required, optional, or skipped with reason.
- For async/background/third-party surfaces that Playwright cannot see: is there a non-UI verification method (logs, metrics, DB assertions, event-store queries, explicit test hooks)?
- "How will we know this worked?" must have an answer for every success criterion.

### 8. Dependencies & tooling
- Required libs/runtimes confirmed installable in target env.
- Build/test commands runnable.
- Version pins where needed.

## Eval Execution Mode (separate judgment, not a scored category)

Answer this independent question about the feature's test surface:

> Do this feature's tests share mutable state (DB rows, sessions, rate limits, ports, files, long-lived processes, Playwright lock dirs)?

If YES — parallel critics will collide on that state and produce false failures that look like product bugs. Mark "eval_parallel_safe" as false and explain in "eval_parallel_rationale" which specific resource(s) are shared.

If NO — the feature is a pure library, CLI, data transformation, or otherwise stateless between runs. Mark "eval_parallel_safe" as true.

When in doubt, prefer false — the cost of sequential is a few extra minutes; the cost of parallel collision is a full cycle of false failures.

## Rules

- Be specific. Do not invent requirements the spec does not imply. If the spec says "no external calls," do not demand an LLM key.
- Infer feature scope from spec/harness: a backend-only feature can skip e2e (testable_surfaces.e2e = "not_applicable"); a UI-only feature with no external calls can skip external_service_access.
- If the spec explicitly declares a test layer as MOCKED with a stated reason, accept that — but flag in rationale if EVERY test layer is mocked (silent-passing risk).
- "passed" is true only if NO category is "blocked" for the feature's declared scope.

## Output Format
Respond with ONLY this JSON (no markdown, no explanation):

{
  "passed": <boolean>,
  "categories": {
    "spec_sufficiency": "ready|partial|blocked",
    "research_prior_art": "ready|partial|blocked",
    "interface_contracts": "ready|partial|blocked",
    "external_service_access": "ready|partial|blocked|not_applicable",
    "env_runtime": "ready|partial|blocked",
    "test_data_fixtures": "ready|partial|blocked|not_applicable",
    "test_strategy": "ready|partial|blocked",
    "deps_tooling": "ready|partial|blocked"
  },
  "blockers": ["<concrete blocker 1>", "<concrete blocker 2>"],
  "missing_info": ["<softer gap 1>", "<softer gap 2>"],
  "testable_surfaces": {
    "unit": "ready|ready_with_mocks|blocked|not_applicable",
    "integration": "ready|ready_with_mocks|blocked|not_applicable",
    "e2e": "ready|ready_with_mocks|blocked|not_applicable"
  },
  "eval_parallel_safe": <boolean>,
  "eval_parallel_rationale": "<1-2 sentence explanation of why parallel critics are or are not safe for this feature>",
  "rationale": "<1-3 sentence summary of why the gate passed or failed and what the agent must do next>"
}

Where blockers are hard stops (must be resolved or explicitly mocked-with-reason) and missing_info are softer gaps that should be noted but do not block decomposition.
---
# Feature: spec-system

## Spec
---
delivery_mode: autonomous
---

# Spec: 스펙 시스템 (Credential/Spec System)

## Purpose

Add a credential/spec system (스펙) to the college career simulation game, where characters build internships, language scores, portfolios, and certifications during 3rd-4th year, then go through a realistic Korean job-seeking process (서류→인적성→코테→면접→최종합격) with company-type-specific screening stages. Add career-path tracks for 4th-year major events (워홀, 임용, 회계사, 로스쿨, 변리사, 메디컬 편입). Change the event system so choice results flow into the next event's opening narrative instead of appearing as separate result screens. Reflect Korean job-seeking reality (blind hiring, spec-overcoming, burnout, fatigue, financial burden) as gameplay mechanics.

## Tech Stack

- Next.js 16.2.10 App Router with TypeScript route handlers under `app/api/**/route.ts`.
- React 19.2.7 client UI in `app/page.tsx`.
- Prisma 7.8.0 with PostgreSQL/Neon; existing schema in `prisma/schema.prisma`.
- NextAuth 4.24.14 through existing server session helpers in `lib/server/session.ts` and API route guards.
- OpenRouter via existing `lib/game/openrouter.ts`.
- Vercel production deployment, Node `>=20.9` from `package.json`.

## Database Schema Changes

### New Enum: `SpecType`
```prisma
enum SpecType {
  INTERNSHIP
  LANGUAGE_SCORE
  PORTFOLIO
  CERTIFICATION
  EXAM_PREP
  CAREER_PATH
}
```

### New Enum: `SpecStatus`
```prisma
enum SpecStatus {
  IN_PROGRESS
  COMPLETED
  FAILED
}
```

### New Enum: `ApplicationStage`
```prisma
enum ApplicationStage {
  DOCUMENT
  PERSONALITY_TEST
  CODING_TEST
  FIRST_INTERVIEW
  SECOND_INTERVIEW
  FINAL_RESULT
}
```

### New Model: `Spec`
```prisma
model Spec {
  id             String       @id @default(uuid())
  characterRunId String
  specType       SpecType
  specName       String       // e.g. "TOEIC", "인턴 (6개월)", "공모전 수상"
  status         SpecStatus   @default(IN_PROGRESS)
  score          String?      // e.g. "900", "합격", "6개월"
  startedAt      DateTime     @default(now())
  completedAt    DateTime?
  eventFlags     Json         @default("{}")  // spec-specific flags
  characterRun   CharacterRun @relation(fields: [characterRunId], references: [id], onDelete: Cascade)
}
```

### New Model: `JobApplication`
```prisma
model JobApplication {
  id                String            @id @default(uuid())
  characterRunId    String
  companyName       String            // fictional parody company name
  companyType       String            // "대기업" | "스타트업" | "공기업" | "전문직" | "외국계"
  currentStage      ApplicationStage  @default(DOCUMENT)
  stageResults      Json              @default("[]")  // [{stage, passed, note}]
  specScore         Int               @default(0)     // calculated from specs
  documentPassed    Boolean?
  personalityPassed Boolean?
  codingTestPassed  Boolean?
  firstInterviewPassed Boolean?
  secondInterviewPassed Boolean?
  finalResult       Boolean?          // true=합격, false=불합격
  isActive          Boolean           @default(true)
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  characterRun      CharacterRun      @relation(fields: [characterRunId], references: [id], onDelete: Cascade)
}
```

### New Model: `CareerPath`
```prisma
model CareerPath {
  id                String       @id @default(uuid())
  characterRunId    String
  pathType          String       // "WORKING_HOLIDAY" | "TEACHER_EXAM" | "CPA" | "LAW_SCHOOL" | "PATENT_ATTORNEY" | "MEDICAL_TRANSFER"
  pathName          String       // e.g. "워킹홀리데이", "임용고시", "회계사", "로스쿨", "변리사", "메디컬 편입"
  status            String       // "PREPARING" | "IN_PROGRESS" | "PASSED" | "FAILED" | "ABANDONED"
  startedAt         DateTime     @default(now())
  completedAt       DateTime?
  eventFlags        Json         @default("{}")
  characterRun      CharacterRun @relation(fields: [characterRunId], references: [id], onDelete: Cascade)
}
```

### CharacterRun Changes
Add field:
```
specScore        Int      @default(0)  // aggregate spec score for job applications
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/characters/:id/specs` | owner | Start a new spec (e.g. "TOEIC 준비 시작") |
| GET | `/api/characters/:id/specs` | owner | List character's specs |
| POST | `/api/characters/:id/specs/:specId/complete` | owner | Complete/fail a spec (triggered by event resolution) |
| POST | `/api/characters/:id/job-applications` | owner | Apply to a company (creates JobApplication) |
| GET | `/api/characters/:id/job-applications` | owner | List job applications with stage status |
| POST | `/api/characters/:id/job-applications/:appId/advance` | owner | Advance to next stage (triggered by event) |
| POST | `/api/characters/:id/career-paths` | owner | Start a career path (워홀/임용/회계사 등) |
| GET | `/api/characters/:id/career-paths` | owner | List career paths |

## Event System Change: Choice Result Integration

**Current behavior**: When a player makes a choice, the response shows `summary` (narrative text) + stat delta labels, then the next event loads separately.

**New behavior**: When a player makes a choice:
1. The choice is persisted (stat/relationship/flag deltas applied).
2. The response returns stat delta labels (e.g. `{ statDelta: { academic: 5, mental: -2 } }`) — **these stat change labels are KEPT visible** so the player can see what changed.
3. The narrative `summary` text is **removed** from the choice response — it no longer appears as a separate result screen.
4. Instead, the next event's `body` (narrative text) **begins with a natural narrative reference to the previous choice's outcome**.
5. The event engine (`lib/game/event-engine.ts`) must be extended so that `selectNextEvent` can optionally prepend a "previous choice consequence" paragraph to the event body.

This applies to ALL events, not just spec-related ones. The `EventSelectionContext` gains a `previousChoiceSummary` field.

### Implementation approach:
- In `app/api/characters/[id]/choices/route.ts`: keep `statDelta` in the response, but **remove `summary`** from the response. Return `{ eventResolved: true, statDelta, endingTriggered, resultType, lifeStage }`.
- In `app/api/characters/[id]/events/next/route.ts`: when selecting the next event, read the most recent `EventHistory` entry and pass its `summary` to the event engine.
- In `lib/game/event-engine.ts`: add a `previousChoiceSummary` field to `EventSelectionContext`. When present, the selected event's body gets a prepended paragraph like: `"지난 선택의 결과, {summary}. 그리고..."` (AI-generated events will naturally incorporate this; static events get a prepended narrative bridge).
- The `selectNextEvent` function returns the event with the prepended narrative.

## Spec System Details

### Spec Types and Examples
- **INTERNSHIP**: "스타트업 인턴 (3개월)", "대기업 인턴 (6개월)" - requires application event
- **LANGUAGE_SCORE**: "TOEIC 900", "TOEFL 100", "HSK 5급", "JLPT N1" - requires exam event sequence (2-step: 접수 → 결과)
- **PORTFOLIO**: "공모전 수상", "동아리 프로젝트", "학회 논문" - requires activity event
- **CERTIFICATION**: "정보처리기사", "한국사 1급", "MOS Master" - requires study event
- **EXAM_PREP**: "고시 준비", "공기업 필기" - ongoing prep event
- **CAREER_PATH**: "워홀 준비", "임용 준비" - major 4th-year track

### Spec Event Flow (2-step)
1. **Step 1 - Initiation**: Player encounters a spec-related event choice (e.g. "토익 시험 접수하기"). Choosing it creates a `Spec` record with `IN_PROGRESS` status.
2. **Step 2 - Resolution**: The next event's narrative naturally incorporates the spec outcome (e.g. "접수했던 토익 시험 결과가 나왔다..."). The event's flagDelta triggers `Spec` completion with score.

### Spec Score Calculation
Each completed spec contributes to the character's aggregate `specScore`:
- INTERNSHIP: +10-30 (duration-based)
- LANGUAGE_SCORE: +5-25 (score-based, e.g. TOEIC 900=+20)
- PORTFOLIO: +5-20 (quality-based)
- CERTIFICATION: +5-15 (difficulty-based)
- EXAM_PREP: +3-10 (progress-based)

## Job Application Process (6-Stage)

### Company Types and Their Stages
| Company Type | Stages | Notes |
|---|---|---|
| **대기업** | 서류 → 인적성(GSAT) → 코딩테스트 → 1차면접(실무) → 2차면접(임원) → 최종합격 | Full 6 stages |
| **스타트업** | 서류 → 1차면접 → 2차면접 → 최종합격 | 4 stages, no 인적성/코테 |
| **공기업** | 서류 → NCS필기 → 1차면접 → 2차면접 → 최종합격 | 5 stages, NCS instead of 코테 |
| **전문직** | 서류 → 1차면접 → 최종합격 | 3 stages |
| **외국계** | 서류 → 영어면접 → 코딩테스트 → 최종면접 → 최종합격 | 5 stages |

### Stage Mechanics
- **서류 (Document)**: Pass rate based on `specScore` + `academic` stat + `practical` stat. Higher spec score = higher pass rate.
- **인적성 (Personality Test)**: Based on `mental` + `reputation` stats. Random element included (blind hiring element).
- **코딩테스트 (Coding Test)**: Based on `practical` + `academic` stats.
- **1차면접 (First Interview)**: Based on `communication` + `charm` + `practical` stats.
- **2차면접 (Second Interview)**: Based on `reputation` + `mental` + `charm` stats.
- **최종합격 (Final Result)**: Aggregate score + random factor (spec-overcoming luck element).

### Korean Job-Seeking Reality Mechanics
- **Spec Fatigue**: Each job application attempt increases `burnoutRisk`. Multiple rejections add `riskDebt`.
- **Blind Hiring**: Some stages have a hidden random factor that can override stat-based pass/fail (representing blind hiring's unpredictability).
- **Spec-Overcoming**: Low spec score but high relevant stats can still pass (representing "스펙 초월 합격").
- **Financial Burden**: Application fees, exam prep costs reduce `wealth`.
- **Mental Health**: Repeated failures trigger mental stat checks; low mental can force a break/career path change.

## Career Paths (4th Year Major Events)

| Path | Requirements | Gameplay |
|---|---|---|
| **워킹홀리데이** | `wealth >= 4`, `mental >= 4` | Series of events: 준비 → 출국 → 생활 → 귀국/정착 |
| **임용고시** | `academic >= 6`, major must be 교육학과 | Events: 교생실습 → 필기시험 → 면접 → 합격/불합격 |
| **회계사(CPA)** | `academic >= 7`, `mental >= 6` | Events: 수험준비 → 1차시험 → 2차시험 → 합격/불합격 |
| **로스쿨** | `academic >= 7`, `communication >= 5` | Events: LEET준비 → LEET응시 → 로스쿨진학 → 변호사시험 |
| **변리사** | `academic >= 7`, `practical >= 5` | Events: 시험준비 → 1차 → 2차 → 합격/불합격 |
| **메디컬 편입** | `academic >= 8`, `health >= 6`, `wealth >= 5` | Events: 편입준비 → 필기 → 면접 → 합격/불합격 |

Each career path is a series of 3-5 events. Success/failure is determined by stats + choices made during the path events. Success creates a `CareerEndingRecord` with the path name. Failure routes back to general job-seeking.

## Event Engine Changes

### New Event Selection Context Fields
```typescript
interface EventSelectionContext {
  // ... existing fields
  previousChoiceSummary?: string;  // NEW: summary of the most recent choice
  specs?: { specType: string; specName: string; status: string; score?: string }[];  // NEW
  jobApplications?: { companyName: string; currentStage: string; isActive: boolean }[];  // NEW
  careerPaths?: { pathType: string; status: string }[];  // NEW
}
```

### New Static Events
Add 15+ new static events for:
- Spec initiation events (TOEIC 접수, 인턴 지원, 공모전 참가)
- Spec resolution events (시험 결과, 인턴 종료, 공모전 결과)
- Job application stage events (서류 합격/불합격, 인적성, 코테, 면접)
- Career path events (워홀 준비, 임용 시험, 회계사 시험)
- Korean job-seeking reality events (취준 우울, 스펙 초월 합격, 블라인드 채용 반전)

### Conditional Events for Spec/Job/Career
Add conditional events that trigger based on:
- `requiredSpecs`: character has certain specs
- `requiredApplicationStage`: job application at specific stage
- `requiredCareerPath`: character started a career path
- `specScoreBelow/Above`: spec score thresholds

## Design Direction

Use existing `.tenet/project/design.md`: Korean text-adventure, compact side panels, narrative-first, restrained cards, mobile single-column behavior.

New UI elements:
- **Spec Panel**: Shows current specs with progress status, accessible from character sidebar
- **Job Application Panel**: Shows active applications with stage progress bars
- **Career Path Panel**: Shows active career path with step indicators
- **Spec Score Display**: Aggregate spec score shown in character stats area

## Auth Flow

Same as existing: NextAuth credentials, `requireCurrentUserId()` guard on all new API routes, owner-scoped queries.

## Success Criteria

1. Player can start a spec (e.g. "TOEIC 접수") through an event choice, and a `Spec` record is created.
2. After 1-2 events, the spec resolves (e.g. "TOEIC 결과 900점") and the score is recorded.
3. Player can apply to companies; a `JobApplication` is created with company-type-specific stages.
4. Job application stages advance through events; each stage has stat-based pass/fail logic.
5. Player can start a career path (워홀/임용/회계사/로스쿨/변리사/메디컬편입) in 4th year.
6. Career path success creates an ending record; failure routes back to job-seeking.
7. Choice results show stat delta labels (e.g. `+5 학업, -2 멘탈`) but the narrative summary text no longer appears as a separate screen — it flows into the next event's opening narrative.
8. Korean job-seeking reality mechanics (spec fatigue, blind hiring, spec-overcoming, financial burden, mental health) are implemented as gameplay systems.
9. Spec score affects job application document pass rates.
10. All new Prisma models have migrations and are owner-scoped.
11. Unit tests cover spec score calculation, job application stage logic, career path eligibility, and event narrative prepending.

## Out of Scope

- Real company names or real exam score systems (all fictional/parody).
- Social login.
- Payments.
- Admin tools.
- Native mobile/Unity clients.
- Full illustration system.


## Harness
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


## Scenarios & Anti-Scenarios
# Scenarios: 스펙 시스템 (Credential/Spec System)

## Scenarios (Success)

1. **Spec initiation and completion (2-step flow)**
   - Given a 3rd-year character with active event
   - When the player chooses "토익 시험 접수하기"
   - Then a `Spec` record is created with type `LANGUAGE_SCORE`, name "TOEIC", status `IN_PROGRESS`
   - When the player advances to the next event
   - Then the next event's body begins with a narrative reference to the TOEIC registration
   - When the player resolves the next event
   - Then the `Spec` status changes to `COMPLETED` with score (e.g. "900")
   - And the character's `specScore` increases by the appropriate amount

2. **Job application with full 6-stage process (대기업)**
   - Given a 4th-year character with completed specs
   - When the player applies to a 대기업 company
   - Then a `JobApplication` is created with `currentStage: DOCUMENT`
   - When the document stage resolves with pass
   - Then `currentStage` advances to `PERSONALITY_TEST`
   - When personality test passes → `CODING_TEST`
   - When coding test passes → `FIRST_INTERVIEW`
   - When first interview passes → `SECOND_INTERVIEW`
   - When second interview passes → `FINAL_RESULT`
   - When final result is positive → `finalResult: true`, `isActive: false`
   - And a career ending record is created

3. **Job application failure and spec fatigue**
   - Given a character with low spec score applying to a competitive company
   - When the document stage resolves with fail
   - Then `currentStage` stays at `DOCUMENT` with `documentPassed: false`
   - And `burnoutRisk` increases
   - And the character can re-apply or try a different company

4. **Career path: 워킹홀리데이**
   - Given a 4th-year character with `wealth >= 4` and `mental >= 4`
   - When the player starts the 워킹홀리데이 career path
   - Then a `CareerPath` record is created with `pathType: "WORKING_HOLIDAY"`
   - When the player progresses through the path events (준비 → 출국 → 생활 → 귀국/정착)
   - Then the path resolves with `PASSED` or `FAILED` based on choices and stats

5. **Career path: 임용고시 (education major only)**
   - Given a 4th-year character with major "교육학과" and `academic >= 6`
   - When the player starts the 임용고시 career path
   - Then a `CareerPath` record is created with `pathType: "TEACHER_EXAM"`
   - When the player progresses through 교생실습 → 필기시험 → 면접 events
   - Then the path resolves with `PASSED` or `FAILED`

6. **Choice result: stat delta visible, summary flows into next event**
   - Given a character with an active event
   - When the player makes a choice
   - Then the response includes `statDelta` with the stat changes
   - And the response does NOT include `summary` text
   - When the next event is loaded
   - Then the event body begins with a narrative reference to the previous choice

7. **Spec-overcoming (low spec, high stats still pass)**
   - Given a character with low spec score but high `practical` and `communication` stats
   - When applying to a 스타트업 company
   - Then the document stage has a chance to pass despite low spec score
   - And the interview stages benefit from high stats

8. **Blind hiring random factor**
   - Given a character with moderate stats applying to any company
   - When any stage resolves
   - Then there is a small random factor that can override the stat-based result
   - This represents blind hiring's unpredictability

## Anti-Scenarios (Failure)

1. **Choice summary still shown as separate screen**
   - After making a choice, the response still includes `summary` text
   - Failure: summary must be removed from choice response; only stat delta labels remain

2. **Spec created without event trigger**
   - A `Spec` record is created directly by API without going through an event choice
   - Failure: specs must only be created through event choices

3. **Job application stage skipped**
   - A job application advances from DOCUMENT directly to FINAL_RESULT without going through intermediate stages
   - Failure: stages must follow the company-type-specific order

4. **Career path started without stat requirements**
   - A character with `academic < 6` starts 임용고시 path
   - Failure: career path eligibility must check stat requirements

5. **Real company name in job application**
   - A job application contains a real Korean company name (e.g. "삼성", "카카오")
   - Failure: all company names must be fictional/parody

6. **Spec score not affecting document pass rate**
   - A character with zero specs has the same document pass rate as one with many specs
   - Failure: spec score must meaningfully affect document stage outcomes

7. **Career path failure doesn't route back**
   - A failed career path leaves the character stuck with no way to continue
   - Failure: failed career paths must route back to general job-seeking or alternative paths


## Interview (reference only — do not re-score clarity)
# Interview: 스펙 시스템 (Credential/Spec System)

Date: 2026-07-07
Mode: Full
Rounds: 1

## Mode Selection
- Prompt shown: Full mode recommended - this is a major new game system (스펙/취준) that touches Prisma schema, event engine, game rules, UI, and career paths. Multiple modules involved, significant scope.
- User response: confirmed (계속 진행해줘)
- Selected mode: full
- Selection basis: explicit_user_choice

## Round 1

### Questions Asked
1. 스펙 시스템의 적용 시점은 언제인가요?
   > 3~4학년부터

2. 취준 프로세스를 어느 정도로 현실적으로 구현할까요?
   > 상세 구현 (서류→인적성→코테→1차면접→2차면접→최종합격, 회사 유형별 다른 전형)

3. 4학년 큰 사건들은 기존 DestinationCandidate 시스템과 어떻게 연결되나요?
   > 진로 트랙으로 연결 (워홀, 임용, 회계사, 로스쿨, 변리사, 메디컬 편입 등)

4. 데이터 저장 방식은?
   > 새 Prisma 모델 (마이그레이션 필요)

5. 전형 단계 세분화?
   > 6단계 상세 (서류→인적성→코테→1차면접→2차면접→최종합격)

6. 스펙 이벤트 시퀀스?
   > 2단계 이벤트 시퀀스 (접수/선택 → 다음 이벤트에 결과가 자연스럽게 녹아들음)

7. 선택 결과 전달 방식?
   > 선택 결과가 별도로 나오는 게 아니라 다음 이벤트 서두에 자연스럽게 녹아들어야 함 (이것은 기존 모든 이벤트 시스템에도 동일 적용)

8. 취준 비판 요소?
   > 모두 포함 (스펙 초월 합격, 블라인드 채용, 우울증/번아웃, 피로도, 자산 부담)

### Decisions Made
- 스펙 시스템은 3~4학년부터 본격적으로 활성화
- 취준 전형은 6단계 상세 구현, 회사 유형별 차별화
- 4학년 큰 사건은 진로 트랙으로 연결
- 새 Prisma 모델 추가 (Spec, SpecType, CareerPath 등)
- 스펙 이벤트는 2단계 시퀀스 (접수/선택 → 결과 반영)
- 선택 결과는 다음 이벤트 서두에 자연스럽게 녹아들도록 변경 (전체 이벤트 시스템에 적용)
- 한국 취준생 현실 비판 요소 모두 포함

### Remaining Ambiguities
- Prisma 모델의 구체적인 스키마 구조 (Spec, CareerPath 테이블 상세)
- 기존 이벤트 시스템 변경 범위 (선택 결과를 다음 이벤트에 녹이는 방식)
- 4학년 큰 사건들의 구체적인 게임플레이 루프

## Delivery Mode Decision
- Prompt shown: autonomous (one end-to-end run) vs agile (sliced delivery with checkpoints)
- User response: 계속 진행해줘 (implicitly confirmed autonomous)
- Selected delivery_mode: autonomous
- Selection basis: defaulted_after_explicit_choice_prompt

## Model Tier Decision
- Prompt shown: frontier (strong model, fewer larger jobs) vs local (finer-grained DAG)
- User response: 계속 진행해줘 (implicitly confirmed frontier)
- Selected model_tier: frontier
- Selection basis: defaulted_after_uncertainty_prompt

## Summary
대학생활 시뮬레이션 게임에 스펙(인턴, 어학점수, 포트폴리오) 시스템과 현실적인 취준 프로세스(서류→인적성→코테→면접→최종)를 추가한다. 3~4학년부터 본격적으로 활성화되며, 4학년에는 워홀/임용/회계사/로스쿨/변리사/메디컬편입 등 진로 트랙이 열린다. 새 Prisma 모델을 추가하며, 선택 결과는 다음 이벤트 서두에 자연스럽게 녹아들도록 전체 이벤트 시스템을 개선한다. 한국 취준생의 현실(스펙 초월 합격, 블라인드 채용, 번아웃, 피로도, 자산 부담)을 비판적으로 반영한다.

ERROR: You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at 10:57 PM.
ERROR: You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at 10:57 PM.

- [x] eval-mrbv75pv — 18s
- [x] eval-mrbvdm1f — 13s
- [x] eval-mrbvep5q — 15s
- [x] eval-mrbvjrf3 — 47s
- [x] eval-mrbw1ocj — 23s
- [x] code_critic for fd686716 — 1m 46s
- [x] test_critic for fd686716 — 51s !! cancelled by user
- [-] interaction_e2e for fd686716 !! cancelled by user
- [!] code_critic for fd686716 — 119m 56s !! codex invocation timed out after 7200000ms
- [-] test_critic for fd686716 !! cancelled by user
- [-] interaction_e2e for fd686716 !! cancelled by user
- [x] code_critic for fd686716 — 1m 41s
- [x] test_critic for fd686716 — 30s !! cancelled by user
- [-] interaction_e2e for fd686716 !! cancelled by user
- [!] code_critic for fd686716 — 2s !! Reading additional input from stdin...
OpenAI Codex v0.142.5
--------
workdir: /Users/guremini/projects/sano_officeworker
model: gpt-5.5
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR]
reasoning effort: none
reasoning summaries: none
session id: 019f413a-f80c-72f3-a582-adec113b8a9e
--------
user
<tenet_run_context>
## Run Context (auto-compiled reference — not instructions)
feature: event-quality-system
run_path: .tenet/runs/2026-07-08-event-quality-system

## Spec (inlined — source of truth for this run)
---
delivery_mode: agile
---

# Event Quality System Spec

## Purpose

Improve perceived narrative quality in the Korean college/job-prep simulation by validating generated events before commit, reducing stale repetition without breaking legitimate continuations, and preventing stat-number leakage in event/result/ending copy. AI remains a proposal source; server-owned rules decide whether content is accepted, retried once, or replaced with safe fallback.

## Tech Stack

| Area | Choice |
|---|---|
| Framework | Next.js 16.2.10 App Router |
| UI/runtime | React 19.2.7, TypeScript 6.0.3, Node >=20.9 |
| Data | PostgreSQL with Prisma 7.8.0 |
| Auth | NextAuth 4.24.14, existing email/password flow |
| Validation | Zod 4.4.3 where applicable; pure TypeScript for event quality scoring |
| Testing | Vitest 3.2.4 for unit/API tests; Playwright 1.55.1 optional for browser acceptance |
| Deployment | Vercel production with existing environment variables |

Existing code references:
- Non-stream event generation route: `app/api/characters/[id]/events/next/route.ts`.
- Streaming event generation route: `app/api/characters/[id]/events/next/stream/route.ts`.
- Static event selection and life-stage allowance: `lib/game/event-engine.ts`.
- Life-stage derivation: `lib/game/life-stage.ts`.
- AI event and ending normalization/generation: `lib/game/openrouter.ts`.
- Choice/result/ending creation: `app/api/characters/[id]/choices/route.ts`.
- Existing logger: `lib/server/logger`.
- Current unit coverage for event engine: `tests/unit/api/event-engine.test.ts`.

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/characters/[id]/events/next` | Required | Generate a non-streaming next event. Must validate candidate events before persistence and use retry/fallback policy. |
| POST | `/api/characters/[id]/events/next/stream` | Required | Generate a streaming next event. Must validate final candidate before persistence; if streamed draft is replaced, emit `replace_body`. |
| POST | `/api/characters/[id]/choices` | Required | Apply choice effects and generate result/ending records. Must prevent numeric stat exposure in final result text and ending records. |

No new public endpoint is required.

## Database Schema

No migration is allowed in this slice.

| Entity | Columns Used | Constraints |
|---|---|---|
| `CharacterRun` | `id`, `userId`, `academicStatus`, `currentGradeYear`, `coreEventCount`, `currentEventId`, `major`, `age`, `name` | Existing rows only; no schema changes. |
| `HiddenState` | `burnoutRisk`, `eventFlags`, `familyState` | Existing JSON flags used to detect closed proposals and continuity. |
| `Event` | `title`, `body`, `choices`, `tags`, `source`, `status`, `safetyChecked` | Persist only events that pass quality validation or safe fallback selection. |
| `EventHistory` | `summary`, `relationshipDelta`, `event.tags`, `event.title` | Recent history drives repetition scoring. |
| `CharacterStats` | public stats | Read-only during event quality validation; choice effects still happen in existing choice route. |
| `CareerRecord` | narrative fields | Existing record creation must sanitize numeric stat exposure before save. |

## Design Direction

This run does not add new player controls. It changes the content quality behind the existing text-adventure play surface described in `.tenet/project/design.md`. Visual artifacts for the agile plan live under `.tenet/runs/2026-07-08-event-quality-system/visuals/` and describe the event-quality flow rather than a new UI screen.

## Auth Flow

1. User opens the app with an anonymous or authenticated current run, as currently implemented.
2. Protected routes call `requireCurrentUserId()`.
3. If no user is available, routes return the existing Korean login-required error.
4. If user owns the character, routes load state and run event quality checks.
5. Auth/session behavior must not be modified.

## Event Quality Contract

### Event Thread Lifecycle

Events and proposals are thread-like opportunities, not permanent switches. A proposal or activity can be:

- `offered`: the player has seen the proposal but has not committed.
- `accepted`: the player joined or agreed to participate.
- `active`: the activity is currently meaningful and may produce follow-up events.
- `low_participation`: the player accepted but is not meaningfully participating; follow-ups should be warnings, consequences, or closure decisions, not the same invitation again.
- `quit`: the player voluntarily left.
- `expelled`: the player was forced out due to low participation, conflict, failure, or reputation.
- `completed`: the activity ran its course.
- `closed`: a terminal state for rejected, quit, expelled, completed, or otherwise unavailable threads.

Implementation may represent these states through existing `eventFlags` and inferred history; no new DB schema is allowed. Closed threads remain available as past history and consequence, but the same offer must not be reintroduced as if it were new or active.

Player agency rule: players choose actions and commitments, not adjudicated outcomes. Valid choices include continuing to participate, apologizing, asking for feedback, reducing commitment, voluntarily quitting, or changing strategy. Forced removal, expulsion, pass, fail, acceptance, and rejection by an institution/group/company are server/AI/state consequences based on prior participation, conflict, reputation, or other state. A player-facing choice must not say the player chooses to be expelled, fail, pass, or be rejected.

### Validator Result

The core module returns:

```ts
type EventQualityVerdict = {
  status: "pass" | "fail";
  hardFailure: boolean;
  reasons: string[];
  diversityScore: number;
  continuityExemptions: string[];
  retryRecommended: boolean;
  fallbackRecommended: boolean;
};
```

### Hard Failures

Hard failures bypass score and trigger retry/fallback:

1. **Academic conflict**: DROPPED_OUT/dropout event proposes ordinary enrolled campus life such as lectures, class assignments, semester classes, or normal student club obligations. Allowed exceptions: dropout paperwork, alumni/re-entry contact, outside study, non-enrolled life.
2. **Direct adjudicated result choice**: choice labels such as `합격한다`, `불합격한다`, `통과한다`, `떨어진다`, `서류 합격을 선택한다`, or equivalent direct pass/fail commands.
3. **Direct lifecycle outcome choice**: choice labels that make the player directly choose forced expulsion/removal/rejection, such as `퇴출된다`, `강제로 나간다`, `탈락한다`, or equivalent adjudicated outcome commands. Voluntary quit choices are allowed when phrased as the player's own action.
4. **Closed proposal repeat**: proposal already rejected, quit, expelled, completed, or explicitly closed is asked again as the same offer without new consequences.
5. **Malformed event/choices**: event lacks title/body/tags, has fewer than 2 or more than 4 choices, choice lacks meaningful label/summary/statDelta/relationshipDelta-compatible shape, or deltas are not objects.
6. **Health/mental delta violation**: ordinary AI event choice has `health < -1` or `mental < -1`. Forced crisis/burnout events selected by server rules are exempt.
7. **Numeric stat exposure**: event body, choice result, job pass/fail result, or ending narrative includes explicit stat-number phrasing such as `건강 6`, `학점 10`, `네트워크 3`, `academic: 7`.

### Diversity Scorecard

Default constants must be centralized:

```ts
recentEventLookback = 5;
strongRepeatLookback = 3;
hardRetryThreshold = 60;
```

Scoring starts at 100. Repetition penalties apply to recent people, tags/categories, places/activities, and same-proposal patterns. Continuity exemptions reduce or cancel repetition penalties when the candidate clearly advances one of:

- active `openThread`
- `careerGate`
- active `jobApplication` process stage
- in-progress `spec`
- active participation in a joined activity that has not been quit, expelled, completed, or closed
- relationship shift
- direct follow-up to the previous choice

Examples:
- Fail/retry: recent five events already include three study/library/class events, and candidate is another ordinary study event with the same person and no new stage/conflict/relationship shift.
- Pass with continuity exemption: contest application advances to team formation, submission, presentation, or result.
- Pass with continuity exemption: club/study participation advances to low-participation warning, quit decision, expulsion consequence, or completion result.
- Pass with continuity exemption: job application advances from document screening to personality test, coding test, interview, final interview, or result.
- Hard fail: rejected, quit, expelled, completed, or closed contest/club/study offer is asked again as the same participation offer.

### Retry And Fallback

1. Candidate generated.
2. Validator runs locally, target under 20ms.
3. If pass, persist.
4. If fail and candidate source is AI, retry AI once with validation reasons and diversity guidance.
5. If retry fails or still fails validation, use safe static fallback with no network call.
6. If static fallback unexpectedly fails validation/construction, do not commit invalid state. Return existing recoverable route error and log reason `fallback_failed`.
7. Do not increase AI timeout or daily limit.

### Log Adapter

Add adapter function, without DB writes:

```ts
recordEventQualityLog({
  characterRunId,
  eventId,
  phase,
  source,
  verdict,
  reasons,
  diversityScore,
  continuityExemptions,
  retryUsed,
  fallbackUsed,
  selectedFallbackTitle,
  durationMs,
  createdAt,
});
```

`phase` is one of `initial_ai`, `retry_ai`, `static_fallback`, `ending`, `choice_result`.

## Success Criteria

1. A dropout character cannot persist a normal enrolled campus-life event from AI; the system retries once or falls back to a school-outside event.
2. AI events with direct pass/fail choice labels are rejected before persistence.
3. A repeated closed proposal is rejected, but a legitimate multi-step contest/job/spec follow-up passes with continuity exemption.
4. Accepted activities can later become low participation, quit, expelled, completed, or closed through flags/history; once closed, the same offer is not treated as active.
5. Ordinary AI choices cannot reduce health or mental by more than 1 in a single choice.
6. Event body, choice result text, job result text, and ending text do not expose numeric stat values after processing.
7. Validator and diversity scorecard are pure and unit-tested.
8. Next-event routes log structured quality verdicts through the adapter.
9. Existing tests and `npm run build` continue to pass.

## Out of Scope

- No Prisma migration or new DB log table.
- No auth/account/session changes.
- No provider architecture rewrite and no timeout increase.
- No new player-facing spec/job-prep UI in this slice.
- No exact log transport integration with the separately deployed logging system.
- No real-company data changes.

## Slice plan

Total slices: 2

### Slice 1: Event Validation And Diversity
- **Adds**: Server-side event validator, repetition scorecard, event-thread lifecycle closure rules, one-retry AI policy, safe static fallback, and structured quality logs for next-event routes.
- **Bundled with**: Pure unit tests for hard failures, diversity scoring, continuity exemptions, and next-event fallback behavior.
- **User can**: Play through next events with fewer incoherent or stale repeated situations while legitimate follow-up arcs still continue.
- **Out of slice**: Ending/result numeric-stat sanitization beyond event candidates; spec/job-prep UI panels.

### Slice 2: Result And Ending Text Guard
- **Adds**: Numeric stat exposure guard for choice result copy, job pass/fail result copy, and AI/fallback ending narratives.
- **Bundled with**: Unit tests for sanitizer/validator examples and integration coverage around generated records.
- **User can**: Reach pass/fail results or endings without seeing awkward stat-number phrasing in narrative text.
- **Out of slice**: New result UI, new career/spec dashboard, DB-backed quality logs.

## Redirect at slice 1 (2026-07-08T17:00:00+09:00)

User feedback: Before implementation, add event lifecycle handling. Events can be accepted but later become low participation, quit, or forced expulsion. In those terminal cases the event should remain in history but close so it stops recurring as an active offer.

Affected slice(s): 1 onwards

Plan impact: Slice 1 now includes thread lifecycle inference/closure rules as part of event validation and repetition scoring. Slice 2 remains focused on numeric stat exposure in results/endings.


## Scenarios (inlined — success/failure shapes for this run)
# Event Quality System Scenarios

## Scenarios (Success)

1. **Dropout conflict rejected**
   - Given a character with dropout life stage
   - When AI proposes an event about attending ordinary lectures and submitting class assignments
   - Then the validator returns fail, hardFailure true, and reason includes academic conflict
   - And the route retries once or falls back without committing the invalid event

2. **Job process continuation allowed**
   - Given recent events mention the same company/job application
   - When the candidate advances from 서류 to 인성검사 or 면접
   - Then repeated company/job tags receive a continuity exemption
   - And the event can pass if no hard failure exists

3. **Closed contest proposal blocked**
   - Given event flags show contestSkipped true or contestJoined completed
   - When a candidate asks the same contest/team-join offer again
   - Then validation fails as closed proposal repeat regardless of diversity score

4. **Direct pass/fail choice rejected**
   - Given an AI event choice label is `서류 합격을 선택한다`
   - When quality validation runs
   - Then the event fails before persistence

5. **Numeric stat text removed or rejected**
   - Given generated ending text contains `학점 10의 지식` or `네트워크 3`
   - When result/ending text guard runs
   - Then saved/displayed narrative does not include those numeric stat phrases

6. **Streaming replacement remains playable**
   - Given streaming AI body deltas were sent for a candidate that fails validation
   - When retry or fallback produces a valid event
   - Then the stream sends `replace_body` and final `event` payload matches the persisted valid event

7. **Accepted activity can close after poor participation**
   - Given the character accepted a club, study, contest, outside group, or similar activity
   - When later flags/history indicate low participation followed by quit, expulsion, completion, or closure
   - Then the thread remains available as past context
   - And the same participation offer is not presented again as an active invitation

## Anti-Scenarios (Failure)

1. **Blanket repetition ban breaks story**
   - A contest or job process follow-up is rejected only because tags repeat, even though process stage changed.

2. **Extra AI loop slows gameplay**
   - A single next-event request performs multiple retries or waits past the existing timeout policy.

3. **Invalid fallback is committed**
   - AI fails validation, fallback construction fails, and route still commits an unsafe or malformed event.

4. **Result choice lets player choose outcome**
   - A player-facing choice says `합격한다`, `불합격한다`, `통과한다`, or equivalent.

5. **Narrative exposes raw stat scores**
   - Event/result/ending copy includes phrases like `건강 6`, `학점 10`, `academic: 7`, or `네트워크 3`.

6. **Quality logs require DB migration**
   - Implementation adds a new log table or blocks gameplay on log transport failure.

7. **Accepted means forever active**
   - A study, club, contest, or outside group remains eligible for ordinary follow-up forever only because it was once accepted, even after quit, expulsion, completion, or closure.


## Decomposition (inlined — the run's plan / DAG)
# Decomposition for event-quality-system

## Slice 1: Event Validation And Diversity

### ASCII DAG

```text
slice-1-thread-lifecycle-core
  └─ slice-1-validator-scorecard
       └─ slice-1-route-integration
            └─ slice-1-e2e
```

### Job Details

#### slice-1-thread-lifecycle-core
- **Type**: dev
- **Depends on**: none
- **Deliverables**:
  - Add a pure event quality module, expected path `lib/game/event-quality.ts` unless a better local pattern is found.
  - Implement lifecycle inference for event/activity threads using existing `eventFlags` and recent summaries/history.
  - Recognize accepted, active, low participation, quit, expelled, completed, and closed states without DB schema changes.
  - Closed threads must remain available as history but not as active invitations.
  - Add unit tests covering accepted -> low_participation -> quit/expelled/completed/closed.
- **Verification criteria**:
  - `tests/acceptance/event-quality-system.test.ts` lifecycle tests can import the module.
  - Closed thread repeat can produce a `closed_thread_repeat` hard-failure reason.
  - No Prisma migration is created.

#### slice-1-validator-scorecard
- **Type**: dev
- **Depends on**: `slice-1-thread-lifecycle-core`
- **Deliverables**:
  - Implement `evaluateEventQuality` validator result contract from `spec.md`.
  - Implement hard failures: academic conflict, direct result choice, malformed choices, health/mental delta violation, numeric stat exposure in event text, closed thread repeat.
  - Implement diversity scorecard constants and continuity exemptions, including lifecycle closure consequences.
  - Implement `stripNumericStatExposure` enough for event/result guard examples, while leaving full route integration for Slice 2.
  - Add focused unit tests.
- **Verification criteria**:
  - Direct pass/fail choice fails before persistence.
  - Legitimate lifecycle closure consequence passes with `lifecycle_closure`.
  - Repetition without progression scores below threshold; progression with exemption passes.

#### slice-1-route-integration
- **Type**: dev
- **Depends on**: `slice-1-validator-scorecard`
- **Deliverables**:
  - Add `lib/server/event-quality-log.ts` or equivalent adapter with the spec payload shape and no DB writes.
  - Integrate quality validation into `app/api/characters/[id]/events/next/route.ts`.
  - Integrate quality validation into `app/api/characters/[id]/events/next/stream/route.ts`, preserving `body_delta` and using `replace_body` when retry/fallback replaces streamed text.
  - Enforce at most one AI retry and no network call for static fallback.
  - Add tests or documented coverage for retry/fallback and logging behavior.
- **Verification criteria**:
  - Invalid AI candidate is not persisted.
  - Retry is attempted at most once.
  - Fallback is validated and logged.
  - Existing forced event and life-stage routing behavior remains intact.

#### slice-1-e2e
- **Type**: integration_test
- **Depends on**: `slice-1-route-integration`
- **Report only**: true
- **Prompt**:
  - Run `npm test -- --run tests/acceptance/event-quality-system.test.ts tests/unit/api/event-engine.test.ts`.
  - Run `npm run build`.
  - Report pass/fail with any blocking findings. Do not edit code.

### Interface Contracts

- `evaluateEventQuality(input)` returns the `EventQualityVerdict` contract in `spec.md`.
- `inferThreadLifecycle(input)` returns at least `{ activeThreads: string[]; closedThreads: string[] }`; additional metadata is allowed.
- `stripNumericStatExposure(text)` returns Korean narrative text without raw stat-number phrases.
- Route integration must treat AI output as candidate-only and must validate before `prisma.event.create`.
- Log adapter must not require DB availability beyond existing route persistence.


## Harness (inlined)
# Event Quality System Harness

## Formatting And Linting

- Use existing TypeScript style.
- Build gate: `npm run build`.
- Test gate: `npm test`.
- Do not introduce new formatting tools.

## Testing

- Unit tests must cover `lib/game/event-quality.ts` or equivalent pure module.
- Update route-level/unit tests where practical for next-event fallback behavior.
- Existing `tests/unit/api/event-engine.test.ts` behavior must remain passing.
- Add tests for numeric stat exposure in result/ending sanitization.
- Playwright is optional for this slice because the visible UI does not add new controls; browser verification can be skipped with reason if unit/build coverage passes.

## Architecture Rules

- Server owns event authority. AI output remains a proposal.
- Quality validation must happen before committing an `Event`.
- Quality module must be pure and not import Prisma, Next.js route types, or provider clients.
- Log adapter may import server logger but must not write to the database.
- Next-event streaming and non-streaming routes should share the same quality policy as much as possible.
- Keep tunable constants in one exported object.

## Code Principles

- Prefer deterministic validation over broad prompt-only fixes.
- Preserve legitimate continuity; do not flatten the story into unrelated random events.
- Preserve lifecycle accuracy: accepted participation may later become low participation, quit, expelled, completed, or closed.
- Reject adjudicated result choices; player chooses strategy/action, code decides pass/fail.
- Reject adjudicated lifecycle outcome choices; player can voluntarily quit, but forced expulsion/removal must be a consequence, not a chosen button.
- Fail open to playable fallback, never to invalid committed state.

## Danger Zones

- Do not edit `.tenet/project/**`.
- Do not edit `.tenet/.state/**`.
- Do not create Prisma migrations for this run.
- Do not change auth/session files unless a test proves event-quality work cannot proceed otherwise.
- Do not alter provider API keys or Vercel environment variables.

## Iron Laws

1. No invalid event may be committed after a hard validator failure.
2. At most one additional AI retry per next-event request.
3. Static fallback must not perform network calls.
4. Health/mental single-choice drops greater than 1 are forbidden for ordinary AI events.
5. Numeric stat values must not appear in narrative result surfaces.
6. Closed participation threads must not be treated as active just because they were once accepted.
7. Player-facing choices must not directly choose forced expulsion, failure, rejection, pass, or acceptance outcomes.
8. Existing event progression and forced burnout behavior must remain intact.

## Project Doctrine Boundary

Normal implementation jobs must not edit `.tenet/project/**`. If implementation reveals stale doctrine, write a proposal under `.tenet/runs/2026-07-08-event-quality-system/journal/`.

## Evaluation Expectations

- Eval should be sequential if tests share mutable DB/session state.
- Interaction-e2e may be marked not applicable or optional for slice 1 if no browser-visible controls change.
- Code critic should focus on pre-commit validation, retry/fallback consistency, and no schema/auth drift.


## Selective references (consult as relevant)
Under .tenet/runs/2026-07-08-event-quality-system/: journal/ (prior attempts + failure logs), research/ (current-run research), visuals/ (UI/architecture mockups).
</tenet_run_context>

Retry the code critic. Previous run failed before producing rubric JSON due provider usage-limit error, not due an implementation finding. Evaluate the same source job output and return the required JSON rubric.
ERROR: You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at 10:29 PM.
ERROR: You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at 10:29 PM.

- [ ] test_critic for fd686716
- [ ] interaction_e2e for fd686716
- [x] eval-mrske0fb — 18s
- [x] eval-mrskhxu0 — 13s
- [x] eval-mrslrtfs — 20s
- [x] blocking finding follow-up for Integration: slice 1 event quality — 1m 48s
- [x] code_critic for 649da40c — 1m 27s
- [x] test_critic for 649da40c — 1m 17s
- [x] interaction_e2e for 649da40c — 2m 34s
- [x] code_critic for 649da40c — 1m 20s
- [x] test_critic for 649da40c — 1m 7s
- [x] interaction_e2e for 649da40c — 2m 4s
- [x] code_critic for 649da40c — 1m 12s
- [x] test_critic for 649da40c — 1m 29s
- [x] interaction_e2e for 649da40c — 4m 39s
- [x] code_critic for 649da40c — 58s
- [x] test_critic for 649da40c — 53s
- [x] interaction_e2e for 649da40c — 4m 58s
- [x] code_critic for 649da40c — 54s
- [x] test_critic for 649da40c — 38s
- [x] interaction_e2e for 649da40c — 1m 25s
- [x] code_critic for 138c316a — 1m 5s
- [x] test_critic for 138c316a — 52s
- [x] interaction_e2e for 138c316a — 2m 41s
- [x] code_critic for 138c316a — 1m 24s
- [x] test_critic for 138c316a — 1m 21s
- [x] interaction_e2e for 138c316a — 2m 44s
- [x] code_critic for 138c316a — 1m 41s
- [x] test_critic for 138c316a — 43s
- [x] interaction_e2e for 138c316a — 1m 42s
- [x] code_critic for 138c316a — 1m 5s
- [x] test_critic for 138c316a — 45s
- [x] interaction_e2e for 138c316a — 2m 17s
- [x] code_critic for 138c316a — 1m 36s
- [x] test_critic for 138c316a — 1m 9s
- [x] interaction_e2e for 138c316a — 1m 7s
- [x] code_critic for 138c316a — 1m 39s
- [x] test_critic for 138c316a — 58s
- [x] interaction_e2e for 138c316a — 1m 9s
- [x] blocking finding follow-up for Integration: event selection stability — 3m 35s
- [x] code_critic for cdd46389 — 1m 22s
- [x] test_critic for cdd46389 — 32s
- [x] interaction_e2e for cdd46389 — 1m 21s
- [x] code_critic for 60faeba4 — 1m 20s
- [x] test_critic for 60faeba4 — 50s
- [x] interaction_e2e for 60faeba4 — 2m 38s
- [x] code_critic for 60faeba4 — 1m 8s
- [x] test_critic for 60faeba4 — 1m 19s
- [x] interaction_e2e for 60faeba4 — 1m 23s
- [x] code_critic for 60faeba4 — 1m 44s
- [x] test_critic for 60faeba4 — 1m 2s
- [x] interaction_e2e for 60faeba4 — 2m 36s
- [x] code_critic for 60faeba4 — 1m 24s
- [x] test_critic for 60faeba4 — 1m 18s
- [x] interaction_e2e for 60faeba4 — 1m 47s
- [x] code_critic for 60faeba4 — 1m 28s
- [x] test_critic for 60faeba4 — 51s
- [x] interaction_e2e for 60faeba4 — 2m 33s
- [x] code_critic for 60faeba4 — 1m 20s
- [x] test_critic for 60faeba4 — 1m 19s
- [x] interaction_e2e for 60faeba4 — 1m 59s
- [x] eval-mrt5yjo8 — 12s
- [x] eval-mrt60y1k — 11s
- [x] eval-mrt627y6 — 13s
- [x] eval-mrt72clt — 16s
- [x] eval-mrt73p6r — 17s
- [x] eval-mrt760mg — 18s
- [x] eval-mrt76yei — 20s
- [x] code_critic for d5a2be21 — 1m 54s
- [x] test_critic for d5a2be21 — 1m 24s
- [x] interaction_e2e for d5a2be21 — 4m 58s
- [x] code_critic for d5a2be21 — 1m 36s
- [x] test_critic for d5a2be21 — 1m 15s
- [x] interaction_e2e for d5a2be21 — 3m 35s
- [x] code_critic for d5a2be21 — 1m 13s
- [x] test_critic for d5a2be21 — 46s
- [x] interaction_e2e for d5a2be21 — 1m 59s
- [x] code_critic for d5a2be21 — 1m 35s
- [x] test_critic for d5a2be21 — 36s
- [x] interaction_e2e for d5a2be21 — 1m 20s
- [x] code_critic for eeae113e — 1m 24s
- [x] test_critic for eeae113e — 40s
- [x] interaction_e2e for eeae113e — 2m 40s
- [x] code_critic for 60faeba4 — 1m 22s
- [x] test_critic for 60faeba4 — 1m 7s
- [x] interaction_e2e for 60faeba4 — 2m 17s
- [x] code_critic for eeae113e — 56s
- [x] test_critic for eeae113e — 1m 3s
- [x] interaction_e2e for eeae113e — 1m 43s
- [x] authoritative-fast-event-generation — 71m 51s !! cancelled by user
- [x] code_critic for ec4e61e6 — 1m 42s
- [x] test_critic for ec4e61e6 — 42s
- [x] interaction_e2e for ec4e61e6 — 1m 51s
- [x] code_critic for eeae113e — 1m 7s
- [x] test_critic for eeae113e — 1m 0s
- [x] interaction_e2e for eeae113e — 2m 54s
- [x] code_critic for eeae113e — 1m 36s
- [x] test_critic for eeae113e — 56s
- [x] interaction_e2e for eeae113e — 2m 35s
- [x] code_critic for ec4e61e6 — 1m 5s
- [x] test_critic for ec4e61e6 — 50s
- [x] interaction_e2e for ec4e61e6 — 1m 7s
- [x] code_critic for ec4e61e6 — 1m 21s
- [x] test_critic for ec4e61e6 — 1m 12s
- [x] interaction_e2e for ec4e61e6 — 1m 18s
- [x] code_critic for eeae113e — 52s
- [x] test_critic for eeae113e — 56s
- [x] interaction_e2e for eeae113e — 3m 12s
- [x] code_critic for ec4e61e6 — 57s
- [x] test_critic for ec4e61e6 — 44s
- [x] interaction_e2e for ec4e61e6 — 1m 35s
- [x] code_critic for eeae113e — 1m 8s
- [x] test_critic for eeae113e — 1m 3s
- [x] interaction_e2e for eeae113e — 1m 46s
- [x] code_critic for eeae113e — 1m 21s
- [x] test_critic for eeae113e — 46s
- [x] interaction_e2e for eeae113e — 1m 43s
- [x] authoritative-fast-event-generation-final — 2m 8s
- [x] blocking finding follow-up for Integration: predeployment UI and age gates — 3m 50s
- [x] restore-existing-toss-visual-ui — 5m 54s
- [x] code_critic for 397154ac — 1m 3s
- [x] test_critic for 397154ac — 1m 9s
- [x] interaction_e2e for 397154ac — 1m 8s
- [x] code_critic for 397154ac — 1m 10s
- [x] test_critic for 397154ac — 1m 5s
- [x] interaction_e2e for 397154ac — 1m 19s
- [x] code_critic for 397154ac — 1m 41s
- [x] test_critic for 397154ac — 1m 4s
- [x] interaction_e2e for 397154ac — 1m 43s
- [x] code_critic for 397154ac — 48s
- [x] test_critic for 397154ac — 39s
- [x] interaction_e2e for 397154ac — 1m 9s
- [x] code_critic for 397154ac — 2m 4s
- [x] test_critic for 397154ac — 1m 12s
- [x] interaction_e2e for 397154ac — 1m 46s
- [x] code_critic for eb07c32f — 1m 8s
- [x] test_critic for eb07c32f — 49s
- [x] interaction_e2e for eb07c32f — 3m 52s
- [x] final-predeploy-remediation-and-verification — 3m 48s
- [x] stabilize-toss-restoration-playwright-gate — 3m 31s
- [x] code_critic for 8cc3b3cb — 49s
- [x] test_critic for 8cc3b3cb — 34s
- [x] interaction_e2e for 8cc3b3cb — 38s
- [x] replacement-predeployment-checkpoint — 3m 40s
- [x] Fix production source completeness — 4m 38s
