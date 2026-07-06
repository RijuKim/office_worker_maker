# Scenarios: College Career Sim

## Scenarios (Success)

1. Signup, login, and character creation
   - User opens the app.
   - User signs up with `player@example.com` and a valid password.
   - User logs in.
   - User creates a character by entering name `한서윤`, selecting age `21`, starting grade/year `2`, and major `사회학과`.
   - Expected outcome: the play screen shows `한서윤`, the selected starting details, initialized public stats, and a first event.
   - Expected persistence: `User`, `CharacterRun`, `CharacterStats`, `HiddenState`, and first `Event` records exist and belong to that account.

2. Normal event choice updates state
   - Authenticated user views a current event with 2-4 choices.
   - User selects a choice about asking a club senior for internship details.
   - Expected outcome: UI advances to a next situation or updated event.
   - Expected persistence: `EventHistory` stores the choice; stat deltas are clamped to allowed bounds; relationship trust or flags update server-side.

3. OpenRouter failure falls back without blocking play
   - User reaches a key event where AI generation is attempted.
   - OpenRouter mock returns timeout, invalid JSON, or rate-limit.
   - Expected outcome: user sees a static fallback event with matching tags and can continue.
   - Expected persistence: AI usage/failure metadata is recorded as appropriate, but no invalid AI event is committed as canonical state.

4. Forced burnout event
   - Character hidden `burnoutRisk` reaches 85 or higher after repeated overwork choices.
   - Server evaluates forced-event thresholds.
   - Expected outcome: a burnout crisis/recovery event appears without requiring the user to pick an initial event choice.
   - Expected persistence: forced event is stored in event history with null choice id, and the next screen offers recovery/response choices.

5. Career and ending record generation
   - Character has at least 15 core events and reaches a branch point such as employment, entrepreneurship, graduation, extended leave, dropout, public-sector entry, or licensed-profession entry.
   - User triggers record generation.
   - Expected outcome: `커리어와 엔딩 기록` is saved and appears in the collection.
   - Expected persistence: record includes title, summary, long narrative, career path, salary band, workplace tone, stat snapshot, key relationships, 3-7 major events, satisfaction, growth potential, work-life balance, health, relationship state, tags, and similarity key.

6. Same destination, different story
   - User completes two runs that both reach the same parody company and role but with different stats, relationships, and major events.
   - Expected outcome: collection shows both when their narrative context meaningfully differs.
   - Expected persistence: records share destination/job metadata but have different snapshots, tags, and narratives.

7. Mobile layout
   - User opens the play screen at 390px width.
   - Expected outcome: the UI uses a single column, narrative appears before supporting cards, choices are tap-sized, and no text overlaps or overflows controls.

## Anti-Scenarios (Failure)

1. Randomly assigned protagonist name
   - The system creates a character without asking for a name.
   - Failure: this violates product requirements. Character name must be user-entered.

2. Client-side canonical state mutation
   - Client directly changes stats or flags without a server transition.
   - Failure: canonical game state must only change through server-owned validation.

3. Real company claim
   - Seed data or AI output displays an exact real company name, real CEO, real scandal, or factual negative claim about an identifiable company.
   - Failure: content must be discarded or replaced with fictional parody-safe content.

4. OpenRouter blocks gameplay
   - OpenRouter times out and the user cannot continue.
   - Failure: fallback event must keep gameplay moving.

5. Invalid AI JSON committed
   - AI response misses required fields or proposes unsafe deltas, but the app saves it as canonical state.
   - Failure: invalid AI output must be rejected and replaced.

6. Unauthorized data access
   - User A can fetch or mutate User B's character or records by changing an id.
   - Failure: every owner-scoped API must enforce account ownership.

7. Duplicate collection clutter
   - Near-identical records with roughly 80% or more overlap are shown as unrelated separate records without grouping.
   - Failure: collection should group near duplicates.

8. Forced event removes all agency
   - Burnout triggers automatically and then the player has no recovery or response choices.
   - Failure: forced events must return agency through the next situation.
