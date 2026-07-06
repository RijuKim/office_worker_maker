# OpenRouter API Research

Confidence: [scanned-not-verified]

## Why
The user selected OpenRouter API for AI-generated game events. The implementation needs a current integration direction before spec and harness work.

## Findings
- OpenRouter exposes a chat completion endpoint at `POST https://openrouter.ai/api/v1/chat/completions`.
- Requests use bearer-token authentication in the `Authorization` header.
- The chat completion request accepts `messages`, `model`, `temperature`, token limits, `response_format`, `seed`, `stream`, `provider`, `session_id`, metadata, and related generation controls.
- The endpoint returns a chat-completion style response with `choices`, `model`, `usage`, and related metadata.
- OpenRouter documents structured outputs, which fits server-side JSON event generation for this game.

## Recommended Approach
- Call OpenRouter only from server-side code.
- Store `OPENROUTER_API_KEY` as a server-only environment variable.
- Generate event content with a structured JSON schema and validate it server-side before applying game-state changes.
- Use a pinned/default model setting in configuration, with fallback to static event templates if OpenRouter errors, rate-limits, or returns invalid JSON.
- Log minimal request metadata and avoid sending unnecessary user personal data.

## Sources
- https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request
- https://openrouter.ai/docs/guides/features/structured-outputs
