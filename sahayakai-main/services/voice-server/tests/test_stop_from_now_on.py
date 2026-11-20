"""CLASS GATE — "from now on, don't call me" is a strong stop, live and after the call.

Final review #5: "from now on / after today / आज के बाद / এখন থেকে / आता
पासून ..." are made of time words, so the limit check took them for a time
limit ("not today") and vetoed the stop, live and in the post-call check:
the clearest way to say "never again" was missed both times.

The class is "a never-again marker read as a time limit". The gate: in
every call language, a don't-call phrase with a from-now-on marker is a
strong stop (with and without a comma after the marker, and through the
listener at once, without waiting), the post-call check accepts it as the
parent's quote, and a real time limit ("don't call me today") still is not
a stop.
"""

from __future__ import annotations

import pytest

from src.opt_out import NOTICE, StopListener, backstop_quote, is_stop_request

FROM_NOW_ON = [
    "From now on, please don't call me.",
    "After today don't call me",
    "आज के बाद मुझे फ़ोन मत करना",
    "इसके बाद फ़ोन मत करना",
    "এখন থেকে আমাকে ফোন করবেন না",
    "आता पासून फोन करू नका",
    "આજ પછી ફોન ન કરશો",
    "ਅੱਜ ਤੋਂ ਬਾਅਦ ਫ਼ੋਨ ਨਾ ਕਰੋ",
    "இன்னைக்கு அப்புறம் போன் பண்ணாதீங்க",
    "ఈరోజు తర్వాత ఫోన్ చేయకండి",
    "ഇന്ന് മുതൽ വിളിക്കരുത്",
    "ಇನ್ನು ಮುಂದೆ ಫೋನ್ ಮಾಡಬೇಡಿ",
]
STILL_LIMITS = ["Don't call me today", "आज फ़ोन मत करना", "আজ ফোন করবেন না", "आज फोन करू नका",
                "Please don't call me now", "अभी फ़ोन मत करो"]


@pytest.mark.parametrize("text", FROM_NOW_ON)
def test_a_from_now_on_stop_is_strong(text):
    assert is_stop_request(text), text
    assert StopListener().hear(text) == NOTICE, "strong: no waiting"


@pytest.mark.parametrize("text", [t.replace(",", "") for t in FROM_NOW_ON if "," in t])
def test_without_the_comma_too(text):
    assert is_stop_request(text), text


@pytest.mark.parametrize("text", FROM_NOW_ON)
def test_the_post_call_check_accepts_it(text):
    insights = {"optOut": {"requested": True, "quote": text}}
    assert backstop_quote(insights, [{"role": "parent", "text": text}]) == text


@pytest.mark.parametrize("text", STILL_LIMITS)
def test_a_real_time_limit_still_is_not_a_stop(text):
    assert not is_stop_request(text), text
