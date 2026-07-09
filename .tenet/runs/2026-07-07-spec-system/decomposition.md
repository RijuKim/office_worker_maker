# Decomposition: 스펙 시스템 (Credential/Spec System)

Run slug: `2026-07-07-spec-system`
Delivery mode: `autonomous`
Model tier: `frontier`

## ASCII DAG

```text
job-1-spec-db-migration
        │
        ├──────────────────────┐
        │                      │
job-2-spec-domain-logic   job-3-event-engine-changes
        │                      │
        └──────────┬───────────┘
                   │
        job-4-spec-api-routes
                   │
        job-5-choice-response-change
                   │
        job-6-spec-ui
                   │
        e2e-1-spec-integration
```

## Job Details

### job-1-spec-db-migration

Type: `dev`
Depends on: none

Goal: Add Prisma schema changes for the spec system.

Deliverables:
- Add `SpecType` enum: `INTERNSHIP`, `LANGUAGE_SCORE`, `PORTFOLIO`, `CERTIFICATION`, `EXAM_PREP`, `CAREER_PATH`
- Add `SpecStatus` enum: `IN_PROGRESS`, `COMPLETED`, `FAILED`
- Add `ApplicationStage` enum: `DOCUMENT`, `PERSONALITY_TEST`, `CODING_TEST`, `FIRST_INTERVIEW`, `SECOND_INTERVIEW`, `FINAL_RESULT`
- Add `Spec` model with fields: `id`, `characterRunId`, `specType`, `specName`, `status`, `score?`, `startedAt`, `completedAt?`, `eventFlags`
- Add `JobApplication` model with fields: `id`, `characterRunId`, `companyName`, `companyType`, `currentStage`, `stageResults`, `specScore`, `documentPassed?`, `personalityPassed?`, `codingTestPassed?`, `firstInterviewPassed?`, `secondInterviewPassed?`, `finalResult?`, `isActive`, `createdAt`, `updatedAt`
- Add `CareerPath` model with fields: `id`, `characterRunId`, `pathType`, `pathName`, `status`, `startedAt`, `completedAt?`, `eventFlags`
- Add `specScore` field to `CharacterRun` model (Int, default 0)
- Run `npx prisma migrate dev --name add_spec_system` to create migration
- Run `npx prisma generate` to update client

Scope:
- Schema changes only. No API routes, no domain logic.
- All new models have proper FK relations to CharacterRun with onDelete Cascade.

Verification:
- `npx prisma validate` passes
- Migration creates all new tables and enums
- `npx prisma generate` succeeds
- `npm run typecheck` passes

### job-2-spec-domain-logic

Type: `dev`
Depends on: `job-1-spec-db-migration`

Goal: Implement core domain logic for spec system.

Deliverables:
- Create `lib/game/spec-system.ts` with:
  - `calculateSpecScore(specs: Spec[]): number` — calculates aggregate spec score from completed specs
  - `getCompanyStages(companyType: string): ApplicationStage[]` — returns stage list per company type
  - `evaluateDocumentStage(specScore: number, academic: number, practical: number): { passed: boolean, score: number }` — document pass/fail logic
  - `evaluatePersonalityTest(mental: number, reputation: number): { passed: boolean, score: number }` — personality test with blind hiring random factor
  - `evaluateCodingTest(practical: number, academic: number): { passed: boolean, score: number }`
  - `evaluateFirstInterview(communication: number, charm: number, practical: number): { passed: boolean, score: number }`
  - `evaluateSecondInterview(reputation: number, mental: number, charm: number): { passed: boolean, score: number }`
  - `evaluateFinalResult(aggregateScore: number): { passed: boolean, score: number }` — includes spec-overcoming luck element
  - `isCareerPathEligible(pathType: string, stats: Record<string, number>, major: string): { eligible: boolean, reason?: string }`
  - `calculateSpecFatigue(burnoutRisk: number, rejections: number): number` — increases burnoutRisk per rejection
  - `calculateFinancialBurden(wealth: number, applicationType: string): number` — reduces wealth
  - `getBlindHiringRandomFactor(): number` — returns -5 to +5 random modifier
- Create `lib/game/spec-system.test.ts` with unit tests

Scope:
- Pure logic only. No API routes, no Prisma queries.
- All functions are deterministic (except blind hiring random factor which is testable via seed).

Verification:
- `npm run test` passes for spec-system tests
- `npm run typecheck` passes

### job-3-event-engine-changes

Type: `dev`
Depends on: `job-1-spec-db-migration`

Goal: Extend event engine for spec system and narrative prepending.

Deliverables:
- In `lib/game/event-engine.ts`:
  - Add `previousChoiceSummary?: string` to `EventSelectionContext`
  - Add `specs?: Spec[]`, `jobApplications?: JobApplication[]`, `careerPaths?: CareerPath[]` to `EventSelectionContext`
  - Modify `selectNextEvent` to accept and use `previousChoiceSummary`:
    - When present, prepend a narrative bridge paragraph to the selected event's body
    - Format: `"지난 선택의 결과, {summary}. 그리고 이어지는 이야기...\n\n{original body}"`
  - Add new conditional event conditions: `requiredSpecs`, `requiredApplicationStage`, `requiredCareerPath`, `specScoreBelow/Above`
- Add 15+ new static events to `STATIC_EVENTS` array:
  - Spec initiation events (3-4): TOEIC 접수, 인턴 지원, 공모전 참가, 자격증 준비
  - Spec resolution events (3-4): 시험 결과, 인턴 종료, 공모전 결과, 자격증 합격
  - Job application stage events (4-5): 서류 합격/불합격, 인적성, 코테, 면접
  - Career path events (3-4): 워홀 준비, 임용 시험, 회계사 시험, 로스쿨 LEET
  - Korean job-seeking reality events (2-3): 취준 우울, 스펙 초월 합격, 블라인드 채용 반전
- Add conditional events for spec/job/career gating

Scope:
- Event engine changes only. No API route changes.
- New events are static (no AI dependency).

Verification:
- `npm run typecheck` passes
- New events have valid structure (title, body, choices, tags, source)
- Narrative prepending works correctly

### job-4-spec-api-routes

Type: `dev`
Depends on: `job-2-spec-domain-logic`, `job-3-event-engine-changes`

Goal: Implement API routes for spec system.

Deliverables:
- Create `app/api/characters/[id]/specs/route.ts`:
  - POST: Create a new Spec record (triggered by event choice flagDelta)
  - GET: List character's specs
- Create `app/api/characters/[id]/specs/[specId]/complete/route.ts`:
  - POST: Complete/fail a spec with score (triggered by event resolution flagDelta)
- Create `app/api/characters/[id]/job-applications/route.ts`:
  - POST: Create a new JobApplication (apply to company)
  - GET: List job applications
- Create `app/api/characters/[id]/job-applications/[appId]/advance/route.ts`:
  - POST: Advance to next stage (triggered by event resolution)
  - Uses domain logic from `lib/game/spec-system.ts` for pass/fail
  - Updates burnoutRisk and wealth based on results
- Create `app/api/characters/[id]/career-paths/route.ts`:
  - POST: Start a career path (checks eligibility)
  - GET: List career paths
- All routes use `requireCurrentUserId()` and owner-scoped queries
- All routes follow existing patterns in `app/api/characters/[id]/`

Scope:
- API routes only. No UI changes.
- Routes are triggered by event flagDeltas (spec creation/completion) or direct API calls (job application, career path).

Verification:
- `npm run typecheck` passes
- API routes return correct status codes and data shapes
- Owner-scoped access works (wrong user gets 404)

### job-5-choice-response-change

Type: `dev`
Depends on: `job-4-spec-api-routes`

Goal: Modify choice response to remove narrative summary, keep stat delta labels.

Deliverables:
- In `app/api/characters/[id]/choices/route.ts`:
  - Keep `statDelta` in the response JSON
  - Remove `summary` from the response JSON
  - Keep `eventResolved`, `endingTriggered`, `resultType`, `lifeStage`
  - Response shape becomes: `{ eventResolved: true, statDelta, endingTriggered, resultType, lifeStage }`
- In `app/api/characters/[id]/events/next/route.ts`:
  - Read the most recent `EventHistory` entry
  - Pass its `summary` to the event engine as `previousChoiceSummary`
  - The event engine prepends the narrative bridge to the next event's body

Scope:
- Choice response change only.
- Stat delta labels remain visible to the player.
- Summary text flows into the next event's narrative.

Verification:
- `npm run typecheck` passes
- Choice response no longer contains `summary` field
- Choice response still contains `statDelta` field
- Next event body begins with narrative reference to previous choice

### job-6-spec-ui

Type: `dev`
Depends on: `job-5-choice-response-change`

Goal: Add UI panels for spec system.

Deliverables:
- Add **Spec Panel** to character sidebar: shows current specs with progress status
- Add **Job Application Panel**: shows active applications with stage progress bars
- Add **Career Path Panel**: shows active career path with step indicators
- Add **Spec Score Display**: aggregate spec score shown in character stats area
- All panels follow existing UI patterns (Korean text-adventure, compact side panels)
- Mobile single-column layout support

Scope:
- UI components only. No API changes.
- Fetches data from existing GET endpoints.

Verification:
- `npm run typecheck` passes
- `npm run build` passes
- Spec panel renders with correct data
- Job application panel shows stage progress
- Career path panel shows step indicators

### e2e-1-spec-integration

Type: `integration_test`
Depends on: `job-6-spec-ui`
Report only: true

Goal: Run acceptance tests for the spec system.

Deliverables:
- Run acceptance tests in `tests/acceptance/spec-system.spec.ts`
- Report pass/fail for each scenario
- Report any blocking findings through Tenet

Verification:
- All acceptance scenarios pass or blockers are reported
- No code edits during this job

## Interface Contracts

### Spec Creation Contract
- Triggered by: event choice flagDelta containing `{ specInit: { specType, specName } }`
- Input: `{ specType: SpecType, specName: string }`
- Output: created Spec record
- Invariant: specs are only created through event choices

### Spec Completion Contract
- Triggered by: event resolution flagDelta containing `{ specComplete: { specId, score? } }`
- Input: `{ specId: string, score?: string }`
- Output: updated Spec record with status and score
- Invariant: spec score is calculated from actual completed Spec records

### Job Application Contract
- Input: `{ companyName: string, companyType: string }`
- Output: JobApplication with initial DOCUMENT stage
- Invariant: company names must be fictional/parody

### Stage Advancement Contract
- Triggered by: event resolution flagDelta containing `{ advanceApplication: { appId } }`
- Uses domain logic for pass/fail
- Updates burnoutRisk and wealth
- Invariant: stages follow company-type-specific order

### Career Path Contract
- Input: `{ pathType: string, pathName: string }`
- Checks eligibility before creation
- Output: CareerPath record
- Invariant: failed paths route back to general job-seeking

### Choice Response Contract
- Response: `{ eventResolved: true, statDelta, endingTriggered, resultType, lifeStage }`
- No `summary` field in response
- Stat delta labels remain visible
