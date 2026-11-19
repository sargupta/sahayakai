"""CLASS GATE — the post-call check rejects a quote only for a limit with no strong marker.

Final review #6: the post-call check rejected any quote with a time, place,
someone-else or "busy" word. So the backstop, there to catch what the live
detector misses, also dropped strong stops the live detector now hears
("Stop calling me, I'm busy", "Please don't call me again, I'm at work all
day"), and the two disagreed.

The class is "the post-call check stricter than the live detector". The
gate: a quote is rejected only when a limit matches AND no strong marker
does; "busy" alone never rejects a strong stop; a reschedule still is
rejected; and every strong stop the live detector fires on is accepted.
"""

from __future__ import annotations

import pytest

from src.opt_out import backstop_quote, is_stop_request

ACCEPT = [
    "Stop calling me, I'm busy",
    "मुझे दोबारा फ़ोन मत करना, मैं व्यस्त रहता हूँ",
    "Please don't call me again, I'm at work all day",
    "Don't call me again, my husband handles school things",
    "Stop calling me, I'm in the office",
    "আমাকে আর ফোন করবেন না, আমি ব্যস্ত",
    "மறுபடியும் போன் பண்ணாதீங்க, நான் பிஸி",
    "मला पुन्हा फोन करू नका, मी कामात असतो",
]
REJECT = ["call me in the evening", "Don't call me now, I'm busy", "I'm busy, don't call",
          "Please don't call me on Sundays", "Don't call Rahul's father", "अभी फ़ोन मत करो, बाद में करना"]


def _check(quote):
    return backstop_quote({"optOut": {"requested": True, "quote": quote}}, [{"role": "parent", "text": quote}])


@pytest.mark.parametrize("quote", ACCEPT)
def test_a_strong_stop_with_busy_or_a_limit_elsewhere_is_accepted(quote):
    assert is_stop_request(quote), "the live detector hears it too"
    assert _check(quote) == quote


@pytest.mark.parametrize("quote", REJECT)
def test_a_limit_with_no_strong_marker_is_still_rejected(quote):
    assert _check(quote) is None
