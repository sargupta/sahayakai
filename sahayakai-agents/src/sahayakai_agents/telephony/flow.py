"""Conversation flow: the cues that give a call a shape, and when to end it.

WHY A CALL NEEDS THIS AT ALL

A system instruction tells the model how to behave; it does not tell it WHEN to
do anything. Left alone, a Live session simply waits. The first version of this
route had exactly one injected turn — "the parent answered, greet them" — and
nothing after it, so the call had no structure: if the parent said nothing,
VIDYA sat in silence; if the parent said goodbye, VIDYA neither closed nor hung
up, and the line stayed open until the idle timeout killed it. From the parent's
side that is a call that starts oddly and then dies for no reason.

The fix, taken from the Suraksha agent's flow, is to DRIVE the model with short
director turns at the moments that matter. They are instructions to the model,
never speech: the model renders them in the parent's language, in its own words.

They are written in English on purpose. They are stage directions, not dialogue,
and keeping them in one language keeps them reviewable — the model is already
told, at length, which language to actually speak.
"""

from __future__ import annotations

import re

#: Nobody answered the invitation to speak. The shipped Twilio flow says the
#: message has been delivered and the school will try again — the same words are
#: right here, because a parent who stayed silent has still HEARD the message.
NO_RESPONSE_CLOSE = (
    "(The parent has not spoken at all. Warmly say the teacher's message has been "
    "delivered, that the school will try again if needed, and thank them. Then say "
    "nothing further at all.)"
)

__all__ = [
    "NO_RESPONSE_CLOSE",
    "KICKOFF_AFTER_OPENER",
    "KICKOFF_NO_OPENER",
    "POST_OPENER_NUDGE",
    "SILENCE_NUDGE",
    "CLOSE",
    "OPTOUT_CLOSE",
    "is_goodbye",
    "is_optout",
]

#: Fired once the parent responds to the recorded greeting's "do you have a
#: minute?". The recording asked permission but did not say why we called, so
#: this is where the call actually begins.
KICKOFF_AFTER_OPENER = (
    "(The parent has just answered and has already heard the recorded line telling "
    "them this is an important message from their child's school. Do NOT greet them "
    "again and do NOT repeat that line. React briefly to anything they said, then "
    "give the teacher's message warmly in your own words, naming the child, and "
    "invite them to ask or share anything. Three or four short sentences, then stop "
    "and listen.)"
)

#: Used only when no recording could be played, so the model must greet.
KICKOFF_NO_OPENER = (
    "(The parent has just answered and has heard nothing yet. Greet them warmly, say "
    "this is an important message from their child's school, then give the teacher's "
    "message in your own words naming the child, and invite them to ask or share "
    "anything. Do not use any assistant or product name. Then stop and listen.)"
)

#: The parent has not spoken since the greeting. Never assume consent — check in.
POST_OPENER_NUDGE = (
    "(The parent has not spoken since you invited them to. Warmly encourage them to "
    "go ahead, the way the shipped prompt does — 'please go ahead, I am listening'. "
    "Do not mention the silence and do not repeat the message. One short sentence, "
    "then stop.)"
)

#: A lull mid-conversation.
SILENCE_NUDGE = (
    "(The parent has gone quiet for a while. Gently ask if they have any question "
    "about what you said, or if they would like the teacher to call them. Do not "
    "repeat anything you have already said and do not mention the silence. One short "
    "sentence, then stop.)"
)

#: The parent signalled they are finished.
CLOSE = (
    "(The parent is signing off. Give ONE short, warm closing line in the spirit of "
    "the school's own words: thank them for their time, and say the school is "
    "partners with them in their child's success. Then say nothing further at all.)"
)

#: The parent asked not to be called again. Acknowledge, never argue.
OPTOUT_CLOSE = (
    "(The parent has asked not to be called again. Warmly acknowledge it in ONE "
    "sentence, tell them it has been noted and the school will contact them another "
    "way, and thank them. Do not ask why and do not try to continue. Then say nothing "
    "further at all.)"
)


def _compile(*parts: str) -> re.Pattern[str]:
    return re.compile("|".join(parts), re.IGNORECASE)


# Goodbye, across the languages this app calls in plus the English and Hindi
# that every caller code-mixes. Deliberately specific: a false positive hangs up
# on a parent mid-sentence, which is far worse than missing one goodbye and
# letting the conversation run its course.
_GOODBYE = _compile(
    r"\b(bye|good ?bye|thank you|thanks|see you)\b",
    r"(धन्यवाद|शुक्रिया|अलविदा|रखता हूँ|रखती हूँ|ठीक है ठीक है)",
    r"(ধন্যবাদ|রাখছি|রাখি|আসি|চলি|বিদায়)",
    r"(धन्यवाद|ठेवते|ठेवतो|येतो|येते)",
    r"(આભાર|રાખું છું|આવજો)",
    r"(ਧੰਨਵਾਦ|ਰੱਖਦਾ|ਸਤ ਸ੍ਰੀ ਅਕਾਲ ਜੀ)",
    r"(ಧನ್ಯವಾದ|ಇಡ್ತೀನಿ|ಬರ್ತೀನಿ)",
    r"(நன்றி|வைக்கிறேன்|போய்ட்டு வர)",
    r"(ధన్యవాదాలు|పెడుతున్నాను|వస్తాను)",
    r"(നന്ദി|വെക്കുന്നു|പിന്നെ കാണാം)",
    r"(ଧନ୍ୟବାଦ|ରଖୁଛି)",
)

# Do-not-call. Takes priority over everything else, including a question.
_OPTOUT = _compile(
    r"(do ?n[o']?t call|don'?t call|stop calling|remove my number|unsubscribe|no more calls)",
    r"(फोन मत कर|कॉल मत कर|मत बुलाओ|परेशान मत|नंबर हटा)",
    r"(ফোন কর(বেন না|ো না)|কল কর(বেন না|ো না)|বিরক্ত কর|নাম্বার (বাদ|মুছ))",
    r"(फोन करू नका|कॉल करू नका|त्रास देऊ नका)",
    r"(ફોન ન કરો|કૉલ ન કરો)",
    r"(ਫ਼ੋਨ ਨਾ ਕਰੋ|ਕਾਲ ਨਾ ਕਰੋ)",
    r"(ಫೋನ್ ಮಾಡಬೇಡಿ|ಕರೆ ಮಾಡಬೇಡಿ)",
    r"(போன் பண்ணாதீங்க|கூப்பிடாதீங்க)",
    r"(ఫోన్ చేయవద్దు|కాల్ చేయవద్దు)",
    r"(വിളിക്കരുത്|ഫോൺ ചെയ്യരുത്)",
    r"(ଫୋନ୍ କରନ୍ତୁ ନାହିଁ)",
)

# A "thank you" attached to a question is gratitude, not a goodbye. Hanging up
# on it is the single rudest thing this call can do, so a question mark or an
# explicit question word vetoes the goodbye.
_QUESTION = _compile(
    r"\?",
    r"\b(what|why|when|how|where|can you|could you|is it|are you|will you)\b",
    r"(क्या|कैसे|कब|कहाँ|क्यों)",
    r"(কি\b|কীভাবে|কখন|কোথায়|কেন)",
    r"(काय|कसं|कधी|कुठे|का\b)",
    r"(શું|કેવી રીતે|ક્યારે)",
    r"(ਕੀ\b|ਕਿਵੇਂ|ਕਦੋਂ)",
    r"(ಏನು|ಹೇಗೆ|ಯಾವಾಗ)",
    r"(என்ன|எப்படி|எப்போது)",
    r"(ఏమిటి|ఎలా|ఎప్పుడు)",
    r"(എന്ത്|എങ്ങനെ|എപ്പോൾ)",
    r"(କଣ|କିପରି|କେବେ)",
)


def is_optout(text: str | None) -> bool:
    """Has the parent asked not to be called again?"""
    return bool(text and _OPTOUT.search(text))


def is_goodbye(text: str | None) -> bool:
    """Is the parent signing off?

    A goodbye phrase inside a question is NOT a goodbye. "Thank you, but when is
    the parent-teacher meeting?" ends with a question that deserves an answer;
    treating it as a hang-up cue would cut the parent off mid-thought.
    """
    if not text:
        return False
    if _QUESTION.search(text):
        return False
    return bool(_GOODBYE.search(text))
