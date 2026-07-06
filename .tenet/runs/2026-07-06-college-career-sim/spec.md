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
