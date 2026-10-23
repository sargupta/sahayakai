# MCP quality notes: Sahayak public MCP servers

Covers MCP #1 (Lesson Planner), MCP #2 (Exam Paper Generator) and MCP #3 (Quiz Generator). All three share one MCP layer (`src/lib/mcp/`).

## MCP #1: Lesson Planner

The decisions behind the first public Sahayak MCP, reviewed against what makes an MCP server good for real agents.

| Dimension | Decision | Why |
|---|---|---|
| **Discoverability** | Server `sahayak-lesson-planner` with 2-sentence `instructions`; one tool, `create_lesson_plan`, with a title, annotations and output schema | An agent learns what the server is for during initialize, without reading docs |
| **Tool description** | States what it returns, *when to use it* and *when not to* (not for explanations, quizzes or worksheets), latency (~10–40 s), and that nothing is saved | Agents pick tools from descriptions; negative guidance prevents misuse |
| **Schemas** | Strict input (`additionalProperties: false`), integer `grade` 1–12, enums for language, resources and difficulty, documented defaults, length limits; full `outputSchema` | No ambiguous strings like `"Class 5"` vs `"5th"`; unknown fields such as `org_id` are rejected, not ignored |
| **Outputs** | Stable snake_case JSON (`structuredContent`) validated against the output schema, plus a compact Markdown `content` fallback | Machine-usable for agents, readable for humans; internal service fields are mapped away by construction |
| **Reliability** | Calls the same production service as the app (`dispatchLessonPlan`: safety, cache, Genkit/sidecar parity); stateless transport | No second AI pipeline to drift; horizontally scalable on Cloud Run |
| **Error handling** | Categorised errors (`content_policy`, `rate_limited`, `upstream_unavailable`, `timeout`, `internal`) with `retryable` and `retry_after_seconds`; HTTP 401/403/405/413/503 at request level | An agent can decide to fix the input, wait or give up, without parsing prose |
| **Security** | Scoped, hashed API keys; tenant from the key only; same generic 401 for every bad credential; per-key rate limit; 64 KB body limit on actual bytes; no secrets or stacks in responses; no prompts in logs | External, multi-tenant exposure from day one |
| **Token efficiency** | One tool; description about 110 words; input schema of 8 fields; a typical result is about 6.5 KB | Small tool-list footprint; one call returns a complete, usable plan |
| **Scope** | Only `create_lesson_plan`. We did **not** add `generate_learning_objectives` or `generate_activities` | The service produces a coherent plan in one pass; splitting it would add calls and latency without new capability. Quizzes and exam papers got their own MCP servers (#2, #3) with their own scopes |
| **Real-world use** | LMS teacher assistants, school chatbots and curriculum tools can add Indian-classroom lesson planning in 11 languages by adding one MCP server | Clear standalone value with no student data involved |

## Known limitations (MCP #1)

- No image input (textbook photo to plan): base64 images are a poor fit for agent tool calls. A future option is a URL-based input with server-side fetch and validation.
- No streaming or progress notifications: the transport is stateless JSON. Clients should allow about 120 s.
- Rate limit is per key and fixed (15 / 10 min, the app's existing limiter). Per-plan quotas and usage reporting per organisation are future work.
- Keys are issued by an operator script; there is no self-service key UI yet.

## MCP #2: Exam Paper Generator and MCP #3: Quiz Generator

| Dimension | Decision | Why |
|---|---|---|
| **Audit first** | Each service was audited for persistence, usage metering, teacher-context reads, rate limits, safety, timeouts and feature flags before any code | The two services differ: exam paper already runs the safety policy for every path; quiz runs it only on the sidecar path |
| **Headless with no service change** | Both services treat an empty user id as "no teacher" (every account side effect is behind `if (userId)`), so the MCP passes `""`. No flow or dispatcher was modified | Smallest safe path; interactive teacher behaviour provably unchanged (gate tests run the real flows for both a headless caller and a teacher) |
| **Safety parity** | Exam paper: the service's own check. Quiz: the MCP runs the same `validateTopicSafety` on topic and subject before dispatch | Every public MCP refuses the same unsafe input, regardless of which engine the service picks |
| **Schemas** | Only options the service really supports. No invented "exam type"; quiz image input omitted; app defaults reused (quiz question types and Bloom levels, grade-based question count); `medium` alias for exam difficulty | The contract never promises what the engine cannot do |
| **Honest output** | `review_notes`: syllabus mismatches, marks or duration drift, placeholder answers, missing levels, short quizzes. A failed quiz level is an error, never silently swapped | Agents and teachers see exactly what to check |
| **Honest latency** | Measured timings and the service budgets (75 s / 60 s) are documented; budget overruns map to a retryable `timeout`; no fake streaming | Agents can set realistic timeouts |
| **Kill switch** | Exam paper honours Sahayak's `examPaperEnabled` flag (`capability_disabled`). Quiz has no such flag in the app, so none was invented | Operators keep the controls they already use |
| **Scope isolation** | One scope per server; a 3 × 3 key/server matrix test, and a test that no server runs another server's tool even for an all-scopes key | Least privilege per capability |

### Known limitations found during the audit (not worked around in the MCPs)

- Exam paper: without a board blueprint (all but CBSE 9–10) the service prompt does not state the requested `maxMarks` or `duration`. The MCP flags drift in `review_notes`; the fix belongs in the shared flow.
- Quiz: the app's Genkit path runs no topic safety policy. The MCP adds it; the app gap should be closed in the dispatcher.
- Sidecar canary buckets are keyed on the teacher id, so MCP calls (no teacher) always land in the first bucket.

## Pattern for the next MCP

Audit the service, then add `src/lib/mcp/<capability>/{schema,service,capability}.ts` (shared fields in `src/lib/mcp/shared/schema.ts`), add a scope to `MCP_SCOPES`, add `src/app/api/mcp/<capability>/route.ts`, and add the capability to `scripts/mcp/demo.mjs`. Auth, errors, logging, rate limiting and transport are reused unchanged from `src/lib/mcp/`.
