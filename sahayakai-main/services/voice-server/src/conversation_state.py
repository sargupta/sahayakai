"""
Adaptive Conversation Guide for the Parent Call pipeline.

NOT a rigid state machine. Soft phase hints that guide the LLM toward
a natural call flow while letting it adapt to whatever the parent says.

Phases are *suggestions*, not rails:
  OPENING → EXPLORE → ADVISE → CLOSE

The LLM sees what phase we're in and gets a nudge, but it's free to
handle unexpected topics (fees, health, family problems, emotional parents)
naturally — like a real teacher would.

Architecture:
  PhaseInstructor sits BEFORE LLM — intercepts LLMContextFrame to inject guidance.
  CallManager sits AFTER LLM — calls advance_phase() after each turn.
"""

from enum import Enum

from loguru import logger
from pipecat.frames.frames import Frame, LLMContextFrame
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor


# Prefix for phase instructions — used to filter from transcripts.
# Lives with the guidance text in the pure prompts module; re-exported here
# because CallManager has always imported it from this module.
from src.prompts.phase_guidance import PHASE_INSTRUCTION_PREFIX  # noqa: E402


class ConversationPhase(Enum):
    """Soft phases of a parent call. Fewer phases = more flexibility."""
    OPENING = "opening"        # Greeting played, waiting for parent's first response
    EXPLORE = "explore"        # Understanding parent's situation (1-2 turns)
    ADVISE = "advise"          # Give suggestion, check if anything else
    CLOSE = "close"            # Wrap up warmly
    ENDED = "ended"            # Call done


# The guidance text itself is chosen per call by call_policy.plan_call and
# lives in src/prompts/phase_guidance.py (pure, so the tests can read it):
# the original table for positive_feedback calls, the request-to-talk table
# for every other call.

# Default phase transition — but CallManager can also skip phases
_NEXT_PHASE: dict[ConversationPhase, ConversationPhase] = {
    ConversationPhase.OPENING: ConversationPhase.EXPLORE,
    ConversationPhase.EXPLORE: ConversationPhase.ADVISE,
    ConversationPhase.ADVISE: ConversationPhase.CLOSE,
    ConversationPhase.CLOSE: ConversationPhase.ENDED,
}

# How many turns each phase can last before auto-advancing
# (prevents getting stuck if parent keeps talking)
_PHASE_MAX_TURNS: dict[ConversationPhase, int] = {
    ConversationPhase.OPENING: 1,    # Just one exchange after greeting
    ConversationPhase.EXPLORE: 2,    # 1-2 turns to understand
    ConversationPhase.ADVISE: 2,     # Give tip + check concerns
    ConversationPhase.CLOSE: 1,      # One goodbye
}


class PhaseInstructor(FrameProcessor):
    """Injects soft conversation guidance into LLM context before inference.

    Pipeline position: context_aggregator.user() → PhaseInstructor → llm

    Intercepts LLMContextFrame (user spoke → ready for LLM), appends
    phase guidance. CallManager (downstream of LLM) calls advance_phase()
    after each completed turn.
    """

    def __init__(self, *, guidance: dict[str, str], **kwargs):
        """`guidance` maps a phase value to its fully rendered text (CallPlan.phase_guidance)."""
        super().__init__(**kwargs)
        self._phase = ConversationPhase.OPENING
        self._guidance = dict(guidance)
        self._turns_in_phase = 0

    @property
    def phase(self) -> ConversationPhase:
        return self._phase

    def advance_phase(self):
        """Move to the next conversation phase. Called by CallManager."""
        self._turns_in_phase += 1

        # Auto-advance if we've spent too many turns in this phase
        max_turns = _PHASE_MAX_TURNS.get(self._phase, 1)
        if self._turns_in_phase >= max_turns:
            self._force_advance()
        # Otherwise, stay in current phase (LLM adapts within it)

    def _force_advance(self):
        """Force transition to next phase."""
        next_phase = _NEXT_PHASE.get(self._phase)
        if next_phase:
            self._phase = next_phase
            self._turns_in_phase = 0
            logger.info(f"Conversation phase → {self._phase.value}")

    def skip_to_close(self):
        """Jump to close phase (e.g., when parent wants to end early)."""
        if self._phase != ConversationPhase.ENDED:
            self._phase = ConversationPhase.CLOSE
            self._turns_in_phase = 0
            logger.info("Conversation phase → close (skipped)")

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, LLMContextFrame):
            # Inject phase guidance into context right before LLM inference
            guidance = self._guidance.get(self._phase.value)
            if guidance:
                frame.context.add_message({
                    "role": "user",
                    "content": guidance,
                })
                logger.debug(
                    f"Phase guidance: {self._phase.value} "
                    f"(turn {self._turns_in_phase + 1}/{_PHASE_MAX_TURNS.get(self._phase, '?')})"
                )

        await self.push_frame(frame, direction)
