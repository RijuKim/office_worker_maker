---
delivery_mode: agile
---

# Event Quality System Spec

## Purpose

Improve perceived narrative quality in the Korean college/job-prep simulation by validating generated events before commit, reducing stale repetition without breaking legitimate continuations, and preventing stat-number leakage in event/result/ending copy. AI remains a proposal source; server-owned rules decide whether content is accepted, retried once, or replaced with safe fallback.

## Tech Stack

| Area | Choice |
|---|---|
| Framework | Next.js 16.2.10 App Router |
| UI/runtime | React 19.2.7, TypeScript 6.0.3, Node >=20.9 |
| Data | PostgreSQL with Prisma 7.8.0 |
| Auth | NextAuth 4.24.14, existing email/password flow |
| Validation | Zod 4.4.3 where applicable; pure TypeScript for event quality scoring |
| Testing | Vitest 3.2.4 for unit/API tests; Playwright 1.55.1 optional for browser acceptance |
| Deployment | Vercel production with existing environment variables |

Existing code references:
- Non-stream event generation route: `app/api/characters/[id]/events/next/route.ts`.
- Streaming event generation route: `app/api/characters/[id]/events/next/stream/route.ts`.
- Static event selection and life-stage allowance: `lib/game/event-engine.ts`.
- Life-stage derivation: `lib/game/life-stage.ts`.
- AI event and ending normalization/generation: `lib/game/openrouter.ts`.
- Choice/result/ending creation: `app/api/characters/[id]/choices/route.ts`.
- Existing logger: `lib/server/logger`.
- Current unit coverage for event engine: `tests/unit/api/event-engine.test.ts`.

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/characters/[id]/events/next` | Required | Generate a non-streaming next event. Must validate candidate events before persistence and use retry/fallback policy. |
| POST | `/api/characters/[id]/events/next/stream` | Required | Generate a streaming next event. Must validate final candidate before persistence; if streamed draft is replaced, emit `replace_body`. |
| POST | `/api/characters/[id]/choices` | Required | Apply choice effects and generate result/ending records. Must prevent numeric stat exposure in final result text and ending records. |

No new public endpoint is required.

## Database Schema

No migration is allowed in this slice.

| Entity | Columns Used | Constraints |
|---|---|---|
| `CharacterRun` | `id`, `userId`, `academicStatus`, `currentGradeYear`, `coreEventCount`, `currentEventId`, `major`, `age`, `name` | Existing rows only; no schema changes. |
| `HiddenState` | `burnoutRisk`, `eventFlags`, `familyState` | Existing JSON flags used to detect closed proposals and continuity. |
| `Event` | `title`, `body`, `choices`, `tags`, `source`, `status`, `safetyChecked` | Persist only events that pass quality validation or safe fallback selection. |
| `EventHistory` | `summary`, `relationshipDelta`, `event.tags`, `event.title` | Recent history drives repetition scoring. |
| `CharacterStats` | public stats | Read-only during event quality validation; choice effects still happen in existing choice route. |
| `CareerRecord` | narrative fields | Existing record creation must sanitize numeric stat exposure before save. |

## Design Direction

This run does not add new player controls. It changes the content quality behind the existing text-adventure play surface described in `.tenet/project/design.md`. Visual artifacts for the agile plan live under `.tenet/runs/2026-07-08-event-quality-system/visuals/` and describe the event-quality flow rather than a new UI screen.

## Auth Flow

1. User opens the app with an anonymous or authenticated current run, as currently implemented.
2. Protected routes call `requireCurrentUserId()`.
3. If no user is available, routes return the existing Korean login-required error.
4. If user owns the character, routes load state and run event quality checks.
5. Auth/session behavior must not be modified.

## Event Quality Contract

### Event Thread Lifecycle

Events and proposals are thread-like opportunities, not permanent switches. A proposal or activity can be:

- `offered`: the player has seen the proposal but has not committed.
- `accepted`: the player joined or agreed to participate.
- `active`: the activity is currently meaningful and may produce follow-up events.
- `low_participation`: the player accepted but is not meaningfully participating; follow-ups should be warnings, consequences, or closure decisions, not the same invitation again.
- `quit`: the player voluntarily left.
- `expelled`: the player was forced out due to low participation, conflict, failure, or reputation.
- `completed`: the activity ran its course.
- `closed`: a terminal state for rejected, quit, expelled, completed, or otherwise unavailable threads.

Implementation may represent these states through existing `eventFlags` and inferred history; no new DB schema is allowed. Closed threads remain available as past history and consequence, but the same offer must not be reintroduced as if it were new or active.

Player agency rule: players choose actions and commitments, not adjudicated outcomes. Valid choices include continuing to participate, apologizing, asking for feedback, reducing commitment, voluntarily quitting, or changing strategy. Forced removal, expulsion, pass, fail, acceptance, and rejection by an institution/group/company are server/AI/state consequences based on prior participation, conflict, reputation, or other state. A player-facing choice must not say the player chooses to be expelled, fail, pass, or be rejected.

### Validator Result

The core module returns:

```ts
type EventQualityVerdict = {
  status: "pass" | "fail";
  hardFailure: boolean;
  reasons: string[];
  diversityScore: number;
  continuityExemptions: string[];
  retryRecommended: boolean;
  fallbackRecommended: boolean;
};
```

### Hard Failures

Hard failures bypass score and trigger retry/fallback:

1. **Academic conflict**: DROPPED_OUT/dropout event proposes ordinary enrolled campus life such as lectures, class assignments, semester classes, or normal student club obligations. Allowed exceptions: dropout paperwork, alumni/re-entry contact, outside study, non-enrolled life.
2. **Direct adjudicated result choice**: choice labels such as `합격한다`, `불합격한다`, `통과한다`, `떨어진다`, `서류 합격을 선택한다`, or equivalent direct pass/fail commands.
3. **Direct lifecycle outcome choice**: choice labels that make the player directly choose forced expulsion/removal/rejection, such as `퇴출된다`, `강제로 나간다`, `탈락한다`, or equivalent adjudicated outcome commands. Voluntary quit choices are allowed when phrased as the player's own action.
4. **Closed proposal repeat**: proposal already rejected, quit, expelled, completed, or explicitly closed is asked again as the same offer without new consequences.
5. **Malformed event/choices**: event lacks title/body/tags, has fewer than 2 or more than 4 choices, choice lacks meaningful label/summary/statDelta/relationshipDelta-compatible shape, or deltas are not objects.
6. **Health/mental delta violation**: ordinary AI event choice has `health < -1` or `mental < -1`. Forced crisis/burnout events selected by server rules are exempt.
7. **Numeric stat exposure**: event body, choice result, job pass/fail result, or ending narrative includes explicit stat-number phrasing such as `건강 6`, `학점 10`, `네트워크 3`, `academic: 7`.

### Diversity Scorecard

Default constants must be centralized:

```ts
recentEventLookback = 5;
strongRepeatLookback = 3;
hardRetryThreshold = 60;
```

Scoring starts at 100. Repetition penalties apply to recent people, tags/categories, places/activities, and same-proposal patterns. Continuity exemptions reduce or cancel repetition penalties when the candidate clearly advances one of:

- active `openThread`
- `careerGate`
- active `jobApplication` process stage
- in-progress `spec`
- active participation in a joined activity that has not been quit, expelled, completed, or closed
- relationship shift
- direct follow-up to the previous choice

Examples:
- Fail/retry: recent five events already include three study/library/class events, and candidate is another ordinary study event with the same person and no new stage/conflict/relationship shift.
- Pass with continuity exemption: contest application advances to team formation, submission, presentation, or result.
- Pass with continuity exemption: club/study participation advances to low-participation warning, quit decision, expulsion consequence, or completion result.
- Pass with continuity exemption: job application advances from document screening to personality test, coding test, interview, final interview, or result.
- Hard fail: rejected, quit, expelled, completed, or closed contest/club/study offer is asked again as the same participation offer.

### Retry And Fallback

1. Candidate generated.
2. Validator runs locally, target under 20ms.
3. If pass, persist.
4. If fail and candidate source is AI, retry AI once with validation reasons and diversity guidance.
5. If retry fails or still fails validation, use safe static fallback with no network call.
6. If static fallback unexpectedly fails validation/construction, do not commit invalid state. Return existing recoverable route error and log reason `fallback_failed`.
7. Do not increase AI timeout or daily limit.

### Log Adapter

Add adapter function, without DB writes:

```ts
recordEventQualityLog({
  characterRunId,
  eventId,
  phase,
  source,
  verdict,
  reasons,
  diversityScore,
  continuityExemptions,
  retryUsed,
  fallbackUsed,
  selectedFallbackTitle,
  durationMs,
  createdAt,
});
```

`phase` is one of `initial_ai`, `retry_ai`, `static_fallback`, `ending`, `choice_result`.

## Success Criteria

1. A dropout character cannot persist a normal enrolled campus-life event from AI; the system retries once or falls back to a school-outside event.
2. AI events with direct pass/fail choice labels are rejected before persistence.
3. A repeated closed proposal is rejected, but a legitimate multi-step contest/job/spec follow-up passes with continuity exemption.
4. Accepted activities can later become low participation, quit, expelled, completed, or closed through flags/history; once closed, the same offer is not treated as active.
5. Ordinary AI choices cannot reduce health or mental by more than 1 in a single choice.
6. Event body, choice result text, job result text, and ending text do not expose numeric stat values after processing.
7. Validator and diversity scorecard are pure and unit-tested.
8. Next-event routes log structured quality verdicts through the adapter.
9. Existing tests and `npm run build` continue to pass.

## Out of Scope

- No Prisma migration or new DB log table.
- No auth/account/session changes.
- No provider architecture rewrite and no timeout increase.
- No new player-facing spec/job-prep UI in this slice.
- No exact log transport integration with the separately deployed logging system.
- No real-company data changes.

## Slice plan

Total slices: 2

### Slice 1: Event Validation And Diversity
- **Adds**: Server-side event validator, repetition scorecard, event-thread lifecycle closure rules, one-retry AI policy, safe static fallback, and structured quality logs for next-event routes.
- **Bundled with**: Pure unit tests for hard failures, diversity scoring, continuity exemptions, and next-event fallback behavior.
- **User can**: Play through next events with fewer incoherent or stale repeated situations while legitimate follow-up arcs still continue.
- **Out of slice**: Ending/result numeric-stat sanitization beyond event candidates; spec/job-prep UI panels.

### Slice 2: Result And Ending Text Guard
- **Adds**: Numeric stat exposure guard for choice result copy, job pass/fail result copy, and AI/fallback ending narratives.
- **Bundled with**: Unit tests for sanitizer/validator examples and integration coverage around generated records.
- **User can**: Reach pass/fail results or endings without seeing awkward stat-number phrasing in narrative text.
- **Out of slice**: New result UI, new career/spec dashboard, DB-backed quality logs.

## Redirect at slice 1 (2026-07-08T17:00:00+09:00)

User feedback: Before implementation, add event lifecycle handling. Events can be accepted but later become low participation, quit, or forced expulsion. In those terminal cases the event should remain in history but close so it stops recurring as an active offer.

Affected slice(s): 1 onwards

Plan impact: Slice 1 now includes thread lifecycle inference/closure rules as part of event validation and repetition scoring. Slice 2 remains focused on numeric stat exposure in results/endings.
