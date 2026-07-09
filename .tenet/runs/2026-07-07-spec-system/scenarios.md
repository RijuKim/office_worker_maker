# Scenarios: 스펙 시스템 (Credential/Spec System)

## Scenarios (Success)

1. **Spec initiation and completion (2-step flow)**
   - Given a 3rd-year character with active event
   - When the player chooses "토익 시험 접수하기"
   - Then a `Spec` record is created with type `LANGUAGE_SCORE`, name "TOEIC", status `IN_PROGRESS`
   - When the player advances to the next event
   - Then the next event's body begins with a narrative reference to the TOEIC registration
   - When the player resolves the next event
   - Then the `Spec` status changes to `COMPLETED` with score (e.g. "900")
   - And the character's `specScore` increases by the appropriate amount

2. **Job application with full 6-stage process (대기업)**
   - Given a 4th-year character with completed specs
   - When the player applies to a 대기업 company
   - Then a `JobApplication` is created with `currentStage: DOCUMENT`
   - When the document stage resolves with pass
   - Then `currentStage` advances to `PERSONALITY_TEST`
   - When personality test passes → `CODING_TEST`
   - When coding test passes → `FIRST_INTERVIEW`
   - When first interview passes → `SECOND_INTERVIEW`
   - When second interview passes → `FINAL_RESULT`
   - When final result is positive → `finalResult: true`, `isActive: false`
   - And a career ending record is created

3. **Job application failure and spec fatigue**
   - Given a character with low spec score applying to a competitive company
   - When the document stage resolves with fail
   - Then `currentStage` stays at `DOCUMENT` with `documentPassed: false`
   - And `burnoutRisk` increases
   - And the character can re-apply or try a different company

4. **Career path: 워킹홀리데이**
   - Given a 4th-year character with `wealth >= 4` and `mental >= 4`
   - When the player starts the 워킹홀리데이 career path
   - Then a `CareerPath` record is created with `pathType: "WORKING_HOLIDAY"`
   - When the player progresses through the path events (준비 → 출국 → 생활 → 귀국/정착)
   - Then the path resolves with `PASSED` or `FAILED` based on choices and stats

5. **Career path: 임용고시 (education major only)**
   - Given a 4th-year character with major "교육학과" and `academic >= 6`
   - When the player starts the 임용고시 career path
   - Then a `CareerPath` record is created with `pathType: "TEACHER_EXAM"`
   - When the player progresses through 교생실습 → 필기시험 → 면접 events
   - Then the path resolves with `PASSED` or `FAILED`

6. **Choice result: stat delta visible, summary flows into next event**
   - Given a character with an active event
   - When the player makes a choice
   - Then the response includes `statDelta` with the stat changes
   - And the response does NOT include `summary` text
   - When the next event is loaded
   - Then the event body begins with a narrative reference to the previous choice

7. **Spec-overcoming (low spec, high stats still pass)**
   - Given a character with low spec score but high `practical` and `communication` stats
   - When applying to a 스타트업 company
   - Then the document stage has a chance to pass despite low spec score
   - And the interview stages benefit from high stats

8. **Blind hiring random factor**
   - Given a character with moderate stats applying to any company
   - When any stage resolves
   - Then there is a small random factor that can override the stat-based result
   - This represents blind hiring's unpredictability

## Anti-Scenarios (Failure)

1. **Choice summary still shown as separate screen**
   - After making a choice, the response still includes `summary` text
   - Failure: summary must be removed from choice response; only stat delta labels remain

2. **Spec created without event trigger**
   - A `Spec` record is created directly by API without going through an event choice
   - Failure: specs must only be created through event choices

3. **Job application stage skipped**
   - A job application advances from DOCUMENT directly to FINAL_RESULT without going through intermediate stages
   - Failure: stages must follow the company-type-specific order

4. **Career path started without stat requirements**
   - A character with `academic < 6` starts 임용고시 path
   - Failure: career path eligibility must check stat requirements

5. **Real company name in job application**
   - A job application contains a real Korean company name (e.g. "삼성", "카카오")
   - Failure: all company names must be fictional/parody

6. **Spec score not affecting document pass rate**
   - A character with zero specs has the same document pass rate as one with many specs
   - Failure: spec score must meaningfully affect document stage outcomes

7. **Career path failure doesn't route back**
   - A failed career path leaves the character stuck with no way to continue
   - Failure: failed career paths must route back to general job-seeking or alternative paths
