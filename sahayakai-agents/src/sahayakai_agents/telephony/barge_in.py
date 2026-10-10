"""Barge-in: stop talking the moment the parent starts.

WHY THE MODEL'S OWN SIGNAL IS NOT ENOUGH

Until this module the bridge stopped speaking only when Gemini Live sent
`interrupted`. That event arrives after the model's own voice-activity detector
has heard enough of the parent to be sure — on a phone line, routinely half a
second or more — and in that time the pacer keeps playing. The parent says
"ek minute" and VIDYA talks straight over it, which is the complaint.

The bridge already has the parent's audio, frame by frame, before the model
does. So the decision is made here, from the audio, in three steps:

    speech onset while VIDYA is audible  -> PAUSE   (stop playback, keep frames)
    speech continues                     -> CANCEL  (drop the response for good)
    speech stops quickly, unconfirmed    -> RESUME  (it was "haan" or a cough)

PAUSE first rather than CANCEL first because Indian parents backchannel —
"haan", "achha", "hmm" — while listening, and the prompt tells VIDYA to keep
flowing through those. Cancelling on every "haan" would chop every sentence.
Pausing costs nothing if it turns out to be a backchannel: the held frames play
on. The model's `interrupted` event still cancels at any point, so the worst
case is today's behaviour, never worse.

ECHO

A handset on speaker can feed VIDYA's own voice back up the line. Echo is a
quieter copy of what we are sending, so the threshold rises with the level
heard WHILE VIDYA IS TALKING AND NOBODY HAS BARGED IN — the echo floor. A
parent speaking over it is far louder than their phone's leak of our audio.

Pure and clock-injected, so every timing case is a deterministic test.
"""

from __future__ import annotations

import math
from collections.abc import Iterable
from dataclasses import dataclass, field
from enum import Enum

__all__ = ["Action", "BargeIn", "BargeInConfig", "frame_level", "percentile"]


class Action(Enum):
    NONE = "none"
    PAUSE = "pause"
    CANCEL = "cancel"
    RESUME = "resume"


@dataclass(frozen=True)
class BargeInConfig:
    #: Mean absolute PCM level that can count as speech. Same floor the bridge
    #: uses to decide a parent is engaged; mu-law silence decodes to ~0.
    speech_level: int = 400
    #: Consecutive loud 20 ms frames before playback pauses. 6 = 120 ms: long
    #: enough that a click or a crackle does not stop VIDYA mid-word.
    onset_frames: int = 6
    #: Loud frames, counted from onset, that make the interruption real. 20 =
    #: 400 ms of speech — longer than "haan" or "hmm", shorter than any question.
    confirm_frames: int = 20
    #: Quiet frames, while paused and unconfirmed, before playback resumes.
    release_frames: int = 15
    #: A loud level must clear the echo floor by this ratio to count.
    echo_ratio: float = 3.0
    #: Smoothing for the echo floor (per frame).
    echo_alpha: float = 0.05
    #: After a false trigger, onset needs this many times the frames for a while,
    #: so one noisy line cannot stutter every sentence.
    refractory_multiplier: int = 2
    refractory_seconds: float = 2.0
    #: Speech resuming this soon after a release continues the same
    #: interruption; its frames count towards confirmation.
    carry_seconds: float = 1.0


def frame_level(pcm: Iterable[int]) -> float:
    """Mean absolute sample value of one decoded frame."""
    samples = list(pcm)
    if not samples:
        return 0.0
    return sum(abs(s) for s in samples) / len(samples)


class _State(Enum):
    LISTENING = "listening"
    PAUSED = "paused"


@dataclass
class BargeIn:
    """The barge-in state machine for one call."""

    config: BargeInConfig = field(default_factory=BargeInConfig)
    state: _State = _State.LISTENING
    loud_run: int = 0
    loud_since_onset: int = 0
    quiet_run: int = 0
    echo_floor: float = 0.0
    refractory_until: float = 0.0
    #: When the current loud run began (first loud frame), for latency.
    run_started_at: float | None = None
    #: When the latest PAUSE/CANCEL decision was made, and when the speech that
    #: caused it began.
    detected_at: float | None = None
    onset_at: float | None = None
    false_triggers: int = 0
    pauses: int = 0
    cancels: int = 0
    #: Interruptions the model's detector caught before ours did.
    model_first: int = 0
    carry_frames: int = 0
    carry_until: float = 0.0

    @property
    def paused(self) -> bool:
        return self.state is _State.PAUSED

    def _threshold(self) -> float:
        return max(float(self.config.speech_level), self.echo_floor * self.config.echo_ratio)

    def _onset_needed(self, now: float) -> int:
        if now < self.refractory_until:
            return self.config.onset_frames * self.config.refractory_multiplier
        return self.config.onset_frames

    def on_frame(self, level: float, now: float, *, ai_audible: bool) -> Action:  # noqa: PLR0911 — one return per transition
        """Feed one 20 ms inbound frame. Returns what playback should do now."""
        loud = level >= self._threshold()

        if self.state is _State.PAUSED:
            if loud:
                self.loud_since_onset += 1
                self.quiet_run = 0
                if self.loud_since_onset >= self.config.confirm_frames:
                    return self._cancel(now)
                return Action.NONE
            self.quiet_run += 1
            if self.quiet_run >= self.config.release_frames:
                # A backchannel or a noise: carry on where VIDYA stopped.
                self.state = _State.LISTENING
                self.false_triggers += 1
                if self.loud_since_onset < self.config.onset_frames + 2:
                    # Barely past the onset: a click or a crackle. A noisy
                    # line must not stutter every sentence, so demand more.
                    self.refractory_until = now + self.config.refractory_seconds
                # A word, not a noise: if more speech follows soon it is the
                # same interruption ("wait... wait, one minute"), so carry it.
                self.carry_frames = self.loud_since_onset
                self.carry_until = now + self.config.carry_seconds
                self._reset_run()
                return Action.RESUME
            return Action.NONE

        if not loud:
            if ai_audible and self.loud_run == 0:
                # What the line carries while only VIDYA is talking: the echo floor.
                a = self.config.echo_alpha
                self.echo_floor = (1 - a) * self.echo_floor + a * level
            self._reset_run()
            return Action.NONE

        if self.loud_run == 0:
            self.run_started_at = now
        self.loud_run += 1
        if ai_audible and self.loud_run >= self._onset_needed(now):
            self.state = _State.PAUSED
            self.pauses += 1
            self.loud_since_onset = self.loud_run
            self.quiet_run = 0
            self.detected_at = now
            self.onset_at = self.run_started_at
            if now < self.carry_until:
                self.loud_since_onset += self.carry_frames
            self.carry_frames = 0
            if self.loud_since_onset >= self.config.confirm_frames:
                return self._cancel(now)
            return Action.PAUSE
        return Action.NONE

    def on_model_interrupted(self, now: float) -> Action:
        """The model's own detector agrees. Always final."""
        if self.state is not _State.PAUSED:
            # The model heard it before we did: the decision time is now.
            self.detected_at = now
            self.onset_at = now
            self.model_first += 1
        return self._cancel(now)

    def on_ai_finished(self) -> None:
        """Nothing left to interrupt; a pause with nothing behind it is moot."""
        if self.state is _State.PAUSED:
            self.state = _State.LISTENING
            self._reset_run()

    def _cancel(self, now: float) -> Action:  # noqa: ARG002 — symmetry with the other transitions
        self.state = _State.LISTENING
        self.cancels += 1
        self._reset_run()
        return Action.CANCEL

    def _reset_run(self) -> None:
        self.loud_run = 0
        self.loud_since_onset = 0
        self.quiet_run = 0
        self.run_started_at = None


def percentile(values: list[float], pct: float) -> float | None:
    """Nearest-rank percentile; None for no data."""
    if not values:
        return None
    ordered = sorted(values)
    rank = max(1, math.ceil(pct / 100 * len(ordered)))
    return ordered[rank - 1]
