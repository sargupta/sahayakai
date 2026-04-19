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


# Prefix for phase instructions — used to filter from transcripts
PHASE_INSTRUCTION_PREFIX = "[Guide"


class ConversationPhase(Enum):
    """Soft phases of a parent call. Fewer phases = more flexibility."""
    OPENING = "opening"        # Greeting played, waiting for parent's first response
    EXPLORE = "explore"        # Understanding parent's situation (1-2 turns)
    ADVISE = "advise"          # Give suggestion, check if anything else
    CLOSE = "close"            # Wrap up warmly
    ENDED = "ended"            # Call done


# Soft guidance per phase. These are hints, not scripts.
# The LLM's system prompt already has the persona and rules —
# these just nudge "what to focus on THIS turn."
#
# Key design: every instruction includes "If parent brings up something
# else, address THAT instead" — so the LLM never ignores real concerns
# to follow a script.
PHASE_GUIDANCE: dict[ConversationPhase, str] = {
    ConversationPhase.OPENING: (
        "{prefix}: Parent just responded to your greeting. "
        "Your greeting ALREADY mentioned {student_name} and the reason ({reason}). "
        "STAY ON TOPIC — do NOT change subject or ask unrelated questions like "
        "'ghar pe sab theek hai'. Follow up DIRECTLY on the topic you introduced. "
        "For attendance: ask if the child was ill or when they'll return. "
        "For exam/studies: ask whether studying happens at home, frame as 'difficulty', never state the exact score. "
        "For behavior: ask how the child is at home, frame as 'I wanted to discuss', never say 'complaint'. "
        "For homework/fees: address homework first; fees as a separate, gentle mention. "
        "Speak in the parent's language. If parent already started sharing something, respond to THAT. "
        "NEVER ask 'how can I help' — you called them.]"
    ),
    ConversationPhase.EXPLORE: (
        "{prefix}: You're understanding the situation. "
        "STAY ON TOPIC — keep discussing {reason}. "
        "Listen and acknowledge warmly in the parent's language. "
        "If they shared a real problem (health, money, family), show empathy first. "
        "If defensive, don't argue — say you want to work together. "
        "If embarrassed, reassure gently. "
        "Ask ONE follow-up about {student_name} if needed, or move to suggestion. "
        "If parent brings up something unrelated, briefly acknowledge, then return to {reason}.]"
    ),
    ConversationPhase.ADVISE: (
        "{prefix}: You understand the situation now. "
        "Give ONE practical suggestion connected to {reason}. "
        "Academic: offer extra class or a home routine. "
        "Behavior: suggest a short meeting at school to work together. "
        "Fees: offer to speak with the principal, reassure. "
        "Homework: suggest a daily routine or offer to check in. "
        "If parent raised a concern, address it. Then ask if there's anything else. "
        "If parent says no or sounds ready to end, wrap up next turn.]"
    ),
    ConversationPhase.CLOSE: (
        "{prefix}: Wrap up the call NOW in ONE short sentence in parent's language. "
        "Thank them warmly, mention {student_name} positively, say goodbye naturally. "
        "Do NOT ask any more questions. Do NOT start a new topic. "
        "If parent raises a NEW concern, briefly acknowledge, then STILL close.]"
    ),
}

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

    def __init__(self, *, call_context: dict, **kwargs):
        super().__init__(**kwargs)
        self._phase = ConversationPhase.OPENING
        self._student_name = call_context.get("studentName", "student")
        self._reason = call_context.get("reason", "school matters")
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
            template = PHASE_GUIDANCE.get(self._phase)
            if template:
                guidance = template.format(
                    prefix=PHASE_INSTRUCTION_PREFIX,
                    student_name=self._student_name,
                    reason=self._reason,
                )
                frame.context.add_message({
                    "role": "user",
                    "content": guidance,
                })
                logger.debug(
                    f"Phase guidance: {self._phase.value} "
                    f"(turn {self._turns_in_phase + 1}/{_PHASE_MAX_TURNS.get(self._phase, '?')})"
                )

        await self.push_frame(frame, direction)
