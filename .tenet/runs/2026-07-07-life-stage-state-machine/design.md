# Run Design Direction

## Chosen Direction

- Selected mockup: `.tenet/runs/2026-07-07-life-stage-state-machine/visuals/2026-07-07-01-final-product.html`
- Design rationale: Preserve the existing Korean text-adventure layout while replacing the fixed counter with semester/life-stage information and destination candidates.
- Project design doctrine used: `.tenet/project/design.md`
- Accepted component examples consulted: none — `.tenet/project/design-components/` is absent or empty.

## Run-Local Visual Principles

- Color palette: existing restrained pixel palette, including dark sidebar `#231d17`, paper background `#f7efe2`, accent `#f7d08b`, line `#2a2018`.
- Typography: system sans-serif, compact labels, readable Korean prose.
- Spacing: retain dense but breathable panels with 12-24px spacing.
- Border radius: 8px or less, matching current cards/buttons.

## Component Patterns

- Buttons: choice buttons remain large text buttons with visible borders and stable height.
- Forms: unchanged from current character creation inputs.
- Cards/containers: use individual cards for state, records, and relationship items; do not nest cards inside cards.
- Navigation: sidebar remains, but progress module changes from numeric counter to academic/life-stage state.

## Layout

- Grid system: existing desktop three-column shell remains.
- Responsive strategy: existing mobile single-column behavior remains; state label must fit in sidebar/mobile header.

## Proposed Project Doctrine Updates

- Consider adding "state labels replace raw counters" to project design doctrine after this run proves out.
