# MCP Lesson Planner — demo UI

`/mcp-demo/lesson-planner` is the Sahayak Lesson Planner page, rebuilt from the same components, whose **Generate** button goes through the public Sahayak MCP server instead of the app's own API. Same capability, different consumption model.

The existing `/lesson-plan` page is unchanged.

## Architecture

```
Browser  /mcp-demo/lesson-planner                      (signed-in Sahayak user; no API key in the bundle)
   │  POST /api/mcp-demo/lesson-planner  { topic, grade, subject, language, difficulty, … }
   ▼
src/app/api/mcp-demo/lesson-planner/route.ts           requires x-user-id (Firebase session via middleware)
   │  src/lib/mcp-demo/lesson-planner-client.ts         server-only; official MCP SDK Client
   │  Streamable HTTP, Authorization: Bearer <server-held MCP key>
   ▼
POST /api/mcp/lesson-planner                           MCP #1, unchanged: API-key auth, scope, per-key rate limit
   │  initialize → tools/call create_lesson_plan
   ▼
Sahayak lesson-plan service (dispatchLessonPlan)       safety, cache, Genkit / ADK sidecar
```

- `GET /api/mcp-demo/lesson-planner` performs `initialize` + `tools/list` only. It drives the "Sahayak MCP · Connected · Tool: create_lesson_plan" status pill and costs no generation.
- The browser receives only the lesson content plus the public server identity (name, version, tool, protocol, duration). It never receives the key, the MCP URL, ids or telemetry.

## Configuration (server only)

| Variable | Meaning |
|---|---|
| `MCP_DEMO_API_KEY` | A normal scoped key (`npx tsx scripts/mcp/create-api-key.ts --org <orgId> --scope lesson-planner --label "MCP demo UI"`). Keep it in Secret Manager in a deployed environment. |
| `MCP_DEMO_SERVER_URL` | Optional. The MCP endpoint; default `http://127.0.0.1:$PORT/api/mcp/lesson-planner`. It is never taken from the request's Host header. |
| *(local only)* `MCP_LOCAL_DEV_API_KEY` | Under `next dev`, the key from `npm run mcp:dev-key` is used when `MCP_DEMO_API_KEY` is unset. |

With no key configured, the page shows "Not configured" and the API answers 503.

## Run locally

```bash
npm run mcp:dev-key                         # once
node node_modules/next/dist/bin/next dev    # Windows; `npm run dev` elsewhere
```

Open `http://localhost:3000/mcp-demo/lesson-planner`, or open it prefilled (this never auto-submits):

`http://localhost:3000/mcp-demo/lesson-planner?topic=Photosynthesis&grade=7&subject=Science&language=English&difficulty=medium`

## Notes

- The inputs are only those the MCP schema supports: topic, class, subject, language, resources, difficulty (`medium` = "Standard (Class Level)"), local examples and NCERT chapter. There is no image upload and no multi-class selection.
- The result has a **Copy** action only. Save and Share are Library actions of a teacher account and do not apply to an MCP result.
- Repeating identical inputs returns Sahayak's cached plan in about 1 s; the request still goes through MCP. A new topic takes about 20–40 s.
- Tests: `src/__tests__/app/mcp-demo-lesson-planner.test.tsx` (UI), `src/__tests__/lib/mcp-demo/lesson-planner-demo-route.test.ts` (route → SDK client → real MCP handler), `src/__tests__/lib/mcp-demo/no-client-secrets.test.ts` (class gate: browser code holds no key).
