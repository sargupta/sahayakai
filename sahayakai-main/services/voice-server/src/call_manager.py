"""
Call lifecycle manager for the Parent Call pipeline.

Sits between LLM and TTS in the pipeline to:
  - Track agent responses for transcript persistence
  - Count conversation turns
  - Emit EndFrame after max turns to terminate the call
  - Fire transcript-sync callbacks (non-blocking)
"""

from __future__ import annotations

import asyncio
import re
from typing import Callable, Awaitable, TYPE_CHECKING

from loguru import logger
from pipecat.frames.frames import (
    Frame,
    EndTaskFrame,
    LLMTextFrame,
    LLMFullResponseStartFrame,
    LLMFullResponseEndFrame,
    TTSSpeakFrame,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

from src.call_policy import AI_REVEAL_WORD_BOUNDED
from src.opt_out import is_no_more_calls_promise
from src.conversation_state import PHASE_INSTRUCTION_PREFIX

if TYPE_CHECKING:
    from src.conversation_state import PhaseInstructor

# Strip markdown, bullets, numbering, colons at end — TTS only handles natural language
_SANITIZE_RE = re.compile(r'[*#\-•\[\]\(\)\{\}:]|^\d+\.\s*', re.MULTILINE)

# Sentence-ending punctuation (Hindi purna viram + standard)
_SENTENCE_END_RE = re.compile(r'[।.?!]')

# AI identity reveal keywords — replace entire response if detected.
# Defined in call_policy (pure) so the plan can pick it per call; the
# word-bounded pattern is the default and what every call uses.
_AI_REVEAL_WORDS = AI_REVEAL_WORD_BOUNDED
_AI_REVEAL_REPLACEMENT = "जी, मैं {teacher_name} बोल रहा हूँ। {student_name} के बारे में बात करते हैं।"


MAX_RESPONSE_WORDS = 20  # Hard cap — phone calls need brevity


def _first_sentence(text: str) -> str:
    """Extract only the first sentence, capped at MAX_RESPONSE_WORDS words."""
    m = _SENTENCE_END_RE.search(text)
    result = text[: m.end()].strip() if m else text.strip()
    # Word budget guard — truncate long sentences
    words = result.split()
    if len(words) > MAX_RESPONSE_WORDS:
        result = " ".join(words[:MAX_RESPONSE_WORDS])
    return result


class CallManager(FrameProcessor):
    """Manages call lifecycle: turn counting, transcript persistence, call ending.

    Placed AFTER the LLM in the pipeline. Observes LLM output frames
    and passes them through transparently to TTS.

    Frame flow:
      LLM → [CallManager observes LLMTextFrame/EndFrame] → TTS
    """

    # Callback: (transcript, turn_number) → awaitable
    OnTurnComplete = Callable[[list[dict], int], Awaitable[None]]

    def __init__(
        self,
        *,
        context,
        call_context: dict,
        max_turns: int = 6,
        on_turn_complete: "CallManager.OnTurnComplete | None" = None,
        on_ending: "Callable[[str], Awaitable[None]] | None" = None,
        phase_instructor: "PhaseInstructor | None" = None,
        ai_reveal_pattern: "re.Pattern[str] | None" = None,
        ai_reveal_line: str | None = None,
        closing_line: str | None = None,
        future_calls_line: str | None = None,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self._context = context  # Universal LLMContext — holds full conversation
        self._call_context = call_context
        # Both come from the CallPlan. None keeps the original behaviour
        # (original pattern, Hindi "I am the teacher" replacement).
        self._ai_reveal_re = ai_reveal_pattern or _AI_REVEAL_WORDS
        self._ai_reveal_line = ai_reveal_line
        self._max_turns = max_turns
        self._on_turn_complete = on_turn_complete
        # Told when this processor starts a graceful ending, so the ending can
        # be bounded (bot.py: ENDING_BOUND_SECONDS).
        self._on_ending = on_ending
        self._phase_instructor = phase_instructor
        self._turn_number = 0
        self._current_response = ""
        self._collecting = False
        self._sentence_complete = False  # True after first sentence end detected
        self._ai_reveal_detected = False  # True if LLM tries to reveal AI identity
        # After a possible stop request (fixed_close), no model text reaches
        # TTS for the rest of the call: the next model reply is replaced by
        # this fixed goodbye and the call ends (rereview final #1).
        self._closing_line = closing_line
        # Every reply is screened before it is spoken: its first sentence is
        # held until complete, and a sentence saying whether the school will
        # or will not call again is dropped and replaced by this fixed line.
        # The turn and the call go on as usual: nothing on the model's side
        # ever records an opt-out or ends the call (that is the parent's
        # words only: StopRequestGuard and the post-call analysis).
        self._future_calls_line = future_calls_line
        self._held = ""
        self._promise_detected = False
        self._fixed_close = False
        self._replied_after_notice = False
        self._goodbye_taken = False

    def close_with_fixed_goodbye(self) -> None:
        """From now on the parent hears no model output.

        Every streamed LLMTextFrame is dropped. The first model reply that
        STARTS after this call is replaced by the fixed goodbye, which ends
        the call; a reply already under way is dropped silently.
        """
        self._fixed_close = True
        self._replied_after_notice = False

    def _is_last_turn(self) -> bool:
        """After this turn's bookkeeping, will CallManager end the call?"""
        if self._turn_number >= self._max_turns:
            return True
        if self._phase_instructor is not None:
            from src.conversation_state import ConversationPhase
            return self._phase_instructor.phase == ConversationPhase.ENDED
        return False

    def take_goodbye(self) -> bool:
        """Claim the call's one fixed goodbye. True the first time only.

        bot.py's close timer and this processor both may close a call after a
        stop; whichever takes the goodbye first says it.
        """
        if self._goodbye_taken:
            return False
        self._goodbye_taken = True
        return True

    @property
    def turn_number(self) -> int:
        return self._turn_number

    async def _end_call(self, why: str) -> None:
        """Ask the pipeline TASK to end, from its source.

        An EndFrame pushed downstream from here (the old way) only reached TTS
        and the output: the task never saw it, runner.run() never returned, so
        main.py never hung up and the parent sat on a silent, billed line
        until they hung up or pipecat's idle timeout fired. EndTaskFrame goes
        UPSTREAM to the task, which queues an EndFrame at the source; it
        travels behind the goodbye already on its way to TTS, so the goodbye
        is still spoken first.

        pipecat waits for that EndFrame with no timeout, so the ending is also
        reported to `on_ending`, which bounds it (rereview-0b #8).
        """
        await self.push_frame(EndTaskFrame(), FrameDirection.UPSTREAM)
        if self._on_ending is not None:
            try:
                await self._on_ending(why)
            except Exception as e:  # noqa: BLE001
                logger.warning(f"Ending watchdog could not start: {e}")

    async def _release_held(self, direction: FrameDirection) -> None:
        """Speak the held first sentence; a sentence about future calls is replaced."""
        text, self._held = self._held, ""
        if is_no_more_calls_promise(text):
            self._promise_detected = True
            logger.warning(f"Turn {self._turn_number + 1}: model sentence about future calls replaced")
            if self._future_calls_line:
                await self.push_frame(TTSSpeakFrame(text=self._future_calls_line), direction)
            return
        clean = _SANITIZE_RE.sub('', text).replace('\n', ' ')
        if clean.strip():
            await self.push_frame(LLMTextFrame(text=clean), direction)

    async def _close_if_last(self, direction: FrameDirection) -> None:
        """After a replaced sentence on the call's last turn, say the goodbye too.

        The future-calls line is not a goodbye; the call must not end on it.
        """
        if self._is_last_turn() and self._closing_line and self.take_goodbye():
            await self.push_frame(TTSSpeakFrame(text=self._closing_line), direction)
            self._context.add_message({"role": "assistant", "content": self._closing_line})

    async def _fixed_close_frame(self, frame: Frame, direction: FrameDirection) -> None:
        """Model output after a possible stop: never spoken."""
        if isinstance(frame, LLMTextFrame):
            return  # dropped: the parent must hear only fixed text now
        if isinstance(frame, LLMFullResponseStartFrame):
            self._replied_after_notice = True
            await self.push_frame(frame, direction)
            return
        # LLMFullResponseEndFrame
        self._collecting = False
        if not (self._replied_after_notice and self.take_goodbye()):
            await self.push_frame(frame, direction)
            return
        self._turn_number += 1
        goodbye = self._closing_line or ""
        if goodbye:
            await self.push_frame(TTSSpeakFrame(text=goodbye), direction)
            self._context.add_message({"role": "assistant", "content": goodbye})
        logger.info(f"Turn {self._turn_number}: model reply after a stop request replaced by the fixed goodbye")
        await self.push_frame(frame, direction)
        await self._end_call("the goodbye after the opt-out line")

    @property
    def transcript(self) -> list[dict]:
        """Extract transcript from universal LLMContext messages.

        Universal context uses OpenAI-style dicts:
          {"role": "user"/"assistant", "content": "..."}
        """
        transcript = []
        for msg in self._context.get_messages():
            try:
                if not isinstance(msg, dict):
                    continue
                role_raw = msg.get("role", "")
                if role_raw == "user":
                    role = "parent"
                elif role_raw in ("assistant", "model"):
                    role = "agent"
                else:
                    continue

                content = msg.get("content", "")
                text = content if isinstance(content, str) else str(content)

                # Skip phase instruction messages (injected by PhaseInstructor)
                if text.startswith(PHASE_INSTRUCTION_PREFIX):
                    continue

                if text and text.strip():
                    transcript.append({"role": role, "text": text.strip()})
            except Exception as e:
                logger.warning(f"Error extracting message: {e}")
                continue

        return transcript

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if self._fixed_close and isinstance(frame, (LLMTextFrame, LLMFullResponseStartFrame, LLMFullResponseEndFrame)):
            await self._fixed_close_frame(frame, direction)
            return

        if isinstance(frame, LLMFullResponseStartFrame):
            self._collecting = True
            self._current_response = ""
            self._sentence_complete = False
            self._ai_reveal_detected = False
            self._held = ""
            self._promise_detected = False

        elif isinstance(frame, LLMTextFrame):
            if not self._collecting:
                # Text outside a model response: screened, then passed on.
                if self._ai_reveal_re.search(frame.text) or is_no_more_calls_promise(frame.text):
                    return
                clean = _SANITIZE_RE.sub('', frame.text).replace('\n', ' ')
                if clean.strip():
                    await self.push_frame(LLMTextFrame(text=clean), direction)
                return
            self._current_response += frame.text  # still collected for context
            # After the first sentence, or once the reply is rejected, nothing more is spoken.
            if self._ai_reveal_detected or self._promise_detected or self._sentence_complete:
                return
            piece = frame.text
            m = _SENTENCE_END_RE.search(self._current_response)
            if m:
                self._sentence_complete = True
                # Keep only up to the sentence end (prev = accumulated - this frame)
                prev_len = len(self._current_response) - len(frame.text)
                piece = frame.text[: max(0, m.end() - prev_len)]
            self._held += piece
            # Guard: AI-revealing words in the FIRST sentence (the only one
            # ever spoken) suppress it. Words in a later sentence, which is
            # never spoken, do not silence the turn (final review #8).
            if self._ai_reveal_re.search(self._held):
                self._ai_reveal_detected = True
                self._held = ""
                return
            if self._sentence_complete:
                await self._release_held(direction)
            return

        elif isinstance(frame, LLMFullResponseEndFrame):
            self._collecting = False

            # Already past max turns — suppress everything
            if self._turn_number >= self._max_turns:
                self._held = ""
                return

            # A reply with no sentence end is screened and spoken now.
            if self._held and not self._ai_reveal_detected:
                await self._release_held(direction)

            self._turn_number += 1

            # Advance conversation phase (PhaseInstructor is upstream of LLM,
            # so it can't see LLMFullResponseEndFrame — we drive it from here)
            if self._phase_instructor:
                self._phase_instructor.advance_phase()

            if self._promise_detected:
                # Already replaced by the fixed line (spoken in _release_held);
                # that line, not the model's sentence, is what was said.
                self._context.add_message({"role": "assistant", "content": self._future_calls_line or ""})
                await self._close_if_last(direction)
            elif self._current_response:
                # Truncate to first sentence only
                truncated = _first_sentence(self._current_response)
                truncated = _SANITIZE_RE.sub('', truncated).replace('\n', ' ').strip()

                if self._ai_reveal_re.search(truncated) and is_no_more_calls_promise(truncated) \
                        and self._future_calls_line:
                    # Trips both guards ("we will never call you aGAIn"): the
                    # future-calls line answers it.
                    truncated = self._future_calls_line
                    logger.warning(f"Turn {self._turn_number}: model sentence about future calls replaced")
                    await self.push_frame(TTSSpeakFrame(text=truncated), direction)
                    self._context.add_message({"role": "assistant", "content": truncated})
                    await self._close_if_last(direction)
                    truncated = None
                # Guard: If LLM reveals it's AI, replace with safe response
                elif self._ai_reveal_re.search(truncated):
                    if self._is_last_turn() and self._closing_line:
                        # The call ends after this turn: close it with the
                        # fixed goodbye, not a question the parent cannot
                        # answer (the request-to-talk line asks for a time;
                        # final-0b #2).
                        truncated = self._closing_line
                    elif self._ai_reveal_line:
                        truncated = self._ai_reveal_line
                    else:
                        teacher = self._call_context.get("teacherName", "Teacher")
                        student = self._call_context.get("studentName", "student")
                        truncated = f"जी, मैं {teacher} बोल रहा हूँ। {student} के बारे में बात करते हैं।"
                    logger.warning(f"Turn {self._turn_number}: AI reveal blocked, replaced")
                    # Also need to push this replacement to TTS
                    await self.push_frame(TTSSpeakFrame(text=truncated), direction)
                    # No early return: a replaced reply is still a turn, and
                    # on the last turn the call must still end (review
                    # rereview-0b #7: a goodbye that tripped the guard left the
                    # line up until the parent hung up).
                else:
                    # Length only: what the model said is part of the conversation.
                    logger.info(f"Turn {self._turn_number}: reply of {len(truncated)} chars")
                # Add the TRUNCATED (or replacement) response to LLM context
                if truncated is not None:
                    self._context.add_message(
                        {"role": "assistant", "content": truncated}
                    )

            # Fire transcript sync (non-blocking)
            if self._on_turn_complete:
                try:
                    asyncio.create_task(
                        self._on_turn_complete(self.transcript, self._turn_number)
                    )
                except Exception as e:
                    logger.warning(f"Turn sync callback failed: {e}")

            # End call after max turns
            if self._turn_number >= self._max_turns:
                logger.info(f"Max turns ({self._max_turns}) reached — ending call")
                await self.push_frame(frame, direction)
                await self._end_call("the last turn")
                return

            # End call after CLOSE phase goodbye is spoken
            # (PhaseInstructor transitions CLOSE → ENDED after its 1 turn)
            if self._phase_instructor is not None:
                from src.conversation_state import ConversationPhase
                if self._phase_instructor.phase == ConversationPhase.ENDED:
                    logger.info(f"CLOSE phase complete — ending call after turn {self._turn_number}")
                    await self.push_frame(frame, direction)
                    await self._end_call("the CLOSE goodbye")
                    return

        # Pass ALL frames through — CallManager is transparent
        await self.push_frame(frame, direction)
