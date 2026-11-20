"""
Pipeline stage that hears a possible "please don't call me again" before the
model does.

Pipeline position: stt → StopRequestGuard → stt_filter → context_aggregator.user()

Every final transcription of the parent's speech goes through
opt_out.StopListener:
  NOTICE  a stop. Swallowed (the model does not answer it) and handed to
          bot.py, which records it for the teacher, says the fixed line and
          closes the call politely.
  WAIT    a plain "don't call me". Held, unseen by the model, until the next
          transcription or a quiet spell: "Don't call me" + "after 9 pm" is a
          limit, not a stop. The quiet is measured from when the parent STOPS
          speaking (the VAD frames): their starting to speak again cancels
          it, their stopping restarts it, with STT_MARGIN_SECONDS for the
          final transcription to arrive. If it was not a stop after all, the
          held transcription is released to the model, in order, before the
          next one. HOLD_CAP_SECONDS bounds the hold: a parent who keeps
          talking gets a decision at the cap (released to the model; the
          post-call check still sees it).
  PASS    ordinary speech, passed on unchanged.
Nothing here writes anything, and nothing anywhere in the engine blocks a
number.
"""

from __future__ import annotations

import asyncio
from typing import Awaitable, Callable

from pipecat.frames.frames import Frame, TranscriptionFrame
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

from src.opt_out import HOLD, NOTICE, NOTICE_HELD, WAIT, StopListener, normalize
from src.stt_noise import drop_reason

# How long a plain stop waits, after the parent stops speaking, for the rest
# of the sentence; plus the time a final transcription takes to arrive after
# the speech ends. No hold lasts longer than the cap.
QUIET_SECONDS = 1.2
STT_MARGIN_SECONDS = 0.6
HOLD_CAP_SECONDS = 5.0
# The parent starting / stopping to speak (by name: pipecat versions differ in
# which of these the transport sends).
_STARTED_SPEAKING = frozenset({"VADUserStartedSpeakingFrame", "UserStartedSpeakingFrame"})
_STOPPED_SPEAKING = frozenset({"VADUserStoppedSpeakingFrame", "UserStoppedSpeakingFrame"})


class StopRequestGuard(FrameProcessor):
    def __init__(
        self,
        *,
        listener: StopListener,
        on_stop: Callable[[str, str], Awaitable[None]],
        **kwargs,
    ):
        """`on_stop(utterance, quote)`: the swallowed transcription(s), and the
        parent's words that made it a stop."""
        super().__init__(**kwargs)
        self._listener = listener
        self._on_stop = on_stop
        self._held: list[tuple[Frame, FrameDirection]] = []
        self._quiet: asyncio.Task | None = None
        self._cap: asyncio.Task | None = None
        self.spoken_since_notice = False

    @property
    def noticed(self) -> bool:
        return self._listener.noticed

    @property
    def waiting(self) -> bool:
        return self._listener.pending is not None

    @staticmethod
    def _now() -> float | None:
        try:
            return asyncio.get_running_loop().time()
        except RuntimeError:
            return None

    def _cancel_quiet(self) -> None:
        if self._quiet is not None and not self._quiet.done() and self._quiet is not asyncio.current_task():
            self._quiet.cancel()
        self._quiet = None

    def _start_quiet(self) -> None:
        self._cancel_quiet()
        self._quiet = asyncio.ensure_future(self._after_quiet())

    def _end_hold(self) -> None:
        self._cancel_quiet()
        if self._cap is not None and not self._cap.done() and self._cap is not asyncio.current_task():
            self._cap.cancel()
        self._cap = None

    def _held_text(self, extra: str = "") -> str:
        texts = [f.text or "" for f, _ in self._held] + ([extra] if extra else [])
        # Punctuation-only finals and noise fragments are not words.
        return " ".join(t.strip() for t in texts if normalize(t) and not drop_reason(t))

    async def _fire(self, extra: str = "") -> None:
        utterance = self._held_text(extra)
        self._held = []
        await self._on_stop(utterance, self._listener.quote or utterance)

    async def _after_quiet(self) -> None:
        await asyncio.sleep(QUIET_SECONDS + STT_MARGIN_SECONDS)
        if self._listener.on_quiet():
            self._end_hold()
            await self._fire()

    async def _after_cap(self) -> None:
        await asyncio.sleep(HOLD_CAP_SECONDS)
        if self._listener.release_pending():
            self._end_hold()
            held, self._held = self._held, []
            for held_frame, held_direction in held:
                await self.push_frame(held_frame, held_direction)

    def take_pending(self) -> tuple[str, str] | None:
        """The call is ending with a plain stop still held: it stands.

        Returns (utterance, quote) and forgets it; None when nothing is held.
        """
        self._end_hold()
        if not self._listener.on_quiet():
            return None
        utterance = self._held_text()
        self._held = []
        return utterance, self._listener.quote or utterance

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if self._held and not self._listener.noticed:
            name = type(frame).__name__
            if name in _STARTED_SPEAKING or name in _STOPPED_SPEAKING:
                self._listener.touch(self._now())
            if name in _STARTED_SPEAKING:
                self._cancel_quiet()  # they are still talking: wait for their words
            elif name in _STOPPED_SPEAKING:
                self._start_quiet()   # measure the quiet from here

        if isinstance(frame, TranscriptionFrame):
            text = frame.text or ""
            if self._listener.noticed:
                if normalize(text):
                    self.spoken_since_notice = True
            else:
                decision = self._listener.hear(text, self._now())
                if decision == HOLD:
                    # Nothing to judge: keep it with the held words; the
                    # quiet and the cap run on unchanged.
                    self._held.append((frame, direction))
                    return
                if decision == NOTICE_HELD:
                    self._end_hold()
                    await self._fire()
                    self.spoken_since_notice = True
                    await self.push_frame(frame, direction)
                    return
                if decision == NOTICE:
                    self._end_hold()
                    await self._fire(text)
                    return
                if decision == WAIT:
                    self._end_hold()
                    self._held.append((frame, direction))
                    self._start_quiet()
                    self._cap = asyncio.ensure_future(self._after_cap())
                    return
                # Not a stop: anything held goes to the model first, in order.
                self._end_hold()
                held, self._held = self._held, []
                for held_frame, held_direction in held:
                    await self.push_frame(held_frame, held_direction)

        await self.push_frame(frame, direction)
