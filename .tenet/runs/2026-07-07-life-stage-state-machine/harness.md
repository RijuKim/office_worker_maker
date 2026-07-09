# Harness: Life Stage State Machine

## Formatting & Linting

- TypeScript/React code must pass `npm run build`.
- Existing lint config remains available as `npm run lint`; use when touching broad UI/code style.
- Use ASCII for new code unless existing Korean narrative/copy requires Korean text.

## Testing

- Unit tests: `npm test -- --run tests/unit/api/game-rules.test.ts tests/unit/api/event-engine.test.ts tests/unit/home-page.test.tsx`.
- Add focused unit tests for `lib/game/life-stage.ts` when introduced.
- Add or update event-engine tests for state-gated event selection.
- Add UI test coverage when progress labels/record labels change.
- Browser e2e is useful but optional for Slice 1 if unit/build coverage verifies the public surface; interaction critic may inspect UI with Playwright if available.

## Architecture Rules

- Server owns game state. Client renders and submits choice indices only.
- New Slice 1 state must route through a dedicated helper module, expected path `lib/game/life-stage.ts`.
- No Prisma migration in Slice 1; use existing JSON fields.
- Do not scatter transition rules directly across UI and API files.
- AI may suggest but never authorizes state transitions.
- All character reads/mutations remain current-user scoped.

## Code Principles

- Prefer additive compatibility for existing saves.
- Prefer explicit typed helpers over ad hoc JSON access.
- Keep event choices as strategy/attitude choices; avoid direct result labels for gates.
- Fallback behavior must remain playable if OpenRouter fails.
- Keep Korean UI copy concise and story-forward.

## Danger Zones

- Do not edit `.tenet/project/**`.
- Do not commit `.tenet/.state/**`.
- Do not expose `.env.local` or server-only OpenRouter credentials.
- Do not use real company names or real-world allegations.
- Do not introduce destructive database migrations in Slice 1.

## Iron Laws

- Auth-required character APIs must call `requireCurrentUserId()` and scope by `userId`.
- Public stats remain 1-10.
- `burnoutRisk` remains hidden 0-100.
- Named destination endings require prior destination/process state.
- Record UI must not display A/B/C, GOOD ROUTE, MIXED ROUTE, or HARD ROUTE.
- Invalid or corrupt life-stage JSON must fall back to derived state, not crash gameplay.

## Project Doctrine Boundary

Normal implementation jobs must not edit `.tenet/project/**`. Proposed doctrine updates belong in `.tenet/runs/2026-07-07-life-stage-state-machine/journal/`.
