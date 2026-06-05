"""Prompt rendering + subject-family rubrics + Gemini call helpers.

Mirror of `sahayakai-main/src/ai/flows/assessment-scanner.ts`. The
two-pass orchestration lives in the router (single FastAPI endpoint
that runs Pass-1 per page in parallel, then Pass-2 once across all
pages).

Subject-family rubrics live as Python constants here -- they were
inline in the TS file's `SUBJECT_RUBRICS` map -- so the prompt sees
exactly one focused rubric per call.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import pybars
import structlog

from .schemas import SubjectRubricFamily

log = structlog.get_logger(__name__)


# ---- Prompt resolution ----------------------------------------------------

_DEFAULT_REPO_PROMPTS = (
    Path(__file__).resolve().parents[4] / "prompts" / "assessment-scanner"
)


def _resolve_prompts_dir() -> Path:
    env = os.environ.get("SAHAYAKAI_PROMPTS_DIR")
    if env:
        return Path(env) / "assessment-scanner"
    return _DEFAULT_REPO_PROMPTS


def _load_prompt(filename: str) -> str:
    path = _resolve_prompts_dir() / filename
    if not path.exists():
        raise FileNotFoundError(
            f"Assessment-scanner prompt missing: {path}. "
            "Set SAHAYAKAI_PROMPTS_DIR to the directory containing "
            "assessment-scanner/."
        )
    return path.read_text(encoding="utf-8")


def load_pass1_prompt() -> str:
    return _load_prompt("pass1.handlebars")


def load_pass2_prompt() -> str:
    return _load_prompt("pass2.handlebars")


_compiler = pybars.Compiler()


@lru_cache(maxsize=2)
def _compiled(template_name: str) -> Any:
    if template_name == "pass1":
        source = load_pass1_prompt()
    elif template_name == "pass2":
        source = load_pass2_prompt()
    else:
        raise ValueError(f"Unknown assessment-scanner template: {template_name!r}")
    return _compiler.compile(source)


def render_pass1_prompt(context: dict[str, Any]) -> str:
    return str(_compiled("pass1")(context))


def render_pass2_prompt(context: dict[str, Any]) -> str:
    return str(_compiled("pass2")(context))


# ---- Model selection ------------------------------------------------------


@lru_cache(maxsize=1)
def get_pass1_model() -> str:
    """Vision-capable model for Pass-1 page OCR + structure."""
    return os.environ.get(
        "SAHAYAKAI_ASSESSMENT_PASS1_MODEL", "gemini-2.5-flash",
    )


@lru_cache(maxsize=1)
def get_pass2_model() -> str:
    """Pass-2 scoring -- text-only (consumes the JSON Pass-1 produced)."""
    return os.environ.get(
        "SAHAYAKAI_ASSESSMENT_PASS2_MODEL", "gemini-2.5-flash",
    )


# ---- Subject-family rubrics (verbatim port of SUBJECT_RUBRICS) ----------


_MATH_RUBRIC = """**Mathematics rubric -- best-in-class focus:**
- **Computation correctness**: arithmetic accuracy on every operation.
- **Method working**: award method marks for correct setup and formula application even when the final number is wrong (carry-over errors, sign errors, transcription slips should keep most of the marks).
- **Carry-over errors**: distinguish a one-off arithmetic slip from a conceptual misunderstanding -- don't double-penalise a single bad number that propagates.
- **Units**: deduct 0.5 per missing unit on a question that requires one.
- **Sign errors**: explicit deduction; flag in feedback ("watch the negative sign").
- **Showing work**: when the student wrote out steps, use `partialCreditBreakdown` exhaustively (setup, method, computation, answer). When the answer is correct with no working, award full marks but note in feedback that working would help future scoring."""

_SCIENCE_RUBRIC = """**Science rubric:**
- **Concept understanding**: does the answer demonstrate the underlying principle (not just a memorised sentence)?
- **Terminology accuracy**: scientific terms used correctly -- "force" vs "energy", "weight" vs "mass", "evaporation" vs "condensation". Tolerate vernacular variants of the same term.
- **Diagram correctness** (when relevant): labels correct, proportions reasonable, arrows showing direction where applicable.
- **Application reasoning**: for "explain why" / "what would happen if" questions, the chain of cause and effect should be sound.
- **Acceptable variation**: accept paraphrases. Reward partial understanding -- a student who names the right phenomenon but misses one step gets significant partial credit.
- **No experimental working to credit**: there is no equivalent of math's method marks here; partialCreditBreakdown should usually be empty for short/long answers (use it only when the question explicitly asks for steps like an experimental procedure)."""

_EVS_RUBRIC = """**EVS rubric (Class 1-5, Environmental Studies):**
- **Observation accuracy**: when the question asks about something the student has seen / experienced (plants in their area, family helpers, etc.), reward genuine observation over textbook-perfect answers.
- **Age-appropriate vocabulary**: a Class-3 student calling a pollinator "the bee that helps the flower" is fine; don't penalise for not saying "pollinator".
- **Classification correctness**: living vs non-living, plants vs animals, eatable vs inedible -- these are the core EVS skills. Mark these strictly.
- **Drawings and labels**: accept rough drawings that show the right idea; full marks for correct labels even if the figure is shaky.
- **Be encouraging**: EVS at this age is about confidence-building. studentFacingFeedback should reinforce curiosity, never shame a wrong observation.
- **partialCreditBreakdown**: usually empty -- these questions are short. Use only when the question has clearly separable parts (e.g. "name three..." -- one mark per correct name)."""

_SOCIAL_SCIENCE_RUBRIC = """**Social Science rubric (History / Geography / Civics):**
- **Factual accuracy**: dates, names, places, events. Mark these strictly when the question is purely factual.
- **Causal reasoning (History)**: for "why did X happen" -- the chain of causes should be plausible. Reward partial chains; full marks need the key cause + one supporting cause.
- **Location accuracy (Geography)**: map references, directions, climate-zone classifications must be correct. Tolerate spelling variants of place names.
- **Constitutional accuracy (Civics)**: rights, duties, articles, three-branches structure -- these have right answers; mark strictly.
- **Source-based questions**: when the question quotes a passage and asks for interpretation, reward correct comprehension over recitation.
- **partialCreditBreakdown**: use sparingly -- only when the question has explicit parts ("list three causes of the revolt of 1857" -- one mark per cause)."""

_LANGUAGE_RUBRIC = """**Language rubric (Hindi / English) -- branches by question type:**
For **grammar / fill-blank / one-word**:
- **Grammar correctness**: tense, agreement, number, case. Strict marking.
- **Spelling**: tolerate one minor spelling slip per answer for primary classes; strict for Class 9+.
- **Vocabulary**: synonyms and idiomatic equivalents accepted.

For **comprehension / short answer**:
- **Coherence**: does the answer actually address the question?
- **Idea development**: at least one supporting detail beyond the bare answer.

For **essay / long-answer / creative writing**, use a four-part rubric:
- **Thesis / main idea**: clear and on-topic.
- **Support / examples**: at least two relevant supporting points.
- **Coherence and flow**: paragraphs connect; ideas don't jump.
- **Conclusion**: ties back to the thesis.
Score each 0..full and sum into marksAwarded; record the breakdown in partialCreditBreakdown.

**Vernacular handwriting**: be generous on shirorekha alignment, matra placement, conjuncts -- the student is writing by hand, not typing."""

_OTHER_RUBRIC = """**Generic rubric (used when the subject doesn't fit a named family):**
- **Clarity**: is the answer understandable?
- **Correctness**: factually right against the question and NCERT context.
- **Completeness**: covers what the question asked for (not more, not less).
- **Presentation**: legible, organised; doesn't require deduction unless the question explicitly asked for a specific format.

This is a fallback. The rubric is intentionally generic -- set `confidence` lower than you would for a subject-tuned rubric so the teacher knows to review. Use partialCreditBreakdown only when the question itself has clearly numbered parts."""


SUBJECT_RUBRICS: dict[SubjectRubricFamily, str] = {
    "mathematics": _MATH_RUBRIC,
    "science": _SCIENCE_RUBRIC,
    "evs": _EVS_RUBRIC,
    "social_science": _SOCIAL_SCIENCE_RUBRIC,
    "language": _LANGUAGE_RUBRIC,
    "other": _OTHER_RUBRIC,
}

MATH_CONFIDENCE_GUIDANCE = (
    "**Confidence guidance:** Mathematics is the best-tuned subject in "
    "this release. You can be more decisive on confidence here than on "
    "other subjects, but still set `needsTeacherReview: true` whenever "
    "extraction confidence was below 0.8, partial-credit ambiguity "
    "remains, or multiple MCQ options were marked."
)

NON_MATH_CONFIDENCE_GUIDANCE = (
    "**Confidence guidance for this subject:** Mathematics is the only "
    "subject family with a deeply-tuned rubric in this release. The "
    "rubric above is subject-aware but not specialist. **Lean conservative "
    "on `confidence`** -- when in doubt, set `needsTeacherReview: true`. "
    "Teachers will be reviewing the AI's grades carefully on non-Math "
    "subjects; an honest \"I'm uncertain\" is more useful than a "
    "confident-but-wrong score."
)


def rubric_for(family: SubjectRubricFamily) -> str:
    return SUBJECT_RUBRICS[family]


def confidence_guidance_for(family: SubjectRubricFamily) -> str:
    if family == "mathematics":
        return MATH_CONFIDENCE_GUIDANCE
    return NON_MATH_CONFIDENCE_GUIDANCE


# ---- Aggregation helpers (port of TS aggregate() + letterGradeFor) ------


def letter_grade_for(score_pct: float) -> str:
    """Mirror of `letterGradeFor` in assessment-scanner-utils.ts."""
    if score_pct >= 90:
        return "A+"
    if score_pct >= 80:
        return "A"
    if score_pct >= 65:
        return "B"
    if score_pct >= 50:
        return "C"
    if score_pct >= 35:
        return "D"
    return "E"


__all__ = [
    "MATH_CONFIDENCE_GUIDANCE",
    "NON_MATH_CONFIDENCE_GUIDANCE",
    "SUBJECT_RUBRICS",
    "confidence_guidance_for",
    "get_pass1_model",
    "get_pass2_model",
    "letter_grade_for",
    "load_pass1_prompt",
    "load_pass2_prompt",
    "render_pass1_prompt",
    "render_pass2_prompt",
    "rubric_for",
]
