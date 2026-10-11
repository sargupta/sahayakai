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
    "LINES",
    "VERIFIED_CUE",
    "line",
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
    "(The parent has just answered. A recording has already said this is an "
    "important message from their child's school, but it did NOT say who is "
    "calling. So do not say namaste again, and do NOT deliver the teacher's "
    "message yet: you do not have it, and you will be given it only after the "
    "system has verified the caller. In one or two short sentences: name the "
    "school, name the teacher, say you are calling on that teacher's behalf, and "
    "ask them to tell you their child's name. Never say a child's name yourself. "
    "Then stop and wait.)"
)

#: Used only when no recording could be played, so the model must greet.
KICKOFF_NO_OPENER = (
    "(The parent has just answered and has heard nothing yet. Greet them warmly, say "
    "this is an important message from their child's school, name the school and "
    "the teacher you are calling for, and ask them to tell you their child's name. "
    "Do NOT deliver any message and never say a child's name yourself: the system "
    "gives you the message only after it has verified the caller. Do not use any "
    "assistant or product name. Then stop and listen.)"
)

#: Sent to an engine that cannot take a new system instruction (Gemini Live)
#: once the bridge has verified the caller. The child's context follows it.
VERIFIED_CUE = (
    "(The system has verified that you are speaking with the child's parent. The "
    "child's details and the teacher's message follow. Deliver the teacher's "
    "message now, ESSENTIALLY AS WRITTEN, then invite their questions.)"
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


#: Every character that can be part of an Indic word: the letters themselves
#: plus the combining marks that attach to them.
_INDIC = r"\u0900-\u0DFF"


def indic_word(word: str) -> str:
    r"""A standalone-word match that actually works in Indic scripts.

    `\b` cannot be used here. Python's `\w` is defined by `str.isalnum()`, and
    Devanagari vowel signs are combining marks — `'ा'.isalnum()` is False — so
    the regex engine sees a word boundary in the MIDDLE of a word. The Marathi
    question word `का\b` therefore matched inside `नमस्कार`, and a parent saying
    "namaskar" as a farewell was read as asking a question, which vetoed the
    goodbye and kept them on the phone.

    Guarding on "no Indic letter or mark either side" gives the boundary
    `\b` is supposed to give.
    """
    return rf"(?<![{_INDIC}]){word}(?![{_INDIC}])"


def _compile(*parts: str) -> re.Pattern[str]:
    return re.compile("|".join(parts), re.IGNORECASE)


# Goodbye, across the languages this app calls in plus the English and Hindi
# that every caller code-mixes. Deliberately specific: a false positive hangs up
# on a parent mid-sentence, which is far worse than missing one goodbye and
# letting the conversation run its course.
_GOODBYE = _compile(
    r"\b(bye|good ?bye|thank you|thanks|see you)\b",
    # The recogniser returns speech transliterated into the hinted script, so an
    # English goodbye on a Hindi-hinted call arrives in Devanagari. Without
    # these the phrase is invisible: a live call ended with "थैंक यू सो मच।
    # नमस्कार।" and nothing matched, so the school asked another question.
    r"(थैंक\s*यू|थैंक्स|बा[यी]\b|गुड\s*बाय|ओके\s*बाय)",
    # Namaskar/namaste is a greeting AND a farewell. Only ever reached here
    # after the minimum-turns guard, by which point it is a farewell.
    r"(नमस्कार|नमस्ते)",
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
    r"(কীভাবে|কখন|কোথায়|কেন)|" + indic_word("কি"),
    r"(काय|कसं|कधी|कुठे)|" + indic_word("का"),
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


# ---- fixed lines the bridge speaks itself (no model) ------------------------------
#
# Spoken verbatim by an engine that can (the cascade's `say`), so that the
# identity check, the teacher's message, its repeats and every goodbye are the
# same words every time and can never carry anything the gate has not allowed.
# None of the identity lines names a child: the caller must name them.

LINES: dict[str, dict[str, str]] = {
    "English": {
        "identity_first": (
            "I'm calling from {school} on behalf of {teacher}.{ai} Before I share the "
            "teacher's message, could you please tell me your child's name?"
        ),
        "identity_retry": "Sorry, I didn't catch that. Could you please tell me your child's name?",
        "identity_name_please": "Thank you. Could you please tell me your child's name?",
        "identity_who": (
            "I'm calling from {school} on behalf of {teacher}.{ai} The teacher has a message "
            "for a student's parent. Could you please tell me your child's name?"
        ),
        "ai": " I'm an automated assistant.",
        "deliver_lead": "Thank you.",
        "deliver_invite": "Do you have any questions about this?",
        "wait_prompt": "Take your time, I'm listening.",
        "follow_up": "Is there anything else you'd like to ask?",
        "close_goodbye": (
            "Thank you for your time. We are partners in your child's success. Goodbye."
        ),
        "close_busy": "No problem. The school will call you at a better time. Thank you, goodbye.",
        "close_opt_out": (
            "Understood. I've noted that you don't want these calls. Thank you, goodbye."
        ),
        "close_wrong_person": "Sorry to have disturbed you. Thank you, goodbye.",
        "close_unverified": (
            "I'm sorry, I couldn't confirm that, so I can't share the message on this call. "
            "The school will contact you another way. Thank you, goodbye."
        ),
        "close_silence": (
            "I'll let you go now. The teacher will follow up with you. Thank you, goodbye."
        ),
    },
    "Hindi": {
        "identity_first": (
            "मैं {school} से {teacher} की ओर से बोल रही हूँ।{ai} संदेश बताने से पहले, "
            "क्या आप अपने बच्चे का नाम बता सकते हैं?"
        ),
        "identity_retry": "माफ़ कीजिए, मैं सुन नहीं पाई। क्या आप अपने बच्चे का नाम बता सकते हैं?",
        "identity_name_please": "धन्यवाद। क्या आप अपने बच्चे का नाम बता सकते हैं?",
        "identity_who": (
            "मैं {school} से {teacher} की ओर से बोल रही हूँ।{ai} टीचर का एक संदेश है। "
            "क्या आप अपने बच्चे का नाम बता सकते हैं?"
        ),
        "ai": " मैं एक ऑटोमेटेड असिस्टेंट हूँ।",
        "deliver_lead": "धन्यवाद।",
        "deliver_invite": "क्या आप इस बारे में कुछ पूछना चाहेंगे?",
        "wait_prompt": "कोई बात नहीं, आराम से बोलिए, मैं सुन रही हूँ।",
        "follow_up": "क्या आप कुछ और पूछना चाहेंगे?",
        "close_goodbye": "आपके समय के लिए धन्यवाद। हम आपके बच्चे की प्रगति में आपके साथी हैं। नमस्कार।",
        "close_busy": "कोई बात नहीं। स्कूल आपको किसी और समय फ़ोन करेगा। धन्यवाद, नमस्कार।",
        "close_opt_out": "ठीक है, मैंने नोट कर लिया है कि आप ये कॉल नहीं चाहते। धन्यवाद, नमस्कार।",
        "close_wrong_person": "परेशानी के लिए माफ़ कीजिए। धन्यवाद, नमस्कार।",
        "close_unverified": (
            "माफ़ कीजिए, मैं पुष्टि नहीं कर पाई, इसलिए इस कॉल पर संदेश नहीं बता सकती। "
            "स्कूल आपसे दूसरे तरीके से संपर्क करेगा। धन्यवाद, नमस्कार।"
        ),
        "close_silence": "मैं अब कॉल रखती हूँ। टीचर आपसे बात करेंगे। धन्यवाद, नमस्कार।",
    },
}


def line(key: str, language: str, *, school: str = "", teacher: str = "", ai: bool = True) -> str:
    """A fixed line in the call's current language (English if not available)."""
    table = LINES.get(language) or LINES["English"]
    template = table.get(key) or LINES["English"][key]
    return template.format(
        school=school or "your child's school",
        teacher=teacher or "the class teacher",
        ai=table["ai"] if ai else "",
    )
