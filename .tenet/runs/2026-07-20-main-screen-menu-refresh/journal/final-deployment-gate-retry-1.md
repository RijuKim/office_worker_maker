# Final deployment gate retry 1

Status: **FAIL** (`[verified-2026-07-21]`)

No UI changes were made and no deployment was attempted.

## Green gates

- Scoped Toss component test: `npx vitest run tests/unit/toss-miniapp/App.test.tsx` — 25/25 passed.
- Full test suite: `npm test -- --run` — 28 files, 381/381 tests passed.
- Typecheck: `npm run typecheck` — passed.
- Lint: `npm run lint` — passed with zero errors and 15 existing warnings.
- Next production build: `npm run build` — passed; all routes built.
- Toss production build: `npm run toss:build:production` — passed.
- Source-label fix: commit `88d79dd` is HEAD and contains the scoped `App.tsx`/`App.test.tsx` change.
- Review PNGs exist at the required exact dimensions: 636x1048 and 1504x741.

## Blocking gate

`npx playwright test -c tests/acceptance/toss-restoration.playwright.config.ts` failed on two fresh consecutive runs. In both runs, the single desktop test timed out after 30 seconds at `tests/acceptance/toss-restoration-review.spec.ts:65`: Playwright resolved the visible `시작하기` button, but the element detached while the click action was waiting for stability. The captured error snapshot already showed restored gameplay (`첫 면접 제안`), demonstrating that asynchronous restoration replaced the onboarding button during the action. This makes the scoped acceptance gate nondeterministic and currently red.

## Environment-limited checks

- `npx prisma migrate status` loaded the Neon datasource but returned Prisma `P1001` because this worker sandbox could not reach the Neon host on port 5432. The orchestrator-provided evidence says the preceding deploy applied all five migrations, but this retry could not independently refresh that status.
- `npm run start -- --hostname 127.0.0.1 --port 3100` could not bind because the worker sandbox returned `listen EPERM`. The Toss acceptance runner did successfully start/render its Vite surface before reaching the behavioral race above.

## Exact blocker

The deployment gate cannot return PASS while the required scoped Playwright test reproducibly times out on the onboarding-to-restored-gameplay transition. A follow-up should make the acceptance setup wait for restoration to settle (or explicitly select a deterministic initial state) before deciding whether to click `시작하기`, then rerun the full gate in an environment with Neon access and local port binding.
