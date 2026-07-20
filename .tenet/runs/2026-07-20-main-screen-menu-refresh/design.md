# Run Design Direction

## Chosen Direction
- Selected mockup: `visuals/2026-07-20-01-mockup-compact.html`, revised by `visuals/2026-07-20-04-prototype-menu-flow-revision-5.html`
- Design rationale: preserves the existing pixel-game visual language while removing redundant chrome and placing navigation at the content title.
- Project design doctrine used: `.tenet/project/design.md`
- Accepted component examples consulted: none — directory absent/empty.

## Run-Local Visual Principles
- Color palette: existing warm brown background, cream panel, amber action, pale green eyebrow.
- Typography: existing system/pixel-adjacent heavy weights; two-line 30px desktop and 25px mobile title.
- Spacing: 8/12/16/24px rhythm.
- Border radius: restrained; retain square pixel borders and shadows.

## Component Patterns
- Buttons: existing high-contrast pixel button treatment.
- Forms: one question per onboarding step; existing bordered inputs and selected-state background/outline, without a `선택됨` text prefix.
- Cards/containers: cream surface with dark 3-4px border.
- Navigation: one menu trigger aligned right of the title; desktop anchored dropdown, mobile full available width panel.

## Layout
- Grid system: one centered 560px create column; existing play layouts remain intact.
- Responsive strategy: desktop-first, menu becomes full-width below the title row at 720px and below.
- Onboarding sequence: honorific intro → name → age (every integer 18-80) → residence (본가/자취방/기숙사) → two preferred abilities → create.
- Intro art: retain the repository's pixel-art component and refine it into a brighter blue-lilac and apricot 6:07 AM dawn with warm window/phone highlights; remove cross-like window framing and never substitute emoji.

## Proposed Project Doctrine Updates
- Consider documenting title-aligned navigation as the preferred non-game release header pattern after production validation.
