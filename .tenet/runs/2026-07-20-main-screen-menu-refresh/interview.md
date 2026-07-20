# Interview: Main Screen And Menu Refresh

Date: 2026-07-20
Mode: Standard
Rounds: 7

## Mode Selection
- Prompt shown: Six connected UI/behavior changes plus production deployment make Standard mode the recommended balance.
- User response: "응"
- Selected mode: standard
- Selection basis: explicit_user_choice

## Clarity Score
- Goal: 0.9 (weight 0.4)
- Constraints: 0.8 (weight 0.3)
- Success criteria: 0.8 (weight 0.3)
- **Total: 0.84 / 0.8 required (passed)**

## Round 1

### Questions Asked
1. Should the changes be applied consistently to both the main Next.js app and the Toss mini-app?
   > "응"

2. What minimum age should be selectable, with 18-80 recommended to preserve the job-seeker context?
   > "응 그렇게 하자"

3. Should existing menu actions remain, with background music, sound effects, and haptics added inside the same menu?
   > "응"

4. Should the title and menu share one row on mobile, with a width-aware panel below it, while desktop uses an upper-right dropdown?
   > "응"

5. Should settings persist locally and fail open, out-of-range stored ages clamp safely, age context reach AI/fallback generation, both apps be tested/built, and Vercel production remain unchanged if deployment fails?
   > "응"

### Decisions Made
- Remove the redundant sticky top branding row.
- Align the menu control to the upper-right of the main title row.
- Move background music, sound effects, and haptics into the menu and rename Lo-fi to 배경음.
- Remove the duplicate 새 이야기 action while retaining 새 시뮬레이션.
- Extend age selection through 80 and keep age-aware event generation valid.
- Remove the 선택됨 prefix from residence choice labels.
- Deploy to production after verification.
- Apply the same information architecture to both the Next.js app and Toss mini-app.
- Render the title with an explicit line break after `일어나보니`.
- Use an inclusive age range of 18 through 80.
- Preserve existing menu actions and add the three settings inside that menu.
- Use a title-aligned upper-right dropdown on desktop and a width-aware panel below the same title row on mobile.
- Persist settings locally; audio/haptics permission failures must not block gameplay.
- Accept ages 18 and 80, clamp previously stored out-of-range ages to the nearest boundary, and pass age context into AI generation.
- Verify static fallback copy remains age-appropriate at boundary ages.
- Require Next.js and Toss tests/builds before Vercel production deployment; a failed deployment must leave current production intact and be reported.
- Existing stack remains Next.js 16/React 19 for the main app and Vite/React for Toss; no auth, database schema, or API ownership changes are allowed.
- Pinned runtime/tool versions are Next.js 16.2.10, React 19.2.7, Vite 7.3.6-compatible, and Vitest 3.2.4 (`package.json`).
- Responsive breakpoint follows the existing main-app mobile boundary at 720px. The title always renders as two explicit lines: `일어나보니` then `대한민국 취준생`.
- Main menu order remains progress (only when a run exists), records, new simulation, account/login-save, privacy, then a settings group containing 배경음, 효과음, 햅틱. The separate settings button/popover is removed.
- Toss keeps its existing progress/new-start/records actions and adds the same settings group to its single menu. The separate settings button/popover and eyebrow branding are removed.
- Main settings persist for the browser lifetime under existing `sano-audio-settings`; Toss uses existing `sano-toss-audio`. Defaults remain music off, sound effects on, haptics on.
- Unsupported audio/haptics and permission failures are silent, non-blocking no-ops; no new player-facing error banner is introduced.
- Server validation changes from 18-35 to inclusive 18-80. Inputs below/above the range are rejected at API boundaries; only previously stored/displayed client values are clamped for safe rendering.
- Age must remain present in character foundation/event prompt context. Automated checks cover 18, a middle age, 80, and invalid 17/81 without requiring new provider calls.
- Required commands: focused Vitest for home/create validation/event prompt coverage, full `npm test -- --run`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run toss:build:production`.
- Production verification requires a Ready Vercel production deployment and successful inspection of the production alias. Deployment failure does not promote or replace the existing production deployment.
- No new scaling target is introduced; UI changes must add no network request and no LLM call.
- Supported layouts are current desktop browsers and Toss mobile WebView; 721px+ uses the anchored dropdown and 720px or below uses the full available-width panel. Interactive targets remain at least 44px high, the menu button exposes `aria-label`/`aria-expanded`, and focusable controls remain keyboard reachable.
- Menu and onboarding steps update on the next React render with no artificial delay or animation; interaction tests assert synchronous visibility changes rather than a wall-clock animation target.
- Reloading preserves valid audio settings. Corrupt or wrong-typed local settings reset to music off, effects on, and haptics on without showing an error.
- Build/test failure stops deployment. Existing AI failure behavior continues to use validated fallback and must not block onboarding. A failed production inspection is reported and the previous Vercel production alias remains the rollback target; an AIT upload is never described as public until review/approval/release completes.
- Visual regression assertions require: no legacy top branding text, no separate settings button, exact two-line title, identical 14px/800 menu rows, no cross-like upper-right art element, and approved dawn colors in the intro scene. Screens at 390px and 1024px must not overflow horizontally.
- Final approved intro copy is reproduced below exactly:
  - `눈을 뜨니 오전 6시 07분입니다. 휴대폰에는 읽지 않은 카톡 알림이 수북하게 쌓여 있습니다.`
  - `학과 단체방 공지, 새로 올라온 동아리 모집 글, 아르바이트 연락, 그리고 아직 열어보지 않은 메시지 하나가 화면 위에 겹쳐 있습니다. 마지막 메시지에는 짧은 문장만 남아 있습니다. “이번에는 어떤 사람이 될 수 있을까요?”`
  - `오늘은 평범한 학기의 첫날일 수도, 오래 미뤄둔 변화를 시작하는 날일 수도 있습니다. 지금 고르는 작은 선택들은 수업과 관계, 생활과 진로를 조금씩 다른 방향으로 이끌게 될 것입니다.`
  - Disclaimer unchanged: `이 이야기는 실제 진로 예측이 아닌 재미를 위한 허구의 시뮬레이션입니다.`
- Vercel target is the linked `sano-officeworker` project (`.vercel/project.json`); Toss target is appName `sano-officeworker` with production API base and output `dist/toss-miniapp` (`granite.config.ts`).

### Remaining Ambiguities
- None.

## Summary
Refresh both app headers and settings navigation, clean up duplicate labels/actions, expand age selection to 18-80, preserve age-aware events, and deploy the verified result to production.

## Round 2

### Questions Asked
1. Review of the first interactive prototype.
   > "아니야 나이는 18, 19, ~ 80까지 한살마다 다 눌러볼수 있어야해. 어디서 깨어난 것도 본가, 자취방, 기숙사 선택지 그대로여야하고. 몰입감이 좋게 맨 처음에 시작 문구 나오고 나서 다음으로 넘어간 다음에 질문 하나씩 하는게 좋을 것 같아. 당신의 이름은 무엇인가요? 다음 당신의 나이는? 다음 이런식으로. 그리고 처음시작 문구도 반말이랑 존댓말이 섞여있어. 존댓말로 맞추고 메뉴글자크기가 동일하지 않고 달라. 똑같이 맞춰줘."

### Decisions Made
- Reject the single-page onboarding prototype.
- Use an immersive step flow: honorific intro, name, age, residence, preferred abilities, then create.
- Age control exposes every integer from 18 through 80 inclusive.
- Residence choices remain exactly 본가, 자취방, 기숙사; the selected state is visual only.
- All intro narration uses consistent Korean honorific speech.
- Every navigation and settings row in the combined menu uses the same font size and weight.

### Remaining Ambiguities
- None.

## Round 3

### Questions Asked
1. Final copy and art redirect before implementation.
   > Preserve and improve the existing pixel art instead of replacing it with emoji; make it a beautiful dawn scene. Base the intro on waking at 6:07 AM with stacked KakaoTalk notifications, add a few intriguing sentences, keep all narration honorific, and preserve the existing small disclaimer wording and visual treatment exactly.

### Decisions Made
- The production intro continues to use the existing `PixelScene` component and pixel-art language; no emoji illustration is introduced.
- Revise the intro art toward a blue 6:07 AM dawn, with warm phone/window light and richer atmosphere.
- Use the approved all-honorific intro copy recorded in the revision-2 prototype.
- Keep the exact disclaimer: `이 이야기는 실제 진로 예측이 아닌 재미를 위한 허구의 시뮬레이션입니다.` using its existing small-print treatment.

### Remaining Ambiguities
- None.

## Round 4

### Questions Asked
1. Review of the 6:07 AM intro copy.
   > The interview-specific copy is too narrow because the simulation may begin in first year, third year, or another university stage; the opening is closer to the beginning of a student's varied life than a fixed job-seeker moment.

### Decisions Made
- Remove interview and recruitment-deadline assumptions from the intro.
- Use broad university-life signals that fit multiple starting grades: department group chat, club/activity notice, part-time contact, friendships, and an unopened message.
- Frame the day as either an ordinary semester beginning or the start of a delayed change, with choices affecting classes, relationships, daily life, and career direction.

### Remaining Ambiguities
- None.

## Round 5

### Questions Asked
1. Final microcopy correction.
   > Change the unopened message to `이번에는 어떤 사람이 될 수 있을까요?`.

### Decisions Made
- Use the exact sentence `이번에는 어떤 사람이 될 수 있을까요?`.

### Remaining Ambiguities
- None.

## Round 6

### Questions Asked
1. Final art correction.
   > Remove the cross-like shape and make the pixel art feel brighter.

### Decisions Made
- Remove crossing window bars or any shape that can read as a cross.
- Brighten the dawn palette with blue-lilac sky, apricot sunrise, cream window light, and a lighter room palette.

### Remaining Ambiguities
- None.

## Round 7

### Questions Asked
1. Identify the remaining cross-like shape.
   > The light fixture above the computer on the right still looks like a cross.

### Decisions Made
- Remove both intersecting light-fixture bars above the right-side computer entirely.

### Remaining Ambiguities
- None.
