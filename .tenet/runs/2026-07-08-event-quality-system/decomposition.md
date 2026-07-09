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
