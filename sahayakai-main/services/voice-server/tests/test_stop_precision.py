"""CLASS GATE — the live stop detector is precision-first: no false stops.

Final review: the live detector still produced false stops, and a false stop
ENDS a call (the opt-out line, the goodbye, the hang-up), while a missed plain
stop is still caught by the post-call analysis. "I'm busy, don't call",
"रविवार को फ़ोन मत करना", "Don't call Rahul's father", "Don't call this
number, call my other number", "बंद करो ये कॉल" (end this call), "I never
said don't call me" all ended calls.

The class is "a live stop on anything but a clear request". The gate, on the
reviewer's own phrases (tests/fixtures/review_stop_phrases.json):
  * a plain "don't call" fires only when nothing else is said but
    politeness: every busy / time / place / hang-up / question / name /
    someone-else phrase, in all ten call languages, is not a live stop,
    and through the real Vobiz handler records nothing and reaches the model;
  * a strong stop ("stop calling", "no more calls", "don't call me again")
    still fires at once, and a limit only counts in the stop phrase's own
    clause ("Don't call me again, my husband handles school things" is a
    stop; "Don't call his father again, call me" is not).
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from main_ast import opt_out_requests
from src.call_policy import load_call_lines
from src.opt_out import is_stop_request
from test_opt_out import STOPS, STILL_STOPS
from test_opt_out_never_suppresses import TRUE_STOPS, _run_call

PHRASES = json.loads((Path(__file__).parent / "fixtures" / "review_stop_phrases.json").read_text(encoding="utf-8"))
NOT_STOPS = [row["text"] for row in PHRASES["not_stops"]]
PARTY_IN_EVERY_LANGUAGE = [row["text"] for row in PHRASES["not_stops"] if row["category"] == "party"]

STRONG_WITH_ANOTHER_CLAUSE = [
    "Please don't call me again, I'm at work all day",
    "Stop calling me, I'm in the office",
    "मुझे दोबारा फ़ोन मत करना, मैं ऑफिस में रहता हूँ",
    "Don't call me again, my husband handles school things",
]
STRONG_WITH_ITS_OWN_LIMIT = [
    "Don't call his father again, call me",
    "Don't call me at the office again.",
    "Please stop calling during work hours",
    "उसके पापा को दोबारा फ़ोन मत करना",
]
ALREADY_STOPS = [t for t in STOPS if t] + list(TRUE_STOPS.values()) + STILL_STOPS


SCRIPTS = {"Latin": ("a", "z"), "Devanagari": ("\u0900", "\u097f"), "Bengali": ("\u0980", "\u09ff"),
           "Gurmukhi": ("\u0a00", "\u0a7f"), "Gujarati": ("\u0a80", "\u0aff"), "Tamil": ("\u0b80", "\u0bff"),
           "Telugu": ("\u0c00", "\u0c7f"), "Kannada": ("\u0c80", "\u0cff"), "Malayalam": ("\u0d00", "\u0d7f")}


def test_the_review_list_has_someone_else_in_every_call_script():
    seen = {name for text in PARTY_IN_EVERY_LANGUAGE for name, (lo, hi) in SCRIPTS.items()
            if any(lo <= ch <= hi for ch in text.lower())}
    assert seen == set(SCRIPTS) and len(NOT_STOPS) >= 100


@pytest.mark.parametrize("text", NOT_STOPS)
def test_no_review_phrase_is_a_live_stop(text):
    assert not is_stop_request(text), text


@pytest.mark.parametrize("text", STRONG_WITH_ANOTHER_CLAUSE + ALREADY_STOPS)
def test_a_strong_or_bare_stop_still_fires(text):
    assert is_stop_request(text), text


@pytest.mark.parametrize("text", STRONG_WITH_ITS_OWN_LIMIT)
def test_a_limit_in_the_stop_clause_still_stops_it(text):
    assert not is_stop_request(text), text


BEHAVIOUR = [("English", "I'm busy, don't call"), ("English", "Don't call this number, call my other number"),
             ("Hindi", "रविवार को फ़ोन मत करना"), ("Hindi", "बंद करो ये कॉल"),
             ("Bengali", "আমার শাশুড়িকে ফোন করবেন না"), ("Marathi", "मी कामात आहे, फोन करू नका"),
             ("Tamil", "அவங்க அப்பாவுக்கு போன் பண்ணாதீங்க"), ("Hindi", "मैंने कब कहा कि फ़ोन मत करना?")]


@pytest.mark.parametrize("language,text", BEHAVIOUR, ids=lambda v: v[:30])
def test_through_the_handler_a_false_stop_does_not_end_the_call(language, text, tmp_path, monkeypatch):
    db, _persisted, spoken, passed = _run_call(language, (text,), tmp_path, monkeypatch)
    assert opt_out_requests(db) == []
    code = {"English": "en-IN", "Hindi": "hi-IN", "Bengali": "bn-IN", "Marathi": "mr-IN", "Tamil": "ta-IN"}[language]
    assert load_call_lines()[code]["opt_out_noted"] not in spoken
    assert passed == [text], "the model hears the parent"
