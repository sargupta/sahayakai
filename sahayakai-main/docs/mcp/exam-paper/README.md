# Sahayak Exam Paper Generator — MCP server

Sahayak's exam-paper engine, the same one Indian teachers use in the Sahayak app, exposed as a [Model Context Protocol](https://modelcontextprotocol.io) server. Any MCP-compatible AI agent or application can connect to it, discover its tool and generate complete, board-pattern exam papers.

```
Your AI agent ──MCP (Streamable HTTP)──▶ Sahayak Exam Paper MCP ──▶ Sahayak exam-paper service ──▶ structured exam paper
```

**At a glance**

| | |
|---|---|
| Endpoint | `POST https://<sahayak-host>/api/mcp/exam-paper` (locally `http://localhost:3000/api/mcp/exam-paper`) |
| Protocol | MCP Streamable HTTP, stateless, JSON responses |
| Tool | `create_exam_paper` |
| Auth | `Authorization: Bearer sk_sahayak_…` (scope `exam-paper`) |
| Response time | Typically **40–60 s** (measured locally: 41 s for an 80-mark paper, 57 s for a 20-mark paper). Service budget 75 s; allow **180 s** per call. |
| Try it locally | `npm run mcp:dev-key`, restart the app, then `npm run mcp:exam-paper:demo` |

### Quick start: run the demo locally

From `sahayakai-main/`:

```bash
npm run mcp:dev-key           # once: adds a LOCAL-ONLY key + pepper to .env.local
npm run dev                   # start (or restart) the Sahayak app (macOS / Linux)
npm run mcp:exam-paper:demo   # second terminal: initialize → tools/list → create_exam_paper
```

On **Windows**, `npm run dev` fails because the script path uses `/`. Start the app with:

```bash
node node_modules/next/dist/bin/next dev
```

The demo asks for a **CBSE Class 8 Science paper on "Force and Pressure", medium difficulty**, prints the paper and ends with `PASS` (exit 0) or `FAIL` (exit 1). Use `PORT=3100 npm run mcp:exam-paper:demo` if the app runs on another port.

### The 3-minute version

- **What:** Sahayak's exam-paper generator as an MCP server, so a school's AI assistant or LMS can create a full exam paper with one tool call.
- **How:** a thin, secured adapter in front of the **same** exam-paper service the Sahayak app uses: board blueprints, previous-year-question retrieval, safety check, marks reconciliation and answer-key backfill. There is no new AI or service.
- **Safe for outsiders:** scoped API key (the key decides the organisation), the app's safety policy, nothing written to any teacher account, no internals or secrets returned.
- **Reused:** auth, errors, logging, rate limiting and transport are the shared layer built for the Lesson Planner MCP; this server is one new folder plus the `exam-paper` scope.

## 1. What it does

It creates one exam paper per call, for one subject and one grade (Class 1–12):

- a title, duration, maximum marks and general instructions
- sections (e.g. A: MCQ, B: short answer, C: long answer, D: case study) with numbered questions and marks
- MCQ options and the correct option, internal ("OR") choices
- optionally an **answer key** and a **step-wise marking scheme** for every question
- a blueprint summary (marks per chapter, difficulty mix) and the previous-year papers that were drawn on

Where Sahayak has the official board blueprint (CBSE Class 9–10), the paper follows it exactly. Other boards and grades follow the board style for the syllabus. Papers can be generated in **11 languages**.

## 2. Why use it

- **For schools and LMS vendors:** offer board-pattern unit tests, half-yearly papers and board practice papers without building a question bank pipeline.
- **For AI agents:** one call returns a typed, complete paper the agent can render, print or edit.
- **Same engine as the app:** the same safety policy, blueprints, PYQ retrieval and quality checks. Not a separate or weaker model.
- **Honest output:** anything a teacher must check is listed in `review_notes` (for example, a chapter not found in the syllabus, a marks mismatch or answers that could not be generated reliably).
- **Nothing is stored on Sahayak.** The paper is returned to you, not saved to any Sahayak account.

## 3. Tools

| Tool | Use it when |
|---|---|
| `create_exam_paper` | A teacher needs a test or exam paper (unit test, half-yearly, board practice). **Not** for a quick quiz (use the Quiz MCP) or a lesson plan (use the Lesson Planner MCP). |

## 4. Schemas

### Input (`create_exam_paper`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `grade` | integer 1–12 | **yes** | Indian Class 1–12. |
| `subject` | string, 2–60 chars | **yes** | e.g. `"Science"`, `"Mathematics"`. |
| `board` | enum | no | `"CBSE"` (default), `"ICSE / ISC"` or one of the Indian state boards Sahayak lists. |
| `chapters` | string[] (≤20, each 2–150 chars) | no | e.g. `["Force and Pressure"]`. Omit or `[]` for the whole syllabus, which needs a Sahayak blueprint or NCERT syllabus for that grade and subject; otherwise you get `invalid_input` asking for chapters. |
| `difficulty` | `"easy"` \| `"moderate"` \| `"hard"` \| `"mixed"` | no | Default `"mixed"` (board distribution). `"medium"` is accepted as `"moderate"`. |
| `language` | enum | no | English, Hindi, Bengali, Gujarati, Kannada, Malayalam, Marathi, Odia, Punjabi, Tamil, Telugu. Default `"English"`. |
| `max_marks` | integer 5–100 | no | Default: the board blueprint. See limitations. |
| `duration_minutes` | integer 10–180 | no | Default: the board blueprint. See limitations. |
| `pyq_percent` | number 0–100 | no | Target share of previous-year-style questions. Default: Sahayak's mix. |
| `include_answer_key` | boolean | no | Default `true`. |
| `include_marking_scheme` | boolean | no | Default `true`. |

Unknown fields are **rejected** (`additionalProperties: false`), including any organisation, user or tenant id. There is no "exam type" field because the service has none; a short unit test is a small `max_marks` and `duration_minutes` with one or two `chapters`.

### Output (`structuredContent`)

```json
{
  "title": "CBSE Class 8 Science Sample Paper",
  "board": "CBSE", "grade": 8, "subject": "Science", "language": "English",
  "duration": "3 Hours", "max_marks": 80, "total_question_marks": 80,
  "general_instructions": ["This question paper comprises five sections: A, B, C, D and E.", "..."],
  "sections": [
    {
      "name": "Section A", "label": "Multiple Choice Questions (MCQs)", "total_marks": 20,
      "questions": [
        {
          "number": 2, "text": "The SI unit of pressure is:", "marks": 1,
          "origin": "new", "source_note": null,
          "options": ["(a) Pascal (Pa)", "(b) Newton (N)", "(c) Joule (J)", "(d) Watt (W)"],
          "correct_option": "a", "internal_choice": null,
          "answer_key": "(a) Pascal (Pa)", "marking_scheme": "1 mark for the correct option."
        }
      ]
    }
  ],
  "blueprint": { "chapter_marks": [{ "chapter": "Force and Pressure", "marks": 80 }], "difficulty_mix": [{ "level": "moderate", "percentage": 50 }] },
  "previous_year_sources": [],
  "review_notes": ["Chapter \"Force and Pressure\" was not found in the Class 8 Science syllabus. Did you mean \"…\"?"]
}
```

- `origin` is `previous_year` (adapted from a past board paper; `source_note` like `"PYQ 2023 Set 1"`) or `new`.
- `options` is empty and `correct_option` is `null` for non-MCQ questions.
- `answer_key` and `marking_scheme` are `null` when not requested.
- `total_question_marks` is the sum of all question marks; it equals `max_marks` for a balanced paper, and `review_notes` says so when it does not.

The tool also returns a Markdown rendering of the question paper (without answers) in `content[0].text`. An 80-mark paper is typically 25–35 KB of JSON.

## 5. Example call

```ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const client = new Client({ name: 'my-school-assistant', version: '1.0.0' });
await client.connect(new StreamableHTTPClientTransport(new URL('https://<sahayak-host>/api/mcp/exam-paper'), {
    requestInit: { headers: { Authorization: `Bearer ${process.env.SAHAYAK_API_KEY}` } },
}));
const res = await client.callTool(
    { name: 'create_exam_paper', arguments: { grade: 8, subject: 'Science', chapters: ['Force and Pressure'], difficulty: 'medium' } },
    undefined,
    { timeout: 180_000 }, // generation usually takes 40–60 s
);
console.log(res.structuredContent);
```

Raw JSON-RPC (no SDK):

```bash
curl -s https://<sahayak-host>/api/mcp/exam-paper \
  -H "Authorization: Bearer $SAHAYAK_API_KEY" \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  --max-time 180 \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"create_exam_paper","arguments":{"grade":8,"subject":"Science","chapters":["Force and Pressure"]}}}'
```

## 6. Response time and timeouts

| | |
|---|---|
| Typical | 40–60 s (one model pass plus Sahayak's checks) |
| Service budget | 75 s (`EXAM_PAPER_GENKIT_TIMEOUT_MS`); past it the call returns a retryable `timeout` error |
| Route limit | `maxDuration` 180 s |
| Client setting | Allow **180 s** per call |
| Streaming | None. The transport is stateless JSON and the service returns the paper in one piece, so there are no partial results or progress events. |

Fewer chapters and lower `max_marks` generate faster.

## 7. Permissions (scopes)

| MCP server | Endpoint | Required scope |
|---|---|---|
| Lesson Planner | `/api/mcp/lesson-planner` | `lesson-planner` |
| Exam Paper Generator | `/api/mcp/exam-paper` | `exam-paper` |
| Quiz Generator | `/api/mcp/quiz` | `quiz` |

A key without `exam-paper` receives **403** here. An `exam-paper` key cannot call the other servers, and each server exposes only its own tool.

## 8. Errors

Request-level errors (HTTP 401 / 403 / 405 / 413 / 503) and invalid-argument errors behave exactly as in the [Lesson Planner MCP](../lesson-planner/README.md#9-errors). Generation failures return `isError: true` with `_meta["sahayak/error"] = { category, message, retryable, retry_after_seconds? }` (never `structuredContent`, which always matches the output schema):

| `category` | Meaning | Retry? |
|---|---|---|
| `invalid_input` | Whole-syllabus paper requested where Sahayak has no blueprint or syllabus; list `chapters` | No; change the input |
| `content_policy` | Refused by Sahayak's classroom safety policy (board, subject and chapters are checked) | No |
| `capability_disabled` | Sahayak has temporarily switched exam papers off | No; try later |
| `timeout` | Over the 75 s generation budget | Yes; fewer chapters or lower `max_marks` help |
| `generation_failed` | The model could not produce a well-formed paper | Yes |
| `rate_limited` | Too many calls for this key | Yes, after `retry_after_seconds` |
| `upstream_unavailable` | Model provider busy | Yes, in about a minute |
| `internal` | Unexpected failure (logged at Sahayak, never returned) | Yes, later |

**Rate limit:** 15 generations per 10 minutes per API key (shared Sahayak limiter). `tools/list` does not count.

## 9. How it stays headless and side-effect free

The MCP calls the existing `dispatchExamPaper` with an **empty user id**, which is the service's own "no teacher" path. Every side effect in the service is guarded by a user id, so an MCP call:

- writes **nothing** to any teacher's My Library (no "generating" placeholder, no saved paper, no content id);
- reads no teacher profile and no teacher context;
- does not consume any teacher's rate limit (the MCP's per-key limit applies instead).

Safety checks, feature flags (`examPaperEnabled` is honoured as a kill switch) and the quality passes all still run. The one shared write is Sahayak's existing engine-parity telemetry (`agent_shadow_diffs`), which only runs while the sidecar is in shadow or canary rollout and contains no account data.

Gates: `src/__tests__/lib/mcp/exam-paper-integration.test.ts` (real dispatcher, records every Firestore and Storage write; must be zero) and `src/__tests__/ai/exam-paper-headless-no-persist.test.ts` (real flow; headless writes nothing, a teacher still gets the Library lifecycle).

## 10. Code map

| Path | Purpose |
|---|---|
| `src/app/api/mcp/exam-paper/route.ts` | Endpoint (wires the real service, feature flag and syllabus check) |
| `src/lib/mcp/exam-paper/schema.ts` | Public contract (input and output) |
| `src/lib/mcp/exam-paper/service.ts` | Adapter: input mapping, pre-checks, error mapping, output mapping, review notes |
| `src/lib/mcp/exam-paper/capability.ts` | Tool registration, description, annotations |
| `src/lib/mcp/` | Shared layer (auth, keys, errors, logging, HTTP handler) |
| `src/lib/mcp/shared/schema.ts` | Shared field definitions (grade, language) |

Issue a production key (dry-run first, then `--apply`):

```bash
npx tsx scripts/mcp/create-api-key.ts --org <orgId> --scope exam-paper --label "School LMS"
```

Deployment, logging, rollback and security model are the same as the Lesson Planner MCP ([README §12–13](../lesson-planner/README.md#12-deployment)). The only difference is `maxDuration` 180 s.

## 11. Limitations (v1.0.0)

- **`max_marks` and `duration_minutes` are only reliably honoured where Sahayak has a board blueprint (CBSE Class 9–10).** For other boards and grades the existing service does not pass these values to the model, so the paper may use its own total and duration (for example "3 Hours, 80 marks" for Class 8). `review_notes` flags any mismatch. This is a limitation of the shared service and affects the app too; it will be fixed there, not worked around in the MCP.
- The syllabus check follows the current NCERT (rationalised) books. A traditional chapter name such as "Force and Pressure" for Class 8 can be flagged as not found; the paper is still generated and the note explains it.
- During a sidecar canary rollout, every MCP call is routed like the first canary bucket, because rollout buckets are keyed on the teacher id and an MCP call has none.
- No streaming or progress updates; allow 180 s per call.
- One paper per call; no image or PDF output (render `structuredContent` yourself).
- Fixed per-key quota (15 / 10 min); keys are issued by a Sahayak operator.
