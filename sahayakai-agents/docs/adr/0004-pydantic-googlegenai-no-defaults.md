# 4. No `default=` on Pydantic fields used as Gemini `response_schema`

- Status: accepted
- Date: 2026-04-28
- Phase reference: Day-1 hot-fix (parent-call seed); applied to every
  agent's response schema during their respective ADK migrations.
- Commit reference: [`fedf73988`](../../../) — `fix(agents): Day-1 — unpin SDKs, async Gemini, drop schema defaults`
- Upstream: [google-genai #699](https://github.com/googleapis/python-genai/issues/699)

## Context

Every ADK agent in the sidecar passes a Pydantic model to Gemini
via `response_schema=<Model>` so the model returns structured
JSON the router can deserialize without a free-text parse step.
The Pydantic model is the canonical contract — TypeScript Zod
schemas are regenerated from it (Phase 2 codegen, see
`scripts/codegen_ts.py`).

Pydantic supports defaulted optional fields via
`Field(default=None, ...)` — a natural shape for "this field is
optional; if the model omits it, treat it as null". Initial
parent-call schemas used this shape:

```python
class AgentReplyCore(BaseModel):
    reply: str
    followUpQuestion: str | None = Field(default=None, max_length=500)
```

When this Pydantic model is converted to a Gemini
`response_schema`, the resulting schema has a `default: null`
clause on `followUpQuestion`. The Gemini API rejects schemas
with `default` clauses — the model errors at request time,
not at parse time. This is google-genai issue #699: **defaults
are unsupported in `response_schema` and the failure mode is
opaque** (a 400 with no field-level breakdown).

The Day-1 audit caught this on parent-call. The follow-up
audits caught it on every other agent that introduced an
optional field.

Constraint: we cannot replace `default=` with no annotation,
because then Pydantic treats the field as required. We need
the model to be allowed to OMIT the field but Pydantic to
deserialize a missing key as `None`.

## Decision

**Optional response-schema fields are typed `T | None` with NO
`default=`.** The field is required-but-nullable from Gemini's
perspective: the model MUST emit the key, possibly as `null`.
Router-side handling is unchanged because Pydantic's `T | None`
already allows `None`.

Canonical shape:

```python
class AgentReplyCore(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reply: str
    followUpQuestion: str | None = Field(max_length=500)  # no default=
```

Canonical wire-response shape (separate from the model contract,
because the response can apply server-side defaults):

```python
class AgentReplyResponse(BaseModel):
    reply: str
    # default=None is fine here — this is the FastAPI response model,
    # not a Gemini response_schema.
    followUpQuestion: str | None = Field(default=None, max_length=500)
```

The two-layer schema split (`<Agent>Core` for the model contract,
`<Agent>Response` for the wire) is the way every agent expresses
this.

**Affected schemas** (14 — every agent that has at least one
optional field in the model contract):

1. `agents/parent_call/schemas.py` — `AgentReplyCore.followUpQuestion`,
   `CallSummaryCore.followUpSuggestion`.
2. `agents/lesson_plan/schemas.py` — `LessonPlanCore.gradeLevel`,
   `duration`, `subject`, `keyVocabulary`, `assessment`,
   `homework`, `language`.
3. `agents/instant_answer/schemas.py` — `InstantAnswerCore.videoSuggestionUrl`,
   `gradeLevel`, `subject`.
4. `agents/quiz/schemas.py` — every Quiz variant's optional
   metadata fields.
5. `agents/exam_paper/schemas.py` — `ExamPaperCore` optional
   section metadata.
6. `agents/visual_aid/schemas.py` — `VisualAidCore` metadata
   companion fields.
7. `agents/worksheet/schemas.py` — `WorksheetCore` optional fields.
8. `agents/rubric/schemas.py` — `RubricCore` optional descriptors.
9. `agents/teacher_training/schemas.py` — `TeacherTrainingCore`
   optional follow-up.
10. `agents/virtual_field_trip/schemas.py` — `VirtualFieldTripCore`
    stop-level optional fields.
11. `agents/video_storyteller/schemas.py` — `RecommenderCore`
    category metadata.
12. `agents/parent_message/schemas.py` — `ParentMessageCore`
    optional follow-up.
13. `agents/voice_to_text/schemas.py` — `TranscriberCore`
    confidence + language-code companions.
14. `agents/vidya/schemas.py` — `IntentClassification.params`
    sub-fields.

## Consequences

**Positive:**

- Gemini accepts every response_schema we send. No more 400s
  on schemas that look correct in isolation but include a
  `default` clause Pydantic auto-generated.
- The `<Core>` vs `<Response>` split is enforced by the rule
  itself: `<Core>` is what Gemini sees and must not have
  defaults; `<Response>` is what the client sees and applies
  server-side defaults freely. The split surface area is
  exactly the contract layering we want.
- The fix is mechanical — a CI lint rule could enforce it.
  The pattern reads naturally once explained.

**Negative / costs:**

- The constraint is **not** advertised in the Pydantic docs
  or the google-genai docs at the spot you'd look. New agent
  authors who write `Field(default=None, ...)` on a `<Core>`
  schema get a confusing 400 from Gemini at request time, no
  hint that the schema is the cause. The mitigation is two
  prongs:
  1. The rule is documented at the top of every `<Agent>Core`
     class via comment and in the agent's `schemas.py` module
     docstring.
  2. The pyhton-side test suite includes per-agent
     "send a happy-path request" integration tests that catch
     accidental `default=` reintroduction at PR review time.
- Optional-but-required-in-output is a slight semantic
  awkwardness in the Pydantic JSON schema: the field's
  `required` set in JSON Schema includes it, the type is
  `["string", "null"]`. Codegen for TS Zod handles this
  correctly (`z.string().nullable()`), so the wire contract
  is consistent.
- A Pydantic version bump that changes how `default=` is
  serialised into JSON Schema could re-trigger this issue from
  a different angle. Pinning google-genai to `>=1.73,<2.0`
  caps the surface but doesn't eliminate it. Per-agent
  integration tests would catch a regression before deploy.

**Forward-compatibility:**

- If google-genai eventually allows `default` clauses (the
  upstream issue is open as of 2026-04), we can opt back into
  the more idiomatic Pydantic shape. The rule is a workaround,
  not architecture.
- If we move from public Gemini API to Vertex AI, the constraint
  may relax. Currently no plan to migrate; the rule stays in
  effect until proven obsolete by an integration test.

## Alternatives considered

**(a) Drop the `<Core>` vs `<Response>` split, use one Pydantic
model.** Rejected. The wire response carries telemetry the model
doesn't see (sidecarVersion, latencyMs, modelUsed). One model
either leaks telemetry into the prompt schema (visible to the
model, wastes tokens, risk of model trying to emit it) or omits
telemetry from the wire. Neither acceptable.

**(b) Make every optional field required (no `| None`).**
Rejected. Forces the model to invent values for fields that are
genuinely optional (e.g. `videoSuggestionUrl` when no video
helps). Hallucinated values are worse than null.

**(c) Use `pydantic-core` schema overrides via the
`json_schema_extra` hook to strip the `default` field after
generation.** Rejected as too clever. The override has to be
applied per-field, which is the same surface area as the
no-default rule itself, but with one extra layer of indirection
and a compile-time test failure if the override stops being
called. Direct rule is simpler and CI-checkable.

**(d) Patch google-genai locally.** Rejected. Vendor patching
puts us on a maintenance treadmill; the upstream issue is open
and tracked. Routing around the bug at the schema layer is
quarantined to our code.

**(e) Use `Optional[T]` with `Field(...)` without `default=` to
get a "required-nullable" shape.** This IS the chosen shape.
The rule says "no `default=`". The type is `T | None`
(equivalent to `Optional[T]`). Pydantic treats the field as
required (must appear in input/output) but nullable (can be
`None`). Gemini emits a JSON Schema with `"type": ["T", "null"]`
and no `default` clause. Acceptable.
