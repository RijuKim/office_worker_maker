# Replay Balance Scenarios

## Scenarios (Success)

1. Starting in first year with no special flags, the player makes three choices and the academic term advances from first semester to second semester.
2. A graduation-ready character commits the twentieth core event and receives a normal career-and-ending record.
3. A non-early character that has not otherwise ended commits the twenty-fourth core event and receives the fallback final record.
4. A character with academic 4 and practical 4 completes a term with score-based extra-semester pressure (both are <= 4); academic 5 and practical 5 completes a term without it.
5. An AI event contains a 200–350-character body in 3–5 sentences and two or three complete choices.
6. A static event displays two or three choices; selecting one displays its original result summary and allows progression to the next event.

## Anti-Scenarios (Failure)

1. A normal first-year run still requires five choices to advance a semester or reaches 40 events before ending.
2. Academic or practical 4 alone (with the other at 5+) does not force an extra semester, or explicit requirement blockers stop working.
3. An AI or static event reaches the client with four choices.
4. Static prose is cut in the middle of a Korean sentence merely to satisfy a character count.
5. A choice's post-selection summary is shortened, paraphrased, removed, or replaced by its label.
6. Tightened AI validation causes provider failure to block progression instead of using the existing fallback path.
7. Existing authentication, API response shape, database schema, or immediate collapse endings change.
