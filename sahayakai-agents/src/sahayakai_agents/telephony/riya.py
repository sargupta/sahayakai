"""Riya: the school-calling workflow from the ElevenLabs agent, run on the Vobiz bridge.

WHAT IS MIGRATED, AND FROM WHERE

`riya_workflow.json` is generated from the ElevenLabs agent export by
`scripts/extract_riya_workflow.py`. It carries Riya's own words: the base
prompt, the opening line, one prompt per call purpose, the routing edges, the
turn timings, the end_call rules and the post-call data-collection fields.
Nothing in this module calls ElevenLabs; speech in and out is the bridge's
engine (Gemini Live on Vertex).

HOW THE ELEVENLABS WORKFLOW MAPS ONTO THIS MODULE

  start_node edges (product_context + call_purpose)  -> `route()`
  override_agent node = base prompt + additional_prompt -> `RiyaCall.instruction()`
  first_message (non-interruptible)                   -> `RiyaCall.first_message()`
  system tool end_call (+ its rules)                  -> `RiyaCall.may_end()`
  system tool skip_turn                               -> answered silently by the bridge
  turn_timeout 7 s / silence_end_call_timeout 15 s    -> `RiyaCall.on_silence()`
  max_duration_seconds + its message                  -> `RiyaCall.max_seconds` / `max_duration_message`
  data_collection (9 fields)                          -> `RiyaCall.data_collection_fields()`

WHAT THE BRIDGE ENFORCES THAT THE PROMPT ONLY ASKED FOR

In ElevenLabs every stage inside a node is prompt-driven. Here the stages are
also tracked in code, from what was actually said, so the parts that protect
a family are not left to the model:

  OPENING -> AVAILABILITY_OK -> IDENTITY_ASKED -> VERIFIED -> DELIVERED -> CLOSING
                 |-> busy close       |-> wrong person / unverified close

- Purpose details (dates, summaries, class, ...) are NOT in the model's context
  until the bridge has heard the parent or guardian confirm. They arrive as
  `unlock_cue()`; before that the prompt carries a marker instead of the value.
- end_call is validated against Riya's own CALL / NEVER CALL rules.
- Silence and the maximum duration are timers here, not model guesses.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from enum import Enum
from functools import lru_cache
from pathlib import Path
from typing import Any

from .flow import is_optout

__all__ = [
    "BUSY_LINES",
    "LOCKED_MARKER",
    "PURPOSE_FIELDS",
    "RiyaCall",
    "RiyaDecision",
    "RiyaStage",
    "Route",
    "load_workflow",
    "render",
    "route",
]

_WORKFLOW_PATH = Path(__file__).with_name("riya_workflow.json")

#: Replaces a purpose detail in the model's instructions until verification.
LOCKED_MARKER = "[shared with you by the system after the parent or guardian confirms]"

#: Variables the model may hold BEFORE verification: who is calling, who the
#: call is about (Riya's verification question names the child), and the topic.
_ALWAYS_VISIBLE = {"school_name", "student_name", "call_purpose"}
#: Emergency closure is the one node whose busy branch states the closure date
#: before verification ("I'll be quick: the school will be closed on ..."):
#: school-wide and urgent, so Riya's design allows it.
_VISIBLE_BEFORE_VERIFICATION = {"node_01m4wj0rvvenss5tsq096wy0t2": {"closure_date"}}

#: The line each node prescribes when the parent says it is not a good time.
#: Copied from the node prompts; tests assert each one is still in its prompt.
BUSY_LINES: dict[str, str] = {
    "node_01m4whyaryewf8591rtwhb5tmj": (
        "I understand. Please contact the school as soon as you can about your "
        "child's attendance. Thank you."
    ),
}
_DEFAULT_BUSY_LINE = "No problem. Thank you for your time. Have a good day."
WRONG_PERSON_LINE = "I'm sorry for the trouble. Have a good day."
CLOSING_LINE = "Thank you for your time. Have a good day."
#: Callback flow (Sampark parity: data-collection `callback_requested_time`).
#: Riya collects WHEN, repeats it back, gets a yes, then closes. She never says
#: the call is booked: Sampark turns it into a proposed callback a person confirms.
CALLBACK_ASK_LINE = "No problem. When would be a good time to call you back?"
#: The availability answer was not understood (19:22 real call: "No, you're not
#: allowed 10 to 12"). Ask again instead of guessing.
AVAILABILITY_REASK_LINE = "Sorry, I didn't catch that. Is this a good time to talk for a minute?"
CALLBACK_TIME_LINE = "Sure. What time would be convenient for you?"
CALLBACK_DONE_LINE = (
    "Thank you. I've noted your request for a call back, and the school will "
    "follow up. Have a good day."
)
#: Said by the bridge when the model stopped speaking but the call may not end on its own
#: (real call 2026-11-09: 44 s of silence after a muted goodbye).
STALLED_CLOSE_LINE = (
    "Sorry about that. Thank you for your time. The school will share any other details "
    "with you. Have a good day."
)
_RIYA_FAREWELL_TAIL = re.compile(r"(thank you for your time|have a (good|nice|great) day|good ?bye|\bbye\b)", re.I)

#: Played from the cache when the conversation engine fails mid-call (Vertex "Resource exhausted"
#: 2026-11-10): the parent hears why the call ends instead of dead air and a hang-up.
LINE_TROUBLE_LINE = (
    "Sorry, the line is having some trouble. The school will call you back. Goodbye."
)

#: Played while the conversation engine reconnects mid-call (session resumption, ~2-4 s).
RESUME_LINE = "Sorry, just one moment."

SAFE_EXIT_LINE = (
    "I'm sorry, I don't have the details for this call right now. Someone will get "
    "back to you. Have a good day."
)

#: Sampark's recommended additions (types.ts RIYA_DATA_COLLECTION_KEYS): asked
#: of every call, so the Vobiz path reports what the ElevenLabs agent reports.
SAMPARK_FIELDS: dict[str, dict[str, Any]] = {
    "callback_requested_time": {
        "description": (
            "Only if the person asked to be called back at another time: the day and time they "
            "asked for, in their own words as finally confirmed (for example \"tomorrow at 6 PM\", "
            "\"in 20 minutes\", \"Saturday morning\"). Empty if no callback was requested."
        ),
    },
    "stop_requested": {
        "description": "yes if the person asked not to be called again or to stop calls; otherwise no.",
        "enum": ["yes", "no"],
    },
    "recipient_confirmed": {
        "description": "yes if the person confirmed they are the parent or guardian; no if they said they are not; empty if never answered.",
        "enum": ["yes", "no"],
    },
}

#: Data-collection fields per call purpose, from each field's own description
#: ("Only for parent-teacher meeting (PTM) invitation calls ...").
#: `good_time_to_talk` applies to every call.
PURPOSE_FIELDS: dict[str, tuple[str, ...]] = {
    "ptm_invitation": ("ptm_attendance", "ptm_preferred_time", "ptm_meeting_mode"),
    "event_invitation": ("event_attendance",),
    "holiday_notice": ("late_return_date",),
    "exam_schedule_notice": ("exam_absence_date",),
    "absence_notice": ("expected_return_date",),
    "emergency_closure": ("child_at_school_during_closure",),
}

SAFE_EXIT_NODE = "node_context_missing_safe_exit"


@lru_cache(maxsize=1)
def load_workflow() -> dict[str, Any]:
    return json.loads(_WORKFLOW_PATH.read_text(encoding="utf-8"))


# ---- routing (the start node's edges, in their configured order) ------------


@dataclass(frozen=True)
class Route:
    node_id: str
    label: str
    edge: str
    #: Set when the matching edge leads to a node that is not Riya (excluded):
    #: the call is sent to the safe exit instead.
    excluded: str | None = None


def route(product_context: str | None, call_purpose: str | None) -> Route:
    """First edge (in `edge_order`) whose every condition holds; else the fallback."""
    values = {"product_context": product_context or "", "call_purpose": call_purpose or ""}
    for r in load_workflow()["routes"]:
        if all(values.get(k) == v for k, v in r["when"].items()):
            if r.get("excluded"):
                return Route(SAFE_EXIT_NODE, r["label"], r["edge"], excluded=r["excluded"])
            return Route(r["node"], r["label"], r["edge"])
    raise LookupError("riya_workflow.json has no unconditional fallback route")


# ---- variables ----------------------------------------------------------------

_VAR = re.compile(r"\{\{\s*(\w+)\s*\}\}")


def render(template: str, values: dict[str, str]) -> str:
    """Resolve {{name}}. A missing value renders empty: Riya's prompts say what
    to do when a detail is empty, and an unresolved placeholder must never be
    spoken."""
    return _VAR.sub(lambda m: str(values.get(m.group(1)) or "").strip(), template)


def _node_vars(text: str) -> set[str]:
    return set(_VAR.findall(text))


# ---- utterance classification (no model involved) -----------------------------


def _norm(text: str | None) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def _first_words(text: str, n: int = 1) -> list[str]:
    return re.findall(r"[a-zऀ-ॿ']+", text)[:n]


_NOT_NOW = re.compile(
    r"\b(busy|not (a )?good time|not now|can'?t talk|cannot talk|can'?t speak|no time|"
    r"call (me )?(back )?later|call back|driving|in a meeting|at work right now|"
    r"some other time|later please|abhi nahi|baad (mein|me))\b|अभी नहीं|बाद में"
)
_YES = re.compile(
    r"\b(yes|yeah|yep|yup|sure|okay|ok|go ahead|tell me|go on|please|speaking|alright|"
    r"of course|haan|han|ha|haa|haanji|hanji|ji|boliye|bolo|bataiye|batao|correct|right|fine|"
    r"houdu|haudu|heli)\b"
    r"|हाँ|हां|हा(?![ऀ-ॿ])|जी|बताइए|बोलिए|ಹೌದು|ಹೇಳಿ|ಸರಿ"
)
_NO_FIRST = {"no", "nope", "nah", "nahi", "nahin", "नहीं", "ना"}
_DENY = re.compile(
    r"\b(wrong number|not (the|his|her|a|their) (parent|father|mother|guardian|mom|dad)|"
    r"i'?m not (the|his|her|a) |i am not (the|his|her|a) |don'?t know (any|anyone|him|her|who)|"
    r"no such|nobody|no one by that name|you have the wrong|galat number)\b|गलत नंबर"
)
_GUARDIAN_WORDS = re.compile(
    r"\b(i am|i'?m|this is) (his|her|the|their) (mother|father|mom|mum|dad|parent|guardian)\b|"
    r"\b(mother|father|guardian|parent) (here|speaking)\b|\bspeaking\b|"
    r"\b(main|mai|mein|me|mai) (uski|uska|iski|iska|unki|unka) (maa|ma|mummy|mother|papa|pita|father)\b|"
    r"\b(naanu|nanu) (avana|avala) (taayi|tayi|tande)\b|"
    r"(मैं|में) (उसकी|उसका|इसकी|इसका) (माँ|मां|मम्मी|पिता|पापा)|ನಾನು (ಅವನ|ಅವಳ) (ತಾಯಿ|ತಂದೆ)"
)
_ASKS_GUARDIAN = re.compile(
    r"(parent or guardian|am i speaking (with|to)|are you (the|his|her) (parent|mother|father|guardian))"
)
_WAIT = re.compile(
    r"\b(wait|hold on|one (minute|moment|second|sec)|just a (minute|moment|second|sec)|"
    r"ek (minute|minit|min|second)|ruko|ruk jao)\b|रुको|रुकिए|एक मिनट"
)
_STOP = re.compile(
    r"\b(stop (it|this|calling|talking)?|end (the|this) call|hang up|don'?t (want to|wanna) talk|"
    r"leave me alone|stop it|"
    # ASR benchmark 2026-11-09: "Remove my number from your list" was not treated as a stop request.
    r"(remove|delete|take) (my|this) number|take (me|my number) off|do not contact|don'?t contact|"
    r"unsubscribe|no more calls)\b"
)
_PARENT_DONE = re.compile(
    r"\b(bye|good ?bye|that'?s all|that is all|nothing else|no more questions|"
    r"no questions|i have to go|i'?ll hang up|nothing more)\b"
)
_REPEAT = re.compile(
    r"\b(repeat|say (that|it) again|once more|come again|pardon|didn'?t (hear|catch|get)|"
    r"can'?t hear|not clear|what did you say)\b"
)
_AI_QUESTION = re.compile(
    r"\b(are you (an? )?(ai|bot|robot|machine|real|human|person|computer)|is this (an? )?"
    r"(ai|bot|robot|recording|real person)|am i (talking|speaking) (to|with) (a|an) )"
)
_QUESTION = re.compile(
    r"\?|^(what|when|where|why|how|who|which|can|could|is|are|will|would|do|does|should|"
    r"may|shall)\b"
)


#: Before verification, the person asks who is calling or why ("You are?",
#: "Who is this?"). On the 2026-11-09 handset call the model answered "You
#: are?" by starting the PTM details; the guard muted it and the parent heard
#: only "I'm calling …". The bridge now answers these itself.
_WHO = re.compile(
    r"\b(who (is|are|r) (this|you|it|calling|speaking)|who'?s (this|calling|speaking|there)|"
    r"who are you|^you are|you are\s*\??$|your name|what is (this|it) (about|regarding|for)|"
    r"what'?s (this|it) (about|regarding|for)|why (are you|did you) call|which school|"
    r"where (are you )?calling from|from where|kaun|kon bol)\b|कौन"
)
#: The parent cannot make the proposed PTM time.
_CANT_ATTEND = re.compile(
    r"\b(can'?t|cannot|can not|won'?t|will not|wouldn'?t|would not|not able to|unable to|"
    r"not possible|won'?t be able|will not be able|not be able)\b|"
    r"\b(busy|out of (town|station)|travell?ing|not available)\b|नहीं आ"
)
#: The parent named a day or time ("Saturday morning", "the 16th", "after 4").
_TIME_MENTION = re.compile(
    r"\d|\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend|tomorrow|"
    r"morning|afternoon|evening|next week|day after|noon)\b",
    re.IGNORECASE,
)
_CAN_ATTEND = re.compile(
    r"\b(i|we) (can|will|shall) (come|attend|be there|make it)\b|\b(i'?ll|we'?ll) (come|attend|be there)\b"
)
#: "Call me later / tomorrow / after 6": a callback request at any point.
_CALLBACK_REQ = re.compile(
    r"\b(call (me )?(back|later|again later|tomorrow|tonight|in the (morning|afternoon|evening)|"
    r"after|around|at \d|on (mon|tues|wednes|thurs|fri|satur|sun)day|in \w+ (minutes?|hours?))|"
    r"call back|callback|ring me|phone me later|talk (later|tomorrow)|speak (later|tomorrow)|"
    r"(can|could|will) (the |his |her )?(teacher|class teacher|someone|somebody) (call|phone|ring|speak to|talk to) me|"
    r"teacher (should|can|could) call|"
    r"baad (mein|me) (call|phone|baat)|kal (call|phone|baat))\b"
)
_CB_DAY = re.compile(
    r"\b(today|tonight|tomorrow|day after tomorrow|monday|tuesday|wednesday|thursday|friday|"
    r"saturday|sunday|weekend|next week|this week|\d{1,2}(st|nd|rd|th)|kal|parson)\b"
)
_CB_CLOCK = re.compile(
    r"\b(\d{1,2}(:\d{2})?\s*(a\.?\s?m\.?|p\.?\s?m\.?|o'?clock|baje)|"
    r"(at|around|after|before|by) \d{1,2}(:\d{2})?|\d{1,2}:\d{2}|"
    r"(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)( o'?clock| thirty| pm| am| in the)|"
    r"noon|midday|morning|afternoon|evening|night|tonight|after (lunch|work|office)|"
    r"in (\d+|a few|an?|one|two|five|ten|fifteen|twenty|thirty|half an?) (minutes?|mins?|hours?|hour)|"
    r"any ?time|whenever)\b|शाम|सुबह"
)
_CB_DECLINE = re.compile(
    r"\b(no need|not needed|don'?t (call|need)|never mind|i'?ll call|i will call|i'?ll contact|"
    r"no thanks|no thank you|not required)\b"
)
_ACK = re.compile(
    r"\b(ok|okay|fine|alright|all right|thank you|thanks|got it|sure|yes|yeah|no|nothing|"
    r"that'?s all|that is all|noted|understood|theek hai|accha|haan|done|bye)\b"
)
_ASKS_ATTEND = re.compile(r"\b(able to attend|attend (at )?that time|can you attend|will you attend|be able to come)\b")
_MAYBE = re.compile(r"\b(maybe|not sure|might|i'?ll try|will try|let me check|depends)\b")
_GREETING_ONLY = re.compile(
    r"^(hello|hallo|hi|hey|haan|ha|ji|yes|haan ji|hello ji|namaste|namaskar)?[\s,.!?]*"
    r"(hello|hallo|hi|hey|namaste|namaskar)[\s,.!?]*(hello|hi|ji|sir|madam|ma'?am)?[\s,.!?]*$"
)
_ONLINE = re.compile(r"\b(online|video call|zoom|google meet|on (a |the )?(phone|call) instead|join (by|on) (phone|call))\b")
_CLARIFY = re.compile(
    r"(say (that|it) again|repeat that|didn'?t (catch|hear|get) (that|you)|are you there|"
    r"come again|could you repeat|can you hear me)"
)
_ASKS_TIME = re.compile(
    r"(what|which) (day|time|date)|suit you|better time|another time|convenient|works for you"
)


def is_question(text: str | None) -> bool:
    return bool(_QUESTION.search(_norm(text)))


def availability(text: str | None) -> str:
    """Answer to "Is this a good time to talk?": yes | no | unclear."""
    t = _norm(text)
    if not t:
        return "unclear"
    if _NOT_NOW.search(t):
        return "no"
    first = _first_words(t)
    if first and first[0] in _NO_FIRST and len(t.split()) <= 6 and "problem" not in t:
        return "no"
    if _YES.search(t):
        return "yes"
    return "unclear"


def identity(text: str | None) -> str:
    """Answer to "Am I speaking with the parent or guardian of X?": yes | no | unclear."""
    t = _norm(text)
    if not t:
        return "unclear"
    if _DENY.search(t):
        return "no"
    first = _first_words(t)
    if first and first[0] in _NO_FIRST and "problem" not in t:
        return "no"
    # A hypothetical or a question is not a yes. Real call 2026-11-09: "What if I say I am not?
    # Would you still convey me the message?" matched "i am" and unlocked the child's details.
    if _ID_HYPOTHETICAL.search(t):
        return "unclear"
    if is_question(t) and not (first and first[0] in _ID_YES_FIRST):
        return "unclear"
    # Verification needs a clear yes. Loose acknowledgements ("ha", "ok", "sure")
    # are fine for "good time to talk?" but not for "are you the guardian?": a
    # garbled Kannada transcript "ha do, nona one-shot" must not unlock a child's
    # details on its own.
    if _GUARDIAN_WORDS.search(t) or _ID_YES.search(t):
        return "yes"
    return "unclear"


_ID_HYPOTHETICAL = re.compile(
    r"\b(what if|suppose|supposing|if i (say|said|tell)|(would|will) (you|it) still|(i am|i'?m) not)\b"
)
_ID_YES_FIRST = {"yes", "yeah", "yep", "haan", "haanji", "hanji", "ji", "correct", "speaking"}
_ID_YES = re.compile(
    r"\b(yes|yeah|yep|speaking|haan|haanji|hanji|ji haan|correct|that's right|it is|i am)\b"
    r"|हाँ|हां|जी हाँ|ಹೌದು"
)


# ---- what Riya may say before verification, and whether a detail is real -------

_MONTHS = (
    "january|february|march|april|may|june|july|august|september|october|november|december|"
    "jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec"
)
_DETAIL = re.compile(
    r"\d|\b(" + _MONTHS + r"|monday|tuesday|wednesday|thursday|friday|saturday|sunday|"
    # Times are caught by their digits ("10 a.m."); a bare "am" is the verb in
    # "Am I speaking with...", and matching it muted the guardian question.
    r"tomorrow|tonight|section|grade|standard|marks?|percent|percentage|scored?)\b",
    re.IGNORECASE,
)


def reveals_detail(text: str | None, allowed: str = "") -> bool:
    """Before verification: does Riya's line contain a date, time, number or
    other call detail? Her opening and guardian question never do."""
    t = (text or "").lower()
    for word in _norm(allowed).split():
        t = re.sub(rf"\b{re.escape(word)}\b", " ", t)
    return bool(_DETAIL.search(t))


_DAY_MONTH = re.compile(
    r"\b(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s+(" + _MONTHS + r")\b"
    r"|\b(" + _MONTHS + r")\s+(\d{1,2})(?:st|nd|rd|th)?\b",
    re.IGNORECASE,
)
_TIME = re.compile(r"\b(\d{1,2})(?::(\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)", re.IGNORECASE)


def _dates(text: str) -> set[tuple[int, str]]:
    out: set[tuple[int, str]] = set()
    for m in _DAY_MONTH.finditer(text or ""):
        day = m.group(1) or m.group(4)
        mon = (m.group(2) or m.group(3)).lower()[:3]
        out.add((int(day), mon))
    return out


def _times(text: str) -> set[tuple[int, int, str]]:
    return {
        (int(h), int(mm or 0), ap.lower().replace(".", "").replace(" ", "")[0])
        for h, mm, ap in _TIME.findall(text or "")
    }


# ---- the state engine ---------------------------------------------------------


class RiyaStage(Enum):
    OPENING = "opening"  # first message played; "good time to talk?" open
    AVAILABILITY_OK = "availability_ok"  # parent agreed; Riya asks the guardian question
    IDENTITY_ASKED = "identity_asked"
    VERIFIED = "verified"  # details unlocked; Riya delivers
    DELIVERED = "delivered"  # announcement made; conversation
    CALLBACK = "callback"  # the parent asked to be called later: collect WHEN, confirm
    CLOSING = "closing"
    ENDED = "ended"


class Act(Enum):
    NONE = "none"  # the model carries the conversation
    UNLOCK = "unlock"  # verified: hand the model the purpose details
    CLOSE = "close"  # a closing branch: the model says its line, the bridge ensures the end
    PARENT_DONE = "parent_done"  # the parent said goodbye: Riya closes (model's line or hers)
    REASK = "reask"  # before verification: the bridge plays the guardian question itself
    SAY = "say"  # the bridge plays `line` (cached in Riya's voice; else the model is told it)
    CUE = "cue"  # the bridge hands the model `line` as a system cue (natural wording)


@dataclass(frozen=True)
class RiyaDecision:
    act: Act
    #: For CLOSE: busy | wrong_person | unverified | stop | safe_exit.
    branch: str = ""
    #: The exact line this branch prescribes (spoken by the model; the bridge's
    #: safety net uses it verbatim if the model does not close).
    line: str = ""


@dataclass
class RiyaCall:
    variables: dict[str, str]
    product_context: str = ""
    max_seconds_override: int | None = None
    stage: RiyaStage = RiyaStage.OPENING
    good_time_to_talk: str = "no_answer"
    identity_state: str = "unknown"  # unknown | confirmed | denied | unverified
    identity_unclear: int = 0
    availability_unclear: int = 0
    #: Riya's questions after verification (her limit is two; the availability
    #: and guardian questions do not count).
    questions_after_verification: int = 0
    parent_turns_after_delivery: int = 0
    parent_signalled_end: bool = False
    parent_open_question: bool = False
    last_agent_text: str = ""
    last_agent_cut: bool = False
    close_branch: str = ""
    reprompts: int = 0
    parent_last_seen: str = ""
    #: Everything the parent said (latest form of each utterance): dates/times
    #: in it may be repeated back without being "corrected" to the record.
    parent_said: list[str] = field(default_factory=list)
    parent_answered: str = ""
    reprompted_since_parent: bool = False
    agent_turns: int = 0
    end_call_declined: int = 0
    skip_turns: int = 0
    #: Guardian question re-asked by the bridge (who-is-calling, privacy block,
    #: or a "yes" that did not follow a fully heard guardian question).
    reasks: int = 0
    #: PTM: the parent cannot attend; Riya must ask once for a better time.
    cannot_attend: bool = False
    preferred_time_asked: bool = False
    preferred_time_given: bool = False
    time_nudged: bool = False
    attendance_nudged: bool = False
    unlock_cue_sent: bool = False
    #: PTM: did the parent answer "Will you be able to attend?" (2026-11-09 Sir
    #: call: the answer was lost and the call closed with attendance unknown).
    attendance_asked: bool = False
    attendance_answered: bool = False
    attendance_reasked: bool = False
    #: Callback: asking | asking_time | confirming | confirmed | declined
    callback_state: str = ""
    callback_day: str = ""
    callback_time: str = ""
    callback_turns: int = 0
    callback_unclear: int = 0
    stop_requested: bool = False
    events: list[dict[str, str]] = field(default_factory=list)

    def __post_init__(self) -> None:
        self.route = route(self.product_context, self.variables.get("call_purpose"))
        self.node = load_workflow()["nodes"][self.route.node_id]
        if self.route.node_id == SAFE_EXIT_NODE:
            self.stage = RiyaStage.OPENING
        self._event("route", self.route.label)

    # ---- static configuration ------------------------------------------------

    @property
    def workflow(self) -> dict[str, Any]:
        return load_workflow()

    @property
    def is_safe_exit(self) -> bool:
        return self.route.node_id == SAFE_EXIT_NODE

    @property
    def purpose(self) -> str:
        return self.variables.get("call_purpose", "") or ""

    @property
    def max_seconds(self) -> int:
        return int(self.max_seconds_override or self.workflow["max_duration_seconds"])

    @property
    def turn_timeout(self) -> float:
        return float(self.workflow["turn"]["turn_timeout"])

    @property
    def silence_end_call_timeout(self) -> float:
        return float(self.workflow["turn"]["silence_end_call_timeout"])

    @property
    def max_duration_message(self) -> str:
        return " ".join((self.workflow["max_duration_message"] or "").split())

    def busy_line(self) -> str:
        if self.route.node_id == "node_01m4wj0rvvenss5tsq096wy0t2":
            date = (self.variables.get("closure_date") or "").strip()
            if date:
                return (
                    f"I'll be quick: the school will be closed on {date}. Please contact "
                    "the school for more details. Thank you."
                )
            return (
                "I'll be quick: there's an important school closure update. Please contact "
                "the school for the confirmed details. Thank you."
            )
        return BUSY_LINES.get(self.route.node_id, _DEFAULT_BUSY_LINE)

    def locked_vars(self) -> set[str]:
        """Variables withheld until verification: this node's own details, plus
        any base-prompt variable that actually carries a value."""
        visible = _ALWAYS_VISIBLE | _VISIBLE_BEFORE_VERIFICATION.get(self.route.node_id, set())
        node_vars = _node_vars(self.node["additional_prompt"] or "")
        valued = {
            k for k in _node_vars(self.workflow["base_prompt"]) if (self.variables.get(k) or "").strip()
        }
        return (node_vars | valued) - visible

    def first_message(self) -> str:
        if self.is_safe_exit:
            return ""
        return render(self.workflow["first_message"], self.variables)

    def instruction(self, opener_spoken: bool = True) -> str:
        """The model's system instruction, LOCKED (no purpose details).

        `opener_spoken`: the cached opener plays before the model speaks. Without a
        cached recording (a school name never rendered) the MODEL must say it;
        telling it the line was "already spoken" made it skip the AI disclosure and
        the "good time to talk?" question (Sampark e2e, 2026-11-09)."""
        if self.is_safe_exit:
            return self.node["prompt_override"] or ""
        locked = self.locked_vars()
        values = {
            k: (LOCKED_MARKER if k in locked and (self.variables.get(k) or "").strip() else v)
            for k, v in self.variables.items()
        }
        body = render(self.workflow["base_prompt"], values)
        node = render(self.node["additional_prompt"], values)
        opening = self.first_message()
        first = (
            f'- Your opening line has ALREADY been spoken to the parent: "{opening}" '
            "The parent's next words answer it. Do not say it again and do not "
            "introduce yourself again.\n"
            if opener_spoken
            else f'- Begin the call by saying exactly this, word for word, and nothing else: "{opening}" '
            "Then wait for the parent's answer. Never introduce yourself a second time.\n"
        )
        runtime = (
            "\n\n# Runtime notes for this phone line\n"
            + first
            + "- Speak English only, in natural Indian English, at a moderate pace.\n"
            "- Details marked as shared after the parent or guardian confirms are not "
            "available to you yet. Until a system message gives them to you, you do NOT "
            "know any date, time, class, section, schedule or other detail of this call: "
            "never state or guess one. When the person confirms they are the parent or "
            "guardian (even before you asked), reply with only a brief acknowledgement "
            "such as \"Thank you.\" and wait: the system will then give you the details "
            "to share. Never mention this marker.\n"
            "- Concerns and disagreement (behaviour, academics, attendance): if the parent is "
            "upset, defensive or disagrees, stay calm and kind. Acknowledge their feeling in your "
            "own words (\"I understand this is upsetting\"), never argue, never blame the parent "
            "or label the child, and do not repeat the concern as if it were proven. Say the "
            "school wants to work together to support the child. Offer a follow-up: ask if they "
            "would like the class teacher to call them back, and if yes, ask when. Never end "
            "the call or say goodbye in the same reply as answering a concern; close only after "
            "the parent says they are done.\n"
            "- Callbacks (this overrides any line above that ends the call when it is not a "
            "good time): if the person says it is not a good time, or asks you to call later, "
            "do NOT end the call. Ask when you should call back. If they give only a day "
            "(\"tomorrow\"), ask what time. Then repeat the day and time back in one short "
            "sentence and ask if that is right. Once they confirm, thank them, say you have "
            "noted their request for a call back, and end the call. Never say a callback is "
            "booked or confirmed. If they do not want a callback, thank them and end politely.\n"
            "- If the parent cannot attend the meeting at the proposed time, your reply "
            "MUST ask once when would suit them (\"What day and time would suit you "
            "better?\"), even if they also raised something else: answer that briefly "
            "first, then ask. Do not ask it if they already named a day or time.\n"
            "- PTM invitation: until the parent has said whether they can attend, after briefly "
            "answering anything else they ask, come back and ask once more whether they can attend. "
            "Do not ask 'Is there anything else?' before you have that answer.\n"
            "- If you hear only noise, a fragment or something you cannot make sense "
            "of, do not guess: briefly ask the parent to say it again.\n"
            "- The tool end_call has no arguments. Call it only by the end_call rules."
        )
        if node:
            return f"{body}\n\n# Current call workflow\n{node}{runtime}"
        return body + runtime

    def pre_verification_allowed(self) -> str:
        """Words Riya may say before verification even if they look like details:
        the school, the child's name and (emergency closure only) the closure date."""
        visible = _ALWAYS_VISIBLE | _VISIBLE_BEFORE_VERIFICATION.get(self.route.node_id, set())
        return " ".join(str(self.variables.get(k) or "") for k in sorted(visible))

    def guardian_question(self) -> str:
        """This node's own verification line, from its prompt."""
        m = re.search(
            r'your next reply must be ONLY:\s*"([^"]+)"', self.node.get("additional_prompt") or ""
        )
        line = m.group(1) if m else (
            "Thank you. Am I speaking with the parent or guardian of {{student_name}}?"
        )
        return render(line, self.variables)

    def who_line(self) -> str:
        """Answer to "Who is this?" before verification, ending in the guardian
        question. No call detail: only Riya, the school and the child's name."""
        school = (self.variables.get("school_name") or "").strip() or "your child's school"
        student = (self.variables.get("student_name") or "").strip()
        child = f"the parent or guardian of {student}" if student else "the parent or guardian"
        return (
            f"I'm Riya, an AI assistant calling from {school}. Before I share the details, "
            f"could you confirm if I'm speaking with {child}?"
        )

    def confirm_line(self) -> str:
        """A short repeat of the guardian question (after a muted fragment)."""
        student = (self.variables.get("student_name") or "").strip()
        child = f"the parent or guardian of {student}" if student else "the parent or guardian"
        return f"Sorry, just to confirm, am I speaking with {child}?"

    def reask_line(self, parent_text: str = "") -> str:
        return self.who_line() if _WHO.search(_norm(parent_text)) else self.confirm_line()

    def _guardian_question_heard(self) -> bool:
        return bool(_ASKS_GUARDIAN.search(self.last_agent_text.lower())) and not self.last_agent_cut

    def _reask(self, parent_text: str, why: str) -> RiyaDecision:
        self.reasks += 1
        self._event("reask", why)
        if self.reasks > 2:
            self.identity_state = "unverified"
            return self._close("unverified", WRONG_PERSON_LINE)
        return RiyaDecision(Act.REASK, why, self.reask_line(parent_text))

    def on_privacy_block(self) -> RiyaDecision:
        """Riya started a detail before verification and it was muted: the
        parent heard a fragment, so the guardian question is asked again."""
        self.last_agent_cut = True
        return self._reask("", "privacy_block")

    def _without_record_slot(self, t: str) -> str:
        """`t` minus the proposed date/time ("I can't come on the 14th" names
        the meeting's own slot, not an alternative)."""
        for k in ("event_date", "event_time"):
            for word in _norm(self.variables.get(k)).split():
                t = re.sub(rf"\b{re.escape(word)}\b", " ", t)
        for n in re.findall(r"\d+", " ".join(str(self.variables.get(k) or "") for k in ("event_date", "event_time"))):
            t = re.sub(rf"\b{n}(st|nd|rd|th)?\b", " ", t)
        return t

    def last_question(self) -> str:
        """Riya's last question, for a "didn't catch that" re-ask."""
        parts = re.split(r"(?<=[.!?])\s+", self.last_agent_text.strip())
        qs = [p for p in parts if p.endswith("?") and not _CLARIFY.search(p.lower())]
        return qs[-1] if qs else ""

    def unheard_cue(self) -> str:
        q = self.last_question()
        if q:
            return (
                "(System: the parent just replied but it did not come through. Say sorry, "
                f"you didn't catch that, and ask again in a few words: \"{q}\" Nothing else.)"
            )
        return (
            "(System: the parent just said something that did not come through clearly. "
            "Briefly and warmly ask them to say it again. Do not repeat anything else.)"
        )

    # ---- callback flow -----------------------------------------------------------

    def _start_callback(self, t: str) -> RiyaDecision:
        if self.route.node_id == "node_01m4wj0rvvenss5tsq096wy0t2":
            # Emergency closure: the urgent line is the point of the call.
            return self._close("busy", self.busy_line())
        self._goto(RiyaStage.CALLBACK, "callback requested")
        self.callback_state = "asking"
        self._event("callback", "requested")
        return self._callback_from(t, first=True)

    def _callback_from(self, t: str, first: bool = False) -> RiyaDecision:
        day = _CB_DAY.search(t)
        clock = _CB_CLOCK.search(t)
        if day:
            self.callback_day = day.group(0)
        if clock:
            self.callback_time = clock.group(0)
        if self.callback_time:
            self.callback_state = "confirming"
            return RiyaDecision(Act.CUE, "callback_confirm", self.callback_confirm_cue())
        if self.callback_day:
            self.callback_state = "asking_time"
            return RiyaDecision(Act.SAY, "callback_time", CALLBACK_TIME_LINE)
        self.callback_state = "asking"
        return RiyaDecision(Act.SAY, "callback_ask", CALLBACK_ASK_LINE)

    def callback_when(self) -> str:
        return " ".join(x for x in (self.callback_day, self.callback_time) if x).strip()

    def callback_confirm_cue(self) -> str:
        return (
            "(System: the person wants a call back: \"" + self.callback_when() + "\" (their words). "
            "In ONE short natural sentence, repeat the day and time back and ask if that is "
            "right, for example: \"So, tomorrow around 6 PM. Is that right?\" Say nothing else, "
            "do not say goodbye and do not end the call.)"
        )

    def _on_callback(self, t: str, new_utterance: bool) -> RiyaDecision:
        if not new_utterance:
            return RiyaDecision(Act.NONE)
        self.callback_turns += 1
        if self.callback_turns > 6:
            if self.callback_when():
                self.callback_state = "confirmed"
                return self._close("callback", CALLBACK_DONE_LINE)
            return self._close("busy", self.busy_line())
        if _CB_DECLINE.search(t) or (_PARENT_DONE.search(t) and not (_CB_DAY.search(t) or _CB_CLOCK.search(t))):
            # "No need" / "Okay, thank you, bye" without a time: no callback, close politely.
            self.callback_state = "declined"
            self._event("callback", "declined")
            return self._close("busy", self.busy_line())
        first = _first_words(t)
        said_no = bool(first) and first[0] in _NO_FIRST
        new_when = bool(_CB_DAY.search(t) or _CB_CLOCK.search(t))
        if self.callback_state == "confirming":
            if new_when and (said_no or not _YES.search(t) or len(t.split()) > 3):
                # A correction: "No, make it 7" / "Day after tomorrow, at 5".
                if _CB_DAY.search(t) and not _CB_CLOCK.search(t):
                    self.callback_time = ""
                return self._callback_from(t)
            if said_no:
                self.callback_day = self.callback_time = ""
                self.callback_state = "asking"
                return RiyaDecision(Act.SAY, "callback_ask", CALLBACK_ASK_LINE)
            if _YES.search(t) or _ID_YES.search(t):
                self.callback_state = "confirmed"
                self._event("callback", f"confirmed:{self.callback_when()}")
                return self._close("callback", CALLBACK_DONE_LINE)
            self.callback_unclear += 1
            if self.callback_unclear >= 2:
                self.callback_state = "confirmed"
                return self._close("callback", CALLBACK_DONE_LINE)
            return RiyaDecision(Act.CUE, "callback_confirm", self.callback_confirm_cue())
        # asking / asking_time
        if new_when:
            return self._callback_from(t)
        if said_no:
            self.callback_state = "declined"
            return self._close("busy", self.busy_line())
        self.callback_unclear += 1
        if self.callback_unclear >= 2:
            return self._close("busy", self.busy_line())
        line = CALLBACK_TIME_LINE if self.callback_state == "asking_time" else CALLBACK_ASK_LINE
        return RiyaDecision(Act.SAY, "callback_reask", line)

    def time_followup_cue(self) -> str | None:
        """PTM: the parent cannot attend and Riya has not asked for a better
        time (the prompt says to ask once). Returned once, then never again."""
        if (
            self.purpose != "ptm_invitation"
            or self.stage is not RiyaStage.DELIVERED
            or not self.cannot_attend
            or self.preferred_time_asked
            or self.preferred_time_given
            or self.time_nudged
            or self.parent_signalled_end
        ):
            return None
        self.time_nudged = True
        self._event("time_followup", "cue")
        return (
            "(System: the parent said they cannot attend at the proposed time, and you "
            "have not asked when would suit them. Ask now, in one short sentence and "
            'nothing else: "What day and time would suit you better?")'
        )

    def attendance_followup_cue(self) -> str | None:
        """PTM: Riya asked whether they can attend, the parent went off on something else, and her
        reply did not come back to it (real call 2026-11-10: "Can you dance?" and the attendance
        question was never asked again). Returned once."""
        last = self.last_agent_text.strip()
        if (
            self.purpose != "ptm_invitation"
            or self.stage is not RiyaStage.DELIVERED
            or not self.attendance_asked
            or self.attendance_answered
            or self.cannot_attend
            or self.attendance_nudged
            or self.parent_signalled_end
            or self.parent_turns_after_delivery < 1
            or _ASKS_ATTEND.search(last.lower())
            or last.endswith("?")
        ):
            return None
        self.attendance_nudged = True
        self._event("attendance_followup", "cue")
        when = " ".join(v for v in (self.variables.get("event_date"), self.variables.get("event_time")) if v)
        on = f" on {when}" if when else ""
        return (
            "(System: the parent has not yet said whether they can attend the meeting. Ask once, in one "
            f'short sentence and nothing else: "And will you be able to attend the meeting{on}?")'
        )

    def detail_mismatch(self, text: str) -> str | None:
        """After verification: a date or time Riya said that is neither in the record
        nor said by the parent. (2026-11-09 Sampark Vobiz call: the parent proposed
        "17th, 5 PM", Riya repeated it, and the check made her "correct" it to 10 AM.)"""
        record = " ".join([*(str(v) for v in self.variables.values() if v), *self.parent_said])
        bad = [f"{d} {m}" for d, m in _dates(text) - _dates(record)]
        bad += [f"{h}:{mm:02d} {ap}m" for h, mm, ap in _times(text) - _times(record)]
        return ", ".join(sorted(bad)) or None

    def correction_cue(self, wrong: str) -> str:
        facts = "; ".join(
            f"{k} = {(self.variables.get(k) or '').strip() or 'not provided'}"
            for k in sorted(self.locked_vars())
        )
        return (
            f"(System: you just said {wrong}, which is NOT in the record. The record says: "
            f"{facts}. Correct yourself in one short sentence and continue. Never state a "
            "date or time that is not in the record.)"
        )

    def premature_detail_cue(self) -> str:
        return (
            "(System: you started to share call details before the person confirmed they "
            "are the parent or guardian, and it was not played. Say only this, and nothing "
            f'else: "{self.guardian_question()}")'
        )

    def unlock_cue(self) -> str:
        """Handed to the model once the bridge heard the guardian confirm."""
        # This node's own details; the general node (no node prompt) shares
        # whatever was supplied.
        visible = _ALWAYS_VISIBLE | _VISIBLE_BEFORE_VERIFICATION.get(self.route.node_id, set())
        names = (_node_vars(self.node["additional_prompt"] or "") - visible) or self.locked_vars()
        details = [
            f"- {k}: {(self.variables.get(k) or '').strip() or '(not provided)'}"
            for k in sorted(names)
        ]
        return (
            "(System: the person has confirmed they are the parent or guardian. These "
            "are the call details you may now share:\n"
            + "\n".join(details)
            + "\nContinue with the next step of your call workflow now: share the "
            "available details in your own natural words, leave out anything not "
            "provided, and do not introduce yourself or say the child's name again.)"
        )

    # ---- events ---------------------------------------------------------------

    def _event(self, kind: str, detail: str = "") -> None:
        self.events.append({"event": kind, "stage": self.stage.value, "detail": detail})

    def _goto(self, stage: RiyaStage, why: str) -> None:
        if stage is not self.stage:
            self.stage = stage
            self._event("stage", why)

    def stalled_close(self) -> RiyaDecision:
        """The model keeps trying to end the call without speaking: close it ourselves."""
        self._event("stalled", "bridge_close")
        return self._close("stalled", STALLED_CLOSE_LINE)

    def _close(self, branch: str, line: str) -> RiyaDecision:
        self.close_branch = branch
        self._goto(RiyaStage.CLOSING, branch)
        return RiyaDecision(Act.CLOSE, branch, line)

    def on_agent(self, text: str, *, interrupted: bool = False) -> None:
        """A complete turn Riya spoke (`interrupted`: cut off before its end)."""
        text = (text or "").strip()
        if not text:
            return
        self.agent_turns += 1
        self.last_agent_text = text
        self.last_agent_cut = interrupted
        if self.stage is RiyaStage.DELIVERED and _ASKS_TIME.search(text.lower()):
            self.preferred_time_asked = True
        if self.stage in (RiyaStage.VERIFIED, RiyaStage.DELIVERED) and _ASKS_ATTEND.search(text.lower()):
            self.attendance_asked = True
        self.parent_open_question = False
        self.parent_answered = self.parent_last_seen
        low = text.lower()
        if self.stage in (RiyaStage.OPENING, RiyaStage.AVAILABILITY_OK) and _ASKS_GUARDIAN.search(low):
            self._goto(RiyaStage.IDENTITY_ASKED, "guardian question asked")
        elif self.stage is RiyaStage.VERIFIED:
            self._goto(RiyaStage.DELIVERED, "details shared")
        elif (
            self.stage is RiyaStage.DELIVERED
            and text.rstrip(" .…").endswith("?")
            and not _CLARIFY.search(low)
        ):
            # "Could you say that again?" / "Are you there?" repair the line;
            # they are not Riya's questions (counting them closed the Sir call
            # before attendance was answered).
            self.questions_after_verification += 1
            self._event("question", str(self.questions_after_verification))

    def on_parent(self, text: str, *, new_utterance: bool = True) -> RiyaDecision:
        """Decide what the bridge must do about one parent utterance.

        Called again as transcription fragments of the same utterance arrive
        (`new_utterance=False`), always with the whole utterance so far.
        """
        t = _norm(text)
        if not t or self.stage in (RiyaStage.CLOSING, RiyaStage.ENDED):
            return RiyaDecision(Act.NONE)
        self.reprompted_since_parent = False
        self.parent_last_seen = text
        if new_utterance or not self.parent_said:
            self.parent_said.append(text)
        else:
            self.parent_said[-1] = text
        if self.is_safe_exit:
            return self._close("safe_exit", SAFE_EXIT_LINE)
        if is_optout(text) or _STOP.search(t):
            self._event("parent", "stop")
            self.stop_requested = True
            return self._close("stop", CLOSING_LINE)
        if self.stage is RiyaStage.CALLBACK:
            return self._on_callback(t, new_utterance)
        if _AI_QUESTION.search(t):
            self._event("parent", "asked_if_ai")
        if _REPEAT.search(t):
            self._event("parent", "repeat_request")

        if self.stage in (RiyaStage.OPENING, RiyaStage.AVAILABILITY_OK) and _DENY.search(t):
            # "Wrong number" can come before the guardian question is asked.
            self.identity_state = "denied"
            return self._close("wrong_person", WRONG_PERSON_LINE)

        if self.stage is RiyaStage.OPENING:
            verdict = availability(t)
            if verdict != "no" and _GUARDIAN_WORDS.search(t) and not _DENY.search(t):
                # "Yes, go ahead, I'm his mother": both answers in one breath.
                self.good_time_to_talk = "yes"
                self.identity_state = "confirmed"
                self._goto(RiyaStage.VERIFIED, "guardian volunteered")
                return RiyaDecision(Act.UNLOCK)
            if verdict == "no" or (_CALLBACK_REQ.search(t) and not _CB_DECLINE.search(t)):
                self.good_time_to_talk = "no"
                return self._start_callback(t)
            if verdict == "yes":
                self.good_time_to_talk = "yes"
                self._goto(RiyaStage.AVAILABILITY_OK, "good time to talk")
            elif new_utterance:
                self.availability_unclear += 1
                if self.availability_unclear == 1:
                    if _GREETING_ONLY.match(t):
                        # "Hello?" over or right after the opener is a greeting, not an unclear answer:
                        # the opener already asked; never cut it off with "Sorry, I didn't catch that".
                        self._event("availability", "greeting_only")
                        return RiyaDecision(Act.NONE)
                    self._event("availability", "unclear_reask")
                    return RiyaDecision(Act.REASK, "availability_unclear", AVAILABILITY_REASK_LINE)
            return RiyaDecision(Act.NONE)

        if self.stage in (RiyaStage.AVAILABILITY_OK, RiyaStage.IDENTITY_ASKED):
            if _NOT_NOW.search(t) or _CALLBACK_REQ.search(t):
                self.good_time_to_talk = "no"
                return self._start_callback(t)
            if self.stage is RiyaStage.AVAILABILITY_OK:
                # Before the guardian question only an EXPLICIT statement counts
                # ("I'm his mother"); a bare "yes" here answered the availability
                # question and verifies nothing.
                if _GUARDIAN_WORDS.search(t) and not _DENY.search(t):
                    self.identity_state = "confirmed"
                    self._goto(RiyaStage.VERIFIED, "guardian volunteered")
                    return RiyaDecision(Act.UNLOCK)
                if _WHO.search(t) and new_utterance:
                    return self._reask(text, "who_is_calling")
                return RiyaDecision(Act.NONE)
            verdict = identity(t)
            if verdict == "no" and not _DENY.search(t) and len(t.split()) > 4:
                # "No, I won't be able to come that day" answers something else
                # (s14: a garbled "yes sir" was followed by this and the call was
                # closed as a wrong number). Only a short or explicit no denies.
                verdict = "unclear"
            if verdict == "no":
                self.identity_state = "denied"
                return self._close("wrong_person", WRONG_PERSON_LINE)
            if new_utterance and _WHO.search(t):
                # "You are?" / "Who is this?": the bridge answers with who Riya
                # is and the guardian question, never the model (it leaked).
                return self._reask(text, "who_is_calling")
            if verdict == "yes":
                if not self._guardian_question_heard() and not _GUARDIAN_WORDS.search(t):
                    # "Yes sir" after a muted fragment answers nothing they heard.
                    if new_utterance:
                        return self._reask(text, "yes_without_question")
                    return RiyaDecision(Act.NONE)
                self.identity_state = "confirmed"
                self._goto(RiyaStage.VERIFIED, "guardian confirmed")
                return RiyaDecision(Act.UNLOCK)
            if new_utterance:
                self.identity_unclear += 1
            if self.identity_unclear >= 2:
                # Riya: "If the recipient is ... cannot be verified, apologise
                # without disclosing student details, then call end_call once."
                self.identity_state = "unverified"
                return self._close("unverified", WRONG_PERSON_LINE)
            if new_utterance and self.identity_unclear == 1:
                # An unclear answer ("yet, her") gets the guardian question again,
                # in Riya's cached voice: the model improvised past it in s14.
                return RiyaDecision(Act.REASK, "identity_unclear", self.confirm_line())
            return RiyaDecision(Act.NONE)

        # VERIFIED / DELIVERED: Riya converses; the bridge only keeps the facts
        # the end_call rules need.
        if _DENY.search(t):
            # "I am not the parent of Alyssa" after the update: a wrong person after all.
            # Close as a wrong number (before: ignored, end_call refused, the call stalled).
            self.identity_state = "denied"
            self._event("identity", "denied_after_delivery")
            return self._close("wrong_person", WRONG_PERSON_LINE)
        if self.stage is RiyaStage.DELIVERED and new_utterance:
            self.parent_turns_after_delivery += 1
        self.parent_open_question = is_question(t)
        if new_utterance and _CALLBACK_REQ.search(t) and not _CB_DECLINE.search(t):
            # "Can you call me back later? I'm driving." after the update.
            return self._start_callback(t)
        if self.stage is RiyaStage.DELIVERED and self.purpose == "ptm_invitation":
            first = _first_words(t)
            asked_attend = "attend" in self.last_agent_text.lower()
            # "No, who are you?" answers nothing about attending (real call 2026-11-10): a bare
            # leading "no" counts only when the utterance is not itself a question.
            bare_no = asked_attend and first and first[0] in _NO_FIRST and not is_question(t)
            if not _CAN_ATTEND.search(t) and "problem" not in t and (_CANT_ATTEND.search(t) or bare_no):
                self.cannot_attend = True
            if _ONLINE.search(t):
                # "Can I join online instead?" answers the attendance question (meeting mode).
                self.attendance_answered = True
            if asked_attend and not is_question(t) and (
                self.cannot_attend or _CAN_ATTEND.search(t) or _MAYBE.search(t)
                or (first and (first[0] in _NO_FIRST or _YES.match(first[0])))
            ):
                self.attendance_answered = True
            if self.cannot_attend and _TIME_MENTION.search(self._without_record_slot(t)):
                self.preferred_time_given = True
        # The LAST sentence decides: "Can I join online instead? Okay, thank you. Bye." is a goodbye.
        last_sentence = re.split(r"(?<=[.?!])\s+", t)[-1] if t else ""
        if _PARENT_DONE.search(last_sentence) and not is_question(last_sentence):
            self.parent_open_question = False
        if _PARENT_DONE.search(t) and not self.parent_open_question:
            self.parent_signalled_end = True
            self._event("parent", "signalled_end")
            return RiyaDecision(Act.PARENT_DONE, "parent_ended", CLOSING_LINE)
        return RiyaDecision(Act.NONE)

    # ---- end_call validation (Riya's CALL / NEVER CALL rules) -----------------

    #: end_call reasons that mean "Riya thinks it is over" rather than a forced
    #: branch: the bridge still listens briefly before hanging up.
    SOFT_ENDS = frozenset({"conversation_completed", "parent_ended"})

    def may_end(self, pending: str = "", parent_last: str = "") -> tuple[bool, str]:
        """`pending`: Riya's turn still being spoken (end_call arrives before the
        turn is filed, so the last FILED turn can be the previous question)."""
        last = (pending or "").strip() or self.last_agent_text
        if self.stage is RiyaStage.CLOSING:
            return True, self.close_branch or "closing"
        if self.stage is RiyaStage.CALLBACK:
            # The bridge closes the callback branch itself once WHEN is confirmed.
            return False, "callback_in_progress"
        if self.is_safe_exit:
            return True, "safe_exit"
        if self.stage in (RiyaStage.OPENING, RiyaStage.AVAILABILITY_OK, RiyaStage.IDENTITY_ASKED):
            # Before verification nothing has been shared, so ending is safe once
            # Riya has actually said goodbye (busy / wrong person / stop, heard by
            # the model even when the transcript garbled it: "I'm busy" -> "I'm baby").
            if re.search(r"(have a (good|nice) day|good ?bye)[\W\s]*$", last, re.I) and "?" not in last:
                if self.good_time_to_talk == "yes" and not self.stop_requested and self.identity_state != "denied":
                    # r01 2026-11-10: after "Yes, go ahead" the model said "I will discuss this with the
                    # school ... Have a good day." The parent agreed to talk; the purpose is not reached.
                    return False, "purpose_not_reached"
                return True, "riya_closed_before_verification"
            return False, "purpose_not_reached"
        # The parent's LATEST words, not the debounced verdict: a model that
        # answers "can you repeat the date?" with end_call must be refused.
        # Riya's turn in progress already answers the question when it says something before its
        # farewell (end_call arrives before that turn is filed). Real call 2026-11-09: "Please
        # contact the school for details. Have a good day." was refused and its goodbye muted.
        answering = len(re.findall(r"\w+", _RIYA_FAREWELL_TAIL.split((pending or "").strip(), 1)[0])) >= 4
        if not answering and (
            self.parent_open_question or (parent_last and is_question(parent_last) and self._parent_newer(parent_last))
        ):
            return False, "parent_question_open"
        if self.parent_signalled_end or (
            parent_last and _PARENT_DONE.search(_norm(parent_last)) and not is_question(parent_last)
            and self._parent_newer(parent_last)
        ):
            return True, "parent_ended"
        if self.stage is RiyaStage.VERIFIED:
            return False, "update_not_delivered"
        if (
            self.purpose == "ptm_invitation"
            and self.attendance_asked
            and not self.attendance_answered
            and not self.attendance_reasked
            and not re.search(r"(good day|goodbye|bye)", last, re.I)
        ):
            return False, "attendance_unanswered"
        if self.parent_turns_after_delivery == 0:
            return False, "parent_not_yet_responded"
        if last.rstrip(" .…").endswith("?"):
            return False, "riya_question_open"
        latest = _norm(parent_last or self.parent_last_seen)
        if latest and not (_ACK.search(latest) and len(latest.split()) <= 8) and not _PARENT_DONE.search(latest):
            # s04: the parent had just disagreed ("He is not like that") and Riya
            # said goodbye. A statement that is not a wrap-up keeps the call open.
            if answering:
                return False, "answered_check_anything_else"
            return False, "parent_still_engaged"
        if not re.search(r"(good day|goodbye|bye|thank you for your time)", last, re.I):
            return False, "no_goodbye_spoken"
        return True, "conversation_completed"

    def fixed_lines(self) -> list[str]:
        """Every line this call may need verbatim, for pre-rendering in the call
        voice: the opening, the node's guardian question, the closings."""
        lines = [
            self.first_message(),
            self.guardian_question(),
            self.who_line(),
            self.confirm_line(),
            CALLBACK_ASK_LINE,
            AVAILABILITY_REASK_LINE,
            CALLBACK_TIME_LINE,
            CALLBACK_DONE_LINE,
            self.busy_line(),
            WRONG_PERSON_LINE,
            CLOSING_LINE,
            self.max_duration_message,
            SAFE_EXIT_LINE,
            LINE_TROUBLE_LINE,
            RESUME_LINE,
        ]
        return [x for i, x in enumerate(lines) if x and x not in lines[:i]]

    def awaiting_reply(self, parent_last: str = "") -> bool:
        """The parent spoke after Riya's last filed turn and has had no reply."""
        latest = parent_last or self.parent_last_seen
        return bool(latest) and latest != self.parent_answered

    def closing_line(self) -> str:
        return CLOSING_LINE

    def _parent_newer(self, parent_last: str) -> bool:
        """Was `parent_last` said after Riya's last filed turn?"""
        return parent_last != self.parent_answered

    def on_end_call(self, pending: str = "", parent_last: str = "") -> tuple[bool, str]:
        ok, why = self.may_end(pending, parent_last)
        self._event("end_call", f"{'accepted' if ok else 'declined'}:{why}")
        if ok and why not in self.SOFT_ENDS:
            self._goto(RiyaStage.CLOSING, why)
            self.close_branch = self.close_branch or why
        elif not ok:
            self.end_call_declined += 1
            if why == "attendance_unanswered":
                self.attendance_reasked = True
        return ok, why

    def confirm_soft_end(self, why: str) -> None:
        """The listening window after Riya's goodbye passed in silence."""
        self.close_branch = self.close_branch or why
        self._goto(RiyaStage.CLOSING, why)

    def _goto_ended(self) -> None:
        self._goto(RiyaStage.ENDED, "call ended")

    def skip_allowed(self, parent_last: str) -> tuple[bool, str]:
        """skip_turn (stay silent) is right only when the parent asked Riya to
        wait, or has just confirmed as guardian (the details are on their way).
        Anywhere else silence is dead air: in testing the model "skipped" a
        reply it did not understand and the parent heard nothing."""
        t = _norm(parent_last)
        if _WAIT.search(t):
            return True, "parent_asked_to_wait"
        if self.stage is RiyaStage.IDENTITY_ASKED and identity(t) == "yes":
            # Not silence: ~2.5 s of dead air while the answer is checked felt like a pause on every
            # call (2026-11-10). Riya says "Thank you." and the details follow it.
            return False, "acknowledge"
        if self.stage is RiyaStage.VERIFIED and not self.unlock_cue_sent:
            return True, "details_on_the_way"
        if self.stage is RiyaStage.VERIFIED:
            # The details cue has been sent: silence now is dead air (synthetic s14, 2026-11-10:
            # skip_turn twice, the parent heard nothing, the call closed on silence).
            return False, "deliver_details"
        return False, "must_respond"

    def on_skip_turn(self) -> None:
        self.skip_turns += 1
        self._event("skip_turn")

    # ---- silence (turn_timeout / silence_end_call_timeout) --------------------

    def on_silence(self, quiet_for: float) -> str:
        """`none` | `reprompt` (once per Riya turn, at turn_timeout) | `close`."""
        if self.stage in (RiyaStage.CLOSING, RiyaStage.ENDED):
            return "none"
        # silence_end_call_timeout (15 s) of parent silence ends the call; one
        # brief reprompt at turn_timeout (7 s) in between, never a loop of them.
        if quiet_for >= self.silence_end_call_timeout or (
            self.reprompted_since_parent and quiet_for >= self.turn_timeout
        ):
            self._close("silence", CLOSING_LINE)
            return "close"
        if quiet_for >= self.turn_timeout and not self.reprompted_since_parent:
            self.reprompted_since_parent = True
            self.reprompts += 1
            self._event("silence", "reprompt")
            return "reprompt"
        return "none"

    def reprompt_cue(self) -> str:
        """Riya §9: give a brief opportunity; repeat the relevant point once."""
        return (
            "(System: the line has been silent for several seconds and the parent has "
            "said nothing. Give them one brief opportunity to respond: ask simply, e.g. "
            "\"Hello, are you there?\", or repeat only your last question in a few words. "
            "Do not say you could not hear them, do not repeat the announcement and do "
            "not introduce yourself again.)"
        )

    def close_cue(self, line: str) -> str:
        return f'(System: close the call now. Say exactly this, and nothing else: "{line}" Then call end_call.)'

    def budget_note(self) -> str | None:
        if self.questions_after_verification >= 2:
            return (
                "(System note: you have used your question limit for this call. Do not "
                "ask the parent any more questions; answer theirs and close when done.)"
            )
        return None

    # ---- post-call ----------------------------------------------------------------

    def data_collection_fields(self) -> dict[str, dict[str, Any]]:
        dc = {**self.workflow["data_collection"], **SAMPARK_FIELDS}
        names = ("good_time_to_talk", *PURPOSE_FIELDS.get(self.purpose, ()), *SAMPARK_FIELDS)
        return {n: dc[n] for n in names if n in dc}

    def state_answers(self) -> dict[str, str]:
        """Answers the state machine KNOWS (they override the extractor's guesses)."""
        out: dict[str, str] = {}
        # Never the extractor's guess: an answer the bridge heard, or "yes" when the
        # parent went on to talk (verified or engaged in a callback), else no_answer.
        if self.good_time_to_talk in ("yes", "no"):
            out["good_time_to_talk"] = self.good_time_to_talk
        elif self.identity_state == "confirmed":
            out["good_time_to_talk"] = "yes"
        else:
            out["good_time_to_talk"] = "no_answer"
        if self.identity_state == "confirmed":
            out["recipient_confirmed"] = "yes"
        elif self.identity_state == "denied":
            out["recipient_confirmed"] = "no"
        if self.stop_requested:
            out["stop_requested"] = "yes"
        if self.callback_state == "confirmed" and self.callback_when():
            out.setdefault("callback_requested_time", self.callback_when())
        return out

    def record(self) -> dict[str, Any]:
        return {
            "node": self.node.get("label"),
            "route": self.route.label,
            "routeExcluded": self.route.excluded,
            "stage": self.stage.value,
            "goodTimeToTalk": self.good_time_to_talk,
            "identity": self.identity_state,
            "closeBranch": self.close_branch or None,
            "questionsAfterVerification": self.questions_after_verification,
            "reprompts": self.reprompts,
            "endCallDeclined": self.end_call_declined,
            "skipTurns": self.skip_turns,
            "callback": {"state": self.callback_state, "when": self.callback_when()} if self.callback_state else None,
            "events": self.events[-60:],
        }
