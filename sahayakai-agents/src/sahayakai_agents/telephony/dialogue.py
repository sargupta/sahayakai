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

from .flow import indic_word

__all__ = ["Identity", "Phase", "DialogueState", "identity_answer", "looks_affirmative"]


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


#: Words a parent uses to say "yes, that's me" — romanised English/Hindi plus
#: each supported script. Deliberately narrow: a miss only means VIDYA asks
#: once more, a false hit reads a child's record to a stranger.
#: Script words are whole-word matched with `indic_word` — `\b` is unreliable
#: in Indic scripts, and as a bare substring Marathi "हो" (yes) would match
#: inside Hindi "होमवर्क" (homework).
_AFFIRM_SCRIPT = (
    "हाँ", "हां", "जी", "बोल रहा", "बोल रही", "मम्मी", "पापा", "माँ", "पिता", "अभिभावक",
    "হ্যাঁ", "হাঁ", "বলছি", "মা", "বাবা", "हो", "होय", "बोलतोय", "बोलतेय", "आई", "बाबा",
    "હા", "બોલું", "ਹਾਂ", "ਜੀ", "ಹೌದು", "ಹೂಂ", "ಅಮ್ಮ", "ಅಪ್ಪ", "ஆமா", "ஆமாம்", "ஆம்",
    "அம்மா", "அப்பா", "అవును", "అమ్మ", "నాన్న", "അതെ", "ഉവ്വ്", "അമ്മ", "അച്ഛൻ", "ହଁ",
)
_DENY_SCRIPT = (
    "नहीं", "नही", "गलत", "না", "ভুল", "नाही", "ના", "ਨਹੀਂ", "ಇಲ್ಲ", "இல்லை", "కాదు",
    "లేదు", "അല്ല", "ഇല്ല", "ନା",
)
_AFFIRM = re.compile(
    r"\b(yes|yeah|yep|yup|speaking|haan|haa|han|hanji|haanji|ji|mother|father|"
    r"mom|mum|mummy|mama|dad|papa|guardian|parent|i am his|i am her|i'm his|i'm her|"
    r"bol raha|bol rahi|bol rha|bol rhi)\b|"
    + "|".join(indic_word(w) for w in _AFFIRM_SCRIPT),
    re.IGNORECASE,
)
_DENY = re.compile(
    r"\b(no|nope|not|nahi|nahin|wrong|galat)\b|"
    + "|".join(indic_word(w) for w in _DENY_SCRIPT),
    re.IGNORECASE,
)


def identity_answer(utterances: list[str]) -> str | None:
    """The parent's answer to "am I speaking with ...'s parent?", from all they said.

    The model calls confirm_parent_identity when it chooses, which is not always
    straight after the answer: on staging it called it after the parent had
    already moved on ("Wait, wait, one minute..."), and reading only the latest
    utterance refused a parent who had clearly said "Yes, I am Ravi's mother".
    A denial anywhere wins; otherwise the first clear yes; otherwise the latest.
    """
    for u in utterances:
        if _DENY.search(u):
            return u
    for u in utterances:
        if looks_affirmative(u):
            return u
    return utterances[-1] if utterances else None


def looks_affirmative(text: str | None) -> bool:
    """Did the parent's reply actually say "yes, I'm the parent"?"""
    if not text:
        return False
    return bool(_AFFIRM.search(text)) and not _DENY.search(text)


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

    def confirm_identity(
        self, status: str, *, parent_turns: int, parent_reply: str | None = None
    ) -> tuple[bool, str]:
        """The model reports what the parent said about who they are.

        The model proposes; the bridge checks. The agent must have asked
        (introduced), the parent must have spoken, and what they said must
        actually be a yes. Against the real model, a parent who answered "am I
        speaking with Ravi's parent?" with "what is his attendance?" was
        reported as confirmed — so the model's word alone is not enough.
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
        if not looks_affirmative(parent_reply):
            return False, "not_confirmed_ask_directly"
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
            parts.append(
                "The parent's identity is confirmed. If they mention attendance, marks or "
                "homework, look it up now; do not ask which subject or whether to check."
            )
        elif self.identity is Identity.DENIED:
            parts.append("This is NOT the child's parent; share nothing about the child.")
        if self.message_delivered:
            parts.append("The teacher's message has been delivered; do not repeat it.")
        elif self.introduced and self.identity is not Identity.DENIED:
            parts.append(
                "The teacher's message has NOT been delivered yet: after answering what "
                "the parent just said, deliver it (or the part they have not heard)."
            )
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
