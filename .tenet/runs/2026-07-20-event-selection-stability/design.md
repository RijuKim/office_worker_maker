# Run Design Direction

## Chosen Direction
- Selected mockup: `visuals/2026-07-20-03-mockup-minimal.html`
- Design rationale: Preserve the established story/choice surface and communicate only the lifecycle guarantee needed for this bug fix.
- Project design doctrine used: `.tenet/project/design.md`
- Accepted component examples consulted: none — `.tenet/project/design-components/` is empty.

## Run-Local Visual Principles
- Color palette: existing neutral white/black surface; subdued gray `#f5f5f5` for generation status.
- Typography: existing system font hierarchy.
- Spacing: existing story spacing; compact status block only.
- Border radius: existing compact 8-10px controls.

## Component Patterns
- Buttons: existing full-width contextual choice controls.
- Forms: unchanged.
- Cards/containers: no new persistent card system; loading status uses a quiet neutral surface.
- Navigation: unchanged.

## Layout
- Grid system: unchanged existing application layout.
- Responsive strategy: retain existing desktop and single-column mobile behavior.

## Proposed Project Doctrine Updates
- Document committed-event immutability as a server-owned interaction invariant after implementation and verification.
