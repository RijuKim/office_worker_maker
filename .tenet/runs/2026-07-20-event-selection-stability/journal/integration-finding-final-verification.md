# Integration finding final verification

Date: 2026-07-21 (Asia/Seoul)
Confidence: [implemented-and-tested]
Scope: verification-report retry; no product code or tests modified
Overall: **FAIL — evidence mismatch** (the focused command passed 4 files but ran 37 tests, not the expected 32)

## Interaction E2E classification

- Surface: `web_ui` (with server API)
- Harness policy: Layer 1 is the required automated mocked route/unit coverage. Browser Layer 2 is optional when authenticated database/startup fixtures are unavailable; the interaction worker must then probe the public route/test surface through the shell.
- Layer 2 status: `skipped_no_mcp`
- Scripted result: required focused route/unit tests passed, 4 files and 37 tests; the full Vitest suite passed, 25 files and 318 tests.
- Exploratory fallback: production UI source inspection found no prototype-only duplicate-request explanatory text. A built-runtime probe with `npm start` was attempted, but this restricted worker could not bind `0.0.0.0:3000` (`listen EPERM`), so authenticated browser/API interaction was unavailable. The required mocked route-level tests still exercised the JSON/SSE authority, recovery, concurrency, fallback, invalid-provider, and choice-advance paths.
- Screenshots: none; browser Layer 2 was not available.

## Confirmed commits

All three requested commits resolve as commits and are ancestors of `HEAD` (`git merge-base --is-ancestor <commit> HEAD` exited 0 for each):

- `932b9827efd81d29998deb89aa4951664846bfdb` — `fix: restore full suite progression expectations`
- `932c2cee1973b9b02dbd07a115658dfb2604329b` — `fix: enforce five-event life-stage boundaries`
- `5233d40b737d3e84b27bd32767a303832b0c1466` — `test: prove fallback career precedence`

## Exact fresh command evidence

### Focused Vitest

Command:

```text
npx vitest run tests/unit/api/life-stage.test.ts tests/unit/api/destination-synthesis.test.ts tests/unit/home-page.test.tsx tests/unit/server/event-selection-stability.acceptance.test.ts
```

Result: exit code 0; **4 test files passed (4), 37 tests passed (37)**; duration 1.05 s. This does **not** match the job's expected 32 tests, so the verification retry has an `evidence_mismatch`. The run also emitted existing React warnings for a non-boolean `jsx` attribute and an update not wrapped in `act(...)`.

### Full Vitest

Command:

```text
npm test -- --run
```

Result: exit code 0; **25 test files passed (25), 318 tests passed (318)**; duration 2.43 s. Expected mocked-provider diagnostics appeared for timeout, rate-limit, missing key, API error, empty content, malformed JSON, and SSE in-band errors. The existing React warnings also appeared.

### Typecheck

Command:

```text
npm run typecheck
```

Result: exit code 0; `tsc --noEmit` passed with no diagnostics.

### Lint

Command:

```text
npm run lint
```

Result: exit code 0; ESLint completed with **0 errors and 15 warnings**.

### Production build

Command:

```text
npm run build
```

Result: exit code 0; Prisma Client 7.8.0 generated in 82 ms, Next.js 16.2.10 compiled successfully in 1645 ms, TypeScript finished in 2.7 s, and **11/11 static pages** were generated in 81 ms. The existing Next.js middleware-convention deprecation warning appeared.

### Public runtime fallback probe

Command:

```text
npm start
```

Result: exit code 1; the restricted worker denied the listen operation: `listen EPERM: operation not permitted 0.0.0.0:3000`. No application crash or behavioral finding was inferred from this sandbox limitation.

## Scope confirmation

Before and after verification, each of the following produced no output:

```text
git diff -- .tenet/project
git diff --cached -- .tenet/project
git status --short -- .tenet/project
```

Therefore **`.tenet/project/**` is unchanged**. No product code or tests were modified by this retry. The only intended job edit is this current-run journal artifact.
