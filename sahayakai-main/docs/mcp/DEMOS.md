# Sahayak MCP — the four demos

One page to run and check every public Sahayak MCP capability locally. Each demo has two ways in:

- **CLI**: `scripts/mcp/demo.mjs`, an official MCP SDK client that does `initialize` → `tools/list` → `tools/call`, exactly like an external school's agent.
- **Demo UI**: `/mcp-demo/<capability>`. The browser calls `/api/mcp-demo/<capability>` (a signed-in Sahayak user is required); that route holds the MCP API key server-side and calls the MCP endpoint with the official SDK client. The browser never receives the key or the MCP URL.

| # | MCP | Endpoint | Tool(s) | Demo UI | CLI |
|---|---|---|---|---|---|
| 1 | Lesson Planner | `POST /api/mcp/lesson-planner` | `create_lesson_plan` | `/mcp-demo/lesson-planner` | `npm run mcp:lesson-planner:demo` |
| 2 | Exam Paper | `POST /api/mcp/exam-paper` | `create_exam_paper` | `/mcp-demo/exam-paper` | `npm run mcp:exam-paper:demo -- --twice` |
| 3 | Quiz | `POST /api/mcp/quiz` | `create_quiz` | `/mcp-demo/quiz` | `npm run mcp:quiz:demo` |
| 4 | Parent Calling | `POST /api/mcp/calling` | `list_parent_contacts`, `initiate_parent_call` | `/mcp-demo/calling` | `npm run mcp:calling:demo` (read-only, never dials) |

`--twice` runs the tool twice on the same MCP client; works for any capability.

## Setup (Windows)

```bash
npm run mcp:dev-key                                  # once: local-only key + pepper in .env.local
node node_modules/next/dist/bin/next dev -p 3000     # `npm run dev` fails on Windows
```

Then run any CLI command above (another port: `PORT=3100 npm run mcp:quiz:demo`), or open a demo URL **signed in to Sahayak**. Signed out, the pages say so and send nothing. The first call after the server starts compiles the route and is slower.

## Server configuration (demo BFFs)

| Demo | Key variable (scoped key) | Optional URL variable |
|---|---|---|
| Lesson Planner | `MCP_DEMO_API_KEY` (`lesson-planner`) | `MCP_DEMO_SERVER_URL` |
| Exam Paper | `MCP_EXAM_PAPER_API_KEY` (`exam-paper`) | `MCP_EXAM_PAPER_SERVER_URL` |
| Quiz | `MCP_QUIZ_API_KEY` (`quiz`) | `MCP_QUIZ_SERVER_URL` |
| Parent Calling | `MCP_CALLING_DEMO_API_KEY` (`calling`) | `MCP_CALLING_DEMO_SERVER_URL` |

Under `next dev` only, each falls back to `MCP_LOCAL_DEV_API_KEY`. The URL defaults to `http://127.0.0.1:$PORT/api/mcp/<capability>` and is never taken from the request's Host header. With no key, the page shows "Not configured" and the API answers 503.

## Tool errors

A failed call returns `isError: true`, a readable `content` text, and `_meta["sahayak/error"] = { category, message, retryable, retry_after_seconds? }`. It never carries `structuredContent`. The SDK client validates `structuredContent` against the tool's output schema even on errors, so an error object there used to surface as `MCP error -32602: Structured content does not match the tool's output schema`. Gate: `src/__tests__/lib/mcp/mcp-error-results.test.ts` (all four capabilities, `tools/list` then a failing call, twice per client).

## Parent Calling: what can and cannot be shown locally

- The local dev key belongs to organisation `local-dev-org`, which has no members in the connected Firebase project, so `list_parent_contacts` returns `{ "classes": [] }` and `initiate_parent_call` answers `not_found` at the organisation/class authorization step. See [calling/DEV_DEMO_DATA.md](calling/DEV_DEMO_DATA.md).
- No telephony provider is configured in `.env.local`, so a call that passed authorization would stop with `not_configured` (the existing call route's 503) before dialling.
- The whole path (message → outreach record → call route → provider request, with plan, ownership, 5-minute dedup and quiet-hours checks) is proven in-process by `src/__tests__/lib/mcp/calling-mcp.test.ts`, with the provider HTTP call mocked. No real call has been placed.
- A real call needs a non-production Firebase project with the teacher's org membership and a class/student, a `calling` key for that org, provider credentials, and a confirmed test number (`TWILIO_TEST_OVERRIDE_NUMBER`).

## Dev-only note

Under `next dev`, Sahayak's middleware treats a request with **no** token as `dev-user-123` (`src/middleware.ts`), so the demo APIs answer unauthenticated `curl` calls locally. Outside development the same request gets 401, and an invalid token gets 401 in both.
