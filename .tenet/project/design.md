# Project Design

## Interaction Model

The primary play surface is a Korean text-adventure interface. The player reads the current situation and chooses contextual actions or dialogue options. The UI should emphasize narrative momentum and consequences rather than looking like a spreadsheet or a fixed schedule planner.

Supporting surfaces use compact cards for character state, relationships, notable memories, active flags, career/company records, saves, and `커리어와 엔딩 기록`.

## Layout

Desktop-first layout:
- Main narrative area in the center.
- Character state and relationship/memory cards in a side panel.
- Contextual choices near the narrative area.
- Separate collection and career/company record views.

Mobile layout:
- At 768px and below, switch to a single-column layout.
- Narrative appears before supporting cards.
- Choices must remain easy to tap and must not overflow.

## Visual Direction

Initial MVP can be mostly text and cards. The design should leave room for future character art, event illustrations, animations, and possibly Unity/mobile clients. Avoid building a marketing landing page as the primary screen; the app should open into the actual game or auth flow.

The tone should feel like a contemporary Korean life/career simulation: readable, slightly playful, and grounded, without presenting itself as a serious career assessment tool.

## Components

Use clear controls:
- Buttons for choices and commands.
- Cards for repeated state, relationship, company, and record items.
- Tabs or navigation for play, character, records, and saves.
- Badges/tags for stats, company culture, event flags, and record tone.

Cards should be visually restrained and not nested inside other cards. Text must fit in buttons and cards across desktop and mobile.

## Safety And Copy

The UI should state that companies, people, and events are fictional and parody-based. Company descriptions must not look like real-world factual claims about identifiable companies.

Use the term `커리어와 엔딩 기록` for the collection feature. Avoid wording that implies a college student's whole life is permanently decided by one ending.
