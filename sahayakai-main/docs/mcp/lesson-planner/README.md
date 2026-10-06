# Sahayak Lesson Planner — MCP server

Sahayak's lesson-planning engine, the same one Indian teachers use in the Sahayak app, exposed as a [Model Context Protocol](https://modelcontextprotocol.io) server. Any MCP-compatible AI agent or application can connect to it, discover its tool and generate classroom-ready lesson plans.

```
Your AI agent ──MCP (Streamable HTTP)──▶ Sahayak Lesson Planner MCP ──▶ Sahayak lesson-plan service ──▶ structured lesson plan
```

**At a glance**

| | |
|---|---|
| Endpoint | `POST https://<sahayak-host>/api/mcp/lesson-planner` (locally `http://localhost:3000/api/mcp/lesson-planner`) |
| Protocol | MCP Streamable HTTP, stateless, JSON responses |
| Tool | `create_lesson_plan` |
| Auth | `Authorization: Bearer sk_sahayak_…` (scope `lesson-planner`) |
| Try it locally | `npm run mcp:dev-key`, restart `npm run dev`, then `npm run mcp:lesson-planner:demo` |

### Quick start: run the demo locally (2 commands)

From `sahayakai-main/`:

```bash
npm run mcp:dev-key              # once: adds a LOCAL-ONLY key + pepper to .env.local
npm run dev                      # start (or restart) the Sahayak app (macOS / Linux)
npm run mcp:lesson-planner:demo  # in a second terminal: initialize → tools/list → create_lesson_plan
```

On **Windows**, `npm run dev` fails because the script path uses `/`. Start the app with:

```bash
node node_modules/next/dist/bin/next dev
```

The demo uses the official MCP SDK client, prints the lesson plan, and ends with `PASS` (exit code 0) or `FAIL` (exit code 1). If the app runs on another port, use `PORT=3100 npm run mcp:lesson-planner:demo`.

- **First call after starting the app:** about 1 minute, because Next.js compiles the route, then 10–40 s of generation.
- **Repeated identical calls:** come back almost instantly from Sahayak's lesson-plan cache.
- **Rate limit:** each key allows 15 calls per 10 minutes. A burst of demos can hit it; just wait.

### The 3-minute version

- **What:** Sahayak's lesson planner, offered as an MCP server, so a school's AI assistant or LMS can call it as a tool.
- **How:** the MCP is a thin, secured adapter in front of the **same** lesson-plan service the Sahayak app uses. There is no new AI, database or service.
- **Safe for outsiders:**
  - each school gets a scoped API key, and the key decides which organisation the call belongs to;
  - the same safety policy applies as in the app;
  - nothing is written to any teacher's account;
  - internals and secrets are never returned.
- **Reusable:** the auth, errors, logging and transport are shared, so MCP #2 (e.g. exam papers or quizzes) is a new folder plus a new scope.

## 1. What it does

It creates one lesson plan per call, for one topic and one grade (Class 1–12), designed for Indian classrooms:

- measurable learning objectives
- key vocabulary with student-friendly meanings
- a materials list
- a timed **5E teaching sequence** (Engage → Explore → Explain → Elaborate → Evaluate), with teacher tips and an understanding check per phase
- an assessment and homework

It adapts to the classroom's resources (chalkboard-only to projector), the difficulty level and **11 languages** (English, Hindi, Bengali, Gujarati, Kannada, Malayalam, Marathi, Odia, Punjabi, Tamil, Telugu). It can align to an NCERT chapter and uses familiar Indian examples by default.

## 2. Why use it

- **For schools and LMS vendors:** add lesson planning to your own product or teacher assistant without building and tuning it yourself.
- **For AI agents:** a dependable, structured tool; the result is typed JSON your agent can render, edit or chain into other steps.
- **You get the same engine as the Sahayak app:** the same safety policy, pedagogy and localisation. It is not a separate or weaker model.
- **Nothing is stored on Sahayak.** The plan is returned to you; it is not saved to any Sahayak account.

## 3. Tools

| Tool | Use it when |
|---|---|
| `create_lesson_plan` | A teacher needs a structured plan to teach one topic to one grade. **Not** for a quick explanation, a quiz or a worksheet. |

## 4. Schemas

### Input (`create_lesson_plan`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `topic` | string, 3–200 chars | **yes** | e.g. `"Photosynthesis"`, `"Equivalent fractions"`. One topic per call. |
| `grade` | integer 1–12 | **yes** | Indian Class 1–12. Pedagogy adapts to the grade band. |
| `subject` | string, 2–60 chars | no | e.g. `"Science"`. Recommended; inferred from the topic if omitted. |
| `language` | enum | no | One of the 11 languages above. Default `"English"`. |
| `classroom_resources` | `"low"` \| `"medium"` \| `"high"` | no | `low` = chalkboard only, `medium` = charts and basic aids, `high` = projector or devices. Default `"low"`. |
| `difficulty` | `"remedial"` \| `"standard"` \| `"advanced"` | no | Default `"standard"`. `"easy"`, `"medium"` and `"hard"` are accepted as aliases. |
| `use_local_context` | boolean | no | Indian, locally familiar examples (farming, monsoon, festivals, rupees). Default `true`. |
| `ncert_chapter` | object | no | `{ number: 1–40, title: string, learning_outcomes?: string[] (≤10) }`, to align with an NCERT chapter. |

Unknown fields are **rejected**: the schema uses `additionalProperties: false`.

### Output (`structuredContent`)

```json
{
  "title": "The Journey of Water: Understanding the Water Cycle",
  "grade": 6,
  "subject": "Science",
  "language": "English",
  "duration": "60 minutes",
  "learning_objectives": ["Describe the stages of the water cycle", "..."],
  "key_vocabulary": [{ "term": "Evaporation", "meaning": "When water turns into vapour because of heat" }],
  "materials": ["Chalkboard", "A steel tumbler", "..."],
  "activities": [
    {
      "phase": "Engage",
      "name": "Where did the puddle go?",
      "description": "...",
      "duration": "10 minutes",
      "teacher_tips": "...",
      "understanding_check": "..."
    }
  ],
  "assessment": "...",
  "homework": "...",
  "curriculum_note": null
}
```

- `activities` are in 5E order.
- `teacher_tips` and `understanding_check` may be `null`.
- `curriculum_note` is set only when the given NCERT chapter does not match the syllabus; the plan is still generated.

The tool also returns a short Markdown rendering in `content[0].text` for clients that only display text. Typical size is about 6–7 KB of JSON.

## 5. Example call

Endpoint: `POST https://<sahayak-host>/api/mcp/lesson-planner`, using MCP Streamable HTTP, stateless, with JSON responses.

**TypeScript (official MCP SDK):**

```ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const client = new Client({ name: 'my-school-assistant', version: '1.0.0' });
await client.connect(new StreamableHTTPClientTransport(new URL('https://<sahayak-host>/api/mcp/lesson-planner'), {
  requestInit: { headers: { Authorization: `Bearer ${process.env.SAHAYAK_MCP_API_KEY}` } },
}));

const result = await client.callTool(
  { name: 'create_lesson_plan', arguments: { topic: 'Fractions', grade: 5, subject: 'Mathematics', language: 'Hindi' } },
  undefined,
  { timeout: 120_000 }, // generation takes ~10–40 s; allow headroom
);
console.log(result.structuredContent);
```

**MCP client configuration (for clients that accept a remote server URL and headers):**

```json
{
  "mcpServers": {
    "sahayak-lesson-planner": {
      "type": "http",
      "url": "https://<sahayak-host>/api/mcp/lesson-planner",
      "headers": { "Authorization": "Bearer sk_sahayak_<your key>" }
    }
  }
}
```

**Raw JSON-RPC (curl):**

```bash
curl -s https://<sahayak-host>/api/mcp/lesson-planner \
  -H "Authorization: Bearer $SAHAYAK_MCP_API_KEY" \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"create_lesson_plan","arguments":{"topic":"Fractions","grade":5}}}'
```

## 6. Authentication

Every request needs a **Sahayak MCP API key**:

```
Authorization: Bearer sk_sahayak_<keyId>_<secret>
```

`X-API-Key: <key>` is also accepted. Keys are never accepted in the URL.

- Keys are issued by Sahayak for **one organisation (school, chain or government body)**. Your organisation is determined by the key; anything a client sends to claim a different organisation is ignored or rejected.
- The key is shown **once** when issued. Sahayak stores only a salted hash and cannot recover it; if it is lost, ask for a new key.
- Revoked keys, and keys of a removed organisation, stop working immediately.

## 7. Permissions (scopes)

Each key carries scopes, and each MCP server requires exactly one:

| MCP server | Endpoint | Required scope |
|---|---|---|
| Lesson Planner | `/api/mcp/lesson-planner` | `lesson-planner` |
| Exam Paper Generator | `/api/mcp/exam-paper` | `exam-paper` (see [../exam-paper/README.md](../exam-paper/README.md)) |

A valid key without the scope receives **403**, so a school can be granted only the capabilities it uses. A key for one server cannot call another server's tool.

## 8. Example agent workflow

1. The agent connects and calls `tools/list`. It sees `create_lesson_plan`, its description (when to use it), the input schema and the output schema.
2. A teacher asks: *"Plan tomorrow's Class 7 science lesson on photosynthesis. We only have a blackboard."*
3. The agent calls `create_lesson_plan` with `{ "topic": "Photosynthesis", "grade": 7, "subject": "Science", "classroom_resources": "low" }`.
4. It receives the structured plan and shows the 5E sequence, or asks a follow-up such as *"Want it in Hindi?"* and calls again with `"language": "Hindi"`.

## 9. Errors

**Request-level errors** come back as HTTP status plus a JSON-RPC error:

| HTTP | When | What to do |
|---|---|---|
| 401 | Missing, malformed, unknown or revoked key (same message for all, by design) | Check the key or ask for a new one |
| 403 | Key lacks the `lesson-planner` scope | Ask your Sahayak admin to grant it |
| 405 | Non-POST request (stateless server, no SSE stream) | Use POST |
| 413 | Body over 64 KB | Send a smaller request |
| 503 | Server not configured | Retry later or contact Sahayak |

**Invalid arguments** come back as a tool error (`isError: true`) with a precise message, for example:

```
Input validation error: Invalid arguments for tool create_lesson_plan: Invalid grade. Expected an integer between 1 and 12. at grade
```

**Generation failures** come back as a tool result with `isError: true` and machine-readable details:

```json
{ "error": { "category": "rate_limited", "message": "Rate limit reached for this API key. Retry after about 7 minutes.", "retryable": true, "retry_after_seconds": 420 } }
```

| `category` | Meaning | Retry? |
|---|---|---|
| `content_policy` | Topic refused by Sahayak's classroom safety policy | No; change the topic |
| `rate_limited` | Too many calls for this key | Yes, after `retry_after_seconds` |
| `upstream_unavailable` | Generation service busy | Yes, in about a minute |
| `timeout` | Generation took too long | Yes |
| `internal` | Unexpected failure (details are logged at Sahayak, never returned) | Yes, later |

Errors never include stack traces, internal hostnames, provider details or credentials.

**Rate limit:** 15 generations per 10 minutes per API key, as a sliding window. `tools/list` does not count.

## 10. Local development (Sahayak engineers)

The server is part of the Sahayak Next.js app (`sahayakai-main`) and uses npm.

```bash
npm ci                                   # install
npm run mcp:dev-key                      # local API key + pepper into .env.local (see below)
npm run dev                              # app + MCP at http://localhost:3000/api/mcp/lesson-planner
npm run mcp:lesson-planner:demo          # external-client demo: initialize → tools/list → create_lesson_plan
npx jest src/__tests__/lib/mcp           # MCP unit, security, external-client and integration tests
npm run lint
npm run typecheck
```

**Local API key (`npm run mcp:dev-key`).** This adds `MCP_API_KEY_PEPPER` and `MCP_LOCAL_DEV_API_KEY` to the gitignored `.env.local`, if they are missing. The dev key:

- is honoured **only by `next dev`** (`NODE_ENV=development`), and never by `next start` or a deployed server;
- is never written to Firestore;
- acts for the organisation `local-dev-org` with every MCP scope (`lesson-planner`, `exam-paper`).

Set `MCP_LOCAL_DEV_SCOPES=exam-paper` (comma-separated) to narrow it, e.g. to see the 403 path on this server locally.

**Production keys** are issued per school by an operator. The script is dry-run by default; `--apply` writes the hashed key to Firestore and prints the key once:

```bash
npx tsx scripts/mcp/create-api-key.ts --org <orgId> --scope lesson-planner --label "School LMS"
npx tsx scripts/mcp/create-api-key.ts --org <orgId> --scope lesson-planner --label "School LMS" --apply
npx tsx scripts/mcp/create-api-key.ts --revoke <keyId> --apply
```

**Test a deployed server** as an external client:

```bash
SAHAYAK_MCP_URL=https://<host>/api/mcp/lesson-planner SAHAYAK_MCP_API_KEY=sk_sahayak_... npm run mcp:lesson-planner:demo
```

Code map:

| Path | Purpose |
|---|---|
| `src/app/api/mcp/lesson-planner/route.ts` | Endpoint |
| `src/lib/mcp/` | Shared layer: `api-keys.ts`, `auth.ts`, `errors.ts`, `observability.ts`, `http-handler.ts` (reused by every future MCP server) |
| `src/lib/mcp/lesson-planner/` | This capability: `schema.ts` (public contract), `service.ts` (adapter to the existing lesson-plan service), `capability.ts` (tool registration) |
| `scripts/mcp/` | `dev-key.mjs` (local key), `demo.mjs` (external-client demo), `create-api-key.ts` (production keys) |

## 11. Architecture

```
External AI agent / LMS
   │  MCP Streamable HTTP POST, Authorization: Bearer sk_sahayak_…
   ▼
/api/mcp/lesson-planner                       (route in the existing Next.js app)
   │  middleware: /api/mcp/ is public, so no Firebase login; identity headers are stripped
   ▼
src/lib/mcp/http-handler.ts                   shared by every Sahayak MCP server
   ├─ auth.ts           verify the hashed key, require the scope, tenant = the key's organisation
   ├─ body limit        64 KB on the bytes actually received
   ├─ rate limit        existing checkServerRateLimit("mcp_<keyId>")
   ├─ McpServer + WebStandardStreamableHTTPServerTransport (stateless, JSON)
   └─ errors.ts / observability.ts   categorised errors, one log line per call
        │
        ▼
src/lib/mcp/lesson-planner/                   this capability
   schema.ts → service.ts (adapter) → existing dispatchLessonPlan(...)
                                         ├─ safety check, cache, feature flags
                                         └─ Genkit flow or ADK sidecar (same as the app)
        │
        ▼
structured lesson plan (internal fields mapped away; nothing written to any teacher account)
```

## 12. Deployment

There is **no new service**. The MCP ships inside the existing Sahayak web app on Cloud Run and follows the normal pipeline in `AGENTS.md`: push to `main` creates a no-traffic revision, then `scripts/audit-deployments.sh`, then a manual traffic flip.

| Item | Value |
|---|---|
| Endpoint | `https://<sahayak-host>/api/mcp/lesson-planner` (POST only) |
| Required env | `MCP_API_KEY_PEPPER`: ≥32 random characters, stored in **Secret Manager** and mounted like the other app secrets. Unset means every `/api/mcp/*` returns 503 (fail closed). Rotating it invalidates all keys. |
| Data | Firestore `mcp_api_keys/{keyId}` (server-only; client rules default-deny), plus `rate_limits/mcp_<keyId>` |
| Health check | `/api/health` (app). A deep check is `npm run mcp:lesson-planner:demo` with `SAHAYAK_MCP_URL` and a monitoring key. |
| Logging | Cloud Logging, `service: "mcp"`: request id, tool, key id, org id, duration, outcome, error category. No keys, prompts or generated content. |
| Rate limiting | 15 generations / 10 min per key (existing `checkServerRateLimit`) |
| Timeouts | Route `maxDuration` 120 s; clients should allow about 120 s per call |
| Rollback | Shift traffic back to the previous revision (`docs/ROLLBACK.md`). To disable without a deploy, revoke keys, or remove `MCP_API_KEY_PEPPER` (all MCP endpoints return 503). |

## 13. Security considerations

- **Authentication** is in the handler with scoped, hashed API keys (HMAC-SHA256 with a server-side pepper; constant-time comparison). Bad credentials all return the same message, so key ids cannot be probed.
- **Tenancy** comes only from the verified key record. Request bodies are strict, so client-supplied `org_id` or tenant fields are rejected, and identity headers are stripped by the middleware.
- **Least privilege:** one scope per capability, and the tool is read-only. It writes nothing into any Sahayak teacher account or library, and never reads student data.
- **Same content policy as the app:** unsafe topics are refused before any model call.
- **No leakage:** internal service fields such as engine choice, evaluator telemetry and cache data are mapped away. Errors are categorised with fixed messages.
- **Abuse limits:** per-key rate limit, a 64 KB body limit enforced on the bytes actually received, and POST only.
- **Operational:** issue keys per integration (not per school-wide shared secret), revoke on staff or vendor change, and keep the pepper only in Secret Manager.

## 14. Limitations (v1.0.0)

- One topic and one grade per call; no textbook-image input yet.
- No streaming or progress updates: the transport is stateless JSON. Allow about 120 s per call (typically 10–40 s).
- A fixed per-key quota (15 / 10 min). There are no per-plan quotas or usage reports per organisation yet.
- Keys are issued by a Sahayak operator; there is no self-service key UI.
- Output is AI-generated: teachers should review plans before classroom use.
