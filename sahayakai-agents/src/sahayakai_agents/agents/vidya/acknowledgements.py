"""Localised acknowledgements for the VIDYA supervisor.

WHY THIS EXISTS
---------------
`router.py` used to answer with three hardcoded English sentences regardless of
the teacher's language. Routing was already perfect — 100% flow match on all 66
CREATE/ACTION parity cells — but the reply came back in English, which trips
`assert_script_matches_language` (>=85% of letters must be in the target
Unicode block). That guard is fail-closed, so every non-English request
returned **HTTP 502**. 60 of the 99 parity cells died there.

Not a scoring nicety: VIDYA was rejecting its own output.

WHY A TABLE AND NOT THE MODEL
-----------------------------
These are fixed acknowledgements, not content. A lookup costs zero tokens, zero
latency, and cannot drift off-script — which matters when the failure mode being
fixed *is* wrong-script output. The orchestrator already runs on a strict
1-Gemini-call budget for routing intents; asking it to also compose an ack would
add tokens to the hottest path in the product for no gain.

TRANSLATION PROVENANCE — READ BEFORE SHIPPING
---------------------------------------------
These strings are model-authored and have NOT been reviewed by native speakers.
Unlike the parity fixtures (test inputs), these are **user-facing**: a teacher
hears them read aloud by TTS. Before this reaches production, each line needs a
speaker of that language to confirm it sounds like a warm, respectful colleague
— not a machine. Odia, Punjabi and Malayalam especially.

Tracking: docs/VIDYA_PARITY_MISSION.md, root cause 1.
"""

from __future__ import annotations

from typing import Literal

AckKind = Literal["routing", "route_failed", "unknown"]

DEFAULT_LANGUAGE = "en"

# Keyed by ISO-639-1. Kept flat and obvious on purpose: a reviewer checking one
# language should never have to read the other ten.
ACKNOWLEDGEMENTS: dict[str, dict[AckKind, str]] = {
    "en": {
        "routing": "Opening the right tool for you now.",
        "route_failed": "I could not route that request.",
        "unknown": "I am not sure how to help with that yet. Please try rephrasing your request.",
    },
    "hi": {
        "routing": "मैं आपके लिए सही टूल खोल रही हूँ।",
        "route_failed": "मैं इस अनुरोध को सही जगह नहीं भेज सकी।",
        "unknown": "मुझे अभी इसमें मदद करना नहीं आता। कृपया अपनी बात दूसरे शब्दों में कहिए।",
    },
    "bn": {
        "routing": "আমি এখনই আপনার জন্য সঠিক টুলটি খুলছি।",
        "route_failed": "আমি এই অনুরোধটি সঠিক জায়গায় পাঠাতে পারিনি।",
        "unknown": "আমি এখনও এই বিষয়ে সাহায্য করতে পারি না। অনুগ্রহ করে অন্যভাবে বলুন।",
    },
    "ta": {
        "routing": "உங்களுக்கான சரியான கருவியை இப்போது திறக்கிறேன்.",
        "route_failed": "இந்தக் கோரிக்கையை சரியான இடத்திற்கு அனுப்ப முடியவில்லை.",
        "unknown": "இதில் இன்னும் எனக்கு உதவத் தெரியவில்லை. தயவுசெய்து வேறு வார்த்தைகளில் கூறுங்கள்.",
    },
    "te": {
        "routing": "మీ కోసం సరైన సాధనాన్ని ఇప్పుడే తెరుస్తున్నాను.",
        "route_failed": "ఈ అభ్యర్థనను సరైన చోటుకు పంపలేకపోయాను.",
        "unknown": "దీనికి ఇంకా సహాయం చేయడం నాకు తెలియదు. దయచేసి వేరే మాటల్లో చెప్పండి.",
    },
    "mr": {
        "routing": "मी तुमच्यासाठी योग्य साधन उघडत आहे.",
        "route_failed": "मला ही विनंती योग्य ठिकाणी पाठवता आली नाही.",
        "unknown": "मला अजून यात मदत करता येत नाही. कृपया दुसऱ्या शब्दांत सांगा.",
    },
    "gu": {
        "routing": "હું તમારા માટે યોગ્ય સાધન ખોલી રહી છું.",
        "route_failed": "હું આ વિનંતીને યોગ્ય જગ્યાએ મોકલી શકી નહીં.",
        "unknown": "મને હજી આમાં મદદ કરતાં આવડતું નથી. કૃપા કરીને બીજા શબ્દોમાં કહો.",
    },
    "kn": {
        "routing": "ನಿಮಗಾಗಿ ಸರಿಯಾದ ಸಾಧನವನ್ನು ಈಗ ತೆರೆಯುತ್ತಿದ್ದೇನೆ.",
        "route_failed": "ಈ ಮನವಿಯನ್ನು ಸರಿಯಾದ ಸ್ಥಳಕ್ಕೆ ಕಳುಹಿಸಲು ಆಗಲಿಲ್ಲ.",
        "unknown": "ಇದರಲ್ಲಿ ಸಹಾಯ ಮಾಡಲು ಇನ್ನೂ ನನಗೆ ತಿಳಿದಿಲ್ಲ. ದಯವಿಟ್ಟು ಬೇರೆ ಪದಗಳಲ್ಲಿ ಹೇಳಿ.",
    },
    "ml": {
        "routing": "നിങ്ങൾക്കായി ശരിയായ ഉപകരണം ഇപ്പോൾ തുറക്കുന്നു.",
        "route_failed": "ഈ അഭ്യർത്ഥന ശരിയായ സ്ഥലത്തേക്ക് അയയ്ക്കാൻ കഴിഞ്ഞില്ല.",
        "unknown": "ഇതിൽ സഹായിക്കാൻ എനിക്ക് ഇതുവരെ അറിയില്ല. ദയവായി മറ്റു വാക്കുകളിൽ പറയൂ.",
    },
    "pa": {
        "routing": "ਮੈਂ ਤੁਹਾਡੇ ਲਈ ਸਹੀ ਸੰਦ ਖੋਲ੍ਹ ਰਹੀ ਹਾਂ।",
        "route_failed": "ਮੈਂ ਇਸ ਬੇਨਤੀ ਨੂੰ ਸਹੀ ਥਾਂ ਨਹੀਂ ਭੇਜ ਸਕੀ।",
        "unknown": "ਮੈਨੂੰ ਹਾਲੇ ਇਸ ਵਿੱਚ ਮਦਦ ਕਰਨੀ ਨਹੀਂ ਆਉਂਦੀ। ਕਿਰਪਾ ਕਰਕੇ ਹੋਰ ਸ਼ਬਦਾਂ ਵਿੱਚ ਦੱਸੋ।",
    },
    "or": {
        "routing": "ମୁଁ ଆପଣଙ୍କ ପାଇଁ ସଠିକ୍ ଉପକରଣ ଖୋଲୁଛି।",
        "route_failed": "ମୁଁ ଏହି ଅନୁରୋଧକୁ ସଠିକ୍ ସ୍ଥାନକୁ ପଠାଇ ପାରିଲି ନାହିଁ।",
        "unknown": "ଏଥିରେ ସାହାଯ୍ୟ କରିବା ମୁଁ ଏପର୍ଯ୍ୟନ୍ତ ଜାଣିନାହିଁ। ଦୟାକରି ଅନ୍ୟ ଶବ୍ଦରେ କୁହନ୍ତୁ।",
    },
}


def get_acknowledgement(kind: AckKind, language: str | None) -> str:
    """Return the acknowledgement for `kind` in `language`.

    Falls back to English when `language` is None, empty, or not one of the 11
    supported codes. Falling back is deliberate: an unrecognised code means the
    caller sent something we do not have a translation for, and answering in
    English is strictly better than answering in the wrong script — the latter
    trips the behavioural guard and 502s.

    Accepts either a bare code (`"hi"`) or a BCP-47 tag (`"hi-IN"`).
    """
    if not language:
        return ACKNOWLEDGEMENTS[DEFAULT_LANGUAGE][kind]
    code = language.strip().lower().replace("_", "-").split("-", 1)[0]
    return ACKNOWLEDGEMENTS.get(code, ACKNOWLEDGEMENTS[DEFAULT_LANGUAGE])[kind]


SUPPORTED_LANGUAGES = tuple(ACKNOWLEDGEMENTS)

__all__ = [
    "ACKNOWLEDGEMENTS",
    "SUPPORTED_LANGUAGES",
    "AckKind",
    "get_acknowledgement",
]
