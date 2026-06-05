"""ADK helpers for the assignment-assessor agent.

Single Gemini call:
  - render Handlebars prompt (pybars3)
  - multimodal input (the student's handwritten work as `image/*`)
  - structured-output JSON matching `AssessAssignmentCore`
  - low temperature (0.1) so multi-criteria scoring is stable across
    runs — matches the TS flow
  - `gemini-2.5-pro` by default (vision + reasoning quality matters
    for grading subjective handwriting)

The 5-stage chain-of-thought lives in the prompt: transcribe →
presence-check → score → feedback → summarise. It kills the
"model invents an answer for a blank region" failure documented for
multi-modal LLMs.
"""
from __future__ import annotations

import base64
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING, Any

import pybars
import structlog

from .schemas import AssessAssignmentCore

log = structlog.get_logger(__name__)

if TYPE_CHECKING:
    from google.adk.agents import LlmAgent


_DEFAULT_REPO_PROMPTS = (
    Path(__file__).resolve().parents[4]
    / "prompts"
    / "assignment-assessor"
)


def _resolve_prompts_dir() -> Path:
    env = os.environ.get("SAHAYAKAI_PROMPTS_DIR")
    if env:
        return Path(env) / "assignment-assessor"
    return _DEFAULT_REPO_PROMPTS


def _load_prompt(filename: str) -> str:
    path = _resolve_prompts_dir() / filename
    if not path.exists():
        raise FileNotFoundError(
            f"Assignment-assessor prompt missing: {path}. "
            "Set SAHAYAKAI_PROMPTS_DIR to the directory containing "
            "assignment-assessor/."
        )
    return path.read_text(encoding="utf-8")


def load_generator_prompt() -> str:
    return _load_prompt("generator.handlebars")


_compiler = pybars.Compiler()


@lru_cache(maxsize=1)
def _compile_generator_template() -> Any:
    return _compiler.compile(load_generator_prompt())


def render_generator_prompt(context: dict[str, Any]) -> str:
    return str(_compile_generator_template()(context))


# ---- Image data-URI parsing ---------------------------------------------

_DATA_URI_RE = re.compile(
    r"^data:(?P<mime>image\/(?:jpeg|png|webp));base64,(?P<body>.+)$",
    re.DOTALL,
)


class InvalidDataURIError(ValueError):
    """Raised when an imageDataUri does not parse correctly."""


def parse_data_uri(data_uri: str) -> tuple[str, bytes]:
    """Decode the request's `imageDataUri` to `(mime, bytes)`.

    The wire schema's regex already gates jpeg/png/webp, but we
    re-check defensively because Pydantic validators run before this
    helper does — a downgraded request shape could still smuggle a
    non-image MIME through.
    """
    match = _DATA_URI_RE.match(data_uri)
    if not match:
        raise InvalidDataURIError(
            "imageDataUri does not match data:image/(jpeg|png|webp);base64,<body>",
        )
    mime = match.group("mime").strip().lower()
    body = match.group("body").strip()
    try:
        decoded = base64.b64decode(body, validate=True)
    except Exception as exc:
        raise InvalidDataURIError(
            f"imageDataUri base64 decode failed: {exc}",
        ) from exc
    if not decoded:
        raise InvalidDataURIError("imageDataUri body decoded to empty bytes")
    return mime, decoded


@lru_cache(maxsize=1)
def get_generator_model() -> str:
    """Default Gemini variant for the assessor.

    Matches the TS flow's `gemini-2.5-pro` choice — vision + reasoning
    quality matters here. Override via `SAHAYAKAI_ASSIGNMENT_ASSESSOR_MODEL`
    for A/B.
    """
    return os.environ.get(
        "SAHAYAKAI_ASSIGNMENT_ASSESSOR_MODEL", "gemini-2.5-pro",
    )


# ---- ADK LlmAgent builder -----------------------------------------------


@lru_cache(maxsize=1)
def build_assignment_assessor_agent() -> LlmAgent:
    """Build the assessor as an ADK `LlmAgent`.

    - `name="assignment_assessor"` — snake_case (ADK 1.31's Pydantic
      identifier validator rejects hyphens).
    - `model` is the env-overridable string from `get_generator_model()`.
    - `instruction=""` — rendered Handlebars prompt is passed as
      `new_message` Content alongside the image part, NOT as
      `instruction` (avoids `inject_session_state()` `{name}`
      substitution colliding with prompt content).
    - `output_schema=AssessAssignmentCore` enables Gemini's structured
      JSON output.
    - `generate_content_config.temperature=0.1` — matches the TS flow.
      Scoring must be stable across runs.
    - `generate_content_config.top_p=0.95` — matches TS.
    - `generate_content_config.max_output_tokens=8192` — matches TS.
      Multi-criteria rubric output is large.
    - `sub_agents=[]` + `tools=[]` — single-call agent.
    """
    from google.adk.agents import LlmAgent  # noqa: PLC0415
    from google.genai import types as genai_types  # noqa: PLC0415

    return LlmAgent(
        name="assignment_assessor",
        model=get_generator_model(),
        instruction="",
        generate_content_config=genai_types.GenerateContentConfig(
            temperature=0.1,
            top_p=0.95,
            max_output_tokens=8192,
        ),
        output_schema=AssessAssignmentCore,
        sub_agents=[],
        tools=[],
        disallow_transfer_to_parent=True,
        disallow_transfer_to_peers=True,
    )


# ---- Handwriting few-shots (mirrors handwriting-fewshots.ts) -----------


HANDWRITING_FEW_SHOTS = """
EXAMPLE 1 — Class 5 Hindi math, neat Devanagari handwriting.
Image (described): A 5-question math worksheet. Student wrote answers next
to each printed question.
rawTranscript (literal):
  "1) 24 + 18 = 42
   2) 56 - 19 = 37
   3) 6 × 7 = 42
   4) 81 ÷ 9 = 9
   5) 100 - 47 = 53"
Per-criterion feedback example for "Accuracy of Answers":
  "All five sums are correct. The student showed working for Q2 ('56-19') correctly."
Strengths: ["Carried over correctly on Q1", "Showed working on subtraction"]
Improvements: ["Could write the calculation steps for multiplication and division too"]

EXAMPLE 2 — Class 7 Tamil short-answer English, partial handwriting.
Image (described): An English short-answer worksheet with 3 questions.
Q3's answer area is blank.
rawTranscript (literal):
  "1) The capital of India is Delhi.
   2) The seven colours of rainbow are Violet, Indigo, Blue, Green, Yellow,
      Orange, Red.
   3) [BLANK]"
Per-criterion feedback example for "Completion":
  "The student attempted Q1 and Q2 with full sentences but left Q3 blank.
   Encourage the student to write at least an attempted answer next time."
Warnings example: []
Strengths: ["Wrote Q2 in correct VIBGYOR order", "Used full sentences"]
Improvements: ["Attempt Q3 even if unsure"]

CALIBRATION NOTES (apply to the actual image, do NOT copy text above):
- Transcript field preserves whatever scripts the student wrote (Devanagari
  digits + English fractions side by side is FINE — keep it literal).
- Per-criterion feedback should QUOTE one phrase from the transcript when
  possible (it makes feedback specific instead of generic).
- No emojis. No "great job!" / "well done!" by itself — pair every
  encouragement with one specific observation.
- When a region is blank, ALWAYS write [BLANK] in the transcript and DO NOT
  invent an answer for the scoring.
"""


# ---- Default rubric (mirrors DEFAULT_RUBRIC in TS) ----------------------


DEFAULT_RUBRIC: dict[str, Any] = {
    "title": "General Assignment Rubric",
    "description": (
        "A 4-level rubric used when the teacher has not picked or "
        "generated one."
    ),
    "criteria": [
        {
            "name": "Understanding of the Topic",
            "description": (
                "Does the student show conceptual grasp of what was asked?"
            ),
            "levels": [
                {"name": "Exemplary", "description": "Demonstrates complete and accurate understanding.", "points": 4},
                {"name": "Proficient", "description": "Demonstrates correct understanding with minor gaps.", "points": 3},
                {"name": "Developing", "description": "Partial understanding; some key ideas missing.", "points": 2},
                {"name": "Beginning", "description": "Minimal evidence of understanding.", "points": 1},
            ],
        },
        {
            "name": "Accuracy of Answers",
            "description": "Are the answers correct?",
            "levels": [
                {"name": "Exemplary", "description": "All answers are correct.", "points": 4},
                {"name": "Proficient", "description": "0-1 minor errors.", "points": 3},
                {"name": "Developing", "description": "2-3 errors that affect meaning.", "points": 2},
                {"name": "Beginning", "description": "More than 3 errors or major misconceptions.", "points": 1},
            ],
        },
        {
            "name": "Presentation & Handwriting",
            "description": (
                "Is the work neat, legible, and well-organised?"
            ),
            "levels": [
                {"name": "Exemplary", "description": "Neat, legible, well-organised throughout.", "points": 4},
                {"name": "Proficient", "description": "Mostly neat with minor lapses.", "points": 3},
                {"name": "Developing", "description": "Legible but inconsistent.", "points": 2},
                {"name": "Beginning", "description": "Hard to read or disorganised.", "points": 1},
            ],
        },
        {
            "name": "Completion",
            "description": "Did the student attempt all required parts?",
            "levels": [
                {"name": "Exemplary", "description": "All parts attempted thoughtfully.", "points": 4},
                {"name": "Proficient", "description": "All parts attempted.", "points": 3},
                {"name": "Developing", "description": "Most parts attempted.", "points": 2},
                {"name": "Beginning", "description": "Many parts missing.", "points": 1},
            ],
        },
    ],
    "gradeLevel": None,
    "subject": None,
}


# ---- Post-hoc validator (ports assignment-assessor-validation.ts) ------

_BLANK_TOKEN_RE = re.compile(
    r"^\s*(\[BLANK\]|\[\?\?\?\]|—|-|\.|…|null|none)?\s*$",
    re.IGNORECASE,
)


def _is_effectively_blank(transcript: str) -> bool:
    """Treat as blank when every non-empty line matches a blank token.

    Mirrors `isEffectivelyBlank` in
    `sahayakai-main/src/ai/flows/assignment-assessor-validation.ts`.
    """
    if not transcript:
        return True
    lines = [line.strip() for line in re.split(r"\r?\n", transcript)]
    lines = [line for line in lines if line]
    if not lines:
        return True
    return all(_BLANK_TOKEN_RE.match(line) for line in lines)


def _force_blank_page_result(
    output: AssessAssignmentCore, added_warnings: list[str],
) -> AssessAssignmentCore:
    """Mirrors `forceBlankPageResult` in the TS validation file."""
    repaired = output.model_copy(deep=True)
    repaired.overallScore = 0
    repaired.pointsEarned = 0
    repaired.perCriterionScores = [
        score.model_copy(
            update={
                "points": 0,
                "level": score.level or "Beginning",
                "feedback": (
                    "No student work was detected for this criterion."
                ),
                "confidence": min(score.confidence, 0.1),
            }
        )
        for score in repaired.perCriterionScores
    ]
    repaired.strengths = ["—"]
    repaired.improvements = [
        "Please re-upload a clearer photo of the student's work."
    ]
    repaired.nextSteps = [
        "Ask the student to complete the assignment if it was not done."
    ]
    repaired.teacherNote = (
        "No student work was detected in this image. Please verify the "
        "photo and try again."
    )
    repaired.confidenceOverall = 0.1
    seen: list[str] = []
    for tag in (
        *repaired.warnings,
        "page_appears_blank",
        *added_warnings,
    ):
        if tag not in seen:
            seen.append(tag)
    repaired.warnings = seen
    return repaired


def validate_assessment(
    output: AssessAssignmentCore,
) -> tuple[AssessAssignmentCore, list[str]]:
    """Post-hoc guard ported from `assignment-assessor-validation.ts`.

    Catches the "model invented an answer for a blank page" failure.
    Returns `(possibly-repaired output, added warnings)` so the router
    can log structured guard hits the same way the TS Genkit flow does
    (`Assessment presence guard triggered`).
    """
    added_warnings: list[str] = []

    transcript_empty = _is_effectively_blank(output.rawTranscript)
    any_non_zero_score = any(
        score.points > 0 for score in output.perCriterionScores
    )
    overall_non_zero = (
        output.overallScore > 0 or output.pointsEarned > 0
    )

    if transcript_empty and (any_non_zero_score or overall_non_zero):
        added_warnings.append("blank_transcript_hallucination_repaired")
        repaired = _force_blank_page_result(output, added_warnings)
        return repaired, added_warnings

    if transcript_empty and "page_appears_blank" not in output.warnings:
        added_warnings.append("page_appears_blank_added")
        repaired = output.model_copy(deep=True)
        repaired.warnings = [*output.warnings, "page_appears_blank"]
        return repaired, added_warnings

    return output, added_warnings


__all__ = [
    "DEFAULT_RUBRIC",
    "HANDWRITING_FEW_SHOTS",
    "InvalidDataURIError",
    "build_assignment_assessor_agent",
    "get_generator_model",
    "load_generator_prompt",
    "parse_data_uri",
    "render_generator_prompt",
    "validate_assessment",
]
