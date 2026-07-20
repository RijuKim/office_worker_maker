# Harness: Main Screen And Menu Refresh

## Formatting & Linting

- Run `npm run lint` and require zero errors; existing unrelated warnings may be reported.
- Run `npm run typecheck`.
- Avoid unrelated formatting churn.

## Testing

- Vitest unit/component/route tests are required for both app surfaces and shared validation.
- Focused tests must cover title/header/menu copy, sequential onboarding transitions/state retention, all 63 age choices, 18/80 acceptance, 17/81 rejection, residence compatibility, settings persistence/corruption, exact intro/disclaimer copy, and age propagation into event context.
- Run `npm test -- --run` and require all tests to pass.
- Run `npm run build` and `npm run toss:build:production`.
- Mock LLM/provider behavior; do not spend live quota or depend on nondeterministic generation.

## Interaction E2E Surface

- Surface: browser UI for Next.js plus Toss mini-app.
- Layer 1: required component and route tests.
- Layer 2: Playwright/browser exploration required when available; otherwise deterministic rendered DOM assertions at 390px/1024px plus build evidence may satisfy with the sandbox limitation documented.
- Check keyboard focusability, `aria-label`, `aria-expanded`, 44px targets, and horizontal overflow.
- Local Next.js runtime command is `npm run dev` on port 3000 with health URL `http://127.0.0.1:3000/`; Toss uses `npm run toss:dev` on port 5173 with `http://127.0.0.1:5173/`.
- Record whether Playwright/browser tooling and port binding are available. If sandbox binding fails, use rendered component DOM at 390px/1024px and record the exact limitation.

## Deployment Verification

- Vercel: explicit production deploy, `Ready` status, expected project/production target, production alias inspection, and HTTP success.
- Vercel access is preflight-confirmed by authenticated `npx vercel ls` and inspect calls in this workspace; never print underlying tokens.
- Toss: production build, `.ait` packaging/upload if credentials exist, then accurately report pending review/approval/release. Never expose deployment tokens.
- A failed deploy or alias inspection must not be described as success.

## Architecture Rules

- Reuse one menu/settings model or shared patterns; do not retain separate settings chrome.
- Preserve existing local-storage keys and server-owned validation.
- Do not add network/LLM calls for UI interactions.
- Existing event authority and fallback semantics remain untouched.

## Code Principles

- One visible onboarding question per step.
- Preserve inputs when navigating backward/forward.
- Required semantic fields are validated, not fabricated.
- Visible copy must be consistent Korean honorific speech.

## Danger Zones

- Do not edit `.tenet/project/**` or `.tenet/.state/**`.
- Do not modify auth/session/password behavior, Prisma schema/migrations, event authority, deployment secrets, or `.env*` values.
- Do not stage or commit unrelated dirty Toss/auth/assets files already present in the worktree.
- Do not replace existing pixel art with emoji or external image assets.

## Iron Laws

1. Age contract is inclusive 18-80 at UI and API boundaries.
2. Residence identifiers remain backward compatible.
3. The old top chrome, separate settings button, duplicate `새 이야기`, and visible `선택됨 ·` cannot ship.
4. No deployment occurs before all required gates pass.
5. Do not claim a Toss release that still awaits review/approval/release.

## Project Doctrine Boundary

Normal jobs must not edit `.tenet/project/**`; proposals belong in this run's `journal/`.
