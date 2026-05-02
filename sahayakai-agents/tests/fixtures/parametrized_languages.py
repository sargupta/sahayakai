"""Phase O.1 — language-parametrized test matrix fixtures.

Forensic finding C5: zero language-parametrized tests in the suite. The
user's "what breaks in Hindi?" review rule has been unenforced. These
fixtures power `@pytest.mark.parametrize("language", ALL_LANGUAGES)`
matrices on every narrative agent's happy path.

Languages mirror the production set (`ParentLanguage` literal in
`agents/parent_call/schemas.py` and the same 11 ISO codes used across
voice-to-text, vidya, lesson-plan, etc.).

Each `SAMPLE_SNIPPETS` entry is a short, neutral, classroom-safe
sentence in the target language and script. Used as canned model
output so behavioural-script-checks pass.
"""
from __future__ import annotations

# 11 supported ISO codes: English + 10 Indian languages. The same set
# referenced in `voice_to_text.schemas.ALLOWED_LANGUAGE_ISO_CODES`.
ALL_LANGUAGES: tuple[str, ...] = (
    "en", "hi", "ta", "te", "kn", "bn", "mr", "gu", "pa", "ml", "or",
)

# Native-script sample sentences. Length kept consistent (~30 words
# combined) so they pass the parent-message ≥30-word guard.
SAMPLE_SNIPPETS: dict[str, str] = {
    "en": (
        "Photosynthesis is fascinating. Green plants use sunlight, water, "
        "and carbon dioxide to make their own food, releasing oxygen."
    ),
    "hi": (
        "प्रकाश संश्लेषण रोचक है। हरे पौधे सूर्य के प्रकाश, पानी और "
        "कार्बन डाइऑक्साइड का उपयोग करके अपना भोजन बनाते हैं।"
    ),
    "ta": (
        "ஒளிச்சேர்க்கை சுவாரசியமானது. பச்சை தாவரங்கள் சூரிய ஒளி, "
        "தண்ணீர் மற்றும் கார்பன் டை ஆக்சைடைப் பயன்படுத்தி உணவு தயாரிக்கின்றன."
    ),
    "te": (
        "కిరణజన్య సంయోగక్రియ ఆకర్షణీయమైనది. ఆకుపచ్చ మొక్కలు సూర్యకాంతి, "
        "నీరు మరియు కార్బన్ డయాక్సైడ్‌ను ఉపయోగించి తమ ఆహారాన్ని తయారు చేస్తాయి."
    ),
    "kn": (
        "ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ ಆಸಕ್ತಿದಾಯಕವಾಗಿದೆ. ಹಸಿರು ಸಸ್ಯಗಳು ಸೂರ್ಯನ ಬೆಳಕು, "
        "ನೀರು ಮತ್ತು ಕಾರ್ಬನ್ ಡೈಆಕ್ಸೈಡ್ ಬಳಸಿ ತಮ್ಮ ಆಹಾರವನ್ನು ತಯಾರಿಸುತ್ತವೆ."
    ),
    "bn": (
        "সালোকসংশ্লেষ আকর্ষণীয়। সবুজ গাছপালা সূর্যের আলো, জল এবং "
        "কার্বন ডাই অক্সাইড ব্যবহার করে নিজেদের খাবার তৈরি করে।"
    ),
    "mr": (
        "प्रकाशसंश्लेषण आकर्षक आहे. हिरव्या वनस्पती सूर्यप्रकाश, पाणी आणि "
        "कार्बन डाय ऑक्साईड वापरून स्वतःचे अन्न तयार करतात."
    ),
    "gu": (
        "પ્રકાશસંશ્લેષણ રસપ્રદ છે. લીલા છોડ સૂર્યપ્રકાશ, પાણી અને "
        "કાર્બન ડાયોક્સાઇડનો ઉપયોગ કરીને પોતાનો ખોરાક બનાવે છે."
    ),
    "pa": (
        "ਪ੍ਰਕਾਸ਼ ਸੰਸ਼ਲੇਸ਼ਣ ਦਿਲਚਸਪ ਹੈ। ਹਰੇ ਪੌਦੇ ਸੂਰਜ ਦੀ ਰੌਸ਼ਨੀ, ਪਾਣੀ ਅਤੇ "
        "ਕਾਰਬਨ ਡਾਈਆਕਸਾਈਡ ਦੀ ਵਰਤੋਂ ਕਰਕੇ ਆਪਣਾ ਭੋਜਨ ਬਣਾਉਂਦੇ ਹਨ।"
    ),
    "ml": (
        "പ്രകാശസംശ്ലേഷണം ആകർഷകമാണ്. പച്ച സസ്യങ്ങൾ സൂര്യപ്രകാശം, വെള്ളം, "
        "കാർബൺ ഡൈ ഓക്സൈഡ് എന്നിവ ഉപയോഗിച്ച് സ്വന്തം ഭക്ഷണം ഉണ്ടാക്കുന്നു."
    ),
    "or": (
        "ଆଲୋକ ସଂଶ୍ଳେଷଣ ଆକର୍ଷଣୀୟ। ସବୁଜ ଗଛ ସୂର୍ଯ୍ୟ ଆଲୋକ, ପାଣି ଏବଂ "
        "କାର୍ବନ ଡାଇଅକ୍ସାଇଡ ବ୍ୟବହାର କରି ନିଜର ଖାଦ୍ୟ ତିଆରି କରନ୍ତି।"
    ),
}

# Same set, mapped to the long-form `ParentLanguageName` literal used
# by parent-message and parent-call. Keep in sync with the
# `LANGUAGE_TO_BCP47` map in parent-message-generator.ts and the
# `ParentLanguageName` literal in `agents/parent_message/schemas.py`.
ISO_TO_PARENT_LANGUAGE_NAME: dict[str, str] = {
    "en": "English",
    "hi": "Hindi",
    "ta": "Tamil",
    "te": "Telugu",
    "kn": "Kannada",
    "bn": "Bengali",
    "mr": "Marathi",
    "gu": "Gujarati",
    "pa": "Punjabi",
    "ml": "Malayalam",
    "or": "Odia",
}

# BCP-47 codes for parent-message languageCode wire field.
ISO_TO_BCP47: dict[str, str] = {
    "en": "en-IN",
    "hi": "hi-IN",
    "ta": "ta-IN",
    "te": "te-IN",
    "kn": "kn-IN",
    "bn": "bn-IN",
    "mr": "mr-IN",
    "gu": "gu-IN",
    "pa": "pa-IN",
    "ml": "ml-IN",
    "or": "or-IN",
}


def snippet(language: str) -> str:
    """Return the canned sample for a language; KeyError if unknown."""
    return SAMPLE_SNIPPETS[language]
