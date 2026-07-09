# Interview: Event Quality System

Date: 2026-07-08
Mode: Full
Rounds: 4

## Mode Selection
- Prompt shown: Recommended Full because the work spans event generation, validation, retry/fallback behavior, logging adapters, and later UI quality systems.
- User response: Full로 가자
- Selected mode: full
- Selection basis: explicit_user_choice

## Clarity Score
- Goal: pending validation (weight 0.4)
- Constraints: pending validation (weight 0.3)
- Success criteria: pending validation (weight 0.3)
- **Total: pending / 0.8 required**

## Round 1

### Questions Asked
1. What should be the first successful scope for this Tenet run?
   > Use the recommended first scope: event validator, repetition prevention scorecard, and minimal log hook. Defer spec/job-prep UI strengthening to a later slice.

2. What should happen when an AI event fails validation?
   > Use the recommended policy: regenerate once, then use a safe static fallback that incorporates the validation reason if the retry still fails.

3. How deeply should logging be integrated?
   > The log system is being developed and deployed separately. Use the recommended adapter-style function, not a new DB model or migration.

4. Which hard-failure conditions must the validator block?
   > Block academic status conflicts, direct pass/fail choice commands, repeated closed proposals, excessive recent repetition, numeric stat exposure, health/mental delta rule violations, and malformed choices.

5. Should pass/fail results and endings also be checked for numeric stat exposure?
   > Yes. Selection result text, job pass/fail result text, and ending narratives must not expose numeric stat values.

6. Can security and integration scope be limited?
   > Yes. Do not touch auth/account/save structure, keep OpenRouter/Ollama call structure, avoid DB migrations, add only a log adapter, and focus tests on validation, diversity scoring, and AI fallback paths.

### Decisions Made
- Build an event quality system for the first slice: event validator, repetition prevention scorecard, retry/fallback behavior, and structured log adapter.
- Do not include spec/job-prep UI strengthening in this initial slice.
- Validation failure policy is one AI regeneration attempt, then safe static fallback.
- Logs are emitted through a local adapter function that can later connect to the separate deployed logging system.
- Numeric stat exposure is forbidden not only in event bodies but also in choice results, job pass/fail result copy, and AI/fallback ending narratives.
- No authentication, account, persistence, provider architecture, or database migration changes in this slice.

### Remaining Ambiguities
- Exact log transport for the separately deployed logging system is intentionally out of scope.
- Exact future spec/job-prep UI layout is intentionally out of scope.

## Round 2

### Questions Asked
1. Can repetition prevention use quantified defaults: recent 5 events, strong penalties for repeated characters within 3 events, repeated tags 3+ times within 5 events, diversity score below 60 triggers retry/fallback?
   > The user noted that events that are supposed to happen together may need repetition. Do not break legitimate continuations.

2. How should legitimate continuation be preserved?
   > Add continuity exceptions. Repeated people/tags/places are allowed when the event clearly advances an open thread, active career gate, job application, in-progress spec, relationship shift, or direct follow-up to the previous choice. Closed or rejected proposals must still be blocked.

3. Will validation and repetition scoring make event generation too slow?
   > The user is concerned about speed and accepts that real tuning requires playtesting.

### Decisions Made
- Repetition prevention is a scorecard, not a blanket ban.
- Lookback defaults are tunable constants, initially recent 5 events for diversity and recent 3 events for strong repeated-person/place/activity penalties.
- A diversity score below a hard threshold triggers one retry, but continuity exceptions reduce penalties or allow passage when there is genuine progression.
- Hard failures still override score and force retry/fallback.
- Closed/rejected/accepted completed proposals repeating as the same ask are hard failures.
- Performance requirements: validator and scorecard run locally, target under 20ms, no extra AI call when validation passes, at most one AI retry, fallback performs no network calls, and timeouts are not increased for this feature.

### Remaining Ambiguities
- Exact thresholds may need tuning after playtesting.
- The first slice should expose constants clearly enough to adjust without rewriting the event pipeline.

## Round 3

### Questions Asked
1. What are the pinned technical constraints for implementation?
   > Use the existing brownfield stack and deployment: Next.js 16.2.10, React 19.2.7, TypeScript 6.0.3, Prisma 7.8.0, PostgreSQL, NextAuth 4.24.14, Zod 4.4.3, Vitest 3.2.4, Playwright 1.55.1, Node >=20.9, Vercel production deployment. Preserve the existing OpenRouter/Ollama-compatible provider flow and the existing 10 second AI timeout doctrine.

2. What exact validator examples define hard failures?
   > Academic conflict: if academic status/life stage is DROPPED_OUT/dropout, an event body or choice that asks the character to attend lectures, submit school assignments, join normal semester classes, or continue ordinary campus enrollment fails unless it is explicitly about post-dropout paperwork, alumni contact, re-entry, outside study, or non-enrolled life.
   > Direct result choice: choices labeled "합격한다", "불합격한다", "통과한다", "떨어진다", "서류 합격을 선택한다", or equivalent direct pass/fail commands fail. Valid labels describe preparation, response, or strategy, not the adjudicated result.
   > Malformed choices: fewer than 2 or more than 4 choices, missing label/summary/statDelta/relationshipDelta, non-object deltas, or labels shorter than a meaningful command fail.
   > Health/mental delta: any single choice with health < -1 or mental < -1 fails unless it is an explicit forced crisis/burnout event already selected by server rules. Ordinary AI events must not exceed -1 for those stats.
   > Numeric stat exposure: event body, choice result, job result, and ending narrative fail if they include explicit stat-number phrasing such as "건강 6", "학점 10", "네트워크 3", "academic: 7", or comparable stat score copy.

3. What exact examples define diversity pass/fail with continuity exceptions?
   > Repetition failure: recent five events include three study/library/class tags and the candidate is another ordinary study event with the same person and no new decision, new stage, new conflict, or relationship shift; score below threshold and retry.
   > Continuity pass: recent events include contest/team tags and the candidate advances from application to team formation, submission, presentation, or result; repeated people/tags are allowed with reduced penalty.
   > Continuity pass: an active job application advances from document screening to personality test, coding test, interview, final interview, or result; company/job tags can repeat because the process stage changed.
   > Hard repetition failure: a proposal that was rejected, accepted and completed, or explicitly closed is asked again as the same offer without new consequences; retry/fallback regardless of score.

4. What exact failure behavior and log payload should be observable?
   > The quality check returns a verdict object with status "pass" or "fail", hardFailure boolean, reasons string[], diversityScore number, continuityExemptions string[], retryRecommended boolean, and fallbackRecommended boolean.
   > The log adapter receives characterRunId, eventId when available, phase ("initial_ai" | "retry_ai" | "static_fallback" | "ending" | "choice_result"), source, verdict, reasons, diversityScore, continuityExemptions, retryUsed, fallbackUsed, selectedFallbackTitle, durationMs, and createdAt.
   > If retry generation fails, fallback is selected without further network calls and a fallbackUsed log is emitted.
   > If fallback construction itself fails unexpectedly, the route should return the existing concise recoverable error behavior rather than committing invalid state, and log a fail verdict with reason "fallback_failed".

### Decisions Made
- This slice is constrained to the existing Next.js/Prisma/Vitest/Vercel stack and must not introduce a migration.
- Validator rules now have concrete test inputs and expected pass/fail outcomes.
- Diversity scoring includes exact failure and continuity-pass examples while leaving thresholds centralized as tunable constants.
- The log adapter schema is explicit and compatible with later transport to the separately deployed logging system.
- Observable behavior for retry failure and fallback failure is defined.

### Remaining Ambiguities
- Future tuning of thresholds is expected after playtesting, but the first implementation must be deterministic and testable.

## Round 4

### Questions Asked
1. At the initial agile plan checkpoint, the user redirected the plan with an event-lifecycle requirement.
   > 이벤트 사건들은 수락할 수도 있지만 참여율이 저조하거나, 특정 모임이나 활동을 그만두거나, 강제로 퇴출될 수 있다. 그러면 그 이벤트는 기록만 남기고 닫혀야 한다.

### Decisions Made
- Event quality must distinguish active participation from historical participation.
- Accepting a proposal does not mean that thread remains active forever.
- Accepted activities can later transition into low participation, quit, expelled, completed, or closed states.
- Closed threads remain usable as history, consequence, or characterization, but the same participation offer must not recur as if active.
- Repetition scoring and closed-proposal detection must account for quit, expulsion, low participation, and completion states.

### Remaining Ambiguities
- A dedicated UI for closed participation history is out of scope for this slice.

## Delivery Mode Decision
- Prompt shown: autonomous means one end-to-end run after pre-execution confirmation; agile means sliced delivery with plan and use checkpoints after each slice. Recommended agile because event quality is subjective and benefits from intermediate checks.
- User response: 그래 agile로
- Selected delivery_mode: agile
- Selection basis: explicit_user_choice

## Model Tier Decision
- Prompt shown: frontier uses fewer, larger goal-oriented jobs; local uses smaller, more explicit jobs. Recommended frontier.
- User response: frontier로
- Selected model_tier: frontier
- Selection basis: explicit_user_choice

## Summary
Implement the first agile slice of an event quality system for the college/job-prep simulation. The slice should prevent incoherent AI/static events, reduce repetitive characters/places/tags, retry AI generation once with targeted guidance, fall back safely when needed, and expose structured quality logs through an adapter. It must also prevent numeric stat exposure in event/result/ending copy. It must preserve existing auth, provider calls, database schema, and deployment assumptions.
