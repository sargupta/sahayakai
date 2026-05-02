"""Build a Gemini Live API session config for VIDYA voice mode.

The function `build_vidya_voice_session()` returns a tuple of
`(LiveConnectConfig, list[ToolDefinition], session_metadata)` — the
same triple the router needs to (a) mint an ephemeral token bounded
to that config, and (b) hand the same shape back to the OmniOrb
client so it can connect directly to Gemini Live.

Why this lives outside `router.py`:

- Pure builder; no FastAPI imports. Easy to unit-test the prompt
  + tool surface without spinning up a TestClient.
- `pyproject.toml` runs ruff + mypy across `src/` — keeping the model
  config separate from the HTTP handler keeps both modules under
  the per-module strictness overrides cleanly.
- A future shadow-mode runner (Phase S.3) can import this directly
  to record what the Live session WOULD have said while the typed
  pipeline is still serving traffic.

This module deliberately does NOT import `google.genai` at module
scope — the SDK adds ~150ms to cold-start, which would impact
non-Live routes in the same Cloud Run instance. Imports happen
inside `build_vidya_voice_session()` only.
"""
from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

import structlog

from .schemas import LiveAllowedFlow, LiveToolDefinition

log = structlog.get_logger(__name__)


# ---- Model + voice selection ---------------------------------------------


@lru_cache(maxsize=1)
def get_voice_model() -> str:
    """Default Gemini Live model for VIDYA.

    `gemini-live-2.5-flash-preview` is the production-ready Live model
    as of Apr 2026 (per the SDK reference and Track-S agent guidance).
    Override via `SAHAYAKAI_VIDYA_VOICE_MODEL` to A/B test alternatives
    (e.g. `gemini-2.0-flash-live-001` for cheaper sessions).
    """
    return os.environ.get(
        "SAHAYAKAI_VIDYA_VOICE_MODEL",
        "gemini-live-2.5-flash-preview",
    )


@lru_cache(maxsize=1)
def get_voice_name() -> str:
    """Default voice for the Live session.

    `Aoede` is multilingual and handles Indic languages reasonably.
    `Kore` and `Puck` are alternatives — A/B test via
    `SAHAYAKAI_VIDYA_VOICE_NAME`.

    Note: Gemini Live's voices are NOT a 1:1 swap with our existing
    Cloud TTS voices (Neural2 hi/en, Wavenet bn/ta/kn/ml/gu/pa,
    Standard te). Voice quality is part of the spike acceptance gate.
    """
    return os.environ.get("SAHAYAKAI_VIDYA_VOICE_NAME", "Aoede")


# ---- Tool surface --------------------------------------------------------

# The 9 routable flows surface as Live tools. Order + naming kept stable
# so the client-side dispatcher (which maps `tool_name` → route) can
# stay a static lookup.
_TOOL_DEFINITIONS: list[tuple[LiveAllowedFlow, str, str]] = [
    (
        "lesson-plan",
        "open_lesson_plan",
        "Open the lesson plan generator. Use when the teacher asks to "
        "create or plan a lesson. Extract topic, gradeLevel, subject, "
        "language from the conversation.",
    ),
    (
        "quiz-generator",
        "open_quiz_generator",
        "Open the quiz generator. Use when the teacher asks for a quiz, "
        "test, or assessment questions. Extract topic, gradeLevel, "
        "subject, language.",
    ),
    (
        "visual-aid-designer",
        "open_visual_aid_designer",
        "Open the visual aid / diagram generator. Use when the teacher "
        "asks for a diagram, illustration, image, or visual aid. "
        "Extract topic + subject.",
    ),
    (
        "worksheet-wizard",
        "open_worksheet_wizard",
        "Open the worksheet generator. Use when the teacher asks for "
        "a printable worksheet or practice sheet. Extract topic, "
        "gradeLevel, subject, language.",
    ),
    (
        "virtual-field-trip",
        "open_virtual_field_trip",
        "Open the virtual field trip experience. Use when the teacher "
        "asks for a guided tour, field trip, or immersive exploration "
        "of a topic. Extract topic + subject.",
    ),
    (
        "teacher-training",
        "open_teacher_training",
        "Open teacher-training content. Use when the teacher asks for "
        "professional development, pedagogy training, or how-to-teach "
        "guidance. Extract topic + subject.",
    ),
    (
        "rubric-generator",
        "open_rubric_generator",
        "Open the assessment rubric generator. Use when the teacher "
        "asks for a marking rubric, scoring guide, or evaluation "
        "criteria. Extract topic + subject + gradeLevel.",
    ),
    (
        "exam-paper",
        "open_exam_paper",
        "Open the exam paper builder. Use when the teacher asks for a "
        "full exam paper, question paper, or unit test. Extract "
        "topic, gradeLevel, subject, language.",
    ),
    (
        "video-storyteller",
        "open_video_storyteller",
        "Open the video storyteller. Use when the teacher asks for a "
        "story, narrative, or video explanation of a topic. Extract "
        "topic + subject + language.",
    ),
]


def build_tool_definitions() -> list[LiveToolDefinition]:
    """Return the 9 routable-flow tools in a stable order."""
    return [
        LiveToolDefinition(name=name, description=description, flow=flow)
        for flow, name, description in _TOOL_DEFINITIONS
    ]


# ---- System instruction --------------------------------------------------

# The Live system instruction sets the persona, the language guidance,
# and the tool-use rubric. Kept terse — Live model latency scales with
# instruction length.
# Long lines below are intentional: a Live system instruction is sent
# to the model as a single string. Wrapping inside the source would
# inject newlines into the prompt and degrade model behaviour. Each
# bullet is one logical instruction — kept on one line on purpose.
_SYSTEM_INSTRUCTION_TEMPLATE = (
    "You are VIDYA, a voice assistant for SahayakAI helping Indian school teachers.\n"
    "\n"
    "Persona:\n"
    "- Warm, respectful, never patronising — Indian teachers carry the dignity"
    " of guru-shishya tradition.\n"
    "- Speak in the teacher's preferred language: {language}.\n"
    "- Replies are short — voice mode, not essays. 1-3 sentences before pausing.\n"
    "\n"
    "When to call a tool:\n"
    "- If the teacher asks to OPEN, CREATE, GENERATE, or PLAN something the"
    " app supports (lesson plans, quizzes, worksheets, exam papers, rubrics,"
    " visual aids, virtual field trips, teacher training content, video"
    " storytelling), call the matching tool with the extracted parameters.\n"
    "- If the teacher asks a factual question, answer it directly in voice"
    " — do NOT call a tool.\n"
    "- If you do not understand, ask one short clarifying question.\n"
    "\n"
    "Current screen: {screen_path}\n"
    "Teacher profile: grade={grade}, subject={subject},"
    " school_context={school_context}\n"
    "\n"
    "Identity rules:\n"
    "- Never reveal that you are an AI, bot, or large language model.\n"
    '- Never use the words "Sahayak" or "SahayakAI" in spoken replies.\n'
    "- Never apologise for being a machine.\n"
)


def build_system_instruction(
    *,
    language: str,
    screen_path: str,
    grade: str | None,
    subject: str | None,
    school_context: str | None,
) -> str:
    """Render the Live system instruction with teacher context."""
    return _SYSTEM_INSTRUCTION_TEMPLATE.format(
        language=language or "English",
        screen_path=screen_path or "/dashboard",
        grade=grade or "not specified",
        subject=subject or "not specified",
        school_context=school_context or "general",
    )


# ---- Live config builder -------------------------------------------------


def build_vidya_voice_session(
    *,
    language: str,
    screen_path: str,
    grade: str | None,
    subject: str | None,
    school_context: str | None,
) -> dict[str, Any]:
    """Return the Live API session configuration.

    Returns a dict (NOT a `LiveConnectConfig` instance) so this builder
    is import-free of `google.genai` — the router materialises the SDK
    types at call time. This keeps unit-tests of the builder cheap and
    keeps cold-start unaffected on non-Live routes.

    The returned dict has the shape:
        {
            "model": str,
            "voice": str,
            "language_code": str | None,
            "system_instruction": str,
            "tool_names": list[str],         # for the ephemeral-token
                                             # `live_connect_constraints`
            "response_modalities": ["AUDIO"],
        }
    """
    return {
        "model": get_voice_model(),
        "voice": get_voice_name(),
        "language_code": language or None,
        "system_instruction": build_system_instruction(
            language=language,
            screen_path=screen_path,
            grade=grade,
            subject=subject,
            school_context=school_context,
        ),
        "tool_names": [name for _, name, _ in _TOOL_DEFINITIONS],
        "response_modalities": ["AUDIO"],
    }


__all__ = [
    "build_system_instruction",
    "build_tool_definitions",
    "build_vidya_voice_session",
    "get_voice_model",
    "get_voice_name",
]
