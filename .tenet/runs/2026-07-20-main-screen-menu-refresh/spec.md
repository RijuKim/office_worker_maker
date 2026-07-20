---
delivery_mode: autonomous
---

# Main Screen And Menu Refresh Specification

## Purpose

Refresh the Next.js and Toss entry experiences for a non-game release: remove redundant top chrome, align one combined menu with the two-line title, introduce an immersive step-by-step character onboarding flow, expand age support to 18-80, and deploy verified builds.

## Tech Stack

- Next.js 16.2.10, React 19.2.7, TypeScript, and existing CSS/pixel-art components (`package.json`, `app/page.tsx`, `app/globals.css`).
- Toss mini-app with React 19.2.7 and Vite 7.3.6-compatible build (`package.json`, `apps/toss-miniapp/src/App.tsx`, `granite.config.ts`).
- Zod validation and existing character/event services (`lib/game/validation.ts`, `lib/game/character-foundation.ts`).
- Vitest 3.2.4; Vercel linked project `sano-officeworker`; Apps in Toss appName `sano-officeworker`.

## UI Contract

1. Both apps show `일어나보니` and `대한민국 취준생` as two explicit title lines.
2. The redundant `취준 / 취준 생활 시뮬레이션` chrome and separate settings control are removed.
3. One menu button sits at the upper-right of the title row. At 721px+ its panel is anchored right; at 720px and below it fills available content width without horizontal overflow.
4. Menu navigation and settings rows share identical 14px, weight-800 typography and at least 44px target height.
5. Existing navigation remains, except the duplicate `새 이야기` action is absent. `새 시뮬레이션` remains.
6. `배경음`, `효과음`, and `햅틱` live in the same menu. Existing local-storage keys/defaults remain. Invalid stored settings reset safely.
7. New-run onboarding is sequential: intro → name → age → residence → two preferred abilities → submit. Only one question is visible per step, with previous/next controls and no artificial delay.
8. Age exposes every integer 18 through 80 inclusive. Residence stays exactly `본가`, `자취방`, `기숙사`; selection is conveyed visually/semantically without a visible `선택됨` prefix.
9. The intro reuses/refines existing pixel art into a brighter blue-lilac/apricot 6:07 AM dawn. No emoji and no cross-like shape above the right-side computer.
10. Intro and disclaimer copy are byte-for-byte as recorded in `interview.md` Round 7 and `visuals/2026-07-20-04-prototype-menu-flow-revision-5.html` except implementation markup.

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/characters` | Existing session/guest contract | Accept character creation with integer age 18-80 and existing residence/stat fields. |
| POST | `/api/characters/:id/events/next` | Character owner | Existing event generation; receives persisted character age through current selection context. |
| POST | `/api/characters/:id/events/next/stream` | Character owner | Existing streaming event generation and fallback behavior; unchanged public contract. |

## Database Schema

No migration is required. The existing character age column remains authoritative.

| Entity | Column | Type | Constraints |
|---|---|---|---|
| CharacterRun | `age` | existing integer | Creation API validates inclusive 18-80; existing persisted records remain readable. |
| CharacterRun | `residence`/flags | existing | Existing identifiers `family_home`, `studio`, `dorm` remain unchanged. |

## Design Direction

- Chosen mockup: `visuals/2026-07-20-01-mockup-compact.html`.
- Final behavior/art: `visuals/2026-07-20-04-prototype-menu-flow-revision-5.html`.
- Run delta: `design.md`; durable doctrine: `.tenet/project/design.md`.

## Auth Flow

1. Guest onboarding remains available without login.
2. Existing login/save action stays in the combined menu.
3. Authenticated users retain account and saved-run behavior.
4. No auth, cookie, password, session, or ownership logic changes.

## Deployment Contract

0. Vercel CLI authentication is confirmed in the current environment by successful `npx vercel ls` and production deployment inspection for the linked project. No token value is read or persisted.
1. Stop deployment on any focused/full test, typecheck, lint-error, Next.js build, or Toss production build failure.
2. Deploy the linked Vercel project explicitly to production only after gates pass; require status `Ready` and production alias inspection.
3. Build/package/upload the Apps in Toss artifact only when configured credentials permit. Upload is not equivalent to public release: platform review, approval, and console release remain external steps.
4. On deployment/inspection failure, report the failure and leave the previous production alias/release active.
5. Apps in Toss upload authentication is checked only by the existing AIT CLI credential store. Missing credentials explicitly downgrade Toss execution to verified production build/package plus a report of the external upload/review blocker.

## Success Criteria

1. At 390px and 1024px, both entry screens have no horizontal overflow and show a title-aligned upper-right menu.
2. Neither production UI contains the old top brand label, separate settings button/popover, visible `선택됨 ·`, or duplicate `새 이야기` action.
3. Opening the combined menu exposes preserved navigation followed by three same-typography settings rows; toggles persist after remount/reload and corrupt storage resets to defaults.
4. Onboarding displays one approved step at a time, supports previous/next navigation, preserves entered state, and submits only after valid completion.
5. The age control contains exactly 63 integer choices: 18, 19, …, 80. API validation accepts 18/80 and rejects 17/81.
6. Tests prove age appears in event/character context at 18, an intermediate age, and 80; provider failures continue to use existing validated fallback.
7. Residence choices and stored values remain exactly compatible with existing APIs.
8. Intro uses existing pixel-art implementation, approved copy/disclaimer, brighter dawn palette, no emoji, and no cross-like right-side element.
9. Focused tests, full 283+ Vitest suite, typecheck, lint with zero errors, Next.js production build, and Toss production build pass.
10. Vercel production deploy is Ready and the production alias responds; Toss artifact status is reported accurately.

## Out Of Scope

- Renaming the app/title beyond the approved line break.
- Changing character database schema, generated grade rules, auth, event authority, or career progression.
- Adding new audio libraries, network calls, LLM calls, analytics, or permission prompts.
- Claiming Apps in Toss public release before platform approval and explicit release.
