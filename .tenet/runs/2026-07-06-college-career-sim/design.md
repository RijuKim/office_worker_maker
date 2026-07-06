# Run Design Direction

## Chosen Direction
- Selected mockup: `.tenet/runs/2026-07-06-college-career-sim/visuals/2026-07-06-01-mockup-literary.html`
- Design rationale: The game depends on narrative momentum, long-form Korean event text, and player interpretation of consequences. The literary layout keeps reading primary while still exposing stats, relationships, memories, and records as supporting cards.
- Project design doctrine used: `.tenet/project/design.md`
- Accepted component examples consulted: none — `.tenet/project/design-components/` is absent or empty.

## Run-Local Visual Principles
- Color palette: warm paper background `#fbfaf6`, muted panel background `#f2efe7`, card background `#ffffff`, ink text `#232323`, secondary text `#706b62`, accent brown `#8a4f2d`, soft tag fill `#efe5d7`.
- Typography: system sans-serif for MVP; narrative text 18-20px desktop with generous line-height, 16-17px mobile.
- Spacing: spacious narrative center, compact side cards, 10-16px internal control spacing.
- Border radius: 8px for cards, buttons, nav items, and inputs.

## Component Patterns
- Buttons: full-width text choice buttons with concise title/description text, subtle border, warm hover state.
- Forms: plain labeled inputs/selects for signup and character creation, with inline validation text.
- Cards/containers: restrained one-level cards only; no nested cards.
- Navigation: simple tab/sidebar navigation for play, character, relationships, saves, and `커리어와 엔딩 기록`.

## Layout
- Grid system: desktop uses left character/navigation panel, central narrative panel, right relationships/memory/safety panel.
- Responsive strategy: at 768px and below, collapse to single-column with narrative before supporting cards and tap-sized choices.

## Adopted From Other Mockups
- Character creation must include user-entered name plus starting grade/year, age, and major/department.
- Threshold-based forced events, such as burnout, must be visually labeled as automatic state-driven events.

## Proposed Project Doctrine Updates
- None.
