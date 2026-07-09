# Event Pipeline Research

Confidence: [scanned-not-verified]

## What Was Researched

The run needs to add event validation, diversity scoring, retry/fallback behavior, and a log adapter without changing database schema or provider architecture.

## Existing Pipeline Findings

- `app/api/characters/[id]/events/next/route.ts` is the non-streaming next-event route. It loads character state, derives life stage, builds a selection context, selects a static candidate via `selectNextEvent`, optionally calls `generateAiEvent`, then persists an `Event`.
- `app/api/characters/[id]/events/next/stream/route.ts` is the streaming route. It shares the same broad pipeline, but calls `generateAiEventStream` first, emits `body_delta`, may fall back to non-streaming `generateAiEvent`, and sends `replace_body` if the final body differs.
- Both routes already call `deriveLifeStageState` from `lib/game/life-stage.ts`, `selectNextEvent` / `isEventAllowedForLifeStage` from `lib/game/event-engine.ts`, OpenRouter/Ollama helpers from `lib/game/openrouter.ts`, and project logger from `lib/server/logger`.
- `buildDiversityGuidance` already exists locally in both next-event routes, but it only produces `avoidCategories`, `preferCategories`, and `avoidPeople` for prompting. It does not validate final candidates or assign a pass/fail diversity score.
- `lib/game/openrouter.ts` normalizes AI event choices. `normalizeChoice` clamps health deltas to minimum `-1`, but mental deltas can still be lower than `-1`. Event/result/ending text is not comprehensively validated for numeric stat exposure here.
- `app/api/characters/[id]/choices/route.ts` builds immediate crisis endings and final endings using `generateAiEnding`, then sanitizes generated text through `sanitizeResultText`. This is the right hook for numeric-stat text sanitization/validation in endings and selection-result-adjacent records.
- `tests/unit/api/event-engine.test.ts` already covers static event structure, no direct pass/fail strategy choices for career gates, proposal non-repetition after contest accepted/declined, and dropout routing away from ordinary campus life.

## Recommended Approach

- Add a new pure module under `lib/game/event-quality.ts` for validator, diversity scorecard, constants, and log payload construction. Keep it framework-independent and unit-testable.
- Add a small `lib/server/event-quality-log.ts` adapter that writes structured objects through `logger` or `console`, without DB writes.
- Integrate the quality module into both next-event routes after AI/static candidate selection and before persistence.
- For streaming route, keep body streaming unchanged for first AI attempt, but use `replace_body` when a retry or fallback replaces the streamed proposal.
- Reuse `isEventAllowedForLifeStage` but add more explicit hard-failure reasons around academic conflict, direct-result labels, malformed choices, numeric stat exposure, and health/mental delta policy.

## Limitations

- Because streaming may show text before final validation, users may briefly see an invalid AI draft before replacement. This matches current streaming architecture and is acceptable for this slice.
- Without DB logging, log delivery is best-effort only. The adapter shape preserves future transport compatibility.
