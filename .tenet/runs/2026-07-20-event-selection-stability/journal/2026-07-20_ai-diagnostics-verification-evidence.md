# AI diagnostics verification evidence

type: journal
source_job: 138c316a-1096-4d8f-b5e1-1821c9a9ba10
job_name: AI timeout, choice diagnostics, and latency
created: 2026-07-20T07:44:50.402Z

## Findings

- **commit**: bf366ab
- **focused_command**: npx vitest run tests/unit/api/event-authority-stateful-routes.test.ts --reporter=verbose
- **focused_result**: 1 file passed, 16 tests passed
- **typecheck**: npm run typecheck passed
- **lint**: npm run lint passed with 0 errors and 15 pre-existing warnings
- **build**: npm run build passed
- **scope**: Only tests/unit/api/event-authority-stateful-routes.test.ts changed in final retry; no .tenet/project changes
- **runtime_note**: Sandbox denied socket binding with EPERM; direct JSON/SSE route-handler tests returned HTTP 200 per harness Layer 1 allowance
