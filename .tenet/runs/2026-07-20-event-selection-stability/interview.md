# Interview: Event Selection Stability

Date: 2026-07-20
Mode: Standard
Rounds: 2

## Mode Selection
- Prompt shown: Standard mode was recommended because the existing event architecture is known, but timeout behavior, concurrent state transitions, and generation latency must be traced together.
- User response: "응 진행해줘"
- Selected mode: standard
- Selection basis: explicit_user_choice

## Clarity Score
- Goal: 0.9 (weight 0.4)
- Constraints: 0.6 (weight 0.3)
- Success criteria: 0.9 (weight 0.3)
- **Total: 0.81 / 0.8 required (passed)**

## Round 1

### Questions Asked
1. Once an AI event has been generated and its choices are displayed, should it remain indefinitely, with fallback allowed only for generation failures before display?
   > "응 이미 생성된 후에는 교체되면 안돼."

2. What latency/timeout behavior should apply to LLM generation?
   > Ten seconds is the expected performance target, but it must not be a hard failure threshold because LLM latency varies. Keep the current hard timeout and make it configurable through an environment variable.

3. If duplicate next-event requests occur because of double-clicks, rerenders, retries, or other concurrency, should the first committed/displayed event remain authoritative and prevent later responses from overwriting it?
   > "맞아"

### Decisions Made
- A generated, committed, and displayed event is immutable until the player submits one of its choices.
- Static fallback is a last resort available only before an event is committed, when AI generation is unavailable, times out, is rate-limited, returns invalid output, or fails quality validation.
- The current 30-second provider timeout remains the default and becomes configurable through `OPENROUTER_TIMEOUT_MS`.
- Ten seconds is an observability/performance target, not a fallback trigger.
- Concurrent or duplicate next-event requests must converge on one authoritative event; late responses cannot overwrite it.
- Existing Next.js, Prisma/PostgreSQL, authentication, server-owned game rules, OpenRouter integration, data ownership, and security boundaries remain unchanged.

### Remaining Ambiguities
- The exact race path causing the overwrite must be established from code and tests.
- Generation latency should be profiled to separate provider time from avoidable sequential validation/retry work.

## Round 2

### Questions Asked
1. How should losing duplicate requests respond after another request has already committed an event?
   > Return the already committed authoritative event instead of creating another event or returning an error.

2. What should the player see when AI generation times out or otherwise fails before an event is committed?
   > Do not expose a separate error. Show a validated static fallback and continue gameplay; record the reason and timing internally.

3. What timeout configuration and performance measurement rules should apply?
   > Use a 30-second default, clamp accepted configuration to 5-120 seconds, and fall back to 30 seconds for invalid values. Avoid unnecessary sequential retries, commit/display the first valid AI response immediately, log generation over 10 seconds as a performance observation rather than failure, and use mocked provider latency for deterministic transition tests.

### Decisions Made
- The server transition is `no active event -> generating -> one committed active event -> player choice submission -> no active event`; only the choice submission may clear/advance the committed event.
- Requests arriving while or after another request commits must return the authoritative committed event and must not mutate it.
- Provider failure before commit yields a validated fallback without a player-visible error.
- `OPENROUTER_TIMEOUT_MS` accepts 5,000-120,000 ms; missing, non-numeric, or out-of-range values use 30,000 ms.
- Measure provider duration and total generation duration. Durations above 10,000 ms are logged as slow but remain successful.
- Automated tests mock provider latency and cover pre-commit failure, post-commit immutability, choice-controlled advancement, and duplicate request ordering.
- Frequently observed choice-generation failures are in scope. The implementation must distinguish transport, JSON parsing, event schema, choice schema, and choice-quality failures; verify whether a valid narrative is being discarded because choices fail; and avoid unnecessary full-event regeneration while still requiring 2-4 valid player-agency choices.

### Remaining Ambiguities
- None at the requirements level. Root-cause details remain an implementation investigation.

## Summary
Fix the event lifecycle so an already generated event cannot be replaced by timeout fallback or a late duplicate response. Preserve the current 30-second AI timeout as a configurable default, treat 10 seconds as a performance objective, and reduce avoidable generation latency without weakening validation or fallback safety.
