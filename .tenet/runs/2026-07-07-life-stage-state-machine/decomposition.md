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
