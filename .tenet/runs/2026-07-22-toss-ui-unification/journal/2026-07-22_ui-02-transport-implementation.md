# ui-02 transport implementation

type: journal
source_job: a4250382-6f8f-48bd-9c68-c2b833800055
job_name: Shared API and SSE transport
created: 2026-07-22T03:18:43.609Z

## Findings

- **summary**: Implemented a shared host-neutral JSON/SSE transport in lib/game-ui/event-stream.ts and wired the Toss miniapp stream call through it.
- **behavior**: Single POST to /api/characters/{id}/events/next/stream; SSE frames parse status/event/error; malformed/non-OK/missing-body/EOF paths recover via GET /api/characters/{id} every 600ms up to 12s; terminal failure returns the Korean retry message.
- **tests**: ["lib/game-ui/event-stream.test.ts","lib/game-ui/types.test.ts","tests/unit/toss-miniapp/App.test.tsx"]
- **validation**: ["npm test -- --run lib/game-ui/event-stream.test.ts lib/game-ui/types.test.ts tests/unit/toss-miniapp/App.test.tsx","npm run typecheck","git diff --check"]
