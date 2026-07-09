# Event Quality System Scenarios

## Scenarios (Success)

1. **Dropout conflict rejected**
   - Given a character with dropout life stage
   - When AI proposes an event about attending ordinary lectures and submitting class assignments
   - Then the validator returns fail, hardFailure true, and reason includes academic conflict
   - And the route retries once or falls back without committing the invalid event

2. **Job process continuation allowed**
   - Given recent events mention the same company/job application
   - When the candidate advances from 서류 to 인성검사 or 면접
   - Then repeated company/job tags receive a continuity exemption
   - And the event can pass if no hard failure exists

3. **Closed contest proposal blocked**
   - Given event flags show contestSkipped true or contestJoined completed
   - When a candidate asks the same contest/team-join offer again
   - Then validation fails as closed proposal repeat regardless of diversity score

4. **Direct pass/fail choice rejected**
   - Given an AI event choice label is `서류 합격을 선택한다`
   - When quality validation runs
   - Then the event fails before persistence

5. **Numeric stat text removed or rejected**
   - Given generated ending text contains `학점 10의 지식` or `네트워크 3`
   - When result/ending text guard runs
   - Then saved/displayed narrative does not include those numeric stat phrases

6. **Streaming replacement remains playable**
   - Given streaming AI body deltas were sent for a candidate that fails validation
   - When retry or fallback produces a valid event
   - Then the stream sends `replace_body` and final `event` payload matches the persisted valid event

7. **Accepted activity can close after poor participation**
   - Given the character accepted a club, study, contest, outside group, or similar activity
   - When later flags/history indicate low participation followed by quit, expulsion, completion, or closure
   - Then the thread remains available as past context
   - And the same participation offer is not presented again as an active invitation

## Anti-Scenarios (Failure)

1. **Blanket repetition ban breaks story**
   - A contest or job process follow-up is rejected only because tags repeat, even though process stage changed.

2. **Extra AI loop slows gameplay**
   - A single next-event request performs multiple retries or waits past the existing timeout policy.

3. **Invalid fallback is committed**
   - AI fails validation, fallback construction fails, and route still commits an unsafe or malformed event.

4. **Result choice lets player choose outcome**
   - A player-facing choice says `합격한다`, `불합격한다`, `통과한다`, or equivalent.

5. **Narrative exposes raw stat scores**
   - Event/result/ending copy includes phrases like `건강 6`, `학점 10`, `academic: 7`, or `네트워크 3`.

6. **Quality logs require DB migration**
   - Implementation adds a new log table or blocks gameplay on log transport failure.

7. **Accepted means forever active**
   - A study, club, contest, or outside group remains eligible for ordinary follow-up forever only because it was once accepted, even after quit, expulsion, completion, or closure.
