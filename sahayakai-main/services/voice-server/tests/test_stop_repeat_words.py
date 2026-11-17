"""CLASS GATE — "again" makes a stop strong only right next to it.

Final review #4: any repeat word anywhere in the sentence made a "don't
call" strong, and a strong stop is not vetoed by "busy": "Sorry I'm busy,
don't call, we'll talk again", "आमि ব্যস্ত, ফোন করবেন না, আবার কথা হবে",
"can you say that again? Don't call me, I'm busy" ended calls, more so
when speech-to-text dropped the commas. Bengali আর also means "and", and
Punjabi ਫਿਰ also means "then".

The class is "a repeat word that belongs to another phrase". The gate: on
the reviewer's phrases in every call language, with and without commas, a
repeat word counts only next to the stop phrase (English after it, the
Indic languages before it, with only filler between, within three tokens);
Bengali আর only right before the call word; ਫਿਰ never; "again and again"
is not a repeat word. Every stop that says "again" properly still is.
"""

from __future__ import annotations

import re

import pytest

from src.opt_out import StopListener, is_stop_request
from test_stop_precision import ALREADY_STOPS

TALK_AGAIN = [
    "Sorry I'm busy, don't call, we'll talk again",
    "मैं बिज़ी हूँ, फ़ोन मत करो, फिर बात करेंगे",
    "আমি ব্যস্ত, ফোন করবেন না, আবার কথা হবে",
    "मी कामात आहे, फोन करू नका, मी परत फोन करते",
    "હું વ્યસ્ત છું, ફોન ન કરો, ફરી વાત કરીશું",
    "ਮੈਂ ਬਿਜ਼ੀ ਹਾਂ, ਫ਼ੋਨ ਨਾ ਕਰੋ, ਫਿਰ ਗੱਲ ਕਰਾਂਗੇ",
    "ನಾನು ಬ್ಯುಸಿ ಇದ್ದೀನಿ, ಫೋನ್ ಮಾಡಬೇಡಿ, ಮತ್ತೆ ಮಾತಾಡೋಣ",
    "நான் பிஸியா இருக்கேன், போன் பண்ணாதீங்க, மறுபடியும் பேசலாம்",
    "నేను బిజీగా ఉన్నాను, ఫోన్ చేయకండి, మళ్ళీ మాట్లాడదాం",
    "ഞാൻ തിരക്കിലാണ്, വിളിക്കരുത്, വീണ്ടും സംസാരിക്കാം",
    "Sorry, can you say that again? Don't call me, I'm busy",
    "আমি আর আমার স্বামী দুজনেই ব্যস্ত, ফোন করবেন না",
]
# ("again and again" / "बार बार" next to a don't-call phrase IS a stop
# request: tests/test_stop_frequency.py.)


def _no_commas(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[,.?!।]", " ", text)).strip()


@pytest.mark.parametrize("text", TALK_AGAIN + [_no_commas(t) for t in TALK_AGAIN])
def test_a_repeat_word_in_another_phrase_does_not_make_a_stop(text):
    assert not is_stop_request(text), text


@pytest.mark.parametrize("text", TALK_AGAIN)
def test_through_the_listener_it_is_not_noticed_even_after_the_quiet(text):
    c = StopListener()
    c.hear(_no_commas(text))
    assert not c.on_quiet() and not c.noticed


PROPER_AGAIN = ["Please don't call me again", "Do not call this number again", "Don't call me anymore",
                "আমাকে আর ফোন দেবেন না", "আর ফোন করবেন না", "phir se call mat karna", "dobara phone mat karna",
                "मुझे दोबारा फ़ोन मत करना, मैं व्यस्त रहता हूँ", "ਦੁਬਾਰਾ ਫ਼ੋਨ ਨਾ ਕਰੋ", "ಮತ್ತೆ ಫೋನ್ ಮಾಡಬೇಡಿ",
                "இனிமேல் போன் பண்ணாதீங்க, நான் பிஸி", "మళ్ళీ ఫోన్ చేయకండి", "ഇനി വിളിക്കരുത്"]


@pytest.mark.parametrize("text", PROPER_AGAIN + ALREADY_STOPS)
def test_a_stop_that_says_again_properly_still_is(text):
    assert is_stop_request(text), text
