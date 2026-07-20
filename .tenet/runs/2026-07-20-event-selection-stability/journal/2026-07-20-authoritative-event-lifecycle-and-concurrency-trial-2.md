# Authoritative event lifecycle and concurrency — remediation trial 2

Confidence: [implemented-and-tested]

## Delivered behavior

- Choice consumption resolves only the `ACTIVE` event whose ID equals `CharacterRun.currentEventId`; newer orphan `ACTIVE` rows are ignored.
- Character GET recovery exposes only the pointer-selected event.
- Shared stateful route tests overlap fresh JSON and SSE generation from a null pointer and verify one identical authoritative payload, one pointer, one `ACTIVE` winner, and a non-active loser.
- Failed-CAS tests cover JSON 400 and SSE error semantics after winner consumption, preserve newer choice flags, and prove no late candidate resurrection.
- Existing committed AI, STATIC, and FORCED fixtures are genuinely ineligible (dropout state plus academic event) and remain immutable.
- Unauthenticated/non-owned next-route behavior and authenticated choice history/resolve/clear behavior are covered.
- The Vitest acceptance file was relocated out of Playwright discovery without changing its assertions.

## Exact verification evidence

- Focused authority/remediation suite: **5 files, 22 tests passed**.
- Relocated and existing event-quality suites: **2 files, 22 tests passed**.
- Playwright discovery: **46 tests in 4 files listed successfully** (desktop and mobile projects).
- `npm run lint`: passed with **0 errors, 15 pre-existing warnings**.
- `npm run typecheck`: passed.
- `npm run build`: passed; Next.js compiled and generated all routes.
- Full `npm test -- --run`: **22 files, 224 tests; 218 passed, 6 unrelated failures** in `life-stage.test.ts` (4), `destination-synthesis.test.ts` (1), and `home-page.test.tsx` (1).
- Server smoke: attempted both `0.0.0.0:3000` and `127.0.0.1:3100`; this worker sandbox rejects socket binding with `listen EPERM`, so an HTTP probe could not run. The production build and route-level request tests passed.
