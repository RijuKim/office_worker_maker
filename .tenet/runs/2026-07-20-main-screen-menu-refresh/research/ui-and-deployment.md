# UI And Deployment Research

Confidence: `[scanned-not-verified]`

## What was researched

- Existing Next.js and Toss mini-app header, menu, settings, age input, persistence, and validation paths.
- Current build and deployment commands.
- Official Apps in Toss update flow and Vercel production deployment behavior.

## Existing code findings

- The Next.js screen currently renders a fixed `app-top-chrome` with separate menu and settings buttons, while its create header separately renders the title (`app/page.tsx`, `app/globals.css`).
- The Next.js menu contains progress/new-story, records, new simulation, account/login-save, and privacy. Audio settings live in a separate popover and persist under `sano-audio-settings` (`app/page.tsx`).
- The Toss mini-app has separate menu/settings buttons and a hero eyebrow/title. Its settings persist under `sano-toss-audio` (`apps/toss-miniapp/src/App.tsx`).
- Main age choices currently cover 18-35, Toss uses an unrestricted number input, and server validation caps age at 35 (`app/page.tsx`, `apps/toss-miniapp/src/App.tsx`, `lib/game/validation.ts`).
- Character foundation already includes exact age in initial event narrative/context and classifies ages 25+ as older (`lib/game/character-foundation.ts`). Extending the validation boundary therefore does not require a schema migration.
- Required scripts exist for Next.js build, production-targeted Toss build, AIT packaging/deploy, lint, typecheck, and Vitest (`package.json`, `apps/toss-miniapp/package.json`).

## External deployment findings

- Vercel production deployment is explicitly targeted with the production CLI option; deployment must be inspected before considering the production alias updated.
- Apps in Toss updates require building/uploading a new `.ait` bundle. Upload alone does not make it public: review, approval, and the console's release action are separate platform steps.
- AIT CLI supports token-based upload; absence of a configured token is an external-access blocker rather than a product-code failure.

## Recommended approach

1. Replace the redundant fixed brand/settings chrome with one title-row menu trigger and one combined menu/settings panel in both apps.
2. Preserve existing local-storage keys and defaults; sanitize corrupt stored settings to booleans.
3. Use inclusive 18-80 controls in both clients and server validation; reject API values outside the range.
4. Verify age reaches event context at 18, middle age, and 80, and that fallback/event generation remains valid without live LLM calls.
5. Run deterministic UI/unit tests, both production builds, then deploy Vercel production. Build and upload the Toss `.ait` when credentials exist; report the remaining review/release step rather than claiming it is publicly released.

## Limitations

- Browser/Playwright exploration depends on local port binding and available browser tooling.
- Apps in Toss publication cannot be completed solely by uploading a bundle if platform review/approval or console release action is required.
