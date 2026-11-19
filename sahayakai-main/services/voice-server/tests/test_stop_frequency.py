"""CLASS GATE — "stop calling me over and over" is never vetoed by its own "over and over".

Security review: the frequency phrase ("again and again", "बार बार") was used
as a VETO in both the strong and the plain branch, so "stop calling me again
and again" and "बार बार फ़ोन मत करो" were missed live (fail-open: the parent
asked, nothing was recorded).

The class is "a frequency phrase hiding a stop". The gate: in all ten call
languages, a frequency phrase next to a don't-call phrase is a stop request,
noticed live at once and accepted by the post-call check; a strong phrase
still fires with a frequency phrase present; and the frequency phrase never
counts as an "again" (it does not make a far-away repeat word count).
"""

from __future__ import annotations

import pytest

from src.opt_out import NOTICE, StopListener, backstop_quote, is_stop_request

FREQUENT = [
    "stop calling me again and again",
    "don't keep calling me",
    "Please don't call me again and again",
    "बार बार फ़ोन मत करो",
    "baar baar phone mat karo",
    "বারবার ফোন করবেন না",
    "वारंवार फोन करू नका",
    "વારંવાર ફોન ન કરો",
    "ਵਾਰ ਵਾਰ ਫ਼ੋਨ ਨਾ ਕਰੋ",
    "ಪದೇ ಪದೇ ಫೋನ್ ಮಾಡಬೇಡಿ",
    "அடிக்கடி போன் பண்ணாதீங்க",
    "పదే పదే ఫోన్ చేయకండి",
    "വീണ്ടും വീണ്ടും വിളിക്കരുത്",
    "Stop calling me again and again, I'm busy",
]


@pytest.mark.parametrize("text", FREQUENT)
def test_a_frequency_phrase_next_to_a_stop_is_heard_live(text):
    assert is_stop_request(text), text
    assert StopListener().hear(text) == NOTICE


@pytest.mark.parametrize("text", FREQUENT)
def test_the_post_call_check_agrees(text):
    insights = {"optOut": {"requested": True, "quote": text}}
    assert backstop_quote(insights, [{"role": "parent", "text": text}]) == text


def test_a_frequency_phrase_is_not_an_again():
    assert not is_stop_request("Sorry, again and again you say that, don't call, I'm busy")
