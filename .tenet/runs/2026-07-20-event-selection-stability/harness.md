# Harness: Event Selection Stability

## Formatting & Linting

- Run `npm run lint` and `npm run typecheck`.
- Preserve existing TypeScript/Next.js conventions; avoid unrelated formatting churn.

## Testing

- Framework: Vitest 3.2.4 for unit and route-level tests; Playwright 1.55.1 for browser interaction where the local app/test DB are available.
- Required focused tests:
  - Existing active AI/static/forced event is returned unchanged even if current life-stage eligibility would reject it as a new candidate.
  - Stream and JSON paths share identical immutability semantics.
  - Concurrent candidate commits produce one authoritative ID and losing requests return it.
  - No losing candidate remains active.
  - Choice submission is the normal advance boundary.
  - Config parsing covers missing, non-numeric, below-minimum, above-maximum, and valid timeout values.
  - Mocked slow provider response over 10 seconds succeeds without fallback; configured timeout produces fallback only before commit.
  - Choice count/field/stat/schema failures have distinct diagnostic reasons.
  - Valid first generation does not issue redundant provider requests.
- Provider calls are mocked because live LLM timing, credentials, and output are nondeterministic. At least one route-level test must exercise real application persistence mocks or a test PostgreSQL database rather than only testing pure helpers.
- Run focused tests first, then `npm test -- --run`, then `npm run build`.

## Interaction E2E Surface

- Surface: browser UI plus server API.
- Layer 1: required, automated route/unit tests with mocked provider.
- Layer 2 Playwright: optional if authenticated test database/startup fixtures are unavailable; if unavailable, interaction critic must probe the public route/test surface via shell and report the limitation. No live provider call is required.
- Verify no prototype-only duplicate-request explanatory text appears in production UI.

## Non-UI Verification

- Assert structured logs through logger mocks: reason category, duration fields, slow flag, retry/fallback flags, authoritative event ID.
- Assert database transition calls/order and final active/current event state.
- Never assert or snapshot API keys, full prompts, or complete provider responses.

## Architecture Rules

- Server owns eligibility, generation, validation, commit, fallback, and advancement.
- Prefer one shared event-acquisition/commit service used by both route variants; do not copy another lifecycle implementation.
- Existing current event is immutable and must be resolved through `currentEventId` authority.
- Candidate eligibility checks run before commit only.
- Concurrent commit uses an atomic database operation/transaction, not process-local memory locks.
- Client-side request guards are defense in depth only, never the correctness mechanism.

## Code Principles

- Make illegal lifecycle transitions difficult to express.
- Keep failure categories typed and testable.
- Bound retries and explain every provider call.
- Preserve user progress before optimizing narrative novelty.

## Danger Zones

- Do not edit `.tenet/project/**`.
- Do not edit `.tenet/.state/**` or database state files.
- Do not expose or modify `.env*` secrets.
- Do not change authentication/password/session behavior.
- Do not modify career ending/record rules except where compilation requires adapting a shared type.
- Do not add prototype-only UI text to `app/page.tsx` or Toss UI.
- Do not weaken choice agency, safety, stat bounds, or life-stage validation for new candidates.

## Iron Laws

1. Once `currentEventId` points to a committed active event, only a valid player choice or existing explicit run termination may advance it.
2. Static fallback is pre-commit last resort, never a timer-driven post-commit replacement.
3. Concurrent requests converge on one event ID.
4. No server secret or raw sensitive provider payload enters client responses/logs.
5. AI proposals remain subordinate to Zod and event-quality validation.

## Project Doctrine Boundary

Normal implementation jobs must not edit `.tenet/project/**`. Proposed doctrine updates belong in `.tenet/runs/2026-07-20-event-selection-stability/journal/`.

