"""
Do-not-call: noticing that a parent would prefer not to be called, and telling
the teacher. The engine never blocks a number.

A parent's "please don't call me again" is RECORDED, never enforced, here:

  StopListener          runs on every final transcription of the PARENT's
                        speech, before the model sees it. A possible stop
                        (is_stop_request, tuned for recall) is noticed once per
                        call: bot.py records it on the outreach, says one fixed,
                        honest line ("I will let the class teacher know you
                        would prefer not to receive these calls") and closes
                        the call politely.
  backstop_quote        after the call, the post-call analysis may find a stop
                        the phrase check missed. It is recorded the same way,
                        only on the parent's own quoted words.
  record_opt_out_request
                        the only write: `optOutRequested: {quote, at, source}`
                        on parent_outreach/{id}, source "live" or "analysis".
  opt_out_note          the note that leads the teacher's call summary.

WHY THE ENGINE DOES NOT WRITE call_suppressions
A suppression silently stops every future call to that number and nothing on
the web side lifts it. Independent review (rereview-0b #1, #2, #3, #6) showed a
spoken yes/no confirmation cannot be trusted with that: "yes, call me", "yes,
tomorrow evening", a backchannel or a bystander's "haan" all confirmed, while
"yes, please don't call" did not. So the decision stays with the teacher, who
sees the parent's own words. `persist_opt_out` and the digest
(`phone_suppression_id`, `suppression_record`) are kept, unused, for a later
designed feature; tests/test_opt_out_never_suppresses.py fails if any engine
code path reaches them.

WHY A DETERMINISTIC DETECTOR, NOT A MODEL TOOL
Missed stops are the failure that matters: a parent who said "do not call me"
and is called again without the teacher knowing. The model here is capped at
40 tokens and one sentence, and its output is cut and filtered by CallManager,
so a tool call or marker from it would be the least reliable signal in the
pipeline. A phrase check on the parent's own words runs on every utterance
whether or not the model behaves, and the post-call backstop catches
paraphrases the list does not know. A false hit costs one honest sentence and a
note the teacher can read and dismiss; it never silences a parent.
"""

from __future__ import annotations

import enum
import hashlib
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Mapping, Sequence

from src.stt_noise import drop_reason

SUPPRESSION_COLLECTION = "call_suppressions"
OUTREACH_COLLECTION = "parent_outreach"
OPT_OUT_REASON = "opt_out"


# ── The shared key ───────────────────────────────────────────────────────────


def phone_suppression_id(e164: str) -> str:
    """sha256 hex of the trimmed E.164 number — identical to the web app's phoneSuppressionId."""
    return hashlib.sha256(e164.strip().encode("utf-8")).hexdigest()


def utc_now_iso() -> str:
    """Same timestamp shape as the agents bridge (ISO 8601, Z suffix)."""
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def suppression_record(outreach: Mapping[str, Any], outreach_id: str, now: str) -> dict[str, Any]:
    """The call_suppressions document. Never contains the phone number itself."""
    return {
        "teacherUid": outreach.get("teacherUid"),
        "classId": outreach.get("classId"),
        "studentId": outreach.get("studentId"),
        "outreachId": outreach_id,
        "reason": OPT_OUT_REASON,
        "createdAt": now,
    }


@dataclass(frozen=True)
class OptOutWrite:
    ok: bool
    detail: str


async def persist_opt_out(
    db: Any, outreach_id: str, *, now: str | None = None, quote: str | None = None,
) -> OptOutWrite:
    """Write call_suppressions/{sha256(phone)} for this outreach's parent.

    UNUSED ON PURPOSE: no engine code path may call this (see the module
    docstring and tests/test_opt_out_never_suppresses.py). It is kept, with
    its tests and the shared digest fixture, for a later designed feature.

    `db` is a google.cloud.firestore.AsyncClient (or a fake with the same
    shape). The phone comes from the outreach record itself, the source of
    truth, not from whatever context the call was started with.

    The suppression is written FIRST: it is the record that stops the next
    dial. The `optedOut` flag on the outreach doc is best effort after it.
    Never raises; `ok` is True only when the suppression record was written.
    The detail never contains the phone number.
    """
    now = now or utc_now_iso()
    try:
        ref = db.collection(OUTREACH_COLLECTION).document(outreach_id)
        snap = await ref.get()
        data = (snap.to_dict() if snap.exists else None) or {}
        phone = data.get("parentPhone")
        if not isinstance(phone, str) or not phone.strip():
            return OptOutWrite(False, f"{OUTREACH_COLLECTION}/{outreach_id} has no parentPhone")
        await db.collection(SUPPRESSION_COLLECTION).document(phone_suppression_id(phone)).set(
            suppression_record(data, outreach_id, now)
        )
    except Exception as exc:  # noqa: BLE001 — a lost write is reported, never raised into the call
        return OptOutWrite(False, f"suppression write failed for {outreach_id}: {type(exc).__name__}: {exc}")

    try:
        flag = {"optedOut": True, "optedOutAt": now, "updatedAt": now, "optOutSource": "parent_speech"}
        if quote:
            flag["optOutQuote"] = quote[:500]  # the parent's own words, for the teacher
        await ref.update(flag)
    except Exception as exc:  # noqa: BLE001
        return OptOutWrite(True, f"suppression saved; outreach flag not set: {type(exc).__name__}")
    return OptOutWrite(True, "suppression saved")


# ── Noticing a possible stop request in the parent's speech ──────────────────
#
# The phrase check favours recall: a false hit costs one honest sentence and a
# note the teacher can dismiss; a miss costs a parent who said "do not call me"
# being called again without the teacher knowing.

# Every letter or combining mark of the Indic scripts this engine speaks.
_INDIC = "ऀ-෿"


def _word(word: str) -> str:
    r"""Standalone word in an Indic script (`\b` breaks on combining marks)."""
    return rf"(?<![{_INDIC}])(?:{word})(?![{_INDIC}])"


def _starts(word: str) -> str:
    """Word start in an agglutinative script (Dravidian suffixes attach to it)."""
    return rf"(?<![{_INDIC}])(?:{word})"


def _compile(*parts: str) -> re.Pattern[str]:
    return re.compile("|".join(f"(?:{p})" for p in parts), re.IGNORECASE)


_END = rf"(?![{_INDIC}])"  # the verb ends here ("करें" must not match "करेंगे")

_HI_CALL = r"(?:फ़ोन|फोन|कॉल|काल)"
_HI_VERB = rf"(?:करना|करो|कीजिएगा|कीजिए|कीजिये|करें|करिएगा|करियेगा|करिए|करिये|किया\s*करो){_END}"
_HI_DONT = rf"(?:मत|ना|न|नहीं)\s*{_HI_VERB}"
_HI_AGAIN = r"(?:दोबारा|दुबारा|फिर\s*से|फिर\s*कभी|कभी\s*भी|कभी|आगे\s*से|अब\s*से)"
_HI_CALLS = rf"{_HI_CALL}(?:्स|ें|े)?"  # कॉल्स, कॉलें: plural "calls"
_HI_STOP_VERB = r"(?:करो|कीजिए|कीजिये|करें|करिए|कर\s*दो|कर\s*दीजिए)"
# "बंद करो ये कॉल्स", "ये कॉल्स बंद करो": stop THESE calls. Not "फ़ोन बंद
# करो", "बंद करो ये फ़ोन" or "बंद करो ये कॉल" (hang up / end this call): the
# calls must be plural.
_HI_STOP_THESE_CALLS = (
    rf"(?:बंद\s*{_HI_STOP_VERB}\s*(?:ये|यह|इन|ऐसे)\s*(?:(?:फ़ोन|फोन)\s*)?(?:कॉल|काल)(?:्स|ें)"  # plural only: "बंद करो ये (फ़ोन) कॉल" is "end this call"
    rf"|(?:ये|यह|इन|ऐसे)\s*{_HI_CALL}(?:्स|ें)\s*बंद\s*{_HI_STOP_VERB})"
)
_BN_CALL = r"(?:ফোন|কল)"
_BN_DONT = r"(?:করবেন|কোরো|করো|করিস|দিবেন|দেবেন|দিও|দিয়ো|দিস)\s*না"
_MR_CALL = r"(?:फोन|फ़ोन|कॉल)"
_MR_DONT = r"(?:(?:करू|करु)\s*(?:नका|नकोस|नको)|(?:नका|नकोस|नको)\s*(?:करू|करु))"
_GU_CALL = r"(?:ફોન|કૉલ|કોલ)"
_GU_VERB = r"(?:કરો|કરશો|કરતા|કરજો)"
_GU_DONT = rf"(?:(?:ન|ના|નહીં|નહિ)\s*{_GU_VERB}|{_GU_VERB}\s*(?:નહીં|નહિ|ના))"
_PA_CALL = "(?:ਫ਼ੋਨ|ਫ਼ੋਨ|ਫੋਨ|ਕਾਲ)"  # ਫ਼ੋਨ (both forms), ਫੋਨ, ਕਾਲ
_PA_VERB = r"(?:ਕਰਿਆ\s*ਕਰੋ|ਕਰੋ|ਕਰਿਓ|ਕਰਨਾ)"
_PA_DONT = rf"(?:(?:ਨਾ|ਨ|ਨਹੀਂ)\s*{_PA_VERB}|{_PA_VERB}\s*(?:ਨਹੀਂ|ਨਾ))"
_KN_CALL = r"(?:ಫೋನ್|ಕರೆ|ಕಾಲ್)"
_KN_DONT = r"(?:ಮಾಡಬೇಡಿ|ಮಾಡ್ಬೇಡಿ|ಮಾಡಬೇಡ|ಮಾಡ್ಬೇಡ)"
_TA_CALL = r"(?:போன்|ஃபோன்|கால்)"
_TA_DONT = r"(?:பண்ணாதீங்க|பண்ணாதீர்கள்|பண்ணாதே|பண்ண\s*வேண்டாம்|செய்ய\s*வேண்டாம்)"
_TA_CALLVERB = r"(?:கூப்பிடாதீங்க|கூப்பிடாதீர்கள்|கூப்பிட\s*வேண்டாம்|அழைக்க\s*வேண்டாம்|அழைக்காதீர்கள்)"
_TE_CALL = r"(?:ఫోన్|కాల్)"
_TE_DONT = r"(?:చేయవద్దు|చేయకండి|చెయ్యకండి|చేయొద్దు|చెయ్యొద్దు|చెయ్యద్దు|చేయద్దు)"
_ML_DONT = (
    r"(?:വിളിക്കരുത്|വിളിക്കേണ്ട|വിളിക്കണ്ട|വിളിക്കല്ലേ|"
    r"(?:ഫോൺ|കോൾ)\s*(?:ചെയ്യരുത്|ചെയ്യേണ്ട|ചെയ്യണ്ട|ചെയ്യല്ലേ))"
)

# Phrases that mean "stop calling this number" whatever else is said.
_UNAMBIGUOUS = _compile(
    r"\bunsubscribe\b",
    r"\b(?:remove|delete|take off|take out|block) (?:my|this|our) (?:number|phone number|mobile number|mobile)\b",
    r"\btake (?:me|us|my number|this number) off\b",
    r"\bremove (?:me|us|my name|our name) from (?:your|the) (?:list|calling list|call list|contact list)\b",
    r"(?:नाम|नंबर|नम्बर)\s*.{0,8}लिस्ट\s*से\s*(?:हटा|निकाल)",
    r"\bnumber\b.{0,6}\b(?:hata|hatao|hataiye|hata do|delete)\b",
    r"(?:नंबर|नम्बर)\s*.{0,8}(?:हटा|डिलीट|काट\s*द)",
    r"(?:নাম্বার|নম্বর)\s*.{0,6}(?:বাদ|মুছ|কেটে)",
    r"નંબર\s*.{0,6}(?:કાઢી\s*નાખો|ડિલીટ|હટાવો)",
    r"ਨੰਬਰ\s*.{0,6}(?:ਹਟਾ|ਕੱਟ|ਡਿਲੀਟ)",
    r"ನಂಬರ್\s*.{0,6}(?:ತೆಗೆದು|ಡಿಲೀಟ್)",
    r"(?:நம்பர்|நம்பரை|எண்ணை)\s*.{0,6}(?:நீக்க|எடுத்து|டிலீட்)",
    r"నంబర్\s*.{0,6}(?:తీసేయండి|తొలగించండి|డిలీట్)",
    r"നമ്പർ\s*.{0,6}(?:മാറ്റ|നീക്ക|ഡിലീറ്റ്)",
)

# "Delete the old number, write down the new one": a change of number.
_NUMBER_CHANGE = _compile(
    r"\b(?:new|other|another|different|second) number\b",
    r"\b(?:naya|nayi|dusra|dusre|doosra|doosre) number\b",
    r"(?:नया|नए|नई|दूसरा|दूसरे|दूसरी)\s*(?:नंबर|नम्बर)",
    r"(?:নতুন|অন্য)\s*(?:নাম্বার|নম্বর)",
    r"(?:नवा|दुसरा|दुसऱ्या)\s*नंबर",
)

# Ways to say "don't call (me) (again)". Only counted when the utterance has no
# rescheduling, third-party or redirection cue (_NOT_A_STOP).
_STOP_PHRASES = _compile(
    # English
    r"\bstop (?:calling|phoning|ringing|these calls|the calls|your calls)\b",
    r"\bno more (?:phone )?calls\b",
    r"^(?:please )?never (?:ever )?(?:call|phone|ring) (?:me|us|this number)\b",
    r"\b(?:do not|don't|dont) (?:ever )?(?:call|phone|ring|contact)\b",
    r"\bnot to (?:call|phone|ring|contact) (?:me|us|this number)\b",
    r"\bnever (?:ever )?(?:call|phone|ring|contact)(?: me| us| this number)?\b",
    r"\b(?:i|we) (?:do not|don't|dont) want to (?:talk|speak) (?:to|with) (?:the school|you|the teacher|anyone)\b",
    r"\b(?:do not|don't|dont|stop) keep(?:ing)? (?:calling|phoning|ringing)\b",
    r"\b(?:i|we) (?:do not|don't|dont) want (?:any )?(?:more )?(?:these |your |such |any )?(?:phone )?calls\b",
    r"\b(?:i|we) (?:do not|don't|dont) want (?:you|the school|anyone) (?:to (?:call|phone|ring)|calling|phoning)\b",
    r"\b(?:i|we) (?:do not|don't|dont) want to (?:receive|get|have) (?:any )?(?:more )?(?:phone )?calls\b",
    r"\b(?:do not|don't|dont) want to be (?:called|contacted)\b",
    r"\b(?:do not|don't|dont) (?:disturb|bother) (?:me|us)\b",
    # Hinglish (romanised Hindi). "mat", or "na/nahi" directly before the
    # verb; a trailing Hinglish "na" tag ("call karna na") is an invitation.
    r"\b(?:phone|fone|call)\s*(?:mat\s*(?:karo|karna|kijiye|kijie|kariye|karein|kiya karo)|"
    r"(?:na|nahi|nahin)\s*(?:karo|karna|kijiye|kariye|karein))\b",
    r"\b(?:phone|fone|call)\s*karna\s*band\s*(?:karo|kijiye|kariye|kar do|kar dijiye)\b",
    r"\b(?:mujhe|humein|hume|hamein|mujhko)\s*(?:\S+\s+)?(?:call|calls|phone)\s*(?:nahi|nahin)\s*(?:chahiye|chahie)\b",
    # Hindi (also with the English word "call": "मुझे call मत करो")
    rf"{_HI_CALL}\s*{_HI_DONT}",
    rf"\b(?:call|phone)\s*{_HI_DONT}",
    rf"{_HI_CALL}\s*(?:करने|करना)\s*की\s*(?:ज़रूरत|जरूरत|आवश्यकता)\s*नहीं",
    # "फ़ोन, दोबारा मत करना": the call word, then "don't (do it) again"
    rf"{_HI_CALL}\s*(?:दोबारा|दुबारा|फिर\s*से|फिर\s*कभी|आगे\s*से)\s*{_HI_DONT}",
    rf"{_HI_CALL}\s*करना\s*बंद\s*(?:करो|कीजिए|करें|कर\s*दो|कर\s*दीजिए|करिए)",
    r"(?:स्टॉप|स्टाप)\s*(?:कॉलिंग|कालिंग)",
    rf"(?:हमें|मुझे)\s*.{{0,10}}{_HI_CALLS}\s*(?:नहीं\s*चाहिए|नहीं\s*चाहिये)",
    _HI_STOP_THESE_CALLS,
    r"डोंट\s*(?:कॉल|काल)",
    r"नो\s*मोर\s*(?:कॉल्स|कॉल|काल्स|कॉलें)",  # English said on a Hindi call, as Sarvam writes it
    r"परेशान\s*(?:मत|ना)\s*(?:करो|कीजिए|करें|करिए)",
    # Bengali
    rf"{_BN_CALL}\s*{_BN_DONT}",
    rf"{_BN_CALL}\s*করা\s*বন্ধ\s*(?:করুন|করো|করবেন)",
    rf"{_BN_CALL}\s*(?:করার|দেওয়ার)\s*(?:দরকার|প্রয়োজন)\s*নেই",
    rf"বিরক্ত\s*{_BN_DONT}",
    # Marathi
    rf"{_MR_CALL}\s*{_MR_DONT}",
    rf"{_MR_CALL}\s*(?:करणं|करणे)\s*बंद\s*(?:करा|कर)",
    r"त्रास\s*(?:देऊ|देउ)\s*(?:नका|नकोस)",
    rf"(?:असे|असले|हे)\s*{_MR_CALL}\s*(?:नकोत|नको)",
    # Gujarati, Punjabi, Kannada, Tamil, Telugu, Malayalam, Odia
    rf"{_GU_CALL}\s*{_GU_DONT}",
    rf"{_GU_CALL}\s*કરવાની\s*(?:જરૂર|જરુર)\s*નથી",
    rf"{_PA_CALL}\s*{_PA_DONT}",
    rf"{_KN_CALL}\s*{_KN_DONT}",
    rf"{_TA_CALL}\s*{_TA_DONT}",
    _TA_CALLVERB,
    rf"{_TE_CALL}\s*{_TE_DONT}",
    _ML_DONT,
    r"ଫୋନ୍\s*କରନ୍ତୁ\s*ନାହିଁ",
)

# In the same utterance, these make "don't call" mean something else: a time
# limit ("not now", "before 10", "today"), someone else ("my husband",
# "उनको", "স্বামীকে"), or a redirection ("I'll come myself", "I'll call you").
_TIME_PARTS = (
    r"\b(?:now|right now|at the moment|today|tonight|tomorrow|later|morning|afternoon|evening|night|"
    r"after|before|until|till|during|weekend|weekdays?|"
    r"o'?clock|\d{1,2}\s*(?:am|pm)|minutes?|hours?|next week|this week|exams?)\b",
    r"\b(?:abhi|baad|kal|shaam|subah|raat|dopahar|aaj|ghante|minute|baje)\b",
    r"\b(?:sundays?|mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|daytime|between)\b",
    _word(r"रविवार|संडे|सोमवार|मंगलवार|बुधवार|गुरुवार|शुक्रवार|शनिवार"),
    _word(r"রবিবার|সোমবার|মঙ্গলবার|বুধবার|বৃহস্পতিবার|শুক্রবার|শনিবার"),
    _word(r"रविवारी|सोमवारी|मंगळवारी|बुधवारी|गुरुवारी|शुक्रवारी|शनिवारी"),
    _word(r"अभी|बाद|कल|शाम|सुबह|रात|दोपहर|आज|घंटे|मिनट|बजे"),
    _word(r"आता|नंतर|उद्या|संध्याकाळी|सकाळी|रात्री|दुपारी"),
    _word(r"এখন|পরে|কাল|সন্ধ্যা|সন্ধ্যায়|সকাল|সকালে|রাতে|দুপুর|দুপুরে|আজ"),
    _word(r"અત્યારે|હમણાં|પછી|કાલે|સાંજે|સવારે|રાત્રે|બપોરે|આજે"),
    _word(r"ਹੁਣ|ਬਾਅਦ|ਕੱਲ੍ਹ|ਸ਼ਾਮ|ਸ਼ਾਮ|ਸਵੇਰੇ|ਰਾਤ|ਦੁਪਹਿਰ|ਅੱਜ"),
    _starts(r"ಈಗ|ಆಮೇಲೆ|ನಂತರ|ನಾಳೆ|ಸಂಜೆ|ಬೆಳಿಗ್ಗೆ|ರಾತ್ರಿ|ಮಧ್ಯಾಹ್ನ|ಇವತ್ತು"),
    _starts(r"இப்போ|இப்போது|அப்புறம்|பிறகு|நாளை|சாயங்காலம்|மாலை|காலை|ராத்திரி|இரவு|மதியம்|இன்னைக்கு|இன்று"),
    _starts(r"ఇప్పుడు|తర్వాత|తరువాత|రేపు|సాయంత్రం|పొద్దున|ఉదయం|రాత్రి|మధ్యాహ్నం|ఈరోజు"),
    _starts(r"ഇപ്പോൾ|പിന്നെ|പിന്നീട്|നാളെ|വൈകുന്നേരം|രാവിലെ|രാത്രി|ഉച്ചയ്ക്ക്|ഇന്ന്"),
    _word(r"ଏବେ|ପରେ|କାଲି"),
)
# Where or while ("at the office", "in a meeting", "while I'm driving",
# "ऑफिस में", "मीटिंग में"): a limit on WHEN not to call, so it vetoes even a
# strong stop ("don't call me at the office again").
_PLACE_PARTS = (
    r"\b(?:office|work|working|driving|meeting)\b",
    _word(r"ऑफिस|ऑफ़िस|दफ़्तर|दफ्तर|मीटिंग|ड्राइव|ड्राइविंग|काम\s*पर"),
    r"गाड़ी\s*चला",
    _word(r"ऑफिसमध्ये"),
    _word(r"অফিস|অফিসে|মিটিং|মিটিংয়ে"),
    r"গাড়ি\s*চালা",
    _word(r"ઓફિસ|ઓફિસમાં"),
)
# The one reason that is not a limit: "busy". It vetoes a plain "don't call"
# (usually "not now"), but not a strong stop ("stop calling me, I'm busy",
# "मुझे दोबारा फ़ोन मत करना, मैं व्यस्त रहता हूँ").
_REASON_PARTS = (
    r"\bbusy\b",
    _word(r"बिज़ी|बिजी|व्यस्त"),
    _word(r"कामात"),  # Marathi "busy (at work)": a reason, like व्यस्त
    _word(r"ব্যস্ত"),
    _word(r"વ્યસ્ત"),
    _word(r"ਬਿਜ਼ੀ|ਰੁੱਝਿਆ"),
    _starts(r"ಬ್ಯುಸಿ"),
    _starts(r"பிஸி"),
    _starts(r"బిజీ"),
    _starts(r"തിരക്ക്"),
)
# Someone else.
_PARTY_PARTS = (
    r"\b(?:him|her|them)\b",
    r"\b(?:my|your) (?:son|daughter|child|kid|husband|wife|father|mother|dad|mom|mum|brother|sister)\b",
    r"\b(?:uske|unke|iske|inke|mere|aapke)?\s*(?:papa|mummy|pati|husband|wife|bete|beti|bachche|bachcha|bhai|behen)\s*ko\b",
    r"\b(?:usko|unko|isko|inko|use|unhe|unhein)\b",
    _word(r"उसको|उसे|उनको|उन्हें|इनको|इन्हें|इसको|इसे"),
    rf"(?:^|\s)(?!मुझ|हम|आप)\S+\s+को\s*{_HI_CALL}",  # "<anyone but me/us/you> को फ़ोन …"
    _starts(r"(?:पति|पत्नी|पापा|पिताजी|पिता|मम्मी|माँ|मां|बेटे|बेटी|बच्चे|बच्चा|भाई|बहन|दादा|दादी|नाना|नानी)\s*को"),
    _word(r"ওকে|ওঁকে|তাকে|তাঁকে|ওনাকে|ওদের"),
    _starts(r"(?:স্বামী|বাবা|মা|ছেলে|মেয়ে|বাচ্চা|ভাই|বোন)কে"),  # word start: "আমাকে" (me) is not "মাকে"
)
_WEAK_PARTY_PARTS = (
    r"\b(?:his|their)\b",
    r"\bthe (?:child|kid|boy|girl|father|mother|parents?|husband|wife)\b",
    r"\b\w+'s (?:father|mother|dad|mom|mum|husband|wife|parents?)\b",
    r"\b(?:mother|father|brother|sister)-in-law\b",
    _word(r"सास|ससुर|मिस्टर|उसके|उनके|इसके|इनके"),
    _starts(r"(?:শাশুড়ি|শ্বশুর)কে"),
    _word(r"त्याला|तिला|त्यांना|त्याच्या|तिच्या|त्यांच्या|वडिलांना|आईला|बाबांना|मिस्टरांना|नवऱ्याला|बायकोला|सासूबाईंना"),
    _word(r"એને|એના|તેને|તેના|તેમને|પપ્પાને|મમ્મીને|પતિને|પત્નીને"),
    _word(r"ਉਹਨੂੰ|ਉਹਦੇ|ਉਸਨੂੰ|ਉਹਨਾਂ\s*ਨੂੰ") , r"(?:ਪਾਪਾ|ਮੰਮੀ|ਪਤੀ|ਪਤਨੀ)\s*ਨੂੰ",
    _starts(r"ಅಪ್ಪನಿಗೆ|ಅಮ್ಮನಿಗೆ|ಗಂಡನಿಗೆ|ಹೆಂಡತಿಗೆ|ಅವರಿಗೆ|ಅವನಿಗೆ|ಅವಳಿಗೆ|ಅವರ\s"),
    _starts(r"அப்பாவுக்கு|அம்மாவுக்கு|கணவருக்கு|மனைவிக்கு|அவருக்கு|அவங்களுக்கு|அவனுக்கு|அவளுக்கு|அவங்க\s"),
    _starts(r"నాన్నకి|నాన్నకు|అమ్మకి|అమ్మకు|ఆయనకి|ఆయనకు|వాళ్ళ\s|అతనికి|ఆమెకి"),
    _starts(r"അച്ഛനെ|അമ്മയെ|ഭർത്താവിനെ|ഭാര്യയെ|അവനെ|അവളെ|അവരെ|അവന്റെ|അവളുടെ"),
)
# Redirection: "I'll come myself", "I'll call you".
_REDIRECT_PARTS = (
    r"\bi(?:'ll| will) (?:call|phone|ring|come|visit|message|text)\b",
    r"\b(?:main|mai)\s*(?:khud|khudh)\b",
    r"मैं\s*(?:ख़ुद|खुद)",
    r"\bkhud\b",
    _word(r"ख़ुद|खुद"),
    r"আমি\s*নিজে",
)
_NOT_A_STOP = _compile(*_TIME_PARTS, *_PLACE_PARTS, *_REASON_PARTS, *_PARTY_PARTS, *_WEAK_PARTY_PARTS, *_REDIRECT_PARTS)
_LIMITS = _compile(*_TIME_PARTS, *_PLACE_PARTS, *_PARTY_PARTS, *_WEAK_PARTY_PARTS, *_REDIRECT_PARTS)

# What makes a stop STRONG: it fires at once, and only a limit in its own
# clause (time, place, someone else, redirection) stops it; "busy" never does.
_STRONG_PHRASES = _compile(
    r"\bstop (?:calling|phoning|ringing|these calls|the calls|your calls)\b",
    r"\bno more (?:phone )?calls\b",
    r"\b(?:i|we) (?:do not|don't|dont) want (?:any )?(?:more )?(?:these |your |such |any )?(?:phone )?calls\b",
    rf"(?:हमें|मुझे)\s*.{{0,10}}{_HI_CALLS}\s*(?:नहीं\s*चाहिए|नहीं\s*चाहिये)",
    _HI_STOP_THESE_CALLS,
    rf"{_HI_CALL}\s*करना\s*बंद",
    r"\b(?:don't|dont|do not|never)\s+ever\s+(?:call|phone|ring)\b",
    r"\b(?:don't|dont|do not|stop)\s+keep(?:ing)?\s+(?:calling|phoning|ringing)\b",
    r"\b(?:phir kabhi)\b",
    r"फिर\s*कभी",
    r"नो\s*मोर\s*(?:कॉल्स|कॉल|काल्स|कॉलें)",
    r"(?:स्टॉप|स्टाप)\s*(?:कॉलिंग|कालिंग)",
    r"\bnever (?:ever )?(?:call|phone|ring|contact)(?: me| us| this number)? again\b",
    r"\b(?:i|we) (?:do not|don't|dont) want to (?:talk|speak) (?:to|with) (?:the school|you|the teacher|anyone)\b",
    r"\b(?:mujhe|humein|hume|hamein|mujhko)\s*(?:\S+\s+)?(?:call|calls|phone)\s*(?:nahi|nahin)\s*(?:chahiye|chahie)\b",
    rf"(?:असे|असले|हे)\s*{_MR_CALL}\s*(?:नकोत|नको)",
)
# "Again / anymore" in the call language: a "don't call" said with one, NEXT
# to it, is strong (_next_to_a_repeat_word). This list is the post-call
# check's looser "any strong marker".
_REPEAT_WORDS = _compile(
    r"\b(?:again|anymore|any more)\b",
    r"\b(?:dobara|dubara|phir se|aage se|ab se)\b",
    r"(?:दोबारा|दुबारा|फिर\s*से|आगे\s*से|अब\s*से)",
    _word(r"আর|আবার"),
    _word(r"पुन्हा|परत"),
    _word(r"ફરીથી|ફરી"),
    _word(r"ਦੁਬਾਰਾ|ਫਿਰ"),
    _starts(r"ಮತ್ತೆ|ಇನ್ನು"),
    _starts(r"இனிமேல்|இனி|மறுபடியும்"),
    _starts(r"మళ్ళీ|ఇంకెప్పుడూ"),
    _starts(r"ഇനി|വീണ്ടും"),
)
_STRONG_STOP = _compile(_STRONG_PHRASES.pattern, _REPEAT_WORDS.pattern)

# "From now on", "after today": with a "don't call" they make it STRONG, and
# their own time words are not a limit (the model side's _PROMISE_MARKER,
# for the parent's words).
_FROM_NOW_ON_PARTS = (
    r"\b(?:from now on|from today|after today|after this|from this day)\b",
    r"फ्रॉम\s*नाउ\s*(?:ऑन|आन)",
    r"\b(?:ab se|aage se|aaj se|aaj ke baad|ab ke baad|iske baad)\b",
    r"(?:आज|अब|इस)\s*के\s*बाद", r"इसके\s*बाद", r"(?:अब|आगे|आज)\s*से",
    r"(?:এখন|আজ|এরপর)\s*থেকে",
    r"(?:आता|आज)\s*पासून", r"आतापासून|आजपासून|यापुढे",
    r"(?:હવે|આજ)\s*(?:થી|પછી)", r"હવેથી|આજથી",
    r"(?:ਹੁਣ|ਅੱਜ)\s*ਤੋਂ(?:\s*ਬਾਅਦ)?",
    r"ಇನ್ನು\s*ಮುಂದೆ|ಇನ್ಮೇಲೆ|ಇವತ್ತಿನಿಂದ",
    r"இன்னைக்கு\s*அப்புறம்|இன்றிலிருந்து|இன்று\s*முதல்|இனிமேல்",
    r"ఈరోజు\s*(?:తర్వాత|నుంచి|నుండి)|ఇకపై|ఇక\s*(?:నుంచి|నుండి)",
    r"(?:ഇന്ന്|ഇനി)\s*മുതൽ|ഇനിമുതൽ",
)
_FROM_NOW_ON = _compile(*_FROM_NOW_ON_PARTS)
_FROM_NOW_ON_COMMA = re.compile("(" + "|".join(_FROM_NOW_ON_PARTS) + r")\s*[,]", re.IGNORECASE)

# "Again and again", "बार बार": not a repeat word (it is not "ever again"),
# but next to a don't-call phrase it is a stop request in its own right ("बार
# बार फ़ोन मत करो", "stop calling me again and again"): never a veto.
_FREQUENCY = _compile(r"\bagain and again\b", r"\bover and over\b", r"\b(?:baar baar|bar bar)\b",
                      r"बार\s*[-]?\s*बार", r"বারবার|বার\s*বার", r"वारंवार|पुन्हा\s*पुन्हा", r"વારંવાર|વાર\s*વાર",
                      r"ਵਾਰ\s*ਵਾਰ", r"ಪದೇ\s*ಪದೇ", r"அடிக்கடி", r"పదే\s*పదే|మాటిమాటికి", r"വീണ്ടും\s*വീണ്ടും|ഇടയ്ക്കിടെ")
# Multi-word repeat words, joined so each is one token.
_REPEAT_JOIN = [(re.compile(a), b) for a, b in (
    (r"\bany more\b", "anymore"), (r"\bphir se\b", "phirse"), (r"\baage se\b", "aagese"), (r"\bab se\b", "abse"),
    (r"फिर\s*से", "फिरसे"), (r"आगे\s*से", "आगेसे"), (r"अब\s*से", "अबसे"),
)]
# Where a repeat word sits: English says it AFTER the stop ("don't call me
# again"); the Indic call languages say it BEFORE ("दोबारा फ़ोन मत करना",
# "আর ফোন করবেন না"). Bengali আর ("and" as well as "anymore") counts only
# right before the call word. Punjabi ਫਿਰ ("then") is not one.
_REPEAT_AFTER = frozenset({"again", "anymore", "अगेन", "एनीमोर"})  # also as Sarvam writes them in Devanagari
_REPEAT_BEFORE = frozenset("""
dobara dubara phirse aagese abse दोबारा दुबारा फिरसे आगेसे अबसे আবার पुन्हा परत ફરીથી ફરી ਦੁਬਾਰਾ
""".split())
_REPEAT_BEFORE_PREFIX = ("ಮತ್ತೆ", "ಇನ್ನು", "ಇನ್ಮೇಲೆ", "இனிமேல்", "இனிமே", "இனி", "மறுபடியும்", "మళ్ళీ", "ఇంకెప్పుడూ",
                         "ഇനി", "വീണ്ടും")
_REPEAT_RIGHT_BEFORE = frozenset({"আর"})
_REPEAT_WINDOW = 3  # tokens, with only filler between


def _is_repeat_before(word: str, adjacent: bool) -> bool:
    return (word in _REPEAT_BEFORE or word.startswith(_REPEAT_BEFORE_PREFIX)
            or (adjacent and word in _REPEAT_RIGHT_BEFORE))


_FREQ_TOKEN = "§freq"


def _next_to_a_frequency_phrase(clause: str) -> bool:
    """"बार बार फ़ोन मत करो", "don't call me again and again": next to the stop, either side."""
    c = _FREQUENCY.sub(f" {_FREQ_TOKEN} ", clause)
    if _FREQ_TOKEN not in c:
        return False
    toks = c.split()
    for m in _STOP_PHRASES.finditer(c):
        if _FREQ_TOKEN in m.group(0):
            return True
        first, last = len(c[:m.start()].split()), len(c[:m.end()].split())
        for side in (toks[last:last + _REPEAT_WINDOW], list(reversed(toks[max(0, first - _REPEAT_WINDOW):first]))):
            for w in side:
                if w == _FREQ_TOKEN:
                    return True
                if w not in _FILLER:
                    break
    return False


def _next_to_a_repeat_word(clause: str) -> bool:
    """Is a repeat word next to a stop phrase in this clause (only filler between)?"""
    c = _FREQUENCY.sub(" ", clause)
    for pattern, joined in _REPEAT_JOIN:
        c = pattern.sub(joined, c)
    toks = c.split()
    for m in _STOP_PHRASES.finditer(c):
        inside = m.group(0).split()
        if any(_is_repeat_before(w, True) or w in _REPEAT_AFTER for w in inside):
            return True
        first, last = len(c[:m.start()].split()), len(c[:m.end()].split())
        for i, w in enumerate(toks[last:last + _REPEAT_WINDOW]):
            if w in _REPEAT_AFTER:
                return True
            if w not in _FILLER:
                break
        before = toks[max(0, first - _REPEAT_WINDOW):first]
        for i, w in enumerate(reversed(before)):
            if _is_repeat_before(w, adjacent=i == 0):
                return True
            if w not in _FILLER:
                break
    return False

# Not saying it: "I never said don't call me", "मैंने कब कहा कि फ़ोन मत करना".
_DENIAL = _compile(
    r"\b(?:not that|never said|didn't say|did not say|didn't mean|who said|did i say)\b",
    r"कब\s*कहा|किसने\s*कहा|नहीं\s*कहा",
)
# A plain "don't call" fires live only when little else is said: these words
# do not count as "else" (politeness, "me", "this number").
_FILLER = frozenset("""
please pls plz kindly me us sir madam maam mam ma'am okay ok thanks thank you ji jee bas bhai sahab saheb
this number just actually look listen well fine so
मुझे मुझको हमें हमको बस जी प्लीज़ प्लीज कृपया आप सर मैडम मैम भाई साहब धन्यवाद शुक्रिया इस नंबर पर है हैं मी
আমাকে আমাদের দয়া করে প্লিজ দাদা দিদি স্যার ম্যাডাম ধন্যবাদ আপনি এই নম্বরে
मला आम्हाला कृपया प्लीज सर मॅडम धन्यवाद तुम्ही या नंबरवर
મને અમને મહેરબાની કરીને પ્લીઝ સર મેડમ આભાર તમે આ નંબર પર
ਮੈਨੂੰ ਸਾਨੂੰ ਕਿਰਪਾ ਕਰਕੇ ਪਲੀਜ਼ ਜੀ ਸਰ ਮੈਡਮ ਧੰਨਵਾਦ ਤੁਸੀਂ
ನನಗೆ ನನ್ಗೆ ನಮಗೆ ದಯವಿಟ್ಟು ಸರ್ ಮೇಡಂ ಧನ್ಯವಾದ ನೀವು ಪ್ಲೀಸ್
எனக்கு எங்களுக்கு என்னை தயவுசெய்து ப்ளீஸ் சார் மேடம் நன்றி நீங்க நீங்கள்
నాకు మాకు నన్ను దయచేసి ప్లీజ్ సార్ మేడం ధన్యవాదాలు మీరు అండి
എന്നെ ഞങ്ങളെ ദയവായി പ്ലീസ് സാർ മാഡം നന്ദി നിങ്ങൾ
""".split())

# Clauses: a limit only counts in the clause that holds the stop phrase
# ("Don't call me again, my husband handles school things" is a stop;
# "Don't call his father again, call me" is not).
_CLAUSE_SPLIT = re.compile(
    r"([,.;!?।॥|]+)|\s(?:because|but|cause|coz|क्योंकि|लेकिन|কারণ|কিন্তু|पण|ਕਿਉਂਕਿ)\s", re.IGNORECASE
)
_QUESTION_START = re.compile(r"^(?:why|should|shall|didn't|did|will|can|could|would|क्या|क्यों)\b")

# Punctuation that only separates words (kept: apostrophes, Indic marks).
_PUNCT = re.compile(r"[.,!?;:।॥\"“”()\[\]{}…\-–—/]+")


def normalize(text: object) -> str:
    if not isinstance(text, str):
        return ""
    t = text.replace("’", "'").replace("‘", "'").lower()
    t = _PUNCT.sub(" ", t)
    return re.sub(r"\s+", " ", t).strip()


def _clauses(text: str) -> list[tuple[str, bool]]:
    """(normalized clause, ended with a question mark), in order."""
    out: list[tuple[str, bool]] = []
    pos = 0
    raw = text.replace("’", "'").replace("‘", "'")
    raw = _FROM_NOW_ON_COMMA.sub(r"\1 ", raw)  # "From now on, don't call me": one clause
    for m in _CLAUSE_SPLIT.finditer(raw):
        out.append((normalize(raw[pos:m.start()]), "?" in (m.group(1) or "")))
        pos = m.end()
    out.append((normalize(raw[pos:]), False))
    return [(c, q) for c, q in out if c]


def _stop_clauses(text: str) -> list[tuple[str, bool]]:
    """The clauses a stop phrase touches (a phrase may run across a comma)."""
    clauses = _clauses(text)
    joined, spans, at = [], [], 0
    for c, _q in clauses:
        spans.append((at, at + len(c)))
        joined.append(c)
        at += len(c) + 1
    t = " ".join(joined)
    hit: set[int] = set()
    for m in _STOP_PHRASES.finditer(t):
        hit |= {i for i, (a, b) in enumerate(spans) if a < m.end() and m.start() < b}
    if not hit:
        return []
    lo, hi = min(hit), max(hit)
    return [(" ".join(c for c, _q in clauses[lo:hi + 1]), any(q for _c, q in clauses[lo:hi + 1]))]


def _leftover(t: str) -> list[str]:
    """What is said besides the stop phrase and filler."""
    return [w for w in _STOP_PHRASES.sub(" ", t).split() if w not in _FILLER]


def stop_kind(text: object, current: object = None) -> str | None:
    """"strong", "plain" or None for one utterance (or two joined; see `current`).

    unambiguous ("remove my number") and strong stops ("stop calling",
    "don't call me again") are "strong": they fire at once unless a time,
    place, someone else or a redirection sits in the stop phrase's own clause.
    A plain "don't call" is "plain" only when nothing else is said besides
    politeness (_FILLER): "I'm busy, don't call", "Don't call Rahul's father",
    "रविवार को फ़ोन मत करना" are left to the model and the post-call check.
    A question or a denial ("I never said don't call me") is never a stop.

    `current`: when `text` is the previous transcription joined to the
    current one, the part that was just said. When the stop phrase is wholly
    in it, its strength is judged on it alone; a plain stop's "nothing else"
    is judged on the joined text.
    """
    if not isinstance(text, str):
        return None
    t = normalize(text)
    if not t:
        return None
    if _UNAMBIGUOUS.search(t):
        return None if (_NUMBER_CHANGE.search(t) or _DENIAL.search(t)) else "strong"
    if not _STOP_PHRASES.search(t):
        return None
    if isinstance(current, str) and _STOP_PHRASES.search(normalize(current)):
        own = stop_kind(current)
        if own == "plain":
            return "plain" if not _leftover(t) and not _QUESTION_START.search(t) else None
        return own
    if _DENIAL.search(t):
        return None
    for clause, question in _stop_clauses(text):
        if question:
            return None
        strong = (_FROM_NOW_ON.search(clause) or _STRONG_PHRASES.search(clause)
                  or _next_to_a_repeat_word(clause) or _next_to_a_frequency_phrase(clause))
        if strong and not _LIMITS.search(_FROM_NOW_ON.sub(" ", clause)):
            return "strong"
    if not _leftover(t) and not _QUESTION_START.search(t) and not _NOT_A_STOP.search(t):
        return "plain"
    return None


def is_stop_request(text: object, current: object = None) -> bool:
    """Should the engine treat this as the parent asking not to be called? (stop_kind)"""
    return stop_kind(text, current) is not None


def has_strong_marker(text: object) -> bool:
    """Does this say "never again" in any of the live detector's ways?"""
    t = normalize(text)
    return bool(t) and bool(
        _UNAMBIGUOUS.search(t) or _FROM_NOW_ON.search(t) or _STRONG_PHRASES.search(t)
        or any(_next_to_a_repeat_word(clause) or _next_to_a_frequency_phrase(clause)
               for clause, _q in _clauses(text if isinstance(text, str) else ""))
    )


def has_reschedule_cue(text: object) -> bool:
    """Any time, third-party or redirection cue (used by the post-call flag too).

    "From now on / after today" is not one: it makes a stop stronger.
    """
    return bool(_NOT_A_STOP.search(_FROM_NOW_ON.sub(" ", normalize(text))))


# ── What the engine must never say ───────────────────────────────────────────
#
# Nothing on this engine blocks a number, so a model reply promising that the
# school will not call again is a promise the school may break. CallManager
# checks every model reply against these before it is spoken, in both call
# modes; a match is dropped and handled as a stop request.

_N = r"(?:\S+\s+){0,2}"  # up to two words between the call word and the negation

# Only CALLING counts: "I won't disturb you for long" or "मैं आपको ज़्यादा
# परेशान नहीं करूँगा" is politeness, not a promise. And only a promise made
# BY us or TO the parent: "Rahul won't …", "क्लास टीचर फ़ोन नहीं करेंगे, आप
# स्कूल आकर मिल सकते हैं" is not one.

# First-person forms: the verb itself says "we / I will not call".
_PROMISE_FIRST = _compile(
    # English: a we/I subject, or a you object
    r"\b(?:we|i)(?:'ll|'d)?\s+(?:will not|won't|wont|shall not|would not|wouldn't|will never|never)\s+"
    r"(?:be\s+)?(?:call|phone|ring|contact)(?:ing)?\b",  # not bare "not": "should I not call you at 9?"
    r"\b(?:not|never)\s+(?:be\s+)?calling\s+you\s+(?:again|anymore|any more)\b",
    r"\b(?:won't|wont|will not|never)\s+(?:be\s+)?(?:call|phone|ring|contact)(?:ing)?\s+(?:you\s+)?(?:again|anymore|any more)\b",
    r"\b(?:will|'ll|shall)\s+stop\s+(?:calling(?:\s+you)?|phoning|contacting|the calls|these calls)\b",
    r"\b(?:won't|wont|will not|shall not|never)\s+(?:be\s+)?(?:call|phone|ring|contact)(?:ing)?\s+you\b",
    r"\byou\s+(?:will not|won't|wont|will never)\s+(?:be\s+(?:called|contacted|phoned)|get\s+(?:any\s+)?(?:more\s+)?calls)\b",
    r"\bno (?:more|further) (?:phone )?calls?\b",
    r"\b(?:take|remove)\s+(?:you|your number)\s+(?:off|from)\b",
    # Hinglish, Hindi: first person singular
    r"\b(?:phone|fone|call)\s*(?:nahi|nahin|nhi)\s*(?:karunga|karungi)\b",
    rf"{_HI_CALLS}\s*{_N}नहीं\s*(?:करूँगा|करूंगा|करूँगी|करूंगी)",
    # Bengali করব না, Gujarati કરીએ/કરીશું/કરું, Punjabi ਕਰਾਂਗੇ, Tamil மாட்டோம், Telugu చేయము
    rf"{_BN_CALL}\s*{_N}(?:করব|করবো|দেব|দেবো)\s*না",
    rf"{_GU_CALL}\s*{_N}(?:(?:નહીં|નહિ)\s*(?:કરીએ|કરીશું|કરું|કરીશ)|(?:કરીએ|કરીશું|કરીશ)\s*(?:નહીં|નહિ))",
    rf"{_PA_CALL}\s*{_N}(?:ਨਹੀਂ|ਨਹੀ)\s*(?:ਕਰਾਂਗੇ|ਕਰਾਂਗਾ|ਕਰਾਂਗੀ)",
    rf"{_TA_CALL}\s*{_N}(?:பண்ண\s*மாட்டோம்|பண்ணமாட்டோம்|செய்ய\s*மாட்டோம்)",
    r"(?:அழைக்க|கூப்பிட)\s*மாட்டோம்",
    rf"{_TE_CALL}\s*{_N}(?:చేయము|చేయం|చేయను|చెయ్యము|చెయ్యం|చెయ్యను)",
)
# Forms that do not say who: a promise only with a we/I subject or a you
# object in the same reply (_PROMISE_PERSON), or a "from now on / again"
# marker (_PROMISE_MARKER).
_PROMISE_NEUTRAL = _compile(
    r"\b(?:phone|fone|call)\s*(?:nahi|nahin|nhi)\s*(?:karenge|karega|aayega|ayega|aayenge|kiya jayega)\b",
    rf"{_HI_CALLS}\s*{_N}नहीं\s*(?:करेंगे|करेंगी|करेगा|करेगी|आएगा|आयेगा|आएगी|आएँगे|आएंगे|आयेंगे"
    r"|आएँगी|आएंगी|किया\s*जाएगा|किया\s*जायेगा)",
    rf"{_HI_CALLS}\s*{_N}बंद\s*(?:कर\s*देंगे|कर\s*दी\s*जाएँगी|कर\s*दी\s*जाएंगी|हो\s*जाएँगे|हो\s*जाएंगे|हो\s*जाएँगी|हो\s*जाएंगी)",
    rf"{_BN_CALL}\s*{_N}(?:করা\s*হবে|আসবে)\s*না",
    rf"{_MR_CALL}\s*{_N}(?:करणार\s*नाही|करणार\s*नाहीत|येणार\s*नाही|केला\s*जाणार\s*नाही)",
    rf"{_GU_CALL}\s*{_N}(?:નહીં|નહિ)\s*આવે",
    rf"{_PA_CALL}\s*{_N}(?:ਨਹੀਂ|ਨਹੀ)\s*(?:ਆਵੇਗਾ|ਆਉਣਗੇ)",
    rf"{_KN_CALL}\s*{_N}(?:ಮಾಡುವುದಿಲ್ಲ|ಮಾಡಲ್ಲ|ಮಾಡೋದಿಲ್ಲ|ಮಾಡುವುದು\s*ಇಲ್ಲ|ಬರುವುದಿಲ್ಲ|ಬರಲ್ಲ)",
    rf"{_TA_CALL}\s*{_N}வராது",
    rf"{_TE_CALL}\s*{_N}రాదు",
    r"വിളിക്കില്ല|വിളിക്കുകയില്ല|വിളിക്കുന്നില്ല|(?:ഫോൺ|കോൾ)\s*ചെയ്യില്ല|(?:ഫോൺ|കോൾ)\s*ചെയ്യുകയില്ല",
)
# "We won't disturb / bother you again": a promise only with a we/I subject
# or a you object (_PROMISE_PERSON, or built into the English form), PLUS a
# repeat word (_PROMISE_REPEAT), and no "for long / much / any further"
# (_HOW_LONG). "I won't disturb you for long" is politeness.
_DISTURB_EN = re.compile(
    r"\b(?:we|i)(?:'ll)?\s+(?:will not|won't|wont|shall not|will never|never)\s+(?:disturb|bother|trouble)\s+you\s+"
    r"(?:again|anymore|any more)\b"
)
_DISTURB = _compile(
    r"(?:परेशान|डिस्टर्ब|तंग)\s*नहीं\s*(?:करेंगे|करेंगी|करूँगा|करूंगा|करूँगी|करूंगी|किया\s*जाएगा)",
    r"\b(?:pareshan|disturb)\s*(?:nahi|nahin)\s*(?:karenge|karunga|karungi)\b",
    r"বিরক্ত\s*(?:করবো|করব|করা\s*হবে){_END}\s*না".replace("{_END}", _END),
    r"त्रास\s*(?:देणार\s*नाही|देणार\s*नाहीत)",
    r"હેરાન\s*(?:(?:નહીં|નહિ)\s*(?:કરીએ|કરીશું|કરું)|(?:કરીએ|કરીશું)\s*(?:નહીં|નહિ))",
)
_PROMISE_REPEAT = _compile(
    r"\b(?:again|anymore|any more|dobara|dubara|phir se|aage se)\b",
    r"दोबारा|दुबारा|फिर\s*से|आगे\s*से|फिर\s*कभी",
    _word(r"আর|আবার"),
    _word(r"पुन्हा|परत"),
    _word(r"ફરીથી|ફરી"),
)
_HOW_LONG = _compile(
    r"\b(?:long|much|any further|for a while|too long)\b",
    r"\b(?:zyada|jyada|der)\b",
    _word(r"ज़्यादा|ज्यादा|देर|लंबा|लम्बा|ज़्यादा\s*देर"),
    _word(r"বেশিক্ষণ|অনেকক্ষণ|বেশি"),
    _word(r"जास्त|वेळ"),
    _word(r"વધુ|લાંબો|વધારે"),
)

# A Hindi "won't call / no call will come" that names no caller ("जी ठीक
# है, फ़ोन नहीं करेंगे", "आगे कोई कॉल नहीं आएगी") is ours: it counts unless a
# third person is the subject ("क्लास टीचर फ़ोन नहीं करेंगे, आप स्कूल आकर
# मिल सकते हैं").
_HI_NO_CALLER = re.compile(
    rf"{_HI_CALLS}\s*{_N}नहीं\s*(?:करेंगे|आएगा|आयेगा|आएगी|आयेगी|आएँगी|आएंगी|आएँगे|आएंगे|आयेंगे){_END}"
)
_HI_THIRD_PERSON = _compile(_word(r"टीचर|सर|मैडम|मैम|वो|वे|वह|प्रिंसिपल|उन्होंने"), r"\bteacher\b")

# We / I as the subject, or you as the object, in each call language.
_PROMISE_PERSON = _compile(
    r"\b(?:hum|hamne|main|mai|aapko|apko|tumhe|tumko)\b",
    _word(r"हम|मैं|आपको|आपके|तुम्हें|तुमको"),
    _word(r"আমরা|আমি|আপনাকে|তোমাকে"),
    _word(r"आम्ही|मी|तुम्हाला|तुम्हांला|आपल्याला"),
    _word(r"અમે|હું|તમને|આપને"),
    _word(r"ਅਸੀਂ|ਮੈਂ|ਤੁਹਾਨੂੰ"),
    _starts(r"ನಾವು|ನಾನು|ನಿಮಗೆ|ನಿಮ್ಮನ್ನು"),
    _starts(r"நாங்கள்|நான்|உங்களை|உங்களுக்கு"),
    _starts(r"మేము|నేను|మీకు|మిమ్మల్ని"),
    _starts(r"ഞങ്ങൾ|ഞാൻ|നിങ്ങളെ|നിങ്ങൾക്ക്"),
)
# "From now on", "after today", "again": they make a promise, never excuse
# one, and they make a form that does not say who into a promise.
_PROMISE_MARKER = _compile(
    r"\b(?:from now on|from today|after today|after this|again|anymore|any more|any longer)\b",
    r"\b(?:ab|ab se|aage se|aaj ke baad|ab ke baad|iske baad|dobara|dubara|phir se|kabhi)\b",
    r"(?:आज|अब|इस)\s*के\s*बाद",
    r"इसके\s*बाद",
    r"अब\s*से",
    r"आगे\s*से",
    r"फिर\s*(?:से|कभी)",
    _word(r"अब|दोबारा|दुबारा|कभी"),
    r"(?:এখন|আজ)\s*থেকে",
    _word(r"আর|আবার"),
    r"(?:आता|आज)\s*पासून",
    _word(r"आतापासून|आजपासून|यापुढे|पुन्हा"),
    r"(?:હવે|આજ)\s*થી",
    _word(r"હવેથી|આજથી|ફરીથી|ફરી"),
    r"(?:ਹੁਣ|ਅੱਜ)\s*ਤੋਂ",
    _word(r"ਦੁਬਾਰਾ|ਫਿਰ"),
    r"ಇನ್ನು\s*ಮುಂದೆ",
    _starts(r"ಇನ್ಮೇಲೆ|ಮತ್ತೆ"),
    _starts(r"இனிமேல்|இனி|மறுபடியும்|இன்றிலிருந்து"),
    r"ఇక\s*(?:పై|నుంచి|నుండి)",
    _starts(r"ఇకపై|మళ్ళీ|ఇంకెప్పుడూ"),
    _starts(r"ഇനിമുതൽ|ഇനി|വീണ്ടും"),
)

# Someone else as the one called ("we won't call your husband") is not the
# parent. Only when that person is the OBJECT of the call verb in the same
# clause, and the clause does not also call the parent ("आम्ही तुम्हाला पुन्हा
# फोन करणार नाही, त्यांना सांगू" is still a promise; a bare "उन्हें" or
# "पापा को बता दिया" elsewhere excuses nothing). English: "call your husband",
# not "call you about him again".
_KIN_EN = r"(?:son|daughter|child|kid|husband|wife|father|mother|dad|mom|mum|brother|sister)"
_NOT_INDIC_BEFORE = rf"(?<![{_INDIC}])"
_PROMISE_PARTY_WORDS = "|".join((
    r"\b(?:(?:uske|unke|iske|inke)\s+)?(?:papa|mummy|pati|husband|wife|bete|beti|bachche|bachcha|bhai|behen)\s*ko\b",
    r"\b(?:usko|unko|isko|inko|unhe|unhein)\b",
    rf"{_NOT_INDIC_BEFORE}(?:उसको|उसे|उनको|उन्हें|इनको|इन्हें|इसको|इसे)",
    rf"{_NOT_INDIC_BEFORE}(?:(?:उसके|उनके|इसके|इनके)\s+)?(?:पति|पत्नी|पापा|पिताजी|पिता|मम्मी|माँ|मां|बेटे|बेटी|बच्चे|बच्चा"
    r"|भाई|बहन|दादा|दादी|नाना|नानी)\s*को",
    rf"{_NOT_INDIC_BEFORE}(?:ওকে|ওঁকে|তাকে|তাঁকে|ওনাকে|ওদের)",
    rf"{_NOT_INDIC_BEFORE}(?:(?:ওর|ওঁর|তার|তাঁর)\s+)?(?:স্বামী|বাবা|মা|ছেলে|মেয়ে|বাচ্চা|ভাই|বোন)কে",
    rf"{_NOT_INDIC_BEFORE}(?:(?:त्यांच्या|त्याच्या|तिच्या)\s+)?(?:वडिलांना|आईला|बाबांना|मिस्टरांना|नवऱ्याला|बायकोला"
    r"|सासूबाईंना|सासऱ्यांना|त्यांना|त्याला|तिला)",
))
_ANY_CALL_WORD = r"(?:फ़ोन|फोन|कॉल|काल|ফোন|কল|phone|fone|call)"
_PROMISE_PARTY_OBJECT = _compile(
    rf"\b(?:call|phone|ring|contact)(?:ing)?\s+(?:him|her|them|(?:your|my|his|her|their)\s+{_KIN_EN})\b",
    rf"(?:{_PROMISE_PARTY_WORDS})\s*(?:\S+\s+)?{_ANY_CALL_WORD}",
    rf"(?:^|\s)(?!मुझ|हम|आप)\S+\s+को\s*{_HI_CALL}",  # "<anyone but me/us/you> को फ़ोन …"
)
# The parent as the object, in the same clause.
_SECOND_PERSON_OBJECT = _compile(
    r"\b(?:call|phone|ring|contact)(?:ing)?\s+you\b",
    r"\b(?:aapko|apko|tumhe|tumko)\b",
    _word(r"आपको|तुम्हें|तुमको|আপনাকে|তোমাকে|तुम्हाला|तुम्हांला|आपल्याला|તમને|આપને|ਤੁਹਾਨੂੰ"),
    _starts(r"ನಿಮಗೆ|ನಿಮ್ಮನ್ನು|உங்களை|உங்களுக்கு|మీకు|మిమ్మల్ని|നിങ്ങളെ|നിങ്ങൾക്ക്"),
)


def _about_someone_else(text: str) -> bool:
    """Is the reply's "won't call" about a person other than the parent?"""
    return any(_PROMISE_PARTY_OBJECT.search(clause) and not _SECOND_PERSON_OBJECT.search(clause)
               for clause, _q in _clauses(text))


# A genuine reschedule is a time AND a "will call" ("we won't call now, the
# teacher will call this evening", "अभी फ़ोन नहीं करेंगे, शाम को करेंगे").
# A time word on its own ("आज के बाद", "from now on") excuses nothing.
_TIME = _compile(*_TIME_PARTS)
_NOT_NEG_HI = r"(?:(?!नहीं|न\s|मत|ना\s)\S+\s+)?"
_WILL_CALL = _compile(
    r"\b(?:will|'ll|shall)\s+(?:be\s+)?(?:call|phone|ring|contact)(?:ing)?\b",
    r"\b(?:phone|fone|call|ko)\s+(?:kar\s+)?(?:karenge|karunga|karungi|karega|lenge)\b",
    rf"(?:{_HI_CALLS}|{_word('को')})\s*{_NOT_NEG_HI}(?:कर\s*)?(?:करेंगे|करेंगी|करूँगा|करूंगा|करूँगी|करूंगी|करेगा|करेगी"
    r"|लेंगे|लूँगा|लूंगा)",
    # The verb must END where the alternation ends ({_END}): "করবো না" must
    # not read as "করব" + "ো" (no "না" right after), a positive "will call".
    rf"{_BN_CALL}\s*(?:\S+\s+)?(?:করবো|করবেন|করব|দেবো|দেব){_END}(?!\s*না)",
    rf"{_MR_CALL}\s*(?:\S+\s+)?(?:करतील|करणार|करेन|करेल|करू){_END}(?!\s*नाही)",
    rf"{_GU_CALL}\s*(?:(?!નહીં|નહિ)\S+\s+)?(?:કરીશું|કરીશ|કરશે|કરીએ){_END}(?!\s*(?:નહીં|નહિ))",
    rf"{_PA_CALL}\s*(?:(?!ਨਹੀਂ|ਨਹੀ)\S+\s+)?(?:ਕਰਾਂਗੇ|ਕਰਾਂਗਾ|ਕਰਾਂਗੀ|ਕਰਨਗੇ|ਕਰੇਗਾ)",
    rf"{_KN_CALL}\s*(?:\S+\s+)?(?:ಮಾಡುತ್ತೇವೆ|ಮಾಡುತ್ತೇನೆ|ಮಾಡುತ್ತಾರೆ|ಮಾಡ್ತೀವಿ|ಮಾಡ್ತಾರೆ)",
    rf"{_TA_CALL}\s*(?:\S+\s+)?(?:பண்ணுவோம்|பண்ணுவேன்|பண்ணுவாங்க|பண்ணுவார்)",
    r"அழைப்போம்|அழைப்பார்|கூப்பிடுவோம்|கூப்பிடுவார்",
    rf"{_TE_CALL}\s*(?:\S+\s+)?(?:చేస్తాము|చేస్తాం|చేస్తాను|చేస్తారు)",
    r"വിളിക്കും",
)


def is_no_more_calls_promise(text: object) -> bool:
    """Would saying this promise the parent that the school will not call again?"""
    t = normalize(text)
    if not t:
        return False
    said = bool(_PROMISE_FIRST.search(t)) or bool(
        _PROMISE_NEUTRAL.search(t) and (_PROMISE_PERSON.search(t) or _PROMISE_MARKER.search(t))
    ) or bool(_HI_NO_CALLER.search(t) and not _HI_THIRD_PERSON.search(t)) or (
        not _HOW_LONG.search(t) and bool(
            _DISTURB_EN.search(t) or (_DISTURB.search(t) and _PROMISE_PERSON.search(t) and _PROMISE_REPEAT.search(t))
        )
    )
    if not said or _about_someone_else(text):
        return False
    return not (_TIME.search(t) and _WILL_CALL.search(t))


# ── Noticing it during the call ──────────────────────────────────────────────


NOTICE = "notice"  # a stop: answer it now (this transcription is part of it)
WAIT = "wait"      # a plain stop: hold it until the next transcription or a pause
HOLD = "hold"      # nothing to judge (punctuation only) while a stop is held: keep it with the held words
NOTICE_HELD = "notice_held"  # the held stop stands; this transcription came too late to be part of it
PASS = "pass"      # ordinary speech (or a held plain stop turned out not to be one)

# Speech-to-text splits an utterance wherever the parent pauses: a
# transcription joins the one before it only when it follows this soon.
JOIN_SECONDS = 2.5


class StopListener:
    """Notice, once per call, that the parent is asking not to be called.

    A strong stop is noticed at once. A plain one ("don't call me") WAITs: the
    next transcription may finish the sentence ("after 9 pm", "रात को",
    "সকালে"), so it is judged again joined to that one, with every limit
    applied; if the parent says nothing more (on_quiet), it stands. Each
    transcription is also judged joined to the one just before it ("मेरे पति
    को" + "फ़ोन मत करना"). After the first notice everything else is ordinary
    speech for the model: the engine says its line once and never argues.
    Texts are kept raw: clause boundaries (commas) matter to stop_kind.
    """

    def __init__(self) -> None:
        self._previous_raw = ""
        self._previous_at: float | None = None
        self.pending: str | None = None
        self._pending_at: float | None = None
        self.noticed = False
        self.quote: str | None = None

    def _notice(self, quote: str) -> str:
        self.noticed, self.quote, self.pending = True, quote.strip(), None
        return NOTICE

    def touch(self, now: float | None) -> None:
        """The parent is audibly speaking while a stop is held: the join window runs from here."""
        if self.pending is not None and now is not None:
            self._pending_at = now

    def hear(self, text: object, now: float | None = None) -> str:
        raw = text.strip() if isinstance(text, str) else ""
        if self.noticed:
            return PASS
        if not normalize(raw) or (self.pending is not None and drop_reason(raw)):
            # A punctuation-only final ("." or "।"), or while a stop is held a
            # fragment the STT filter drops ("हम्म", "हां", "hmm", a single
            # letter): nothing to judge. While a stop is held it stays with
            # the held words and changes nothing.
            return HOLD if self.pending is not None else PASS
        recent = self._previous_raw and (now is None or self._previous_at is None
                                         or now - self._previous_at <= JOIN_SECONDS)
        previous = self._previous_raw if recent else ""
        self._previous_raw, self._previous_at = raw, now
        if self.pending is not None:
            if now is not None and self._pending_at is not None and now - self._pending_at > JOIN_SECONDS:
                # Too late to finish the held sentence: the held stop stands
                # on its own, and this is ordinary speech after it.
                self._notice(self.pending)
                return NOTICE_HELD
            joined, self.pending = f"{self.pending} {raw}", None
            self._previous_raw = joined
            return self._notice(joined) if stop_kind(joined) else PASS
        text_judged = f"{previous} {raw}" if previous else raw
        kind = stop_kind(text_judged, current=raw) if previous else stop_kind(raw)
        if kind == "strong":
            return self._notice(raw if stop_kind(raw) == "strong" else text_judged)
        if kind == "plain":
            self.pending, self._pending_at = text_judged, now
            return WAIT
        return PASS

    def release_pending(self) -> bool:
        """The hold ran out without a decision (the parent kept talking): not a live stop.

        The held words go to the model; the post-call check still sees them.
        """
        if self.pending is None or self.noticed:
            return False
        self._previous_raw, self.pending = self.pending, None
        return True

    def on_quiet(self) -> bool:
        """The parent said nothing more after a plain stop: it stands."""
        if self.pending is None or self.noticed:
            return False
        self._notice(self.pending)
        return True

    def on_parent_speech(self, text: object, now: float | None = None) -> bool:
        """True when this transcription is noticed as a stop (a plain one WAITs: see on_quiet)."""
        return self.hear(text, now) == NOTICE


# ── After the call: the analysis backstop ────────────────────────────────────


def backstop_quote(insights: Mapping[str, Any] | None, transcript: Sequence[Mapping[str, Any]]) -> str | None:
    """The parent's own words asking not to be called, if the analysis found them.

    Counts only when the post-call analysis says `optOut.requested` is exactly
    True AND its quote appears, verbatim (after normalising), in one of the
    PARENT's turns, AND the quote is not a rescheduling request. A model that
    invents or paraphrases a quote, or reads "call me later" as a stop, is
    ignored.

    "Not a rescheduling request" is the live detector's rule: a limit (time,
    place, someone else, redirection, or "busy") rejects the quote only when
    no strong marker is in it. "Stop calling me, I'm busy" or "don't call me
    again, I'm at work all day" is a stop.
    """
    if not isinstance(insights, Mapping):
        return None
    opt_out = insights.get("optOut")
    if not isinstance(opt_out, Mapping) or opt_out.get("requested") is not True:
        return None
    quote = opt_out.get("quote")
    needle = normalize(quote)
    if len(needle) < 4 or (has_reschedule_cue(needle) and not has_strong_marker(quote)):
        return None
    for turn in transcript:
        if isinstance(turn, Mapping) and turn.get("role") == "parent" and needle in normalize(turn.get("text")):
            return quote if isinstance(quote, str) else None
    return None


LIVE = "live"          # heard by StopListener during the call
ANALYSIS = "analysis"  # found by the post-call analysis (backstop_quote)
OPT_OUT_REQUEST_FIELD = "optOutRequested"
MAX_QUOTE_CHARS = 500


def opt_out_request(quote: str, at: str, source: str) -> dict[str, Any]:
    """The `optOutRequested` map on parent_outreach/{id}."""
    if source not in (LIVE, ANALYSIS):
        raise ValueError(f"unknown opt-out source {source!r}")
    return {"quote": quote[:MAX_QUOTE_CHARS], "at": at, "source": source}


async def record_opt_out_request(
    db: Any, outreach_id: str, quote: str, source: str, *, now: str | None = None,
) -> OptOutWrite:
    """Record (never enforce) that the parent may not want these calls. Never raises.

    The one write the engine makes for a stop request: it updates only the
    outreach the call was authenticated for, and never touches
    call_suppressions.
    """
    now = now or utc_now_iso()
    try:
        fields = {OPT_OUT_REQUEST_FIELD: opt_out_request(quote, now, source), "updatedAt": now}
        await db.collection(OUTREACH_COLLECTION).document(outreach_id).update(fields)
    except Exception as exc:  # noqa: BLE001
        return OptOutWrite(False, f"opt-out request not recorded for {outreach_id}: {type(exc).__name__}")
    return OptOutWrite(True, f"opt-out request recorded ({source})")


def opt_out_note(request: Mapping[str, Any], in_english: str | None = None) -> str:
    """The first line of the teacher's call summary, quoting the parent.

    English like the rest of the summary, with the parent's own words and,
    when the post-call analysis gave one, their English translation.
    """
    quote = str(request.get("quote") or "").strip()
    if request.get("source") == ANALYSIS:
        lead = "The call review found the parent may prefer not to receive these calls"
    else:
        lead = ("The parent said they would prefer not to receive these calls, and was told "
                "the class teacher would be informed")
    note = lead + (f'. Their words: "{quote}"' if quote else "")
    english = (in_english or "").strip()
    if quote and english and normalize(english) != normalize(quote):
        note += f' (in English: "{english}")'
    return note + ". Nothing has been blocked: they can still be called. Please decide how to follow up."
