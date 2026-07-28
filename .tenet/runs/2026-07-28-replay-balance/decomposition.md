# Decomposition: Replay Balance

## ASCII DAG

```text
job-1: Compact replay progression and events
  └── e2e-1: Final replay-balance verification
```

## Job Details

### job-1 — Compact replay progression and events

- Type: `dev`
- Dependencies: none
- Deliverables:
  - Set the academic cadence to three core events per semester and update all dependent prompt/fallback calculations.
  - Extract/test named final-ending thresholds so graduation-ready runs can end at 20 and eligible fallback runs end by 24.
  - Relax score-based extra-semester conditions to both academic and practical <= 4 while preserving explicit blockers.
  - Tighten AI events to 200–350 Korean characters, 3–5 sentences, normally two paragraphs, and 2–3 choices.
  - Ensure every static/contextual/forced/fallback event delivered to players has 2–3 choices without rewriting existing choice summaries.
  - Shorten static event bodies at sentence boundaries where needed; never raw-truncate.
  - Update/add unit and acceptance coverage, including the prewritten replay-balance tests.
- Verification:
  - `npx vitest run tests/acceptance/replay-balance-rules.test.ts tests/unit/api/life-stage.test.ts tests/unit/api/event-engine.test.ts tests/unit/api/openrouter.test.ts`
  - `npm run typecheck`
  - `git diff --check`

### e2e-1 — Final replay-balance verification

- Type: `integration_test`
- Report only: true
- Dependencies: `job-1`
- Deliverables:
  - Run the replay-balance rule acceptance suite and targeted browser interaction.
  - Confirm related progression, event-engine, AI parser/fallback, and ending tests pass.
  - Report regressions without editing product files; use a blocking finding for any required fix.
- Verification:
  - `npx vitest run tests/acceptance/replay-balance-rules.test.ts tests/unit/api/life-stage.test.ts tests/unit/api/event-engine.test.ts`
  - `npx playwright test tests/acceptance/replay-balance.spec.ts --project=desktop`
  - `npm run typecheck`
  - `git diff --check`

## Interface Contracts

- `lib/game/life-stage.ts` remains the source of truth for term cadence and extra-semester eligibility.
- A pure exported ending-rule helper owns the 20/24 thresholds; the choice API consumes it without changing response DTOs.
- `lib/game/openrouter.ts` owns AI schema and prompt limits. Four-choice proposals are invalid and use existing recovery/fallback behavior.
- Static event delivery guarantees 2–3 choices while preserving each retained choice object, especially `summary`, unchanged.
- No database, authentication, deployment, or public API contract changes.
