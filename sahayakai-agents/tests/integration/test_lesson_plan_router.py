"""Integration test for `POST /v1/lesson-plan/generate` (Phase L.3).

Exercises the full ADK ``LoopAgent`` orchestration:

    writer → evaluator → (if revise) reviser → evaluator-on-v2

Phase L.3 fixture redesign: the procedural ``_run_writer`` /
``_run_evaluator`` / ``_run_reviser`` helpers are gone — sub-agents
now call ``_call_gemini_structured`` from inside ADK's Runner. The
old fixture that swapped ``sys.modules["google.genai"]`` wholesale
is incompatible with ADK (ADK's ``google_llm`` module imports
``google.genai.errors`` at load time, breaking when the module is
shimmed).

New strategy — patch the single Gemini helper in the agent module.
Sub-agents inside the LoopAgent end up calling the patched helper,
which pops responses off a shared queue. Net effect on assertions
is identical: a queue of ``[writer_json, evaluator_json, ...]``
gets drained one entry per sub-agent.

Plus an autouse ``_restore_real_google_genai`` fixture (mirrors
``test_vidya_adk_runtime.py``) — restores ``sys.modules["google.genai"]``
so ADK's ``InMemoryRunner`` can load ``google_llm`` without dying on
``google.genai.errors`` imports. Other tests in the suite that pre-
populated ``sys.modules["google.genai"]`` with a SimpleNamespace shim
(test_instant_answer_router.py, test_voice_to_text_router.py, etc.) leak
that pollution into our test session; the autouse fixture is what
isolates this file from that leakage.

Three scenarios:

1. **Writer passes first time** — 1 writer + 1 evaluator call.
   Response shows `revisionsRun=0`.
2. **Writer needs revision, reviser succeeds** — 1 writer + 1 eval
   + 1 reviser + 1 eval-on-v2. Response shows `revisionsRun=1` and
   the v2 plan.
3. **Writer fails safety hard** — 1 writer + 1 evaluator. Response
   is 502 from the AgentError raised on hard-fail (per the
   "never amplify a failed plan" rule).
"""
from __future__ import annotations

import importlib
import json
import sys
from typing import Any

import pytest
from fastapi.testclient import TestClient

from sahayakai_agents.agents.lesson_plan import agent as lesson_plan_agent_mod
from sahayakai_agents.main import app

pytestmark = pytest.mark.integration


# ── sys.modules hygiene (mirrors test_vidya_adk_runtime.py) ──────────────


# Sentinel for "attribute didn't exist in the original state".
_SENTINEL: object = object()


@pytest.fixture(autouse=True)
def _restore_real_google_genai() -> None:
    """Force the real google.genai modules into sys.modules for this test.

    Other tests (e.g. test_instant_answer_router.py, test_voice_to_text_router.py)
    install SimpleNamespace shims at ``sys.modules["google.genai"]`` and
    never restore them. ADK's ``InMemoryRunner`` (used by the lesson-plan
    LoopAgent driver) loads ``google.adk.models.google_llm`` which does
    ``from google.genai.errors import ClientError`` at module-import time;
    that fails against a SimpleNamespace.

    Snapshots ``sys.modules["google.genai*"]`` and the ``google`` package's
    ``.genai`` attribute, drops everything, runs the test against fresh
    real modules, then restores EXACT pre-test state.
    """
    import google as _google_pkg  # noqa: PLC0415

    pre_keys = {
        key for key in sys.modules
        if key == "google.genai" or key.startswith("google.genai.")
    }
    pre_state = {key: sys.modules[key] for key in pre_keys}
    pre_genai_attr = getattr(_google_pkg, "genai", _SENTINEL)

    for key in pre_keys:
        del sys.modules[key]
    if hasattr(_google_pkg, "genai"):
        delattr(_google_pkg, "genai")

    importlib.import_module("google.genai")
    importlib.import_module("google.genai.errors")
    importlib.import_module("google.genai.types")
    try:
        yield
    finally:
        post_keys = {
            key for key in sys.modules
            if key == "google.genai" or key.startswith("google.genai.")
        }
        for key in post_keys:
            del sys.modules[key]
        for key, value in pre_state.items():
            sys.modules[key] = value
        if pre_genai_attr is _SENTINEL:
            if hasattr(_google_pkg, "genai"):
                delattr(_google_pkg, "genai")
        else:
            _google_pkg.genai = pre_genai_attr  # type: ignore[attr-defined]


# ── Fake structured-call helper ───────────────────────────────────────────


class _FakeUsageMeta:
    input_tokens = 1500
    output_tokens = 200
    total_tokens = 1700
    cached_content_tokens = 400


class _FakeResult:
    """Stands in for whatever ``google.genai`` returns. The agent's
    ``_extract_text`` reads ``.text`` first, then falls back to
    ``.candidates``."""

    def __init__(self, text: str) -> None:
        self.text = text
        self.usage_metadata = _FakeUsageMeta()
        self.candidates: list[Any] = []


class _QueueFake:
    """Shared queue for all sub-agent Gemini calls in a test scenario.

    Each writer / evaluator / reviser invocation pops one entry. Order
    is fixed: writer → evaluator-v1 → (reviser → evaluator-v2 if the
    test exercises the revise path).
    """

    def __init__(self) -> None:
        self.queue: list[str] = []

    def pop(self) -> str:
        if not self.queue:
            raise AssertionError(
                "Test fake: more generate_content calls than test queued"
            )
        return self.queue.pop(0)


@pytest.fixture
def fake_genai(monkeypatch: pytest.MonkeyPatch) -> _QueueFake:
    """Patch ``_call_gemini_structured`` on the agent module.

    Every sub-agent (writer / evaluator / reviser) calls this helper
    via ``run_resiliently``. Replacing it with a queue-popping coroutine
    keeps the real ADK Runner + LoopAgent + sub-agent BaseAgent shapes
    in the loop while sidestepping the actual SDK.

    The replacement returns ``_FakeResult`` which mirrors the
    ``google.genai`` response surface that ``_extract_text`` reads.
    """
    fake = _QueueFake()

    async def _fake_call(
        *,
        api_key: str,
        model: str,
        prompt: str,
        response_schema: type,
    ) -> _FakeResult:
        return _FakeResult(fake.pop())

    monkeypatch.setattr(
        lesson_plan_agent_mod,
        "_call_gemini_structured",
        _fake_call,
    )
    return fake


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


# ── Canned responses ──────────────────────────────────────────────────────

_GOOD_PLAN_JSON = json.dumps(
    {
        "title": "Introduction to Photosynthesis for Class Five Learners",
        "gradeLevel": "Class 5",
        "duration": "45 minutes",
        "subject": "Science",
        "objectives": [
            "Students will identify the parts of a plant that are involved in photosynthesis including roots leaves and stems",
            "Students will explain how green plants make their own food using sunlight water and carbon dioxide as inputs",
            "Students will describe the role of chlorophyll in capturing sunlight and connect it to the green colour they observe in healthy leaves",
            "Students will trace the journey of water from soil to leaf and the journey of carbon dioxide from air to leaf surface",
            "Students will recognise that oxygen is released as a useful product of photosynthesis and connect it to the air we breathe daily",
        ],
        "keyVocabulary": None,
        "materials": [
            "chart paper for drawing the photosynthesis equation",
            "fresh green leaves from the schoolyard for close observation",
            "a magnifying glass for each pair of students",
            "a small potted plant kept near a sunny window",
            "coloured chalk or markers for labelling diagrams",
        ],
        "activities": [
            {
                "phase": "Engage",
                "name": "Plant riddle and observation",
                "description": "Begin the lesson with a riddle that asks how plants manage to eat without a mouth and drink without a cup. Show the class one healthy bright green plant and one yellowing wilted plant kept side by side. Invite students to compare the two plants in pairs and write down at least two differences they notice. Use this contrast to motivate the question of how plants stay alive and where their food comes from.",
                "duration": "7 minutes",
                "teacherTips": "Pause after the riddle to invite guesses from quieter students before calling on volunteers.",
                "understandingCheck": "What do plants need every day to stay green and healthy?",
            },
            {
                "phase": "Explore",
                "name": "Magnifying glass leaf study",
                "description": "Hand out fresh leaves and a magnifying glass to each pair of students. Ask them to look closely at the surface of the leaf and sketch what they see including veins texture and the green colour. Encourage them to feel the top and the bottom of the leaf and notice the difference. Discuss in pairs why leaves might be flat and wide instead of round and thick and connect this to surface area for catching sunlight.",
                "duration": "10 minutes",
                "teacherTips": "Walk around and prompt pairs who finish early to compare two different leaves from different plants.",
                "understandingCheck": "Why do you think most leaves are wide and flat instead of small and round?",
            },
            {
                "phase": "Explain",
                "name": "Photosynthesis equation on chart paper",
                "description": "Bring the class together and draw a simple equation on chart paper showing sunlight plus water plus carbon dioxide on one side and glucose plus oxygen on the other side. Use coloured chalk to highlight each input and output. Walk through how each input enters the plant where water comes up from roots through stems to leaves and how carbon dioxide enters through tiny pores on the leaf surface. Connect the green colour of the leaf to chlorophyll which captures the energy from sunlight.",
                "duration": "10 minutes",
                "teacherTips": "Use student observations from the Explore phase as evidence when introducing chlorophyll.",
                "understandingCheck": "Which two ingredients does the plant pull from the air and from the soil?",
            },
            {
                "phase": "Elaborate",
                "name": "Connecting to local farming",
                "description": "Connect the lesson to the local rural and Indian agricultural context that students recognise. Discuss why farmers prefer green leafy crops during the monsoon when there is plenty of water and sunlight and why neem trees and other hardy trees stay green even through hot dry summers. Ask students to share what crops their families grow and how those crops change colour through the seasons. Use these examples to reinforce the link between sunlight water and healthy green growth.",
                "duration": "8 minutes",
                "teacherTips": "Invite students from farming families to share first and validate their lived knowledge.",
                "understandingCheck": "Why do crops grow faster during the rainy season than during a long dry spell?",
            },
            {
                "phase": "Evaluate",
                "name": "Quick quiz and exit ticket",
                "description": "Hand out a short five question quiz covering the key terms photosynthesis chlorophyll glucose oxygen and carbon dioxide. Mix in one drawing question where students label a leaf with where sunlight enters where water enters and where oxygen leaves. Collect quizzes as exit tickets and use them to plan tomorrow's review. Close by asking students to name one new thing they learned and one thing they still wonder about.",
                "duration": "10 minutes",
                "teacherTips": "Read the questions aloud once before students begin to support emerging readers.",
                "understandingCheck": "Can you label a leaf with the three inputs and one output of photosynthesis?",
            },
        ],
        "assessment": "Assessment combines the quiz score worth ten marks with active participation observed during the Explore and Elaborate phases worth five marks and the labelled leaf diagram worth five marks for a total of twenty marks for this lesson.",
        "homework": "Draw and label a plant from your home or schoolyard showing the roots stem leaves and where sunlight water and air enter the plant. Write two sentences describing what the plant needs to grow and bring it to school tomorrow for a gallery walk where everyone shares their drawings with classmates.",
        "language": "en",
    }
)


def _verdict_json(
    *,
    safety: bool,
    grade: float = 0.9,
    objective: float = 0.9,
    resource: float = 0.9,
    language: float = 0.9,
    scaffolding: float = 0.9,
    inclusion: float = 0.9,
    cultural: float = 0.9,
    fail_reasons: list[str] | None = None,
) -> str:
    return json.dumps(
        {
            "scores": {
                "grade_level_alignment": grade,
                "objective_assessment_match": objective,
                "resource_level_realism": resource,
                "language_naturalness": language,
                "scaffolding_present": scaffolding,
                "inclusion_signals": inclusion,
                "cultural_appropriateness": cultural,
            },
            "safety": safety,
            "rationale": "auto-generated test verdict",
            "fail_reasons": fail_reasons or [],
        }
    )


_BASE_REQUEST = {
    "topic": "Photosynthesis",
    "language": "en",
    "gradeLevels": ["Class 5"],
    "useRuralContext": False,
    "resourceLevel": "low",
    # Phase J.4 (B3 inconsistency fix): userId is now required on
    # LessonPlanRequest to match every other agent's contract.
    "userId": "teacher-uid-1",
}


# ── Tests ────────────────────────────────────────────────────────────────


class TestLessonPlanRouter:
    def test_writer_passes_first_time(
        self,
        client: TestClient,
        fake_genai: _QueueFake,
    ) -> None:
        """Best case: writer's v1 passes the evaluator. 2 calls total."""
        fake_genai.queue = [
            _GOOD_PLAN_JSON,                  # writer call
            _verdict_json(safety=True),       # evaluator call
        ]
        res = client.post("/v1/lesson-plan/generate", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert "Photosynthesis" in body["title"]
        assert body["revisionsRun"] == 0
        assert body["sidecarVersion"].startswith("phase-")
        assert body["rubric"]["safety"] is True
        # Queue should be drained.
        assert fake_genai.queue == []

    def test_writer_revises_and_v2_passes(
        self,
        client: TestClient,
        fake_genai: _QueueFake,
    ) -> None:
        """Soft-fail path: v1 has 5 axes passing → revise.
        Reviser produces v2; v2 passes evaluator. 4 calls total."""
        fake_genai.queue = [
            _GOOD_PLAN_JSON,                                           # writer v1
            _verdict_json(                                             # evaluator v1: 5 axes pass
                safety=True, grade=0.7, objective=0.7,
                fail_reasons=["Grade alignment weak", "Objective vague"],
            ),
            _GOOD_PLAN_JSON,                                           # reviser v2
            _verdict_json(safety=True),                                # evaluator v2: 7 axes pass
        ]
        res = client.post("/v1/lesson-plan/generate", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["revisionsRun"] == 1
        # The v2 verdict's rationale should be the auto-generated string.
        assert body["rubric"]["safety"] is True
        assert fake_genai.queue == []

    def test_v1_safety_false_hard_fails(
        self,
        client: TestClient,
        fake_genai: _QueueFake,
    ) -> None:
        """Hard-fail on v1 safety=false. Reviser is NOT invoked."""
        fake_genai.queue = [
            _GOOD_PLAN_JSON,                  # writer v1
            _verdict_json(safety=False, fail_reasons=["Caste reinforcement detected"]),  # evaluator v1
        ]
        res = client.post("/v1/lesson-plan/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text
        body = res.json()
        assert "error" in body
        assert body["error"]["code"] == "INTERNAL"
        # Reviser should NOT have been called — queue still has its
        # original two entries consumed and nothing else.
        assert fake_genai.queue == []

    def test_v2_amplified_failure_returns_v1(
        self,
        client: TestClient,
        fake_genai: _QueueFake,
    ) -> None:
        """Reviser made it WORSE: v1 was revise-soft-fail, v2 is
        hard-fail. Per the "never amplify" rule, ship v1 with v1's
        verdict (status 200, NOT a hard-fail 502)."""
        fake_genai.queue = [
            _GOOD_PLAN_JSON,
            _verdict_json(  # v1: 5 axes pass, safety true → revise
                safety=True, grade=0.7, objective=0.7,
                fail_reasons=["x", "y"],
            ),
            _GOOD_PLAN_JSON,  # v2 plan
            _verdict_json(  # v2: safety FALSE — hard fail
                safety=False, fail_reasons=["Reviser introduced a stereotype"],
            ),
        ]
        res = client.post("/v1/lesson-plan/generate", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        # We shipped v1 — revisionsRun records 1 attempt was made.
        assert body["revisionsRun"] == 1
        # v1's verdict is the one in the response (safety=true,
        # because we shipped the v1 plan, NOT v2's hard-fail).
        assert body["rubric"]["safety"] is True
        assert fake_genai.queue == []

    def test_writer_returns_malformed_json(
        self,
        client: TestClient,
        fake_genai: _QueueFake,
    ) -> None:
        """Writer's response doesn't match LessonPlanCore → 502."""
        fake_genai.queue = ["not valid json"]
        res = client.post("/v1/lesson-plan/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text
