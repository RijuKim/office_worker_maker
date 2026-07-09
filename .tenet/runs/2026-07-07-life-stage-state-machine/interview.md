# Interview: Life Stage State Machine

Date: 2026-07-07
Mode: Full
Rounds: 1

## Mode Selection
- Prompt shown: Recommended Full because replacing the 15-event linear run with a semester/year/life-stage state machine touches DB state, event selection, AI prompts, endings, and UI progression.
- User response: "full로 진행 부탁해"
- Selected mode: full
- Selection basis: explicit_user_choice

## Clarity Score
- Goal: TBD (weight 0.4)
- Constraints: TBD (weight 0.3)
- Success criteria: TBD (weight 0.3)
- **Total: TBD / 0.8 required**

## Round 1

### Questions Asked
1. Mode selection
   > User selected Full.

2. Delivery mode
   > User selected agile.

3. Model tier
   > User selected frontier.

4. Progression unit
   > User selected a hybrid model: code tracks semester/year state while UI/story presents broader life stages.

5. Major branch severity
   > User selected strong consequences: bad conditions can actually trigger leave, dropout, failed gates, relationship collapse, criminal downfall, or other route-changing states.

6. Family outcome gating
   > User selected mixed conditions: marriage, cohabitation, childbirth, and parenting require both relationship depth and life stability, and can branch to separation, non-marriage, or solitary stability.

7. AI branch authority
   > User selected hybrid AI branching: AI may propose branch candidates, but code must validate and approve any real state transition.

8. Slice 1 acceptance criteria
   > User approved: replace visible 0/15 progress with semester/life-status progress; make event selection depend on semester/academic/life state; persist state transitions such as grade advancement, leave, dropout risk, and graduation gate; preserve existing saves; defer marriage/childbirth/parenting endings to Slice 2.

9. Ending specificity and destination gating
   > User clarified that academic branches such as transfer, extra semesters, double majors, graduate school, and all accumulated route history must be considered in endings. Endings must not invent a company, institution, graduate program, marriage, or child outcome unless the playthrough contained a matching process/gate. ABC grades and repeated generic ending text should be removed.

### Decisions Made
- Replace the current fixed 15-event progression with a life-stage state machine.
- Include adult-life outcomes such as marriage, cohabitation, childbirth, and parenting when supported by player history, relationships, and stats.
- Keep the work in agile slices with use-checkpoints after meaningful slices.
- Use frontier-style decomposition.
- Use hybrid progression: internal state tracks semester/year/status, while UI narrates phases such as new semester, leave season, graduation threshold, and years afterward.
- Major bad-state branches should be strong consequences, not just flavor text. They should change academic/life status, future event pools, and ending candidates.
- Adult family outcomes use mixed gating: relationship trust/romance flags plus life stability factors such as mental, health, wealth, career gate result, and risky-history flags.
- AI may propose branch candidates and narrative motifs, but code owns all actual state transitions and rejects or downgrades invalid suggestions.
- Slice 1 focuses on the core progression state machine and UI/status/event-selection behavior.
- Marriage, childbirth, and parenting outcomes are explicitly in scope for the overall feature but deferred to Slice 2.
- Endings must synthesize academic administration state, route history, career gates, destination processes, relationships, adult-life flags, and hidden risks.
- Specific company/institution/graduate-school destinations require an earlier process: application, interview, exam, recommendation, lab acceptance, startup selection, or equivalent gate. If no process exists, the ending should use an unspecific preparation/retry/alternate-path result.
- ABC grade labels and GOOD/MIXED/HARD route tags are deprecated and should not appear in UI or generated prose.
- Lifecycle stages for Slice 1:
  - `college_early`: 1st year through early 2nd year; adaptation, classes, clubs, early relationships, money baseline.
  - `college_mid`: late 2nd year through 3rd year; major fit, internships, lab/professor routes, romance depth, leave/dropout risks.
  - `college_late`: 4th year; graduation requirements, extra semester risk, career/graduate-school gates, destination processes.
  - `leave`: leave of absence; recovery, work, overseas, internship, relationship reset, return/dropout decisions.
  - `dropout`: dropout/withdrawal route; alternate work, startup, family conflict, risky money, later-life outcomes.
  - `post_graduation`: after graduation; career retry, company/institution result, graduate school, startup aftermath, adult-life outcomes.
- Transition rules for Slice 1:
  - Internal progression advances by semester/life stage, not a fixed 15-event UI counter.
  - Roughly every 2-3 core events can trigger semester advancement when not blocked by leave/dropout/gate states.
  - Two semesters advance a grade year up to 4th year.
  - Low health, mental, reputation, high burnoutRisk, high riskDebt, or unresolved graduation requirements can force strong branch checks.
  - Strong branches can set leave/dropout/extra-semester/delayed-graduation/gate-pending states.
  - AI branch suggestions are advisory and must pass code validation before state changes.
- Technical constraints:
  - Existing stack remains: Next.js 16.2.10, React 19.2.7, Prisma 7.8.0, PostgreSQL via Neon, NextAuth 4.24.14, Vercel production deployment, Node >=20.9.
  - Existing saves must not break; Slice 1 should prefer additive state stored in existing `hiddenState.eventFlags`/existing columns unless a migration is clearly required.
  - Authentication remains NextAuth; state updates must stay scoped to the current user and character.
  - Production deployment remains Vercel; migrations, if any, must be deploy-safe.
  - Slice 1 schema strategy: do not add Prisma columns or migrations. Store new state in `hiddenState.eventFlags.lifeStage`, `academicPlan`, `graduation`, `destinationCandidates`, and related JSON fields, derived from existing columns when absent.
  - Performance target: event-next and choice APIs should remain single-request flows and avoid more than one additional indexed history query; typical response target under 2 seconds excluding AI calls, under 30 seconds when AI generation is attempted.
  - Data-volume target: logic should handle at least 40 event history records per character and 20 previous characters per user for recent-event exclusion.
- Failure handling:
  - Corrupted/missing life-stage state falls back to deriving state from `currentGradeYear`, `academicStatus`, and `coreEventCount`.
  - Invalid AI branch suggestions are rejected or downgraded to normal events.
  - Unsupported destination claims are stripped or generalized in endings.
  - If graduation requirements are blocked, the run moves to extra-semester/delayed-graduation rather than a generic ending.
- Exact transition thresholds:
  - Semester advances after 2 resolved core events in the current semester unless the state is `leave`, `dropout`, or a pending gate.
  - Grade advances after semester 2, capped at grade 4.
  - `leave` forced check: health <= 2, mental <= 2, or burnoutRisk >= 80.
  - `dropout` forced check: reputation <= 1, health <= 1, mental <= 1, or riskDebt >= 8.
  - `extra_semester` check: in grade 4 late stage with academic <= 4, practical <= 4, unresolved graduation requirement flag, or failed thesis/capstone.
  - `graduation_gate` opens in grade 4 after at least 2 late-stage core events if not blocked by leave/dropout/extra-semester.
  - `post_graduation` requires passed graduation gate or explicit dropout alternate-route completion.
  - AI suggestions never force transitions outside these thresholds; they can only nominate eligible checks.
- Blocker versus probabilistic outcomes:
  - Blockers: dropout, leave, extra semester, graduation gate, named destination gate, and career/family gate eligibility.
  - Probabilistic/narrative: which eligible event within a stage appears, which prior relationship returns, and what surface conflict AI uses.
- Measurable Slice 1 success criteria:
  - UI no longer shows `0/15` progress as the main progress model.
  - At least six life/academic states are representable and serialized.
  - Event selection uses life-stage/academic state gates.
  - State transitions can persist semester advancement, leave/dropout/extra semester/graduation-gate states.
  - Existing characters without new state can still load and continue.
  - Tests cover state derivation, transition validation, and no unsupported fixed-counter UI regression.
- Exact Slice 1 user scenarios:
  - Existing character with no `lifeStage` opens play screen and sees text such as `1학년 1학기` or an equivalent semester/life-stage label, not `0/15`.
  - After resolving enough normal events, continuing shows an advanced semester/year label and persisted state.
  - A character with health or mental <= 2 receives a leave/dropout-risk event or state transition before ordinary career progression.
  - A grade-4 character with blocked graduation requirements is routed to extra semester/delayed graduation instead of final ending.
  - A grade-4 character with eligible destination candidates gets a concrete gate event; endings only name destinations that were introduced by prior gate/process state.
  - Record cards do not show A/B/C, GOOD ROUTE, MIXED ROUTE, or HARD ROUTE.
- Choice diversity acceptance:
  - General non-forced events should prefer 3 choices when the event design supports it.
  - Choices must represent at least two distinct tradeoff axes among ambition, recovery, money, relationship, honesty, avoidance, confrontation, academic risk, and career risk.
  - Gate choices must be strategy/attitude choices; direct result choices like "pass the exam" are invalid.

### Remaining Ambiguities
- Exact lifecycle stages and branch boundaries.
- Whether state machine changes require Prisma schema migrations or can initially live in hiddenState/eventFlags.
- How explicit or abstract marriage/childbirth/parenting outcomes should be in UI and generated prose.
- Which state transitions are blockers versus probabilistic outcomes.
- Acceptance criteria for "feels like a story".
- Exact implementation details for whether Slice 1 uses only existing columns plus hiddenState, or adds schema columns.
- Choice diversity rules: user wants more varied choices than pass/fail or two obvious branches.
- Endings currently feel repetitive and underspecified; destination specificity and AI synthesis need explicit gates.

## Delivery Mode Decision
- Prompt shown: autonomous = one end-to-end run after confirmation; agile = sliced delivery with checkpoints after each slice. Recommended agile because the game structure is changing substantially and needs use-feedback.
- User response: "agile로 진행 부탁해"
- Selected delivery_mode: agile
- Selection basis: explicit_user_choice

## Model Tier Decision
- Prompt shown: frontier = fewer larger jobs; local = finer-grained jobs with tighter acceptance criteria. Recommended frontier.
- User response: "frontier로 진행해줘."
- Selected model_tier: frontier
- Selection basis: explicit_user_choice

## Summary
The project will evolve from a linear 15-event college-career sim into a state-driven life progression system. The system should model college semesters/years and major life branches such as leave, dropout, internship, job search, career gates, startup aftermath, graduation, marriage/cohabitation, childbirth, and parenting, with outcomes determined by accumulated stats, relationships, hidden state, and event history rather than direct "pass/fail" choices. AI can propose story branches, but the engine validates and owns state transitions. Slice 1 delivers the semester/life-status progression foundation, event-selection gating, persisted state transitions, and UI progress replacement while preserving existing saves.

Choice design requirement: events should support varied player intents, not just binary good/bad or pass/fail choices. Typical events should offer 3 choices when appropriate, with different axes such as ambition, safety/recovery, relationship investment, money, honesty, avoidance, confrontation, and risk-taking. Some high-pressure gates may still have 2 choices, but they must be strategy/attitude choices and code resolves outcomes.

Expanded domain material: the state machine and event pools should explicitly cover overseas exchange/working holiday/study abroad, clubs and student organizations, classes and coursework, professors and labs, graduate school tracks including master's and PhD, internships, startup aftermath, family, romance, marriage/cohabitation/childbirth/parenting, crime/risky money, public sector/professional exams, and ordinary employment.

Academic administration branches: include major transfer/change of major, double major, minor, interdisciplinary track, extra semester, delayed graduation, failed graduation requirements, retaking courses, scholarship probation, and graduation thesis/project defenses. These should influence graduation timing, event pools, career/graduate-school gates, and adult-life stability.

Destination process rule: named companies, institutions, public agencies, labs, graduate schools, startup accelerators, and overseas destinations must be introduced through midgame or late-game events before they can appear as concrete ending destinations. The engine should store destination candidates and gate results, then pass them to AI ending generation. AI may elaborate the prose but must not invent unsupported concrete destinations.

Ending diversity rule: generated endings should be primarily AI-authored from the full event history, relationships, academic state, destination gates, and hidden state. Fallback endings must incorporate recent event titles, gate outcomes, academic administration branches, and relationship state to avoid repeated generic text. UI should not classify endings with ABC grades or route grades.
