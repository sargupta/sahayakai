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
from collections import deque
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
    #: Absolute floor for "speech": mean absolute PCM level of one 20 ms frame.
    #: Was 400 with a fixed threshold; on the 2026-10-11 handset call the
    #: detector never fired. Handset speech reaches us quieter than synthetic
    #: test audio, so the floor is lower and the real work is done by the
    #: adaptive terms below (noise floor x `snr_ratio`, echo x `echo_ratio`).
    min_level: int = 180
    #: Speech must clear the line's own noise by this ratio (~10 dB).
    snr_ratio: float = 3.0
    #: Onset = this many speech frames within the last `onset_window` frames.
    #: Voting, not a consecutive run: real speech dips between syllables, and
    #: a strict run of six frames reset on every dip.
    onset_votes: int = 5
    onset_window: int = 7
    #: Speech frames, counted from onset, that make the interruption real. 20 =
    #: 400 ms of speech: longer than "haan" or "hmm", shorter than any question.
    confirm_frames: int = 20
    #: Quiet frames, while paused and unconfirmed, before playback resumes.
    release_frames: int = 15
    #: ...when what paused it was a real word (>= `word_frames`, 200 ms).
    word_frames: int = 10
    word_release_frames: int = 25
    #: Speech must clear VIDYA's echo on the line by this ratio.
    echo_ratio: float = 2.5
    #: Frames of "VIDYA audible" history the echo estimate is drawn from (3 s),
    #: and which percentile of it.
    echo_history: int = 150
    echo_percentile: float = 0.3
    #: Until this many frames of VIDYA-audible audio have been seen, her echo
    #: on this line is unknown; the threshold is held at twice the floor.
    echo_warmup_frames: int = 25
    #: Smoothing for the noise floor (per quiet frame, nobody speaking).
    noise_alpha: float = 0.02
    #: After a click-length false trigger, onset needs every frame of the window.
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
    #: Speech / not-speech for the last `onset_window` frames.
    window: deque[bool] = field(default_factory=deque)
    loud_since_onset: int = 0
    quiet_run: int = 0
    noise_floor: float = 0.0
    echo_levels: deque[float] = field(default_factory=deque)
    refractory_until: float = 0.0
    #: When the speech building towards an onset began, for latency.
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
    # ---- diagnostics: aggregates only, never audio or words ----
    #: Most votes in one window while VIDYA was audible, and how often a window
    #: came within one vote of an onset without making it.
    max_votes_while_audible: int = 0
    near_misses: int = 0
    #: Frames above the absolute floor rejected only by the echo or noise term.
    rejected_by_echo: int = 0
    rejected_by_noise: int = 0

    @property
    def paused(self) -> bool:
        return self.state is _State.PAUSED

    @property
    def echo_floor(self) -> float:
        """VIDYA's leak on this line: a LOW percentile of what is heard while
        she is audible. The leak is there under all of her speech; a parent's
        interruption is brief, so it lifts the upper percentiles, not this one.
        No estimate until the warm-up has been seen."""
        if len(self.echo_levels) < self.config.echo_warmup_frames:
            return 0.0
        ordered = sorted(self.echo_levels)
        return ordered[int(len(ordered) * self.config.echo_percentile)]

    def threshold(self, *, ai_audible: bool = True) -> float:
        c = self.config
        base = max(float(c.min_level), self.noise_floor * c.snr_ratio)
        if not ai_audible:
            return base
        if len(self.echo_levels) < c.echo_warmup_frames:
            base = max(base, 2.0 * c.min_level)
        return max(base, self.echo_floor * c.echo_ratio)

    def _votes_needed(self, now: float) -> int:
        if now < self.refractory_until:
            return self.config.onset_window
        return self.config.onset_votes

    def _is_speech(self, level: float, *, ai_audible: bool) -> bool:
        c = self.config
        if level < c.min_level:
            return False
        if level < self.noise_floor * c.snr_ratio:
            self.rejected_by_noise += 1
            return False
        if ai_audible and level < self.threshold(ai_audible=True):
            self.rejected_by_echo += 1
            return False
        return True

    def _learn(self, level: float, *, speech: bool, ai_audible: bool) -> None:
        if ai_audible:
            # What the line carries while VIDYA talks: her echo plus noise. Every
            # frame, speech included: learning only from "non-speech" frames
            # meant an echo already above the floor was never learned at all.
            # A low percentile over ~3 s is not moved by a parent's brief words,
            # and once they talk over her she pauses and stops being audible.
            self.echo_levels.append(level)
            while len(self.echo_levels) > self.config.echo_history:
                self.echo_levels.popleft()
        elif not speech:
            a = self.config.noise_alpha
            self.noise_floor = (
                level if self.noise_floor == 0.0 else (1 - a) * self.noise_floor + a * level
            )

    def on_frame(self, level: float, now: float, *, ai_audible: bool) -> Action:  # noqa: PLR0911 — one return per transition
        """Feed one 20 ms inbound frame. Returns what playback should do now."""
        loud = self._is_speech(level, ai_audible=ai_audible)
        self._learn(level, speech=loud, ai_audible=ai_audible)
        if self.state is _State.PAUSED:
            return self._while_paused(loud, now)

        self.window.append(loud)
        while len(self.window) > self.config.onset_window:
            self.window.popleft()
        votes = sum(self.window)
        if votes == 0:
            self.run_started_at = None
            return Action.NONE
        if self.run_started_at is None:
            self.run_started_at = now
        if not ai_audible:
            return Action.NONE
        self.max_votes_while_audible = max(self.max_votes_while_audible, votes)
        needed = self._votes_needed(now)
        if votes < needed:
            if votes == needed - 1 and loud:
                self.near_misses += 1
            return Action.NONE
        self.state = _State.PAUSED
        self.pauses += 1
        self.loud_since_onset = votes
        self.quiet_run = 0
        self.detected_at = now
        self.onset_at = self.run_started_at
        if now < self.carry_until:
            self.loud_since_onset += self.carry_frames
        self.carry_frames = 0
        if self.loud_since_onset >= self.config.confirm_frames:
            return self._cancel(now)
        return Action.PAUSE

    def _while_paused(self, loud: bool, now: float) -> Action:
        if loud:
            self.loud_since_onset += 1
            self.quiet_run = 0
            if self.loud_since_onset >= self.config.confirm_frames:
                return self._cancel(now)
            return Action.NONE
        self.quiet_run += 1
        # After a real word, a sentence pause ("Wait. Wait, one minute") is
        # longer than the gap after a blip; resuming into it talks over the
        # parent's next word (staging run 3: 0.5 s of VIDYA resumed).
        needed = (
            self.config.word_release_frames
            if self.loud_since_onset >= self.config.word_frames
            else self.config.release_frames
        )
        if self.quiet_run < needed:
            return Action.NONE
        # A backchannel or a noise: carry on where VIDYA stopped.
        self.state = _State.LISTENING
        self.false_triggers += 1
        if self.loud_since_onset < self.config.onset_votes + 2:
            # Barely past the onset: a click or a crackle. A noisy line must not
            # stutter every sentence, so demand a full window for a while.
            self.refractory_until = now + self.config.refractory_seconds
        # A word, not a noise: if more speech follows soon it is the same
        # interruption ("wait... wait, one minute"), so carry it.
        self.carry_frames = self.loud_since_onset
        self.carry_until = now + self.config.carry_seconds
        self._reset_run()
        return Action.RESUME

    def diagnostics(self) -> dict[str, int]:
        return {
            "noise_floor": round(self.noise_floor),
            "echo_floor": round(self.echo_floor),
            "threshold": round(self.threshold()),
            "echo_frames_seen": len(self.echo_levels),
            "max_votes_while_audible": self.max_votes_while_audible,
            "near_misses": self.near_misses,
            "rejected_by_echo": self.rejected_by_echo,
            "rejected_by_noise": self.rejected_by_noise,
        }

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
        self.window.clear()
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
