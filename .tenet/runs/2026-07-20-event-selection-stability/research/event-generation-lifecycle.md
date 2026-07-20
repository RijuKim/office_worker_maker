# Event Generation Lifecycle Research

Confidence: `[scanned-not-verified]`

## What was researched

The current Next.js event routes, Prisma persistence model, client SSE recovery path, OpenRouter streaming/error contract, and structured JSON generation behavior were reviewed to identify how a displayed AI event can be replaced and why choice generation frequently fails.

## Existing-code findings

- Both next-event endpoints revalidate an existing `ACTIVE` event against the *current* life-stage selection context and explicitly mark it `DISCARDED` while clearing `currentEventId` if it no longer passes: `app/api/characters/[id]/events/next/route.ts` and `app/api/characters/[id]/events/next/stream/route.ts`. This violates the newly confirmed committed-event immutability rule.
- Both endpoints select `events where status = ACTIVE`, ordered newest-first, rather than resolving exclusively through `CharacterRun.currentEventId`. The schema has no uniqueness constraint preventing multiple active events for a character: `prisma/schema.prisma`.
- Event creation and assignment of `currentEventId` are separate writes. Concurrent requests can each create an active event and then overwrite the pointer: both next-event route files.
- The browser first calls the streaming route. If no final SSE event is observed, it fetches the character and then calls the non-streaming next route only if no current event is found: `app/page.tsx`. This recovery is directionally correct, but the server's active-event discard logic can turn recovery into replacement.
- `generateAiEventStream` can be followed by a non-streaming full generation retry, and a quality hard failure can cause another full generation retry. Provider fallback itself is sequential. Worst-case latency can therefore span multiple 30-second calls: `lib/game/openrouter.ts` and both next-event routes.
- `aiEventSchema` validates narrative and all choices as one object. Any invalid choice count, field, or stat range becomes the single reason `invalid_response`, losing stage-level diagnosis and discarding an otherwise usable narrative: `lib/game/openrouter.ts`.
- `fallbackUsed` is currently declared as constant `false` in both endpoints, so fallback telemetry and `lastAiFallbackReason` are inaccurate even when static fallback is selected.
- Event quality logs record validator duration, not provider or total generation duration: `lib/server/event-quality-log.ts`.

## External API findings

- OpenRouter supports SSE streaming and may send SSE comment lines that clients should ignore. Errors before the first token use an HTTP error response, while mid-stream failures arrive inside a stream event and the HTTP status remains 200. Source: https://openrouter.ai/docs/api/reference/streaming
- OpenRouter's Chat Completions API supports `response_format: { type: "json_object" }` and stricter JSON Schema output where the selected model/provider supports it. JSON mode guarantees JSON syntax but does not by itself guarantee the application's event/choice semantics. Sources: https://openrouter.ai/docs/api/reference/overview and https://openrouter.ai/docs/api/reference/parameters
- OpenRouter exposes stable typed provider errors and generation IDs that can improve reason-level diagnostics. Source: https://openrouter.ai/docs/api/reference/errors-and-debugging
- Next.js App Router route handlers use Web Request/Response primitives and support streaming responses; the application remains responsible for persistence/idempotency around the stream. Source: https://nextjs.org/docs/canary/app/building-your-application/routing/route-handlers

## Recommended approach

1. Treat any already committed `currentEventId` as authoritative and return it without re-running eligibility checks. Eligibility belongs before commit only.
2. Centralize event acquisition/commit logic shared by streaming and JSON routes.
3. Use an atomic compare-and-set on `CharacterRun.currentEventId` (or an equivalent transaction/lock) so only one request wins. A loser discards its uncommitted candidate and returns the winner.
4. Keep the default provider timeout at 30 seconds, read `OPENROUTER_TIMEOUT_MS`, accept only 5,000-120,000 ms, and default invalid values.
5. Add structured generation diagnostics: provider, elapsed time, slow-over-10s, transport/error category, parse stage, schema issue paths, quality reason, retry/fallback use, and authoritative event ID.
6. Separate parse/schema failure reporting enough to identify choice failures. Prefer schema-guided output when provider support is reliable; otherwise retain Zod as authority and make any repair bounded so it cannot create a second long full-event retry chain.
7. Fix fallback accounting and remove avoidable full regeneration. A generated valid event should be committed immediately; a committed event is never revalidated by a later request.

## Limitations

- Live provider latency cannot be made deterministic and will be mocked in automated tests.
- Database concurrency behavior must be verified against PostgreSQL; unit mocks alone cannot prove compare-and-set correctness.
