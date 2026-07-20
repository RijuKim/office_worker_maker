# Decomposition: Main Screen And Menu Refresh

Model tier: frontier (Standard-mode default)
Delivery mode: autonomous

## ASCII DAG

```text
main-onboarding-and-menu
          │
          ▼
toss-onboarding-and-menu
          │
          ▼
integration-predeploy
          │
          ▼
production-deploy
          │
          ▼
integration-postdeploy
```

## Job Details

### main-onboarding-and-menu

- Type: `dev`
- Dependencies: none
- Deliverables:
  - Next.js title-aligned combined menu and removal of legacy chrome/duplicate copy.
  - Sequential honorific onboarding using approved dawn pixel art/copy.
  - Inclusive 18-80 UI/API validation and age-context regression coverage.
  - Existing residence/settings persistence compatibility.
- Verification: focused DOM/unit/route tests, typecheck, no unrelated edits.

### toss-onboarding-and-menu

- Type: `dev`
- Dependencies: `main-onboarding-and-menu`
- Deliverables:
  - Toss parity for header/menu/settings and sequential onboarding.
  - Exact age/residence/menu typography contracts.
  - Toss component tests and production build compatibility.
- Verification: focused Toss tests and `npm run toss:build:production`.

### integration-predeploy

- Type: `integration_test` (report only)
- Dependencies: `toss-onboarding-and-menu`
- Deliverables:
  - Run acceptance/focused/full Vitest, lint, typecheck, Next.js build, Toss production build.
  - Inspect 390px/1024px behavior or deterministic DOM fallback.
  - Confirm deployment is permitted only if every gate passes.

### production-deploy

- Type: `dev`
- Dependencies: `integration-predeploy`
- Deliverables:
  - Deploy linked Vercel project explicitly to production and confirm Ready.
  - Build/package/upload Toss artifact when credentials exist; otherwise report exact external blocker without claiming release.
  - Do not expose secrets or replace healthy production on failure.

### integration-postdeploy

- Type: `integration_test` (report only)
- Dependencies: `production-deploy`
- Deliverables:
  - Inspect production deployment/project/alias and HTTP response.
  - Confirm deployed UI copy/structure where reachable.
  - Report accurate Toss artifact/review/release status.

## Interface Contracts

- Onboarding state is client-owned until final submit and contains step, name, integer age, residence ID, and exactly two preferred stat IDs.
- Creation API remains server-owned and accepts integer age 18-80 with existing residence identifiers.
- Both apps preserve their existing local-storage keys and normalized `music/sfx/haptics` booleans.
- Deployment job consumes only a fully passing predeploy report and produces immutable deployment identifiers/status for postdeploy verification.

