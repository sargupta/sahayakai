"""CLASS GATE — the clear ways to say "don't call me" that the detector missed.

Final review #7: common verb forms and spellings were missed live ("फ़ोन मत
कीजिएगा", "मुझे call मत करो", "mujhe call nahi chahiye", "Do not contact me
again", "Remove me from your list", "I told you not to call me again",
"Okay fine, never call me again", "फोन करू नको", "ఫోన్ చెయ్యద్దు", "കോൾ
ചെയ്യരുത്", "ਫੋਨ ਨਾ ਕਰਿਆ ਕਰੋ", ...).

The class is "a clear stop in a form the detector does not know". The gate:
every one of the reviewer's clear stops (tests/fixtures/review_stop_phrases
.json, strong_stops) is a stop, and is noticed by the listener (at once, or
after the quiet for a bare plain one); through the real Vobiz handler a few
are recorded.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from main_ast import opt_out_requests
from src.opt_out import NOTICE, WAIT, StopListener, is_stop_request

PHRASES = json.loads((Path(__file__).parent / "fixtures" / "review_stop_phrases.json").read_text(encoding="utf-8"))
CLEAR = [row["text"] for row in PHRASES["strong_stops"]]
LISTED = ["दोबारा फ़ोन मत कीजिएगा", "फ़ोन मत करियेगा", "फ़ोन मत करिये", "मुझे call मत करो", "mujhe call nahi chahiye",
          "I told you not to call me again", "Okay fine, never call me again", "Don't contact me",
          "Remove me from your list", "फोन करू नको", "ఫోన్ చెయ్యద్దు", "കോൾ ചെയ്യരുത്", "ਫੋਨ ਨਾ ਕਰਿਆ ਕਰੋ"]


@pytest.mark.parametrize("text", CLEAR + LISTED)
def test_a_clear_stop_is_detected(text):
    assert is_stop_request(text), text


@pytest.mark.parametrize("text", CLEAR + LISTED)
def test_the_listener_notices_it(text):
    c = StopListener()
    decision = c.hear(text)
    assert decision == NOTICE or (decision == WAIT and c.on_quiet()), (text, decision)


@pytest.mark.parametrize("language,text", [("English", "Do not contact me again"), ("Hindi", "दोबारा फ़ोन मत कीजिएगा"),
                                           ("Marathi", "मला पुन्हा फोन करू नको"), ("Telugu", "ఇంకెప్పుడూ కాల్ చేయకండి")],
                         ids=lambda v: v[:30])
def test_through_the_handler_it_is_recorded(language, text, tmp_path, monkeypatch):
    from test_opt_out_never_suppresses import _run_call

    db, _persisted, _spoken, _passed = _run_call(language, (text,), tmp_path, monkeypatch)
    [request] = opt_out_requests(db)
    assert request["quote"] == text
