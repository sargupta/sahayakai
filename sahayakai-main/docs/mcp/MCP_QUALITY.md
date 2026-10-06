# MCP quality notes: Sahayak Lesson Planner (MCP #1)

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
| **Scope** | Only `create_lesson_plan`. We did **not** add `generate_learning_objectives` or `generate_activities` | The service produces a coherent plan in one pass; splitting it would add calls and latency without new capability. A quiz tool belongs in its own MCP (#2) with its own scope |
| **Real-world use** | LMS teacher assistants, school chatbots and curriculum tools can add Indian-classroom lesson planning in 11 languages by adding one MCP server | Clear standalone value with no student data involved |

## Known limitations (MCP #1)

- No image input (textbook photo to plan): base64 images are a poor fit for agent tool calls. A future option is a URL-based input with server-side fetch and validation.
- No streaming or progress notifications: the transport is stateless JSON. Clients should allow about 120 s.
- Rate limit is per key and fixed (15 / 10 min, the app's existing limiter). Per-plan quotas and usage reporting per organisation are future work.
- Keys are issued by an operator script; there is no self-service key UI yet.

## Pattern for MCP #2 onwards

Add `src/lib/mcp/<capability>/{schema,service,capability}.ts`, add a scope to `MCP_SCOPES`, and add `src/app/api/mcp/<capability>/route.ts`. Auth, errors, logging, rate limiting and transport are reused unchanged from `src/lib/mcp/`.
