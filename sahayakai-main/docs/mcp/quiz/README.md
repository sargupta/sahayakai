# Sahayak Quiz Generator — MCP server

Sahayak's quiz engine, the same one Indian teachers use in the Sahayak app, exposed as a [Model Context Protocol](https://modelcontextprotocol.io) server. Any MCP-compatible AI agent or application can connect to it, discover its tool and generate classroom quizzes with answers and explanations.

```
Your AI agent ──MCP (Streamable HTTP)──▶ Sahayak Quiz MCP ──▶ Sahayak quiz service ──▶ structured quiz
```

**At a glance**

| | |
|---|---|
| Endpoint | `POST https://<sahayak-host>/api/mcp/quiz` (locally `http://localhost:3000/api/mcp/quiz`) |
| Protocol | MCP Streamable HTTP, stateless, JSON responses |
| Tool | `create_quiz` |
| Auth | `Authorization: Bearer sk_sahayak_…` (scope `quiz`) |
| Response time | Typically **15–40 s** (measured locally: 34 s for a 5-question quiz). Service budget 60 s; allow **120 s** per call. |
| Try it locally | `npm run mcp:dev-key`, restart the app, then `npm run mcp:quiz:demo` |

### Quick start: run the demo locally

From `sahayakai-main/`:

```bash
npm run mcp:dev-key      # once: adds a LOCAL-ONLY key + pepper to .env.local
npm run dev              # start (or restart) the Sahayak app (macOS / Linux)
npm run mcp:quiz:demo    # second terminal: initialize → tools/list → create_quiz
```

On **Windows**, `npm run dev` fails because the script path uses `/`. Start the app with:

```bash
node node_modules/next/dist/bin/next dev
```

The demo asks for a **Class 7 Mathematics quiz on Fractions: medium, 5 questions, English**. It prints the questions and the answer key, then `PASS` (exit 0) or `FAIL` (exit 1). Use `PORT=3100 npm run mcp:quiz:demo` if the app runs on another port.

### The 3-minute version

- **What:** Sahayak's quiz generator as an MCP server, so a school's AI assistant or LMS can create a ready-to-use quiz with one tool call.
- **How:** a thin, secured adapter in front of the **same** quiz service the Sahayak app uses: grade-aware question counts, vocabulary control by grade band, NCERT topic matching, output validation, Genkit or ADK sidecar. There is no new AI or service.
- **Safe for outsiders:** scoped API key (the key decides the organisation), Sahayak's topic safety policy on every call, nothing written to any teacher account, no internals or secrets returned.
- **Reused:** the shared MCP layer from the Lesson Planner MCP; this server is one new folder plus the `quiz` scope.

## 1. What it does

It creates a quiz on one topic for one grade (Class 1–12):

- multiple-choice, true/false, fill-in-the-blank and short-answer questions (you choose the mix)
- the correct answer and a student-friendly explanation for every question, usually with an Indian everyday example
- a title and tips for running the quiz in a chalk-and-board classroom
- **one difficulty level, or easy, medium and hard versions of the same quiz** for differentiated teaching
- **11 languages**: English, Hindi, Bengali, Gujarati, Kannada, Malayalam, Marathi, Odia, Punjabi, Tamil, Telugu

## 2. Why use it

- **For schools and LMS vendors:** instant practice and check-for-understanding quizzes inside your product.
- **For AI agents:** typed JSON with answers and explanations, ready to render, grade or turn into a form.
- **Same engine as the app:** the same prompts, grade-band vocabulary control and output validation. Not a separate or weaker model.
- **Nothing is stored on Sahayak.**

## 3. Tools

| Tool | Use it when |
|---|---|
| `create_quiz` | A teacher wants a short quiz for practice or a quick check of understanding. **Not** for a full board-pattern exam paper (use the Exam Paper MCP) or a lesson plan (use the Lesson Planner MCP). |

## 4. Schemas

### Input (`create_quiz`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `topic` | string, 3–200 chars | **yes** | e.g. `"Fractions"`. One topic per call. |
| `grade` | integer 1–12 | **yes** | Indian Class 1–12. |
| `subject` | string, 2–60 chars | no | e.g. `"Mathematics"`. Recommended. |
| `num_questions` | integer 1–20 | no | Default by grade: Class 1–5 → 5, 6–8 → 10, 9–10 → 15, 11–12 → 20 (the app's defaults). |
| `question_types` | array of `"multiple_choice"`, `"true_false"`, `"fill_in_the_blanks"`, `"short_answer"` | no | Default `["multiple_choice", "short_answer"]`. |
| `difficulty` | `"easy"` \| `"medium"` \| `"hard"` | no | One level. **Omit to get all three levels** of the same quiz. |
| `blooms_levels` | array of `"Remember"`, `"Understand"`, `"Apply"`, `"Analyze"`, `"Evaluate"`, `"Create"` | no | Default `["Remember", "Understand"]`. |
| `language` | enum | no | One of the 11 languages above. Default `"English"`. |

Unknown fields are **rejected** (`additionalProperties: false`), including any organisation, user or tenant id. The app's textbook-photo input is not offered (see limitations).

### Output (`structuredContent`)

```json
{
  "topic": "Fractions", "grade": 7, "subject": "Mathematics", "language": "English",
  "quizzes": [
    {
      "difficulty": "medium",
      "title": "Understanding Fractions: A Rural Life Quiz",
      "teacher_instructions": "Write each question on the board …",
      "questions": [
        {
          "number": 1, "type": "multiple_choice",
          "question": "Shanti's mother cut a roti into 8 equal pieces. Shanti ate 3. What fraction did she eat?",
          "options": ["1/8", "3/8", "5/8", "8/3"],
          "correct_answer": "3/8",
          "explanation": "Pieces eaten over total pieces: 3 out of 8, so 3/8."
        }
      ]
    }
  ],
  "review_notes": []
}
```

- `quizzes` has one entry per requested level, in order easy → medium → hard.
- `options` is empty for short-answer and fill-in-the-blank questions.
- `review_notes` lists what a teacher should know: the topic was matched to a specific NCERT chapter, a quiz has fewer questions than asked, or one level could not be generated.

`content[0].text` holds a Markdown rendering of the questions **without answers**, so it is safe to show to students. A 5-question quiz is about 3–4 KB of JSON.

## 5. Example call

```ts
const res = await client.callTool(
    { name: 'create_quiz', arguments: { topic: 'Fractions', grade: 7, subject: 'Mathematics', difficulty: 'medium', num_questions: 5 } },
    undefined,
    { timeout: 120_000 },
);
```

Connecting is the same as for the other Sahayak MCP servers (see the [Lesson Planner README §5](../lesson-planner/README.md#5-example-call)), with the URL `https://<sahayak-host>/api/mcp/quiz`.

## 6. Response time and timeouts

| | |
|---|---|
| Typical | 15–40 s |
| Service budget | 60 s (`QUIZ_FALLBACK_TIMEOUT_MS`); past it the call returns a retryable `timeout` error |
| Route limit | `maxDuration` 120 s (the same as the app's quiz API) |
| Client setting | Allow **120 s** per call |
| Streaming | None. The transport is stateless JSON. |

The service always generates the three levels in parallel (that is how the app works), so asking for one level is **not** faster than asking for all three; it only makes the response smaller. Fewer questions generate faster.

## 7. Permissions (scopes)

| MCP server | Endpoint | Required scope |
|---|---|---|
| Lesson Planner | `/api/mcp/lesson-planner` | `lesson-planner` |
| Exam Paper Generator | `/api/mcp/exam-paper` | `exam-paper` |
| Quiz Generator | `/api/mcp/quiz` | `quiz` |

A key without `quiz` receives **403** here. A `quiz` key cannot call the other servers, and each server exposes only its own tool (tested as a full 3 × 3 matrix).

## 8. Errors

Request-level errors (HTTP 401 / 403 / 405 / 413 / 503) and invalid-argument errors behave exactly as in the [Lesson Planner MCP](../lesson-planner/README.md#9-errors). Generation failures return `isError: true` with `structuredContent.error = { category, message, retryable, retry_after_seconds? }`:

| `category` | Meaning | Retry? |
|---|---|---|
| `content_policy` | Topic or subject refused by Sahayak's classroom safety policy | No |
| `timeout` | Over the 60 s generation budget | Yes; fewer questions help |
| `generation_failed` | No well-formed quiz could be produced, or the requested level failed (a different level is never substituted) | Yes |
| `rate_limited` | Too many calls for this key | Yes, after `retry_after_seconds` |
| `upstream_unavailable` | Model provider busy | Yes, in about a minute |
| `internal` | Unexpected failure (logged at Sahayak, never returned) | Yes, later |

**Rate limit:** 15 generations per 10 minutes per API key (shared Sahayak limiter). `tools/list` does not count.

## 9. How it stays headless, safe and side-effect free

The MCP calls the existing `dispatchQuiz` with an **empty user id**, the service's own "no teacher" path. Everything account-related in the quiz service is guarded by the user id, so an MCP call:

- writes **nothing**: no Storage file under `users/…/quizzes/`, no My Library document;
- reads no teacher profile, preferred language or teacher context;
- meters no Gemini usage against any teacher and uses no teacher's rate limit (the MCP's per-key limit applies instead).

**Safety.** The quiz service applies Sahayak's topic policy (`validateTopicSafety`) only on its sidecar path. The MCP therefore runs that same policy on the topic and subject **before every call**, like the Lesson Planner and Exam Paper MCPs. The app's own behaviour is unchanged.

Gates:

- `src/__tests__/lib/mcp/quiz-integration.test.ts` runs the real dispatcher and the real `generateQuiz`, in both Genkit and sidecar modes. It records every Firestore and Storage write and requires zero; it also shows a teacher call still saves.
- `src/__tests__/ai/quiz-headless-no-persist.test.ts` runs the real service and flow, and covers storage, Library, profile, teacher context and usage metering.

## 10. Code map

| Path | Purpose |
|---|---|
| `src/app/api/mcp/quiz/route.ts` | Endpoint (wires the real service and safety policy) |
| `src/lib/mcp/quiz/schema.ts` | Public contract (input and output) |
| `src/lib/mcp/quiz/service.ts` | Adapter: safety check, input mapping, error mapping, level selection, review notes |
| `src/lib/mcp/quiz/capability.ts` | Tool registration, description, annotations |
| `src/lib/mcp/` | Shared layer (auth, keys, errors, logging, HTTP handler, shared fields) |

Issue a production key (dry-run first, then `--apply`):

```bash
npx tsx scripts/mcp/create-api-key.ts --org <orgId> --scope quiz --label "School LMS"
```

Deployment, logging, rollback and the security model are the same as for the Lesson Planner MCP ([README §12–13](../lesson-planner/README.md#12-deployment)).

## 11. Limitations (v1.0.0)

- **No textbook-photo input.** The app accepts a base64 photo of up to 14 MB; that is a poor fit for an agent tool call. A future option is a URL-based input with server-side fetch and validation.
- The three levels are always generated, so cost and latency do not drop when you ask for one level.
- During a sidecar canary rollout, every MCP call is routed like the first canary bucket, because rollout buckets are keyed on the teacher id and an MCP call has none.
- No streaming or progress updates; allow 120 s per call.
- Fixed per-key quota (15 / 10 min); keys are issued by a Sahayak operator.
