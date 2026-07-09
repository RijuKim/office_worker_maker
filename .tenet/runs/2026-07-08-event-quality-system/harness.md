# Event Quality System Harness

## Formatting And Linting

- Use existing TypeScript style.
- Build gate: `npm run build`.
- Test gate: `npm test`.
- Do not introduce new formatting tools.

## Testing

- Unit tests must cover `lib/game/event-quality.ts` or equivalent pure module.
- Update route-level/unit tests where practical for next-event fallback behavior.
- Existing `tests/unit/api/event-engine.test.ts` behavior must remain passing.
- Add tests for numeric stat exposure in result/ending sanitization.
- Playwright is optional for this slice because the visible UI does not add new controls; browser verification can be skipped with reason if unit/build coverage passes.

## Architecture Rules

- Server owns event authority. AI output remains a proposal.
- Quality validation must happen before committing an `Event`.
- Quality module must be pure and not import Prisma, Next.js route types, or provider clients.
- Log adapter may import server logger but must not write to the database.
- Next-event streaming and non-streaming routes should share the same quality policy as much as possible.
- Keep tunable constants in one exported object.

## Code Principles

- Prefer deterministic validation over broad prompt-only fixes.
- Preserve legitimate continuity; do not flatten the story into unrelated random events.
- Preserve lifecycle accuracy: accepted participation may later become low participation, quit, expelled, completed, or closed.
- Reject adjudicated result choices; player chooses strategy/action, code decides pass/fail.
- Reject adjudicated lifecycle outcome choices; player can voluntarily quit, but forced expulsion/removal must be a consequence, not a chosen button.
- Fail open to playable fallback, never to invalid committed state.

## Danger Zones

- Do not edit `.tenet/project/**`.
- Do not edit `.tenet/.state/**`.
- Do not create Prisma migrations for this run.
- Do not change auth/session files unless a test proves event-quality work cannot proceed otherwise.
- Do not alter provider API keys or Vercel environment variables.

## Iron Laws

1. No invalid event may be committed after a hard validator failure.
2. At most one additional AI retry per next-event request.
3. Static fallback must not perform network calls.
4. Health/mental single-choice drops greater than 1 are forbidden for ordinary AI events.
5. Numeric stat values must not appear in narrative result surfaces.
6. Closed participation threads must not be treated as active just because they were once accepted.
7. Player-facing choices must not directly choose forced expulsion, failure, rejection, pass, or acceptance outcomes.
8. Existing event progression and forced burnout behavior must remain intact.

## Project Doctrine Boundary

Normal implementation jobs must not edit `.tenet/project/**`. If implementation reveals stale doctrine, write a proposal under `.tenet/runs/2026-07-08-event-quality-system/journal/`.

## Evaluation Expectations

- Eval should be sequential if tests share mutable DB/session state.
- Interaction-e2e may be marked not applicable or optional for slice 1 if no browser-visible controls change.
- Code critic should focus on pre-commit validation, retry/fallback consistency, and no schema/auth drift.
