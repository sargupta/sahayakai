"""Decision D1 (23 Nov 2026): Riya opens as calling from the school, with the recording notice, and
does not volunteer that she is an AI; asked, she answers honestly and never denies it.

The opening alone no longer discloses AI, so the honest-answer rule in the prompt is what keeps the
call honest. This pins both halves in the workflow the Vobiz bridge and the ElevenLabs agent share.
"""

from __future__ import annotations

import json
from pathlib import Path

WORKFLOW = Path(__file__).resolve().parents[2] / "src/sahayakai_agents/telephony/riya_workflow.json"


def _workflow() -> dict:
    return json.loads(WORKFLOW.read_text(encoding="utf-8"))


def test_opening_names_the_school_and_the_recording_and_claims_no_person() -> None:
    first = _workflow()["first_message"]
    assert "calling from {{school_name}}" in first
    assert "may be recorded" in first
    for claim in ("real person", "human", "not an AI", "not a bot", "not a robot"):
        assert claim not in first


def test_prompt_keeps_the_honest_answer_and_the_same_opening() -> None:
    wf = _workflow()
    prompt = wf["base_prompt"]
    assert "Do not volunteer that you are an AI" in prompt
    assert "Parent asks whether you are an AI: Answer honestly" in prompt
    # The prompt tells the model how the call opened; it must be the opening actually spoken.
    assert wf["first_message"] in prompt
