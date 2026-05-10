"""Pydantic models — source of truth for the VIDYA orchestrator contract.

VIDYA is the SahayakAI multi-agent orchestrator (the floating mic orb the
teacher invokes from any screen). The sidecar's job is to (a) classify
intent into one of 11 categories, (b) extract navigation params, and
(c) either return a `NAVIGATE_AND_FILL` action or an inline answer.

Every field mirrors the existing TS contract in
`sahayakai-main/src/ai/flows/agent-router.ts` (input/output) and
`sahayakai-main/src/app/api/assistant/route.ts` (request shape on the
wire). When TS and Python disagree, **Python wins** — the TS Zod
schemas will be regenerated from these models in CI.

Phase 5 §5.1 deliverable. See
`sahayakai-main/.claude/plans/ai-agent-quality-and-migration-plan.md`.
"""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

# Phase J.4 hot-fix (forensic P1 #20): list[str] element bound.
_LearningOutcome = Annotated[str, StringConstraints(max_length=300)]

# --- Input pieces -------------------------------------------------------


class ChatMessagePart(BaseModel):
    """A single text fragment inside a chat message."""

    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=0, max_length=4000)


class ChatMessage(BaseModel):
    """One conversation turn. Mirrors the Genkit-style `{ role, parts }`
    shape that VIDYA's OmniOrb client sends today."""

    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "model"]
    parts: list[ChatMessagePart] = Field(min_length=1, max_length=10)


class ScreenContext(BaseModel):
    """Where the teacher currently is in the app.

    `uiState` is bounded so an attacker can't blow up the prompt by
    cramming arbitrary form state into the request — string keys, string
    values, max 20 entries.
    """

    model_config = ConfigDict(extra="forbid")

    path: str = Field(min_length=1, max_length=500)
    uiState: dict[str, str] | None = Field(default=None, max_length=20)


class TeacherProfile(BaseModel):
    """Long-term teacher memory injected into the prompt.

    All optional — a brand-new teacher has none of these populated.
    Strings are bounded so a maliciously-large schoolContext cannot
    bloat the prompt context window.
    """

    model_config = ConfigDict(extra="forbid")

    preferredGrade: str | None = Field(default=None, max_length=50)
    preferredSubject: str | None = Field(default=None, max_length=100)
    preferredLanguage: str | None = Field(default=None, max_length=10)
    schoolContext: str | None = Field(default=None, max_length=2000)


# --- Allowed flow enum (kept in sync with `agent.ALLOWED_FLOWS`) -------

# `instantAnswer` is intentionally NOT in this Literal — it's handled
# inline by the sidecar without a navigation action. `unknown` is also
# not here because it never produces an action.
AllowedFlow = Literal[
    "lesson-plan",
    "quiz-generator",
    "visual-aid-designer",
    "worksheet-wizard",
    "virtual-field-trip",
    "teacher-training",
    "rubric-generator",
    "exam-paper",
    "video-storyteller",
]


VidyaActionType = Literal["NAVIGATE_AND_FILL"]


# --- Action params ------------------------------------------------------


class NcertChapterRef(BaseModel):
    """Optional NCERT chapter reference attached to a navigation action."""

    model_config = ConfigDict(extra="forbid")

    number: int = Field(ge=1, le=30)
    title: str = Field(min_length=1, max_length=300)
    learningOutcomes: list[_LearningOutcome] = Field(
        default_factory=list, max_length=20,
    )


class VidyaActionParams(BaseModel):
    """Parameters the action prefills on the destination screen.

    All optional — the orchestrator extracts whatever it can from the
    teacher's utterance + context. Missing values fall through to the
    destination flow's own defaults.

    Phase N.1 — `dependsOn` expresses data flow between actions in a
    `plannedActions` list. Each entry is the index of an EARLIER action
    in the same list whose output this action consumes (e.g. a rubric
    that depends on lesson-plan output uses `dependsOn=[0]`). Bounded
    at 2 because real compound requests rarely chain more than two
    upstream artefacts; deeper graphs should split into separate
    teacher-driven sessions. Always optional — empty list means the
    action is independent.
    """

    model_config = ConfigDict(extra="forbid")

    topic: str | None = Field(default=None, max_length=500)
    gradeLevel: str | None = Field(default=None, max_length=50)
    subject: str | None = Field(default=None, max_length=100)
    language: str | None = Field(default=None, max_length=10)
    ncertChapter: NcertChapterRef | None = None
    # Phase N.1 — index pointers into the parent `plannedActions` list.
    # Each int is the position of an earlier action whose output feeds
    # this one (e.g. rubric `dependsOn=[0]` means "use the lesson plan
    # at index 0"). Bounded at 2 entries — compound requests deeper
    # than that should split into separate teacher-confirmed sessions.
    dependsOn: list[int] = Field(default_factory=list, max_length=2)


class VidyaAction(BaseModel):
    """A navigation directive returned to the OmniOrb client.

    The client interprets `flow` as a route name and `params` as the
    URL query string — same surface as the existing `processAgentRequest`
    return shape. `type` is fixed today (only `NAVIGATE_AND_FILL`) but
    Literal-typed so future action kinds (e.g. `OPEN_DIALOG`) extend the
    enum without breaking the wire contract.
    """

    model_config = ConfigDict(extra="forbid")

    type: VidyaActionType
    flow: AllowedFlow
    params: VidyaActionParams


# --- Wire request -------------------------------------------------------


class VidyaRequest(BaseModel):
    """Request body for POST /v1/vidya/orchestrate.

    Mirrors the JSON body that `/api/assistant` accepts today
    (`message`, `chatHistory`, `currentScreenContext`, `teacherProfile`,
    `detectedLanguage`). Every field is bounded so a hostile client
    can't exhaust prompt budget.

    Phase L.2 — `userId` is now required. The previous `_run_answerer`
    delegation hard-coded `userId="vidya-supervisor"` because VIDYA's
    request had no real uid; that placeholder blocked per-user rate
    limiting + observability. The Next.js `/api/assistant` route is
    auth'd upstream and now forwards the verified uid here.
    """

    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=2000)
    chatHistory: list[ChatMessage] = Field(default_factory=list, max_length=50)
    currentScreenContext: ScreenContext
    teacherProfile: TeacherProfile
    # BCP-47 like "en-IN", "hi-IN". Optional — the classifier may
    # detect language inline if the client doesn't pre-resolve.
    detectedLanguage: str | None = Field(default=None, max_length=10)
    # Required — the authenticated teacher's uid. Same alphanumeric
    # + underscore + hyphen pattern as every other agent's `userId`,
    # so path-injection defences in downstream Firestore document IDs
    # still hold. The Next.js dispatcher injects this from the
    # `x-user-id` header that auth middleware writes.
    userId: str = Field(
        min_length=1,
        max_length=128,
        pattern=r"^[A-Za-z0-9_\-]+$",
    )


# --- Internal classifier output ----------------------------------------


class IntentClassification(BaseModel):
    """Structured output from the first Gemini call (the intent
    classifier). NOT exposed on the wire — the router converts this
    into a `VidyaAction` (or inline answer) before responding.

    Mirrors the existing `agentRouterFlow.outputSchema` from
    `agent-definitions.ts` verbatim. `type` is the 11-way classifier
    label: 9 routable flows + `instantAnswer` + `unknown`.

    No defaults on optional fields per google-genai issue #699 (same
    workaround as parent-call's `AgentReplyCore` and lesson-plan's
    `LessonPlanCore`).
    """

    model_config = ConfigDict(extra="forbid")

    # We keep `type` as a plain `str` (not a Literal) so the model can
    # return any of the 11 labels and we validate downstream in
    # `classify_action`. A Literal here would force a regex-match
    # validation error path on every typo, swallowing useful telemetry.
    type: str = Field(min_length=1, max_length=64)
    topic: str | None = Field(max_length=500)
    gradeLevel: str | None = Field(max_length=50)
    subject: str | None = Field(max_length=100)
    language: str | None = Field(max_length=10)
    # Phase N.1 — typed planned-action list (replaces Phase G's
    # `followUpSuggestion: str | None`, which was a 300-char prose blob
    # the OmniOrb rendered as a chip).
    #
    # 2026 supervisor literature (LangGraph, AutoGen, Anthropic's own
    # tool-use shape) converged on `actions: list[Action]` with
    # optional `dependsOn` for data flow. The single-string suggestion
    # was a "suggestion box," not a workflow — the client could not
    # programmatically execute it, only render it.
    #
    # Each entry is a real `VidyaAction` the supervisor authored after
    # parsing the teacher's compound request. The router's mapping
    # logic treats `plannedActions[0]` as the primary action (kept on
    # the legacy `VidyaResponse.action` field for backward compat) and
    # the rest as the queue of follow-ups. Cap at 3 — beyond that
    # teacher-confirmed sessions handle the depth (matches the
    # `dependsOn` cap of 2 on `VidyaActionParams`).
    plannedActions: list[VidyaAction] = Field(
        default_factory=list, max_length=3,
    )


# --- Wire response ------------------------------------------------------


class VidyaResponse(BaseModel):
    """Response for POST /v1/vidya/orchestrate.

    `action` is None for `instantAnswer` / `unknown`; populated for the
    9 routable flows. The OmniOrb client renders `response` (always set)
    and dispatches the navigation if `action` is present.
    """

    model_config = ConfigDict(extra="forbid")

    response: str = Field(min_length=1, max_length=1000)
    action: VidyaAction | None = None
    intent: str = Field(min_length=1, max_length=64)
    sidecarVersion: str = Field(min_length=1, max_length=64)
    latencyMs: int = Field(ge=0)
    # Phase N.1 — typed planned-action queue (replaces Phase G's
    # `followUpSuggestion: str | None`).
    #
    # When the orchestrator parses a compound request ("lesson plan AND
    # a rubric"), it emits up to 3 `VidyaAction`s. The router copies
    # `plannedActions[0]` onto the legacy `action` field for backward
    # compat with clients still on the v0.3 wire shape; the full list
    # ships in this field. Empty for single-step / unknown / instant-
    # answer paths.
    #
    # The OmniOrb client iterates the list and renders each entry as a
    # one-tap chip the teacher can opt into. The supervisor still does
    # NOT execute follow-ups automatically — every entry is a teacher-
    # confirmed dispatch.
    plannedActions: list[VidyaAction] = Field(
        default_factory=list, max_length=3,
    )
