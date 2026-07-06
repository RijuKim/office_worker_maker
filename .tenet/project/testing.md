# Project Testing

## Quality Bar

Tests should verify that server-owned game rules, persistence, authentication, AI fallback, and collection behavior work before broad UI polish. The game must remain playable when OpenRouter is unavailable.

## Required MVP Flows

Automated or scripted checks should cover:
- A new user can sign up with email/password, log in, and log out.
- A logged-in user can create a character run and see initial public stats.
- A user can view a current event with 2-4 choices.
- Selecting a choice calls server logic, validates the transition, updates stats/relationships/flags, and persists event history.
- AI event generation can be called from the server using OpenRouter configuration.
- When AI generation fails, times out, returns invalid JSON, or is rate-limited, a static fallback event is shown and gameplay continues.
- A run with at least 15 core events can reach a career branch point and generate a `커리어와 엔딩 기록`.
- The collection view persists records at the account level and distinguishes records that share a company/job but differ in narrative context.
- Near-duplicate records can be grouped according to the approximate 80% overlap rule.
- Parody company screens do not reveal exact real company names or real-world allegations.
- Desktop and mobile layouts remain usable, with a single-column layout at 768px and below.

## Unit-Level Coverage

Prioritize unit tests for:
- Stat bounds and stat delta validation.
- Event schema validation.
- AI output validation and fallback selection.
- Career branch eligibility.
- Record generation required fields.
- Similar-record grouping.
- Daily AI usage limit enforcement.
- Parody company safety checks.

## Failure Handling Checks

The app should provide concise recoverable feedback for:
- Invalid login credentials.
- Attempting to access another user's character or record.
- Save conflicts or stale character state.
- Invalid character state.
- OpenRouter timeout or invalid response.
- Daily AI generation limit reached.

## Non-Goals For MVP Testing

Do not require load-test infrastructure, payment tests, social-login tests, admin tooling tests, or Unity/mobile-native tests for the first MVP.
