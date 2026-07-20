# Decomposition: Event Selection Stability

Model tier: frontier (Standard-mode default)
Delivery mode: autonomous

## ASCII DAG

```text
event-authority ──> ai-generation-diagnostics ──> integration-event-stability
```

## Job Details

### event-authority

- Type: `dev`
- Dependencies: none
- Deliverables:
  - Shared server event-authority/acquisition logic used by JSON and SSE routes.
  - Existing committed events returned unchanged without life-stage revalidation.
  - Atomic compare-and-set or equivalent PostgreSQL-safe commit behavior.
  - Losing candidate cleanup and winner response.
  - Route/client recovery regression tests proving a stream disconnect cannot trigger replacement.
- Verification:
  - Acceptance tests for committed-event immutability and concurrent convergence pass.
  - Existing choice and event-quality tests remain green.

### ai-generation-diagnostics

- Type: `dev`
- Dependencies: `event-authority`
- Deliverables:
  - Configurable 30-second provider timeout with 5-120 second accepted range.
  - Detailed parse/schema/choice failure classification.
  - Provider/total duration and slow-over-10s structured telemetry.
  - Correct retry/fallback accounting and bounded provider calls.
  - Removal of avoidable full regeneration while preserving validated fallback.
- Verification:
  - Timeout parsing and choice-specific diagnostics acceptance tests pass.
  - Tests assert provider call counts, slow success behavior, pre-commit fallback, and no secret/raw prompt logging.

### integration-event-stability

- Type: `integration_test` (report only)
- Dependencies: `ai-generation-diagnostics`
- Deliverables:
  - Run focused acceptance/unit tests, full Vitest, lint, typecheck, and production build.
  - Inspect production UI to confirm prototype-only diagnostic text was not shipped.
  - Report blocking findings without editing product code.
- Verification:
  - All required commands pass or a concrete blocking finding is filed.

## Interface Contracts

- `event-authority` exposes one route-neutral operation that first resolves the authoritative current event and otherwise creates/claims a candidate through injected persistence/generation boundaries.
- The persistence boundary must support: read current pointer/event, create candidate, atomically claim only when pointer is null, discard losing candidate, and refetch winner.
- `openrouter` exposes deterministic timeout parsing and a detailed parse result that preserves the existing success event shape while adding typed failure stage/issues.
- Both routes emit the same final public event payload. Streaming may emit body previews before commit, but only the final `event` message establishes the client-visible choice state.
- Logs contain typed reason/timing metadata; public API payloads remain unchanged.
