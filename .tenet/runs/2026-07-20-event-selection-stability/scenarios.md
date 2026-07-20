# Scenarios: Event Selection Stability

## Scenarios (Success)

1. An AI event is committed and displayed. The player waits longer than 10 seconds, changes tabs, and triggers a character reload. Every surface returns the same event ID and choices until selection.
2. A streaming request commits an event but its connection closes before the final SSE is processed. Client recovery fetches the character and receives that committed event; the JSON fallback route does not discard or regenerate it.
3. Two stream/JSON requests begin with no current event. Both generate candidates, but an atomic compare-and-set elects one. Both callers resolve to the winner and the loser candidate is non-active.
4. The provider takes 12 seconds but completes within the configured timeout. The AI event succeeds, is logged as slow, and no fallback is used.
5. The provider reaches the configured timeout before any event is committed. A validated static fallback is committed, gameplay continues without an error banner, and the timeout/fallback durations are logged.
6. AI JSON has a valid title/body but one choice has an out-of-range stat delta. The failure is recorded as a choice stat-range/schema issue; any bounded retry is limited and never replaces a committed event.
7. `OPENROUTER_TIMEOUT_MS=45000` uses 45 seconds; missing, `abc`, `4999`, and `120001` use 30 seconds.
8. The player selects a choice from the authoritative event. The choice route persists history and advances state; the next generation starts only after the previous event has been consumed.

## Anti-Scenarios (Failure)

1. A displayed event is rechecked against a changed life-stage context, marked `DISCARDED`, and replaced before the player chooses.
2. A client-side timer, SSE disconnect, retry, or late provider response replaces an already committed event with a static fallback.
3. Two concurrent requests leave two `ACTIVE` events or return different authoritative IDs.
4. A loser request overwrites `currentEventId` after the winner has responded.
5. One malformed choice is logged only as generic `invalid_response`, making the frequent failure impossible to diagnose.
6. A valid first AI result causes another full provider call before commit.
7. A 10-second duration is treated as a hard timeout.
8. Provider/API keys, full prompts, or complete raw responses are logged or returned to the player.
9. Prototype-only duplicate-request diagnostics appear in production UI.
