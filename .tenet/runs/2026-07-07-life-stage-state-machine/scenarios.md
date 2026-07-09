# Scenarios: Life Stage State Machine

## Scenarios (Success)

1. Existing save fallback
   - Given a character created before Slice 1 with no `eventFlags.lifeStage`
   - When the player opens the play screen
   - Then the sidebar shows a semester/life-stage label such as `1학년 1학기` and does not show `0/15` as the primary progress model.

2. Semester advancement
   - Given an enrolled 1st-year 1st-semester character with valid state
   - When the player resolves enough core events for advancement
   - Then `eventFlags.lifeStage`/term state persists the next semester or grade, and UI reflects the new label after reload.

3. Forced leave risk
   - Given a character with `mental <= 2` or `health <= 2`
   - When the next event is requested
   - Then ordinary career progression is blocked or deprioritized and a leave/crisis/recovery branch is selected or state-marked.

4. Extra semester
   - Given a 4th-year late-stage character with unresolved graduation requirements or low academic/practical stats
   - When the player would otherwise reach finalization
   - Then the system moves to extra-semester/delayed-graduation state instead of creating a generic final record.

5. Destination gate integrity
   - Given no destination candidate/process exists
   - When an ending or late-stage result is generated
   - Then no concrete company, graduate school, agency, or accelerator name is granted.

6. Record UI grade removal
   - Given any saved record
   - When records are displayed
   - Then the UI does not show A/B/C, GOOD ROUTE, MIXED ROUTE, or HARD ROUTE.

## Anti-Scenarios (Failure)

1. Fixed counter regression
   - The play UI still presents `0/15`, `14/15`, or similar as the main progress model.

2. Unsupported AI transition
   - AI suggests dropout, graduation, marriage, childbirth, or named company success and the server persists it without passing code validation.

3. Existing save crash
   - A character without Slice 1 JSON state fails to load or cannot request the next event.

4. Direct result choices
   - A gate event presents choices like `시험을 통과한다` or `면접에서 떨어진다` instead of strategy/attitude choices.

5. Unsupported named ending
   - An ending names a company, graduate school, lab, agency, overseas destination, spouse, or child that has no prior process/gate/history.

6. Weak consequence branch
   - Severe stat/risk thresholds only change flavor text and do not alter life-stage, event pool, or finalization eligibility.
