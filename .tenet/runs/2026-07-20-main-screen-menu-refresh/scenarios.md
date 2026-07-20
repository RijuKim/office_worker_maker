# Scenarios: Main Screen And Menu Refresh

## Scenarios (Success)

1. On a 390px Toss/mobile screen, the user sees the two-line title and one menu button. Opening it reveals full-width navigation/settings without overflow; every row has identical typography.
2. On a 1024px desktop screen, the same button opens a right-anchored dropdown. No legacy brand/settings chrome remains.
3. A new user reads the approved 6:07 AM honorific intro with bright cross-free dawn pixel art, then advances through name, age, residence, and ability screens one at a time.
4. The user can select every age from 18 through 80 in one-year increments. Going back preserves the chosen age and submitting 80 succeeds.
5. Residence offers exactly 본가, 자취방, 기숙사; selection changes styling/semantics without adding visible `선택됨` text.
6. Background music, effects, and haptics toggle inside the menu and persist after remount. Unsupported capabilities silently no-op.
7. Character creation at ages 18, 40, and 80 preserves age in event context, while AI failure still yields validated fallback gameplay.
8. All verification gates pass, Vercel reaches Ready and its production alias responds. Toss artifact status is reported without overstating public availability.

## Anti-Scenarios (Failure)

1. Scrolling reveals `취준 / 취준 생활 시뮬레이션`, a separate gear button, or a menu detached from the title.
2. `새 이야기` and `새 시뮬레이션` both appear, or settings rows use smaller/different typography than navigation rows.
3. All onboarding questions appear simultaneously, user input is lost on Back, or an artificial transition delay makes steps feel unresponsive.
4. Age skips an integer, stops at 35, accepts 17/81, or a valid older age is removed before event generation.
5. Residence labels/IDs change, or selected choice visibly prepends `선택됨 ·`.
6. Intro includes interview-only assumptions, mixed speech levels, emoji art, a cross-like right-side element, or altered disclaimer copy.
7. Corrupt local settings crash render or block gameplay; unsupported haptics/audio show a blocking error.
8. A failing test/build is ignored, Vercel failure replaces a healthy production alias, or an uploaded Toss bundle is reported as publicly released before approval.

