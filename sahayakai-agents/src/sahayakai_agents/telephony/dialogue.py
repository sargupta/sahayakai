"""The call's state machine: the single authority over what happens next.

WHY THIS IS NOT LEFT TO THE MODEL

On the 2026-10-11 handset call (Vobiz 41534a41-...) the model:
- delivered the teacher's message to a caller who had only said "Hello" and
  "What" (identity was never confirmed);
- answered each "Wait" with a fresh reply ("Yes, please tell me." twice);
- refused "Repeat" ("I'm sorry, I cannot repeat the entire message");
- was ended by a 6-turn ceiling that counted "wait" and "what" as turns,
  with the goodbye glued onto an unanswered question.

Each of those is a decision a prompt can only suggest. Here they are code:
the bridge classifies every parent utterance (no model involved), and this
module decides the action. The model is used only to compose free answers
AFTER verification, inside the stage this machine allows.

STAGES (enforced transitions)

    GREETING -> IDENTITY_CHECK -> MESSAGE_DELIVERY -> PARENT_RESPONSE
             -> TOOL_LOOKUP (if asked) -> FOLLOW_UP -> GOODBYE -> ENDED

Any stage may go to GOODBYE. MESSAGE_DELIVERY and everything after it are
unreachable until the caller is VERIFIED.

FLOOR (who holds the conversation right now)

    VIDYA_SPEAKING, LISTENING, INTERRUPTED, WAITING_FOR_PARENT, REPEATING,
    TOOL_RUNNING, UNCLEAR, VERIFICATION_FAILED, HANGING_UP

IDENTITY (the privacy gate)

The identity question never names the child. The caller is VERIFIED only
when, after being asked, they say the child's name and it matches the
record (privacy.fuzzy_name_in). "Yes", "hello", "what", silence or a request
to repeat are not verification. A denial ("wrong number") fails closed.
After `max_identity_attempts` questions without a match the call ends
politely without sharing anything.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum

from .flow import indic_word, is_goodbye, is_optout
from .privacy import fuzzy_name_in

__all__ = [
    "Action",
    "Decision",
    "DialogueState",
    "Floor",
    "Identity",
    "Kind",
    "Stage",
    "classify",
    "looks_affirmative",
]


class Stage(Enum):
    GREETING = "greeting"
    IDENTITY_CHECK = "identity_check"
    MESSAGE_DELIVERY = "message_delivery"
    PARENT_RESPONSE = "parent_response"
    TOOL_LOOKUP = "tool_lookup"
    FOLLOW_UP = "follow_up"
    GOODBYE = "goodbye"
    ENDED = "ended"


class Floor(Enum):
    VIDYA_SPEAKING = "vidya_speaking"
    LISTENING = "listening"
    INTERRUPTED = "interrupted"
    WAITING_FOR_PARENT = "waiting_for_parent"
    REPEATING = "repeating"
    TOOL_RUNNING = "tool_running"
    UNCLEAR = "unclear"
    VERIFICATION_FAILED = "verification_failed"
    HANGING_UP = "hanging_up"


class Identity(Enum):
    UNKNOWN = "unknown"
    CONFIRMED = "confirmed"
    DENIED = "denied"
    FAILED = "failed"


_VERIFIED_STAGES = {
    Stage.MESSAGE_DELIVERY,
    Stage.PARENT_RESPONSE,
    Stage.TOOL_LOOKUP,
    Stage.FOLLOW_UP,
}

_TRANSITIONS: dict[Stage, set[Stage]] = {
    Stage.GREETING: {Stage.IDENTITY_CHECK, Stage.GOODBYE},
    Stage.IDENTITY_CHECK: {Stage.MESSAGE_DELIVERY, Stage.GOODBYE},
    Stage.MESSAGE_DELIVERY: {Stage.PARENT_RESPONSE, Stage.TOOL_LOOKUP, Stage.GOODBYE},
    Stage.PARENT_RESPONSE: {
        Stage.MESSAGE_DELIVERY,
        Stage.TOOL_LOOKUP,
        Stage.FOLLOW_UP,
        Stage.GOODBYE,
    },
    Stage.TOOL_LOOKUP: {Stage.PARENT_RESPONSE, Stage.FOLLOW_UP, Stage.GOODBYE},
    Stage.FOLLOW_UP: {
        Stage.MESSAGE_DELIVERY,
        Stage.PARENT_RESPONSE,
        Stage.TOOL_LOOKUP,
        Stage.GOODBYE,
    },
    Stage.GOODBYE: {Stage.ENDED},
    Stage.ENDED: set(),
}


# ---- utterance classification (no model involved) ----------------------------


class Kind(Enum):
    EMPTY = "empty"
    OPT_OUT = "opt_out"
    YIELD = "yield"  # wait / stop / hold on / let me speak
    REPEAT_MESSAGE = "repeat_message"
    REPEAT_LAST = "repeat_last"
    CLARIFY = "clarify"  # what? / sorry? / I didn't hear that
    ACK = "ack"  # yeah / okay / haan
    GOODBYE = "goodbye"
    BUSY = "busy"
    WHO = "who"  # who is this? what is this about?
    SUBSTANTIVE = "substantive"


_WORD = re.compile(r"\w+", re.UNICODE)


def _words(text: str) -> list[str]:
    return _WORD.findall((text or "").lower())


_YIELD = re.compile(
    r"\b(wait|hold on|hold up|one (minute|moment|second|sec)|just a (minute|moment|second|sec)"
    r"|stop|let me (speak|talk|finish)|ek (minute|minit|min|second)"
    r"|ruko|ruk jao|ruk ja|ruko zara)\b"
    r"|" + "|".join(indic_word(w) for w in ("रुको", "रुकिए", "रुकिये", "एक मिनट", "ज़रा रुको")),
    re.IGNORECASE,
)
_REPEAT = re.compile(
    r"\b(repeat|say (that|it) again|say again|once more|come again|phir se|dobara|fir se)\b"
    r"|" + "|".join(indic_word(w) for w in ("दोबारा", "फिर से", "फिरसे")),
    re.IGNORECASE,
)
_WHOLE_MESSAGE = re.compile(
    r"\b(message|whole|everything|all of it|full|poora|pura)\b|संदेश|मैसेज|पूरा", re.IGNORECASE
)
_CLARIFY_PHRASE = re.compile(
    r"\b(didn'?t (hear|catch|get|understand)|did not (hear|catch|get|understand)|can'?t hear"
    r"|cannot hear|not clear|what did you say|samajh nahi|sunai nahi)\b"
    r"|" + "|".join(indic_word(w) for w in ("समझ नहीं", "सुनाई नहीं", "क्या कहा")),
    re.IGNORECASE,
)
_CLARIFY_SHORT = {"what", "sorry", "pardon", "huh", "eh", "kya", "hello", "क्या", "हैलो", "हेलो"}
_ACK_WORDS = {
    "yeah",
    "yes",
    "yep",
    "ok",
    "okay",
    "right",
    "sure",
    "alright",
    "fine",
    "haan",
    "han",
    "haa",
    "hmm",
    "hm",
    "mm",
    "achha",
    "acha",
    "accha",
    "ji",
    "theek",
    "thik",
    "hai",
    "got",
    "it",
    "हाँ",
    "हां",
    "जी",
    "अच्छा",
    "ठीक",
    "है",
}
_BUSY = re.compile(
    r"\b(driving|busy|in a meeting|at work|call (me )?(back )?later|call back|not now|"
    r"baad mein|baad me|abhi nahi)\b|" + "|".join(indic_word(w) for w in ("बाद में", "अभी नहीं")),
    re.IGNORECASE,
)
_WHO = re.compile(
    r"\b(who is (this|it|calling|speaking)|who's (this|calling)|who are you|what is this about|"
    r"why are you calling|kaun|kon)\b|" + indic_word("कौन"),
    re.IGNORECASE,
)


def classify(text: str) -> Kind:  # noqa: PLR0911 — one return per kind
    """What kind of thing the parent just said. Order matters: opt-out first."""
    words = _words(text)
    if not words:
        return Kind.EMPTY
    if is_optout(text):
        return Kind.OPT_OUT
    n = len(words)
    if _REPEAT.search(text) and n <= 9:
        return Kind.REPEAT_MESSAGE if _WHOLE_MESSAGE.search(text) else Kind.REPEAT_LAST
    if _YIELD.search(text) and n <= 6:
        return Kind.YIELD
    if _CLARIFY_PHRASE.search(text) or (n <= 2 and words[0] in _CLARIFY_SHORT):
        return Kind.CLARIFY
    if _BUSY.search(text):
        return Kind.BUSY
    if is_goodbye(text):
        return Kind.GOODBYE
    if _WHO.search(text):
        return Kind.WHO
    if n <= 3 and all(w in _ACK_WORDS for w in words):
        return Kind.ACK
    return Kind.SUBSTANTIVE


_AFFIRM = re.compile(
    r"\b(yes|yeah|yep|speaking|haan|haa|han|hanji|haanji|ji|mother|father|mom|mum|mummy|"
    r"dad|papa|guardian|parent)\b|"
    + "|".join(indic_word(w) for w in ("हाँ", "हां", "जी", "मम्मी", "पापा")),
    re.IGNORECASE,
)
_DENIAL = re.compile(
    r"\b(wrong number|no one|nobody|there is no|there's no|not (his|her|the|a) "
    r"(parent|father|mother|guardian)|don'?t know (any|anyone|him|her)|galat number|"
    r"no such)\b|" + "|".join(indic_word(w) for w in ("गलत नंबर", "कोई नहीं", "ऐसा कोई नहीं")),
    re.IGNORECASE,
)


def looks_affirmative(text: str | None) -> bool:
    """A yes-like reply. NOT verification on its own; used to choose the re-ask."""
    return bool(text and _AFFIRM.search(text))


# ---- decisions --------------------------------------------------------------


class Action(Enum):
    IGNORE = "ignore"  # nothing to do (empty, or an acknowledgement while listening)
    RESUME = "resume"  # a backchannel while VIDYA talks: carry on
    YIELD_FLOOR = "yield_floor"  # stop talking, give the parent the floor, wait
    ASK_IDENTITY = "ask_identity"  # neutral identity question, again
    DELIVER_MESSAGE = "deliver_message"  # verified: the teacher's message, verbatim
    REPEAT_MESSAGE = "repeat_message"
    REPEAT_LAST = "repeat_last"
    RESPOND = "respond"  # a free answer from the model, inside the allowed stage
    CLOSE = "close"


@dataclass(frozen=True)
class Decision:
    action: Action
    kind: Kind
    #: For CLOSE: goodbye | busy | opt_out | wrong_person | unverified.
    #: For ASK_IDENTITY: retry | name_please | who.
    detail: str = ""


@dataclass
class DialogueState:
    #: Who the call is about: used ONLY for verification, never spoken pre-verification.
    student_name: str | None = None
    school_name: str | None = None
    message: str | None = None
    max_identity_attempts: int = 3
    stage: Stage = Stage.GREETING
    floor: Floor = Floor.LISTENING
    identity: Identity = Identity.UNKNOWN
    identity_questions: int = 0
    introduced: bool = False
    message_delivered: bool = False
    #: Parent utterances that carried content (not wait/what/repeat/ack/silence).
    meaningful_exchanges: int = 0
    agent_turns: int = 0
    repeat_intros: int = 0
    interruptions: int = 0
    refused_transitions: int = 0
    #: The last complete thing VIDYA said, for "what?" / "repeat that".
    last_agent_text: str = ""
    #: The last agent turn was itself a reply to an acknowledgement: another
    #: "yeah" now must not start a "yes, please tell me" loop.
    last_reply_was_to_ack: bool = False
    _history: list[str] = field(default_factory=list)
    _intro_spoken: bool = False

    # ---- transitions -------------------------------------------------------

    def goto(self, stage: Stage) -> bool:
        """Move to `stage` if the table and the identity gate allow it."""
        if stage is self.stage:
            return True
        allowed = stage in _TRANSITIONS[self.stage]
        if stage in _VERIFIED_STAGES and self.identity is not Identity.CONFIRMED:
            allowed = False
        if not allowed:
            self.refused_transitions += 1
            return False
        self.stage = stage
        return True

    # ---- events --------------------------------------------------------------

    def on_identity_question_asked(self) -> None:
        self.introduced = True
        self.identity_questions += 1
        self.goto(Stage.IDENTITY_CHECK)

    def on_agent_turn(self, text: str, *, scripted: bool = False) -> None:
        """A complete agent turn (what was actually played).

        `scripted` turns are the bridge's own fixed lines (identity questions,
        the verbatim message, closings); only a model turn that introduces
        VIDYA again counts as a repeated introduction.
        """
        text = (text or "").strip()
        if not text:
            return
        self.agent_turns += 1
        intro = self._looks_like_intro(text)
        # A repeat needs an earlier SPOKEN introduction. (Asking the identity
        # question marks the call introduced before Gemini Live has spoken its
        # first, only, introduction; that one must not count as a repeat.)
        if not scripted and intro and self._intro_spoken:
            self.repeat_intros += 1
        if intro:
            self._intro_spoken = True
            self.introduced = True
        self.last_agent_text = text
        self._history.append(text)

    def on_message_delivered(self) -> None:
        self.message_delivered = True
        self.goto(Stage.PARENT_RESPONSE)

    def on_interrupted(self) -> None:
        self.interruptions += 1
        self.floor = Floor.INTERRUPTED

    def begin_closing(self) -> None:
        self.goto(Stage.GOODBYE)
        self.floor = Floor.HANGING_UP

    def on_parent(self, text: str, *, vidya_speaking: bool = False) -> Decision:  # noqa: PLR0911, PLR0912 — the policy, one branch per case
        """Decide what the bridge does with what the parent just said."""
        kind = classify(text)
        if kind is Kind.EMPTY:
            return Decision(Action.IGNORE, kind)
        if kind is Kind.OPT_OUT:
            return self._close(kind, "opt_out")

        if self.identity is not Identity.CONFIRMED:
            return self._before_verification(text, kind)

        if kind is Kind.ACK and vidya_speaking:
            return Decision(Action.RESUME, kind)
        if kind is Kind.YIELD:
            self.floor = Floor.WAITING_FOR_PARENT
            return Decision(Action.YIELD_FLOOR, kind)
        if kind is Kind.GOODBYE:
            return self._close(kind, "goodbye")
        if kind is Kind.BUSY:
            return self._close(kind, "busy")
        if kind is Kind.REPEAT_MESSAGE or (kind is Kind.REPEAT_LAST and self._last_was_message()):
            self.floor = Floor.REPEATING
            self.goto(Stage.MESSAGE_DELIVERY)
            return Decision(Action.REPEAT_MESSAGE, kind)
        if kind in (Kind.REPEAT_LAST, Kind.CLARIFY):
            self.floor = Floor.REPEATING
            return Decision(Action.REPEAT_LAST if self.last_agent_text else Action.RESPOND, kind)
        if kind is Kind.ACK:
            if self.last_reply_was_to_ack or not self.last_agent_text.rstrip().endswith("?"):
                # Listening: an "okay" after a statement needs no reply, and a
                # second "yeah" must not start a confirmation loop.
                self.floor = Floor.LISTENING
                return Decision(Action.IGNORE, kind)
            return Decision(Action.RESPOND, kind)
        self.meaningful_exchanges += 1
        self.floor = Floor.LISTENING
        self.goto(Stage.FOLLOW_UP if self.stage is Stage.PARENT_RESPONSE else Stage.PARENT_RESPONSE)
        return Decision(Action.RESPOND, kind)

    def _before_verification(self, text: str, kind: Kind) -> Decision:  # noqa: PLR0911
        if kind is Kind.YIELD:
            self.floor = Floor.WAITING_FOR_PARENT
            return Decision(Action.YIELD_FLOOR, kind)
        if kind is Kind.BUSY:
            return self._close(kind, "busy")
        if kind is Kind.GOODBYE:
            return self._close(kind, "goodbye")
        verdict = self.check_identity(text)
        if verdict is Identity.DENIED:
            return self._close(kind, "wrong_person")
        if verdict is Identity.CONFIRMED:
            return Decision(Action.DELIVER_MESSAGE, kind)
        if self.identity_questions >= self.max_identity_attempts:
            self.identity = Identity.FAILED
            self.floor = Floor.VERIFICATION_FAILED
            return self._close(kind, "unverified")
        self.floor = Floor.UNCLEAR
        detail = (
            "who" if kind is Kind.WHO else ("name_please" if looks_affirmative(text) else "retry")
        )
        return Decision(Action.ASK_IDENTITY, kind, detail)

    def check_identity(self, text: str) -> Identity | None:
        """The ONE verification rule (both engines): after the neutral question,
        the caller names the child and it matches the record; a denial fails
        closed. Returns the new identity if this utterance decided it."""
        if self.identity is not Identity.UNKNOWN:
            return None
        if _DENIAL.search(text or ""):
            self.identity = Identity.DENIED
            return self.identity
        if self.student_name and self.identity_questions > 0:
            first = self.student_name.split()[0]
            if fuzzy_name_in(first, text or ""):
                self.identity = Identity.CONFIRMED
                self.goto(Stage.MESSAGE_DELIVERY)
                return self.identity
        return None

    def _close(self, kind: Kind, why: str) -> Decision:
        self.begin_closing()
        return Decision(Action.CLOSE, kind, why)

    # ---- queries -------------------------------------------------------------

    @property
    def may_share_student_data(self) -> bool:
        return self.identity is Identity.CONFIRMED

    @property
    def open_question(self) -> bool:
        """VIDYA's last turn asked something the parent has not answered."""
        return self.last_agent_text.rstrip(" .…").endswith("?")

    def cue_context(self) -> str:
        """A one-line state reminder for the model (never contains child data)."""
        parts: list[str] = []
        if self.introduced:
            parts.append("You have ALREADY introduced yourself; never do it again.")
        if self.identity is Identity.CONFIRMED:
            parts.append(
                "The parent's identity is verified. If they mention attendance, marks or "
                "homework, look it up now; do not ask which subject or whether to check."
            )
            if self.message_delivered:
                parts.append(
                    "The teacher's message has been delivered; do not repeat it unless asked."
                )
        else:
            parts.append(
                "The caller is NOT verified. Share nothing about any child; the system "
                "handles verification."
            )
        return f" [Call state: {' '.join(parts)}]"

    # ---- internals -----------------------------------------------------------

    def _looks_like_intro(self, text: str) -> bool:
        if re.search(r"\b(calling from|on behalf of|calling for)\b", text, re.IGNORECASE):
            return True
        school = (self.school_name or "").strip().lower()
        return bool(school) and school in text.lower()

    def _last_was_message(self) -> bool:
        if not self.message or not self.last_agent_text:
            return False
        want = {w for w in _words(self.message) if len(w) > 3}
        got = {w for w in _words(self.last_agent_text) if len(w) > 3}
        return bool(want) and len(want & got) / len(want) >= 0.5
