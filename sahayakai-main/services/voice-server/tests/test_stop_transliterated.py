"""CLASS GATE — English said on a Hindi call, as Sarvam writes it in Devanagari.

Sarvam may return English words in Devanagari on a Hindi call: "डोंट कॉल मी",
"नो मोर कॉल्स", "स्टॉप कॉलिंग", "फ्रॉम नाउ ऑन". The detector knew the Latin
forms only (and "मी" counted as an extra word), so these were missed live.

The class is "a stop in the spelling the speech-to-text actually returns".
The gate: the strong forms are strong (noticed at once), the bare
"डोंट कॉल मी" stands after the quiet, and the Marathi "मी" filler does not
turn a Marathi limit into a stop.
"""

from __future__ import annotations

import pytest

from src.opt_out import NOTICE, WAIT, StopListener, is_stop_request

STRONG = ["डोंट कॉल मी अगेन", "नो मोर कॉल्स", "फ्रॉम नाउ ऑन डोंट कॉल मी", "स्टॉप कॉलिंग मी",
          "प्लीज़ डोंट कॉल मी एनीमोर"]


@pytest.mark.parametrize("text", STRONG)
def test_a_transliterated_strong_stop_is_noticed_at_once(text):
    assert StopListener().hear(text) == NOTICE, text


def test_a_transliterated_bare_stop_stands_after_the_quiet():
    c = StopListener()
    assert c.hear("डोंट कॉल मी") == WAIT and c.on_quiet()


@pytest.mark.parametrize("text", ["मी कामात आहे, फोन करू नका", "डोंट कॉल मी, मैं ऑफिस में हूँ"])
def test_limits_still_win(text):
    assert not is_stop_request(text), text
