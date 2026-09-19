"""Invariants every voice integration must satisfy, as runnable checks.

WHY THIS FILE EXISTS

Every defect in this integration had already been solved somewhere in the
organisation, and every one was re-made here from scratch:

  * the mu-law encoder must work in the 14-bit domain    (G.711; got it wrong)
  * a streaming resampler must be PHASE-continuous       (solved in Suraksha)
  * `session.receive()` is per-turn, not per-session     (latent in vidya_voice)
  * audio must never leave faster than real time         (solved in Suraksha)
  * a partial frame must not be padded mid-utterance     (nobody had hit it)

The knowledge existed as CODE in one repository — the Suraksha decimator carries
its phase in a dict key called "off" — and nowhere as a statement of the rule.
Reading that file is not enough: you have to notice that one key is load-bearing.
So the next person writes a new resampler and re-makes the bug, which is exactly
what happened here.

A document does not fix this, because a document is not consulted at the moment
the mistake is made. These are executable. A new carrier, a new codec path, a new
audio pipeline runs `assert_conformant()` and finds out in seconds whether it has
re-made a bug we have already paid for.

Each check below names the symptom a human actually reported, because that is
what makes someone keep it rather than delete it when it goes red.
"""

from __future__ import annotations

import math
from array import array
from collections.abc import Callable

__all__ = ["ConformanceFailure", "assert_conformant", "CHECKS"]


class ConformanceFailure(AssertionError):
    """A voice pipeline has re-made a bug this organisation already fixed."""


def _tone(freq: float, rate: int, n: int, amp: int = 9000) -> array[int]:
    return array("h", [int(amp * math.sin(2 * math.pi * freq * i / rate)) for i in range(n)])


def _median_f0(pcm: array[int], rate: int, lo: float = 120, hi: float = 400) -> float:
    """Median fundamental over the loud windows. Pitch, as a human hears it."""
    win = int(0.04 * rate)
    if len(pcm) < win * 2:
        return 0.0
    frames = []
    for i in range(0, len(pcm) - win, win // 2):
        seg = pcm[i : i + win]
        frames.append((sum(float(x) * x for x in seg) / win, i))
    threshold = sorted(e for e, _ in frames)[int(len(frames) * 0.6)]
    values = []
    for energy, i in frames:
        if energy < threshold:
            continue
        seg = pcm[i : i + win]
        mean = sum(seg) / len(seg)
        centred = [float(x) - mean for x in seg]
        best_lag, best_corr = 0, -1e18
        for lag in range(int(rate / hi), min(int(rate / lo), len(centred) - 1)):
            corr = sum(centred[j] * centred[j + lag] for j in range(len(centred) - lag))
            corr /= len(centred) - lag
            if corr > best_corr:
                best_corr, best_lag = corr, lag
        if best_lag:
            values.append(rate / best_lag)
    if not values:
        return 0.0
    values.sort()
    return values[len(values) // 2]


def check_resampler_is_phase_continuous(resample: Callable) -> None:
    """Streaming must equal whole-file, at EVERY chunk size.

    SYMPTOM WHEN BROKEN: "the pitch is so fast and weird", and — because a
    one-chunk recorded greeting stays clean while a many-chunk live conversation
    does not — "the voice keeps changing".

    A decimator keeps one sample in N, and WHICH one is a position on a grid
    that runs for the whole utterance. Carrying the filter history but not that
    phase makes every chunk restart the grid, so any chunk length that is not a
    multiple of N resumes on the wrong foot and steps the waveform.
    """
    source = _tone(440, 24000, 24000)
    whole, _ = resample(source)
    # Sizes chosen to be awkward: none is a multiple of three.
    for chunk in (160, 250, 500, 1000, 1441):
        streamed, state = array("h"), None
        for start in range(0, len(source), chunk):
            part, state = resample(source[start : start + chunk], state)
            streamed.extend(part)
        if len(streamed) != len(whole):
            raise ConformanceFailure(
                f"resampler drifts at chunk size {chunk}: {len(streamed)} samples "
                f"against {len(whole)} whole-file. Carry the decimation PHASE, not "
                "just the filter history."
            )
        if streamed.tobytes() != whole.tobytes():
            raise ConformanceFailure(
                f"resampler is not phase-continuous at chunk size {chunk}: streaming "
                "gives different samples from processing the utterance whole."
            )


def check_pitch_survives_the_pipeline(to_wire: Callable, from_wire: Callable) -> None:
    """A voice must come out at the pitch it went in at.

    SYMPTOM WHEN BROKEN: the speaker sounds fast and high, or slow and deep —
    the classic sign of a sample-rate assumption that does not match reality.
    """
    source = _tone(220, 24000, 24000 * 2)  # a female-range fundamental
    wire, _ = to_wire(source.tobytes())
    out = from_wire(wire)
    before = _median_f0(source, 24000)
    after = _median_f0(out, 8000)
    if not before or not after:
        raise ConformanceFailure("could not measure pitch either side of the pipeline")
    ratio = after / before
    if not 0.95 <= ratio <= 1.05:
        raise ConformanceFailure(
            f"pitch shifted by {ratio:.2f}x through the pipeline ({before:.0f} Hz in, "
            f"{after:.0f} Hz out). The source sample rate is not what the code assumes."
        )


def check_no_padding_mid_stream(queue_chunk: Callable, frame_bytes: int) -> None:
    """A partial frame must be carried, not padded.

    SYMPTOM WHEN BROKEN: a rasp through the vowels. Padding every chunk up to a
    frame boundary injects silence at each chunk seam, which is heard as "it
    sounds a bit off" and is almost never diagnosed.
    """
    leftover = queue_chunk(frame_bytes + 90)
    if leftover != 90:
        raise ConformanceFailure(
            f"a {frame_bytes + 90}-byte chunk left {leftover} bytes pending, expected 90. "
            "The remainder must be carried to the next chunk, not padded with silence."
        )


def check_never_faster_than_real_time(frame_bytes: int, frame_seconds: float, lead: float) -> None:
    """Audio must leave at one frame per frame-period, never in a burst.

    SYMPTOM WHEN BROKEN: "fast and weird". A carrier that plays frames as they
    arrive plays a burst fast. Any deliberate lead is delivered as exactly such
    a burst, and it lands on the greeting.
    """
    if frame_bytes != int(frame_seconds * 8000):
        raise ConformanceFailure(
            f"frame size {frame_bytes} does not match {frame_seconds}s at 8 kHz; "
            "the stream is paced at the wrong speed."
        )
    if lead > 0:
        raise ConformanceFailure(
            f"a {lead}s lead is sent as a burst at call start, which lands on the "
            "greeting. Fill gaps with comfort silence instead — it never sends "
            "faster than real time."
        )


def check_one_voice_per_call(opener_bytes: bytes, decode: Callable, live_f0: float) -> None:
    """The recorded greeting must be the same voice as the conversation.

    SYMPTOM WHEN BROKEN: "the voice keeps changing". Rendering the greeting with
    a different model — even under the same voice NAME — gives a measurably
    different voice. Render it with the model that will carry the conversation.
    """
    opener_f0 = _median_f0(decode(opener_bytes), 8000)
    if not opener_f0 or not live_f0:
        raise ConformanceFailure("could not measure pitch of greeting or conversation")
    ratio = max(opener_f0, live_f0) / min(opener_f0, live_f0)
    if ratio > 1.25:
        raise ConformanceFailure(
            f"greeting is {opener_f0:.0f} Hz against the conversation's {live_f0:.0f} Hz "
            f"({ratio:.2f}x). A parent hears that as the voice changing mid-call."
        )


#: Every check, with the human complaint that each one exists to prevent.
CHECKS = {
    "resampler_phase_continuity": (
        '"the pitch is so fast and weird" / "the voice keeps changing"'
    ),
    "pitch_preserved": "the speaker sounds fast and high, or slow and deep",
    "no_padding_mid_stream": "a rasp through the vowels nobody can quite name",
    "never_faster_than_real_time": "\"fast and weird\" on the greeting specifically",
    "one_voice_per_call": "\"the voice keeps changing\"",
}


def assert_conformant(**wiring: Callable | bytes | float | int) -> None:
    """Run every applicable check against one integration's own functions.

    Pass only what applies; anything missing is skipped rather than guessed at,
    so a partial pipeline can still be checked for the parts it does have.
    """
    if "resample" in wiring:
        check_resampler_is_phase_continuous(wiring["resample"])  # type: ignore[arg-type]
    if "to_wire" in wiring and "from_wire" in wiring:
        check_pitch_survives_the_pipeline(wiring["to_wire"], wiring["from_wire"])  # type: ignore[arg-type]
    if "queue_chunk" in wiring and "frame_bytes" in wiring:
        check_no_padding_mid_stream(wiring["queue_chunk"], int(wiring["frame_bytes"]))  # type: ignore[arg-type]
    if {"frame_bytes", "frame_seconds", "lead"} <= wiring.keys():
        check_never_faster_than_real_time(
            int(wiring["frame_bytes"]), float(wiring["frame_seconds"]), float(wiring["lead"])  # type: ignore[arg-type]
        )
    if {"opener_bytes", "decode", "live_f0"} <= wiring.keys():
        check_one_voice_per_call(
            wiring["opener_bytes"], wiring["decode"], float(wiring["live_f0"])  # type: ignore[arg-type]
        )
