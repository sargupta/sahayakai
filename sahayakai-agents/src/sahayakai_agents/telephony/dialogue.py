"""Where the call is: an explicit dialogue state the bridge can act on.

The prompt describes the shape of a good call, but a prompt cannot remember
what has already happened — the model can, imperfectly. On the 2026-10-10 live
test it did fine; on earlier calls it introduced itself twice and re-delivered
the message after a "haan ji, boliye". So the bridge keeps its own record:

    OPENING -> IDENTITY -> MESSAGE -> CONVERSATION -> CLOSING

and uses it for three things:

1. Gating. Student data is only looked up after the parent has confirmed who
   they are (`confirm_identity`), and never after they say it is the wrong person.
2. Steering. Every director cue carries a one-line state reminder ("you have
   already introduced yourself; the message has been delivered"), so a nudge
   cannot provoke a second introduction or a second delivery.
3. Measuring. A repeated introduction is counted, so it shows up in the call
   log instead of only in a parent's complaint.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum

__all__ = ["Identity", "Phase", "DialogueState"]


class Phase(Enum):
    OPENING = "opening"
    IDENTITY = "identity"
    MESSAGE = "message"
    CONVERSATION = "conversation"
    CLOSING = "closing"


class Identity(Enum):
    UNKNOWN = "unknown"
    CONFIRMED = "confirmed"
    DENIED = "denied"


_WORD = re.compile(r"\w+", re.UNICODE)

#: Fraction of the teacher message's content words that must have been spoken
#: for it to count as delivered. Deliberately loose: the model may rephrase.
_DELIVERED_OVERLAP = 0.5

#: Phrases that mark the agent introducing itself, beyond the school's name.
_INTRO_MARKERS = re.compile(r"\b(calling from|on behalf of|calling for)\b", re.IGNORECASE)


def _content_words(text: str) -> set[str]:
    return {w.lower() for w in _WORD.findall(text or "") if len(w) > 3}


@dataclass
class DialogueState:
    school_name: str | None = None
    message: str | None = None
    phase: Phase = Phase.OPENING
    identity: Identity = Identity.UNKNOWN
    introduced: bool = False
    message_delivered: bool = False
    agent_turns: int = 0
    repeat_intros: int = 0
    interruptions: int = 0
    _spoken: set[str] = field(default_factory=set)

    # ---- events -----------------------------------------------------------

    def on_agent_turn(self, text: str) -> None:
        """A complete agent turn (what was actually played)."""
        text = (text or "").strip()
        if not text:
            return
        self.agent_turns += 1
        if self._looks_like_intro(text):
            if self.introduced:
                self.repeat_intros += 1
            self.introduced = True
        # The kickoff tells the first turn to introduce; a first turn that did
        # not match the markers (another language, say) is still the intro.
        self.introduced = True
        self._spoken |= _content_words(text)
        if not self.message_delivered and self._covers_message():
            self.message_delivered = True
        self._advance()

    def on_interrupted(self) -> None:
        self.interruptions += 1

    def confirm_identity(self, status: str, *, parent_turns: int) -> tuple[bool, str]:
        """The model reports what the parent said about who they are.

        The model proposes; the bridge checks it is even possible: the agent
        must have asked (introduced) and the parent must have spoken. A
        "confirmed" with no parent speech is refused.
        """
        if status == "wrong_person":
            self.identity = Identity.DENIED
            self._advance()
            return True, "denied"
        if status != "confirmed":
            return False, "unsure"
        if not self.introduced or parent_turns < 1:
            return False, "parent_has_not_answered"
        if self.identity is Identity.DENIED:
            return False, "already_denied"
        self.identity = Identity.CONFIRMED
        self._advance()
        return True, "confirmed"

    def begin_closing(self) -> None:
        self.phase = Phase.CLOSING

    # ---- queries ----------------------------------------------------------

    @property
    def may_share_student_data(self) -> bool:
        return self.identity is Identity.CONFIRMED

    def cue_context(self) -> str:
        """A one-line reminder appended to every director cue."""
        parts: list[str] = []
        if self.introduced:
            parts.append("You have ALREADY introduced yourself; never do it again.")
        if self.identity is Identity.CONFIRMED:
            parts.append("The parent's identity is confirmed.")
        elif self.identity is Identity.DENIED:
            parts.append("This is NOT the child's parent; share nothing about the child.")
        if self.message_delivered:
            parts.append("The teacher's message has been delivered; do not repeat it.")
        return f" [Call state: {' '.join(parts)}]" if parts else ""

    # ---- internals --------------------------------------------------------

    def _looks_like_intro(self, text: str) -> bool:
        if _INTRO_MARKERS.search(text):
            return True
        school = (self.school_name or "").strip().lower()
        return bool(school) and school in text.lower()

    def _covers_message(self) -> bool:
        wanted = _content_words(self.message or "")
        if not wanted:
            return False
        return len(wanted & self._spoken) / len(wanted) >= _DELIVERED_OVERLAP

    def _advance(self) -> None:
        if self.phase is Phase.CLOSING:
            return
        if not self.introduced:
            self.phase = Phase.OPENING
        elif self.identity is Identity.UNKNOWN and not self.message_delivered:
            self.phase = Phase.IDENTITY
        elif not self.message_delivered and self.identity is not Identity.DENIED:
            self.phase = Phase.MESSAGE
        else:
            self.phase = Phase.CONVERSATION
